import shaderCode from "./shader.wgsl";
import generateSceneData from "./generateSene";
import onCreateTile from "./onCreateTile";
import loadTile from "./loadTile";
import style from "./style";

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
    alphaMode: "opaque",
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
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX,
        texture: { sampleType: "float", viewDimension: "2d" },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.VERTEX,
        sampler: { type: "filtering" },
      }, // ★サンプラーの枠
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
  const polygonPipeline = device.createRenderPipeline({
    // layout: "auto" の代わりに、2つの設計図を配列で渡す
    layout: device.createPipelineLayout({
      bindGroupLayouts: [commonBindGroupLayout, tileBindGroupLayout],
    }),
    vertex: {
      module: shaderModule,
      entryPoint: "vs_polygon",
      buffers: [
        {
          arrayStride: 8,
          stepMode: "vertex",
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "uint32",
            },
            {
              shaderLocation: 1,
              offset: 4,
              format: "uint32",
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
    depthStencil: {
      format: "depth24plus",
      depthWriteEnabled: true, // ★通常通り深度を書き込む
      depthCompare: "greater",
    },
    multisample: {
      count: 4, // ★パイプライン側でも4倍を明示
    },
  });
  const borderPipeline = device.createRenderPipeline({
    // layout: "auto" の代わりに、2つの設計図を配列で渡す
    layout: device.createPipelineLayout({
      bindGroupLayouts: [commonBindGroupLayout, tileBindGroupLayout],
    }),
    vertex: {
      module: shaderModule,
      entryPoint: "vs_thinline",
      buffers: [
        {
          arrayStride: 8,
          stepMode: "vertex",
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "uint32",
            },
            {
              shaderLocation: 1,
              offset: 4,
              format: "uint32",
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
    primitive: { topology: "line-list" },
    depthStencil: {
      format: "depth24plus",
      depthWriteEnabled: false, // ★深度バッファに書き込まない
      depthCompare: "greater-equal",
    },
    multisample: {
      count: 4, // ★パイプライン側でも4倍を明示
    },
  });
  const linePipeline = device.createRenderPipeline({
    // layout: "auto" の代わりに、2つの設計図を配列で渡す
    layout: device.createPipelineLayout({
      bindGroupLayouts: [commonBindGroupLayout, tileBindGroupLayout],
    }),
    vertex: {
      module: shaderModule,
      entryPoint: "vs_polyline",
      buffers: [
        {
          arrayStride: 16,
          stepMode: "vertex",
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "uint32",
            },
            {
              shaderLocation: 1,
              offset: 4,
              format: "uint32",
            },
            {
              shaderLocation: 2,
              offset: 8,
              format: "float32x2",
            },
            // {
            //   shaderLocation: 3,
            //   offset: 16,
            //   format: "float32",
            // },
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
    depthStencil: {
      format: "depth24plus",
      depthWriteEnabled: true, // ★通常通り深度を書き込む
      depthCompare: "greater",
    },
    multisample: {
      count: 4, // ★パイプライン側でも4倍を明示
    },
  });

  if (DEVELOP) {
    const compilationInfo = await shaderModule.getCompilationInfo();
    for (const message of compilationInfo.messages) {
      console.error(
        `WGSL Error: ${message.message} at line ${message.lineNum}`,
      );
    }
  }

  const interpolate = (zoom, table) => {
    if (zoom <= table[0][0]) return table[0][1];
    if (zoom >= table[table.length - 1][0]) return table[table.length - 1][1];
    for (let i = 0; i < table.length - 1; i++) {
      const p0 = table[i],
        p1 = table[i + 1];
      if (zoom >= p0[0] && zoom <= p1[0]) {
        const t = (zoom - p0[0]) / (p1[0] - p0[0]);
        return p0[1] + (p1[1] - p0[1]) * t; // 線形補間
      }
    }
    return table[0][1];
  };

  let styleTable = [];
  for (const s of style) {
    if (Array.isArray(s.thickness)) {
      styleTable.push({
        thickness: s.thickness,
      });
      s.thickness = -styleTable.length;
    }
  }

  const texWidth = 32;
  const texHeight = 4; // 本来はstyleTable.length
  const textureData = new Float16Array(texWidth * texHeight * 4);
  const minZoom = 0.0;
  const maxZoom = 20.0;

  for (let tableId = 0; tableId < texHeight; tableId++) {
    const thicknessTable = styleTable[tableId]?.thickness;
    if (!thicknessTable) break;
    // const opacityTable = getOpacityTableForId(tableId);

    for (let i = 0; i < texWidth; i++) {
      const t = i / (texWidth - 1); // 0.0 〜 1.0
      const targetZoom = minZoom + t * (maxZoom - minZoom);

      const pixelIdx = (tableId * texWidth + i) * 4;
      textureData[pixelIdx + 0] = interpolate(targetZoom, thicknessTable);
      textureData[pixelIdx + 1] = 0; // interpolate(targetZoom, opacityTable);
      textureData[pixelIdx + 2] = 0.0;
      textureData[pixelIdx + 3] = 1.0;
    }
  }

  // WebGPU 2Dテクスチャの作成
  const styleTexture2D = device.createTexture({
    size: [texWidth, texHeight, 1], // 高さを 16 に
    dimension: "2d", // 2d に変更
    format: "rgba16float",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });

  // データの転送
  device.queue.writeTexture(
    { texture: styleTexture2D },
    textureData,
    { bytesPerRow: texWidth * 8 }, // ★ 幅16 * 8バイト = 128バイト
    [texWidth, texHeight, 1],
  );

  // 2. バイリニア（線形）補間を行うサンプラーの作成（★ここが最重要！）
  const linearSampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    addressModeU: "clamp-to-edge", // 範囲外(0未満や1超)のズームは端点の色を固定
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
      { binding: 1, resource: styleTexture2D.createView() },
      { binding: 2, resource: linearSampler }, // ★ここで使用します！
    ],
  });

  // 初回のデータ生成を実行
  // const tileData = await generateSceneData();
  var tileData = await loadTile([15, 28191, 13180]);
  console.log("tileData", tileData);
  const visibleTiles = [onCreateTile(device, tileBindGroupLayout, tileData)];
  console.log("tiles", visibleTiles);
  // ユニフォームバッファを更新する関数を作成
  function updateUniforms() {
    // 1. offsetとzoom, flagw（16バイト分）を、GPUバッファの先頭（オフセット0）に直接転送
    device.queue.writeBuffer(
      uniformBuffer,
      0,
      viewArray.buffer, // ArrayBufferを直接指定
      viewArray.byteOffset, // 開始位置
      16, // 16バイト分 (f32 x 4要素分)
    );
  }
  function updateUniforms2() {
    device.queue.writeBuffer(
      uniformBuffer,
      16, // 後半の16バイトの位置から書き込み
      new Float32Array([canvas.width, canvas.height]),
    );
  }

  updateUniforms();
  updateUniforms2();

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
    updateUniforms();
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
      renderPass.setPipeline(borderPipeline);
      renderPass.setIndexBuffer(tile.borderIndexBuffer, "uint32");
      renderPass.drawIndexed(tile.borderIndexCount, 1, 0, 0, 0);
      // ポリライン;
      renderPass.setVertexBuffer(0, tile.lineVertexBuffer);
      renderPass.setPipeline(linePipeline);
      renderPass.setIndexBuffer(tile.lineIndexBuffer, "uint32");
      renderPass.drawIndexed(tile.lineIndexCount, 1, 0, 0, 0);
    }

    renderPass.end();
    device.queue.submit([commandEncoder.finish()]);
    viewArray[3] = 0;
  }
  render();
}
