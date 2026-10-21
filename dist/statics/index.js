// src/js/util/earcut.dev.js
var steiners = /* @__PURE__ */ new Set();
var filteredOut = false;
function earcut(data, holeIndices, dim = 2) {
  const hasHoles = holeIndices && holeIndices.length;
  const outerLen = hasHoles ? holeIndices[0] * dim : data.length;
  if (steiners.size) steiners.clear();
  let outerNode = linkedList(data, 0, outerLen, dim, true);
  const triangles = [];
  if (!outerNode || outerNode.next === outerNode.prev) return triangles;
  let minX = 0, minY = 0, invSize = 0;
  if (hasHoles) outerNode = eliminateHoles(data, holeIndices, outerNode, dim);
  if (data.length > 80 * dim) {
    minX = data[0];
    minY = data[1];
    let maxX = minX;
    let maxY = minY;
    for (let i = dim; i < outerLen; i += dim) {
      const x = data[i];
      const y = data[i + 1];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    invSize = Math.max(maxX - minX, maxY - minY);
    invSize = invSize !== 0 ? 32767 / invSize : 0;
  }
  earcutLinked(outerNode, triangles, minX, minY, invSize);
  return triangles;
}
function linkedList(data, start, end, dim, clockwise) {
  let last = null;
  if (clockwise === signedArea(data, start, end, dim) > 0) {
    for (let i = start; i < end; i += dim)
      last = insertNode(i / dim | 0, data[i], data[i + 1], last);
  } else {
    for (let i = end - dim; i >= start; i -= dim)
      last = insertNode(i / dim | 0, data[i], data[i + 1], last);
  }
  if (last && equals(last, last.next)) {
    removeNode(last);
    last = last.next;
  }
  return last;
}
function filterPoints(start, end = start) {
  const full = end === start;
  let p = start, again;
  do {
    again = false;
    if (p !== p.next && (steiners.size === 0 || !steiners.has(p)) && (equals(p, p.next) || area(p.prev, p, p.next) === 0)) {
      if (full || p === end) end = p.prev;
      filteredOut = true;
      removeNode(p);
      p = p.prev;
      again = true;
    } else if (full || p !== end) {
      p = p.next;
      again = !full;
    }
  } while (again || p !== end);
  return end;
}
function earcutLinked(ear, triangles, minX, minY, invSize) {
  if (invSize) indexCurve(ear, minX, minY, invSize);
  let stop = ear, cured = false;
  while (ear.prev !== ear.next) {
    const prev = ear.prev;
    const next = ear.next;
    if (area(prev, ear, next) < 0 && (invSize ? isEarHashed(ear, minX, minY, invSize) : isEar(ear))) {
      triangles.push(prev.i, ear.i, next.i);
      removeNode(ear);
      ear = next;
      stop = next;
      continue;
    }
    ear = next;
    if (ear === stop) {
      filteredOut = false;
      ear = filterPoints(ear);
      if (filteredOut) {
        stop = ear;
        continue;
      }
      if (!cured) {
        ear = cureLocalIntersections(ear, triangles);
        stop = ear;
        cured = true;
        continue;
      }
      splitEarcut(ear, triangles, minX, minY, invSize);
      break;
    }
  }
}
function isEar(ear) {
  const a = ear.prev, b = ear, c = ear.next, ax = a.x, bx = b.x, cx = c.x, ay = a.y, by = b.y, cy = c.y, x0 = Math.min(ax, bx, cx), y0 = Math.min(ay, by, cy), x1 = Math.max(ax, bx, cx), y1 = Math.max(ay, by, cy);
  let p = c.next;
  while (p !== a) {
    if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && !(ax === p.x && ay === p.y) && pointInTriangle(ax, ay, bx, by, cx, cy, p.x, p.y) && area(p.prev, p, p.next) >= 0)
      return false;
    p = p.next;
  }
  return true;
}
function isEarHashed(ear, minX, minY, invSize) {
  const a = ear.prev, b = ear, c = ear.next, ax = a.x, bx = b.x, cx = c.x, ay = a.y, by = b.y, cy = c.y, x0 = Math.min(ax, bx, cx), y0 = Math.min(ay, by, cy), x1 = Math.max(ax, bx, cx), y1 = Math.max(ay, by, cy), minZ = zOrder(x0, y0, minX, minY, invSize), maxZ = zOrder(x1, y1, minX, minY, invSize);
  let p = ear.prevZ;
  while (p && p.z >= minZ) {
    if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && p !== c && !(ax === p.x && ay === p.y) && pointInTriangle(ax, ay, bx, by, cx, cy, p.x, p.y) && area(p.prev, p, p.next) >= 0)
      return false;
    p = p.prevZ;
  }
  let n = ear.nextZ;
  while (n && n.z <= maxZ) {
    if (n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1 && n !== c && !(ax === n.x && ay === n.y) && pointInTriangle(ax, ay, bx, by, cx, cy, n.x, n.y) && area(n.prev, n, n.next) >= 0)
      return false;
    n = n.nextZ;
  }
  return true;
}
function cureLocalIntersections(start, triangles) {
  let p = start;
  let cured = false;
  do {
    const a = p.prev, b = p.next.next;
    if (intersects(a, p, p.next, b, false) && locallyInside(a, b) && locallyInside(b, a)) {
      triangles.push(a.i, p.i, b.i);
      removeNode(p);
      removeNode(p.next);
      p = start = b;
      cured = true;
    }
    p = p.next;
  } while (p !== start);
  return cured ? filterPoints(p) : p;
}
function splitEarcut(start, triangles, minX, minY, invSize) {
  let a = start;
  do {
    let b = a.next.next;
    while (b !== a.prev) {
      if (a.i !== b.i && isValidDiagonal(a, b)) {
        let c = splitPolygon(a, b);
        a = filterPoints(a, a.next);
        c = filterPoints(c, c.next);
        earcutLinked(a, triangles, minX, minY, invSize);
        earcutLinked(c, triangles, minX, minY, invSize);
        return;
      }
      b = b.next;
    }
    a = a.next;
  } while (a !== start);
}
var indexActive = false;
function eliminateHoles(data, holeIndices, outerNode, dim) {
  const queue = [];
  for (let i = 0, len = holeIndices.length; i < len; i++) {
    const start = holeIndices[i] * dim;
    const end = i < len - 1 ? holeIndices[i + 1] * dim : data.length;
    const list = (
      /** @type {Node} */
      linkedList(data, start, end, dim, false)
    );
    if (list === list.next) steiners.add(list);
    queue.push(getLeftmost(list));
  }
  queue.sort(compareXYSlope);
  buildBlockIndex(data.length / dim, holeIndices.length);
  indexSegment(outerNode, outerNode);
  indexActive = true;
  for (let i = 0; i < queue.length; i++) {
    outerNode = eliminateHole(queue[i], outerNode);
  }
  indexActive = false;
  return filterPoints(outerNode);
}
function compareXYSlope(a, b) {
  return a.x - b.x || a.y - b.y || (a.next.y - a.y) / (a.next.x - a.x) - (b.next.y - b.y) / (b.next.x - b.x);
}
function eliminateHole(hole, outerNode) {
  const bridge = findHoleBridge(hole, outerNode);
  if (!bridge) {
    return outerNode;
  }
  const bridgeReverse = splitPolygon(bridge, hole);
  const bridge2 = bridgeReverse.next;
  indexSegment(bridge, bridge2.next);
  filterPoints(bridgeReverse, bridgeReverse.next);
  return filterPoints(bridge, bridge.next);
}
var K = 16;
var blockBBox = new Float64Array(0);
var numBlocks = 0;
var blockHead = [];
var blockStop = [];
function buildBlockIndex(maxNodes, numHoles) {
  const maxBlocks = Math.ceil((maxNodes + 2 * numHoles) / K) + numHoles + 2;
  if (blockBBox.length < maxBlocks * 4)
    blockBBox = new Float64Array(maxBlocks * 4);
  numBlocks = 0;
}
function indexSegment(head, stop) {
  let p = head;
  do {
    const b = numBlocks++;
    blockHead[b] = p;
    let minX = p.x, minY = p.y, maxX = p.x, maxY = p.y;
    let k = 0;
    do {
      const c = p.next;
      p.z = b;
      if (c.x < minX) minX = c.x;
      if (c.x > maxX) maxX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.y > maxY) maxY = c.y;
      p = c;
    } while (++k < K && p !== stop);
    blockStop[b] = p;
    const g = b * 4;
    blockBBox[g] = minX;
    blockBBox[g + 1] = minY;
    blockBBox[g + 2] = maxX;
    blockBBox[g + 3] = maxY;
  } while (p !== stop);
}
function growBlock(head, tail) {
  const g = head.z * 4;
  if (tail.x < blockBBox[g]) blockBBox[g] = tail.x;
  if (tail.y < blockBBox[g + 1]) blockBBox[g + 1] = tail.y;
  if (tail.x > blockBBox[g + 2]) blockBBox[g + 2] = tail.x;
  if (tail.y > blockBBox[g + 3]) blockBBox[g + 3] = tail.y;
}
function liveBlockStop(b) {
  let stop = blockStop[b];
  while (stop.prev.next !== stop) stop = stop.next;
  blockStop[b] = stop;
  return stop;
}
function liveBlockHead(b) {
  let head = blockHead[b];
  while (head.prev.next !== head) head = head.next;
  blockHead[b] = head;
  return head;
}
function findHoleBridge(hole, outerNode) {
  let p = outerNode;
  const hx = hole.x;
  const hy = hole.y;
  let qx = -Infinity;
  let m;
  if (equals(hole, p)) return p;
  for (let b = 0, g = 0; b < numBlocks; b++, g += 4) {
    if (hy < blockBBox[g + 1] || hy > blockBBox[g + 3] || blockBBox[g] > hx || blockBBox[g + 2] <= qx)
      continue;
    const stop = liveBlockStop(b);
    p = liveBlockHead(b);
    do {
      if (p.prev.next === p) {
        if (equals(hole, p.next)) return p.next;
        else if (hy <= p.y && hy >= p.next.y && p.next.y !== p.y) {
          const x = p.x + (hy - p.y) * (p.next.x - p.x) / (p.next.y - p.y);
          if (x <= hx && x > qx) {
            qx = x;
            m = p.x < p.next.x ? p : p.next;
            if (x === hx) return m;
          }
        }
      }
      p = p.next;
    } while (p !== stop);
  }
  if (!m) return null;
  const mx = m.x;
  const my = m.y;
  const tminY = Math.min(hy, my);
  const tmaxY = Math.max(hy, my);
  let tanMin = Infinity;
  for (let b = 0, g = 0; b < numBlocks; b++, g += 4) {
    if (blockBBox[g + 2] < mx || blockBBox[g] > hx || blockBBox[g + 3] < tminY || blockBBox[g + 1] > tmaxY)
      continue;
    const stop = liveBlockStop(b);
    p = liveBlockHead(b);
    do {
      if (p.prev.next === p && hx >= p.x && p.x >= mx && hx !== p.x && // skip dead nodes
      pointInTriangle(
        hy < my ? hx : qx,
        hy,
        mx,
        my,
        hy < my ? qx : hx,
        hy,
        p.x,
        p.y
      )) {
        const tan = Math.abs(hy - p.y) / (hx - p.x);
        if ((locallyInside(p, hole) || p.y === hy && p.next.y === hy && p.next.x > hx) && (tan < tanMin || tan === tanMin && (p.x > m.x || p.x === m.x && sectorContainsSector(m, p)))) {
          m = p;
          tanMin = tan;
        }
      }
      p = p.next;
    } while (p !== stop);
  }
  return m;
}
function sectorContainsSector(m, p) {
  return area(m.prev, m, p.prev) < 0 && area(p.next, m, m.next) < 0;
}
var sortArr = [];
var sortBuf = [];
var zArr = new Uint32Array(0);
var zBuf = new Uint32Array(0);
var counts = new Uint32Array(256);
function indexCurve(start, minX, minY, invSize) {
  let p = start;
  let n = 0;
  do {
    p.z = zOrder(p.x, p.y, minX, minY, invSize);
    sortArr[n++] = p;
    p = p.next;
  } while (p !== start);
  sortNodes(n);
  let prev = null;
  for (let i = 0; i < n; i++) {
    const node = sortArr[i];
    node.prevZ = prev;
    if (prev) prev.nextZ = node;
    prev = node;
  }
  prev.nextZ = null;
  sortArr.fill(
    /** @type {Node} */
    /** @type {unknown} */
    null,
    0,
    n
  );
  sortBuf.fill(
    /** @type {Node} */
    /** @type {unknown} */
    null,
    0,
    n
  );
}
function sortNodes(n) {
  if (n <= 32) {
    for (let i = 1; i < n; i++) {
      const node = sortArr[i], z = node.z;
      let j = i - 1;
      while (j >= 0 && sortArr[j].z > z) {
        sortArr[j + 1] = sortArr[j];
        j--;
      }
      sortArr[j + 1] = node;
    }
    return;
  }
  if (zArr.length < n) {
    zArr = new Uint32Array(n);
    zBuf = new Uint32Array(n);
    sortBuf = new Array(n);
  }
  for (let i = 0; i < n; i++) zArr[i] = sortArr[i].z;
  radixPass(n, sortArr, zArr, sortBuf, zBuf, 0);
  radixPass(n, sortBuf, zBuf, sortArr, zArr, 8);
  radixPass(n, sortArr, zArr, sortBuf, zBuf, 16);
  radixPass(n, sortBuf, zBuf, sortArr, zArr, 24);
}
function radixPass(n, src, srcZ, dst, dstZ, shift) {
  counts.fill(0);
  for (let i = 0; i < n; i++) counts[srcZ[i] >>> shift & 255]++;
  let sum = 0;
  for (let b = 0; b < 256; b++) {
    const c = counts[b];
    counts[b] = sum;
    sum += c;
  }
  for (let i = 0; i < n; i++) {
    const z = srcZ[i];
    const pos = counts[z >>> shift & 255]++;
    dst[pos] = src[i];
    dstZ[pos] = z;
  }
}
function zOrder(x, y, minX, minY, invSize) {
  x = (x - minX) * invSize | 0;
  y = (y - minY) * invSize | 0;
  x = (x | x << 8) & 16711935;
  x = (x | x << 4) & 252645135;
  x = (x | x << 2) & 858993459;
  x = (x | x << 1) & 1431655765;
  y = (y | y << 8) & 16711935;
  y = (y | y << 4) & 252645135;
  y = (y | y << 2) & 858993459;
  y = (y | y << 1) & 1431655765;
  return x | y << 1;
}
function getLeftmost(start) {
  let p = start, leftmost = start;
  do {
    if (p.x < leftmost.x || p.x === leftmost.x && p.y < leftmost.y)
      leftmost = p;
    p = p.next;
  } while (p !== start);
  return leftmost;
}
function pointInTriangle(ax, ay, bx, by, cx, cy, px, py) {
  return (cx - px) * (ay - py) >= (ax - px) * (cy - py) && (ax - px) * (by - py) >= (bx - px) * (ay - py) && (bx - px) * (cy - py) >= (cx - px) * (by - py);
}
function isValidDiagonal(a, b) {
  const zeroLength = equals(a, b) && area(a.prev, a, a.next) > 0 && area(b.prev, b, b.next) > 0;
  return a.next.i !== b.i && (zeroLength || locallyInside(a, b) && locallyInside(b, a) && // // locally visible
  (area(a.prev, a, b.prev) !== 0 || area(a, b.prev, b) !== 0)) && // no opposite-facing sectors
  !intersectsPolygon(a, b) && (zeroLength || middleInside(a, b));
}
function area(p, q, r) {
  return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
}
function equals(p1, p2) {
  return p1.x === p2.x && p1.y === p2.y;
}
function intersects(p1, q1, p2, q2, includeBoundary = true) {
  const o1 = area(p1, q1, p2);
  const o2 = area(p1, q1, q2);
  const o3 = area(p2, q2, p1);
  const o4 = area(p2, q2, q1);
  if ((o1 > 0 && o2 < 0 || o1 < 0 && o2 > 0) && (o3 > 0 && o4 < 0 || o3 < 0 && o4 > 0))
    return true;
  if (!includeBoundary) return false;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}
