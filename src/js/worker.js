var canvas, render, lineWidth, linePoints, polyPoints, lineColor, polyColor;
let offsetX = 0;
let offsetY = 0;

onmessage = async (e) => {
  if (e.data.canvas) {
    canvas = e.data.canvas;
    init(canvas);
  }
  e.data.deltaXY &&
    requestAnimationFrame(() => {
      [offsetX, offsetY] = e.data.deltaXY;
      render();
    });
  if (e.data.size) {
    [canvas.width, canvas.height] = e.data.size;
    // render実行しないとcanvasの大きさ変更が実canvasに反映されない
    render?.();
  }
  if (e.data.lineWidth) {
    ({ lineWidth, linePoints, polyPoints, lineColor, polyColor } = e.data);
    render?.();
  }
};

const init = async (canvas) => {
  const ctx = canvas.getContext("webgpu");
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({
    device,
    format: presentationFormat,
    alphaMode: "opaque",
  });

  // 3. WGSL シェーダーコード
  const shaderModule = device.createShaderModule({
    code: `
      struct DrawUniforms {
          color: vec4f,
          offset: vec2f,
      }
      @group(0) @binding(0) var<uniform> uniforms: DrawUniforms;
      struct VertexOutput {
        @builtin(position) position: vec4f,
      }

      @vertex
      fn vs_main(@location(0) pos: vec2f) -> VertexOutput {
          var output: VertexOutput;
          let finalPos = pos + uniforms.offset;
          output.position = vec4f((finalPos.x / 1000.0) * 2.0 - 1.0, 1.0 - (finalPos.y / 1000.0) * 2.0, 0.0, 1.0);
          return output;
      }

      @fragment
      fn fs_main() -> @location(0) vec4f { return uniforms.color; }
  `,
  });

  // 4. パイプライン設定
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: shaderModule,
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 8,
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "float32x2",
            },
          ],
        },
      ],
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fs_main",
      targets: [{ format: presentationFormat }],
    },
    primitive: { topology: "triangle-list" },
  });

  // 5. 太い線の頂点データ計算関数 (マイタージョイン)
  function generateLineStripVertices(points, lineWidth) {
    if (points.length < 2) return new Float32Array(0);
    const halfWidth = lineWidth / 2;
    const vertices = [];
    const count = points.length;
    const normals = [];

    for (let i = 0; i < count - 1; i++) {
      let dx = points[i + 1].x - points[i].x;
      let dy = points[i + 1].y - points[i].y;
      let len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) len = 1;
      normals.push({ x: -dy / len, y: dx / len });
    }

    for (let i = 0; i < count; i++) {
      let miterX, miterY;
      let lengthScale = 1.0;

      if (i === 0) {
        miterX = normals[0].x;
        miterY = normals[0].y;
      } else if (i === count - 1) {
        miterX = normals[count - 2].x;
        miterY = normals[count - 2].y;
      } else {
        const n1 = normals[i - 1];
        const n2 = normals[i];
        miterX = n1.x + n2.x;
        miterY = n1.y + n2.y;
        let miterLen = Math.sqrt(miterX * miterX + miterY * miterY);
        if (miterLen === 0) {
          miterX = n1.x;
          miterY = n1.y;
        } else {
          miterX /= miterLen;
          miterY /= miterLen;
          const dot = miterX * n1.x + miterY * n1.y;
          if (dot !== 0) lengthScale = 1.0 / dot;
        }
        if (lengthScale > 3.0) lengthScale = 3.0;
      }

      const extX = miterX * halfWidth * lengthScale;
      const extY = miterY * halfWidth * lengthScale;
      vertices.push(points[i].x + extX, points[i].y + extY);
      vertices.push(points[i].x - extX, points[i].y - extY);
    }
    return new Float32Array(vertices);
  }

  // ★ 修正：配列のインデックスを正しく指定して32バイトのデータを生成
  function createUniformData(hexColor, ox, oy) {
    const data = new Float32Array(8);
    // Color (RGBA)
    data[0] = parseInt(hexColor.slice(1, 3), 16) / 255;
    data[1] = parseInt(hexColor.slice(3, 5), 16) / 255;
    data[2] = parseInt(hexColor.slice(5, 7), 16) / 255;
    data[3] = 1.0;
    // Offset (X, Y)
    data[4] = ox;
    data[5] = oy;
    // data[6], data[7] は自動的に 0.0 (パディング)
    return data;
  }

  // 6. 描画処理メイン
  render = () => {
    const commandEncoder = device.createCommandEncoder();
    const textureView = ctx.getCurrentTexture().createView();
    const renderPassDescriptor = {
      colorAttachments: [
        {
          view: textureView,
          loadOp: "clear",
          storeOp: "store",
          clearValue: { r: 0.07, g: 0.07, b: 0.07, a: 1.0 },
        },
      ],
    };
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);

    // ① 通常の線（太い枠線）の描画処理
    if (linePoints.length >= 2) {
      const lineVertexData = generateLineStripVertices(linePoints, lineWidth);
      const lineIndices = [];

      // ★ 修正：トライアングルストリップから三角形リストへのインデックス展開ロジックを修正
      for (let i = 0; i < linePoints.length - 1; i++) {
        const topLeft = i * 2;
        const bottomLeft = i * 2 + 1;
        const topRight = (i + 1) * 2;
        const bottomRight = (i + 1) * 2 + 1;

        // 三角形1つ目
        lineIndices.push(topLeft, bottomLeft, topRight);
        // 三角形2つ目
        lineIndices.push(bottomLeft, bottomRight, topRight);
      }
      const lineIndexData = new Uint16Array(lineIndices);

      const lineUniformData = createUniformData(lineColor, offsetX, offsetY);
      const lineUniformBuffer = device.createBuffer({
        size: 32,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(lineUniformBuffer, 0, lineUniformData);

      const lineBindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: { buffer: lineUniformBuffer },
          },
        ],
      });

      const lineVertexBuffer = device.createBuffer({
        size: lineVertexData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
      });
      new Float32Array(lineVertexBuffer.getMappedRange()).set(lineVertexData);
      lineVertexBuffer.unmap();

      const lineIndexBuffer = device.createBuffer({
        size: Math.ceil(lineIndexData.byteLength / 4) * 4,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
      });
      new Uint16Array(lineIndexBuffer.getMappedRange()).set(lineIndexData);
      lineIndexBuffer.unmap();

      passEncoder.setVertexBuffer(0, lineVertexBuffer);
      passEncoder.setIndexBuffer(lineIndexBuffer, "uint16");
      passEncoder.setBindGroup(0, lineBindGroup);
      passEncoder.drawIndexed(lineIndexData.length);
    }

    // ② 閉じたポリゴン（塗りつぶし）の描画処理
    if (polyPoints.length >= 3) {
      const polyVertices = [];
      for (const p of polyPoints) {
        polyVertices.push(p.x, p.y);
      }
      const polyVertexData = new Float32Array(polyVertices);

      const polyIndices = [];
      for (let i = 1; i < polyPoints.length - 1; i++) {
        polyIndices.push(0, i, i + 1);
      }
      const polyIndexData = new Uint16Array(polyIndices);

      const polyUniformData = createUniformData(polyColor, offsetX, offsetY);
      const polyUniformBuffer = device.createBuffer({
        size: 32,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(polyUniformBuffer, 0, polyUniformData);

      const polyBindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: { buffer: polyUniformBuffer },
          },
        ],
      });

      const polyVertexBuffer = device.createBuffer({
        size: polyVertexData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
      });
      new Float32Array(polyVertexBuffer.getMappedRange()).set(polyVertexData);
      polyVertexBuffer.unmap();

      const polyIndexBuffer = device.createBuffer({
        size: Math.ceil(polyIndexData.byteLength / 4) * 4,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
      });
      new Uint16Array(polyIndexBuffer.getMappedRange()).set(polyIndexData);
      polyIndexBuffer.unmap();

      passEncoder.setVertexBuffer(0, polyVertexBuffer);
      passEncoder.setIndexBuffer(polyIndexBuffer, "uint16");
      passEncoder.setBindGroup(0, polyBindGroup);
      passEncoder.drawIndexed(polyIndexData.length);
    }

    passEncoder.end();
    device.queue.submit([commandEncoder.finish()]);
  };
};
