import $ from "./util/tiny";
import mouseevents from "./util/mouseevents";
import context from "./util/context";
// import loadTile from "./loadTile";

const sab = new SharedArrayBuffer(16);
const viewArray = new Float32Array(sab);
// 初期値
// 1.984375 1.890625
viewArray[0] = 1.984375; // X
viewArray[1] = 1.890625; // Y
viewArray[2] = 15; // Zoom
viewArray[3] = 1; // フラグ用 (0.0 = 変化なし, 1.0 = 変化あり)

context.mapWidth = 400;
context.mapHeight = 400;

const canvas = $("canvas");
canvas[0].width = context.mapWidth * 2;
canvas[0].height = context.mapHeight * 2;
canvas.css({
  width: context.mapWidth + "px",
  height: context.mapHeight + "px",
});
const offcanvas = canvas[0].transferControlToOffscreen();

const blob = new Blob([WORKER_CODE], { type: "application/javascript" });
const workerUrl = URL.createObjectURL(blob);
const worker = new Worker(workerUrl);

// const worker = new Worker("/js/worker.js");
worker.postMessage(
  {
    "c": offcanvas,
    "s": [context.mapWidth * 2, context.mapHeight * 2],
    "b": sab,
  },
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
  context.mapWidth = 400;
  context.mapHeight = 600;
  canvas.css({
    width: context.mapWidth + "px",
    height: context.mapHeight + "px",
  });
  worker.postMessage({ "s": [context.mapWidth * 2, context.mapHeight * 2] });
  viewArray[3] = 1;
});
$("#resize2").on("click", () => {
  context.mapWidth = 400;
  context.mapHeight = 400;
  canvas.css({
    width: context.mapWidth + "px",
    height: context.mapHeight + "px",
  });
  worker.postMessage({ "s": [context.mapWidth * 2, context.mapHeight * 2] });
  viewArray[3] = 1;
});
