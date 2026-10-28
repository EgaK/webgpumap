export default function onCreateTile(device, tileBindGroupLayout, tileData) {
  // そのタイル固有のpropertyBuffer（GPUバッファ）を作成・転送
  const STRIDE = 48; // propStructs は1要素48バイト
  const propertyBufferSize = tileData.propStructs.length * STRIDE;
  const propertyBuffer = device.createBuffer({
    size: propertyBufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const commandData = new Uint8Array(propertyBufferSize);
  tileData.propStructs.forEach((cmd, i) => {
    const offset = i * STRIDE;
    const buf1 = new Float32Array([
      ...cmd.fillColor,
      ...cmd.lineColor,
      cmd.thickness,
    ]);
    const buf2 = new Uint32Array([
      cmd.index_base,
      cmd.index_count,
      cmd.vertex_base,
    ]);
    commandData.set(new Uint8Array(buf1.buffer), offset);
    commandData.set(new Uint8Array(buf2.buffer), offset + 36);
  });
  device.queue.writeBuffer(propertyBuffer, 0, commandData);

  const vertexBuffer = device.createBuffer({
    size: tileData.allVertex.length * 8,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const vertexData = new Uint32Array(tileData.allVertex);
  device.queue.writeBuffer(vertexBuffer, 0, vertexData);

  const polygonIndexBuffer = device.createBuffer({
    size: tileData.polygonIndex.length * 4,
    usage:
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.INDEX,
  });
  const polygonIndexData = new Uint32Array(tileData.polygonIndex);
  device.queue.writeBuffer(polygonIndexBuffer, 0, polygonIndexData);

  const borderIndexBuffer = device.createBuffer({
    size: tileData.borderIndex.length * 4,
    usage:
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.INDEX,
  });
  const borderIndexData = new Uint32Array(tileData.borderIndex);
  device.queue.writeBuffer(borderIndexBuffer, 0, borderIndexData);
  // そのタイル固有のBindGroup（グループ1の実体）を作成

  const bindGroup = device.createBindGroup({
    layout: tileBindGroupLayout, // グループ1の設計図を指定
    entries: [
      { binding: 0, resource: { buffer: propertyBuffer } }, // タイル個別のバッファを紐付け
      { binding: 1, resource: { buffer: vertexBuffer } }, // ⭐ 頂点バッファをここに紐付ける
    ],
  });

  return {
    bindGroup,
    propStructs: tileData.propStructs,
    propertyBuffer,
    polygonIndexBuffer,
    polygonIndexCount: tileData.polygonIndex.length,
    borderIndexBuffer,
    borderIndexCount: tileData.borderIndex.length,
  };
}
