import { VectorTile } from "./pbf/vectortile";
import { Pbf } from "./pbf/pbf";
import style from "./style";

export default async (zxy) => {
  var d = await fetch("https://sasepo.com/t/" + zxy.join("/"));
  d = await new Pbf(await d.arrayBuffer());
  var layers = new VectorTile(d).layers;
  for (var k in layers) {
    var layer = layers[k];
    d = [];
    for (var i = 0; i < layer.length; i++) {
      var feature = layer.feature(i);
      var geom = feature.loadGeometry();
      var dim = getArrayDimension(geom);
      console.log("feature:", feature.Type, dim);
      d.push(geom);
    }
  }
  return d;
  //   console.log(layer.length);
  //   console.log(layer.feature(10).toGeoJSON(zxy));
  //
  //   console.log(layer.feature(10).loadGeometry());
};

/*
const rings = feature.loadGeometry(); // 3階層の配列が返る
let currentPolygonRings = [];

for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];

    // リングが時計回り（＝新しい外周）かどうかを判定
    if (isClockwise(ring)) {
        // すでに前のポリゴンのデータが溜まっているなら、一旦 addPolygon を呼んで描画へコミット
        if (currentPolygonRings.length > 0) {
            addPolygon(currentPolygonRings, fillColor, strokeColor, thickness);
        }
        // 新しいポリゴンの器を作る
        currentPolygonRings = [ring];
    } else {
        // 反時計回り（＝穴）なら、現在処理中のポリゴンに穴として追加
        currentPolygonRings.push(ring);
    }
}

// 最後のポリゴン分をコミット
if (currentPolygonRings.length > 0) {
    addPolygon(currentPolygonRings, fillColor, strokeColor, thickness);
}

*/

/**
 * リング（頂点の配列）が時計回り（外周）かどうかを判定する関数
 * @param {Array<{x: number, y: number}> | Array<[number, number]>} ring - 頂点データの配列
 * @returns {boolean} 時計回り(CW)なら true、反時計回り(CCW)なら false
 */
function isClockwise(ring) {
  if (ring.length < 3) return false;

  let sum = 0;
  const len = ring.length;

  for (let i = 0; i < len; i++) {
    const p1 = ring[i];
    const p2 = ring[(i + 1) % len]; // 最後の頂点と最初の頂点を繋ぐ

    // 配列の形式（[x, y] か {x, y} か）に合わせて座標を取得
    const x1 = Array.isArray(p1) ? p1[0] : p1.x;
    const y1 = Array.isArray(p1) ? p1[1] : p1.y;
    const x2 = Array.isArray(p2) ? p2[0] : p2.x;
    const y2 = Array.isArray(p2) ? p2[1] : p2.y;

    // 外積の項を累積加算
    sum += (x2 - x1) * (y2 + y1);
  }

  // Y軸下向きのMVT座標系では、この総和(sum)が「負（0未満）」のときに時計回り（外周）になります。
  // ※一般的な数学の座標系（Y軸上向き）とは正負が逆になるので注意してください。
  return sum < 0;
}

function getArrayDimension(arr) {
  if (!Array.isArray(arr)) {
    return 0;
  }
  // 配列の要素を1つ取り出し、再帰的に次元を調べる
  return 1 + Math.max(0, ...arr.map(getArrayDimension));
}
