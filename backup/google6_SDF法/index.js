// ==========================================
// 外部から与えられる初期の頂点データ
// ==========================================
let externalVertices = [
  -0.6, -0.6, -0.6, 0.6, 0.6, 0.6, 0.6, 0.3, -0.2, 0.3, -0.2, -0.3, 0.6, -0.3,
  0.6, -0.6,
];

// 状態管理変数
let offsetX = 0.0;
let offsetY = 0.0;
let scale = 1.0;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

// グローバル参照用（後から更新できるようにするため）
let device, vertexStorageBuffer, uniformBuffer;
const maxVertices = 128; // 許容する最大頂点数（バッファの最大容量を確保）

async function initWebGPU() {
  if (!navigator.gpu) return alert("WebGPU未対応のブラウザです。");
  const adapter = await navigator.gpu.requestAdapter();
  device = await adapter.requestDevice();

  const canvas = document.getElementById("gpuCanvas");
  const context = canvas.getContext("webgpu");
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;

  const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format: canvasFormat, alphaMode: "opaque" });

  // --- WGSLシェーダー ---
  const shaderModule = device.createShaderModule({
    code: `
                    struct Uniforms {
                        offset: vec2<f32>,
                        scale: f32,
                        aspect: f32,
                        numVertices: u32,
                    }
                    @binding(0) @group(0) var<uniform> uniforms : Uniforms;
                    @binding(1) @group(0) var<storage, read> polygonVertices : array<vec2<f32>>;

                    struct VertexOutput {
                        @builtin(position) position : vec4<f32>,
                        @location(0) localPos : vec2<f32>,
                    }

                    @vertex
                    fn vs_main(@location(0) pos: vec2<f32>) -> VertexOutput {
                        var output: VertexOutput;
                        output.position = vec4<f32>(pos, 0.0, 1.0);
                        output.localPos = vec2<f32>(pos.x * uniforms.aspect, pos.y);
                        return output;
                    }

                    fn sdPolygon(p: vec2<f32>) -> f32 {
                        let num_v = uniforms.numVertices;
                        var d = dot(p - polygonVertices[0], p - polygonVertices[0]);
                        var s = 1.0;
                        var j = num_v - 1u;
                        for (var i = 0u; i < num_v; i = i + 1u) {
                            let vi = polygonVertices[i];
                            let vj = polygonVertices[j];
                            let e = vj - vi;
                            let w = p - vi;
                            let b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
                            d = min(d, dot(b, b));
                            let c1 = vi.y <= p.y;
                            let c2 = p.y < vj.y;
                            let c3 = e.x * w.y > e.y * w.x;
                            if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) { s = -s; }
                            j = i;
                        }
                        return s * sqrt(d);
                    }

                    @fragment
                    fn fs_main(@location(0) localPos: vec2<f32>) -> @location(0) vec4<f32> {
                        let pTransformed = (localPos - uniforms.offset) / uniforms.scale;
                        let distance = sdPolygon(pTransformed);

                        let pixelSize = 1.0 / (uniforms.scale * (500.0 * uniforms.aspect));
                        let alpha = 1.0 - smoothstep(-pixelSize, pixelSize, distance);
                        if (alpha <= 0.0) { discard; }
                        return vec4<f32>(1.0, 0.4, 0.0, alpha);
                    }
                `,
  });

  // 画面全面を覆う板ポリゴン
  const quadVertices = new Float32Array([-1, 1, -1, -1, 1, 1, 1, -1]);
  const vertexBuffer = device.createBuffer({
    size: quadVertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, quadVertices);

  // 最大頂点数分あらかじめ大きめにストレージバッファを確保
  vertexStorageBuffer = device.createBuffer({
    size: maxVertices * 2 * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(
    vertexStorageBuffer,
    0,
    new Float32Array(externalVertices),
  );

  // 💡 修正: バッファサイズを「32バイト（16の倍数）」に増やしてアライメントエラーを解消
  uniformBuffer = device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: "read-only-storage" },
      },
    ],
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: vertexStorageBuffer } },
    ],
  });

  const renderPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    }),
    vertex: {
      module: shaderModule,
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 8,
          attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }],
        },
      ],
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fs_main",
      targets: [
        {
          format: canvasFormat,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
          },
        },
      ],
    },
    primitive: { topology: "triangle-strip" },
  });

  function getNDCCoordinates(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const aspect = canvas.width / canvas.height;
    return {
      x: (((clientX - rect.left) / rect.width) * 2 - 1) * aspect,
      y: -(((clientY - rect.top) / rect.height) * 2 - 1),
    };
  }

  canvas.addEventListener("mousedown", (e) => {
    isDragging = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const aspect = canvas.width / canvas.height;
    offsetX +=
      ((e.clientX - previousMousePosition.x) / window.innerWidth) * 2 * aspect;
    offsetY -= ((e.clientY - previousMousePosition.y) / window.innerHeight) * 2;
    previousMousePosition = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener("mouseup", () => (isDragging = false));
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const mouseNDC = getNDCCoordinates(e.clientX, e.clientY);
      const zoomFactor = 1.15;
      const newScale = e.deltaY < 0 ? scale * zoomFactor : scale / zoomFactor;
      offsetX = mouseNDC.x - (mouseNDC.x - offsetX) * (newScale / scale);
      offsetY = mouseNDC.y - (mouseNDC.y - offsetY) * (newScale / scale);
      scale = newScale;
    },
    { passive: false },
  );

  window.addEventListener("resize", () => {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
  });

  function render() {
    const aspect = canvas.width / canvas.height;
    const numVertices = externalVertices.length / 2;

    // 💡 修正: バッファサイズに合わせた32バイトのArrayBufferを用意
    const uniformData = new ArrayBuffer(32);
    const f32View = new Float32Array(uniformData, 0, 4);
    const u32View = new Uint32Array(uniformData, 16, 1);

    // 💡 修正: ビューへの代入演算子（=）漏れを修復
    f32View[0] = offsetX;
    f32View[1] = offsetY;
    f32View[2] = scale;
    f32View[3] = aspect;
    u32View[0] = numVertices; // 頂点数を格納（バイトオフセット16に配置）

    device.queue.writeBuffer(uniformBuffer, 0, uniformData);

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

    renderPass.setPipeline(renderPipeline);
    renderPass.setVertexBuffer(0, vertexBuffer);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(4);

    renderPass.end();
    device.queue.submit([commandEncoder.finish()]);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

// 外部からポリゴンを変更したいときに呼ぶグローバル関数
window.updatePolygonData = function (newVerticesArray) {
  if (!device || !vertexStorageBuffer) return;
  if (newVerticesArray.length / 2 > maxVertices) {
    console.error(`頂点数が多すぎます。最大 ${maxVertices} までです。`);
    return;
  }
  externalVertices = newVerticesArray;
  device.queue.writeBuffer(
    vertexStorageBuffer,
    0,
    new Float32Array(externalVertices),
  );
};
initWebGPU();
