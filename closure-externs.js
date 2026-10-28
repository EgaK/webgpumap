/**
 * A global variable - note there is no assignment needed
 * @type {number}
 */
var h;
// var obj

/**
 * My variable as a static namespace property - still no assignment
 * @type {number}
 */
h.class;
h.colspan;
h.rowspan;
h.datetime;
h.viewBox;
h.maxlength;
h.pid;
h.cx;
h.cy;
h.r;
h.x1;
h.x2;
h.y1;
h.y2;
h.lng;
h.lat;
h.loading;
h.rg;
h.onclick; //これはなくても改名されない

/** @const */
var GPUBufferUsage = {};
/** @type {number} */
GPUBufferUsage.MAP_READ;
/** @type {number} */
GPUBufferUsage.MAP_WRITE;
/** @type {number} */
GPUBufferUsage.COPY_SRC;
/** @type {number} */
GPUBufferUsage.COPY_DST;
/** @type {number} */
GPUBufferUsage.INDEX;
/** @type {number} */
GPUBufferUsage.VERTEX;
/** @type {number} */
GPUBufferUsage.UNIFORM;
/** @type {number} */
GPUBufferUsage.STORAGE;
/** @type {number} */
GPUBufferUsage.INDIRECT;
/** @type {number} */
GPUBufferUsage.QUERY_RESOLVE;
/** @const */
var GPUShaderStage = {};
/** @type {number} */
GPUShaderStage.VERTEX;
/** @type {number} */
GPUShaderStage.FRAGMENT;
/** @const */
var GPUTextureUsage = {};
/** @type {number} */
GPUTextureUsage.RENDER_ATTACHMENT;
