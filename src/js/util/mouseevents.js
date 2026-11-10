import $ from "./tiny";
import { scale } from "./calc";
import context from "./context";
import { setCenter, setZoom } from "./controller";

export default (container) => {
  container = $(container);

  container
    .on(
      "wheel",
      (e) => {
        e.preventDefault();

        // 基準ズーム(z=10)の「タイル1枚の幅」を現在の画面ピクセル数に換算したスケール
        const oldScale = context.scaleZ;

        var dz = e.deltaY;
        dz = dz > 5 ? 5 : dz < -5 ? -5 : dz;
        var z = context.zoom - dz / 100;
        z = Math.max(10, Math.min(z, 20));
        if (context.zoom == z) return;

        setZoom(z);

        const dx = context.mapWidth / 2 - e.offsetX;
        const dy = context.mapHeight / 2 - e.offsetY;

        const x = context.centerX + dx / context.scaleZ - dx / oldScale;
        const y = context.centerY + dy / context.scaleZ - dy / oldScale;

        setCenter(x, y);
      },
      { passive: false },
    )
    .on("mousedown", (e) => {
      const startCenterX = context.centerX;
      const startCenterY = context.centerY;
      const startX = e.offsetX;
      const startY = e.offsetY;
      const fnc = (e) => {
        const x = startCenterX + (startX - e.offsetX) / context.scaleZ;
        const y = startCenterY + (startY - e.offsetY) / context.scaleZ;
        setCenter(x, y);
      };
      container.on("mousemove", fnc).one("mouseup", () => {
        container.off("mousemove", fnc);
      });
    });
};
/*
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

export default () => {
  const canvas = document.getElementById("a");

  // ------------------------------------------
  // 7. マウス・ホイールイベントの追加
  // ------------------------------------------
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();

      // 基準ズーム(z=10)の「タイル1枚の幅」を現在の画面ピクセル数に換算したスケール
      const oldScale = context.scaleZ;

      var dz = e.deltaY;
      dz = dz > 5 ? 5 : dz < -5 ? -5 : dz;
      var z = viewArray[2] - dz / 100;
      z = Math.max(10, Math.min(z, 20));
      if (viewArray[2] == z) return;

      setZoom(z);

      const dx = context.mapWidth / 2 - e.offsetX;
      const dy = context.mapHeight / 2 - e.offsetY;

      const x = context.centerX + dx / context.scaleZ - dx / oldScale;
      const y = context.centerY + dy / context.scaleZ - dy / oldScale;

      setCenter(x, y);
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
    const dx = deltaX / context.scaleZ;
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
*/
