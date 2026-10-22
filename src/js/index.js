import $ from "./util/tiny";

// // index.js (メインスレッド)
// const sab = new SharedArrayBuffer(24);
// const viewArray = new Float64Array(sab);
//
// // 初期値
// viewArray[0] = 0; // X
// viewArray[1] = 0; // Y
// viewArray[2] = 1; // Zoom
//
// // Workerを起動して、このメモリの「住所」を教えてあげる
// const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
// worker.postMessage({ type: 'INIT_MEM', sab });
// // マウスイベント（以前のコードの wheel 等）
// window.addEventListener('wheel', (e) => {
//   // 直接変数を書き換える代わりに、SABの配列の中身を書き換える
//   viewArray[2] += e.deltaY * 0.001;
//
//   // 必要なら、ここで前述の CustomEvent を発行して他のUIに通知する
// });

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
    var blob = new Blob([WORKERCODE], { type: "application/javascript" });
    var workerUrl = URL.createObjectURL(blob);
    worker = new Worker(workerUrl);
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
