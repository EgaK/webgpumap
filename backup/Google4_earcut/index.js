import { earcut } from "./util/earcut.dev";

// ==========================================
// 1. WGSL シェーダーコード
// ==========================================
const shaderCode = `
            struct DrawCommand {
                color: vec4f,
                thickness: f32,
                index_base: u32,
                index_count: u32,
                fig_type: u32,       // 0: Polygon, 1: Polyline
                vertex_base: u32,
                _pad1: u32,          // 16バイトアライメントのためのパディング
                _pad2: u32,
            }

            struct Uniforms {
                u_resolution: vec2f,
                u_zoom: f32,
                _pad: f32,
                u_offset: vec2f,
            }

            @group(0) @binding(0) var<uniform> uniforms: Uniforms;
            @group(0) @binding(1) var<storage, read> all_vertices: array<vec2f>;
            @group(0) @binding(2) var<storage, read> all_indices: array<u32>;
            @group(0) @binding(3) var<storage, read> commands: array<DrawCommand>;

            struct VertexOutput {
                @builtin(position) position: vec4f,
                @location(0) color: vec4f,
            }

            @vertex
            fn vs_main(
                @builtin(vertex_index) v_idx: u32,
                @builtin(instance_index) inst_idx: u32
            ) -> VertexOutput {
                var output: VertexOutput;
                let cmd = commands[inst_idx];
                output.color = cmd.color;

                // ------------------------------------------
                // パターン0: ポリゴン
                // ------------------------------------------
                if (cmd.fig_type == 0u) {
                    if (v_idx >= cmd.index_count) {
                        output.position = vec4f(0.0, 0.0, 0.0, 0.0);
                        return output;
                    }
                    let global_idx = cmd.index_base + v_idx;
                    let local_vert_idx = all_indices[global_idx];
                    let raw_pos = all_vertices[cmd.vertex_base + local_vert_idx];

                    // ★ ここでカメラ変換を適用！
                    let cam_pos = (raw_pos - uniforms.u_offset) * uniforms.u_zoom;
                    output.position = vec4f(cam_pos, 0.0, 1.0);
                    return output;
                }

                // ------------------------------------------
                    // パターン1: 太い折れ線（ズーム不変幅版）
                    // ------------------------------------------
                    if (cmd.fig_type == 1u) {
                        let segment_idx = v_idx / 6u;
                        let corner_idx = v_idx % 6u;

                        if (segment_idx >= cmd.index_count - 1u) {
                            output.position = vec4f(0.0, 0.0, 0.0, 0.0);
                            return output;
                        }

                        let p0 = all_vertices[cmd.vertex_base + segment_idx];
                        let p1 = all_vertices[cmd.vertex_base + segment_idx + 1u];

                        // 1. 先に「線の中心軸の頂点（p0, p1）」だけをカメラ（ズーム・オフセット）で移動させる！
                        let cam_p0 = (p0 - uniforms.u_offset) * uniforms.u_zoom;
                        let cam_p1 = (p1 - uniforms.u_offset) * uniforms.u_zoom;

                        // 2. カメラ移動「後」の座標を使って、画面上での方向と法線を計算する
                        let aspect = uniforms.u_resolution.x / uniforms.u_resolution.y;
                        let dir = normalize(vec2f(cam_p1.x * aspect, cam_p1.y) - vec2f(cam_p0.x * aspect, cam_p0.y));
                        let normal = vec2f(-dir.y, dir.x);

                        // 3. 太さの計算（u_zoom を掛けないため、画面上でのピクセル幅が常に一定になる）
                        let thickness_ndc = cmd.thickness / uniforms.u_resolution.y;
                        let offset = vec2f((normal.x * thickness_ndc * 0.5) / aspect, normal.y * thickness_ndc * 0.5);

                        // 4. カメラ移動後の中心位置に、太さのオフセットを加算する
                        var final_pos = vec2f(0.0);
                        if (corner_idx == 0u) { final_pos = cam_p0 + offset; }
                        else if (corner_idx == 1u || corner_idx == 4u) { final_pos = cam_p0 - offset; }
                        else if (corner_idx == 2u || corner_idx == 3u) { final_pos = cam_p1 + offset; }
                        else if (corner_idx == 5u) { final_pos = cam_p1 - offset; }

                        output.position = vec4f(final_pos, 0.0, 1.0);
                        return output;
                    }

                    // ------------------------------------------
                        // パターン2: 関節の Round Join（ズーム不変幅版）
                        // ------------------------------------------
                        if (cmd.fig_type == 2u) {
                            let total_circle_vertices = cmd.index_count * 3u;
                            if (v_idx >= total_circle_vertices) {
                                output.position = vec4f(0.0, 0.0, 0.0, 0.0);
                                return output;
                            }

                            let tri_idx = v_idx / 3u;
                            let sub_idx = v_idx % 3u;

                            let center_pos = all_vertices[cmd.vertex_base + cmd.index_base];

                            // 1. 先に「関節の中心点」をカメラで移動させる
                            let cam_center = (center_pos - uniforms.u_offset) * uniforms.u_zoom;
                            var final_pos = cam_center;

                            if (sub_idx > 0u) {
                                var vertex_on_ring = tri_idx;
                                if (sub_idx == 2u) {
                                    vertex_on_ring = (tri_idx + 1u) % cmd.index_count;
                                }

                                let angle = (f32(vertex_on_ring) / f32(cmd.index_count)) * 2.0 * 3.14159265;
                                let raw_offset = vec2f(cos(angle), sin(angle));

                                let aspect = uniforms.u_resolution.x / uniforms.u_resolution.y;
                                let radius_ndc = (cmd.thickness * 0.5) / uniforms.u_resolution.y; // u_zoom を掛けない

                                let offset = vec2f((raw_offset.x * radius_ndc) / aspect, raw_offset.y * radius_ndc);
                                final_pos = cam_center + offset;
                            }

                            output.position = vec4f(final_pos, 0.0, 1.0);
                            return output;
                        }


                return output;
            }

            @fragment
            fn fs_main(input: VertexOutput) -> @location(0) vec4f {
                return input.color;
            }
        `;

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
    function addPolygon(outerLoop, holeLoops = [], color) {
      const flatData = [];
      const holeIndices = [];
      for (const p of outerLoop) flatData.push(p[0], p[1]);
      for (const hole of holeLoops) {
        holeIndices.push(flatData.length / 2);
        for (const p of hole) flatData.push(p[0], p[1]);
      }
      console.log("indices");
      const indices = earcut(flatData, holeIndices, 2);
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
      const numPoints = 5 + Math.floor(Math.random() * 5);
      for (let j = 0; j < numPoints * 2; j++) {
        const angle = (j / (numPoints * 2)) * Math.PI * 2;
        const r = j % 2 === 0 ? size : size * 0.4;
        outerStar.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
      }
      const hSize = size * 0.15;
      const innerHole = [
        [cx - hSize, cy - hSize],
        [cx - hSize, cy + hSize],
        [cx + hSize, cy + hSize],
        [cx + hSize, cy - hSize],
      ];
      addPolygon(
        outerStar,
        [innerHole],
        [Math.random(), Math.random(), Math.random(), 0.6],
      );
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
