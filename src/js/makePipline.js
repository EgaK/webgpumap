export default (
  device,
  commonBindGroupLayout,
  tileBindGroupLayout,
  presentationFormat,
  shaderModule,
  vEntryPoint,
  arrayStride,
  attributes,
  topology,
  fEntryPoint = "fs_main",
) => {
  return device.createRenderPipeline({
    // layout: "auto" の代わりに、2つの設計図を配列で渡す
    layout: device.createPipelineLayout({
      bindGroupLayouts: [commonBindGroupLayout, tileBindGroupLayout],
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
          // 以下の blend 設定を追加・変更する
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
    primitive: { topology: topology },
    depthStencil: {
      format: "depth24plus",
      depthWriteEnabled: true, // ★通常通り深度を書き込む
      depthCompare: "greater",
    },
    multisample: {
      count: 4, // ★パイプライン側でも4倍を明示
    },
  });
};
