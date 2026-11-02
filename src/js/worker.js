import shaderCode from "./shader.wgsl";
// import generateSceneData from "./generateSene";
import onCreateTile from "./onCreateTile";
import loadTile from "./loadTile";
import style from "./style";
import { scale } from "./util/calc";
import makePipline from "./makePipline";

self.onmessage = async (e) => {
  if (e.data["c"]) {
    const sab = e.data["b"];
    const viewArray = new Float32Array(sab);
    init(e.data["c"], e.data["s"], viewArray);
  }
};

async function init(canvas, size, viewArray) {
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();

  if (!device) {
    self.postMessage({
      type: "error",
      message: "WebGPU をサポートしていないブラウザ、または環境です。",
    });
    return;
  }

  if (DEVELOP) {
    device.pushErrorScope("validation");
    const error = await device.popErrorScope();
    if (error) {
      console.error("WebGPU バリデーションエラー:", error.message);
    }
    device.lost.then((info) => {
      console.error(`WebGPU デバイスが喪失しました。理由: ${info.reason}`);
      console.error(`メッセージ: ${info.message}`);

      // 理由に応じた適切なリカバリ処理
      if (info.reason === "destroyed") {
        // 自ら意図して device.destroy() を呼んだ場合
        console.log("デバイスは意図的に破棄されました。");
      } else {
        // 'unknown' などの場合、デバイスの再生成（再初期化）を試みる
        console.log("デバイスを再初期化します...");
        // handleDeviceLossAndReinit();
      }
    });
  }

  const context = canvas.getContext("webgpu");
  canvas.width = size[0];
  canvas.height = size[1];

  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
    // alphaMode: "opaque",
    alphaMode: "premultiplied",
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

  // グループ1（タイル固有のpropertyBuffer用）の設計図
  const tileBindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX, // 頂点シェーダーで使う場合
        buffer: { type: "read-only-storage" }, // ストレージバッファ(読み込み専用)が入りますよという宣言
      },
      // {
      //   binding: 1,
      //   visibility: GPUShaderStage.VERTEX,
      //   buffer: { type: "read-only-storage" },
      // },
    ],
  });

  // ==========================================
  // 2. 設計図を元に パイプライン を作成する
  // ==========================================
  const shaderModule = device.createShaderModule({ code: shaderCode });

  const polygonPipeline = makePipline(
    device,
    commonBindGroupLayout,
    tileBindGroupLayout,
    presentationFormat,
    shaderModule,
    "vs_polygon",
    8,
    [
      [0, "uint32"],
      [4, "uint32"],
    ],
    "triangle-list",
  );

  const thinLinePipeline = makePipline(
    device,
    commonBindGroupLayout,
    tileBindGroupLayout,
    presentationFormat,
    shaderModule,
    "vs_thinline",
    8,
    [
      [0, "uint32"],
      [4, "uint32"],
    ],
    "line-list",
  );

  const thinLinePipeline2 = makePipline(
    device,
    commonBindGroupLayout,
    tileBindGroupLayout,
    presentationFormat,
    shaderModule,
    "vs_thinline2",
    16,
    [
      [0, "sint32x2"],
      [8, "sint32"],
    ],
    "line-list",
  );

  const linePipeline = makePipline(
    device,
    commonBindGroupLayout,
    tileBindGroupLayout,
    presentationFormat,
    shaderModule,
    "vs_polyline",
    32,
    [
      [0, "sint32x2"],
      [8, "sint32"],
      [12, "uint32"], // pad用 将来なにかに使ってね
      [16, "float32x2"],
    ],
    "triangle-list",
    "fs_polyline",
  );

  if (DEVELOP) {
    const compilationInfo = await shaderModule.getCompilationInfo();
    for (const message of compilationInfo.messages) {
      console.error(
        `WGSL error: ${message.message} at line ${message.lineNum}`,
      );
    }
  }

  const uniformBuffer = device.createBuffer({
    size: 256,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  let styleTable = [];
  for (const s of style) {
    if (Array.isArray(s.thickness)) {
      styleTable.push(...s.thickness.flat());
      s.thickness = -(~~styleTable.length / 4);
    }
    if (Array.isArray(s.OPacity)) {
      styleTable.push(...s.OPacity.flat());
      s.OPacity = -(~~styleTable.length / 4);
    }
  }

  console.log("style", styleTable, style);

  device.queue.writeBuffer(uniformBuffer, 128, new Float32Array(styleTable));

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
  // const tileData = await generateSceneData();
  var tileData = await loadTile([15, 28191, 13180]);
  console.log("tileData", tileData);
  const visibleTiles = [onCreateTile(device, tileBindGroupLayout, tileData)];
  console.log("tiles", visibleTiles);
  // ユニフォームバッファを更新する関数を作成
  function updateCamera() {
    // 1. offsetとzoom, flagw（16バイト分）を、GPUバッファの先頭（オフセット0）に直接転送

    device.queue.writeBuffer(
      uniformBuffer,
      64,
      new Float32Array([
        viewArray[0],
        viewArray[1],
        viewArray[2],
        scale(viewArray[2]), //flagはシェーダでは必要ないのでscaleとして使用する
      ]),
    );
  }
  function updateCanvasSize() {
    device.queue.writeBuffer(
      uniformBuffer,
      80, // 後半の16バイトの位置から書き込み
      new Float32Array([canvas.width, canvas.height]),
    );
  }

  updateCamera();
  updateCanvasSize();

  // 1. MSAA用のカラーテクスチャ（4倍サンプリング）
  const msaaColorTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    sampleCount: 4, // ★ここを4にする
    format: navigator.gpu.getPreferredCanvasFormat(),
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  // 2. MSAA用の深度テクスチャ（こちらも4倍にする必要がある）
  const msaaDepthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    sampleCount: 4, // ★カラーと合わせる
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  function render() {
    requestAnimationFrame(render);
    if (!viewArray[3]) return;
    updateCamera();
    const commandEncoder = device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: msaaColorTexture.createView(),
          resolveTarget: context.getCurrentTexture().createView(),
          clearValue: {
            r: 0.96,
            g: 0.97,
            b: 0.98,
            a: 1,
          },
          loadOp: "clear",
          storeOp: "discard",
        },
      ],
      depthStencilAttachment: {
        view: msaaDepthTexture.createView(),
        depthClearValue: 0.0,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });

    renderPass.setBindGroup(0, globalBindGroup);

    for (const tile of visibleTiles) {
      renderPass.setBindGroup(1, tile.bindGroup);
      //ポリゴン
      renderPass.setVertexBuffer(0, tile.polygonVertexBuffer);
      renderPass.setPipeline(polygonPipeline);
      renderPass.setIndexBuffer(tile.polygonIndexBuffer, "uint32");
      renderPass.drawIndexed(tile.polygonIndexCount, 1, 0, 0, 0);
      // ボーダー
      renderPass.setPipeline(thinLinePipeline);
      renderPass.setIndexBuffer(tile.borderIndexBuffer, "uint32");
      renderPass.drawIndexed(tile.borderIndexCount, 1, 0, 0, 0);
      // ポリライン;
      renderPass.setVertexBuffer(0, tile.lineVertexBuffer);
      renderPass.setPipeline(linePipeline);
      renderPass.setIndexBuffer(tile.lineIndexBuffer, "uint32");
      renderPass.drawIndexed(tile.lineIndexCount, 1, 0, 0, 0);
      // 細いポリライン
      renderPass.setVertexBuffer(0, tile.thinVertexBuffer);
      renderPass.setPipeline(thinLinePipeline2);
      renderPass.setIndexBuffer(tile.thinIndexBuffer, "uint32");
      renderPass.drawIndexed(tile.thinIndexCount, 1, 0, 0, 0);
    }

    renderPass.end();
    device.queue.submit([commandEncoder.finish()]);
    viewArray[3] = 0;
  }
  render();
}
