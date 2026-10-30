export default function onCreateTile(device, tileBindGroupLayout, tileData) {
  // そのタイル固有のpropertyBuffer（GPUバッファ）を作成・転送
  let STRIDE = 48; // propStructs は1要素48バイト
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
    size: tileData.polygonVertex.length * 8,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const polygonVertexData = new Uint32Array(tileData.polygonVertex);
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

  STRIDE = 16; // lineVertex は1要素16バイト
  const lineVertexBufferSize = tileData.lineVertex.length * STRIDE;
  const lineVertexBuffer = device.createBuffer({
    size: lineVertexBufferSize,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const lineVertexData = new Uint8Array(lineVertexBufferSize);
  tileData.lineVertex.forEach((vtx, i) => {
    const offset = i * STRIDE;
    const buf1 = new Uint32Array([vtx.packed, vtx.featureID]);
    // const buf2 = new Float32Array([...vtx.dir, vtx.is_right]);
    const buf2 = new Float32Array(vtx.normal);

    lineVertexData.set(new Uint8Array(buf1.buffer), offset);
    lineVertexData.set(new Uint8Array(buf2.buffer), offset + 8);
  });
  device.queue.writeBuffer(lineVertexBuffer, 0, lineVertexData);

  const lineIndexBuffer = device.createBuffer({
    size: tileData.lineIndex.length * 4,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  const lineIndexData = new Uint32Array(tileData.lineIndex);
  device.queue.writeBuffer(lineIndexBuffer, 0, lineIndexData);

  // そのタイル固有のBindGroup（グループ1の実体）を作成
  const bindGroup = device.createBindGroup({
    layout: tileBindGroupLayout, // グループ1の設計図を指定
    entries: [
      { binding: 0, resource: { buffer: propertyBuffer } }, // タイル個別のバッファを紐付け
    ],
  });

  return {
    bindGroup,
    propStructs: tileData.propStructs,
    propertyBuffer,
    polygonVertexBuffer,
    polygonIndexBuffer,
    polygonIndexCount: tileData.polygonIndex.length,
    borderIndexBuffer,
    borderIndexCount: tileData.borderIndex.length,
    lineVertexBuffer,
    lineIndexBuffer,
    lineIndexCount: tileData.lineIndex.length,
  };
}
