import $ from "./util/tiny";

(async () => {
  if (!navigator.gpu) {
    alert("お使いのブラウザのバージョンが古いため地図が表示されません");
    return;
  }
  const canvas = $("canvas");
  canvas[0].width = 800;
  canvas[0].height = 800;
  canvas.css({ width: 400 + "px", height: 400 + "px" });
  const offcanvas = canvas[0].transferControlToOffscreen();

  var worker;
  if (DEVELOP) {
    worker = new Worker("/worker.js");
  } else {
    worker = new Worker("/worker2.js");
  }
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
    worker.postMessage({ size: [800, 800] });
    // canvas.css({ width: 400 + "px", height: 400 + "px" });
  });
})();