function onSegment(p, q, r) {
  return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) && q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
}
function intersectsPolygon(a, b) {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  let p = a;
  do {
    const n = p.next;
    if (p.x > maxX && n.x > maxX || p.x < minX && n.x < minX || p.y > maxY && n.y > maxY || p.y < minY && n.y < minY) {
      p = n;
      continue;
    }
    if (p.i !== a.i && n.i !== a.i && p.i !== b.i && n.i !== b.i && intersects(p, n, a, b))
      return true;
    p = n;
  } while (p !== a);
  return false;
}
function locallyInside(a, b) {
  return area(a.prev, a, a.next) < 0 ? area(a, b, a.next) >= 0 && area(a, a.prev, b) >= 0 : area(a, b, a.prev) < 0 || area(a, a.next, b) < 0;
}
function middleInside(a, b) {
  let p = a;
  let inside = false;
  const px = (a.x + b.x) / 2;
  const py = (a.y + b.y) / 2;
  do {
    const n = p.next;
    if (p.y > py !== n.y > py && px < (n.x - p.x) * (py - p.y) / (n.y - p.y) + p.x)
      inside = !inside;
    p = n;
  } while (p !== a);
  return inside;
}
function splitPolygon(a, b) {
  const a2 = createNode(a.i, a.x, a.y), b2 = createNode(b.i, b.x, b.y), an = a.next, bp = b.prev;
  a.next = b;
  b.prev = a;
  a2.next = an;
  an.prev = a2;
  b2.next = a2;
  a2.prev = b2;
  bp.next = b2;
  b2.prev = bp;
  return b2;
}
function insertNode(i, x, y, last) {
  const p = createNode(i, x, y);
  if (!last) {
    p.prev = p;
    p.next = p;
  } else {
    p.next = last.next;
    p.prev = last;
    last.next.prev = p;
    last.next = p;
  }
  return p;
}
function removeNode(p) {
  p.next.prev = p.prev;
  p.prev.next = p.next;
  if (p.prevZ) p.prevZ.nextZ = p.nextZ;
  if (p.nextZ) p.nextZ.prevZ = p.prevZ;
  if (indexActive) growBlock(p.prev, p.next);
}
function createNode(i, x, y) {
  return (
    /** @type {Node} */
    /** @type {unknown} */
    {
      i,
      // vertex index in coordinates array
      x,
      y,
      // vertex coordinates
      prev: null,
      // previous and next vertex nodes in a polygon ring
      next: null,
      z: 0,
      // z-order curve value; doubles as owning block in the hole-bridge index during eliminateHoles
      prevZ: null,
      // previous and next nodes in z-order
      nextZ: null
    }
  );
}
function signedArea(data, start, end, dim) {
  let sum = 0;
  for (let i = start, j = end - dim; i < end; i += dim) {
    sum += (data[j] - data[i]) * (data[i + 1] + data[j + 1]);
    j = i;
  }
  return sum;
}

