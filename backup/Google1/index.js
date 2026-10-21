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

  const worker = new Worker("/worker.js");
  worker.postMessage({ canvas: offcanvas, size: [800, 800] }, [offcanvas]);

  const container = $("#m");
  container.on("mousedown", (e) => {
    const startX = e.layerX;
    const startY = e.layerY;
    e.preventDefault();
    var listener = (e) => {
      worker.postMessage({
        deltaXY: [(e.layerX - startX) * 2, (e.layerY - startY) * 2],
      });
    };
    container.on("mousemove", listener);
    container.one("mouseup", () => {
      container.off("mousemove", listener);
    });
  });

  $("#widthInput").on("input", (e) => {
    $("#widthValue").html(e.target.value + "px");
  });

  $("#drawButton").on("click", () => {
    const lineWidth = parseFloat($("#widthInput")[0].value);
    const linePoints = parseCoords($("#lineCoordsInput")[0].value);
    const polyPoints = parseCoords($("#polyCoordsInput")[0].value);
    const lineColor = $("#lineColorInput")[0].value;
    const polyColor = $("#polyColorInput")[0].value;
    worker.postMessage({
      lineWidth,
      linePoints,
      polyPoints,
      lineColor,
      polyColor,
    });
  });
})();

// 座標パース用ヘルパー
function parseCoords(inputStr) {
  const pairs = inputStr.trim().split(/\s+/);
  const points = [];
  for (const pair of pairs) {
    const [xStr, yStr] = pair.split(",");
    const x = parseFloat(xStr);
    const y = parseFloat(yStr);
    if (!isNaN(x) && !isNaN(y)) points.push({ x, y });
  }
  return points;
}
