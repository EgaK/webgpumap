// src/js/shader.wgsl
var shader_default = `struct PrimitiveVertex{@location(0)pos:vec2i,@location(1)feature_id:i32,}struct PolylineVertex{@location(0)pos:vec2i,@location(1)feature_id:i32,@location(2)pad:u32,@location(3)normal:vec2f,}struct Property{fillColor:vec3f,opacity:f32,lineColor:vec3f,thickness:f32,}struct Style{min_zoom:f32,min_val:f32,max_zoom:f32,max_val:f32,};struct Uniforms{u_mvp_matrix:mat4x4<f32>,u_offset:vec2<f32>,u_zoom:f32,u_scale:f32,u_res_x:f32,u_res_y:f32,u_tile_z:u32,u_tile_x:u32,u_tile_y:u32,u_tile_extent:f32,u_tile_opacity:f32,pad0:f32,pad1:f32,pad2:f32,pad3:f32,pad4:f32,styles:array<Style,8>,};@group(0)@binding(0)var<uniform> uniforms:Uniforms;@group(1)@binding(0)var<storage,read>properties:array<Property>;struct VertexOutput{@builtin(position)position:vec4f,@location(0)color:vec4f,@location(1)normal:vec2f,@location(2)pos:vec2f,}fn raw_to_ndc(pos:vec2i)->vec2f{let normalized_x=f32(pos.x)/4096.0;let normalized_y=1.0-(f32(pos.y)/4096.0);return vec2f(normalized_x,normalized_y)*2.0-1.0;}fn sheer(color:vec3f,o:f32)->vec4f{var opacity=o;if(opacity<0){let style=uniforms.styles[u32(-opacity-1)];let t=clamp((uniforms.u_zoom-style.min_zoom)/(style.max_zoom-style.min_zoom),0.0,1.0);opacity=mix(style.min_val,style.max_val,t);}return vec4f(color,opacity);}@vertex fn vs_polygon(input:PrimitiveVertex)->VertexOutput{var output:VertexOutput;let prop=properties[input.feature_id];let ndc_pos=raw_to_ndc(input.pos);let cam_pos=(ndc_pos-uniforms.u_offset)*uniforms.u_scale;var z=f32(input.feature_id+1)*1e-6;output.position=vec4f(cam_pos,z,1.0);output.color=sheer(prop.fillColor,prop.opacity);return output;}@vertex fn vs_thinline(input:PrimitiveVertex)->VertexOutput{var output:VertexOutput;let prop=properties[input.feature_id];let ndc_pos=raw_to_ndc(input.pos);let cam_pos=(ndc_pos-uniforms.u_offset)*uniforms.u_scale;var z=f32(input.feature_id+1)*1e-6+1e-7;output.position=vec4f(cam_pos,z,1.0);output.color=sheer(prop.lineColor,prop.opacity);return output;}@vertex fn vs_polyline(input:PolylineVertex,)->VertexOutput{var output:VertexOutput;let ndc_pos=raw_to_ndc(input.pos);let prop=properties[input.feature_id];let cam_pos=(ndc_pos-uniforms.u_offset)*uniforms.u_scale;var thickness=prop.thickness;if(thickness==-1){output.pos=cam_pos;}else{output.pos=vec2f(0,0);}if(thickness<0){let style=uniforms.styles[u32(-thickness-1)];let t=clamp((uniforms.u_zoom-style.min_zoom)/(style.max_zoom-style.min_zoom),0.0,1.0);thickness=mix(style.min_val,style.max_val,t);}let aspect=uniforms.u_res_x/uniforms.u_res_y;let normal=normalize(vec2f(input.normal.x*aspect,input.normal.y));let thickness_ndc=thickness/uniforms.u_res_x;let offset=vec2f(normal.x*thickness_ndc*0.5/aspect,normal.y*thickness_ndc*0.5);let final_pos=cam_pos+offset;var z=f32(input.feature_id+1)*1e-6;output.position=vec4f(final_pos,z,1.0);output.color=sheer(prop.lineColor,prop.opacity);output.normal=normal;return output;}@fragment fn fs_main(input:VertexOutput)->@location(0)vec4f{return input.color;}@fragment fn fs_polyline(input:VertexOutput)->@location(0)vec4f{if(length(input.pos)>0&&length(input.normal)<0.5&&((input.pos.y+1)*20)% 2>0.5){discard;}return input.color;}`;