// src/js/shader.wgsl
var shader_default = `struct DrawCommand{color:vec4f,thickness:f32,index_base:u32,index_count:u32,fig_type:u32,vertex_base:u32,}struct Uniforms{u_resolution:vec2f,u_zoom:f32,u_coordinate_max:f32,u_offset:vec2f,}@group(0)@binding(0)var<uniform> uniforms:Uniforms;@group(0)@binding(1)var<storage,read>all_vertices:array<u32>;@group(0)@binding(2)var<storage,read>all_indices:array<u32>;@group(0)@binding(3)var<storage,read>commands:array<DrawCommand>;struct VertexOutput{@builtin(position)position:vec4f,@location(0)color:vec4f,}fn unpack_sint16x2(packed:u32)->vec2f{let raw_x=packed&0xFFFFu;let raw_y=(packed>>16u)&0xFFFFu;let x=(i32(raw_x)<<16)>>16;let y=(i32(raw_y)<<16)>>16;return vec2f(f32(x),f32(y));}fn raw_to_ndc(packed_val:u32)->vec2f{let decoded_pos=unpack_sint16x2(packed_val);let normalized=decoded_pos/uniforms.u_coordinate_max;return normalized*2.0-1.0;}@vertex fn vs_main(@builtin(vertex_index)v_idx:u32,@builtin(instance_index)inst_idx:u32)->VertexOutput{var output:VertexOutput;let cmd=commands[inst_idx];output.color=cmd.color;if(cmd.fig_type==0u){if(v_idx>=cmd.index_count){output.position=vec4f(0.0,0.0,0.0,0.0);return output;}let global_idx=cmd.index_base+v_idx;let local_vert_idx=all_indices[global_idx];let raw_pos=all_vertices[cmd.vertex_base+local_vert_idx];let ndc_pos=raw_to_ndc(raw_pos);let cam_pos=(ndc_pos-uniforms.u_offset)*uniforms.u_zoom;output.position=vec4f(cam_pos,0.0,1.0);return output;}if(cmd.fig_type==1u){let segment_idx=v_idx/6u;let corner_idx=v_idx % 6u;if(segment_idx>=cmd.index_count-1u){output.position=vec4f(0.0,0.0,0.0,0.0);return output;}let p0=raw_to_ndc(all_vertices[cmd.vertex_base+segment_idx]);let p1=raw_to_ndc(all_vertices[cmd.vertex_base+segment_idx+1u]);let cam_p0=(p0-uniforms.u_offset)*uniforms.u_zoom;let cam_p1=(p1-uniforms.u_offset)*uniforms.u_zoom;let aspect=uniforms.u_resolution.x/uniforms.u_resolution.y;let dir=normalize(vec2f(cam_p1.x*aspect,cam_p1.y)-vec2f(cam_p0.x*aspect,cam_p0.y));let normal=vec2f(-dir.y,dir.x);let thickness_ndc=cmd.thickness/uniforms.u_resolution.y;let offset=vec2f((normal.x*thickness_ndc*0.5)/aspect,normal.y*thickness_ndc*0.5);var final_pos=vec2f(0.0);if(corner_idx==0u){final_pos=cam_p0+offset;}else if(corner_idx==1u||corner_idx==4u){final_pos=cam_p0-offset;}else if(corner_idx==2u||corner_idx==3u){final_pos=cam_p1+offset;}else if(corner_idx==5u){final_pos=cam_p1-offset;}output.position=vec4f(final_pos,0.0,1.0);return output;}if(cmd.fig_type==2u){let total_circle_vertices=cmd.index_count*3u;if(v_idx>=total_circle_vertices){output.position=vec4f(0.0,0.0,0.0,0.0);return output;}let tri_idx=v_idx/3u;let sub_idx=v_idx % 3u;let center_pos=raw_to_ndc(all_vertices[cmd.vertex_base+cmd.index_base]);let cam_center=(center_pos-uniforms.u_offset)*uniforms.u_zoom;var final_pos=cam_center;if(sub_idx>0u){var vertex_on_ring=tri_idx;if(sub_idx==2u){vertex_on_ring=(tri_idx+1u)% cmd.index_count;}let angle=(f32(vertex_on_ring)/f32(cmd.index_count))*2.0*3.14159265;let raw_offset=vec2f(cos(angle),sin(angle));let aspect=uniforms.u_resolution.x/uniforms.u_resolution.y;let radius_ndc=(cmd.thickness*0.5)/uniforms.u_resolution.y;let offset=vec2f((raw_offset.x*radius_ndc)/aspect,raw_offset.y*radius_ndc);final_pos=cam_center+offset;}output.position=vec4f(final_pos,0.0,1.0);return output;}return output;}@fragment fn fs_main(input:VertexOutput)->@location(0)vec4f{return input.color;}`;

