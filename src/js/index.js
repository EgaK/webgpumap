import shaderCode from "./shader.wgsl";
import mouseevents from "./util/mouseevents";
import generateSceneData from "./generateSene";
import onCreateTile from "./onCreateTile";

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

  // ==========================================
  // 1. 各スロットの「設計図（レイアウト）」を定義する
  // ==========================================

  // グループ0（画面共通Uniform用）の設計図
  const commonBindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }, // Uniformバッファが入りますよという宣言
      },
    ],
  });

  // グループ1（タイル固有のcommandBuffer用）の設計図
  const tileBindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX, // 頂点シェーダーで使う場合
        buffer: { type: "read-only-storage" }, // ストレージバッファ(読み込み専用)が入りますよという宣言
      },
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "read-only-storage" },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "read-only-storage" },
      },
    ],
  });

  // ==========================================
  // 2. 設計図を元に パイプライン を作成する
  // ==========================================
  const shaderModule = device.createShaderModule({ code: shaderCode });
  const pipeline = device.createRenderPipeline({
    // layout: "auto" の代わりに、2つの設計図を配列で渡す
    layout: device.createPipelineLayout({
      bindGroupLayouts: [commonBindGroupLayout, tileBindGroupLayout],
    }),
    vertex: { module: shaderModule, entryPoint: "vs_main" },
    fragment: {
      module: shaderModule,
      entryPoint: "fs_main",
      targets: [{ format: presentationFormat }],
    },
    primitive: { topology: "triangle-list" },
  });

  const uniformBuffer = device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // ==========================================
  // 3. 設計図（共通レイアウト）に、実際の一時バッファを紐付ける
  // ==========================================
  // 画面全体で1つだけ使い回す実体（BindGroup）
  const globalBindGroup = device.createBindGroup({
    layout: commonBindGroupLayout, // グループ0の設計図を指定
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } }, // 実体バッファ
    ],
  });

  // 初回のデータ生成を実行
  const tileData = await generateSceneData();
  const visibleTiles = [onCreateTile(device, tileBindGroupLayout, tileData)];

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
    renderPass.setBindGroup(0, globalBindGroup);

    for (const tile of visibleTiles) {
      // ★単一のドローコールですべての線と面を一括描画！
      renderPass.setBindGroup(1, tile.bindGroup);
      renderPass.draw(tile.maxVerticesPerInstance, tile.comLen, 0, 0);
    }

    renderPass.end();
    device.queue.submit([commandEncoder.finish()]);
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
