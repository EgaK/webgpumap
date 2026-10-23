import shaderCode from "./shader.wgsl";
import mouseevents from "./util/mouseevents";
import generateSceneData from "./generateSene";
const sab = new SharedArrayBuffer(12);
const viewArray = new Float32Array(sab);

// 初期値
viewArray[0] = 0; // X
viewArray[1] = 0; // Y
viewArray[2] = 1; // Zoom

// ==========================================
// 1. WGSL シェーダーコード
// ==========================================
// const shaderCode = shaderCode;

// ==========================================
// 2. メインロジック (WebGPU 初期化 & 描画)
// ==========================================
async function init() {
  const canvas = document.getElementById("a");
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();

  if (!device) {
    alert("WebGPU をサポートしていないブラウザ、または環境です。");
    return;
  }

  const context = canvas.getContext("webgpu");
  const devicePixelRatio = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * devicePixelRatio;
  canvas.height = window.innerHeight * devicePixelRatio;

  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
    // alphaMode: "premultiplied",
  });

  // 3. データ生成の手前あたりにカメラ状態の変数を追加
  // let zoom = 1.0;
  // let cameraOffset = [0.0, 0.0];

  // ------------------------------------------
  // 3. データ生成関数（ボタン押下時にここを再実行する）
  // ------------------------------------------

  // 初回のデータ生成を実行
  const tile = await generateSceneData(device);

  const uniformBuffer = device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // ユニフォームバッファを更新する関数を作成
  function updateUniforms() {
    // 1. offsetとzoom（12バイト分）を、GPUバッファの先頭（オフセット0）に直接転送
    device.queue.writeBuffer(
      uniformBuffer,
      0,
      viewArray.buffer, // ArrayBufferを直接指定
      viewArray.byteOffset, // 開始位置
      12, // 12バイト分 (f32 x 3要素分)
    );
  }
  function updateUniforms2() {
    device.queue.writeBuffer(
      uniformBuffer,
      12, // 後半の12バイトの位置から書き込み
      new Float32Array([canvas.width, canvas.height]),
    );
  }

  updateUniforms();
  updateUniforms2();
  // ------------------------------------------
  // 5. パイプライン & バインドグループ構築
  // ------------------------------------------
  const shaderModule = device.createShaderModule({ code: shaderCode });
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: { module: shaderModule, entryPoint: "vs_main" },
    fragment: {
      module: shaderModule,
      entryPoint: "fs_main",
      targets: [{ format: presentationFormat }],
    },
    primitive: { topology: "triangle-list" }, // すべて三角形として描画
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: tile.vertexBuffer } },
      { binding: 2, resource: { buffer: tile.indexBuffer } },
      { binding: 3, resource: { buffer: tile.commandBuffer } },
    ],
  });

  // ------------------------------------------
  // 6. 描画発行 (レンダリング)
  // ------------------------------------------
  // 1つのインスタンス（図形）が扱いうる最大の頂点（インデックス）数を算出
  // 折れ線の最大は (元の頂点数-1) * 6。ポリゴンは earcut のインデックス数。
  // commandStructs.forEach((cmd) => {
  //   let count = 0;
  //   if (cmd.fig_type === 0) {
  //     count = cmd.index_count;
  //   } else if (cmd.fig_type === 1) {
  //     count = (cmd.index_count - 1) * 6;
  //   } else if (cmd.fig_type === 2) {
  //     count = cmd.index_count * 3; // ★ 16角形なら 16 * 3 = 48 頂点に修正
  //   }
  //   if (count > maxVerticesPerInstance) maxVerticesPerInstance = count;
  // });

  function render() {
    const commandEncoder = device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    renderPass.setPipeline(pipeline);
    renderPass.setBindGroup(0, bindGroup);

    // ★単一のドローコールですべての線と面を一括描画！
    renderPass.draw(tile.maxVerticesPerInstance, tile.comLen, 0, 0);

    renderPass.end();
    device.queue.submit([commandEncoder.finish()]);

    fpsCounter.update();
  }

  render();
  mouseevents(
    viewArray,
    render,
    updateUniforms,
    updateUniforms2,
    generateSceneData,
  );
}

init();
