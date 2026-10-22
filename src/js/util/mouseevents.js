import $ from "tiny";

var container = $("#m");

/*
container.on(
  "wheel",
  (e) => {
    e.preventDefault();

    // マウス位置のNDC座標を計算（マウスのある場所を中心にズームするため）
    const rect = container.boundRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

    const zoomFactor = 1.1;
    const oldZoom = zoom;

    if (e.deltaY < 0) {
      zoom *= zoomFactor;
    } else {
      zoom /= zoomFactor;
    }
    zoom = Math.max(0.1, Math.min(zoom, 100.0)); // 制限

    // マウス位置を中心に拡大するためのオフセット調整
    cameraOffset[0] += mouseX / oldZoom - mouseX / zoom;
    cameraOffset[1] += mouseY / oldZoom - mouseY / zoom;

    updateUniforms();
    render(); // 再描画
  },
  { passive: false },
);

canvas.addEventListener("mousedown", (e) => {
  if (e.button === 0) {
    // 左クリック
    isDragging = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
  }
});

window.addEventListener("mousemove", (e) => {
  if (!isDragging) return;

  const deltaX = e.clientX - previousMousePosition.x;
  const deltaY = e.clientY - previousMousePosition.y;

  // スクリーン移動量をNDC空間の移動量に変換
  const ndcX =
    (deltaX / canvas.width) * 2 * (canvas.width / window.innerWidth);
  const ndcY =
    -(deltaY / canvas.height) * 2 * (canvas.height / window.innerHeight);

  // ズーム倍率に応じて移動量を調整
  cameraOffset[0] -= ndcX / zoom;
  cameraOffset[1] -= ndcY / zoom;

  previousMousePosition = { x: e.clientX, y: e.clientY };

  updateUniforms();
  render();
});

window.addEventListener("mouseup", () => {
  isDragging = false;
});

// ------------------------------------------
// 8. スマートフォン用タッチイベントの追加 (iPhone対応)
// ------------------------------------------
let initialTouchDistance = 0;
let initialZoom = 1.0;

// ヘルパー：2本の指の間の距離を計算する
function getTouchDistance(touch1, touch2) {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

canvas.addEventListener(
  "touchstart",
  (e) => {
    // 画面のデフォルトのスクロールやバウンスを防止
    e.preventDefault();

    if (e.touches.length === 1) {
      // 1本指でのドラッグ（パン移動）の開始
      isDragging = true;
      previousMousePosition = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    } else if (e.touches.length === 2) {
      // 2本指でのピンチ（ズーム）の開始
      isDragging = false; // 移動はキャンセル
      initialTouchDistance = getTouchDistance(e.touches[0], e.touches[1]);
      initialZoom = zoom;
    }
  },
  { passive: false },
);

canvas.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();

    if (e.touches.length === 1 && isDragging) {
      // 1本指：平行移動（パン）
      const deltaX = e.touches[0].clientX - previousMousePosition.x;
      const deltaY = e.touches[0].clientY - previousMousePosition.y;

      const ndcX =
        (deltaX / canvas.width) * 2 * (canvas.width / window.innerWidth);
      const ndcY =
        -(deltaY / canvas.height) * 2 * (canvas.height / window.innerHeight);

      cameraOffset[0] -= ndcX / zoom;
      cameraOffset[1] -= ndcY / zoom;

      previousMousePosition = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };

      updateUniforms();
      render();
    } else if (e.touches.length === 2) {
      // 2本指：ピンチイン・アウト（中心位置固定の簡易ズーム）
      const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
      if (initialTouchDistance > 0) {
        const factor = currentDistance / initialTouchDistance;
        zoom = initialZoom * factor;
        zoom = Math.max(0.1, Math.min(zoom, 100.0)); // ズーム制限

        updateUniforms();
        render();
      }
    }
  },
  { passive: false },
);

canvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  isDragging = false;
  initialTouchDistance = 0;
});

*/
