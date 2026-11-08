export default function onCreateTile(device, tileData, zxy) {
  const prepareIndexData = (data) => {
    if (data.length % 2 != 0) {
      const last = data[data.length - 1];
      data.push(last);
    }
  };
  const polygonVertexBuffer = device.createBuffer({
    size: tileData.polygonVertex.length * 2,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const polygonVertexData = new Int16Array(tileData.polygonVertex);
  device.queue.writeBuffer(polygonVertexBuffer, 0, polygonVertexData);

  prepareIndexData(tileData.polygonIndex);
  const polygonIndexBuffer = device.createBuffer({
    size: tileData.polygonIndex.length * 2,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  const polygonIndexData = new Uint16Array(tileData.polygonIndex);
  device.queue.writeBuffer(polygonIndexBuffer, 0, polygonIndexData);

  prepareIndexData(tileData.borderIndex);
  const borderIndexBuffer = device.createBuffer({
    size: tileData.borderIndex.length * 2,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  const borderIndexData = new Uint16Array(tileData.borderIndex);
  device.queue.writeBuffer(borderIndexBuffer, 0, borderIndexData);

  const lineVertexBuffer = device.createBuffer({
    size: tileData.lineVertex.length * 2,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const lineVertexData = new Uint16Array(tileData.lineVertex);
  device.queue.writeBuffer(lineVertexBuffer, 0, lineVertexData);

  prepareIndexData(tileData.lineIndex);
  const lineIndexBuffer = device.createBuffer({
    size: tileData.lineIndex.length * 2,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  const lineIndexData = new Uint16Array(tileData.lineIndex);
  device.queue.writeBuffer(lineIndexBuffer, 0, lineIndexData);

  const thinVertexBuffer = device.createBuffer({
    size: tileData.thinVertex.length * 2,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const thinVertexData = new Int16Array(tileData.thinVertex);
  device.queue.writeBuffer(thinVertexBuffer, 0, thinVertexData);

  prepareIndexData(tileData.thinIndex);
  const thinIndexBuffer = device.createBuffer({
    size: tileData.thinIndex.length * 2,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  const thinIndexData = new Uint16Array(tileData.thinIndex);
  device.queue.writeBuffer(thinIndexBuffer, 0, thinIndexData);

  return {
    zxy,
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
