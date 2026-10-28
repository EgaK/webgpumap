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
  const devicePixelRatio = window.devicePixelRatio || 1;
  canvas2.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const rect = canvas2.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) / rect.width * 2 - 1;
      const mouseY = -((e.clientY - rect.top) / rect.height * 2 - 1);
      const zoomFactor = 1.1;
      const oldZoom = viewArray2[2];
      if (e.deltaY < 0) {
        viewArray2[2] *= zoomFactor;
      } else {
        viewArray2[2] /= zoomFactor;
      }
      viewArray2[2] = Math.max(0.1, Math.min(viewArray2[2], 100));
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

// src/js/index.js
var sab = new SharedArrayBuffer(16);
var viewArray = new Float32Array(sab);
viewArray[0] = 0;
viewArray[1] = 0;
viewArray[2] = 1;
viewArray[3] = 1;
var canvas = tiny_default("canvas");
canvas[0].width = 800;
canvas[0].height = 800;
canvas.css({ width: "400px", height: "400px" });
var offcanvas = canvas[0].transferControlToOffscreen();
var worker = new Worker("/js/worker.js");
worker.postMessage({ "c": offcanvas, "s": [800, 800], "b": sab }, [offcanvas]);
mouseevents_default(viewArray);