// src/js/onCreateTile.js
function onCreateTile(device, tileBindGroupLayout, tileData) {
  let STRIDE = 32;
  const propertyBufferSize = tileData.propStructs.length * STRIDE;
  const propertyBuffer = device.createBuffer({
    size: propertyBufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  });
  const propertyData = new Uint8Array(propertyBufferSize);
  tileData.propStructs.forEach((cmd, i) => {
    const offset = i * STRIDE;
    const buf1 = new Float32Array([
      ...cmd.fillColor,
      cmd.opacity,
      ...cmd.lineColor,
      cmd.thickness
    ]);
    propertyData.set(new Uint8Array(buf1.buffer), offset);
  });
  device.queue.writeBuffer(propertyBuffer, 0, propertyData);
  const polygonVertexBuffer = device.createBuffer({
    size: tileData.polygonVertex.length * 16,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
  });
  const polygonVertexData = new Int32Array(tileData.polygonVertex);
  device.queue.writeBuffer(polygonVertexBuffer, 0, polygonVertexData);
  const polygonIndexBuffer = device.createBuffer({
    size: tileData.polygonIndex.length * 4,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
  });
  const polygonIndexData = new Uint32Array(tileData.polygonIndex);
  device.queue.writeBuffer(polygonIndexBuffer, 0, polygonIndexData);
  const borderIndexBuffer = device.createBuffer({
    size: tileData.borderIndex.length * 4,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
  });
  const borderIndexData = new Uint32Array(tileData.borderIndex);
  device.queue.writeBuffer(borderIndexBuffer, 0, borderIndexData);
  STRIDE = 32;
  const lineVertexBufferSize = tileData.lineVertex.length * STRIDE;
  const lineVertexBuffer = device.createBuffer({
    size: lineVertexBufferSize,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
  });
  const lineVertexData = new Uint8Array(lineVertexBufferSize);
  tileData.lineVertex.forEach((vtx, i) => {
    const offset = i * STRIDE;
    const buf1 = new Int32Array([...vtx.pos, vtx.featureID]);
    const buf2 = new Float32Array(vtx.normal);
    lineVertexData.set(new Uint8Array(buf1.buffer), offset);
    lineVertexData.set(new Uint8Array(buf2.buffer), offset + 16);
  });
  device.queue.writeBuffer(lineVertexBuffer, 0, lineVertexData);
  const lineIndexBuffer = device.createBuffer({
    size: tileData.lineIndex.length * 4,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
  });
  const lineIndexData = new Uint32Array(tileData.lineIndex);
  device.queue.writeBuffer(lineIndexBuffer, 0, lineIndexData);
  const thinVertexBuffer = device.createBuffer({
    size: tileData.thinVertex.length * 16,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
  });
  const thinVertexData = new Int32Array(tileData.thinVertex);
  device.queue.writeBuffer(thinVertexBuffer, 0, thinVertexData);
  const thinIndexBuffer = device.createBuffer({
    size: tileData.thinIndex.length * 4,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
  });
  const thinIndexData = new Uint32Array(tileData.thinIndex);
  device.queue.writeBuffer(thinIndexBuffer, 0, thinIndexData);
  const bindGroup = device.createBindGroup({
    layout: tileBindGroupLayout,
    // グループ1の設計図を指定
    entries: [
      { binding: 0, resource: { buffer: propertyBuffer } }
      // タイル個別のバッファを紐付け
    ]
  });
  return {
    bindGroup,
    propStructs: tileData.propStructs,
    propertyBuffer,
    polygonVertexBuffer,
    polygonIndexBuffer,
    polygonIndexCount: tileData.polygonIndex.length,
    borderIndexBuffer,
    borderIndexCount: tileData.borderIndex.length,
    lineVertexBuffer,
    lineIndexBuffer,
    lineIndexCount: tileData.lineIndex.length,
    thinVertexBuffer,
    thinIndexBuffer,
    thinIndexCount: tileData.thinIndex.length
  };
}

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
    return {
      lines,
      properties: this.properties
    };
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
    const area2 = signedArea(rings[i]);
    if (area2 === 0) continue;
    if (ccw === void 0) ccw = area2 < 0;
    if (ccw === area2 < 0) {
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
var VectorTileLayer = class {
  /**
   * @param {PbfReader} pbf
   * @param {number} [end]
   */
  constructor(pbf, end) {
    this.version = 1;
    this.name = "";
    this.extent = 4096;
    this.length = 0;
    this._pbf = pbf;
    this._keys = [];
    this._values = [];
    this._features = [];
    if (end === void 0) end = pbf.length;
    while (pbf.pos < end) {
      const tag = pbf.readVarint();
      if (tag === 10) this.name = pbf.readString();
      else if (tag === 18) {
        this._features.push(pbf.pos);
        pbf.skip(tag);
      } else if (tag === 26) this._keys.push(pbf.readString());
      else if (tag === 34) this._values.push(readValueMessage(pbf));
      else if (tag === 40) this.extent = pbf.readVarint();
      else if (tag === 120) this.version = pbf.readVarint();
      else pbf.skip(tag);
    }
    this.length = this._features.length;
  }
  /** return feature `i` from this layer as a `VectorTileFeature`
   * @param {number} i
   */
  feature(i) {
    if (i < 0 || i >= this._features.length) {
      console.log("feature index out of bounds");
      return;
    }
    this._pbf.pos = this._features[i];
    const end = this._pbf.readVarint() + this._pbf.pos;
    return new VectorTileFeature(
      this._pbf,
      end,
      this.extent,
      this._keys,
      this._values
    );
  }
};
function readValueMessage(pbf) {
  let value = null;
  const end = pbf.readVarint() + pbf.pos;
  while (pbf.pos < end) {
    const tag = pbf.readVarint();
    value = tag === 10 ? pbf.readString() : tag === 21 ? pbf.readFloat() : tag === 25 ? pbf.readDouble() : tag === 32 ? pbf.readVarint(true) : tag === 40 ? pbf.readVarint() : tag === 48 ? pbf.readSVarint() : tag === 56 ? pbf.readBoolean() : (pbf.skip(tag), null);
  }
  if (value == null) {
    console.log("unknown feature value");
    return;
  }
  return value;
}
var VectorTile = class {
  /**
   * @param {PbfReader} pbf
   * @param {number} [end]
   */
  constructor(pbf, end = pbf.length) {
    const layers = /* @__PURE__ */ Object.create(null);
    while (pbf.pos < end) {
      const tag = pbf.readVarint();
      if (tag === 26) {
        const layer = new VectorTileLayer(pbf, pbf.readVarint() + pbf.pos);
        if (layer.length) layers[layer.name] = layer;
      } else pbf.skip(tag);
    }
    this.layers = layers;
  }
};

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
  if (clockwise === signedArea2(data, start, end, dim) > 0) {
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
function signedArea2(data, start, end, dim) {
  let sum = 0;
  for (let i = start, j = end - dim; i < end; i += dim) {
    sum += (data[j] - data[i]) * (data[i + 1] + data[j + 1]);
    j = i;
  }
  return sum;
}

// src/js/util/message.js
var message_default = (...args) => {
  const obj = {};
  for (var i = 0; i < args.length; i += 2) {
    obj[args[i]] = args[i + 1];
  }
  self.postMessage(obj);
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
      [15, 20],
      [18, 50]
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
    thickness: 1,
    OPacity: [
      [14, 0],
      [17, 1]
    ]
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

// src/js/loadTile.js
var loadTile_default = async (zxy) => {
  let propStructs = [];
  let polygonVertex = [];
  let polygonVertexBase = 0;
  let polygonIndex = [];
  let borderIndex = [];
  let borderIndexBase = 0;
  let lineVertex = [];
  let lineIndex = [];
  let thinVertex = [];
  let thinIndex = [];
  let thinIndexBase = 0;
  var d = await fetch("https://192.168.11.2/t/" + zxy.join("/"));
  d = await new Pbf(await d.arrayBuffer());
  var layers = new VectorTile(d).layers;
  for (var n = style_default.length; n--; ) {
    var styleProp = style_default[n];
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
    propStructs,
    polygonVertex,
    polygonIndex,
    borderIndex,
    lineVertex,
    lineIndex,
    thinVertex,
    thinIndex
  };
  function makeFeatures(layer2, prop, zxy2) {
    const f = [];
    for (var i = 0; i < layer2.length; i++) {
      const feature = layer2.feature(i);
      const geometry = feature.loadGeometry();
      const cat = geometry.properties["c"];
      let desc = geometry.properties["t"];
      if (cat == "bs" && desc) {
        desc = desc.replace("S", "\u897F\u80A5\u30D0\u30B9").replace("W", "\u662D\u548C\u30D0\u30B9");
      }
      f.push({
        "p": geometry.lines[0][0],
        "t": feature.properties["n"],
        "d": desc,
        "c": cat
      });
    }
    message_default("d", {
      "f": f,
      "p": {
        "type": prop.Type,
        "layer": prop.Layer,
        "color": prop.Color,
        "size": prop.Size,
        "opacity": prop.OPacity,
        "css": prop.Css
      },
      "z": zxy2
    });
  }
  function isClockwise(ring) {
    let sum = 0;
    for (let i = 0; i < ring.length; i++) {
      const p1 = ring[i];
      const p2 = ring[(i + 1) % ring.length];
      sum += (p2[0] - p1[0]) * (p2[1] + p1[1]);
    }
    return sum < 0;
  }
  function processMVTLayer(layer2, prop) {
    var strokeThickness = prop.thickness || 0;
    if (prop.Type == "f") {
      var fillColor = prop.Color;
      var opacity = prop.OPacity || 1;
      var strokeColor = [0.3, 0.3, 0.3];
      for (var i = 0; i < layer2.length; i++) {
        const feature = layer2.feature(i);
        if (feature.type !== 3) continue;
        const geometry = feature.loadGeometry().lines;
        let currentPolygonRings = [];
        for (const ring of geometry) {
          if (ring.length === 0) continue;
          const formattedRing = ring.map((p) => [p.x, p.y]);
          if (isClockwise(formattedRing)) {
            if (currentPolygonRings.length > 0) {
              addPolygon(
                currentPolygonRings,
                fillColor,
                strokeColor,
                strokeThickness,
                opacity
              );
            }
            currentPolygonRings = [formattedRing];
          } else {
            currentPolygonRings.push(formattedRing);
          }
        }
        if (currentPolygonRings.length > 0) {
          addPolygon(
            currentPolygonRings,
            fillColor,
            strokeColor,
            strokeThickness,
            opacity
          );
        }
      }
    } else {
      var strokeColor = prop.Color;
      var opacity = prop.OPacity || 1;
      for (var i = 0; i < layer2.length; i++) {
        const feature = layer2.feature(i);
        if (feature.type !== 2) continue;
        const geometry = feature.loadGeometry().lines;
        for (const ring of geometry) {
          if (ring.length === 0) continue;
          const formattedRing = ring.map((p) => [p.x, p.y]);
          if (strokeThickness != 1) {
            addPolyline(formattedRing, strokeColor, strokeThickness, opacity);
          } else {
            addThin(formattedRing, strokeColor, opacity);
          }
        }
      }
    }
  }
  function addThin(points, color, opacity) {
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      thinVertex.push(...p, propStructs.length, 1);
      if (i < points.length - 1) {
        thinIndex.push(thinIndexBase + i, thinIndexBase + i + 1);
      }
    }
    thinIndexBase += points.length;
    propStructs.push({
      fillColor: [1, 1, 1],
      lineColor: color,
      opacity,
      thickness: 1
    });
  }
  function addPolygon(rings, fillColor, lineColor, strokeThickness, opacity) {
    const earcutRawData = [];
    const holeIndices = [];
    let currentVertexCount = 0;
    for (let i = 0; i < rings.length; i++) {
      const ring = rings[i];
      if (!ring.length) continue;
      if (i > 0) {
        holeIndices.push(currentVertexCount);
      }
      for (let i2 = 0; i2 < ring.length; i2++) {
        const p = ring[i2];
        earcutRawData.push(p[0], p[1]);
        polygonVertex.push(...p, propStructs.length, 1);
        currentVertexCount++;
        if (strokeThickness > 0) {
          borderIndex.push(
            borderIndexBase + i2,
            borderIndexBase + (i2 + 1 == ring.length ? 0 : i2 + 1)
          );
        }
      }
      borderIndexBase += ring.length;
    }
    const indices = earcut(earcutRawData, holeIndices);
    if (!indices.length) return;
    indices.forEach((idx) => {
      polygonIndex.push(polygonVertexBase + idx);
    });
    propStructs.push({
      fillColor,
      lineColor,
      opacity,
      thickness: strokeThickness
    });
    polygonVertexBase += currentVertexCount;
  }
  function addPolyline(points, color, thickness, opacity) {
    const numPoints = points.length;
    if (numPoints < 2) return;
    for (let i = 0; i < numPoints - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      const base = lineVertex.length;
      const featureID = propStructs.length;
      const dx = next[0] - current[0];
      const dy = -next[1] + current[1];
      lineVertex.push({
        pos: current,
        featureID,
        normal: [dy, -dx]
      });
      lineVertex.push({
        pos: current,
        featureID,
        normal: [-dy, dx]
      });
      lineVertex.push({
        pos: next,
        featureID,
        normal: [-dy, dx]
      });
      lineVertex.push({
        pos: next,
        featureID,
        normal: [dy, -dx]
      });
      lineIndex.push(base, base + 1, base + 2, base + 2, base + 3, base);
      if (i > 0) {
        lineIndex.push(base, base - 1, base + 1, base + 1, base - 2, base);
      }
    }
    propStructs.push({
      fillColor: [1, 1, 1],
      lineColor: color,
      opacity,
      thickness
    });
  }
};

// src/js/util/calc.js
var scale = (z) => {
  return Math.pow(2, z) * 3e-5;
};

// src/js/makePipline.js
var makePipline_default = (device, commonBindGroupLayout, tileBindGroupLayout, presentationFormat, shaderModule, vEntryPoint, arrayStride, attributes, topology, fEntryPoint = "fs_main") => {
  return device.createRenderPipeline({
    // layout: "auto" の代わりに、2つの設計図を配列で渡す
    layout: device.createPipelineLayout({
      bindGroupLayouts: [commonBindGroupLayout, tileBindGroupLayout]
    }),
    vertex: {
      module: shaderModule,
      entryPoint: vEntryPoint,
      buffers: [
        {
          arrayStride,
          stepMode: "vertex",
          attributes: attributes.map((a, i) => {
            return {
              shaderLocation: i,
              offset: a[0],
              format: a[1]
            };
          })
        }
      ]
    },
    fragment: {
      module: shaderModule,
      entryPoint: fEntryPoint,
      targets: [
        {
          format: presentationFormat,
          // 以下の blend 設定を追加・変更する
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            }
          }
        }
      ]
    },
    primitive: { topology },
    depthStencil: {
      format: "depth24plus",
      depthWriteEnabled: true,
      // ★通常通り深度を書き込む
      depthCompare: "greater"
    },
    multisample: {
      count: 4
      // ★パイプライン側でも4倍を明示
    }
  });
};