// src/js/pbf/vectortile.js
var VectorTile = function(pbf, end) {
  this.layers = pbf.readFields(readTile, {}, end);
};
function readTile(tag, layers, pbf) {
  if (tag === 3) {
    var layer = new VectorTileLayer(pbf, pbf.readVarint() + pbf.pos);
    if (layer.length) {
      layers[layer.Name] = layer;
    }
  }
}
var VectorTileLayer = function(pbf, end) {
  this.extent = 4096;
  this.length = 0;
  this._pbf = pbf;
  this._keys = [];
  this._values = [];
  this._features = [];
  pbf.readFields(readLayer, this, end);
  this.length = this._features.length;
};
function readLayer(tag, layer, pbf) {
  if (tag === 1) layer.Name = pbf.readString();
  else if (tag === 5) layer.extent = pbf.readVarint();
  else if (tag === 2) layer._features.push(pbf.pos);
  else if (tag === 3) layer._keys.push(pbf.readString());
  else if (tag === 4) layer._values.push(readValueMessage(pbf));
}
function readValueMessage(pbf) {
  var value = null, end = pbf.readVarint() + pbf.pos;
  while (pbf.pos < end) {
    var tag = pbf.readVarint() >> 3;
    value = tag === 1 ? pbf.readString() : tag === 2 ? pbf.readFloat() : tag === 3 ? pbf.readDouble() : tag === 4 ? pbf.readVarint64() : tag === 5 ? pbf.readVarint() : tag === 6 ? pbf.readSVarint() : tag === 7 ? pbf.readBoolean() : null;
  }
  return value;
}
VectorTileLayer.prototype.feature = function(i) {
  if (i < 0 || i >= this._features.length) {
    console.log("feature index out of bounds");
  }
  this._pbf.pos = this._features[i];
  var end = this._pbf.readVarint() + this._pbf.pos;
  return new VectorTileFeature(
    this._pbf,
    end,
    this.extent,
    this._keys,
    this._values
  );
};
var VectorTileFeature = function(pbf, end, extent, keys, values) {
  this.properties = {};
  this.extent = extent;
  this.Type = 0;
  this._pbf = pbf;
  this._geometry = -1;
  this._keys = keys;
  this._values = values;
  pbf.readFields(readFeature, this, end);
};
function readFeature(tag, feature, pbf) {
  if (tag == 1) feature.id = pbf.readVarint();
  else if (tag == 2) readTag(pbf, feature);
  else if (tag == 3) feature.Type = pbf.readVarint();
  else if (tag == 4) feature._geometry = pbf.pos;
}
function readTag(pbf, feature) {
  var end = pbf.readVarint() + pbf.pos;
  while (pbf.pos < end) {
    var key = feature._keys[pbf.readVarint()], value = feature._values[pbf.readVarint()];
    feature.properties[key] = value;
  }
}
VectorTileFeature.prototype.loadGeometry = function() {
  var pbf = this._pbf;
  pbf.pos = this._geometry;
  var end = pbf.readVarint() + pbf.pos, cmd = 1, length = 0, x = 0, y = 0, lines = [], line;
  while (pbf.pos < end) {
    if (length <= 0) {
      var cmdLen = pbf.readVarint();
      cmd = cmdLen & 7;
      length = cmdLen >> 3;
    }
    length--;
    if (cmd === 1 || cmd === 2) {
      x += pbf.readSVarint();
      y += pbf.readSVarint();
      if (cmd === 1) {
        if (line) lines.push(line);
        line = [];
      }
      line.push([x, y]);
    } else if (cmd === 7) {
      if (line) {
        line.push(line[0]);
      }
    } else {
      console.log("unknown command " + cmd);
    }
  }
  if (line) lines.push(line);
  return lines;
};
VectorTileFeature.prototype.toGeoJSON = function([z, x, y]) {
  var size = this.extent * Math.pow(2, z), x0 = this.extent * x, y0 = this.extent * y, coordinates = this.loadGeometry(), Type = this.Type, i, j;
  function project(line) {
    for (var j2 = 0; j2 < line.length; j2++) {
      var p2 = line[j2].flat();
      var y2 = 1 - (p2[1] + y0) * 2 / size;
      line[j2] = [
        (p2[0] + x0) * 360 / size - 180,
        360 / Math.PI * Math.atan(Math.exp(y2 * Math.PI)) - 90
      ];
    }
  }
  switch (Type) {
    case 1:
      project(coordinates);
      break;
    case 2:
      for (var p of coordinates) {
        project(p);
      }
      break;
    case 3:
      coordinates = classifyRings(coordinates);
      for (var p of coordinates) {
        for (var q of p) {
          project(q);
        }
      }
      break;
  }
  if (coordinates.length == 1) {
    coordinates = coordinates[0];
  } else {
    Type += 4;
  }
  return {
    // Type: "Feature",
    geometry: {
      Type,
      // coordinates: coords,
      coordinates
    },
    properties: this.properties
  };
};
function classifyRings(rings) {
  var len = rings.length;
  if (len <= 1) return [rings];
  var polygons = [], polygon, ccw;
  for (var i = 0; i < len; i++) {
    var area2 = signedArea2(rings[i]);
    if (area2 === 0) continue;
    if (ccw === void 0) ccw = area2 < 0;
    if (ccw === area2 < 0) {
      if (polygon) polygons.push(polygon);
      polygon = [rings[i]];
    } else {
      polygon.push(rings[i]);
    }
  }
  if (polygon) polygons.push(polygon);
  return polygons;
}
function signedArea2(ring) {
  var sum = 0;
  for (var i = 0, len = ring.length, j = len - 1, p1, p2; i < len; j = i++) {
    p1 = ring[i];
    p2 = ring[j];
    sum += (p2[0] - p1[0]) * (p1[1] + p2[1]);
  }
  return sum;
}

