const scale = (z) => {
  return Math.pow(2, z) * 512;
};

const zxy2center = (zxy) => {
  const scale = Math.pow(2, zxy[0]);
  return [(zxy[1] + 0.5) / scale, (zxy[2] + 0.5) / scale];
};
export { scale, zxy2center };
