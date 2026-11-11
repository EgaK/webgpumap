import shaderCode from "./shader.wgsl";
// import generateSceneData from "./generateSene";
import onCreateTile from "./onCreateTile";
import loadTile from "./loadTile";
import style from "./style";
import makePipline from "./makePipline";
import message from "./util/message";
import {
  requiredTiles,
  transformMatrix,
  packTileId,
  unpackTileId,
} from "./util/calc";

var canvas, size, device, msaaColorTexture, msaaDepthTexture;

self.onmessage = async (e) => {
  if (e.data["c"]) {
    canvas = e.data["c"];
    size = e.data["s"];
    const sab = e.data["b"];
    const viewArray = new Float32Array(sab);
    init(viewArray);
  } else if (e.data["s"]) {
    size = e.data["s"];
    canvas.width = size[0];
    canvas.height = size[1];
    updateCanvasSize(size);
  }
};

async function init(viewArray) {
  const adapter = await navigator.gpu?.requestAdapter();
  device = await adapter?.requestDevice();

  if (!device) {
    message("e", "WebGPU をサポートしていないブラウザ、または環境です。");
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
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX, // | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }, // Uniformバッファが入りますよという宣言
      },
      {
        binding: 1, // タイル毎の行列（動的）
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "uniform", hasDynamicOffset: true }, // 動的オフセットあり！
      },
    ],
  });

  // ==========================================
  // 2. 設計図を元に パイプライン を作成する
  // ==========================================
  const shaderModule = device.createShaderModule({ code: shaderCode });

  const maskPipeline = makePipline(
    device,
    bindGroupLayout,
    presentationFormat,
    shaderModule,
    "vs_mask",
    0,
    [],
    "triangle-strip",
    "fs_dummy",
    true,
    {
      compare: "always",
      passOp: "replace",
    },
  );

  let piplines = [];

  piplines.push(
    makePipline(
      device,
      bindGroupLayout,
      presentationFormat,
      shaderModule,
      "vs_polygon",
      8,
      [
        [0, "sint16x2"],
        [4, "sint16"],
      ],
      "triangle-list",
    ),
  );

  piplines.push(
    makePipline(
      device,
      bindGroupLayout,
      presentationFormat,
      shaderModule,
      "vs_thinline",
      8,
      [
        [0, "sint16x2"],
        [4, "sint16"],
      ],
      "line-list",
    ),
  );

  piplines.push(
    makePipline(
      device,
      bindGroupLayout,
      presentationFormat,
      shaderModule,
      "vs_polyline",
      12,
      [
        [0, "sint16x2"],
        [4, "sint16"],
        [8, "sint16x2"],
      ],
      "triangle-list",
      "fs_polyline",
    ),
  );

  if (DEVELOP) {
    const compilationInfo = await shaderModule.getCompilationInfo();
    for (const message of compilationInfo.messages) {
      console.error(
        `WGSL error: ${message.message} at line ${message.lineNum}`,
      );
    }
  }

  const styleUniformBuffer = device.createBuffer({
    size: 512,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const megaMatrixBuffer = device.createBuffer({
    size: 50 * 128,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  let clampTable = [];
  let styleTable = [];
  // for (const s of style) {
  for (let i = style.length; i--;) {
    const s = style[i];
    if (/p|s/.test(s.Type)) continue;
    s.ID = ~~(styleTable.length / 8);
    let thickness = s.thickness || 1;
    let opacity = s.OPacity || 1;
    if (Array.isArray(thickness)) {
      clampTable.push(...thickness.flat());
      thickness = -(~~clampTable.length / 4);
    }
    if (Array.isArray(opacity)) {
      clampTable.push(...opacity.flat());
      opacity = -(~~clampTable.length / 4);
    }
    const fillColor = s.Type == "l" ? [1, 1, 1] : s.Color;
    const lineColor = s.Type == "f" ? [0, 0, 0] : s.Color;
    styleTable.push(...fillColor, opacity, ...lineColor, thickness);
  }

  device.queue.writeBuffer(
    styleUniformBuffer,
    16,
    new Float32Array(clampTable),
  );
  device.queue.writeBuffer(
    styleUniformBuffer,
    128,
    new Float32Array(styleTable),
  );

  // ==========================================
  // 3. 設計図（共通レイアウト）に、実際の一時バッファを紐付ける
  // ==========================================
  // 画面全体で1つだけ使い回す実体（BindGroup）
  const globalBindGroup = device.createBindGroup({
    layout: bindGroupLayout, // グループ0の設計図を指定
    entries: [
      { binding: 0, resource: { buffer: styleUniformBuffer } }, // 実体バッファ
      { binding: 1, resource: { buffer: megaMatrixBuffer, size: 32 } }, // 1回に読むのは32バイト
    ],
  });

  // 初回のデータ生成を実行
  // const tileData = await generateSceneData();

  const visibleTiles = [];
  var zxys = [
    [15, 28191, 13180],
    // [15, 28192, 13180],
    // [15, 28191, 13179],
    // [15, 28192, 13179],
    // [10, 880, 411],
    // [10, 880, 411],
    // [10, 881, 411],
    // [13, 7047, 3295],
  ];
  for (const zxy of zxys) {
    var tileData = await loadTile(zxy);
    // console.log("tiledata:", tileData);
    const drawData = onCreateTile(device, tileData, zxy);
    // console.log({ drawData });
    visibleTiles.push(drawData);
  }

  updateCanvasSize(size);

  function render() {
    requestAnimationFrame(render);
    if (!viewArray[3]) return;
    const start = performance.now();
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
        stencilClearValue: 0, // ステンシルの初期値
        stencilLoadOp: "clear",
        stencilStoreOp: "store",
      },
    });

    //ズーム値を書き込む
    device.queue.writeBuffer(
      styleUniformBuffer,
      0,
      new Float32Array([viewArray[2]]),
    );

    const reqT = requiredTiles(
      viewArray[0],
      viewArray[1],
      viewArray[2],
      ...size,
    );
    console.log("必要なタイル：", reqT);
    const testTiles = [];
    // new Promise((resolve) => {
    //   setTimeout(() => {
    //     testTiles.push({ "foo": true });
    //     resolve();
    //     viewArray[3] = 1;
    //   }, 300);
    // });
    // new Promise((resolve) => {
    //   setTimeout(() => {
    //     testTiles.push({ "bar": true });
    //     resolve();
    //     viewArray[3] = 1;
    //   }, 3000);
    // });

    console.log("testTile:", testTiles);

    // 全タイルの変換行列を書き込む
    const matrixUploadData = new Float32Array(visibleTiles.length * 32);
    renderPass.setPipeline(maskPipeline);
    for (let i = 0; i < visibleTiles.length; i++) {
      const tile = visibleTiles[i];
      const matrix = transformMatrix(
        ...tile.zxy,
        4096,
        viewArray[0],
        viewArray[1],
        viewArray[2],
        ...size,
      );
      const offsetInFloat32 = i * 32;
      matrixUploadData.set(matrix, offsetInFloat32);
    }
    //  まとめて 1回の writeBuffer で GPU へ一括転送！
    device.queue.writeBuffer(megaMatrixBuffer, 0, matrixUploadData);

    //ステンシルマスク
    renderPass.setPipeline(maskPipeline);
    for (let i = 0; i < visibleTiles.length; i++) {
      const dynamicOffset = i * 256;
      renderPass.setBindGroup(0, globalBindGroup, [dynamicOffset]);
      renderPass.setStencilReference(i + 1); // マスク領域を「1」に設定
      // 頂点バッファなしで4頂点のTriangle Stripを描画
      renderPass.draw(4, 1, 0, 0);
    }

    for (let j = 0; j < 4; j++) {
      const pidx = [0, 1, 1, 2];
      if (j != 2) {
        renderPass.setPipeline(piplines[pidx[j]]);
      }
      for (let i = 0; i < visibleTiles.length; i++) {
        const tile = visibleTiles[i];
        if (tile.lenArray[j] > 0) {
          const dynamicOffset = i * 256;
          renderPass.setBindGroup(0, globalBindGroup, [dynamicOffset]);
          renderPass.setStencilReference(i + 1); // マスク領域を「i+1」に設定
          renderPass.setVertexBuffer(0, tile.buffer, tile.vOffsetArray[j]);
          renderPass.setIndexBuffer(
            tile.buffer,
            "uint16",
            tile.iOffsetArray[j],
          );
          renderPass.drawIndexed(tile.lenArray[j], 1, 0, 0, 0);
        }
      }
    }

    renderPass.end();
    device.queue.submit([commandEncoder.finish()]);
    viewArray[3] = 0;
    message("t", performance.now() - start);
  }
  render();
}

const updateCanvasSize = (size) => {
  // 1. MSAA用のカラーテクスチャ（4倍サンプリング）
  msaaColorTexture = device.createTexture({
    size: size,
    sampleCount: 4, // ★ここを4にする
    format: navigator.gpu.getPreferredCanvasFormat(),
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  // 2. MSAA用の深度テクスチャ（こちらも4倍にする必要がある）
  msaaDepthTexture = device.createTexture({
    size: size,
    sampleCount: 4, // ★カラーと合わせる
    format: "depth24plus-stencil8",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
};
