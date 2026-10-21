import earcut from "./util/earcut";
import shaderCode from "./shader.wgsl";

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

  function generateSceneData() {
    // 配列をきれいにリセット
    allVertices = [];
    allIndices = [];
    commandStructs = [];
    maxVerticesPerInstance = 0;

    let vertexBase = 0;
    let indexBase = 0;

    // ヘルパー：ポリゴン追加
    function addPolygon(outerLoop, color) {
      const flatData = [];
      for (const p of outerLoop) {
        flatData.push(p[0], p[1]);
      }

      // 今回の軽量・外周特化版 earcut を呼び出す（引数はフラット配列1つだけ）
      const indices = earcut(flatData);

      if (indices.length === 0) return; // 不正すぎて分割できなかった場合は安全にスキップ

      const vertexCount = flatData.length / 2;
      allVertices.push(...flatData);
      allIndices.push(...indices);

      commandStructs.push({
        color: color,
        thickness: 0.0,
        index_base: indexBase,
        index_count: indices.length,
        fig_type: 0,
        vertex_base: vertexBase,
      });

      vertexBase += vertexCount;
      indexBase += indices.length;
    }

    // ヘルパー：折れ線追加
    function addPolyline(points, color, thickness) {
      for (const p of points) allVertices.push(p[0], p[1]);
      commandStructs.push({
        color: color,
        thickness: thickness,
        index_base: 0,
        index_count: points.length,
        fig_type: 1,
        vertex_base: vertexBase,
      });
      vertexBase += points.length;

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
    }

    // --- データのランダム自動生成 (5000個ずつの例) ---
    const NUM_POLYGONS = 5000;
    const NUM_LINES = 5000;

    for (let i = 0; i < NUM_POLYGONS; i++) {
      const cx = (Math.random() * 2 - 1) * 0.9;
      const cy = (Math.random() * 2 - 1) * 0.9;
      const size = 0.02 + Math.random() * 0.04;
      const outerStar = [];

      // 星のトゲの数（5〜9個）をランダムに決定
      const numPoints = 5 + Math.floor(Math.random() * 5);

      for (let j = 0; j < numPoints * 2; j++) {
        const angle = (j / (numPoints * 2)) * Math.PI * 2;
        const r = j % 2 === 0 ? size : size * 0.4;
        outerStar.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
      }

      // 穴（innerHole）の生成と引数の指定をカットし、シンプルに外周と色だけを渡す
      addPolygon(outerStar, [Math.random(), Math.random(), Math.random(), 0.6]);
    }

    for (let i = 0; i < NUM_LINES; i++) {
      const points = [];
      const numSegments = 2 + Math.floor(Math.random() * 4);
      let sx = (Math.random() * 2 - 1) * 0.9;
      let sy = (Math.random() * 2 - 1) * 0.9;
      points.push([sx, sy]);
      for (let j = 0; j < numSegments; j++) {
        sx += (Math.random() * 2 - 1) * 0.1;
        sy += (Math.random() * 2 - 1) * 0.1;
        points.push([sx, sy]);
      }
      addPolyline(
        points,
        [Math.random(), Math.random(), Math.random(), 0.8],
        2.0 + Math.random() * 15.0,
      );
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
  const MAX_VERTEX_BYTES = 1024 * 1024 * 32; // 32MB
  const MAX_INDEX_BYTES = 1024 * 1024 * 16; // 16MB
  const MAX_COMMAND_BYTES = 100000 * 48; // 10万コマンド分

  const uniformBuffer = device.createBuffer({
    size: 24,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // ★ 各バッファに COPY_DST（データの書き込み許可）を追加
  const vertexBuffer = device.createBuffer({
    size: MAX_VERTEX_BYTES,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const indexBuffer = device.createBuffer({
    size: MAX_INDEX_BYTES,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const commandBuffer = device.createBuffer({
    size: MAX_COMMAND_BYTES,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  // 生成された配列データをGPUバッファに転送する関数
  function uploadDataToGPU() {
    const vertexData = new Float32Array(allVertices);
    const indexData = new Uint32Array(allIndices);

    const commandBufferSize = commandStructs.length * 48;
    const commandArrayBuffer = new ArrayBuffer(commandBufferSize);
    const commandView = new DataView(commandArrayBuffer);

    commandStructs.forEach((cmd, i) => {
      const offset = i * 48;
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
      0.0, // u_zoom, _pad
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
