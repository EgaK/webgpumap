import { baseTile } from "./constants";
const { baseTileZ, baseTileX, baseTileY, tileSizePixels } = baseTile;

/**
 * 2Dタイル用の3x2マトリックスを計算する関数
 * @returns {Float32Array} 3x2行列（列優先/Column-major, 要素数6）
 */
export default (
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
