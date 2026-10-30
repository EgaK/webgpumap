import earcut from "./util/earcut.dev";

export default async function generateSceneData() {
  // 配列をきれいにリセット
  let propStructs = [];
  let polygonVertex = [];
  let polygonVertexBase = 0;

  let polygonIndex = [];

  let borderIndex = [];
  let borderIndexBase = 0;

  let lineVertex = []; // 幅付きライン専用の頂点配列
  let lineIndex = []; // 幅付きライン専用のインデックス配列

  // ヘルパー：ポリゴン追加
  function addPolygon(rings, fillColor, lineColor, strokeThickness) {
    // rings は [ outerLoop, innerHole1, innerHole2, ... ] という構造を想定

    const earcutRawData = []; // earcut用の一時的なフラット配列 [x1,y1, x2,y2, ...]
    const holeIndices = []; // 穴の開始位置（頂点単位のインデックス）を記録する配列

    let currentVertexCount = 0;
    let base = 0;

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

        // GPUバッファ用（16ビットのバイナリを取り出してドッキング）
        const packed = ((p[1] & 0xffff) << 16) | (p[0] & 0xffff);
        polygonVertex.push(packed, propStructs.length);
        currentVertexCount++;

        // 枠線（折れ線）用の処理
        // 外周だけでなく、すべてのリング（穴の輪郭含む）に対して個別に枠線を描画する
        borderIndex.push(borderIndexBase + i);
        borderIndex.push(borderIndexBase + (i + 1 == ring.length ? 0 : i + 1));
      }
      borderIndexBase += ring.length;
    }

    // 生のX,Y配列と、穴の位置配列を渡して三角形分割を行う
    const indices = earcut(earcutRawData, holeIndices);

    if (!indices.length) return;

    indices.forEach((idx) => {
      polygonIndex.push(polygonVertexBase + idx);
    });

    propStructs.push({
      fillColor,
      lineColor,
      thickness: strokeThickness,
    });

    // グローバルなオフセットの更新
    polygonVertexBase += currentVertexCount;
  }

  function addPolyline(points, color, thickness) {
    const numPoints = points.length;
    if (numPoints < 2) return;

    for (let i = 0; i < numPoints - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      const base = lineVertex.length;

      const featureID = propStructs.length;
      let packed = ((current[1] & 0xffff) << 16) | (current[0] & 0xffff);
      const dx = next[0] - current[0];
      // GPU側の座標に合わせて符号を反転しておく
      const dy = -next[1] + current[1];
      // const len = Math.hypot(dx, dy) || 1.0;

      lineVertex.push({
        packed,
        featureID,
        normal: [dy, -dx],
      });
      lineVertex.push({
        packed,
        featureID,
        normal: [-dy, dx],
      });

      packed = ((next[1] & 0xffff) << 16) | (next[0] & 0xffff);
      lineVertex.push({
        packed,
        featureID,
        normal: [-dy, dx],
      });
      lineVertex.push({
        packed,
        featureID,
        normal: [dy, -dx],
      });

      lineIndex.push(base, base + 1, base + 2, base + 2, base + 3, base);

      if (i > 0) {
        lineIndex.push(base, base - 1, base + 1, base + 1, base - 2, base);
      }
    }

    propStructs.push({
      fillColor: [1, 1, 1, 0],
      lineColor: color,
      thickness: thickness,
    });
  }

  // --- データのランダム自動生成 (5000個ずつの例) ---
  const NUM_POLYGONS = 10;
  const NUM_LINES = 10;

  for (let i = 0; i < NUM_POLYGONS; i++) {
    const cx = Math.random() * 4096;
    const cy = Math.random() * 4096;
    const size = 500 + Math.random() * 500;

    const outerStar = [];
    const innerHole = []; // 穴用の配列を追加

    // 星のトゲの数（5〜9個）をランダムに決定
    const numPoints = 4 + Math.floor(Math.random() * 10);

    // 1. 外周（星型）：MVT仕様に合わせて時計回り(CW)にするため、angleをマイナス方向に回す
    for (let j = 0; j < numPoints * 2; j++) {
      const angle = -(j / (numPoints * 2)) * Math.PI * 2;
      const r = j % 2 === 0 ? size : size * 0.4;
      const p = [~~(cx + Math.cos(angle) * r), ~~(cy + Math.sin(angle) * r)];
      outerStar.push(p);
    }

    // 2. 穴（五角形）：星の谷よりもさらに内側（size * 0.25）に、反時計回り(CCW)で生成
    const holePoints = 5;
    const holeSize = size * 0.25;
    for (let j = 0; j < holePoints; j++) {
      const angle = (j / holePoints) * Math.PI * 2; // プラス方向（反時計回り）
      const p = [
        ~~(cx + Math.cos(angle) * holeSize),
        ~~(cy + Math.sin(angle) * holeSize),
      ];
      innerHole.push(p);
    }

    // 3. addPolygonへの受け渡し
    // earcutに「外周と穴」をセットで認識させるため、2つのリングをまとめた配列として渡します。
    // (MVTの loadGeometry() が返す [outerRing, innerRing1, ...] と同じ構造になります)
    const polygonRings = [outerStar, innerHole];

    addPolygon(
      polygonRings, // 外周と穴を含んだ多重配列を渡す
      // [0.9, 0.9, 0.9, 1],
      [Math.random(), Math.random(), Math.random(), Math.random()],
      [0, 0, 0, 1],
      2.0 + Math.random() * 15.0,
    );
  }

  for (let i = 0; i < NUM_LINES; i++) {
    const points = [];
    const numSegments = 5 + Math.floor(Math.random() * 100);
    let sx = ~~((Math.random() * 2 - 1) * 0.9 * 2048 + 2048);
    let sy = ~~((Math.random() * 2 - 1) * 0.9 * 2048 + 2048);
    points.push([sx, sy]);
    for (let j = 0; j < numSegments; j++) {
      sx += ~~(Math.random() * 200 - 100);
      sy += ~~(Math.random() * 200 - 100);
      sx = sx >= 4096 ? 4096 : sx < 0 ? 0 : sx;
      sy = sy >= 4096 ? 4096 : sy < 0 ? 0 : sy;
      points.push([sx, sy]);
    }
    addPolyline(
      points,
      [Math.random(), Math.random(), Math.random(), Math.random()],
      2.0 + Math.random() * 15.0,
    );
  }

  // addPolyline(
  //   [
  //     [500, 800],
  //     [1000, 1000],
  //     [1000, 2000],
  //     [2000, 2000],
  //     [2000, 3000],
  //     [3000, 3000],
  //     [3500, 3600],
  //   ],
  //   [1, 0, 0, 1],
  //   100.0,
  // );

  // const points = [
  //   [1000, 1000],
  //   [1000, 2000],
  //   [2000, 2000],
  //   [2000, 1000],
  // ];
  // const extent = [
  //   [0, 0],
  //   [0, -0.3],
  //   [0.1, 0],
  //   [-0.05, 0.05],
  // ];
  // for (let i = 0; i < points.length; i++) {
  //   const p = points[i];
  //   const packed = ((p[1] & 0xffff) << 16) | (p[0] & 0xffff);
  //   lineVertex.push({
  //     packed,
  //     featureID: 1.0,
  //     normal: extent[i],
  //   });
  // }
  // lineIndex = [0, 1, 2, 0, 2, 3];

  return {
    propStructs,
    polygonVertex,
    polygonIndex,
    borderIndex,
    lineVertex,
    lineIndex,
  };
}
