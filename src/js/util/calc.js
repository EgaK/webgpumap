import { baseTile } from "./constants";
const { baseTileZ, baseTileX, baseTileY, tileSizePixels } = baseTile;

const scale = (z) => {
  return (tileSizePixels / 2) * Math.pow(2, z - baseTileZ);
};

const zxy2center = (zxy) => {
  // const scale = Math.pow(2, zxy[0]);
  const zoomDiff = zxy[0] - baseTileZ;
  const shiftedBaseX = baseTileX * Math.pow(2, zoomDiff);
  const shiftedBaseY = baseTileY * Math.pow(2, zoomDiff);

  // 基準タイルから「描画対象のタイル」までの、そのズーム(tileZ)における枚数差（整数）
  const localTileX = zxy[1] + 0.5 - shiftedBaseX;
  const localTileY = zxy[2] + 0.5 - shiftedBaseY;

  // それを基準ズーム（z=10）のタイル枚数単位の距離にリスケールする（桁落ちしない）
  const tileScaleFromBase = 1.0 / Math.pow(2, zoomDiff);
  const tileLocalWorldX = localTileX * tileScaleFromBase;
  const tileLocalWorldY = localTileY * tileScaleFromBase;
  return [tileLocalWorldX, tileLocalWorldY];
};
export { scale, zxy2center };