// src/js/pbf/ieee754.js
var read = (buffer, offset, isLE, mLen, nBytes) => {
  var e, m;
  var eLen = nBytes * 8 - mLen - 1;
  var eMax = (1 << eLen) - 1;
  var eBias = eMax >> 1;
  var nBits = -7;
  var i = isLE ? nBytes - 1 : 0;
  var d = isLE ? -1 : 1;
  var s = buffer[offset + i];
  i += d;
  e = s & (1 << -nBits) - 1;
  s >>= -nBits;
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {
  }
  m = e & (1 << -nBits) - 1;
  e >>= -nBits;
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {
  }
  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : (s ? -1 : 1) * Infinity;
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

// src/js/pbf/pbf.js
var Pbf = function(buf) {
  this.buf = ArrayBuffer.isView && ArrayBuffer.isView(buf) ? buf : new Uint8Array(buf || 0);
  this.pos = 0;
  this.type = 0;
  this.length = this.buf.length;
};
Pbf.Varint = 0;
Pbf.Fixed64 = 1;
Pbf.Bytes = 2;
Pbf.Fixed32 = 5;
var SHIFT_LEFT_32 = (1 << 16) * (1 << 16);
var SHIFT_RIGHT_32 = 1 / SHIFT_LEFT_32;
Pbf.prototype = {
  destroy: function() {
    this.buf = null;
  },
  // === READING =================================================================
  readFields: function(readField, result, end) {
    end = end || this.length;
    while (this.pos < end) {
      var val = this.readVarint(), tag = val >> 3, startPos = this.pos;
      this.type = val & 7;
      readField(tag, result, this);
      if (this.pos === startPos) this.skip(val);
    }
    return result;
  },
  readMessage: function(readField, result) {
    return this.readFields(readField, result, this.readVarint() + this.pos);
  },
  readFixed32: function() {
    var val = readUInt32(this.buf, this.pos);
    this.pos += 4;
    return val;
  },
  readSFixed32: function() {
    var val = readInt32(this.buf, this.pos);
    this.pos += 4;
    return val;
  },
  // 64-bit int handling is based on github.com/dpw/node-buffer-more-ints (MIT-licensed)
  readFixed64: function() {
    var val = readUInt32(this.buf, this.pos) + readUInt32(this.buf, this.pos + 4) * SHIFT_LEFT_32;
    this.pos += 8;
    return val;
  },
  readSFixed64: function() {
    var val = readUInt32(this.buf, this.pos) + readInt32(this.buf, this.pos + 4) * SHIFT_LEFT_32;
    this.pos += 8;
    return val;
  },
  readFloat: function() {
    var val = read(this.buf, this.pos, true, 23, 4);
    this.pos += 4;
    return val;
  },
  readDouble: function() {
    var val = read(this.buf, this.pos, true, 52, 8);
    this.pos += 8;
    return val;
  },
  readVarint: function(isSigned) {
    var buf = this.buf, val, b;
    b = buf[this.pos++];
    val = b & 127;
    if (b < 128) return val;
    b = buf[this.pos++];
    val |= (b & 127) << 7;
    if (b < 128) return val;
    b = buf[this.pos++];
    val |= (b & 127) << 14;
    if (b < 128) return val;
    b = buf[this.pos++];
    val |= (b & 127) << 21;
    if (b < 128) return val;
    b = buf[this.pos];
    val |= (b & 15) << 28;
    return readVarintRemainder(val, isSigned, this);
  },
  readVarint64: function() {
    return this.readVarint(true);
  },
  readSVarint: function() {
    var num = this.readVarint();
    return num % 2 === 1 ? (num + 1) / -2 : num / 2;
  },
  readBoolean: function() {
    return Boolean(this.readVarint());
  },
  readString: function() {
    var end = this.readVarint() + this.pos, str = readUtf8(this.buf, this.pos, end);
    this.pos = end;
    return str;
  },
  readBytes: function() {
    var end = this.readVarint() + this.pos, buffer = this.buf.subarray(this.pos, end);
    this.pos = end;
    return buffer;
  },
  // verbose for performance reasons; doesn't affect gzipped size
  readPackedVarint: function(arr, isSigned) {
    if (this.type !== Pbf.Bytes) return arr.push(this.readVarint(isSigned));
    var end = readPackedEnd(this);
    arr = arr || [];
    while (this.pos < end) arr.push(this.readVarint(isSigned));
    return arr;
  },
  readPackedSVarint: function(arr) {
    if (this.type !== Pbf.Bytes) return arr.push(this.readSVarint());
    var end = readPackedEnd(this);
    arr = arr || [];
    while (this.pos < end) arr.push(this.readSVarint());
    return arr;
  },
  readPackedBoolean: function(arr) {
    if (this.type !== Pbf.Bytes) return arr.push(this.readBoolean());
    var end = readPackedEnd(this);
    arr = arr || [];
    while (this.pos < end) arr.push(this.readBoolean());
    return arr;
  },
  readPackedFloat: function(arr) {
    if (this.type !== Pbf.Bytes) return arr.push(this.readFloat());
    var end = readPackedEnd(this);
    arr = arr || [];
    while (this.pos < end) arr.push(this.readFloat());
    return arr;
  },
  readPackedDouble: function(arr) {
    if (this.type !== Pbf.Bytes) return arr.push(this.readDouble());
    var end = readPackedEnd(this);
    arr = arr || [];
    while (this.pos < end) arr.push(this.readDouble());
    return arr;
  },
  readPackedFixed32: function(arr) {
    if (this.type !== Pbf.Bytes) return arr.push(this.readFixed32());
    var end = readPackedEnd(this);
    arr = arr || [];
    while (this.pos < end) arr.push(this.readFixed32());
    return arr;
  },
  readPackedSFixed32: function(arr) {
    if (this.type !== Pbf.Bytes) return arr.push(this.readSFixed32());
    var end = readPackedEnd(this);
    arr = arr || [];
    while (this.pos < end) arr.push(this.readSFixed32());
    return arr;
  },
  readPackedFixed64: function(arr) {
    if (this.type !== Pbf.Bytes) return arr.push(this.readFixed64());
    var end = readPackedEnd(this);
    arr = arr || [];
    while (this.pos < end) arr.push(this.readFixed64());
    return arr;
  },
  readPackedSFixed64: function(arr) {
    if (this.type !== Pbf.Bytes) return arr.push(this.readSFixed64());
    var end = readPackedEnd(this);
    arr = arr || [];
    while (this.pos < end) arr.push(this.readSFixed64());
    return arr;
  },
  skip: function(val) {
    var type = val & 7;
    if (type === Pbf.Varint) while (this.buf[this.pos++] > 127) {
    }
    else if (type === Pbf.Bytes) this.pos = this.readVarint() + this.pos;
    else if (type === Pbf.Fixed32) this.pos += 4;
    else if (type === Pbf.Fixed64) this.pos += 8;
    else console.log("Unimplemented type: " + type);
  }
};
var readVarintRemainder = (l, s, p) => {
  var buf = p.buf, h, b;
  b = buf[p.pos++];
  h = (b & 112) >> 4;
  if (b < 128) return toNum(l, h, s);
  b = buf[p.pos++];
  h |= (b & 127) << 3;
  if (b < 128) return toNum(l, h, s);
  b = buf[p.pos++];
  h |= (b & 127) << 10;
  if (b < 128) return toNum(l, h, s);
  b = buf[p.pos++];
  h |= (b & 127) << 17;
  if (b < 128) return toNum(l, h, s);
  b = buf[p.pos++];
  h |= (b & 127) << 24;
  if (b < 128) return toNum(l, h, s);
  b = buf[p.pos++];
  h |= (b & 1) << 31;
  if (b < 128) return toNum(l, h, s);
  console.log("Expected varint not more than 10 bytes");
};
var readPackedEnd = (pbf) => {
  return pbf.type === Pbf.Bytes ? pbf.readVarint() + pbf.pos : pbf.pos + 1;
};
var toNum = (low, high, isSigned) => {
  if (isSigned) {
    return high * 4294967296 + (low >>> 0);
  }
  return (high >>> 0) * 4294967296 + (low >>> 0);
};
var readUInt32 = (buf, pos) => {
  return (buf[pos] | buf[pos + 1] << 8 | buf[pos + 2] << 16) + buf[pos + 3] * 16777216;
};
var readInt32 = (buf, pos) => {
  return (buf[pos] | buf[pos + 1] << 8 | buf[pos + 2] << 16) + (buf[pos + 3] << 24);
};
var readUtf8 = (buf, pos, end) => {
  var str = "";
  var i = pos;
  while (i < end) {
    var b0 = buf[i];
    var c = null;
    var bytesPerSequence = b0 > 239 ? 4 : b0 > 223 ? 3 : b0 > 191 ? 2 : 1;
    if (i + bytesPerSequence > end) break;
    var b1, b2, b3;
    if (bytesPerSequence === 1) {
      if (b0 < 128) {
        c = b0;
      }
    } else if (bytesPerSequence === 2) {
      b1 = buf[i + 1];
      if ((b1 & 192) === 128) {
        c = (b0 & 31) << 6 | b1 & 63;
        if (c <= 127) {
          c = null;
        }
      }
    } else if (bytesPerSequence === 3) {
      b1 = buf[i + 1];
      b2 = buf[i + 2];
      if ((b1 & 192) === 128 && (b2 & 192) === 128) {
        c = (b0 & 15) << 12 | (b1 & 63) << 6 | b2 & 63;
        if (c <= 2047 || c >= 55296 && c <= 57343) {
          c = null;
        }
      }
    } else if (bytesPerSequence === 4) {
      b1 = buf[i + 1];
      b2 = buf[i + 2];
      b3 = buf[i + 3];
      if ((b1 & 192) === 128 && (b2 & 192) === 128 && (b3 & 192) === 128) {
        c = (b0 & 15) << 18 | (b1 & 63) << 12 | (b2 & 63) << 6 | b3 & 63;
        if (c <= 65535 || c >= 1114112) {
          c = null;
        }
      }
    }
    if (c === null) {
      c = 65533;
      bytesPerSequence = 1;
    } else if (c > 65535) {
      c -= 65536;
      str += String.fromCharCode(c >>> 10 & 1023 | 55296);
      c = 56320 | c & 1023;
    }
    str += String.fromCharCode(c);
    i += bytesPerSequence;
  }
  return str;
};

// src/js/loadTile.js
var loadTile_default = async (zxy) => {
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
};
function getArrayDimension(arr) {
  if (!Array.isArray(arr)) {
    return 0;
  }
  return 1 + Math.max(0, ...arr.map(getArrayDimension));
}

// src/js/index.js
async function init() {
  const canvas = document.getElementById("gpuCanvas");
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) {
    alert("WebGPU \u3092\u30B5\u30DD\u30FC\u30C8\u3057\u3066\u3044\u306A\u3044\u30D6\u30E9\u30A6\u30B6\u3001\u307E\u305F\u306F\u74B0\u5883\u3067\u3059\u3002");
    return;
  }
  const context = canvas.getContext("webgpu");
  const devicePixelRatio = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * devicePixelRatio;
  canvas.height = window.innerHeight * devicePixelRatio;
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
    alphaMode: "premultiplied"
  });
  let zoom = 1;
  let cameraOffset = [0, 0];
  let isDragging = false;
  let previousMousePosition = { x: 0, y: 0 };
  let allVertices = [];
  let allIndices = [];
  let commandStructs = [];
  let maxVerticesPerInstance = 0;
  async function generateSceneData() {
    allVertices = [];
    allIndices = [];
    commandStructs = [];
    maxVerticesPerInstance = 0;
    let vertexBase = 0;
    let indexBase = 0;
    function addPolygon(rings, fillColor, strokeColor, strokeThickness) {
      const earcutRawData = [];
      const flatData = [];
      const holeIndices = [];
      let currentVertexCount = 0;
      for (let i2 = 0; i2 < rings.length; i2++) {
        const ring = rings[i2];
        if (ring.length === 0) continue;
        if (i2 > 0) {
          holeIndices.push(currentVertexCount);
        }
        for (const p of ring) {
          earcutRawData.push(p[0], p[1]);
          const combined = (p[1] & 65535) << 16 | p[0] & 65535;
          flatData.push(combined);
          currentVertexCount++;
        }
      }
      const indices = earcut(earcutRawData, holeIndices);
      if (indices.length === 0) return;
      const vertexCount = flatData.length;
      allVertices.push(...flatData);
      allIndices.push(...indices);
      commandStructs.push({
        color: fillColor,
        thickness: 0,
        index_base: indexBase,
        index_count: indices.length,
        fig_type: 0,
        vertex_base: vertexBase
      });
      vertexBase += vertexCount;
      indexBase += indices.length;
      for (const ring of rings) {
        if (ring.length > 0) {
          const strokePoints = [...ring, ring[0]];
          addPolyline(strokePoints, strokeColor, strokeThickness);
        }
      }
    }
    function addPolyline(points, color, thickness) {
      for (const p of points) {
        const combined = (p[1] & 65535) << 16 | p[0] & 65535;
        allVertices.push(combined);
      }
      commandStructs.push({
        color,
        thickness,
        index_base: 0,
        index_count: points.length,
        fig_type: 1,
        vertex_base: vertexBase
      });
      for (let i2 = 0; i2 < points.length; i2++) {
        commandStructs.push({
          color,
          thickness,
          index_base: i2,
          index_count: 32,
          // 分割数32で固定
          fig_type: 2,
          vertex_base: vertexBase
        });
      }
      vertexBase += points.length;
    }
    const NUM_POLYGONS = 5e3;
    const NUM_LINES = 5e3;
    for (let i2 = 0; i2 < NUM_POLYGONS; i2++) {
      const cx = Math.random() * 4096;
      const cy = Math.random() * 4096;
      const size = 50 + Math.random() * 100;
      const outerStar = [];
      const innerHole = [];
      const numPoints = 5 + Math.floor(Math.random() * 5);
      for (let j = 0; j < numPoints * 2; j++) {
        const angle = -(j / (numPoints * 2)) * Math.PI * 2;
        const r = j % 2 === 0 ? size : size * 0.4;
        const p = [~~(cx + Math.cos(angle) * r), ~~(cy + Math.sin(angle) * r)];
        outerStar.push(p);
      }
      const holePoints = 5;
      const holeSize = size * 0.25;
      for (let j = 0; j < holePoints; j++) {
        const angle = j / holePoints * Math.PI * 2;
        const p = [
          ~~(cx + Math.cos(angle) * holeSize),
          ~~(cy + Math.sin(angle) * holeSize)
        ];
        innerHole.push(p);
      }
      const polygonRings = [outerStar, innerHole];
      addPolygon(
        polygonRings,
        // 外周と穴を含んだ多重配列を渡す
        [Math.random(), Math.random(), Math.random(), Math.random()],
        [Math.random(), Math.random(), Math.random(), Math.random()],
        2 + Math.random() * 15
      );
    }
    for (let i2 = 0; i2 < NUM_LINES; i2++) {
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
      addPolyline(
        points,
        [Math.random(), Math.random(), Math.random(), Math.random()],
        2 + Math.random() * 15
      );
    }
    var axs = await loadTile_default([15, 28191, 13180]);
    for (var i = 0; i < axs.length; i++) {
    }
    commandStructs.forEach((cmd) => {
      let count = 0;
      if (cmd.fig_type === 0) count = cmd.index_count;
      else if (cmd.fig_type === 1) count = (cmd.index_count - 1) * 6;
      else if (cmd.fig_type === 2) count = cmd.index_count * 3;
      if (count > maxVerticesPerInstance) maxVerticesPerInstance = count;
    });
  }
  generateSceneData();
  const uniformBuffer = device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  const vertexBufferSize = allVertices.length * 4;
  const vertexBuffer = device.createBuffer({
    size: vertexBufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  });
  const indexBufferSize = allIndices.length * 4;
  const indexBuffer = device.createBuffer({
    size: indexBufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  });
  const commandBufferSize = commandStructs.length * 48;
  const commandBuffer = device.createBuffer({
    size: commandBufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  });
  function uploadDataToGPU() {
    const vertexData = new Uint32Array(allVertices);
    const indexData = new Uint32Array(allIndices);
    const STRIDE = 48;
    const commandBufferSize2 = commandStructs.length * STRIDE;
    const commandArrayBuffer = new ArrayBuffer(commandBufferSize2);
    const commandView = new DataView(commandArrayBuffer);
    commandStructs.forEach((cmd, i) => {
      const offset = i * STRIDE;
      commandView.setFloat32(offset + 0, cmd.color[0], true);
      commandView.setFloat32(offset + 4, cmd.color[1], true);
      commandView.setFloat32(offset + 8, cmd.color[2], true);
      commandView.setFloat32(offset + 12, cmd.color[3], true);
      commandView.setFloat32(offset + 16, cmd.thickness, true);
      commandView.setUint32(offset + 20, cmd.index_base, true);
      commandView.setUint32(offset + 24, cmd.index_count, true);
      commandView.setUint32(offset + 28, cmd.fig_type, true);
      commandView.setUint32(offset + 32, cmd.vertex_base, true);
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertexData);
    device.queue.writeBuffer(indexBuffer, 0, indexData);
    device.queue.writeBuffer(
      commandBuffer,
      0,
      new Uint8Array(commandArrayBuffer)
    );
  }
  function updateUniforms() {
    const uniformData = new Float32Array([
      canvas.width,
      canvas.height,
      // u_resolution
      zoom,
      4096,
      // u_coordinate_max, pad兼用
      cameraOffset[0],
      cameraOffset[1]
      // u_offset
    ]);
    device.queue.writeBuffer(uniformBuffer, 0, uniformData);
  }
  uploadDataToGPU();
  updateUniforms();
  const shaderModule = device.createShaderModule({ code: shader_default });
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: { module: shaderModule, entryPoint: "vs_main" },
    fragment: {
      module: shaderModule,
      entryPoint: "fs_main",
      targets: [{ format: presentationFormat }]
    },
    primitive: { topology: "triangle-list" }
    // すべて三角形として描画
  });
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: vertexBuffer } },
      { binding: 2, resource: { buffer: indexBuffer } },
      { binding: 3, resource: { buffer: commandBuffer } }
    ]
  });
  commandStructs.forEach((cmd) => {
    let count = 0;
    if (cmd.fig_type === 0) {
      count = cmd.index_count;
    } else if (cmd.fig_type === 1) {
      count = (cmd.index_count - 1) * 6;
    } else if (cmd.fig_type === 2) {
      count = cmd.index_count * 3;
    }
    if (count > maxVerticesPerInstance) maxVerticesPerInstance = count;
  });
  function render() {
    const commandEncoder = device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1 },
          loadOp: "clear",
          storeOp: "store"
        }
      ]
    });
    renderPass.setPipeline(pipeline);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(maxVerticesPerInstance, commandStructs.length, 0, 0);
    renderPass.end();
    device.queue.submit([commandEncoder.finish()]);
    fpsCounter.update();
  }
  render();
  window.addEventListener("resize", () => {
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
    device.queue.writeBuffer(
      uniformBuffer,
      0,
      new Float32Array([canvas.width, canvas.height])
    );
    render();
  });
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) / rect.width * 2 - 1;
      const mouseY = -((e.clientY - rect.top) / rect.height * 2 - 1);
      const zoomFactor = 1.1;
      const oldZoom = zoom;
      if (e.deltaY < 0) {
        zoom *= zoomFactor;
      } else {
        zoom /= zoomFactor;
      }
      zoom = Math.max(0.1, Math.min(zoom, 100));
      cameraOffset[0] += mouseX / oldZoom - mouseX / zoom;
      cameraOffset[1] += mouseY / oldZoom - mouseY / zoom;
      updateUniforms();
      render();
    },
    { passive: false }
  );
  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    }
  });
  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;
    const ndcX = deltaX / canvas.width * 2 * (canvas.width / window.innerWidth);
    const ndcY = -(deltaY / canvas.height) * 2 * (canvas.height / window.innerHeight);
    cameraOffset[0] -= ndcX / zoom;
    cameraOffset[1] -= ndcY / zoom;
    previousMousePosition = { x: e.clientX, y: e.clientY };
    updateUniforms();
    render();
  });
  window.addEventListener("mouseup", () => {
    isDragging = false;
  });
  let initialTouchDistance = 0;
  let initialZoom = 1;
  function getTouchDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  canvas.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        isDragging = true;
        previousMousePosition = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY
        };
      } else if (e.touches.length === 2) {
        isDragging = false;
        initialTouchDistance = getTouchDistance(e.touches[0], e.touches[1]);
        initialZoom = zoom;
      }
    },
    { passive: false }
  );
  canvas.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && isDragging) {
        const deltaX = e.touches[0].clientX - previousMousePosition.x;
        const deltaY = e.touches[0].clientY - previousMousePosition.y;
        const ndcX = deltaX / canvas.width * 2 * (canvas.width / window.innerWidth);
        const ndcY = -(deltaY / canvas.height) * 2 * (canvas.height / window.innerHeight);
        cameraOffset[0] -= ndcX / zoom;
        cameraOffset[1] -= ndcY / zoom;
        previousMousePosition = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY
        };
        updateUniforms();
        render();
      } else if (e.touches.length === 2) {
        const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
        if (initialTouchDistance > 0) {
          const factor = currentDistance / initialTouchDistance;
          zoom = initialZoom * factor;
          zoom = Math.max(0.1, Math.min(zoom, 100));
          updateUniforms();
          render();
        }
      }
    },
    { passive: false }
  );
  canvas.addEventListener("touchend", (e) => {
    e.preventDefault();
    isDragging = false;
    initialTouchDistance = 0;
  });
  document.getElementById("regenButton").addEventListener("click", () => {
    generateSceneData();
    uploadDataToGPU();
    render();
  });
}
init();
var fpsCounter = (() => {
  const div = document.createElement("div");
  div.style.position = "fixed";
  div.style.bottom = "10px";
  div.style.left = "10px";
  div.style.padding = "6px 10px";
  div.style.background = "rgba(0, 0, 0, 0.8)";
  div.style.color = "#00ffcc";
  div.style.fontFamily = "monospace";
  div.style.fontSize = "14px";
  div.style.fontWeight = "bold";
  div.style.borderRadius = "4px";
  div.style.zIndex = "99999";
  div.style.pointerEvents = "none";
  div.innerText = "FPS: --";
  document.body.appendChild(div);
  let lastTime = performance.now();
  let frameCount = 0;
  return {
    update() {
      frameCount++;
      const now = performance.now();
      const delta = now - lastTime;
      if (delta >= 500) {
        const fps = frameCount * 1e3 / delta;
        div.innerText = `FPS: ${fps.toFixed(1)}`;
        frameCount = 0;
        lastTime = now;
      }
    }
  };
})();
