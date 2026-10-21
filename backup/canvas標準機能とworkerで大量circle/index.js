import $ from "./util/tiny";

const canvas = $("canvas");
canvas[0].width = 800;
canvas[0].height = 800;
canvas.css({ width: 400 + "px", height: 400 + "px" });
const offcanvas = canvas[0].transferControlToOffscreen();

const worker = new Worker("/worker.js");
worker.postMessage({ canvas: offcanvas, size: [800, 800] }, [offcanvas]);

const container = $("#m");
container.on("mousedown touchstart", (e) => {
  e.preventDefault();
  var listener = (e) => {
    worker.postMessage({ pos: [e.layerX * 2, e.layerY * 2] });
  };
  container.on("mousemove touchmove", listener);
  container.one("mouseup touchend", () => {
    container.off("mousemove", listener);
  });
});

const btn = $("button");
btn.on("click", () => {
  worker.postMessage({ size: [800, 1000] });
  canvas.css({ width: 400 + "px", height: 500 + "px" });
});
