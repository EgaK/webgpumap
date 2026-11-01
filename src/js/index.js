import $ from "./util/tiny";
import mouseevents from "./util/mouseevents";
// import loadTile from "./loadTile";

const sab = new SharedArrayBuffer(16);
const viewArray = new Float32Array(sab);

// 初期値
viewArray[0] = 0; // X
viewArray[1] = 0; // Y
viewArray[2] = 16; // Zoom
viewArray[3] = 1; // フラグ用 (0.0 = 変化なし, 1.0 = 変化あり)

const canvas = $("canvas");
canvas[0].width = 800;
canvas[0].height = 1200;
canvas.css({ width: 400 + "px", height: 400 + "px" });
const offcanvas = canvas[0].transferControlToOffscreen();

// const blob = new Blob([WORKER_CODE], { type: "application/javascript" });
// const workerUrl = URL.createObjectURL(blob);
// const worker = new Worker(workerUrl);

const worker = new Worker("/js/worker.js");
worker.postMessage({ "c": offcanvas, "s": [800, 800], "b": sab }, [offcanvas]);

// const canvas = document.getElementById("a");
// const offcanvas = canvas.transferControlToOffscreen();
//
// const worker = new Worker("/js/worker.min.js");
// worker.postMessage({ canvas: offcanvas }, [offcanvas]);

mouseevents(viewArray);

// (async () => {
//   var axs = await loadTile([15, 28191, 13180]);
// })();
