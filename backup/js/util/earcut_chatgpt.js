/**
 * Lightweight 2D polygon triangulation with holes.
 *
 * API:
 *   earcut2D(vertices, holes?)
 *
 * vertices: [x0,y0, x1,y1, ...]
 * holes:    [holeStartVertexIndex, ...]
 * returns:  [i0,i1,i2, ...]
 *
 * Dependency-free. Intended for small/medium valid polygons.
 */
export function earcut2D(data, holes = []) {
  const n = data.length >> 1;
  if (data.length % 2 || n < 3) return [];

  const xy = (i) => [data[i * 2], data[i * 2 + 1]];
  const cross = (a, b, c) =>
    (data[b * 2] - data[a * 2]) * (data[c * 2 + 1] - data[a * 2 + 1]) -
    (data[b * 2 + 1] - data[a * 2 + 1]) * (data[c * 2] - data[b * 2]);

  const area = (ring) => {
    let s = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      s +=
        data[ring[j] * 2] * data[ring[i] * 2 + 1] -
        data[ring[i] * 2] * data[ring[j] * 2 + 1];
    }
    return s / 2;
  };

  const inside = (p, ring) => {
    const [x, y] = xy(p);
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = xy(ring[i]);
      const [xj, yj] = xy(ring[j]);
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
        c = !c;
    }
    return c;
  };

  const orient = (a, b, c) => {
    const v = cross(a, b, c);
    return Math.abs(v) < 1e-12 ? 0 : Math.sign(v);
  };

  const intersects = (a, b, c, d) => {
    if (a === c || a === d || b === c || b === d) return false;
    const o1 = orient(a, b, c),
      o2 = orient(a, b, d);
    const o3 = orient(c, d, a),
      o4 = orient(c, d, b);
    return o1 * o2 < 0 && o3 * o4 < 0;
  };

  const validBridge = (h, v, poly, rings) => {
    const hx = data[h * 2],
      hy = data[h * 2 + 1];
    const vx = data[v * 2],
      vy = data[v * 2 + 1];
    const mx = (hx + vx) / 2,
      my = (hy + vy) / 2;

    // Bridge must not cross any ring edge.
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length];
        if (intersects(h, v, a, b)) return false;
      }
    }

    // Its midpoint must lie in the filled region.
    const pointInRing = (x, y, ring) => {
      let c = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = xy(ring[i]),
          [xj, yj] = xy(ring[j]);
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
          c = !c;
      }
      return c;
    };

    if (!pointInRing(mx, my, rings[0])) return false;
    for (let i = 1; i < rings.length; i++) {
      if (pointInRing(mx, my, rings[i])) return false;
    }

    // Also avoid crossings against the already merged boundary.
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i],
        b = poly[(i + 1) % poly.length];
      if (intersects(h, v, a, b)) return false;
    }
    return true;
  };

  // Build rings using original vertex indices.
  const starts = [0, ...holes, n];
  if (
    holes.some(
      (h, i) =>
        !Number.isInteger(h) || h < 3 || h >= n || (i > 0 && h <= holes[i - 1]),
    )
  )
    return [];

  const rings = [];
  for (let r = 0; r < starts.length - 1; r++) {
    const ring = [];
    for (let i = starts[r]; i < starts[r + 1]; i++) ring.push(i);
    if (ring.length < 3) return [];
    if (Math.abs(area(ring)) < 1e-12) return [];
    // Outer CCW, holes CW.
    const wantPositive = r === 0;
    if (area(ring) > 0 !== wantPositive) ring.reverse();
    rings.push(ring);
  }

  // Start with outer boundary.
  let poly = rings[0].slice();

  // Connect each hole to the nearest visible polygon vertex.
  for (let r = 1; r < rings.length; r++) {
    const hole = rings[r];

    let hi = 0;
    for (let i = 1; i < hole.length; i++) {
      const a = hole[i],
        b = hole[hi];
      if (
        data[a * 2] > data[b * 2] ||
        (data[a * 2] === data[b * 2] && data[a * 2 + 1] < data[b * 2 + 1])
      )
        hi = i;
    }
    const h = hole[hi];

    let best = -1,
      bestD = Infinity;
    for (let i = 0; i < poly.length; i++) {
      const v = poly[i];
      const dx = data[v * 2] - data[h * 2];
      const dy = data[v * 2 + 1] - data[h * 2 + 1];
      const d = dx * dx + dy * dy;
      if (d < bestD && validBridge(h, v, poly, rings)) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0) return [];

    // Splice hole into polygon; duplicate bridge endpoints.
    const walk = [];
    for (let i = 0; i < hole.length; i++) {
      walk.push(hole[(hi + i) % hole.length]);
    }
    walk.push(h);

    poly = [
      ...poly.slice(0, best + 1),
      ...walk,
      poly[best],
      ...poly.slice(best + 1),
    ];
  }

  // Remove consecutive duplicate / collinear vertices.
  let changed = true;
  while (changed && poly.length > 3) {
    changed = false;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[(i + poly.length - 1) % poly.length];
      const c = poly[i];
      const q = poly[(i + 1) % poly.length];
      const same =
        data[p * 2] === data[c * 2] && data[p * 2 + 1] === data[c * 2 + 1];
      if (
        same ||
        (Math.abs(cross(p, c, q)) < 1e-12 &&
          (data[c * 2] - data[p * 2]) * (data[c * 2] - data[q * 2]) +
            (data[c * 2 + 1] - data[p * 2 + 1]) *
              (data[c * 2 + 1] - data[q * 2 + 1]) <=
            0)
      ) {
        poly.splice(i, 1);
        changed = true;
        break;
      }
    }
  }

  const pointInTriangle = (p, a, b, c) => {
    const e = 1e-12;
    return cross(a, b, p) >= -e && cross(b, c, p) >= -e && cross(c, a, p) >= -e;
  };

  const result = [];
  let guard = 0;

  while (poly.length > 3 && guard++ < n * n) {
    let clipped = false;

    for (let i = 0; i < poly.length; i++) {
      const a = poly[(i + poly.length - 1) % poly.length];
      const b = poly[i];
      const c = poly[(i + 1) % poly.length];

      if (cross(a, b, c) <= 1e-12) continue;

      let blocked = false;
      for (let j = 0; j < poly.length; j++) {
        const p = poly[j];
        if (p === a || p === b || p === c) continue;

        // Ignore duplicated bridge coordinates.
        if (
          (data[p * 2] === data[a * 2] &&
            data[p * 2 + 1] === data[a * 2 + 1]) ||
          (data[p * 2] === data[b * 2] &&
            data[p * 2 + 1] === data[b * 2 + 1]) ||
          (data[p * 2] === data[c * 2] && data[p * 2 + 1] === data[c * 2 + 1])
        )
          continue;

        if (pointInTriangle(p, a, b, c)) {
          blocked = true;
          break;
        }
      }

      if (blocked) continue;

      result.push(a, b, c);
      poly.splice(i, 1);
      clipped = true;
      break;
    }

    if (!clipped) return [];
  }

  if (poly.length === 3 && cross(poly[0], poly[1], poly[2]) > 1e-12) {
    result.push(poly[0], poly[1], poly[2]);
  }

  return result;
}

export default earcut2D;
