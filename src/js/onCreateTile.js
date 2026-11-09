export default function onCreateTile(device, tileData, zxy) {
  const PAGE_VERTEX_SIZE = 256 * 1024;
  const PAGE_INDEX_SIZE = 256 * 1024;

  const vertexBuffer = device.createBuffer({
    size: PAGE_VERTEX_SIZE,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const indexBuffer = device.createBuffer({
    size: PAGE_INDEX_SIZE,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });

  let vOffset = 0;
  let vOffsetArray = [];
  let iOffset = 0;
  let iOffsetArray = [];
  let lenArray = [];

  for (let i = 0; i < 4; i++) {
    const vtx = tileData[0][i];
    const idx = tileData[1][i];
    if (vtx.length) {
      // device.queue.writeBuffer(vertexBuffer, vOffset, new Int16Array(vtx));
      vOffsetArray.push(vOffset);
      vOffset += vtx.length * 2;
    } else {
      vOffsetArray.push(0);
    }

    let len = idx.length;
    if (len % 2 != 0) {
      const last = idx[len - 1];
      idx.push(last);
      len++;
    }
    // device.queue.writeBuffer(indexBuffer, iOffset, new Uint16Array(idx));
    iOffsetArray.push(iOffset);
    iOffset += idx.length * 2;
    lenArray.push(len);
  }

  device.queue.writeBuffer(
    vertexBuffer,
    0,
    new Int16Array([].concat(...tileData[0])),
  );
  device.queue.writeBuffer(
    indexBuffer,
    0,
    new Uint16Array([].concat(...tileData[1])),
  );

  console.log(
    Math.ceil([].concat(...tileData[0]).length / 512) + "KB",
    Math.ceil([].concat(...tileData[1]).length / 512) + "KB",
  );

  return {
    zxy,
    vertexBuffer,
    indexBuffer,
    vOffsetArray,
    iOffsetArray,
    lenArray,
  };
}
