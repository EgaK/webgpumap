export default (
  device,
  commonBindGroupLayout,
  presentationFormat,
  shaderModule,
  vEntryPoint,
  topology,
  fEntryPoint = "fs_main",
  isMask,
  stencil = {
    compare: "equal", // ステンシル値が一致する場合のみ描画
    passOp: "keep", // ステンシル値は変更しない
    failOp: "keep",
    depthFailOp: "keep",
  },
) => {
  const obj = {
    layout: device.createPipelineLayout({
      bindGroupLayouts: [commonBindGroupLayout],
    }),
    vertex: {
      module: shaderModule,
      entryPoint: vEntryPoint,
      buffers: [
        {
          arrayStride: 12,
          stepMode: "vertex",
          attributes: [
            { shaderLocation: 0, offset: 0, format: "sint16x2" }, // 座標 -> シェーダーの @location(0)
            { shaderLocation: 1, offset: 4, format: "sint16" }, // 属性ID -> @location(1)
            // offset: 6 のパディング2バイトは自動的にスキップされる
            { shaderLocation: 2, offset: 8, format: "sint16x2" }, // 法線 -> @location(2)
          ],
        },
      ],
    },
    fragment: {
      module: shaderModule,
      entryPoint: fEntryPoint,
      targets: [
        {
          format: presentationFormat,
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
    primitive: { topology: topology, cullMode: "none" },
    depthStencil: {
      format: "depth24plus-stencil8",
      depthWriteEnabled: !isMask, // ★通常通り深度を書き込む
      depthCompare: isMask ? "always" : "greater",
      stencilFront: stencil,
      stencilBack: stencil,
    },
    multisample: {
      count: 4, // ★パイプライン側でも4倍を明示
    },
  };
  if (isMask) {
    delete obj.vertex.buffers;
  }
  return device.createRenderPipeline(obj);
};
