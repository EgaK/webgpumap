export default function (pbf, end) {
  this.layers = pbf.readFields(readTile, {}, end);
}

function readTile(tag, layers, pbf) {
  if (tag === 3) {
    var layer = new VectorTileLayer(pbf, pbf.readVarint() + pbf.pos);
    if (layer.length) {
      layers[layer.Name] = layer;
    }
  }
}

var VectorTileLayer = function (pbf, end) {
  // Public
  // this.version = 1;
  // this.Name = null;
  this.extent = 4096;
  this.length = 0;

  // Private
  this._pbf = pbf;
  this._keys = [];
  this._values = [];
  this._features = [];

  pbf.readFields(readLayer, this, end);

  this.length = this._features.length;
};

function readLayer(tag, layer, pbf) {
  // console.log('tag:', tag);
  // if (tag === 15) layer.version = pbf.readVarint(); else
  if (tag === 1) layer.Name = pbf.readString();
  else if (tag === 5) layer.extent = pbf.readVarint();
  else if (tag === 2) layer._features.push(pbf.pos);
  else if (tag === 3) layer._keys.push(pbf.readString());
  else if (tag === 4) layer._values.push(readValueMessage(pbf));
}

function readValueMessage(pbf) {
  var value = null,
    end = pbf.readVarint() + pbf.pos;

  while (pbf.pos < end) {
    var tag = pbf.readVarint() >> 3;

    value =
      tag === 1
        ? pbf.readString()
        : tag === 2
          ? pbf.readFloat()
          : tag === 3
            ? pbf.readDouble()
            : tag === 4
              ? pbf.readVarint64()
              : tag === 5
                ? pbf.readVarint()
                : tag === 6
                  ? pbf.readSVarint()
                  : tag === 7
                    ? pbf.readBoolean()
                    : null;
  }

  return value;
}

// return feature `i` from this layer as a `VectorTileFeature`
VectorTileLayer.prototype.feature = function (i) {
  if (i < 0 || i >= this._features.length) {
    DEVELOP && console.log("feature index out of bounds");
    //throw new Error('feature index out of bounds');
  }

  this._pbf.pos = this._features[i];

  var end = this._pbf.readVarint() + this._pbf.pos;
  return new VectorTileFeature(
    this._pbf,
    end,
    this.extent,
    this._keys,
    this._values,
  );
};

var VectorTileFeature = function (pbf, end, extent, keys, values) {
  // Public
  this.properties = {};
  this.extent = extent;
  this.Type = 0;

  // Private
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
    var key = feature._keys[pbf.readVarint()],
      value = feature._values[pbf.readVarint()];
    feature.properties[key] = value;
  }
}

// VectorTileFeature.Types = ['Unknown', 'Point', 'LineString', 'Polygon'];

VectorTileFeature.prototype.loadGeometry = function () {
  var pbf = this._pbf;
  pbf.pos = this._geometry;

  var end = pbf.readVarint() + pbf.pos,
    cmd = 1,
    length = 0,
    x = 0,
    y = 0,
    lines = [],
    line;

  while (pbf.pos < end) {
    if (length <= 0) {
      var cmdLen = pbf.readVarint();
      cmd = cmdLen & 0x7;
      length = cmdLen >> 3;
    }

    length--;

    if (cmd === 1 || cmd === 2) {
      x += pbf.readSVarint();
      y += pbf.readSVarint();

      if (cmd === 1) {
        // moveTo
        if (line) lines.push(line);
        line = [];
      }

      line.push([x, y]);
    } else if (cmd === 7) {
      // Workaround for https://github.com/mapbox/mapnik-vector-tile/issues/90
      if (line) {
        line.push(line[0]); // closePolygon
      }
    } else {
      DEVELOP && console.log("unknown command " + cmd);
      break;

      // throw new Error('unknown command ' + cmd);
    }
  }

  if (line) lines.push(line);

  return lines;
};

VectorTileFeature.prototype.toGeoJSON = function ([z, x, y]) {
  var size = this.extent * Math.pow(2, z),
    x0 = this.extent * x,
    y0 = this.extent * y,
    coordinates = this.loadGeometry(),
    // VectorTileFeature.Types = ['Unknown', 'Point', 'LineString', 'Polygon'];
    Type = this.Type,
    // Type = VectorTileFeature.Types[this.Type],
    i,
    j;
  // var coordinates;

  function project(line) {
    for (var j = 0; j < line.length; j++) {
      var p = line[j].flat();
      var y2 = 1 - ((p[1] + y0) * 2) / size;
      line[j] = [
        ((p[0] + x0) * 360) / size - 180,
        (360 / Math.PI) * Math.atan(Math.exp(y2 * Math.PI)) - 90,
      ];
    }
  }

  switch (Type) {
    case 1:
      // var points = [];
      // for (var i = 0; i < coords.length; i++) {
      //     points[i] = coords[i][0];
      // }
      // coords = points;
      project(coordinates);
      // coords = this.loadGeometry().map(p => projectp(p[0]));
      break;

    case 2:
      for (var p of coordinates) {
        project(p);
      }
      // coords = this.loadGeometry().map(p => p.map(p => projectp(p)));
      break;

    case 3:
      coordinates = classifyRings(coordinates);
      for (var p of coordinates) {
        for (var q of p) {
          project(q);
        }
      }
      // coords = classifyRings(this.loadGeometry()).flat().map(p => p.map(p => project(p)));
      break;
  }

  // var coordinates = [];

  // if (coordinates.length == 1) {
  //     coordinates = coordinates[0];
  //     //     coords = coords[0];
  // } else {
  //     //     //     // console.log('multi');
  //     //     //     coords = coords.flat();
  //     //     //     // Type = 'Multi' + Type;
  //     Type += 4;
  // }

  if (coordinates.length == 1) {
    coordinates = coordinates[0];
  } else {
    Type += 4;
  }

  // for (var i = 0; i < coords.length; i++) {
  //     coordinates.push(...coords[i])
  // }
  // }
  // var depth = 0;
  // var dive = ary => {
  //     if (Array.isArray(ary)) {
  //         depth++;
  //         dive(ary[0])
  //     }
  // }

  // dive(coords);
  // // if (coords.length == 1) {
  // console.log('Type:' + Type + ', depth:', depth);
  // } else {
  //     console.log('Multi Type:' + Type + ', depth:', depth);
  // }

  return {
    // Type: "Feature",
    geometry: {
      Type,
      // coordinates: coords,
      coordinates,
    },
    properties: this.properties,
  };
};

// classifies an array of rings into polygons with outer rings and holes

function classifyRings(rings) {
  var len = rings.length;

  if (len <= 1) return [rings];

  var polygons = [],
    polygon,
    ccw;

  for (var i = 0; i < len; i++) {
    var area = signedArea(rings[i]);
    if (area === 0) continue;

    if (ccw === undefined) ccw = area < 0;

    if (ccw === area < 0) {
      if (polygon) polygons.push(polygon);
      polygon = [rings[i]];
    } else {
      polygon.push(rings[i]);
    }
  }
  if (polygon) polygons.push(polygon);

  return polygons;
}

function signedArea(ring) {
  var sum = 0;
  for (var i = 0, len = ring.length, j = len - 1, p1, p2; i < len; j = i++) {
    p1 = ring[i];
    p2 = ring[j];
    sum += (p2[0] - p1[0]) * (p1[1] + p2[1]);
  }
  return sum;
}
