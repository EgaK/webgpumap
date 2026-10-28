import { read } from "./ieee754";

export default function Pbf(buf) {
  this.buf =
    ArrayBuffer.isView && ArrayBuffer.isView(buf)
      ? buf
      : new Uint8Array(buf || 0);
  this.pos = 0;
  this.type = 0;
  this.length = this.buf.length;
}

Pbf.Varint = 0; // varint: int32, int64, uint32, uint64, sint32, sint64, bool, enum
Pbf.Fixed64 = 1; // 64-bit: double, fixed64, sfixed64
Pbf.Bytes = 2; // length-delimited: string, bytes, embedded messages, packed repeated fields
Pbf.Fixed32 = 5; // 32-bit: float, fixed32, sfixed32

var SHIFT_LEFT_32 = (1 << 16) * (1 << 16),
  SHIFT_RIGHT_32 = 1 / SHIFT_LEFT_32;

Pbf.prototype = {
  destroy: function () {
    this.buf = null;
  },

  // === READING =================================================================

  readFields: function (readField, result, end) {
    end = end || this.length;

    while (this.pos < end) {
      var val = this.readVarint(),
        tag = val >> 3,
        startPos = this.pos;

      this.type = val & 0x7;
      readField(tag, result, this);

      if (this.pos === startPos) this.skip(val);
    }
    return result;
  },

  readMessage: function (readField, result) {
    return this.readFields(readField, result, this.readVarint() + this.pos);
  },

  readFixed32: function () {
    var val = readUInt32(this.buf, this.pos);
    this.pos += 4;
    return val;
  },

  readSFixed32: function () {
    var val = readInt32(this.buf, this.pos);
    this.pos += 4;
    return val;
  },

  // 64-bit int handling is based on github.com/dpw/node-buffer-more-ints (MIT-licensed)

  readFixed64: function () {
    var val =
      readUInt32(this.buf, this.pos) +
      readUInt32(this.buf, this.pos + 4) * SHIFT_LEFT_32;
    this.pos += 8;
    return val;
  },

  readSFixed64: function () {
    var val =
      readUInt32(this.buf, this.pos) +
      readInt32(this.buf, this.pos + 4) * SHIFT_LEFT_32;
    this.pos += 8;
    return val;
  },

  readFloat: function () {
    var val = read(this.buf, this.pos, true, 23, 4);
    this.pos += 4;
    return val;
  },

  readDouble: function () {
    var val = read(this.buf, this.pos, true, 52, 8);
    this.pos += 8;
    return val;
  },

  readVarint: function (isSigned) {
    var buf = this.buf,
      val,
      b;

    b = buf[this.pos++];
    val = b & 0x7f;
    if (b < 0x80) return val;
    b = buf[this.pos++];
    val |= (b & 0x7f) << 7;
    if (b < 0x80) return val;
    b = buf[this.pos++];
    val |= (b & 0x7f) << 14;
    if (b < 0x80) return val;
    b = buf[this.pos++];
    val |= (b & 0x7f) << 21;
    if (b < 0x80) return val;
    b = buf[this.pos];
    val |= (b & 0x0f) << 28;

    return readVarintRemainder(val, isSigned, this);
  },

  readVarint64: function () {
    // for compatibility with v2.0.1
    return this.readVarint(true);
  },

  readSVarint: function () {
    var num = this.readVarint();
    return num % 2 === 1 ? (num + 1) / -2 : num / 2; // zigzag encoding
  },

  readBoolean: function () {
    return Boolean(this.readVarint());
  },

  readString: function () {
    var end = this.readVarint() + this.pos,
      str = readUtf8(this.buf, this.pos, end);
    this.pos = end;
    return str;
  },

  readBytes: function () {
    var end = this.readVarint() + this.pos,
      buffer = this.buf.subarray(this.pos, end);
    this.pos = end;
    return buffer;
  },

  // verbose for performance reasons; doesn't affect gzipped size

  readPackedVarint: function (arr, isSigned) {
    if (this.type !== Pbf.Bytes) return arr.push(this.readVarint(isSigned));
    var end = readPackedEnd(this);
    arr = arr || [];
    while (this.pos < end) arr.push(this.readVarint(isSigned));
    return arr;
  },
  readPackedSVarint: function (arr) {
    if (this.type !== Pbf.Bytes) return arr.push(this.readSVarint());
    var end = readPackedEnd(this);
    arr = arr || [];
    while (this.pos < end) arr.push(this.readSVarint());
    return arr;
  },
  readPackedBoolean: function (arr) {
    if (this.type !== Pbf.Bytes) return arr.push(this.readBoolean());
    var end = readPackedEnd(this);
    arr = arr || [];
    while (this.pos < end) arr.push(this.readBoolean());
    return arr;
  },
  readPackedFloat: function (arr) {
    if (this.type !== Pbf.Bytes) return arr.push(this.readFloat());
    var end = readPackedEnd(this);
    arr = arr || [];
    while (this.pos < end) arr.push(this.readFloat());
    return arr;
  },
  readPackedDouble: function (arr) {
    if (this.type !== Pbf.Bytes) return arr.push(this.readDouble());
    var end = readPackedEnd(this);
    arr = arr || [];
    while (this.pos < end) arr.push(this.readDouble());
    return arr;
  },
  readPackedFixed32: function (arr) {
    if (this.type !== Pbf.Bytes) return arr.push(this.readFixed32());
    var end = readPackedEnd(this);
    arr = arr || [];
    while (this.pos < end) arr.push(this.readFixed32());
    return arr;
  },
  readPackedSFixed32: function (arr) {
    if (this.type !== Pbf.Bytes) return arr.push(this.readSFixed32());
    var end = readPackedEnd(this);
    arr = arr || [];
    while (this.pos < end) arr.push(this.readSFixed32());
    return arr;
  },
  readPackedFixed64: function (arr) {
    if (this.type !== Pbf.Bytes) return arr.push(this.readFixed64());
    var end = readPackedEnd(this);
    arr = arr || [];
    while (this.pos < end) arr.push(this.readFixed64());
    return arr;
  },
  readPackedSFixed64: function (arr) {
    if (this.type !== Pbf.Bytes) return arr.push(this.readSFixed64());
    var end = readPackedEnd(this);
    arr = arr || [];
    while (this.pos < end) arr.push(this.readSFixed64());
    return arr;
  },

  skip: function (val) {
    var type = val & 0x7;
    if (type === Pbf.Varint) while (this.buf[this.pos++] > 0x7f) {}
    else if (type === Pbf.Bytes) this.pos = this.readVarint() + this.pos;
    else if (type === Pbf.Fixed32) this.pos += 4;
    else if (type === Pbf.Fixed64) this.pos += 8;
    // else throw new Error('Unimplemented type: ' + type);
    else DEVELOP && console.log("Unimplemented type: " + type);
  },
};

