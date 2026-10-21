import earcut from "./util/earcut.dev";
import shaderCode from "./shader.wgsl";
import loadTile from "./loadTile";

// ==========================================
// 1. WGSL シェーダーコード
// ==========================================
// const shaderCode = shaderCode;

// ==========================================
// 2. メインロジック (WebGPU 初期化 & 描画)
// ==========================================
async function init() {
  const canvas = document.getElementById("gpuCanvas");
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
    alphaMode: "premultiplied",
  });

  // 3. データ生成の手前あたりにカメラ状態の変数を追加
  let zoom = 1.0;
  let cameraOffset = [0.0, 0.0];
  let isDragging = false;
  let previousMousePosition = { x: 0, y: 0 };

  // ------------------------------------------
  // 3. データ生成関数（ボタン押下時にここを再実行する）
  // ------------------------------------------
  let allVertices = [];
  let allIndices = [];
  let commandStructs = [];
  let maxVerticesPerInstance = 0;

  async function generateSceneData() {
    // 配列をきれいにリセット
    allVertices = [];
    allIndices = [];
    commandStructs = [];
    maxVerticesPerInstance = 0;

    let vertexBase = 0;
    let indexBase = 0;

    // ヘルパー：ポリゴン追加
    function addPolygon(rings, fillColor, strokeColor, strokeThickness) {
      // rings は [ outerLoop, innerHole1, innerHole2, ... ] という構造を想定

      const earcutRawData = []; // earcut用の一時的なフラット配列 [x1,y1, x2,y2, ...]
      const flatData = []; // GPUバッファ用のパックされた u32 配列
      const holeIndices = []; // 穴の開始位置（頂点単位のインデックス）を記録する配列

      let currentVertexCount = 0;

      for (let i = 0; i < rings.length; i++) {
        const ring = rings[i];
        if (ring.length === 0) continue;

        // 2つ目以降のリング（＝穴）である場合、現在の合計頂点数を穴の開始位置として記録
        if (i > 0) {
          holeIndices.push(currentVertexCount);
        }

        // リング内の頂点を処理
        for (const p of ring) {
          // earcut用
          earcutRawData.push(p[0], p[1]);

          // GPUバッファ用（16ビットのバイナリを取り出してドッキング）
          const combined = ((p[1] & 0xffff) << 16) | (p[0] & 0xffff);
          flatData.push(combined);

          currentVertexCount++;
        }
      }

      // 生のX,Y配列と、穴の位置配列を渡して三角形分割を行う
      const indices = earcut(earcutRawData, holeIndices);

      if (indices.length === 0) return;

      // 1要素 = 1頂点 になったため、頂点数は平坦化した全体の合計頂点数になります
      const vertexCount = flatData.length;

      allVertices.push(...flatData);
      allIndices.push(...indices);

      commandStructs.push({
        color: fillColor,
        thickness: 0.0,
        index_base: indexBase,
        index_count: indices.length,
        fig_type: 0,
        vertex_base: vertexBase,
      });

      // グローバルなオフセットの更新
      vertexBase += vertexCount;
      indexBase += indices.length;

      // 枠線（折れ線）用の処理
      // 外周だけでなく、すべてのリング（穴の輪郭含む）に対して個別に枠線を描画する
      for (const ring of rings) {
        if (ring.length > 0) {
          const strokePoints = [...ring, ring[0]]; // 終点と始点をつなぎ合わせる
          addPolyline(strokePoints, strokeColor, strokeThickness);
        }
      }
    }

    // ヘルパー：折れ線追加
    function addPolyline(points, color, thickness) {
      for (const p of points) {
        const combined = ((p[1] & 0xffff) << 16) | (p[0] & 0xffff);
        allVertices.push(combined);
      }
      commandStructs.push({
        color: color,
        thickness: thickness,
        index_base: 0,
        index_count: points.length,
        fig_type: 1,
        vertex_base: vertexBase,
      });

      // 各頂点に関節用の「丸」を追加
      for (let i = 0; i < points.length; i++) {
        commandStructs.push({
          color: color,
          thickness: thickness,
          index_base: i,
          index_count: 32, // 分割数32で固定
          fig_type: 2,
          vertex_base: vertexBase,
        });
      }

      vertexBase += points.length;
    }

    // --- データのランダム自動生成 (5000個ずつの例) ---
    const NUM_POLYGONS = 5000;
    const NUM_LINES = 5000;

    for (let i = 0; i < NUM_POLYGONS; i++) {
      const cx = Math.random() * 4096;
      const cy = Math.random() * 4096;
      const size = 50 + Math.random() * 100;

      const outerStar = [];
      const innerHole = []; // 穴用の配列を追加

      // 星のトゲの数（5〜9個）をランダムに決定
      const numPoints = 5 + Math.floor(Math.random() * 5);

      // 1. 外周（星型）：MVT仕様に合わせて時計回り(CW)にするため、angleをマイナス方向に回す
      for (let j = 0; j < numPoints * 2; j++) {
        const angle = -(j / (numPoints * 2)) * Math.PI * 2;
        const r = j % 2 === 0 ? size : size * 0.4;
        const p = [~~(cx + Math.cos(angle) * r), ~~(cy + Math.sin(angle) * r)];
        outerStar.push(p);
      }

      // 2. 穴（五角形）：星の谷よりもさらに内側（size * 0.25）に、反時計回り(CCW)で生成
      const holePoints = 5;
      const holeSize = size * 0.25;
      for (let j = 0; j < holePoints; j++) {
        const angle = (j / holePoints) * Math.PI * 2; // プラス方向（反時計回り）
        const p = [
          ~~(cx + Math.cos(angle) * holeSize),
          ~~(cy + Math.sin(angle) * holeSize),
        ];
        innerHole.push(p);
      }

      // 3. addPolygonへの受け渡し
      // earcutに「外周と穴」をセットで認識させるため、2つのリングをまとめた配列として渡します。
      // (MVTの loadGeometry() が返す [outerRing, innerRing1, ...] と同じ構造になります)
      const polygonRings = [outerStar, innerHole];

      addPolygon(
        polygonRings, // 外周と穴を含んだ多重配列を渡す
        [Math.random(), Math.random(), Math.random(), Math.random()],
        [Math.random(), Math.random(), Math.random(), Math.random()],
        2.0 + Math.random() * 15.0,
      );
    }

    for (let i = 0; i < NUM_LINES; i++) {
      const points = [];
      const numSegments = 2 + Math.floor(Math.random() * 10);
      let sx = ~~((Math.random() * 2 - 1) * 0.9 * 2048 + 2048);
      let sy = ~~((Math.random() * 2 - 1) * 0.9 * 2048 + 2048);
      points.push([sx, sy]);
      for (let j = 0; j < numSegments; j++) {
        sx += ~~(Math.random() * 200 - 100);
        sy += ~~(Math.random() * 200 - 100);
        sx = sx >= 4096 ? 4096 : sx < 0 ? 0 : sx;
        sy = sy >= 4096 ? 4096 : sy < 0 ? 0 : sy;
        points.push([sx, sy]);
      }
      // console.log("points:", points);
      addPolyline(
        points,
        [Math.random(), Math.random(), Math.random(), Math.random()],
        2.0 + Math.random() * 15.0,
      );
    }

    var axs = await loadTile([15, 28191, 13180]);
    for (var i = 0; i < axs.length; i++) {
      // console.log(axs[i]);
      // addPolyline(axs[i].flat(), [0.2, 0.2, 0.2], 10);
    }

    // 最大頂点数の計算
    commandStructs.forEach((cmd) => {
      let count = 0;
      if (cmd.fig_type === 0) count = cmd.index_count;
      else if (cmd.fig_type === 1) count = (cmd.index_count - 1) * 6;
      else if (cmd.fig_type === 2) count = cmd.index_count * 3;
      if (count > maxVerticesPerInstance) maxVerticesPerInstance = count;
    });
  }

  // 初回のデータ生成を実行
  generateSceneData();

  // ------------------------------------------
  // 4. GPUバッファの作成（最大サイズで固定確保）
  // ------------------------------------------
  // デモが扱いうる最大のバイトサイズをあらかじめ確保 (1万個の図形が余裕で入るサイズ)
  // const MAX_VERTEX_BYTES = 1024 * 1024 * 32; // 32MB
  // const MAX_INDEX_BYTES = 1024 * 1024 * 16; // 16MB
  // const MAX_COMMAND_BYTES = 100000 * 48; // 10万コマンド分

  const uniformBuffer = device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const vertexBufferSize = allVertices.length * 4; // Uint32Array は1要素4バイト

  // ★ 各バッファに COPY_DST（データの書き込み許可）を追加
  const vertexBuffer = device.createBuffer({
    size: vertexBufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  const indexBufferSize = allIndices.length * 4; // Uint32Array は1要素4バイト

  const indexBuffer = device.createBuffer({
    size: indexBufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  const commandBufferSize = commandStructs.length * 48; // commandStructs は1要素48バイト

  const commandBuffer = device.createBuffer({
    size: commandBufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  // 生成された配列データをGPUバッファに転送する関数
  function uploadDataToGPU() {
    const vertexData = new Uint32Array(allVertices);
    const indexData = new Uint32Array(allIndices);

    const STRIDE = 48;
    const commandBufferSize = commandStructs.length * STRIDE;
    const commandArrayBuffer = new ArrayBuffer(commandBufferSize);
    const commandView = new DataView(commandArrayBuffer);

    commandStructs.forEach((cmd, i) => {
      const offset = i * STRIDE;
      commandView.setFloat32(offset + 0, cmd.color[0], true);
      commandView.setFloat32(offset + 4, cmd.color[1], true);
      commandView.setFloat32(offset + 8, cmd.color[2], true);
      commandView.setFloat32(offset + 12, cmd.color[3], true);
      commandView.setFloat32(offset + 16, cmd.thickness, true);
      commandView.setUint32(offset + 20, cmd.index_base, true);
      commandView.setUint32(offset + 24, cmd.index_count, true);
      commandView.setUint32(offset + 28, cmd.fig_type, true);
      commandView.setUint32(offset + 32, cmd.vertex_base, true);
    });

    // writeBuffer を使って、すでにGPUにあるバッファの中身を上書き
    device.queue.writeBuffer(vertexBuffer, 0, vertexData);
    device.queue.writeBuffer(indexBuffer, 0, indexData);
    device.queue.writeBuffer(
      commandBuffer,
      0,
      new Uint8Array(commandArrayBuffer),
    );
  }

  // ユニフォームバッファを更新する関数を作成
  function updateUniforms() {
    const uniformData = new Float32Array([
      canvas.width,
      canvas.height, // u_resolution
      zoom,
      4096.0, // u_coordinate_max, pad兼用
      cameraOffset[0],
      cameraOffset[1], // u_offset
    ]);
    device.queue.writeBuffer(uniformBuffer, 0, uniformData);
  }

  // 初回データをGPUにアップロード
  uploadDataToGPU();
  updateUniforms();

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
      { binding: 1, resource: { buffer: vertexBuffer } },
      { binding: 2, resource: { buffer: indexBuffer } },
      { binding: 3, resource: { buffer: commandBuffer } },
    ],
  });

  // ------------------------------------------
  // 6. 描画発行 (レンダリング)
  // ------------------------------------------
  // 1つのインスタンス（図形）が扱いうる最大の頂点（インデックス）数を算出
  // 折れ線の最大は (元の頂点数-1) * 6。ポリゴンは earcut のインデックス数。
  commandStructs.forEach((cmd) => {
    let count = 0;
    if (cmd.fig_type === 0) {
      count = cmd.index_count;
    } else if (cmd.fig_type === 1) {
      count = (cmd.index_count - 1) * 6;
    } else if (cmd.fig_type === 2) {
      count = cmd.index_count * 3; // ★ 16角形なら 16 * 3 = 48 頂点に修正
    }
    if (count > maxVerticesPerInstance) maxVerticesPerInstance = count;
  });

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
    renderPass.draw(maxVerticesPerInstance, commandStructs.length, 0, 0);

    renderPass.end();
    device.queue.submit([commandEncoder.finish()]);

    fpsCounter.update();
  }

  render();

  // リサイズ時の更新対応
  window.addEventListener("resize", () => {
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
    device.queue.writeBuffer(
      uniformBuffer,
      0,
      new Float32Array([canvas.width, canvas.height]),
    );
    render();
  });

  // ------------------------------------------
  // 7. マウス・ホイールイベントの追加
  // ------------------------------------------
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();

      // マウス位置のNDC座標を計算（マウスのある場所を中心にズームするため）
      const rect = canvas.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const mouseY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

      const zoomFactor = 1.1;
      const oldZoom = zoom;

      if (e.deltaY < 0) {
        zoom *= zoomFactor;
      } else {
        zoom /= zoomFactor;
      }
      zoom = Math.max(0.1, Math.min(zoom, 100.0)); // 制限

      // マウス位置を中心に拡大するためのオフセット調整
      cameraOffset[0] += mouseX / oldZoom - mouseX / zoom;
      cameraOffset[1] += mouseY / oldZoom - mouseY / zoom;

      updateUniforms();
      render(); // 再描画
    },
    { passive: false },
  );

  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
      // 左クリック
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;

    // スクリーン移動量をNDC空間の移動量に変換
    const ndcX =
      (deltaX / canvas.width) * 2 * (canvas.width / window.innerWidth);
    const ndcY =
      -(deltaY / canvas.height) * 2 * (canvas.height / window.innerHeight);

    // ズーム倍率に応じて移動量を調整
    cameraOffset[0] -= ndcX / zoom;
    cameraOffset[1] -= ndcY / zoom;

    previousMousePosition = { x: e.clientX, y: e.clientY };

    updateUniforms();
    render();
  });

  window.addEventListener("mouseup", () => {
    isDragging = false;
  });

  // ------------------------------------------
  // 8. スマートフォン用タッチイベントの追加 (iPhone対応)
  // ------------------------------------------
  let initialTouchDistance = 0;
  let initialZoom = 1.0;

  // ヘルパー：2本の指の間の距離を計算する
  function getTouchDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  canvas.addEventListener(
    "touchstart",
    (e) => {
      // 画面のデフォルトのスクロールやバウンスを防止
      e.preventDefault();

      if (e.touches.length === 1) {
        // 1本指でのドラッグ（パン移動）の開始
        isDragging = true;
        previousMousePosition = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      } else if (e.touches.length === 2) {
        // 2本指でのピンチ（ズーム）の開始
        isDragging = false; // 移動はキャンセル
        initialTouchDistance = getTouchDistance(e.touches[0], e.touches[1]);
        initialZoom = zoom;
      }
    },
    { passive: false },
  );

  canvas.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();

      if (e.touches.length === 1 && isDragging) {
        // 1本指：平行移動（パン）
        const deltaX = e.touches[0].clientX - previousMousePosition.x;
        const deltaY = e.touches[0].clientY - previousMousePosition.y;

        const ndcX =
          (deltaX / canvas.width) * 2 * (canvas.width / window.innerWidth);
        const ndcY =
          -(deltaY / canvas.height) * 2 * (canvas.height / window.innerHeight);

        cameraOffset[0] -= ndcX / zoom;
        cameraOffset[1] -= ndcY / zoom;

        previousMousePosition = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };

        updateUniforms();
        render();
      } else if (e.touches.length === 2) {
        // 2本指：ピンチイン・アウト（中心位置固定の簡易ズーム）
        const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
        if (initialTouchDistance > 0) {
          const factor = currentDistance / initialTouchDistance;
          zoom = initialZoom * factor;
          zoom = Math.max(0.1, Math.min(zoom, 100.0)); // ズーム制限

          updateUniforms();
          render();
        }
      }
    },
    { passive: false },
  );

  canvas.addEventListener("touchend", (e) => {
    e.preventDefault();
    isDragging = false;
    initialTouchDistance = 0;
  });

  // ------------------------------------------
  // 9. ボタンクリック時の処理を追加（スクリプトの最末尾など）
  // ------------------------------------------
  document.getElementById("regenButton").addEventListener("click", () => {
    // 1. 新しいランダムデータをJS側で生成
    generateSceneData();
    // 2. GPUへデータを上書き転送
    uploadDataToGPU();
    // 3. 再描画
    render();
  });
}

