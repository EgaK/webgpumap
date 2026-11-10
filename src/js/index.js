import $ from "./util/tiny";
import mouseevents from "./util/mouseevents";
import context from "./util/context";
import { init, resize } from "./util/controller";

const worker = init(400, 400);

const pTime = $("#time");

$(worker).on("message", (e) => {
  if (e.data["e"]) {
    alert(e.data["e"]);
  }
  if (e.data["d"]) {
    // console.log("main received data:", e.data["d"]);
  }
  if (e.data["t"]) {
    pTime[0].innerText =
      "地図描画時間：" + (e.data["t"] * 1e3).toFixed(3) + "μs";
  }
});

const container = document.getElementById("m");
mouseevents(container);

$("#resize").on("click", () => {
  resize(400, 600);
});
$("#resize2").on("click", () => {
  resize(400, 400);
});
