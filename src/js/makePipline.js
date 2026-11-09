export default (
  device,
  commonBindGroupLayout,
  presentationFormat,
  shaderModule,
  vEntryPoint,
  arrayStride,
  attributes,
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
          arrayStride: arrayStride,
          stepMode: "vertex",
          attributes: attributes.map((a, i) => {
            return {
              shaderLocation: i,
              offset: a[0],
              format: a[1],
            };
          }),
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
