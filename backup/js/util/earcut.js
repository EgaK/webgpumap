/**
 * 外周のみ（中空なし）に特化しつつ、Mapbox本来の幾何学判定を維持した高精度Earcut
 * 星型などの凹型ポリゴンや自己交差データも、反転や穴あきを起こさず正しく星型として分割します。
 * @param {number[]} data - [x0, y0, x1, y1, ...] 形式のフラットな座標配列
 * @returns {number[]} WebGPU用の三角形頂点インデックス配列（3つずつ）
 */
export default (data) => {
  const dim = 2;
  if (data.length < 6) return [];

  // --- 幾何学ユーティリティ関数群 ---
  const area = (p, q, r) =>
    (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  const equals = (p, q) => p.x === q.x && p.y === q.y;

  const intersects = (p1, q1, p2, q2) => {
    const o1 = Math.sign(area(p1, q1, p2)),
      o2 = Math.sign(area(p1, q1, q2)),
      o3 = Math.sign(area(p2, q2, p1)),
      o4 = Math.sign(area(p2, q2, q1));
    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && onSegment(p1, p2, q1)) return true;
    if (o2 === 0 && onSegment(p1, q2, q1)) return true;
    if (o3 === 0 && onSegment(p2, p1, q2)) return true;
    if (o4 === 0 && onSegment(p2, q1, q2)) return true;
    return false;
  };

  const onSegment = (p, q, r) =>
    q.x <= Math.max(p.x, r.x) &&
    q.x >= Math.min(p.x, r.x) &&
    q.y <= Math.max(p.y, r.y) &&
    q.y >= Math.min(p.y, r.y);
  const locallyInside = (p, a) =>
    area(p.prev, p, p.next) < 0
      ? area(p, a, p.next) >= 0 && area(p, p.prev, a) >= 0
      : area(p, a, p.prev) < 0 || area(p, p.next, a) < 0;

  const pointInTriangle = (ax, ay, bx, by, cx, cy, px, py) =>
    (cx - px) * (ay - py) - (ax - px) * (cy - py) >= 0 &&
    (ax - px) * (by - py) - (bx - px) * (ay - py) >= 0 &&
    (bx - px) * (cy - py) - (cx - px) * (by - py) >= 0;

  const filterPoints = (start) => {
    if (!start) return start;
    let p = start,
      again,
      end = start;
    do {
      again = false;
      if (equals(p, p.next) || area(p.prev, p, p.next) === 0) {
        p.next.prev = p.prev;
        p.prev.next = p.next;
        p = end = p.prev;
        if (p === p.next) break;
        again = true;
      } else {
        p = p.next;
      }
    } while (again || p !== end);
    return end;
  };

  // 1. 双方向連結リストの作成と巻き方向の判定
  let sum = 0;
  const len = data.length;
  for (let i = 0, j = len - dim; i < len; i += dim) {
    sum += (data[j] - data[i]) * (data[i + 1] + data[j + 1]);
    j = i;
  }

  let last;
  const clockwise = sum > 0;
  if (clockwise) {
    for (let i = 0; i < len; i += dim) {
      const p = { i, x: data[i], y: data[i + 1], prev: null, next: null };
      if (!last) {
        p.prev = p;
        p.next = p;
      } else {
        p.next = last.next;
        p.prev = last;
        last.next.prev = p;
        last.next = p;
      }
      last = p;
    }
  } else {
    for (let i = len - dim; i >= 0; i -= dim) {
      const p = { i, x: data[i], y: data[i + 1], prev: null, next: null };
      if (!last) {
        p.prev = p;
        p.next = p;
      } else {
        p.next = last.next;
        p.prev = last;
        last.next.prev = p;
        last.next = p;
      }
      last = p;
    }
  }

  let outerNode = filterPoints(last);
  const triangles = [];
  if (!outerNode || outerNode.next === outerNode.prev) return triangles;

  // 2. メインの Ear Clipping ループ
  let ear = outerNode;
  let stop = ear;
  let pass = 0;

  while (ear.prev !== ear.next) {
    const prev = ear.prev;
    const next = ear.next;

    // 【修正】Mapbox本来の厳密なEar判定ロジック
    let isEar = true;
    if (area(prev, ear, next) >= 0) {
      isEar = false;
    } else {
      let p = ear.next.next;
      while (p !== ear.prev) {
        if (
          pointInTriangle(
            prev.x,
            prev.y,
            ear.x,
            ear.y,
            next.x,
            next.y,
            p.x,
            p.y,
          ) &&
          area(p.prev, p, p.next) >= 0
        ) {
          isEar = false;
          break;
        }
        p = p.next;
      }
    }

    if (isEar) {
      triangles.push(prev.i / dim, ear.i / dim, next.i / dim);
      ear.next.prev = ear.prev;
      ear.prev.next = ear.next;
      ear = next.next;
      stop = next.next;
      continue;
    }

    ear = next;
    if (ear === stop) {
      if (pass === 0) {
        ear = filterPoints(ear);
        stop = ear;
        pass = 1;
      } else if (pass === 1) {
        // 自己交差の強硬修復パス（変数宣言を let start に修正済み）
        let p = filterPoints(ear);
        let start = p;
        do {
          const a = p.prev,
            b = p.next.next;
          if (
            a.i !== b.i &&
            intersects(a, p, p.next, b) &&
            locallyInside(a, b) &&
            locallyInside(b, a)
          ) {
            triangles.push(a.i / dim, p.i / dim, b.i / dim);
            p.next.prev = p.prev;
            p.prev.next = p.next;
            p.next.next.prev = p.next.prev;
            p.next.prev.next = p.next.next;
            p = start = b;
          }
          p = p.next;
        } while (p !== start);
        ear = filterPoints(p);
        stop = ear;
        pass = 2;
      } else {
        break;
      }
    }
  }

  return triangles;
};
