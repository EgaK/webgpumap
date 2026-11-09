export default function onCreateTile(device, tileData, zxy) {
  const PAGE_SIZE = (1024 + 512) * 1024;

  const buffer = device.createBuffer({
    size: PAGE_SIZE,
    usage:
      GPUBufferUsage.VERTEX | GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  // const indexBuffer = device.createBuffer({
  //   size: PAGE_INDEX_SIZE,
  //   usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  // });

  let vOffset = 0;
  let vOffsetArray = [];

  for (let i = 0; i < 4; i++) {
    const vtx = tileData[0][i];
    if (vtx.length) {
      vOffsetArray.push(vOffset);
      vOffset += vtx.length * 2;
    } else {
      vOffsetArray.push(0);
    }
  }

  let iOffset = vOffset;
  let iOffsetArray = [];
  let lenArray = [];
  for (let i = 0; i < 4; i++) {
    const idx = tileData[1][i];
    let len = idx.length;
    if (len % 2 != 0) {
      const last = idx[len - 1];
      idx.push(last);
      len++;
    }
    iOffsetArray.push(iOffset);
    iOffset += idx.length * 2;
    lenArray.push(len);
  }

  device.queue.writeBuffer(
    buffer,
    0,
    new Int16Array([].concat(...tileData[0])),
  );
  device.queue.writeBuffer(
    buffer,
    vOffset,
    new Uint16Array([].concat(...tileData[1])),
  );

  console.log(
    Math.ceil([].concat(...tileData[0], ...tileData[1]).length / 512) + "KB",
  );

  return {
    zxy,
    buffer,
    vOffsetArray,
    iOffsetArray,
    lenArray,
  };
}
