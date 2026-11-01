// src/js/util/tiny.js
var isString = (obj) => (typeof obj)[0] == "s";
function Tiny() {
}
var $ = (selector) => {
  if (isString(selector)) {
    if (selector[0] == "<") {
      var container = document.createElement("div");
      container.innerHTML = selector;
      selector = container.childNodes;
    } else {
      selector = document.querySelectorAll(selector);
    }
  } else {
    selector = selector[Symbol.iterator] ? selector : [selector];
  }
  var tiny = new Tiny();
  [].push.apply(tiny, selector);
  return tiny;
};
Tiny.prototype = {
  on: function(events, func) {
    return this.each((elem) => {
      events.split(/\s/).forEach((e) => {
        elem.addEventListener(e, func, false);
      });
    });
  },
  off: function(events, func, opt) {
    return this.each((elem) => {
      events.split(/\s/).forEach((e) => {
        elem.removeEventListener(e, func, opt);
      });
    });
  },
  one: function(event, func) {
    var elems = this;
    var once = (e) => {
      func(e);
      elems.off(event, once);
    };
    return elems.on(event, once);
  },
  fire: function(event, opt) {
    return this.each((elem) => {
      elem.dispatchEvent(new CustomEvent(event, opt));
    });
  },
  each: function(callback) {
    [].forEach.call(this, callback);
    return this;
  },
  boundRect: function() {
    return this[0]?.getBoundingClientRect();
  },
  css: function(obj) {
    return this.each((elem) => {
      for (var name in obj) {
        elem.style[name] = obj[name];
      }
    });
  },
  html: function(htm) {
    var elems = this;
    return htm != void 0 ? elems.each((elem) => {
      elem.innerHTML = htm;
    }) : elems[0] ? elems[0].innerHTML : "";
  },
  addClass: function(cls) {
    return this.each((elem) => {
      elem.classList.add(cls);
    });
  },
  removeClass: function(cls) {
    return this.each((elem) => {
      elem.classList.remove(cls);
    });
  },
  // hasClass: function (cls) {
  //   return this.length ? this[0].classList.contains(cls) : "";
  // },
  // toggleClass: function (cls) {
  //   return this.each((elem) => {
  //     elem.classList.toggle(cls);
  //   });
  // },
  Append: function(children) {
    return this.each((elem) => {
      if (isString(children)) {
        children = $(children);
      }
      children.each((child) => {
        elem.appendChild(child);
      });
    });
  },
  Remove: function() {
    return this.each((elem) => {
      if (elem && elem.parentNode) {
        elem.parentNode.removeChild(elem);
      }
    });
  },
  attr: function(obj) {
    var elems = this;
    return !isString(obj) ? elems.each((elem) => {
      for (var name in obj) {
        elem.setAttribute(name, obj[name]);
      }
    }) : elems[0] ? elems[0].getAttribute(obj) : "";
  },
  isChildOf: function(sel) {
    for (var i = this.length; i--; ) {
      var target = this[i];
      while (target && target.nodeType == 1) {
        if (target.matches(sel)) {
          return $(target);
        }
        target = target.parentNode;
      }
    }
    return false;
  }
  // anime: function (obj, duration = 500, easing, d = 20) {
  //   return this.each((elem) => {
  //     elem.style[obj.name] = obj.from;
  //     if (/^max/.test(obj.name)) elem.style.overflow = "hidden";
  //     delay(() => {
  //       elem.style.transition = duration + "ms " + (easing || "");
  //       elem.style[obj.name] = obj.to;
  //       delay(() => {
  //         elem.style.transition = "";
  //         elem.style[obj.name] = "";
  //       }, duration);
  //     }, d);
  //   });
  // },
};
var tiny_default = $;

// src/js/util/calc.js
var scale = (z) => {
  return Math.pow(2, z) * 3e-5;
};

