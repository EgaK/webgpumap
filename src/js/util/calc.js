import { baseTile } from "./constants";
import context from "./context";
const { baseTileZ, baseTileX, baseTileY, tileSizePixels } = baseTile;

const scale = (z) => {
  return (tileSizePixels / 2) * Math.pow(2, z - baseTileZ);
};

// workerで計算することを目的にしているので、x，y，w，hはメインの2倍の値
const pixToLocalCoord = (x, y, cx, cy, z, w, h) => {
  const s = scale(z) * 2;
  x = w / 2 - x;
  y = h / 2 - y;
  return [cx - x / s, cy - y / s];
};

const coodToTile = (x, y, z) => {
  z = z >= 16 ? 15 : z >= 13 ? 13 : 10;
  const s = Math.pow(2, z - baseTileZ);
  const tileX = ~~((baseTileX + x) * s);
  const tileY = ~~((baseTileY + y) * s);
  return [z, tileX, tileY];
};

const getBounds = (cx, cy, z, w, h) => {
  return [
    pixToLocalCoord(0, 0, cx, cy, z, w, h),
    pixToLocalCoord(w, h, cx, cy, z, w, h),
  ];
};

var requiredTiles = (cx, cy, z, w, h) => {
  var b = getBounds(cx, cy, z, w, h);
  var nw = coodToTile(...b[0], z);
  var se = coodToTile(...b[1], z);
  var t = [];
  for (var i = nw[1]; i <= se[1]; i++) {
    for (var j = nw[2]; j <= se[2]; j++) {
      t.push([nw[0], i, j]);
    }
  }
  return t;
};

// const zxy2center = (zxy) => {
//   // const scale = Math.pow(2, zxy[0]);
//   const zoomDiff = zxy[0] - baseTileZ;
//   const shiftedBaseX = baseTileX * Math.pow(2, zoomDiff);
//   const shiftedBaseY = baseTileY * Math.pow(2, zoomDiff);
//
//   // 基準タイルから「描画対象のタイル」までの、そのズーム(tileZ)における枚数差（整数）
//   const localTileX = zxy[1] + 0.5 - shiftedBaseX;
//   const localTileY = zxy[2] + 0.5 - shiftedBaseY;
//
//   // それを基準ズーム（z=10）のタイル枚数単位の距離にリスケールする（桁落ちしない）
//   const tileScaleFromBase = 1.0 / Math.pow(2, zoomDiff);
//   const tileLocalWorldX = localTileX * tileScaleFromBase;
//   const tileLocalWorldY = localTileY * tileScaleFromBase;
//   return [tileLocalWorldX, tileLocalWorldY];
// };

const transformMatrix = (
  tileZ,
  tileX,
  tileY,
  tileExtent,
  centerX,
  centerY,
  currentZoom, // メインスレッドから送られてきたローカル用の値
  width,
  height,
) => {
  // 現在のズームでの、基準タイル(z=10)の1枚あたりの画面ピクセルサイズ
  const tilePixelSize = tileSizePixels * Math.pow(2, currentZoom - baseTileZ);

  // クリップ空間（-1 〜 1）に変換するための倍率
  const scaleX = (tilePixelSize / width) * 2.0;
  const scaleY = (tilePixelSize / height) * 2.0;

  // 【超重要】描画しようとしているタイルの「基準タイルから見た相対位置」を計算
  // 描画ターゲットのタイルズーム(tileZ)に合わせて基準タイルの座標をシフトする
  const zoomDiff = tileZ - baseTileZ;
  const shiftedBaseX = baseTileX * Math.pow(2, zoomDiff);
  const shiftedBaseY = baseTileY * Math.pow(2, zoomDiff);

  // 基準タイルから「描画対象のタイル」までの、そのズーム(tileZ)における枚数差（整数）
  const localTileX = tileX - shiftedBaseX;
  const localTileY = tileY - shiftedBaseY;

  // それを基準ズーム（z=10）のタイル枚数単位の距離にリスケールする（桁落ちしない）
  const tileScaleFromBase = 1.0 / Math.pow(2, zoomDiff);
  const tileLocalWorldX = localTileX * tileScaleFromBase;
  const tileLocalWorldY = localTileY * tileScaleFromBase;

  // 1列目 & 2列目: タイル内の頂点(0~4096)を縮小して画面サイズに合わせる
  const m00 = (tileScaleFromBase / tileExtent) * scaleX;
  const m01 = 0.0;
  const m10 = 0.0;
  const m11 = -(tileScaleFromBase / tileExtent) * scaleY;

  // 3列目: 平行移動量（中心座標からの差分）
  // どちらも「基準タイルから数えて何枚目か（0.0〜3.0程度）」の小さな数同士の引き算なので、f32でも精度が100%保たれる！
  const m20 = (tileLocalWorldX - centerX) * scaleX;
  const m21 = -(tileLocalWorldY - centerY) * scaleY;

  return new Float32Array([m00, m01, m10, m11, m20, m21]);
};

/**
 * 絶対座標(z, x, y)を、ローカルな1つの32bit整数IDにパックする
 */
const packTileId = (z, x, y) => {
  // 1. z=10の基準座標を、現在のズームレベル(z)のスケールに変換する
  const zoomDiff = z - baseTileZ;
  const baseUrlX = baseTileX << zoomDiff;
  const baseUrlY = baseTileY << zoomDiff;

  // 2. 基準からの差分（相対座標）を計算する
  const localX = x - baseUrlX;
  const localY = y - baseUrlY;

  // 3. ビット演算で1つの数値に結合する
  // Z(4bit: 0~15) | Xの差分(13bit: 0~8191) | Yの差分(13bit: 0~8191)
  // これで基準から周囲8000枚以上の広大なローカルエリアをカバー可能
  return ((z - 10) << 26) | (localX << 13) | localY;
};

/**
 * パックされたIDから、元の絶対座標(z, x, y)を復元（アンパック）する
 */
const unpackTileId = (id) => {
  // 1. ビットシフトとマスク演算で相対値を取り出す
  const zDiff = (id >> 26) & 0x0f;
  const localX = (id >> 13) & 0x1fff; // 0x1FFF = 13ビットのマスク
  const localY = id & 0x1fff;

  // 2. ズームレベルを復元
  const z = 10 + zDiff;

  // 3. 基準座標を現在のズームのスケールに戻し、差分を足して絶対座標を復元
  const baseUrlX = baseTileX << zDiff;
  const baseUrlY = baseTileY << zDiff;

  const x = baseUrlX + localX;
  const y = baseUrlY + localY;

  return { z, x, y };
};

export {
  scale,
  pixToLocalCoord,
  requiredTiles,
  // zxy2center,
  transformMatrix,
  packTileId,
  unpackTileId,
};
