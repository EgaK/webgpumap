import earcut from "./util/earcut.dev";

export default async function generateSceneData() {
  // 配列をきれいにリセット
  let allVertices = [];
  let allIndices = [];
  let commandStructs = [];
  let maxVerticesPerInstance = 0;

  let vertexBase = 0;
  let indexBase = 0;

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

  // ヘルパー：折れ線追加
  function addPolyline(points, color, thickness) {
    for (const p of points) {
      const combined = ((p[1] & 0xffff) << 16) | (p[0] & 0xffff);
      allVertices.push(combined);
    }
    commandStructs.push({
      color: color,
      thickness: thickness,
      index_base: 0,
      index_count: points.length,
      fig_type: 1,
      vertex_base: vertexBase,
    });

    // 各頂点に関節用の「丸」を追加
    for (let i = 0; i < points.length; i++) {
      commandStructs.push({
        color: color,
        thickness: thickness,
        index_base: i,
        index_count: 32, // 分割数32で固定
        fig_type: 2,
        vertex_base: vertexBase,
      });
    }

    vertexBase += points.length;
  }

  // --- データのランダム自動生成 (5000個ずつの例) ---
  const NUM_POLYGONS = 5000;
  const NUM_LINES = 5000;

  for (let i = 0; i < NUM_POLYGONS; i++) {
    const cx = Math.random() * 4096;
    const cy = Math.random() * 4096;
    const size = 50 + Math.random() * 100;

    const outerStar = [];
    const innerHole = []; // 穴用の配列を追加

    // 星のトゲの数（5〜9個）をランダムに決定
    const numPoints = 5 + Math.floor(Math.random() * 5);

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
      [Math.random(), Math.random(), Math.random(), Math.random()],
      [Math.random(), Math.random(), Math.random(), Math.random()],
      2.0 + Math.random() * 15.0,
    );
  }

  for (let i = 0; i < NUM_LINES; i++) {
    const points = [];
    const numSegments = 2 + Math.floor(Math.random() * 10);
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
    // console.log("points:", points);
    addPolyline(
      points,
      [Math.random(), Math.random(), Math.random(), Math.random()],
      2.0 + Math.random() * 15.0,
    );
  }

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
    index: allIndices,
    maxVerticesPerInstance,
  };
}