// src/js/worker.js
self.onmessage = async (e) => {
  if (e.data["c"]) {
    const sab = e.data["b"];
    const viewArray = new Float32Array(sab);
    init(e.data["c"], e.data["s"], viewArray);
  }
};
async function init(canvas, size, viewArray) {
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) {
    message_default("e", "WebGPU \u3092\u30B5\u30DD\u30FC\u30C8\u3057\u3066\u3044\u306A\u3044\u30D6\u30E9\u30A6\u30B6\u3001\u307E\u305F\u306F\u74B0\u5883\u3067\u3059\u3002");
    return;
  }
  if (true) {
    device.pushErrorScope("validation");
    const error = await device.popErrorScope();
    if (error) {
      console.error("WebGPU \u30D0\u30EA\u30C7\u30FC\u30B7\u30E7\u30F3\u30A8\u30E9\u30FC:", error.message);
    }
    device.lost.then((info) => {
      console.error(`WebGPU \u30C7\u30D0\u30A4\u30B9\u304C\u55AA\u5931\u3057\u307E\u3057\u305F\u3002\u7406\u7531: ${info.reason}`);
      console.error(`\u30E1\u30C3\u30BB\u30FC\u30B8: ${info.message}`);
      if (info.reason === "destroyed") {
        console.log("\u30C7\u30D0\u30A4\u30B9\u306F\u610F\u56F3\u7684\u306B\u7834\u68C4\u3055\u308C\u307E\u3057\u305F\u3002");
      } else {
        console.log("\u30C7\u30D0\u30A4\u30B9\u3092\u518D\u521D\u671F\u5316\u3057\u307E\u3059...");
      }
    });
  }
  const context = canvas.getContext("webgpu");
  canvas.width = size[0];
  canvas.height = size[1];
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
    // alphaMode: "opaque",
    alphaMode: "premultiplied"
  });
  const commonBindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }
        // Uniformバッファが入りますよという宣言
      }
    ]
  });
  const tileBindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        // 頂点シェーダーで使う場合
        buffer: { type: "read-only-storage" }
        // ストレージバッファ(読み込み専用)が入りますよという宣言
      }
      // {
      //   binding: 1,
      //   visibility: GPUShaderStage.VERTEX,
      //   buffer: { type: "read-only-storage" },
      // },
    ]
  });
  const shaderModule = device.createShaderModule({ code: shader_default });
  const polygonPipeline = makePipline_default(
    device,
    commonBindGroupLayout,
    tileBindGroupLayout,
    presentationFormat,
    shaderModule,
    "vs_polygon",
    16,
    [
      [0, "sint32x2"],
      [8, "sint32"]
    ],
    "triangle-list"
  );
  const thinLinePipeline = makePipline_default(
    device,
    commonBindGroupLayout,
    tileBindGroupLayout,
    presentationFormat,
    shaderModule,
    "vs_thinline",
    16,
    [
      [0, "sint32x2"],
      [8, "sint32"]
    ],
    "line-list"
  );
  const linePipeline = makePipline_default(
    device,
    commonBindGroupLayout,
    tileBindGroupLayout,
    presentationFormat,
    shaderModule,
    "vs_polyline",
    32,
    [
      [0, "sint32x2"],
      [8, "sint32"],
      [12, "uint32"],
      // pad用 将来なにかに使ってね
      [16, "float32x2"]
    ],
    "triangle-list",
    "fs_polyline"
  );
  if (true) {
    const compilationInfo = await shaderModule.getCompilationInfo();
    for (const message of compilationInfo.messages) {
      console.error(
        `WGSL error: ${message.message} at line ${message.lineNum}`
      );
    }
  }
  const uniformBuffer = device.createBuffer({
    size: 256,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  let styleTable = [];
  for (const s of style_default) {
    if (/p|s/.test(s.Type)) continue;
    if (Array.isArray(s.thickness)) {
      styleTable.push(...s.thickness.flat());
      s.thickness = -(~~styleTable.length / 4);
    }
    if (Array.isArray(s.OPacity)) {
      styleTable.push(...s.OPacity.flat());
      s.OPacity = -(~~styleTable.length / 4);
    }
  }
  console.log("style", styleTable, style_default);
  device.queue.writeBuffer(uniformBuffer, 128, new Float32Array(styleTable));
  const globalBindGroup = device.createBindGroup({
    layout: commonBindGroupLayout,
    // グループ0の設計図を指定
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } }
      // 実体バッファ
    ]
  });
  const visibleTiles = [];
  var zxys = [[15, 28191, 13180]];
  for (const zxy of zxys) {
    var tileData = await loadTile_default(zxy);
    console.log("tileData", tileData);
    const drawData = onCreateTile(device, tileBindGroupLayout, tileData);
    visibleTiles.push(drawData);
  }
  console.log("tiles", visibleTiles);
  function updateCamera() {
    device.queue.writeBuffer(
      uniformBuffer,
      64,
      new Float32Array([
        viewArray[0],
        viewArray[1],
        viewArray[2],
        scale(viewArray[2])
        //flagはシェーダでは必要ないのでscaleとして使用する
      ])
    );
  }
  function updateCanvasSize() {
    device.queue.writeBuffer(
      uniformBuffer,
      80,
      // 後半の16バイトの位置から書き込み
      new Float32Array([canvas.width, canvas.height])
    );
  }
  updateCamera();
  updateCanvasSize();
  const msaaColorTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    sampleCount: 4,
    // ★ここを4にする
    format: navigator.gpu.getPreferredCanvasFormat(),
    usage: GPUTextureUsage.RENDER_ATTACHMENT
  });
  const msaaDepthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    sampleCount: 4,
    // ★カラーと合わせる
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT
  });
  function render() {
    requestAnimationFrame(render);
    if (!viewArray[3]) return;
    updateCamera();
    const commandEncoder = device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: msaaColorTexture.createView(),
          resolveTarget: context.getCurrentTexture().createView(),
          clearValue: {
            r: 0.96,
            g: 0.97,
            b: 0.98,
            a: 1
          },
          loadOp: "clear",
          storeOp: "discard"
        }
      ],
      depthStencilAttachment: {
        view: msaaDepthTexture.createView(),
        depthClearValue: 0,
        depthLoadOp: "clear",
        depthStoreOp: "store"
      }
    });
    renderPass.setBindGroup(0, globalBindGroup);
    for (const tile of visibleTiles) {
      renderPass.setBindGroup(1, tile.bindGroup);
      renderPass.setVertexBuffer(0, tile.polygonVertexBuffer);
      renderPass.setPipeline(polygonPipeline);
      renderPass.setIndexBuffer(tile.polygonIndexBuffer, "uint32");
      renderPass.drawIndexed(tile.polygonIndexCount, 1, 0, 0, 0);
      renderPass.setPipeline(thinLinePipeline);
      renderPass.setIndexBuffer(tile.borderIndexBuffer, "uint32");
      renderPass.drawIndexed(tile.borderIndexCount, 1, 0, 0, 0);
      renderPass.setVertexBuffer(0, tile.lineVertexBuffer);
      renderPass.setPipeline(linePipeline);
      renderPass.setIndexBuffer(tile.lineIndexBuffer, "uint32");
      renderPass.drawIndexed(tile.lineIndexCount, 1, 0, 0, 0);
      renderPass.setVertexBuffer(0, tile.thinVertexBuffer);
      renderPass.setPipeline(thinLinePipeline);
      renderPass.setIndexBuffer(tile.thinIndexBuffer, "uint32");
      renderPass.drawIndexed(tile.thinIndexCount, 1, 0, 0, 0);
    }
    renderPass.end();
    device.queue.submit([commandEncoder.finish()]);
    viewArray[3] = 0;
  }
  render();
}
