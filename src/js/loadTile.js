import { VectorTile } from "./pbf/vectortile";
import Pbf from "./pbf/pbf";
import earcut from "./util/earcut.dev";
import message from "./util/message";

import style from "./style";

export default async (zxy) => {
  let polygonVertex = [];
  let polygonVertexBase = 0;

  let polygonIndex = [];

  let borderIndex = [];
  let borderIndexBase = 0;

  let lineVertex = []; // 幅付きライン専用の頂点配列
  let lineIndex = []; // 幅付きライン専用のインデックス配列

  let thinVertex = [];
  let thinIndex = [];
  let thinIndexBase = 0;

  var d = await fetch("https://192.168.11.2/t/" + zxy.join("/"));
  d = await new Pbf(await d.arrayBuffer());
  var layers = new VectorTile(d).layers;
  for (var n = style.length; n--;) {
    var styleProp = style[n];
    // console.log("style:", styleProp.Type, styleProp);
    var layerName = styleProp.Layer;
    var layer = layers[layerName];
    if (!layer) continue;
    if (/p|s/.test(styleProp.Type)) {
      makeFeatures(layer, styleProp, zxy);
    } else {
      processMVTLayer(layer, styleProp);
    }
  }
  return {
    polygonVertex,
    polygonIndex,
    borderIndex,
    lineVertex,
    lineIndex,
    thinVertex,
    thinIndex,
  };

  function makeFeatures(layer, prop, zxy) {
    const f = [];
    for (var i = 0; i < layer.length; i++) {
      const feature = layer.feature(i);
      const geometry = feature.loadGeometry();
      const cat = geometry.properties["c"];
      let desc = geometry.properties["t"];
      if (cat == "bs" && desc) {
        desc = desc.replace("S", "西肥バス").replace("W", "昭和バス");
      }
      f.push({
        "p": geometry.lines[0][0],
        "t": feature.properties["n"],
        "d": desc,
        "c": cat,
      });
    }
    message("d", {
      "f": f,
      "p": {
        "type": prop.Type,
        "layer": prop.Layer,
        "color": prop.Color,
        "size": prop.Size,
        "opacity": prop.OPacity,
        "css": prop.Css,
      },
      "z": zxy,
    });
  }

  // リングが時計回り（外枠）かどうかを判定するヘルパー関数
  function isClockwise(ring) {
    let sum = 0;
    for (let i = 0; i < ring.length; i++) {
      const p1 = ring[i];
      const p2 = ring[(i + 1) % ring.length];
      sum += (p2[0] - p1[0]) * (p2[1] + p1[1]);
    }
    return sum < 0; // MVTの座標系（Y軸が下向き）では sum < 0 が時計回り（外枠）
  }

  // MVTレイヤーの全地物を処理するメインループ
  function processMVTLayer(layer, prop) {
    var styleId = prop.ID;
    var strokeThickness = prop.thickness || 0;
    if (prop.Type == "f") {
      for (var i = 0; i < layer.length; i++) {
        const feature = layer.feature(i);
        // console.log("feature.type", feature.type, feature);
        if (feature.type !== 3) continue; // Polygon 以外はスキップ

        const geometry = feature.loadGeometry().lines;
        // console.log(geometry);
        let currentPolygonRings = [];

        for (const ring of geometry) {
          if (ring.length === 0) continue;

          // 頂点の形式を mapboxのPointオブジェクト から [x, y] の配列形式に変換
          const formattedRing = ring.map((p) => [p.x, p.y]);
          // const formattedRing = ring;

          if (isClockwise(formattedRing)) {
            // 新しい外枠（時計回り）が来たら、それまでに溜まっていたポリゴンを処理
            if (currentPolygonRings.length > 0) {
              addPolygon(currentPolygonRings, styleId, strokeThickness);
            }
            // 新しいポリゴンとして初期化
            currentPolygonRings = [formattedRing];
          } else {
            // 穴（反時計回り）なら、現在のポリゴンの中にバッファリング
            currentPolygonRings.push(formattedRing);
          }
        }

        // 最後のポリゴンを処理
        if (currentPolygonRings.length > 0) {
          addPolygon(currentPolygonRings, styleId, strokeThickness);
        }
      }
    } else {
      for (var i = 0; i < layer.length; i++) {
        const feature = layer.feature(i);
        // console.log("feature.type", feature.type, feature);
        if (feature.type !== 2) continue; // Polygon 以外はスキップ

        const geometry = feature.loadGeometry().lines;
        for (const ring of geometry) {
          if (ring.length === 0) continue;

          // 頂点の形式を mapboxのPointオブジェクト から [x, y] の配列形式に変換
          const formattedRing = ring.map((p) => [p.x, p.y]);

          if (strokeThickness != 1) {
            addPolyline(formattedRing, styleId);
          } else {
            addThin(formattedRing, styleId);
          }
        }
      }
    }
  }

  function addThin(points, styleId) {
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      thinVertex.push(...p, styleId, 0, 0, 0); //末尾の1はアライメントのパディング
      if (i < points.length - 1) {
        thinIndex.push(thinIndexBase + i, thinIndexBase + i + 1);
      }
    }
    thinIndexBase += points.length;
  }

  function addPolygon(rings, styleId, strokeThickness) {
    // rings は [ outerLoop, innerHole1, innerHole2, ... ] という構造を想定

    const earcutRawData = []; // earcut用の一時的なフラット配列 [x1,y1, x2,y2, ...]
    const holeIndices = []; // 穴の開始位置（頂点単位のインデックス）を記録する配列

    let currentVertexCount = 0;

    for (let i = 0; i < rings.length; i++) {
      const ring = rings[i];
      if (!ring.length) continue;
      // 2つ目以降のリング（＝穴）である場合、現在の合計頂点数を穴の開始位置として記録
      if (i > 0) {
        holeIndices.push(currentVertexCount);
      }

      // リング内の頂点を処理
      for (let i = 0; i < ring.length; i++) {
        const p = ring[i];
        // earcut用
        earcutRawData.push(p[0], p[1]);

        polygonVertex.push(...p, styleId, 0, 0, 0); // 全部の頂点バッファの形式を揃えるために
        currentVertexCount++;

        // 枠線（折れ線）用の処理
        // 外周だけでなく、すべてのリング（穴の輪郭含む）に対して個別に枠線を描画する
        if (strokeThickness > 0) {
          borderIndex.push(
            borderIndexBase + i,
            borderIndexBase + (i + 1 == ring.length ? 0 : i + 1),
          );
        }
      }
      borderIndexBase += ring.length;
    }

    // 生のX,Y配列と、穴の位置配列を渡して三角形分割を行う
    const indices = earcut(earcutRawData, holeIndices);

    if (!indices.length) return;

    indices.forEach((idx) => {
      polygonIndex.push(polygonVertexBase + idx);
    });

    // グローバルなオフセットの更新
    polygonVertexBase += currentVertexCount;
  }

  function addPolyline(points, styleId) {
    const numPoints = points.length;
    if (numPoints < 2) return;

    for (let i = 0; i < numPoints - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      const base = lineVertex.length / 6;

      const dx = next[0] - current[0];
      // GPU側の座標に合わせて符号を反転しておく
      const dy = -next[1] + current[1];
      // const len = Math.hypot(dx, dy) || 1.0;

      lineVertex.push(...current, styleId, dy, -dx, 0);
      lineVertex.push(...current, styleId, -dy, dx, 0);
      lineVertex.push(...next, styleId, -dy, dx, 0);
      lineVertex.push(...next, styleId, dy, -dx, 0);

      lineIndex.push(base, base + 1, base + 2, base + 2, base + 3, base);

      if (i > 0) {
        lineIndex.push(base, base - 1, base + 1, base + 1, base - 2, base);
      }
    }
  }
};
