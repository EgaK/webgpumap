export default function onCreateTile(device, tileData, zxy) {
  // console.log(
  //   "vertex:",
  //   Math.ceil(
  //     (2 *
  //       (tileData.polygonVertex.length +
  //         tileData.lineVertex.length +
  //         tileData.thinVertex.length)) /
  //       1024,
  //   ),
  //   "index:",
  //   Math.ceil(
  //     (2 *
  //       (tileData.polygonIndex.length +
  //         tileData.borderIndex.length +
  //         tileData.lineIndex.length +
  //         tileData.thinIndex.length)) /
  //       1024,
  //   ),
  // );

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

  let vOffset = 0;
  let vOffsetArray = [];
  let iOffset = 0;
  let iOffsetArray = [];
  let lenArray = [];
  for (let i = 0; i < tileData.length; i++) {
    const vtx = tileData[i][0];
    const idx = tileData[i][1];
    if (vtx) {
      device.queue.writeBuffer(vertexBuffer, vOffset, new Int16Array(vtx));
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
    device.queue.writeBuffer(indexBuffer, iOffset, new Uint16Array(idx));
    iOffsetArray.push(iOffset);
    iOffset += idx.length * 2;
    lenArray.push(len);
  }

  return {
    zxy,
    vertexBuffer,
    indexBuffer,
    vOffsetArray,
    iOffsetArray,
    lenArray,
  };
}
