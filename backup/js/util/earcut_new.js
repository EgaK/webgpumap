export default function miniEarcut(data, holeIndices) {
  const result = [];
  const hasHoles = holeIndices && holeIndices.length > 0;
  const outerLen = hasHoles ? holeIndices[0] : data.length >> 1;

  function createNode(index, x, y) {
    const node = { i: index, x: x, y: y, prev: null, next: null };
    node.prev = node;
    node.next = node;
    return node;
  }
  function insertNode(index, x, y, last) {
    const node = createNode(index, x, y);
    if (!last) return node;
    node.next = last.next;
    node.prev = last;
    last.next.prev = node;
    last.next = node;
    return node;
  }

  // 1. 外周リンクの構築（インデックスを 0, 2, 4... と本家同様に2個飛ばしで記録！）
  let outerNode = null;
  for (let i = 0; i < outerLen; i++) {
    outerNode = insertNode(i << 1, data[i << 1], data[(i << 1) + 1], outerNode);
  }
  if (!outerNode || outerNode.next === outerNode.prev) return result;
  outerNode = outerNode.next;

  // 2. 穴のリンク処理とドッキング
  if (hasHoles) {
    const holes = [];
    for (let k = 0; k < holeIndices.length; k++) {
      const start = holeIndices[k];
      const end =
        k === holeIndices.length - 1 ? data.length >> 1 : holeIndices[k + 1];
      let holeList = null;
      for (let i = start; i < end; i++) {
        holeList = insertNode(
          i << 1,
          data[i << 1],
          data[(i << 1) + 1],
          holeList,
        );
      }
      if (holeList) {
        holeList = holeList.next;
        let curr = holeList,
          re = holeList;
        do {
          if (curr.x > re.x || (curr.x === re.x && curr.y < re.y)) re = curr;
          curr = curr.next;
        } while (curr !== holeList);
        holes.push(re);
      }
    }
    holes.sort((a, b) => b.x - a.x);

    for (let k = 0; k < holes.length; k++) {
      const hole = holes[k];
      let bridge = outerNode,
        startNode = null,
        maxX = -Infinity;
      const hx = hole.x,
        hy = hole.y;
      do {
        if (
          hy >= Math.min(bridge.y, bridge.next.y) &&
          hy <= Math.max(bridge.y, bridge.next.y) &&
          bridge.y !== bridge.next.y
        ) {
          const x =
            bridge.x +
            ((hy - bridge.y) * (bridge.next.x - bridge.x)) /
              (bridge.next.y - bridge.y);
          if (x <= hx && x > maxX) {
            maxX = x;
            startNode = bridge.x < bridge.next.x ? bridge : bridge.next;
          }
        }
        bridge = bridge.next;
      } while (bridge !== outerNode);

      if (startNode) {
        let stopNode = startNode,
          p = startNode.next;
        while (p !== stopNode) {
          if (
            hx >= p.x &&
            p.x >= startNode.x &&
            hx !== p.x &&
            ((hy >= p.y && hy <= startNode.y) ||
              (hy <= p.y && hy >= startNode.y))
          ) {
            const a = hy < hole.y ? hole : startNode,
              b = hy < hole.y ? startNode : hole;
            if ((b.y - a.y) * (p.x - b.x) - (b.x - a.x) * (p.y - b.y) <= 0)
              startNode = p;
          }
          p = p.next;
        }
        const next = startNode.next;
        startNode.next = hole;
        hole.prev = startNode;
        let holeEnd = hole;
        while (holeEnd.next !== hole) holeEnd = holeEnd.next;
        holeEnd.next = next;
        next.prev = holeEnd;
      }
    }
  }

  // 3. 幾何計算と耳判定
  function area(a, b, c) {
    return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  }

  function isEar(n) {
    const a = n.prev,
      b = n,
      c = n.next;
    if (area(a, b, c) >= 0) return false;
    let p = c.next;
    while (p !== a) {
      if (
        p.i !== a.i &&
        p.i !== c.i &&
        area(a, b, p) >= 0 &&
        area(b, c, p) >= 0 &&
        area(c, a, p) >= 0
      )
        return false;
      p = p.next;
    }
    return true;
  }

  // 4. 耳間引きのメインループ
  let curr = outerNode,
    stop = curr;
  let count = data.length >> 1;
  while (curr.next !== curr.prev && count > 2) {
    if (isEar(curr)) {
      // 本家と全く同じ元の「配列内インデックス番号」に変換（i >> 1）して結果に格納！
      result.push(curr.prev.i >> 1, curr.i >> 1, curr.next.i >> 1);
      curr.prev.next = curr.next;
      curr.next.prev = curr.prev;
      curr = curr.next;
      stop = curr;
      count--;
    } else {
      curr = curr.next;
      if (curr === stop) {
        if (area(curr.prev, curr, curr.next) === 0) {
          curr.prev.next = curr.next;
          curr.next.prev = curr.prev;
          curr = curr.next;
          stop = curr;
          continue;
        }
        break;
      }
    }
  }
  return result;
}
