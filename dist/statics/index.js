// src/js/util/tiny.js
var isString = (obj) => (typeof obj)[0] == "s";
function Tiny() {
}
var $ = (selector) => {
  if (isString(selector)) {
    if (selector[0] == "<") {
      var container = document.createElement("div");
      container.innerHTML = selector;
      selector = container.childNodes;
    } else {
      selector = document.querySelectorAll(selector);
    }
  } else {
    selector = selector[Symbol.iterator] ? selector : [selector];
  }
  var tiny = new Tiny();
  [].push.apply(tiny, selector);
  return tiny;
};
Tiny.prototype = {
  on: function(events, func) {
    return this.each((elem) => {
      events.split(/\s/).forEach((e) => {
        elem.addEventListener(e, func, false);
      });
    });
  },
  off: function(events, func, opt) {
    return this.each((elem) => {
      events.split(/\s/).forEach((e) => {
        elem.removeEventListener(e, func, opt);
      });
    });
  },
  one: function(event, func) {
    var elems = this;
    var once = (e) => {
      func(e);
      elems.off(event, once);
    };
    return elems.on(event, once);
  },
  fire: function(event, opt) {
    return this.each((elem) => {
      elem.dispatchEvent(new CustomEvent(event, opt));
    });
  },
  each: function(callback) {
    [].forEach.call(this, callback);
    return this;
  },
  boundRect: function() {
    return this[0]?.getBoundingClientRect();
  },
  css: function(obj) {
    return this.each((elem) => {
      for (var name in obj) {
        elem.style[name] = obj[name];
      }
    });
  },
  html: function(htm) {
    var elems = this;
    return htm != void 0 ? elems.each((elem) => {
      elem.innerHTML = htm;
    }) : elems[0] ? elems[0].innerHTML : "";
  },
  addClass: function(cls) {
    return this.each((elem) => {
      elem.classList.add(cls);
    });
  },
  removeClass: function(cls) {
    return this.each((elem) => {
      elem.classList.remove(cls);
    });
  },
  // hasClass: function (cls) {
  //   return this.length ? this[0].classList.contains(cls) : "";
  // },
  // toggleClass: function (cls) {
  //   return this.each((elem) => {
  //     elem.classList.toggle(cls);
  //   });
  // },
  Append: function(children) {
    return this.each((elem) => {
      if (isString(children)) {
        children = $(children);
      }
      children.each((child) => {
        elem.appendChild(child);
      });
    });
  },
  Remove: function() {
    return this.each((elem) => {
      if (elem && elem.parentNode) {
        elem.parentNode.removeChild(elem);
      }
    });
  },
  attr: function(obj) {
    var elems = this;
    return !isString(obj) ? elems.each((elem) => {
      for (var name in obj) {
        elem.setAttribute(name, obj[name]);
      }
    }) : elems[0] ? elems[0].getAttribute(obj) : "";
  },
  isChildOf: function(sel) {
    for (var i = this.length; i--; ) {
      var target = this[i];
      while (target && target.nodeType == 1) {
        if (target.matches(sel)) {
          return $(target);
        }
        target = target.parentNode;
      }
    }
    return false;
  }
  // anime: function (obj, duration = 500, easing, d = 20) {
  //   return this.each((elem) => {
  //     elem.style[obj.name] = obj.from;
  //     if (/^max/.test(obj.name)) elem.style.overflow = "hidden";
  //     delay(() => {
  //       elem.style.transition = duration + "ms " + (easing || "");
  //       elem.style[obj.name] = obj.to;
  //       delay(() => {
  //         elem.style.transition = "";
  //         elem.style[obj.name] = "";
  //       }, duration);
  //     }, d);
  //   });
  // },
};
var tiny_default = $;

// src/js/util/mouseevents.js
var isDragging = false;
var previousMousePosition = { x: 0, y: 0 };
var mouseevents_default = (viewArray2) => {
  const canvas2 = document.getElementById("a");
  const v = document.getElementById("zoom");
  const view = () => {
    requestAnimationFrame(view);
    if (!viewArray2[3]) return;
    v.innerText = `zoom: ${viewArray2[2].toFixed(2)}, x:${viewArray2[0].toFixed(2)}, y:${viewArray2[1].toFixed(2)}`;
  };
  view();
  canvas2.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const rect = canvas2.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) / rect.width * 2 - 1;
      const mouseY = -((e.clientY - rect.top) / rect.height * 2 - 1);
      const zoomFactor = 1.1;
      const oldZoom = viewArray2[2];
      var dz = e.deltaY;
      dz = dz > 5 ? 5 : dz < -5 ? -5 : dz;
      var z = viewArray2[2] - dz / 100;
      z = Math.max(10, Math.min(z, 20));
      if (viewArray2[2] == z) return;
      viewArray2[2] = z;
      viewArray2[0] += mouseX / oldZoom - mouseX / viewArray2[2];
      viewArray2[1] += mouseY / oldZoom - mouseY / viewArray2[2];
      viewArray2[3] = 1;
    },
    { passive: false }
  );
  canvas2.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    }
  });
  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;
    const ndcX = deltaX / canvas2.width * 2 * (canvas2.width / window.innerWidth);
    const ndcY = -(deltaY / canvas2.height) * 2 * (canvas2.height / window.innerHeight);
    viewArray2[0] -= ndcX / viewArray2[2];
    viewArray2[1] -= ndcY / viewArray2[2];
    previousMousePosition = { x: e.clientX, y: e.clientY };
    viewArray2[3] = 1;
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
  canvas2.addEventListener(
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
        initialZoom = viewArray2[2];
      }
    },
    { passive: false }
  );
  canvas2.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && isDragging) {
        const deltaX = e.touches[0].clientX - previousMousePosition.x;
        const deltaY = e.touches[0].clientY - previousMousePosition.y;
        const ndcX = deltaX / canvas2.width * 2 * (canvas2.width / window.innerWidth);
        const ndcY = -(deltaY / canvas2.height) * 2 * (canvas2.height / window.innerHeight);
        viewArray2[0] -= ndcX / viewArray2[2];
        viewArray2[1] -= ndcY / viewArray2[2];
        previousMousePosition = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY
        };
        viewArray2[3] = 1;
      } else if (e.touches.length === 2) {
        const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
        if (initialTouchDistance > 0) {
          const factor = currentDistance / initialTouchDistance;
          viewArray2[2] = initialZoom * factor;
          viewArray2[2] = Math.max(0.1, Math.min(viewArray2[2], 100));
          viewArray2[3] = 1;
        }
      }
    },
    { passive: false }
  );
  canvas2.addEventListener("touchend", (e) => {
    e.preventDefault();
    isDragging = false;
    initialTouchDistance = 0;
  });
};

