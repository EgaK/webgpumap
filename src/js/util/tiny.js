// import { delay } from "./delay";

var isString = (obj) => (typeof obj)[0] == "s";
function Tiny() {}

export default (selector) => {
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
  on: function (events, func) {
    return this.each((elem) => {
      events.split(/\s/).forEach((e) => {
        elem.addEventListener(e, func, false);
      });
    });
  },

  off: function (events, func, opt) {
    return this.each((elem) => {
      events.split(/\s/).forEach((e) => {
        elem.removeEventListener(e, func, opt);
      });
    });
  },

  one: function (event, func) {
    var elems = this;
    var once = (e) => {
      func(e);
      elems.off(event, once);
    };
    return elems.on(event, once);
  },

  fire: function (event, opt) {
    return this.each((elem) => {
      elem.dispatchEvent(new CustomEvent(event, opt));
    });
  },

  each: function (callback) {
    [].forEach.call(this, callback);
    return this;
  },

  boundRect: function () {
    return this[0]?.getBoundingClientRect();
  },

  css: function (obj) {
    return this.each((elem) => {
      for (var name in obj) {
        elem.style[name] = obj[name];
      }
    });
  },

  html: function (htm) {
    var elems = this;
    return htm != undefined
      ? elems.each((elem) => {
          elem.innerHTML = htm;
        })
      : elems[0]
        ? elems[0].innerHTML
        : "";
  },

  addClass: function (cls) {
    return this.each((elem) => {
      elem.classList.add(cls);
    });
  },

  removeClass: function (cls) {
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

  Append: function (children) {
    return this.each((elem) => {
      if (isString(children)) {
        children = $(children);
      }
      children.each((child) => {
        elem.appendChild(child);
      });
    });
  },

  Remove: function () {
    return this.each((elem) => {
      if (elem && elem.parentNode) {
        elem.parentNode.removeChild(elem);
      }
    });
  },

  attr: function (obj) {
    var elems = this;
    return !isString(obj)
      ? elems.each((elem) => {
          for (var name in obj) {
            elem.setAttribute(name, obj[name]);
          }
        })
      : elems[0]
        ? elems[0].getAttribute(obj)
        : "";
  },

  isChildOf: function (sel) {
    // forでまわしてるのは、途中で抜けるため
    for (var i = this.length; i--;) {
      var target = this[i];
      while (target && target.nodeType == 1) {
        if (target.matches(sel)) {
          return $(target);
        }
        target = target.parentNode;
      }
    }
    return false;
  },

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
