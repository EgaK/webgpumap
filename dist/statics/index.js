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

// src/js/index.js
(async () => {
  if (!navigator.gpu) {
    alert("\u304A\u4F7F\u3044\u306E\u30D6\u30E9\u30A6\u30B6\u306E\u30D0\u30FC\u30B8\u30E7\u30F3\u304C\u53E4\u3044\u305F\u3081\u5730\u56F3\u304C\u8868\u793A\u3055\u308C\u307E\u305B\u3093");
    return;
  }
  const canvas = tiny_default("canvas");
  canvas[0].width = 800;
  canvas[0].height = 800;
  canvas.css({ width: "400px", height: "400px" });
  const offcanvas = canvas[0].transferControlToOffscreen();
  var worker;
  if (true) {
    worker = new Worker("/worker.js");
  } else {
    var blob = new Blob([0], { type: "application/javascript" });
    var workerUrl = URL.createObjectURL(blob);
    worker = new Worker(workerUrl);
  }
  worker.postMessage({ canvas: offcanvas, size: [800, 800] }, [offcanvas]);
  const container = tiny_default("#m");
  container.on("mousedown touchstart", (e) => {
    e.preventDefault();
    var listener = (e2) => {
      worker.postMessage({ pos: [e2.layerX * 2, e2.layerY * 2] });
    };
    container.on("mousemove touchmove", listener);
    container.one("mouseup touchend", () => {
      container.off("mousemove", listener);
    });
  });
  const btn = tiny_default("button");
  btn.on("click", () => {
    worker.postMessage({ size: [800, 800] });
  });
})();