var readVarintRemainder = (l, s, p) => {
  var buf = p.buf,
    h,
    b;

  b = buf[p.pos++];
  h = (b & 0x70) >> 4;
  if (b < 0x80) return toNum(l, h, s);
  b = buf[p.pos++];
  h |= (b & 0x7f) << 3;
  if (b < 0x80) return toNum(l, h, s);
  b = buf[p.pos++];
  h |= (b & 0x7f) << 10;
  if (b < 0x80) return toNum(l, h, s);
  b = buf[p.pos++];
  h |= (b & 0x7f) << 17;
  if (b < 0x80) return toNum(l, h, s);
  b = buf[p.pos++];
  h |= (b & 0x7f) << 24;
  if (b < 0x80) return toNum(l, h, s);
  b = buf[p.pos++];
  h |= (b & 0x01) << 31;
  if (b < 0x80) return toNum(l, h, s);

  // throw new Error('Expected varint not more than 10 bytes');
  DEVELOP && console.log("Expected varint not more than 10 bytes");
};

var readPackedEnd = (pbf) => {
  return pbf.type === Pbf.Bytes ? pbf.readVarint() + pbf.pos : pbf.pos + 1;
};

var toNum = (low, high, isSigned) => {
  if (isSigned) {
    return high * 0x100000000 + (low >>> 0);
  }

  return (high >>> 0) * 0x100000000 + (low >>> 0);
};

// Buffer code below from https://github.com/feross/buffer, MIT-licensed

var readUInt32 = (buf, pos) => {
  return (
    (buf[pos] | (buf[pos + 1] << 8) | (buf[pos + 2] << 16)) +
    buf[pos + 3] * 0x1000000
  );
};

var readInt32 = (buf, pos) => {
  return (
    (buf[pos] | (buf[pos + 1] << 8) | (buf[pos + 2] << 16)) +
    (buf[pos + 3] << 24)
  );
};

var readUtf8 = (buf, pos, end) => {
  var str = "";
  var i = pos;

  while (i < end) {
    var b0 = buf[i];
    var c = null; // codepoint
    var bytesPerSequence = b0 > 0xef ? 4 : b0 > 0xdf ? 3 : b0 > 0xbf ? 2 : 1;

    if (i + bytesPerSequence > end) break;

    var b1, b2, b3;

    if (bytesPerSequence === 1) {
      if (b0 < 0x80) {
        c = b0;
      }
    } else if (bytesPerSequence === 2) {
      b1 = buf[i + 1];
      if ((b1 & 0xc0) === 0x80) {
        c = ((b0 & 0x1f) << 0x6) | (b1 & 0x3f);
        if (c <= 0x7f) {
          c = null;
        }
      }
    } else if (bytesPerSequence === 3) {
      b1 = buf[i + 1];
      b2 = buf[i + 2];
      if ((b1 & 0xc0) === 0x80 && (b2 & 0xc0) === 0x80) {
        c = ((b0 & 0xf) << 0xc) | ((b1 & 0x3f) << 0x6) | (b2 & 0x3f);
        if (c <= 0x7ff || (c >= 0xd800 && c <= 0xdfff)) {
          c = null;
        }
      }
    } else if (bytesPerSequence === 4) {
      b1 = buf[i + 1];
      b2 = buf[i + 2];
      b3 = buf[i + 3];
      if (
        (b1 & 0xc0) === 0x80 &&
        (b2 & 0xc0) === 0x80 &&
        (b3 & 0xc0) === 0x80
      ) {
        c =
          ((b0 & 0xf) << 0x12) |
          ((b1 & 0x3f) << 0xc) |
          ((b2 & 0x3f) << 0x6) |
          (b3 & 0x3f);
        if (c <= 0xffff || c >= 0x110000) {
          c = null;
        }
      }
    }

    if (c === null) {
      c = 0xfffd;
      bytesPerSequence = 1;
    } else if (c > 0xffff) {
      c -= 0x10000;
      str += String.fromCharCode(((c >>> 10) & 0x3ff) | 0xd800);
      c = 0xdc00 | (c & 0x3ff);
    }

    str += String.fromCharCode(c);
    i += bytesPerSequence;
  }

  return str;
};
