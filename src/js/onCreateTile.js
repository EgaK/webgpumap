export default function onCreateTile(device, tileBindGroupLayout, tileData) {
  // そのタイル固有のcommandBuffer（GPUバッファ）を作成・転送
  const commandBuffer = device.createBuffer({
    size: tileData.command.length * 48, // commandStructs は1要素48バイト
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const vertexBuffer = device.createBuffer({
    size: tileData.vertex.length * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const indexBuffer = device.createBuffer({
    size: tileData.index.length * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  const STRIDE = 48;
  const commandBufferSize = tileData.command.length * STRIDE;
  const commandArrayBuffer = new ArrayBuffer(commandBufferSize);
  const commandView = new DataView(commandArrayBuffer);

  tileData.command.forEach((cmd, i) => {
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
  device.queue.writeBuffer(commandBuffer, 0, commandArrayBuffer);

  const vertexData = new Uint32Array(tileData.vertex);
  const indexData = new Uint32Array(tileData.index);

  device.queue.writeBuffer(vertexBuffer, 0, vertexData);
  device.queue.writeBuffer(indexBuffer, 0, indexData);

  // そのタイル固有のBindGroup（グループ1の実体）を作成
  const bindGroup = device.createBindGroup({
    layout: tileBindGroupLayout, // グループ1の設計図を指定
    entries: [
      { binding: 0, resource: { buffer: commandBuffer } }, // タイル個別のバッファを紐付け
      { binding: 1, resource: { buffer: vertexBuffer } }, // ⭐ 頂点バッファをここに紐付ける
      { binding: 2, resource: { buffer: indexBuffer } },
    ],
  });

  return {
    commandBuffer,
    vertexBuffer,
    indexBuffer,
    bindGroup,
    maxVerticesPerInstance: tileData.maxVerticesPerInstance,
    comLen: tileData.command.length,
  };
}
