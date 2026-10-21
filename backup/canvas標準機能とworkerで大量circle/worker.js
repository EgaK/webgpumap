var canvas, ctx;
var size = [200, 200];

onmessage = (e) => {
  if (e.data.canvas) {
    canvas = e.data.canvas;
    ctx = canvas.getContext("2d");
  }
  e.data.pos &&
    requestAnimationFrame(() => {
      draw(e.data.pos);
    });
  if (e.data.size) {
    size = e.data.size;
    [canvas.width, canvas.height] = e.data.size;
  }
};

var draw = ([x, y]) => {
  ctx.fillStyle = "#f5f0ea";
  ctx.fillRect(0, 0, size[0], size[1]);

  for (var i = -100; i <= 100; i++) {
    for (var j = -100; j <= 100; j++) {
      var dist = Math.sqrt(i * i + j * j) * 2;
      var color = `rgb(${dist}, ${dist}, ${dist})`;
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(x + i * 4, y + j * 4, 2, 0, Math.PI * 2, false);
      ctx.fill();
      ctx.closePath();
    }
  }
};
