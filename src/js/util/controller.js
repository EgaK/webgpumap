import context from "./context";
import $ from "./tiny";
import { scale } from "./calc";

const sab = new SharedArrayBuffer(16);
const viewArray = new Float32Array(sab);
let canvas;
// 初期値
// 1.984375 1.890625
// 1.98114013671875 1.8836669921875
// viewArray[0] = 1.984375; // X
// viewArray[1] = 1.890625; // Y
// viewArray[0] = 1.5; // X
// viewArray[1] = 1.5; // Y
// viewArray[2] = 15; // Zoom
// viewArray[3] = 1; // フラグ用 (0.0 = 変化なし, 1.0 = 変化あり)
//
const v = document.getElementById("zoom");
const view = () => {
  requestAnimationFrame(view);
  if (!viewArray[3]) return;
  v.innerText = `zoom: ${viewArray[2].toFixed(2)}, x:${viewArray[0].toFixed(8)}, y:${viewArray[1].toFixed(8)}`;
};
view();

const blob = new Blob([WORKER_CODE], { type: "application/javascript" });
const workerUrl = URL.createObjectURL(blob);
const worker = new Worker(workerUrl);
// const worker = new Worker("/js/worker.js");

const init = (w, h) => {
  canvas = $("canvas");
  const offcanvas = canvas[0].transferControlToOffscreen();

  setCenter(1.984375, 1.890625);
  setZoom(15);
  resize(w, h, 1);
  worker.postMessage(
    {
      "c": offcanvas,
      "s": [w * 2, h * 2],
      "b": sab,
    },
    [offcanvas],
  );
  return worker;
};

const setCenter = (x, y) => {
  viewArray[0] = x; // X
  viewArray[1] = y; // Y
  viewArray[3] = 1; // フラグ用 (0.0 = 変化なし, 1.0 = 変化あり)
  context.centerX = x;
  context.centerY = y;
};

const setZoom = (z) => {
  viewArray[2] = z; // Zoom
  viewArray[3] = 1; // フラグ用 (0.0 = 変化なし, 1.0 = 変化あり)
  context.zoom = z;
  context.scaleZ = scale(z);
};

const resize = (w, h, init) => {
  context.mapWidth = w;
  context.mapHeight = h;
  canvas.css({
    width: context.mapWidth + "px",
    height: context.mapHeight + "px",
  });
  if (!init) {
    worker.postMessage({ "s": [w * 2, h * 2] });
    viewArray[3] = 1;
  }
};

export { init, setCenter, setZoom, resize };