// src/js/pointGeo.js
function Point(x, y) {
  this.x = x;
  this.y = y;
}
Point.prototype = {
  /**
   * Clone this point, returning a new point that can be modified
   * without affecting the old one.
   * @return {Point} the clone
   */
  clone() {
    return new Point(this.x, this.y);
  },
  /**
   * Add this point's x & y coordinates to another point,
   * yielding a new point.
   * @param {Point} p the other point
   * @return {Point} output point
   */
  add(p) {
    return this.clone()._add(p);
  },
  /**
   * Subtract this point's x & y coordinates to from point,
   * yielding a new point.
   * @param {Point} p the other point
   * @return {Point} output point
   */
  sub(p) {
    return this.clone()._sub(p);
  },
  /**
   * Multiply this point's x & y coordinates by point,
   * yielding a new point.
   * @param {Point} p the other point
   * @return {Point} output point
   */
  multByPoint(p) {
    return this.clone()._multByPoint(p);
  },
  /**
   * Divide this point's x & y coordinates by point,
   * yielding a new point.
   * @param {Point} p the other point
   * @return {Point} output point
   */
  divByPoint(p) {
    return this.clone()._divByPoint(p);
  },
  /**
   * Multiply this point's x & y coordinates by a factor,
   * yielding a new point.
   * @param {number} k factor
   * @return {Point} output point
   */
  mult(k) {
    return this.clone()._mult(k);
  },
  /**
   * Divide this point's x & y coordinates by a factor,
   * yielding a new point.
   * @param {number} k factor
   * @return {Point} output point
   */
  div(k) {
    return this.clone()._div(k);
  },
  /**
   * Rotate this point around the 0, 0 origin by an angle a,
   * given in radians
   * @param {number} a angle to rotate around, in radians
   * @return {Point} output point
   */
  rotate(a) {
    return this.clone()._rotate(a);
  },
  /**
   * Rotate this point around p point by an angle a,
   * given in radians
   * @param {number} a angle to rotate around, in radians
   * @param {Point} p Point to rotate around
   * @return {Point} output point
   */
  rotateAround(a, p) {
    return this.clone()._rotateAround(a, p);
  },
  /**
   * Multiply this point by a 4x1 transformation matrix
   * @param {[number, number, number, number]} m transformation matrix
   * @return {Point} output point
   */
  matMult(m) {
    return this.clone()._matMult(m);
  },
  /**
   * Calculate this point but as a unit vector from 0, 0, meaning
   * that the distance from the resulting point to the 0, 0
   * coordinate will be equal to 1 and the angle from the resulting
   * point to the 0, 0 coordinate will be the same as before.
   * @return {Point} unit vector point
   */
  unit() {
    return this.clone()._unit();
  },
  /**
   * Compute a perpendicular point, where the new y coordinate
   * is the old x coordinate and the new x coordinate is the old y
   * coordinate multiplied by -1
   * @return {Point} perpendicular point
   */
  perp() {
    return this.clone()._perp();
  },
  /**
   * Return a version of this point with the x & y coordinates
   * rounded to integers.
   * @return {Point} rounded point
   */
  round() {
    return this.clone()._round();
  },
  /**
   * Return the magnitude of this point: this is the Euclidean
   * distance from the 0, 0 coordinate to this point's x and y
   * coordinates.
   * @return {number} magnitude
   */
  mag() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  },
  /**
   * Judge whether this point is equal to another point, returning
   * true or false.
   * @param {Point} other the other point
   * @return {boolean} whether the points are equal
   */
  equals(other) {
    return this.x === other.x && this.y === other.y;
  },
  /**
   * Calculate the distance from this point to another point
   * @param {Point} p the other point
   * @return {number} distance
   */
  dist(p) {
    return Math.sqrt(this.distSqr(p));
  },
  /**
   * Calculate the distance from this point to another point,
   * without the square root step. Useful if you're comparing
   * relative distances.
   * @param {Point} p the other point
   * @return {number} distance
   */
  distSqr(p) {
    const dx = p.x - this.x, dy = p.y - this.y;
    return dx * dx + dy * dy;
  },
  /**
   * Get the angle from the 0, 0 coordinate to this point, in radians
   * coordinates.
   * @return {number} angle
   */
  angle() {
    return Math.atan2(this.y, this.x);
  },
  /**
   * Get the angle from this point to another point, in radians
   * @param {Point} b the other point
   * @return {number} angle
   */
  angleTo(b) {
    return Math.atan2(this.y - b.y, this.x - b.x);
  },
  /**
   * Get the angle between this point and another point, in radians
   * @param {Point} b the other point
   * @return {number} angle
   */
  angleWith(b) {
    return this.angleWithSep(b.x, b.y);
  },
  /**
   * Find the angle of the two vectors, solving the formula for
   * the cross product a x b = |a||b|sin(θ) for θ.
   * @param {number} x the x-coordinate
   * @param {number} y the y-coordinate
   * @return {number} the angle in radians
   */
  angleWithSep(x, y) {
    return Math.atan2(this.x * y - this.y * x, this.x * x + this.y * y);
  },
  /** @param {[number, number, number, number]} m */
  _matMult(m) {
    const x = m[0] * this.x + m[1] * this.y, y = m[2] * this.x + m[3] * this.y;
    this.x = x;
    this.y = y;
    return this;
  },
  /** @param {Point} p */
  _add(p) {
    this.x += p.x;
    this.y += p.y;
    return this;
  },
  /** @param {Point} p */
  _sub(p) {
    this.x -= p.x;
    this.y -= p.y;
    return this;
  },
  /** @param {number} k */
  _mult(k) {
    this.x *= k;
    this.y *= k;
    return this;
  },
  /** @param {number} k */
  _div(k) {
    this.x /= k;
    this.y /= k;
    return this;
  },
  /** @param {Point} p */
  _multByPoint(p) {
    this.x *= p.x;
    this.y *= p.y;
    return this;
  },
  /** @param {Point} p */
  _divByPoint(p) {
    this.x /= p.x;
    this.y /= p.y;
    return this;
  },
  _unit() {
    this._div(this.mag());
    return this;
  },
  _perp() {
    const y = this.y;
    this.y = this.x;
    this.x = -y;
    return this;
  },
  /** @param {number} angle */
  _rotate(angle) {
    const cos = Math.cos(angle), sin = Math.sin(angle), x = cos * this.x - sin * this.y, y = sin * this.x + cos * this.y;
    this.x = x;
    this.y = y;
    return this;
  },
  /**
   * @param {number} angle
   * @param {Point} p
   */
  _rotateAround(angle, p) {
    const cos = Math.cos(angle), sin = Math.sin(angle), x = p.x + cos * (this.x - p.x) - sin * (this.y - p.y), y = p.y + sin * (this.x - p.x) + cos * (this.y - p.y);
    this.x = x;
    this.y = y;
    return this;
  },
  _round() {
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
    return this;
  },
  constructor: Point
};
Point.convert = function(p) {
  if (p instanceof Point) {
    return (
      /** @type {Point} */
      p
    );
  }
  if (Array.isArray(p)) {
    return new Point(+p[0], +p[1]);
  }
  if (p.x !== void 0 && p.y !== void 0) {
    return new Point(+p.x, +p.y);
  }
  throw new Error("Expected [x, y] or {x, y} point format");
};