// src/js/util/mouseevents.js
var isDragging = false;
var previousMousePosition = { x: 0, y: 0 };
var scaleZ = scale(16);
var mouseevents_default = (viewArray2) => {
  const canvas2 = document.getElementById("a");
  const v = document.getElementById("zoom");
  const view = () => {
    requestAnimationFrame(view);
    if (!viewArray2[3]) return;
    v.innerText = `zoom: ${viewArray2[2].toFixed(2)}, x:${viewArray2[0].toFixed(2)}, y:${viewArray2[1].toFixed(2)}`;
  };
  view();
  canvas2.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const rect = canvas2.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) / rect.width * 2 - 1;
      const mouseY = -((e.clientY - rect.top) / rect.height * 2 - 1);
      const zoomFactor = 1.1;
      const oldScale = scaleZ;
      var dz = e.deltaY;
      dz = dz > 5 ? 5 : dz < -5 ? -5 : dz;
      var z = viewArray2[2] - dz / 100;
      z = Math.max(10, Math.min(z, 20));
      if (viewArray2[2] == z) return;
      viewArray2[2] = z;
      scaleZ = scale(z);
      viewArray2[0] += mouseX / oldScale - mouseX / scaleZ;
      viewArray2[1] += mouseY / oldScale - mouseY / scaleZ;
      viewArray2[3] = 1;
    },
    { passive: false }
  );
  canvas2.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    }
  });
  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;
    const ndcX = deltaX / canvas2.width * 2 * (canvas2.width / window.innerWidth);
    const ndcY = -(deltaY / canvas2.height) * 2 * (canvas2.height / window.innerHeight);
    viewArray2[0] -= ndcX / scaleZ;
    viewArray2[1] -= ndcY / scaleZ;
    previousMousePosition = { x: e.clientX, y: e.clientY };
    viewArray2[3] = 1;
  });
  window.addEventListener("mouseup", () => {
    isDragging = false;
  });
  let initialTouchDistance = 0;
  let initialZoom = 1;
  function getTouchDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  canvas2.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        isDragging = true;
        previousMousePosition = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY
        };
      } else if (e.touches.length === 2) {
        isDragging = false;
        initialTouchDistance = getTouchDistance(e.touches[0], e.touches[1]);
        initialZoom = viewArray2[2];
      }
    },
    { passive: false }
  );
  canvas2.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && isDragging) {
        const deltaX = e.touches[0].clientX - previousMousePosition.x;
        const deltaY = e.touches[0].clientY - previousMousePosition.y;
        const ndcX = deltaX / canvas2.width * 2 * (canvas2.width / window.innerWidth);
        const ndcY = -(deltaY / canvas2.height) * 2 * (canvas2.height / window.innerHeight);
        viewArray2[0] -= ndcX / viewArray2[2];
        viewArray2[1] -= ndcY / viewArray2[2];
        previousMousePosition = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY
        };
        viewArray2[3] = 1;
      } else if (e.touches.length === 2) {
        const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
        if (initialTouchDistance > 0) {
          const factor = currentDistance / initialTouchDistance;
          viewArray2[2] = initialZoom * factor;
          viewArray2[2] = Math.max(0.1, Math.min(viewArray2[2], 100));
          viewArray2[3] = 1;
        }
      }
    },
    { passive: false }
  );
  canvas2.addEventListener("touchend", (e) => {
    e.preventDefault();
    isDragging = false;
    initialTouchDistance = 0;
  });
};

// src/js/index.js
var sab = new SharedArrayBuffer(16);
var viewArray = new Float32Array(sab);
viewArray[0] = 0;
viewArray[1] = 0;
viewArray[2] = 16;
viewArray[3] = 1;
var canvas = tiny_default("canvas");
canvas[0].width = 800;
canvas[0].height = 1200;
canvas.css({ width: "400px", height: "400px" });
var offcanvas = canvas[0].transferControlToOffscreen();
var worker = new Worker("/js/worker.js");
worker.postMessage({ "c": offcanvas, "s": [800, 800], "b": sab }, [offcanvas]);
mouseevents_default(viewArray);
