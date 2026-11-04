import $ from "./util/tiny";
import mouseevents from "./util/mouseevents";
// import loadTile from "./loadTile";

const sab = new SharedArrayBuffer(16);
const viewArray = new Float32Array(sab);

// 初期値
viewArray[0] = 0.8603363037109375; // X
viewArray[1] = 0.4022369384765625; // Y
viewArray[2] = 15; // Zoom
viewArray[3] = 1; // フラグ用 (0.0 = 変化なし, 1.0 = 変化あり)

const pixelRatio = window.devicePixelRatio || 1;
var width = 400;
var height = 400;

const canvas = $("canvas");
canvas[0].width = width * pixelRatio;
canvas[0].height = height * pixelRatio;
canvas.css({ width: width + "px", height: width + "px" });
const offcanvas = canvas[0].transferControlToOffscreen();

const blob = new Blob([WORKER_CODE], { type: "application/javascript" });
const workerUrl = URL.createObjectURL(blob);
const worker = new Worker(workerUrl);

// const worker = new Worker("/js/worker.js");
worker.postMessage(
  { "c": offcanvas, "s": [width * pixelRatio, height * pixelRatio], "b": sab },
  [offcanvas],
);

$(worker).on("message", (e) => {
  if (e.data["e"]) {
    alert(e.data["e"]);
  }
  if (e.data["d"]) {
    // console.log("main received data:", e.data["d"]);
  }
});

mouseevents(viewArray);

$("#resize").on("click", () => {
  width = 400;
  height = 600;
  canvas.css({ width: width + "px", height: height + "px" });
  worker.postMessage({ "s": [width * pixelRatio, height * pixelRatio] });
  viewArray[3] = 1;
});
$("#resize2").on("click", () => {
  width = 400;
  height = 400;
  canvas.css({ width: width + "px", height: height + "px" });
  worker.postMessage({ "s": [width * pixelRatio, height * pixelRatio] });
  viewArray[3] = 1;
});
