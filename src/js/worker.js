import shaderCode from "./shader.wgsl";
// import generateSceneData from "./generateSene";
import onCreateTile from "./onCreateTile";
import loadTile from "./loadTile";
import style from "./style";
import { scale, zxy2center } from "./util/calc";
import makePipline from "./makePipline";
import message from "./util/message";
import { baseTile } from "./util/constants";

var canvas,
  size,
  device,
  styleUniformBuffer,
  msaaColorTexture,
  msaaDepthTexture;

const { baseTileZ, baseTileX, baseTileY, tileSizePixels } = baseTile;

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
    "triangle-strip",
    "fs_dummy",
    true,
    {
      compare: "always",
      passOp: "replace",
    },
  );

  const polygonPipeline = makePipline(
    device,
    bindGroupLayout,
    presentationFormat,
    shaderModule,
    "vs_polygon",
    "triangle-list",
  );

  const thinLinePipeline = makePipline(
    device,
    bindGroupLayout,
    presentationFormat,
    shaderModule,
    "vs_thinline",
    "line-list",
  );

  const linePipeline = makePipline(
    device,
    bindGroupLayout,
    presentationFormat,
    shaderModule,
    "vs_polyline",
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

  styleUniformBuffer = device.createBuffer({
    size: 512,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const megaMatrixBuffer = device.createBuffer({
    size: 50 * 256,
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
    [15, 28192, 13180],
    [15, 28191, 13179],
    [15, 28192, 13179],
  ];
  for (const zxy of zxys) {
    var tileData = await loadTile(zxy);
    // console.log("tiledata:", tileData);
    const drawData = onCreateTile(device, tileData, zxy);
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

    // 全タイルの変換行列を書き込む
    // 256バイト = f32の64個分
    const matrixUploadData = new Float32Array(visibleTiles.length * 64);
    renderPass.setPipeline(maskPipeline);
    for (let i = 0; i < visibleTiles.length; i++) {
      const tile = visibleTiles[i];
      const matrix = computeTileMatrix3x2(
        ...tile.zxy,
        4096,
        viewArray[0],
        viewArray[1],
        viewArray[2],
        ...size,
      );
      const offsetInFloat32 = i * 64;
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
    //ポリゴン;
    renderPass.setPipeline(polygonPipeline);
    for (let i = 0; i < visibleTiles.length; i++) {
      const tile = visibleTiles[i];
      if (tile.polygonIndexCount > 0) {
        const dynamicOffset = i * 256;
        renderPass.setBindGroup(0, globalBindGroup, [dynamicOffset]);
        renderPass.setStencilReference(i + 1); // マスク領域を「i+1」に設定
        renderPass.setVertexBuffer(0, tile.vertexBuffer);
        renderPass.setIndexBuffer(tile.indexBuffer, "uint16");
        renderPass.drawIndexed(tile.polygonIndexCount, 1, 0, 0, 0);
      }
    }

    // ボーダー
    renderPass.setPipeline(thinLinePipeline);
    for (let i = 0; i < visibleTiles.length; i++) {
      const tile = visibleTiles[i];
      if (tile.borderIndexCount > 0) {
        const dynamicOffset = i * 256;
        renderPass.setBindGroup(0, globalBindGroup, [dynamicOffset]);
        renderPass.setStencilReference(i + 1); // マスク領域を「i+1」に設定
        renderPass.setVertexBuffer(0, tile.vertexBuffer);
        renderPass.setIndexBuffer(
          tile.indexBuffer,
          "uint16",
          tile.borderIndexOffset,
        );
        renderPass.drawIndexed(tile.borderIndexCount, 1, 0, 0, 0);
      }
    }

    // ポリライン;
    renderPass.setPipeline(linePipeline);
    for (let i = 0; i < visibleTiles.length; i++) {
      const tile = visibleTiles[i];
      if (tile.lineIndexCount > 0) {
        const dynamicOffset = i * 256;
        renderPass.setBindGroup(0, globalBindGroup, [dynamicOffset]);
        renderPass.setStencilReference(i + 1); // マスク領域を「i+1」に設定
        renderPass.setVertexBuffer(0, tile.vertexBuffer, tile.lineVertexOffset);
        renderPass.setIndexBuffer(
          tile.indexBuffer,
          "uint16",
          tile.lineIndexOffset,
        );
        renderPass.drawIndexed(tile.lineIndexCount, 1, 0, 0, 0);
      }
    }

    // 細いポリライン
    renderPass.setPipeline(thinLinePipeline);
    for (let i = 0; i < visibleTiles.length; i++) {
      const tile = visibleTiles[i];
      if (tile.thinIndexCount > 0) {
        const dynamicOffset = i * 256;
        renderPass.setBindGroup(0, globalBindGroup, [dynamicOffset]);
        renderPass.setStencilReference(i + 1); // マスク領域を「i+1」に設定
        renderPass.setVertexBuffer(0, tile.vertexBuffer, tile.thinVertexOffset);
        renderPass.setIndexBuffer(
          tile.indexBuffer,
          "uint16",
          tile.thinIndexOffset,
        );
        renderPass.drawIndexed(tile.thinIndexCount, 1, 0, 0, 0);
      }
    }

    renderPass.end();
    device.queue.submit([commandEncoder.finish()]);
    viewArray[3] = 0;
    message("t", performance.now() - start);
  }
  render();
}

/**
 * 2Dタイル用の3x2マトリックスを計算する関数
 * @returns {Float32Array} 3x2行列（列優先/Column-major, 要素数6）
 */
function computeTileMatrix3x2(
  tileZ,
  tileX,
  tileY,
  tileExtent,
  centerX,
  centerY,
  currentZoom, // メインスレッドから送られてきたローカル用の値
  width,
  height,
) {
  // 現在のズームでの、基準タイル(z=10)の1枚あたりの画面ピクセルサイズ
  const tilePixelSize = tileSizePixels * Math.pow(2, currentZoom - baseTileZ);

  // クリップ空間（-1 〜 1）に変換するための倍率
  const scaleX = (tilePixelSize / width) * 2.0;
  const scaleY = (tilePixelSize / height) * 2.0;

  // 【超重要】描画しようとしているタイルの「基準タイルから見た相対位置」を計算
  // 描画ターゲットのタイルズーム(tileZ)に合わせて基準タイルの座標をシフトする
  const zoomDiff = tileZ - baseTileZ;
  const shiftedBaseX = baseTileX * Math.pow(2, zoomDiff);
  const shiftedBaseY = baseTileY * Math.pow(2, zoomDiff);

  // 基準タイルから「描画対象のタイル」までの、そのズーム(tileZ)における枚数差（整数）
  const localTileX = tileX - shiftedBaseX;
  const localTileY = tileY - shiftedBaseY;

  // それを基準ズーム（z=10）のタイル枚数単位の距離にリスケールする（桁落ちしない）
  const tileScaleFromBase = 1.0 / Math.pow(2, zoomDiff);
  const tileLocalWorldX = localTileX * tileScaleFromBase;
  const tileLocalWorldY = localTileY * tileScaleFromBase;

  // 1列目 & 2列目: タイル内の頂点(0~4096)を縮小して画面サイズに合わせる
  const m00 = (tileScaleFromBase / tileExtent) * scaleX;
  const m01 = 0.0;
  const m10 = 0.0;
  const m11 = -(tileScaleFromBase / tileExtent) * scaleY;

  // 3列目: 平行移動量（中心座標からの差分）
  // どちらも「基準タイルから数えて何枚目か（0.0〜3.0程度）」の小さな数同士の引き算なので、f32でも精度が100%保たれる！
  const m20 = (tileLocalWorldX - centerX) * scaleX;
  const m21 = -(tileLocalWorldY - centerY) * scaleY;

  return new Float32Array([m00, m01, m10, m11, m20, m21]);
}

function updateCanvasSize(size) {
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
}
