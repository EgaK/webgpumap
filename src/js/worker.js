import shaderCode from "./shader.wgsl";
// import generateSceneData from "./generateSene";
import onCreateTile from "./onCreateTile";
import loadTile from "./loadTile";
import style from "./style";
import { scale, zxy2center } from "./util/calc";
import makePipline from "./makePipline";
import message from "./util/message";
import { baseTile } from "./util/constants";

var canvas, size, device, uniformBuffer, msaaColorTexture, msaaDepthTexture;

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
  const commonBindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX, // | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }, // Uniformバッファが入りますよという宣言
      },
    ],
  });

  // グループ1（タイル固有のpropertyBuffer用）の設計図
  const tileBindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX, // | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }, // Uniformバッファが入りますよという宣言
      },
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
    16,
    [
      [0, "sint32x2"],
      [8, "sint32"],
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
      [12, "sint32"], // pad用 将来なにかに使ってね
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

  uniformBuffer = device.createBuffer({
    size: 512,
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

  console.log("style", clampTable, styleTable, style);

  device.queue.writeBuffer(uniformBuffer, 16, new Float32Array(clampTable));
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

  const visibleTiles = [];
  var zxys = [
    [15, 28191, 13180],
    [15, 28192, 13180],
    [15, 28191, 13179],
    [15, 28192, 13179],
  ];
  for (const zxy of zxys) {
    var tileData = await loadTile(zxy);
    console.log("tileData", tileData);
    const drawData = onCreateTile(device, tileBindGroupLayout, tileData, zxy);
    visibleTiles.push(drawData);
  }
  console.log("tiles", visibleTiles);

  // ユニフォームバッファを更新する関数を作成
  function updateCamera(zxy, buffer) {
    // Uniformにはzoom情報のみ
    device.queue.writeBuffer(
      uniformBuffer,
      0,
      new Float32Array([viewArray[2]]),
    );

    const matrix = computeTileMatrix3x2(
      ...zxy,
      4096,
      viewArray[0],
      viewArray[1],
      viewArray[2],
      ...size,
    );
    device.queue.writeBuffer(buffer, 0, matrix);
  }

  // updateCamera(zxys[0]);
  updateCanvasSize(size);

  function render() {
    requestAnimationFrame(render);
    if (!viewArray[3]) return;
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
      updateCamera(tile.zxy, tile.transformBuffer);
      renderPass.setBindGroup(1, tile.bindGroup);
      //ポリゴン
      if (tile.polygonIndexCount > 0) {
        renderPass.setVertexBuffer(0, tile.polygonVertexBuffer);
        renderPass.setPipeline(polygonPipeline);
        renderPass.setIndexBuffer(tile.polygonIndexBuffer, "uint32");
        renderPass.drawIndexed(tile.polygonIndexCount, 1, 0, 0, 0);
      }
      // ボーダー
      if (tile.borderIndexCount > 0) {
        renderPass.setPipeline(thinLinePipeline);
        renderPass.setIndexBuffer(tile.borderIndexBuffer, "uint32");
        renderPass.drawIndexed(tile.borderIndexCount, 1, 0, 0, 0);
      }
      // ポリライン;
      if (tile.lineIndexCount > 0) {
        renderPass.setVertexBuffer(0, tile.lineVertexBuffer);
        renderPass.setPipeline(linePipeline);
        renderPass.setIndexBuffer(tile.lineIndexBuffer, "uint32");
        renderPass.drawIndexed(tile.lineIndexCount, 1, 0, 0, 0);
      }
      // 細いポリライン
      if (tile.thinIndexCount > 0) {
        renderPass.setVertexBuffer(0, tile.thinVertexBuffer);
        renderPass.setPipeline(thinLinePipeline);
        renderPass.setIndexBuffer(tile.thinIndexBuffer, "uint32");
        renderPass.drawIndexed(tile.thinIndexCount, 1, 0, 0, 0);
      }
    }

    renderPass.end();
    device.queue.submit([commandEncoder.finish()]);
    viewArray[3] = 0;
  }
  render();
}

/**
 * 2Dタイル用の3x2マトリックスを計算する関数
 * @returns {Float32Array} 3x2行列（列優先/Column-major, 要素数6）
 */
function computeTileMatrix3x21(
  tileZ,
  tileX,
  tileY,
  tileExtent,
  centerX,
  centerY,
  currentZoom,
  width,
  height,
  tileSizePixels = 1024,
) {
  const totalWorldPixels = tileSizePixels * Math.pow(2, currentZoom);
  const scaleX = (totalWorldPixels / width) * 2.0;
  const scaleY = (totalWorldPixels / height) * 2.0;

  const tileNum = Math.pow(2, tileZ);
  const tileScale = 1.0 / tileNum;
  const tileWorldX = tileX * tileScale;
  const tileWorldY = tileY * tileScale;

  // 1列目: X軸のスケール
  const m00 = (tileScale / tileExtent) * scaleX;
  const m01 = 0.0;

  // 2列目: Y軸のスケール（MVTの特性に合わせて反転）
  const m10 = 0.0;
  const m11 = -(tileScale / tileExtent) * scaleY;

  // 3列目: 平行移動量（中心座標からの差分）
  const m20 = (tileWorldX - centerX) * scaleX;
  const m21 = -(tileWorldY - centerY) * scaleY;

  // WGSLの mat3x2<f32> に適合する配列（列優先：1列目、2列目、3列目の順）
  return new Float32Array([m00, m01, m10, m11, m20, m21]);
}

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
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
}