// src/js/vectortile.js
var VectorTileFeature = class {
  /**
   * @param {PbfReader} pbf
   * @param {number} end
   * @param {number} extent
   * @param {string[]} keys
   * @param {(number | string | boolean)[]} values
   */
  constructor(pbf, end, extent, keys, values) {
    this.properties = /* @__PURE__ */ Object.create(null);
    this.extent = extent;
    this.type = 0;
    this.id = void 0;
    this._pbf = pbf;
    this._geometry = -1;
    this._keys = keys;
    this._values = values;
    while (pbf.pos < end) {
      const tag = pbf.readVarint();
      if (tag === 8) this.id = pbf.readVarint();
      else if (tag === 18) {
        const tagsEnd = pbf.readVarint() + pbf.pos;
        while (pbf.pos < tagsEnd) {
          const key = keys[pbf.readVarint()];
          const value = values[pbf.readVarint()];
          this.properties[key] = value;
        }
      } else if (tag === 24)
        this.type = /** @type {0 | 1 | 2 | 3} */
        pbf.readVarint();
      else if (tag === 34) {
        this._geometry = pbf.pos;
        pbf.skip(tag);
      } else pbf.skip(tag);
    }
  }
  loadGeometry() {
    if (this._geometry < 0) {
      console.log("feature has no geometry");
      return;
    }
    const pbf = this._pbf;
    pbf.pos = this._geometry;
    const end = pbf.readVarint() + pbf.pos;
    const lines = [];
    let line;
    let cmd = 1;
    let length = 0;
    let x = 0;
    let y = 0;
    while (pbf.pos < end) {
      if (length <= 0) {
        const cmdLen = pbf.readVarint();
        cmd = cmdLen & 7;
        length = cmdLen >> 3;
        if (length === 0) continue;
      }
      length--;
      if (cmd === 1) {
        x += pbf.readSVarint();
        y += pbf.readSVarint();
        if (line) lines.push(line);
        line = [new Point(x, y)];
      } else if (cmd === 2) {
        x += pbf.readSVarint();
        y += pbf.readSVarint();
        if (line) line.push(new Point(x, y));
      } else if (cmd === 7) {
        if (line) {
          line.push(line[0].clone());
        }
      } else {
        console.log(`unknown command ${cmd}`);
        return;
      }
    }
    if (line) lines.push(line);
    return lines;
  }
  bbox() {
    if (this._geometry < 0) {
      console.log("feature has no geometry");
      return;
    }
    const pbf = this._pbf;
    pbf.pos = this._geometry;
    const end = pbf.readVarint() + pbf.pos;
    let cmd = 1, length = 0, x = 0, y = 0, x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;
    while (pbf.pos < end) {
      if (length <= 0) {
        const cmdLen = pbf.readVarint();
        cmd = cmdLen & 7;
        length = cmdLen >> 3;
        if (length === 0) continue;
      }
      length--;
      if (cmd === 1 || cmd === 2) {
        x += pbf.readSVarint();
        y += pbf.readSVarint();
        if (x < x1) x1 = x;
        if (x > x2) x2 = x;
        if (y < y1) y1 = y;
        if (y > y2) y2 = y;
      } else if (cmd !== 7) {
        console.log(`unknown command ${cmd}`);
        return;
      }
    }
    return [x1, y1, x2, y2];
  }
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @return {Feature}
   */
  toGeoJSON(x, y, z) {
    const size = this.extent * Math.pow(2, z), x0 = this.extent * x, y0 = this.extent * y, vtCoords = this.loadGeometry();
    function projectPoint(p) {
      return [
        (p.x + x0) * 360 / size - 180,
        360 / Math.PI * Math.atan(Math.exp((1 - (p.y + y0) * 2 / size) * Math.PI)) - 90
      ];
    }
    function projectLine(line) {
      return line.map(projectPoint);
    }
    let geometry;
    if (this.type === 1) {
      const points = [];
      for (const line of vtCoords) {
        points.push(line[0]);
      }
      const coordinates = projectLine(points);
      geometry = points.length === 1 ? { type: "Point", coordinates: coordinates[0] } : { type: "MultiPoint", coordinates };
    } else if (this.type === 2) {
      const coordinates = vtCoords.map(projectLine);
      geometry = coordinates.length === 1 ? { type: "LineString", coordinates: coordinates[0] } : { type: "MultiLineString", coordinates };
    } else if (this.type === 3) {
      const polygons = classifyRings(vtCoords);
      const coordinates = [];
      for (const polygon of polygons) {
        coordinates.push(polygon.map(projectLine));
      }
      geometry = coordinates.length === 1 ? { type: "Polygon", coordinates: coordinates[0] } : { type: "MultiPolygon", coordinates };
    } else {
      console.log("unknown feature type");
      return;
    }
    const result = {
      type: "Feature",
      geometry,
      properties: this.properties
    };
    if (this.id != null) {
      result.id = this.id;
    }
    return result;
  }
};
VectorTileFeature.types = ["Unknown", "Point", "LineString", "Polygon"];
function classifyRings(rings) {
  const len = rings.length;
  if (len <= 1) return [rings];
  const polygons = [];
  let polygon, ccw;
  for (let i = 0; i < len; i++) {
    const area = signedArea(rings[i]);
    if (area === 0) continue;
    if (ccw === void 0) ccw = area < 0;
    if (ccw === area < 0) {
      if (polygon) polygons.push(polygon);
      polygon = [rings[i]];
    } else if (polygon) {
      polygon.push(rings[i]);
    }
  }
  if (polygon) polygons.push(polygon);
  return polygons;
}
function signedArea(ring) {
  let sum = 0;
  for (let i = 0, len = ring.length, j = len - 1, p1, p2; i < len; j = i++) {
    p1 = ring[i];
    p2 = ring[j];
    sum += (p2.x - p1.x) * (p1.y + p2.y);
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
function Pbf(buf) {
  this.buf = ArrayBuffer.isView && ArrayBuffer.isView(buf) ? buf : new Uint8Array(buf || 0);
  this.pos = 0;
  this.type = 0;
  this.length = this.buf.length;
}
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

// src/js/util/earcut.dev.js
var blockBBox = new Float64Array(0);
var zArr = new Uint32Array(0);
var zBuf = new Uint32Array(0);
var counts = new Uint32Array(256);

// src/js/util/calc.js
var scale = (z) => {
  return Math.pow(2, z) * 3e-5;
};

// src/js/style.js
var style_default = [
  {
    // 鉄道
    Type: "l",
    Layer: "t",
    Color: [0.59, 0.59, 0.59],
    //"150,150,150",
    // Color: '969696',
    thickness: [
      [scale(15), 10],
      [scale(18), 100]
    ],
    OPacity: [
      [scale(15), 0.1],
      [scale(18), 1]
    ]
    // thickness: 5,
    // Dash: [30, 30],
    // thickness: [
    // 	[10, 3],
    // 	[15, 20],
    // ],
  },
  {
    // 建物
    Type: "f",
    Layer: "b",
    Color: [0.94, 0.96, 0.94],
    //"240,245,240",
    // Color: 'f0f5f0',
    // Color: '200,200,200',
    // thickness: 1,
    thickness: 1
    // OPacity: .5,
  },
  {
    // 道路輪郭
    Type: "l",
    Layer: "r1",
    Color: [0.39, 0.39, 0.39],
    //"99,99,99",
    // Color: '636363',
    thickness: 1,
    OPacity: [
      [16, 0],
      [18, 1]
    ]
  },
  {
    // 道路部品
    Type: "l",
    Layer: "r2",
    Color: [0.77, 0.63, 0],
    //"196,160,0",
    // Color: 'c4a000',
    thickness: 1
    // OPacity: [
    //   [16, 0],
    //   [17, 1],
    // ],
  },
  {
    // その他の道路
    Type: "f",
    Layer: "r5",
    Color: [1, 1, 1]
    // Color: 'ffffff',
  },
  {
    // 高速
    Type: "f",
    Layer: "r3",
    Color: [1, 0.77, 0.6]
    //"255,197,153",
    // Color: 'ffc599',
  },
  {
    // 高速 // Zoom13以下のとき
    Type: "l",
    Layer: "r8",
    Color: [1, 0.77, 0.6],
    //"255,197,153",
    // Color: 'ffc599',
    // thickness: 1,
    // OPacity: [
    // 	[10, 0],
    // 	[12, 1],
    // ],
    thickness: [
      [10, 5],
      [13, 10]
    ]
  },
  {
    // 国道
    Type: "f",
    Layer: "r4",
    Color: [0.93, 0.86, 0.58]
    //"239,220,148",
    // Color: 'efdc94',
  },
  {
    // 国道 // Zoom13以下のとき
    Type: "l",
    Layer: "r9",
    Color: [0.93, 0.86, 0.58],
    //"239,220,148",
    // Color: 'efdc94',
    // thickness: 1,
    // OPacity: [
    // 	[10, 0],
    // 	[12],
    // ],
    thickness: [
      [10, 5],
      [13, 10],
      [16, 30]
    ]
  },
  {
    // トンネル
    Type: "l",
    Layer: "r6",
    Color: [0.39, 0.39, 0.39],
    //"100,100,100",
    // Color: '646464',
    thickness: 2,
    Dash: [20, 20]
  },
  {
    // 水域
    Type: "f",
    Layer: "w",
    Color: [0.66, 0.86, 1]
    //"170,221,255",
    // Color: 'aaddff',
  },
  {
    // 緑
    Type: "f",
    Layer: "g",
    Color: [0.8, 0.93, 0.66]
    //"204,238,170",
    // Color: 'cceeaa',
  },
  // 文字用のレイヤ
  {
    Type: "p",
    Layer: "c",
    // text: "name",
    Color: [0.4, 0.4, 0.4],
    //"102,102,102",
    // Color: '666666',
    Size: 14,
    Padding: 10
    // Css: {
    // 	"border-radius": "4px",
    // 	"background": "rgba(255,255,255,.5)",
    // 	"padding": "5px",
    // 	"font": "14px bold gothic",
    // 	"color": "#333",
    // }
  },
  {
    // 道路の文字
    Type: "p",
    Layer: "rt",
    // Color: "#fff",
    Size: 12,
    // text: "ref", //属性はnに統一
    // Padding: 10,
    // OPacity: [
    // 	[14, 0],
    // 	[14, 1],
    // ],
    Css: {
      "border": "1px solid #fff",
      "border-radius": "4px 4px 50% 50%",
      "background": "#06a",
      "padding": "5px",
      "color": "#fff"
    }
  },
  {
    Type: "p",
    Layer: "d",
    // text: "name",
    Color: [0.4, 0.4, 0.4],
    //"102,102,102",
    // Color: '666666',
    Size: 12,
    // Padding: 10,
    OPacity: [
      [13, 0],
      [14, 1]
    ]
  },
  {
    Type: "s",
    Layer: "p"
    // text: "name",
    // desc: "com",  tに変更
    // cat: "Type",  cに変更
    // Color: '102,102,102',
    // Size: 13,
  }
  // { // 水域
  // 	Type: "f",
  // 	Layer: "w2",
  // 	Color: '170,221,255',
  // },
];

// src/js/index.js
var sab = new SharedArrayBuffer(16);
var viewArray = new Float32Array(sab);
viewArray[0] = 0;
viewArray[1] = 0;
viewArray[2] = 16;
viewArray[3] = 1;
var canvas = tiny_default("canvas");
canvas[0].width = 800;
canvas[0].height = 1200;
canvas.css({ width: "400px", height: "400px" });
var offcanvas = canvas[0].transferControlToOffscreen();
var blob = new Blob(['var C=new Set,aa=!1;\nfunction ba(a,b){var c=b&&b.length,g=c?b[0]*2:a.length;C.size&&C.clear();var f=ca(a,0,g,!0),d=[];if(!f||f.next===f.j)return d;var e=0,k=0,l=0;if(c){c=f;f=[];for(let t=0,v=b.length;t<v;t++){var m=ca(a,b[t]*2,t<v-1?b[t+1]*2:a.length,!1);m===m.next&&C.add(m);var q=m;let u=m;do{if(q.x<u.x||q.x===u.x&&q.y<u.y)u=q;q=q.next}while(q!==m);f.push(u)}f.sort(da);b=b.length;b=Math.ceil((a.length/2+2*b)/ea)+b+2;D.length<b*4&&(D=new Float64Array(b*4));fa=0;ha(c,c);ia=!0;for(b=0;b<f.length;b++)a:{m=f[b];q=c;c=ja(m,\nq);if(!c){c=q;break a}m=ka(c,m);ha(c,m.next.next);E(m,m.next);c=E(c,c.next)}ia=!1;f=E(c)}if(a.length>160){e=a[0];k=a[1];l=e;c=k;for(b=2;b<g;b+=2)m=a[b],q=a[b+1],m<e&&(e=m),q<k&&(k=q),m>l&&(l=m),q>c&&(c=q);l=Math.max(l-e,c-k);l=l!==0?32767/l:0}la(f,d,e,k,l);return d}\nfunction ca(a,b,c,g){var f=null,d=0;for(let e=b,k=c-2;e<c;e+=2)d+=(a[k]-a[e])*(a[e+1]+a[k+1]),k=e;if(g===d>0)for(;b<c;b+=2)f=ma(b/2|0,a[b],a[b+1],f);else for(c-=2;c>=b;c-=2)f=ma(c/2|0,a[c],a[c+1],f);f&&J(f,f.next)&&(P(f),f=f.next);return f}function E(a,b=a){var c=b===a;do{var g=!1;if(!(a===a.next||C.size!==0&&C.has(a)||!J(a,a.next)&&Q(a.j,a,a.next)!==0)){if(c||a===b)b=a.j;aa=!0;P(a);a=a.j;g=!0}else if(c||a!==b)a=a.next,g=!c}while(g||a!==b);return b}\nfunction la(a,b,c,g,f){if(f){var d=a,e=d,k=0;do e.z=na(e.x,e.y,c,g,f),R[k++]=e,e=e.next;while(e!==d);d=k;if(d<=32)for(e=1;e<d;e++){for(var l=R[e],m=l.z,q=e-1;q>=0&&R[q].z>m;)R[q+1]=R[q],q--;R[q+1]=l}else{S.length<d&&(S=new Uint32Array(d),T=new Uint32Array(d),U=Array(d));for(e=0;e<d;e++)S[e]=R[e].z;oa(d,R,S,U,T,0);oa(d,U,T,R,S,8);oa(d,R,S,U,T,16);oa(d,U,T,R,S,24)}d=null;for(e=0;e<k;e++){l=R[e];if(l.C=d)d.B=l;d=l}d.B=null;R.fill(null,0,k);U.fill(null,0,k)}k=a;for(d=!1;a.j!==a.next;){e=a.j;l=a.next;\nif(m=Q(e,a,l)<0)if(f)a:{var t=a.j;m=a.next;q=t.x;var v=a.x,u=m.x;t=t.y;var w=a.y,z=m.y,F=Math.min(q,v,u),K=Math.min(t,w,z),L=Math.max(q,v,u),N=Math.max(t,w,z),p=na(F,K,c,g,f),n=na(L,N,c,g,f);let r=a.C;for(;r&&r.z>=p;){if(r.x>=F&&r.x<=L&&r.y>=K&&r.y<=N&&r!==m&&(q!==r.x||t!==r.y)&&pa(q,t,v,w,u,z,r.x,r.y)&&Q(r.j,r,r.next)>=0){m=!1;break a}r=r.C}for(p=a.B;p&&p.z<=n;){if(p.x>=F&&p.x<=L&&p.y>=K&&p.y<=N&&p!==m&&(q!==p.x||t!==p.y)&&pa(q,t,v,w,u,z,p.x,p.y)&&Q(p.j,p,p.next)>=0){m=!1;break a}p=p.B}m=!0}else a:{m=\na.j;n=a.next;q=m.x;v=a.x;u=n.x;t=m.y;w=a.y;z=n.y;F=Math.min(q,v,u);K=Math.min(t,w,z);L=Math.max(q,v,u);N=Math.max(t,w,z);for(n=n.next;n!==m;){if(n.x>=F&&n.x<=L&&n.y>=K&&n.y<=N&&(q!==n.x||t!==n.y)&&pa(q,t,v,w,u,z,n.x,n.y)&&Q(n.j,n,n.next)>=0){m=!1;break a}n=n.next}m=!0}if(m)b.push(e.l,a.l,l.l),P(a),k=a=l;else if(a=l,a===k)if(aa=!1,a=E(a),aa)k=a;else if(d){a:{k=a;do{for(d=k.next.next;d!==k.j;){if(e=k.l!==d.l){e=J(k,d)&&Q(k.j,k,k.next)>0&&Q(d.j,d,d.next)>0;if(l=k.next.l!==d.l&&(e||V(k,d)&&V(d,k)&&(Q(k.j,\nk,d.j)!==0||Q(k,d.j,d)!==0))){b:{l=Math.min(k.x,d.x);m=Math.max(k.x,d.x);q=Math.min(k.y,d.y);v=Math.max(k.y,d.y);u=k;do{t=u.next;if(!(u.x>m&&t.x>m||u.x<l&&t.x<l||u.y>v&&t.y>v||u.y<q&&t.y<q)&&u.l!==k.l&&t.l!==k.l&&u.l!==d.l&&t.l!==d.l&&qa(u,t,k,d)){l=!0;break b}u=t}while(u!==k);l=!1}l=!l}if(l){if(!e){e=k;l=!1;m=(k.x+d.x)/2;q=(k.y+d.y)/2;do v=e.next,e.y>q!==v.y>q&&m<(v.x-e.x)*(q-e.y)/(v.y-e.y)+e.x&&(l=!l),e=v;while(e!==k);e=l}l=e}e=l}if(e){a=ka(k,d);k=E(k,k.next);a=E(a,a.next);la(k,b,c,g,f);la(a,b,\nc,g,f);break a}d=d.next}k=k.next}while(k!==a)}break}else{k=b;d=a;e=!1;do l=d.j,m=d.next.next,qa(l,d,d.next,m,!1)&&V(l,m)&&V(m,l)&&(k.push(l.l,d.l,m.l),P(d),P(d.next),d=a=m,e=!0),d=d.next;while(d!==a);k=a=e?E(d):d;d=!0}}}var ia=!1;function da(a,b){return a.x-b.x||a.y-b.y||(a.next.y-a.y)/(a.next.x-a.x)-(b.next.y-b.y)/(b.next.x-b.x)}var ea=16,D=new Float64Array(0),fa=0,ra=[],sa=[];\nfunction ha(a,b){do{var c=fa++;ra[c]=a;let g=a.x,f=a.y,d=a.x,e=a.y,k=0;do{let l=a.next;a.z=c;l.x<g&&(g=l.x);l.x>d&&(d=l.x);l.y<f&&(f=l.y);l.y>e&&(e=l.y);a=l}while(++k<ea&&a!==b);sa[c]=a;c*=4;D[c]=g;D[c+1]=f;D[c+2]=d;D[c+3]=e}while(a!==b)}function ta(a){for(var b=sa[a];b.j.next!==b;)b=b.next;return sa[a]=b}function ua(a){for(var b=ra[a];b.j.next!==b;)b=b.next;return ra[a]=b}\nfunction ja(a,b){var c=a.x,g=a.y,f=-Infinity;if(J(a,b))return b;for(let t=0,v=0;t<fa;t++,v+=4){if(g<D[v+1]||g>D[v+3]||D[v]>c||D[v+2]<=f)continue;var d=ta(t);b=ua(t);do{if(b.j.next===b){if(J(a,b.next))return b.next;if(g<=b.y&&g>=b.next.y&&b.next.y!==b.y){var e=b.x+(g-b.y)*(b.next.x-b.x)/(b.next.y-b.y);if(e<=c&&e>f){f=e;var k=b.x<b.next.x?b:b.next;if(e===c)return k}}}b=b.next}while(b!==d)}if(!k)return null;d=k.x;e=k.y;var l=Math.min(g,e),m=Math.max(g,e),q=Infinity;for(let t=0,v=0;t<fa;t++,v+=4){if(D[v+\n2]<d||D[v]>c||D[v+3]<l||D[v+1]>m)continue;let u=ta(t);b=ua(t);do{if(b.j.next===b&&c>=b.x&&b.x>=d&&c!==b.x&&pa(g<e?c:f,g,d,e,g<e?f:c,g,b.x,b.y)){let w=Math.abs(g-b.y)/(c-b.x);(V(b,a)||b.y===g&&b.next.y===g&&b.next.x>c)&&(w<q||w===q&&(b.x>k.x||b.x===k.x&&Q(k.j,k,b.j)<0&&Q(b.next,k,k.next)<0))&&(k=b,q=w)}b=b.next}while(b!==u)}return k}var R=[],U=[],S=new Uint32Array(0),T=new Uint32Array(0),W=new Uint32Array(256);\nfunction oa(a,b,c,g,f,d){W.fill(0);for(var e=0;e<a;e++)W[c[e]>>>d&255]++;e=0;for(var k=0;k<256;k++){var l=W[k];W[k]=e;e+=l}for(e=0;e<a;e++)k=c[e],l=W[k>>>d&255]++,g[l]=b[e],f[l]=k}function na(a,b,c,g,f){a=(a-c)*f|0;b=(b-g)*f|0;a=(a|a<<8)&16711935;a=(a|a<<4)&252645135;a=(a|a<<2)&858993459;b=(b|b<<8)&16711935;b=(b|b<<4)&252645135;b=(b|b<<2)&858993459;return(a|a<<1)&1431655765|((b|b<<1)&1431655765)<<1}\nfunction pa(a,b,c,g,f,d,e,k){return(f-e)*(b-k)>=(a-e)*(d-k)&&(a-e)*(g-k)>=(c-e)*(b-k)&&(c-e)*(d-k)>=(f-e)*(g-k)}function Q(a,b,c){return(b.y-a.y)*(c.x-b.x)-(b.x-a.x)*(c.y-b.y)}function J(a,b){return a.x===b.x&&a.y===b.y}function qa(a,b,c,g,f=!0){var d=Q(a,b,c),e=Q(a,b,g),k=Q(c,g,a),l=Q(c,g,b);return(d>0&&e<0||d<0&&e>0)&&(k>0&&l<0||k<0&&l>0)?!0:f?d===0&&va(a,c,b)||e===0&&va(a,g,b)||k===0&&va(c,a,g)||l===0&&va(c,b,g)?!0:!1:!1}\nfunction va(a,b,c){return b.x<=Math.max(a.x,c.x)&&b.x>=Math.min(a.x,c.x)&&b.y<=Math.max(a.y,c.y)&&b.y>=Math.min(a.y,c.y)}function V(a,b){return Q(a.j,a,a.next)<0?Q(a,b,a.next)>=0&&Q(a,a.j,b)>=0:Q(a,b,a.j)<0||Q(a,a.next,b)<0}function ka(a,b){var c=wa(a.l,a.x,a.y),g=wa(b.l,b.x,b.y),f=a.next,d=b.j;a.next=b;b.j=a;c.next=f;f.j=c;g.next=c;c.j=g;d.next=g;g.j=d;return g}function ma(a,b,c,g){a=wa(a,b,c);g?(a.next=g.next,a.j=g,g.next.j=a,g.next=a):(a.j=a,a.next=a);return a}\nfunction P(a){a.next.j=a.j;a.j.next=a.next;a.C&&(a.C.B=a.B);a.B&&(a.B.C=a.C);if(ia){var b=a.next;a=a.j.z*4;b.x<D[a]&&(D[a]=b.x);b.y<D[a+1]&&(D[a+1]=b.y);b.x>D[a+2]&&(D[a+2]=b.x);b.y>D[a+3]&&(D[a+3]=b.y)}}function wa(a,b,c){return{l:a,x:b,y:c,j:null,next:null,z:0,C:null,B:null}}\nfunction xa(a,b,c){var g=32,f=c.K.length*g,d=a.createBuffer({size:f,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),e=new Uint8Array(f);c.K.forEach((z,F)=>{F*=g;z=new Float32Array([...z.fillColor,z.opacity,...z.R,z.v]);e.set(new Uint8Array(z.buffer),F)});a.queue.writeBuffer(d,0,e);f=a.createBuffer({size:c.X.length*8,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});var k=new Uint32Array(c.X);a.queue.writeBuffer(f,0,k);k=a.createBuffer({size:c.T.length*4,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});\nvar l=new Uint32Array(c.T);a.queue.writeBuffer(k,0,l);l=a.createBuffer({size:c.O.length*4,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});var m=new Uint32Array(c.O);a.queue.writeBuffer(l,0,m);g=16;var q=c.W.length*g;m=a.createBuffer({size:q,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});var t=new Uint8Array(q);c.W.forEach((z,F)=>{F*=g;var K=new Uint32Array([z.J,z.H]);z=new Float32Array(z.I);t.set(new Uint8Array(K.buffer),F);t.set(new Uint8Array(z.buffer),F+8)});a.queue.writeBuffer(m,0,\nt);q=a.createBuffer({size:c.S.length*4,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});var v=new Uint32Array(c.S);a.queue.writeBuffer(q,0,v);v=a.createBuffer({size:c.Y.length*8,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});var u=new Uint32Array(c.Y);a.queue.writeBuffer(v,0,u);u=a.createBuffer({size:c.U.length*4,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});var w=new Uint32Array(c.U);a.queue.writeBuffer(u,0,w);return{Z:a.createBindGroup({layout:b,entries:[{binding:0,resource:{buffer:d}}]}),\nK:c.K,pa:d,ha:f,fa:k,ga:c.T.length,$:l,aa:c.O.length,ea:m,ca:q,da:c.S.length,la:v,ja:u,ka:c.U.length}}function X(a,b){this.x=a;this.y=b}function ya(a,b){a.x/=b;a.y/=b;return a}\nX.prototype={clone(){return new X(this.x,this.y)},add(a){var b=this.clone();b.x+=a.x;b.y+=a.y;return b},sub(a){var b=this.clone();b.x-=a.x;b.y-=a.y;return b},div(a){return ya(this.clone(),a)},rotate(a){var b=this.clone(),c=Math.cos(a);a=Math.sin(a);var g=a*b.x+c*b.y;b.x=c*b.x-a*b.y;b.y=g;return b},unit(){var a=this.clone();ya(a,Math.sqrt(a.x*a.x+a.y*a.y));return a},round(){var a=this.clone();a.x=Math.round(a.x);a.y=Math.round(a.y);return a},equals(a){return this.x===a.x&&this.y===a.y},angle(){return Math.atan2(this.y,\nthis.x)},constructor:X};function za(a){if(a.L<0)console.log("feature has no geometry");else{var b=a.D;b.i=a.L;a=Y(b)+b.i;for(var c=[],g,f=1,d=0,e=0,k=0;b.i<a;){if(d<=0&&(d=Y(b),f=d&7,d>>=3,d===0))continue;d--;if(f===1)e+=Aa(b),k+=Aa(b),g&&c.push(g),g=[new X(e,k)];else if(f===2)e+=Aa(b),k+=Aa(b),g&&g.push(new X(e,k));else if(f===7)g&&g.push(g[0].clone());else{console.log(`unknown command ${f}`);return}}g&&c.push(g);return c}}\nvar Ca=class{constructor(a,b,c,g,f){this.ia=Object.create(null);this.P=c;this.type=0;this.id=void 0;this.D=a;this.L=-1;this.M=g;for(this.N=f;a.i<b;)if(c=Y(a),c===8)this.id=Y(a);else if(c===18)for(c=Y(a)+a.i;a.i<c;){let d=g[Y(a)],e=f[Y(a)];this.ia[d]=e}else c===24?this.type=Y(a):(c===34&&(this.L=a.i),Ba(a,c))}};function Da(a,b){if(b<0||b>=a.G.length)console.log("feature index out of bounds");else return a.D.i=a.G[b],b=Y(a.D)+a.D.i,new Ca(a.D,b,a.P,a.M,a.N)}\nvar Ga=class{constructor(a,b){this.version=1;this.name="";this.P=4096;this.length=0;this.D=a;this.M=[];this.N=[];this.G=[];b===void 0&&(b=a.length);for(;a.i<b;){var c=Y(a);if(c===10)this.name=Ea(a);else if(c===18)this.G.push(a.i),Ba(a,c);else if(c===26)this.M.push(Ea(a));else if(c===34){c=this.N;var g=c.push;{var f=a;var d=null;let e=Y(f)+f.i;for(;f.i<e;)d=Y(f),d===10?d=Ea(f):d===21?(d=Fa(f.A,f.i,23,4),f.i+=4):d===25?(d=Fa(f.A,f.i,52,8),f.i+=8):d=d===32?Y(f,!0):d===40?Y(f):d===48?Aa(f):d===56?!!Y(f):\n(Ba(f,d),null);d==null?(console.log("unknown feature value"),f=void 0):f=d}g.call(c,f)}else c===40?this.P=Y(a):c===120?this.version=Y(a):Ba(a,c)}this.length=this.G.length}},Ha=class{constructor(a,b=a.length){for(var c=Object.create(null);a.i<b;){var g=Y(a);g===26?(g=new Ga(a,Y(a)+a.i),g.length&&(c[g.name]=g)):Ba(a,g)}this.ba=c}},Fa=(a,b,c,g)=>{var f=g*8-c-1;var d=(1<<f)-1,e=d>>1,k=-7,l=g-1,m=a[b+l];l+=-1;g=m&(1<<-k)-1;m>>=-k;for(k+=f;k>0;g=g*256+a[b+l],l+=-1,k-=8);f=g&(1<<-k)-1;g>>=-k;for(k+=c;k>\n0;f=f*256+a[b+l],l+=-1,k-=8);if(g===0)g=1-e;else{if(g===d)return f?NaN:(m?-1:1)*Infinity;f+=Math.pow(2,c);g-=e}return(m?-1:1)*f*Math.pow(2,g-c)};function Ia(a){this.A=ArrayBuffer.isView&&ArrayBuffer.isView(a)?a:new Uint8Array(a||0);this.type=this.i=0;this.length=this.A.length}\nfunction Y(a,b){var c=a.A;var g=c[a.i++];var f=g&127;if(g<128)return f;g=c[a.i++];f|=(g&127)<<7;if(g<128)return f;g=c[a.i++];f|=(g&127)<<14;if(g<128)return f;g=c[a.i++];f|=(g&127)<<21;if(g<128)return f;g=c[a.i];return Ja(f|(g&15)<<28,b,a)}function Ba(a,b){b&=7;if(b===0)for(;a.A[a.i++]>127;);else b===2?a.i=Y(a)+a.i:b===5?a.i+=4:b===1?a.i+=8:console.log("Unimplemented type: "+b)}function Aa(a){a=Y(a);return a%2===1?(a+1)/-2:a/2}\nfunction Ea(a){var b=Y(a)+a.i;var c=a.A;for(var g="",f=a.i;f<b;){var d=c[f],e=null,k=d>239?4:d>223?3:d>191?2:1;if(f+k>b)break;if(k===1)d<128&&(e=d);else if(k===2){var l=c[f+1];(l&192)===128&&(e=(d&31)<<6|l&63,e<=127&&(e=null))}else if(k===3){l=c[f+1];var m=c[f+2];(l&192)===128&&(m&192)===128&&(e=(d&15)<<12|(l&63)<<6|m&63,e<=2047||e>=55296&&e<=57343)&&(e=null)}else if(k===4){l=c[f+1];m=c[f+2];var q=c[f+3];(l&192)===128&&(m&192)===128&&(q&192)===128&&(e=(d&15)<<18|(l&63)<<12|(m&63)<<6|q&63,e<=65535||\ne>=1114112)&&(e=null)}e===null?(e=65533,k=1):e>65535&&(e-=65536,g+=String.fromCharCode(e>>>10&1023|55296),e=56320|e&1023);g+=String.fromCharCode(e);f+=k}c=g;a.i=b;return c}Ia.prototype={destroy:function(){this.A=null}};\nvar Ja=(a,b,c)=>{var g=c.A;var f=g[c.i++];var d=(f&112)>>4;if(f<128)return Z(a,d,b);f=g[c.i++];d|=(f&127)<<3;if(f<128)return Z(a,d,b);f=g[c.i++];d|=(f&127)<<10;if(f<128)return Z(a,d,b);f=g[c.i++];d|=(f&127)<<17;if(f<128)return Z(a,d,b);f=g[c.i++];d|=(f&127)<<24;if(f<128)return Z(a,d,b);f=g[c.i++];d|=(f&1)<<31;if(f<128)return Z(a,d,b);console.log("Expected varint not more than 10 bytes")},Z=(a,b,c)=>c?b*4294967296+(a>>>0):(b>>>0)*4294967296+(a>>>0),Ka=[{m:"l",o:"t",u:[.59,.59,.59],v:[[.98304,10],[7.86432,\n100]],F:[[.98304,.1],[7.86432,1]]},{m:"f",o:"b",u:[.94,.96,.94],v:1},{m:"l",o:"r1",u:[.39,.39,.39],v:1,F:[[16,0],[18,1]]},{m:"l",o:"r2",u:[.77,.63,0],v:1},{m:"f",o:"r5",u:[1,1,1]},{m:"f",o:"r3",u:[1,.77,.6]},{m:"l",o:"r8",u:[1,.77,.6],v:[[10,5],[13,10]]},{m:"f",o:"r4",u:[.93,.86,.58]},{m:"l",o:"r9",u:[.93,.86,.58],v:[[10,5],[13,10],[16,30]]},{m:"l",o:"r6",u:[.39,.39,.39],v:2,na:[20,20]},{m:"f",o:"w",u:[.66,.86,1]},{m:"f",o:"g",u:[.8,.93,.66]},{m:"p",o:"c",u:[.4,.4,.4],V:14,oa:10},{m:"p",o:"rt",V:12,\nma:{border:"1px solid #fff","border-radius":"4px 4px 50% 50%",background:"#06a",padding:"5px",color:"#fff"}},{m:"p",o:"d",u:[.4,.4,.4],V:12,F:[[13,0],[14,1]]},{m:"s",o:"p"}],La=async()=>{function a(p){var n=0;for(let r=0;r<p.length;r++){let x=p[r],B=p[(r+1)%p.length];n+=(B[0]-x[0])*(B[1]+x[1])}return n<0}function b(p,n){var r=n.v||0;if(n.m=="f"){var x=n.u;n=n.Opacity||1;for(var B=[.3,.3,.3],A=0;A<p.length;A++){var G=Da(p,A);if(G.type!==3)continue;var I=za(G);G=[];for(var y of I){if(y.length===0)continue;\nI=y.map(H=>[H.x,H.y]);a(I)?(G.length>0&&g(G,x,B,r,n),G=[I]):G.push(I)}G.length>0&&g(G,x,B,r,n)}}else for(B=n.u,n=n.Opacity||1,A=0;A<p.length;A++){y=Da(p,A);if(y.type!==2)continue;y=za(y);for(x of y){if(x.length===0)continue;y=x.map(H=>[H.x,H.y]);r!=1?f(y,B,r,n):c(y,B,n)}}}function c(p,n,r){for(let x=0;x<p.length;x++){let B=p[x];u.push((B[1]&65535)<<16|B[0]&65535,d.length);x<p.length-1&&w.push(z+x,z+x+1)}z+=p.length;d.push({fillColor:[1,1,1],R:n,opacity:r,v:1})}function g(p,n,r,x,B){var A=[],G=[],\nI=0;for(let y=0;y<p.length;y++){let H=p[y];if(H.length){y>0&&G.push(I);for(let M=0;M<H.length;M++){let O=H[M];A.push(O[0],O[1]);e.push((O[1]&65535)<<16|O[0]&65535,d.length);I++;x>0&&m.push(q+M,q+(M+1==H.length?0:M+1))}q+=H.length}}p=ba(A,G);p.length&&(p.forEach(y=>{l.push(k+y)}),d.push({fillColor:n,R:r,opacity:B,v:x}),k+=I)}function f(p,n,r,x){var B=p.length;if(!(B<2)){for(let G=0;G<B-1;G++){var A=p[G];let I=p[G+1],y=t.length,H=d.length,M=(A[1]&65535)<<16|A[0]&65535,O=I[0]-A[0];A=-I[1]+A[1];t.push({J:M,\nH,I:[A,-O]});t.push({J:M,H,I:[-A,O]});M=(I[1]&65535)<<16|I[0]&65535;t.push({J:M,H,I:[-A,O]});t.push({J:M,H,I:[A,-O]});v.push(y,y+1,y+2,y+2,y+3,y);G>0&&v.push(y,y-1,y+1,y+1,y-2,y)}d.push({fillColor:[1,1,1],R:n,opacity:x,v:r})}}var d=[],e=[],k=0,l=[],m=[],q=0,t=[],v=[],u=[],w=[],z=0,F=await fetch("https://sasepo.com/t/"+[15,28191,13180].join("/"));F=await new Ia(await F.arrayBuffer());F=(new Ha(F)).ba;for(var K=Ka.length;K--;){var L=Ka[K],N=F[L.o];N&&L.m!="p"&&L.m!="s"&&b(N,L)}return{K:d,X:e,T:l,O:m,\nW:t,S:v,Y:u,U:w}};self.onmessage=async a=>{if(a.data.c){let b=new Float32Array(a.data.b);Ma(a.data.c,a.data.s,b)}};\nasync function Ma(a,b,c){function g(){d.queue.writeBuffer(z,0,(new Float32Array([c[0],c[1],c[2],Math.pow(2,c[2])*3E-5])).buffer,0,16)}function f(){requestAnimationFrame(f);if(c[3]){g();var p=d.createCommandEncoder(),n=p.beginRenderPass({colorAttachments:[{view:L.createView(),resolveTarget:k.getCurrentTexture().createView(),clearValue:{r:.96,g:.97,b:.98,a:1},loadOp:"clear",storeOp:"discard"}],depthStencilAttachment:{view:N.createView(),depthClearValue:0,depthLoadOp:"clear",depthStoreOp:"store"}});\nn.setBindGroup(0,F);for(let r of K)n.setBindGroup(1,r.Z),n.setVertexBuffer(0,r.ha),n.setPipeline(q),n.setIndexBuffer(r.fa,"uint32"),n.drawIndexed(r.ga,1,0,0,0),n.setPipeline(t),n.setIndexBuffer(r.$,"uint32"),n.drawIndexed(r.aa,1,0,0,0),n.setVertexBuffer(0,r.ea),n.setPipeline(v),n.setIndexBuffer(r.ca,"uint32"),n.drawIndexed(r.da,1,0,0,0),n.setVertexBuffer(0,r.la),n.setPipeline(t),n.setIndexBuffer(r.ja,"uint32"),n.drawIndexed(r.ka,1,0,0,0);n.end();d.queue.submit([p.finish()]);c[3]=0}}var d=await (await navigator.gpu?.requestAdapter())?.requestDevice();\nif(d){d.pushErrorScope("validation");var e=await d.popErrorScope();e&&console.error("WebGPU \\u30d0\\u30ea\\u30c7\\u30fc\\u30b7\\u30e7\\u30f3\\u30a8\\u30e9\\u30fc:",e.message);d.lost.then(p=>{console.error(`WebGPU \\u30C7\\u30D0\\u30A4\\u30B9\\u304C\\u55AA\\u5931\\u3057\\u307E\\u3057\\u305F\\u3002\\u7406\\u7531: ${p.reason}`);console.error(`\\u30E1\\u30C3\\u30BB\\u30FC\\u30B8: ${p.message}`);p.reason==="destroyed"?console.log("\\u30c7\\u30d0\\u30a4\\u30b9\\u306f\\u610f\\u56f3\\u7684\\u306b\\u7834\\u68c4\\u3055\\u308c\\u307e\\u3057\\u305f\\u3002"):\nconsole.log("\\u30c7\\u30d0\\u30a4\\u30b9\\u3092\\u518d\\u521d\\u671f\\u5316\\u3057\\u307e\\u3059...")});var k=a.getContext("webgpu");a.width=b[0];a.height=b[1];var l=navigator.gpu.getPreferredCanvasFormat();k.configure({device:d,format:l,alphaMode:"premultiplied"});e=d.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX,texture:{sampleType:"float",viewDimension:"2d"}},{binding:2,visibility:GPUShaderStage.VERTEX,\nsampler:{type:"filtering"}}]});b=d.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]});var m=d.createShaderModule({code:"struct PrimitiveVertex{@location(0)packed_pos:u32,@location(1)feature_id:u32,}struct PolylineVertex{@location(0)packed_pos:u32,@location(1)feature_id:u32,@location(2)normal:vec2f,}struct Property{fillColor:vec3f,opacity:f32,lineColor:vec3f,thickness:f32,}struct Uniforms{u_offset:vec2f,u_zoom:f32,u_scale:f32,u_res_x:f32,u_res_y:f32,}@group(0)@binding(0)var<uniform> uniforms:Uniforms;@group(0)@binding(1)var zoom_texture_2d:texture_2d<f32>;@group(0)@binding(2)var linear_sampler:sampler;@group(1)@binding(0)var<storage,read>properties:array<Property>;struct VertexOutput{@builtin(position)position:vec4f,@location(0)color:vec4f,}fn unpack_sint16x2(packed:u32)->vec2f{let x=(i32(packed&0xFFFFu)<<16)>>16;let y=i32(packed)>>16;return vec2f(f32(x),f32(y));}fn raw_to_ndc(packed_val:u32)->vec2f{let decoded_pos=unpack_sint16x2(packed_val);let normalized_x=decoded_pos.x/4096.0;let normalized_y=1.0-(decoded_pos.y/4096.0);return vec2f(normalized_x,normalized_y)*2.0-1.0;}fn sheer(color:vec3f,opacity:f32)->vec4f{return vec4f(color,1.0);}@vertex fn vs_polygon(input:PrimitiveVertex)->VertexOutput{var output:VertexOutput;let prop=properties[input.feature_id];let ndc_pos=raw_to_ndc(input.packed_pos);let cam_pos=(ndc_pos-uniforms.u_offset)*uniforms.u_scale;var z=f32(input.feature_id+1u)*1e-6;output.position=vec4f(cam_pos,z,1.0);output.color=sheer(prop.fillColor,prop.opacity);return output;}@vertex fn vs_thinline(input:PrimitiveVertex)->VertexOutput{var output:VertexOutput;let prop=properties[input.feature_id];let ndc_pos=raw_to_ndc(input.packed_pos);let cam_pos=(ndc_pos-uniforms.u_offset)*uniforms.u_scale;var z=f32(input.feature_id+1u)*1e-6+1e-7;output.position=vec4f(cam_pos,z,1.0);output.color=sheer(prop.lineColor,prop.opacity);return output;}@vertex fn vs_polyline(input:PolylineVertex,)->VertexOutput{var output:VertexOutput;let ndc_pos=raw_to_ndc(input.packed_pos);let prop=properties[input.feature_id];let cam_pos=(ndc_pos-uniforms.u_offset)*uniforms.u_scale;var thickness=prop.thickness;if(thickness<0){let v_coord=(-thickness-0.5)/4.0;let uv=vec2f(uniforms.u_scale,v_coord);let sampled_data=textureSampleLevel(zoom_texture_2d,linear_sampler,uv,0.0);thickness=sampled_data.r;}let aspect=uniforms.u_res_x/uniforms.u_res_y;let normal=normalize(vec2f(input.normal.x*aspect,input.normal.y));let thickness_ndc=thickness/uniforms.u_res_x;let offset=vec2f(normal.x*thickness_ndc*0.5/aspect,normal.y*thickness_ndc*0.5);let final_pos=cam_pos+offset;var z=f32(input.feature_id+1u)*1e-6;output.position=vec4f(final_pos,z,1.0);output.color=sheer(prop.lineColor,prop.opacity);return output;}@fragment fn fs_main(input:VertexOutput)->@location(0)vec4f{return input.color;}"}),\nq=d.createRenderPipeline({layout:d.createPipelineLayout({bindGroupLayouts:[e,b]}),vertex:{module:m,entryPoint:"vs_polygon",buffers:[{arrayStride:8,stepMode:"vertex",attributes:[{shaderLocation:0,offset:0,format:"uint32"},{shaderLocation:1,offset:4,format:"uint32"}]}]},fragment:{module:m,entryPoint:"fs_main",targets:[{format:l}]},primitive:{topology:"triangle-list"},depthStencil:{format:"depth24plus",depthWriteEnabled:!0,depthCompare:"greater"},multisample:{count:4}}),t=d.createRenderPipeline({layout:d.createPipelineLayout({bindGroupLayouts:[e,\nb]}),vertex:{module:m,entryPoint:"vs_thinline",buffers:[{arrayStride:8,stepMode:"vertex",attributes:[{shaderLocation:0,offset:0,format:"uint32"},{shaderLocation:1,offset:4,format:"uint32"}]}]},fragment:{module:m,entryPoint:"fs_main",targets:[{format:l}]},primitive:{topology:"line-list"},depthStencil:{format:"depth24plus",depthWriteEnabled:!1,depthCompare:"greater-equal"},multisample:{count:4}}),v=d.createRenderPipeline({layout:d.createPipelineLayout({bindGroupLayouts:[e,b]}),vertex:{module:m,entryPoint:"vs_polyline",\nbuffers:[{arrayStride:16,stepMode:"vertex",attributes:[{shaderLocation:0,offset:0,format:"uint32"},{shaderLocation:1,offset:4,format:"uint32"},{shaderLocation:2,offset:8,format:"float32x2"}]}]},fragment:{module:m,entryPoint:"fs_main",targets:[{format:l}]},primitive:{topology:"triangle-list"},depthStencil:{format:"depth24plus",depthWriteEnabled:!0,depthCompare:"greater"},multisample:{count:4}});l=await m.getCompilationInfo();for(var u of l.messages)console.error(`WGSL Error: ${u.message} at line ${u.lineNum}`);\nu=(p,n)=>{if(p<=n[0][0])return n[0][1];if(p>=n[n.length-1][0])return n[n.length-1][1];for(let r=0;r<n.length-1;r++){let x=n[r],B=n[r+1];if(p>=x[0]&&p<=B[0])return x[1]+(p-x[0])/(B[0]-x[0])*(B[1]-x[1])}return n[0][1]};l=[];m=[];for(var w of Ka)Array.isArray(w.v)&&(l.push(w.v),w.v=-l.length),Array.isArray(w.F)&&(m.push(w.F),w.F=-m.length);w=new Float16Array(512);for(let p=0;p<4;p++){let n=l[p],r=m[p];if(!n&&!r)break;for(let x=0;x<32;x++){let B=Math.pow(2,10+x/31*10)*3E-5,A=(p*32+x)*4;w[A+0]=n?u(B,n):\n1;w[A+1]=r?u(B,r):1;w[A+2]=0;w[A+3]=1}}console.log("textureData",w);u=d.createTexture({size:[32,4,1],dimension:"2d",format:"rgba16float",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});d.queue.writeTexture({texture:u},w,{bytesPerRow:256},[32,4,1]);l=d.createSampler({magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge"});var z=d.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),F=d.createBindGroup({layout:e,entries:[{binding:0,resource:{buffer:z}},\n{binding:1,resource:u.createView()},{binding:2,resource:l}]});e=await La();console.log("tileData",e);var K=[xa(d,b,e)];console.log("tiles",K);g();d.queue.writeBuffer(z,16,new Float32Array([a.width,a.height]));var L=d.createTexture({size:[a.width,a.height],sampleCount:4,format:navigator.gpu.getPreferredCanvasFormat(),usage:GPUTextureUsage.RENDER_ATTACHMENT}),N=d.createTexture({size:[a.width,a.height],sampleCount:4,format:"depth24plus",usage:GPUTextureUsage.RENDER_ATTACHMENT});f()}else self.postMessage({type:"error",\nmessage:"WebGPU \\u3092\\u30b5\\u30dd\\u30fc\\u30c8\\u3057\\u3066\\u3044\\u306a\\u3044\\u30d6\\u30e9\\u30a6\\u30b6\\u3001\\u307e\\u305f\\u306f\\u74b0\\u5883\\u3067\\u3059\\u3002"})};//# sourceMappingURL=/worker.map\n'], { type: "application/javascript" });
var workerUrl = URL.createObjectURL(blob);
var worker = new Worker(workerUrl);
worker.postMessage({ "c": offcanvas, "s": [800, 800], "b": sab }, [offcanvas]);
console.log("test build");
mouseevents_default(viewArray);