init();

// ==========================================
// 【不要になったら丸ごと消せる】FPSカウンター（ここから）
// ==========================================
const fpsCounter = (() => {
  // 画面左上に表示するHTML要素をJSから動的に生成
  const div = document.createElement("div");
  div.style.position = "fixed";
  div.style.bottom = "10px";
  div.style.left = "10px";
  div.style.padding = "6px 10px";
  div.style.background = "rgba(0, 0, 0, 0.8)";
  div.style.color = "#00ffcc"; // WebGPUっぽいネオンカラー
  div.style.fontFamily = "monospace";
  div.style.fontSize = "14px";
  div.style.fontWeight = "bold";
  div.style.borderRadius = "4px";
  div.style.zIndex = "99999";
  div.style.pointerEvents = "none"; // マウス操作の邪魔をしない
  div.innerText = "FPS: --";
  document.body.appendChild(div);

  let lastTime = performance.now();
  let frameCount = 0;

  return {
    update() {
      frameCount++;
      const now = performance.now();
      const delta = now - lastTime;

      // 0.5秒（500ミリ秒）ごとに平均FPSを計算して更新（チラつき防止）
      if (delta >= 500) {
        const fps = (frameCount * 1000) / delta;
        div.innerText = `FPS: ${fps.toFixed(1)}`;
        frameCount = 0;
        lastTime = now;
      }
    },
  };
})();

// ==========================================
// 【不要になったら丸ごと消せる】FPSカウンター（ここまで）
// ==========================================
