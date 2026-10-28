import { VectorTile } from "./vectortile";
import Pbf from "./pbf/pbf";
import earcut from "./util/earcut.dev";

import style from "./style";

export default async (zxy) => {
  let allVertices = [];
  let featureId = [];
  let allIndices = [];
  let commandStructs = [];
  let maxVerticesPerInstance = 0;
  let vertexBase = 0;
  let indexBase = 0;

  var d = await fetch("https://sasepo.com/t/" + zxy.join("/"));
  d = await new Pbf(await d.arrayBuffer());
  var layers = new VectorTile(d).layers;
  for (var n = style.length; n--;) {
    var styleProp = style[n];
    // console.log("style:", styleProp.Type, styleProp);
    var layerName = styleProp.Layer;
    var layer = layers[layerName];
    if (!layer) continue;
    if (styleProp.Type == "p") {
      // signs.push(makeFeatures(layer, styleProp, zxy));
    } else if (styleProp.Type == "s") {
      // symbs.push(makeFeatures(layer, styleProp, zxy));
    } else {
      // if (/w|r4|r3/.test(layerName)) continue;
      processMVTLayer(layer, styleProp);
    }
  }
  // var layer = layers["r5"];
  // 最大頂点数の計算
  commandStructs.forEach((cmd) => {
    let count = 0;
    if (cmd.fig_type === 0) count = cmd.index_count;
    else if (cmd.fig_type === 1) count = (cmd.index_count - 1) * 6;
    else if (cmd.fig_type === 2) count = cmd.index_count * 3;
    if (count > maxVerticesPerInstance) maxVerticesPerInstance = count;
  });
  return {
    command: commandStructs,
    vertex: allVertices,
    featureId: featureId,
    index: allIndices,
    maxVerticesPerInstance,
  };

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
    if (prop.Type == "f") {
      var fillColor = prop.Color;
      var strokeColor = [0.3, 0.3, 0.3, 1];
      var strokeThickness = 1;
      for (var i = 0; i < layer.length; i++) {
        const feature = layer.feature(i);
        // console.log("feature.type", feature.type, feature);
        if (feature.type !== 3) continue; // Polygon 以外はスキップ

        const geometry = feature.loadGeometry(); // [[[x,y], ...], ...]
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
              addPolygon(
                currentPolygonRings,
                fillColor,
                strokeColor,
                strokeThickness,
              );
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
          addPolygon(
            currentPolygonRings,
            fillColor,
            strokeColor,
            strokeThickness,
          );
        }
      }
    } else {
      var strokeColor = prop.Color;
      var strokeThickness = 5;
      for (var i = 0; i < layer.length; i++) {
        const feature = layer.feature(i);
        // console.log("feature.type", feature.type, feature);
        if (feature.type !== 2) continue; // Polygon 以外はスキップ

        const geometry = feature.loadGeometry(); // [[[x,y], ...], ...]
        for (const ring of geometry) {
          if (ring.length === 0) continue;

          // 頂点の形式を mapboxのPointオブジェクト から [x, y] の配列形式に変換
          const formattedRing = ring.map((p) => [p.x, p.y]);

          addPolyline(formattedRing, strokeColor, strokeThickness);
        }
      }
    }
  }

  // ヘルパー：ポリゴン追加
  function addPolygon(rings, fillColor, strokeColor, strokeThickness) {
    // rings は [ outerLoop, innerHole1, innerHole2, ... ] という構造を想定

    const earcutRawData = []; // earcut用の一時的なフラット配列 [x1,y1, x2,y2, ...]
    const flatData = []; // GPUバッファ用のパックされた u32 配列
    const holeIndices = []; // 穴の開始位置（頂点単位のインデックス）を記録する配列

    let currentVertexCount = 0;

    for (let i = 0; i < rings.length; i++) {
      const ring = rings[i];
      if (ring.length === 0) continue;

      // 2つ目以降のリング（＝穴）である場合、現在の合計頂点数を穴の開始位置として記録
      if (i > 0) {
        holeIndices.push(currentVertexCount);
      }

      // リング内の頂点を処理
      for (const p of ring) {
        // earcut用
        earcutRawData.push(p[0], p[1]);

        // GPUバッファ用（16ビットのバイナリを取り出してドッキング）
        const combined = ((p[1] & 0xffff) << 16) | (p[0] & 0xffff);
        flatData.push(combined);
        // flatData.push({
        //   packed_pos: combined,
        //   feature_id: commandStructs.length,
        // });
        featureId.push(commandStructs.length);

        currentVertexCount++;
      }
    }

    // 生のX,Y配列と、穴の位置配列を渡して三角形分割を行う
    const indices = earcut(earcutRawData, holeIndices);

    if (indices.length === 0) return;

    // 1要素 = 1頂点 になったため、頂点数は平坦化した全体の合計頂点数になります
    const vertexCount = flatData.length;

    allVertices.push(...flatData);
    allIndices.push(...indices);

    commandStructs.push({
      color: fillColor,
      thickness: 0.0,
      index_base: indexBase,
      index_count: indices.length,
      fig_type: 0,
      vertex_base: vertexBase,
    });

    // グローバルなオフセットの更新
    vertexBase += vertexCount;
    indexBase += indices.length;

    // 枠線（折れ線）用の処理
    // 外周だけでなく、すべてのリング（穴の輪郭含む）に対して個別に枠線を描画する
    for (const ring of rings) {
      if (ring.length > 0) {
        const strokePoints = [...ring, ring[0]]; // 終点と始点をつなぎ合わせる
        addPolyline(strokePoints, strokeColor, strokeThickness);
      }
    }
  }

  function addPolyline(points, color, thickness) {}

  // ヘルパー：折れ線追加
  function addPolyline2(points, color, thickness) {
    for (const p of points) {
      const combined = ((p[1] & 0xffff) << 16) | (p[0] & 0xffff);
      allVertices.push(combined);
    }
    const pointsCount = points.length; // 生の頂点数
    const segmentCount = pointsCount - 1; // 線分の数
    const indexCountForThisLine = segmentCount * 6; // この線分全体で消費するインデックス数

    // ★ インデックス配列の自動生成 (0,1,2, 2,3,0, 1,2,3, 3,4,1...)
    // 頂点シェーダー側で扱いやすくするため、セグメントごとに独立した連番を作ります
    for (let s = 0; s < segmentCount; s++) {
      // 各セグメントは「生頂点のs番目とs+1番目」を使いますが、
      // 拡張して長方形（4つの角）にするため、1セグメントごとに4つずつインデックスを進めます。
      const base = s * 4;
      allIndices.push(
        base + 0,
        base + 1,
        base + 2,
        base + 2,
        base + 3,
        base + 0,
      );
    }

    commandStructs.push({
      color: color,
      thickness: thickness,
      index_base: indexBase,
      index_count: indexCountForThisLine,
      fig_type: 1,
      vertex_base: vertexBase,
    });
    vertexBase += points.length;
    indexBase += indexCountForThisLine;

    // 各頂点に関節用の「丸」を追加
    if (thickness > 0) {
      const MAX_SEGMENTS = 16; // 最大16分割
      const maxIndexCount = MAX_SEGMENTS * 3; // 48
      for (let i = 0; i < points.length; i++) {
        commandStructs.push({
          color: color,
          thickness: thickness,
          index_base: indexBase,
          index_count: maxIndexCount,
          fig_type: 2,
          vertex_base: vertexBase,
        });
        for (let s = 0; s < MAX_SEGMENTS; s++) {
          allIndices.push(0, s + 1, s === MAX_SEGMENTS - 1 ? 1 : s + 2);
        }
        indexBase += maxIndexCount;
      }
    }
  }
};
