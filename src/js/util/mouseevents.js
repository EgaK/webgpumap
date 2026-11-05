import { scale } from "./calc";
import context from "./context";

let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let scaleZ = scale(15);

export default (viewArray) => {
  const canvas = document.getElementById("a");

  const v = document.getElementById("zoom");
  const view = () => {
    requestAnimationFrame(view);
    if (!viewArray[3]) return;
    v.innerText = `zoom: ${viewArray[2].toFixed(2)}, x:${viewArray[0].toFixed(8)}, y:${viewArray[1].toFixed(8)}`;
  };
  view();
  // ------------------------------------------
  // 7. マウス・ホイールイベントの追加
  // ------------------------------------------
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();

      // 基準ズーム(z=10)の「タイル1枚の幅」を現在の画面ピクセル数に換算したスケール
      const oldScale = scaleZ;

      var dz = e.deltaY;
      dz = dz > 5 ? 5 : dz < -5 ? -5 : dz;
      var z = viewArray[2] - dz / 100;
      z = Math.max(10, Math.min(z, 20));
      if (viewArray[2] == z) return;

      viewArray[2] = z;
      scaleZ = scale(z);

      const x = context.mapWidth / 2 - e.offsetX;
      const y = context.mapHeight / 2 - e.offsetY;

      viewArray[0] -= x / oldScale - x / scaleZ;
      viewArray[1] -= y / oldScale - y / scaleZ;
      viewArray[3] = 1;
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

    // ズーム倍率に応じて移動量を調整
    viewArray[0] -= deltaX / scaleZ;
    viewArray[1] -= deltaY / scaleZ;

    previousMousePosition = { x: e.clientX, y: e.clientY };

    viewArray[3] = 1;
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
        initialZoom = viewArray[2];
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

        viewArray[0] -= ndcX / viewArray[2];
        viewArray[1] -= ndcY / viewArray[2];

        previousMousePosition = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };

        viewArray[3] = 1;
        // updateUniforms();
        // render();
      } else if (e.touches.length === 2) {
        // 2本指：ピンチイン・アウト（中心位置固定の簡易ズーム）
        const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
        if (initialTouchDistance > 0) {
          const factor = currentDistance / initialTouchDistance;
          viewArray[2] = initialZoom * factor;
          viewArray[2] = Math.max(0.1, Math.min(viewArray[2], 100.0)); // ズーム制限
          viewArray[3] = 1;
          // updateUniforms();
          // render();
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
};
