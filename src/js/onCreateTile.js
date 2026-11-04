export default function onCreateTile(
  device,
  tileBindGroupLayout,
  tileData,
  zxy,
) {
  // そのタイル固有のpropertyBuffer（GPUバッファ）を作成・転送
  let STRIDE = 32; // propStructs は1要素48バイト
  const propertyBufferSize = tileData.propStructs.length * STRIDE;
  const propertyBuffer = device.createBuffer({
    size: propertyBufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const propertyData = new Uint8Array(propertyBufferSize);
  tileData.propStructs.forEach((cmd, i) => {
    const offset = i * STRIDE;
    const buf1 = new Float32Array([
      ...cmd.fillColor,
      cmd.opacity,
      ...cmd.lineColor,
      cmd.thickness,
    ]);
    // const buf2 = new Uint32Array([
    //   cmd.index_base,
    //   cmd.index_count,
    //   cmd.vertex_base,
    // ]);
    propertyData.set(new Uint8Array(buf1.buffer), offset);
    // propertyData.set(new Uint8Array(buf2.buffer), offset + 36);
  });
  device.queue.writeBuffer(propertyBuffer, 0, propertyData);

  const polygonVertexBuffer = device.createBuffer({
    size: tileData.polygonVertex.length * 16,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const polygonVertexData = new Int32Array(tileData.polygonVertex);
  device.queue.writeBuffer(polygonVertexBuffer, 0, polygonVertexData);

  const polygonIndexBuffer = device.createBuffer({
    size: tileData.polygonIndex.length * 4,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  const polygonIndexData = new Uint32Array(tileData.polygonIndex);
  device.queue.writeBuffer(polygonIndexBuffer, 0, polygonIndexData);

  const borderIndexBuffer = device.createBuffer({
    size: tileData.borderIndex.length * 4,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  const borderIndexData = new Uint32Array(tileData.borderIndex);
  device.queue.writeBuffer(borderIndexBuffer, 0, borderIndexData);

  STRIDE = 32;
  const lineVertexBufferSize = tileData.lineVertex.length * STRIDE;
  const lineVertexBuffer = device.createBuffer({
    size: lineVertexBufferSize,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const lineVertexData = new Uint8Array(lineVertexBufferSize);
  tileData.lineVertex.forEach((vtx, i) => {
    const offset = i * STRIDE;
    const buf1 = new Int32Array([...vtx.pos, vtx.featureID]);
    const buf2 = new Float32Array(vtx.normal);

    lineVertexData.set(new Uint8Array(buf1.buffer), offset);
    lineVertexData.set(new Uint8Array(buf2.buffer), offset + 16);
  });
  device.queue.writeBuffer(lineVertexBuffer, 0, lineVertexData);

  const lineIndexBuffer = device.createBuffer({
    size: tileData.lineIndex.length * 4,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  const lineIndexData = new Uint32Array(tileData.lineIndex);
  device.queue.writeBuffer(lineIndexBuffer, 0, lineIndexData);

  const thinVertexBuffer = device.createBuffer({
    size: tileData.thinVertex.length * 16,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const thinVertexData = new Int32Array(tileData.thinVertex);
  device.queue.writeBuffer(thinVertexBuffer, 0, thinVertexData);

  const thinIndexBuffer = device.createBuffer({
    size: tileData.thinIndex.length * 4,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  const thinIndexData = new Uint32Array(tileData.thinIndex);
  device.queue.writeBuffer(thinIndexBuffer, 0, thinIndexData);

  const transformBuffer = device.createBuffer({
    size: 24, // mat3x2 のサイズ
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // そのタイル固有のBindGroup（グループ1の実体）を作成
  const bindGroup = device.createBindGroup({
    layout: tileBindGroupLayout, // グループ1の設計図を指定
    entries: [
      { binding: 0, resource: { buffer: transformBuffer } }, // 実体バッファ
      { binding: 1, resource: { buffer: propertyBuffer } }, // タイル個別のバッファを紐付け
    ],
  });

  return {
    zxy,
    bindGroup,
    transformBuffer,
    polygonVertexBuffer,
    polygonIndexBuffer,
    polygonIndexCount: tileData.polygonIndex.length,
    borderIndexBuffer,
    borderIndexCount: tileData.borderIndex.length,
    lineVertexBuffer,
    lineIndexBuffer,
    lineIndexCount: tileData.lineIndex.length,
    thinVertexBuffer,
    thinIndexBuffer,
    thinIndexCount: tileData.thinIndex.length,
  };
}
