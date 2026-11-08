export default function onCreateTile(device, tileData, zxy) {
  const prepareData = (data) => {
    if (data.length % 2 != 0) {
      const last = data[data.length - 1];
      data.push(last);
    }
  };

  console.log(
    "vertex:",
    Math.ceil(
      (2 *
        (tileData.polygonVertex.length +
          tileData.lineVertex.length +
          tileData.thinVertex.length)) /
        1024,
    ),
    "index:",
    Math.ceil(
      (2 *
        (tileData.polygonIndex.length +
          tileData.borderIndex.length +
          tileData.lineIndex.length +
          tileData.thinIndex.length)) /
        1024,
    ),
  );

  const PAGE_VERTEX_SIZE = 512 * 1024;
  const PAGE_INDEX_SIZE = 256 * 1024;

  const vertexBuffer = device.createBuffer({
    size: PAGE_VERTEX_SIZE,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const indexBuffer = device.createBuffer({
    size: PAGE_INDEX_SIZE,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(
    vertexBuffer,
    0,
    new Int16Array(tileData.polygonVertex),
  );

  prepareData(tileData.polygonIndex);
  device.queue.writeBuffer(
    indexBuffer,
    0,
    new Uint16Array(tileData.polygonIndex),
  );

  prepareData(tileData.borderIndex);
  const borderIndexOffset = tileData.polygonIndex.length * 2;
  device.queue.writeBuffer(
    indexBuffer,
    borderIndexOffset,
    new Uint16Array(tileData.borderIndex),
  );

  const lineVertexOffset = tileData.polygonVertex.length * 2;
  device.queue.writeBuffer(
    vertexBuffer,
    lineVertexOffset,
    new Int16Array(tileData.lineVertex),
  );

  prepareData(tileData.lineIndex);
  const lineIndexOffset = borderIndexOffset + tileData.borderIndex.length * 2;
  device.queue.writeBuffer(
    indexBuffer,
    lineIndexOffset,
    new Uint16Array(tileData.lineIndex),
  );

  const thinVertexOffset = lineVertexOffset + tileData.lineVertex.length * 2;
  device.queue.writeBuffer(
    vertexBuffer,
    thinVertexOffset,
    new Int16Array(tileData.thinVertex),
  );

  prepareData(tileData.thinIndex);
  const thinIndexOffset = lineIndexOffset + tileData.lineIndex.length * 2;
  device.queue.writeBuffer(
    indexBuffer,
    thinIndexOffset,
    new Uint16Array(tileData.thinIndex),
  );

  return {
    zxy,
    vertexBuffer,
    indexBuffer,
    lineVertexOffset,
    thinVertexOffset,
    borderIndexOffset,
    lineIndexOffset,
    thinIndexOffset,
    polygonIndexCount: tileData.polygonIndex.length,
    borderIndexCount: tileData.borderIndex.length,
    lineIndexCount: tileData.lineIndex.length,
    thinIndexCount: tileData.thinIndex.length,
  };
}
