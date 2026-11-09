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

// src/js/util/constants.js
var baseTile = {
  baseTileZ: 10,
  baseTileX: 879,
  baseTileY: 410,
  tileSizePixels: 1024
};

// src/js/util/calc.js
var { baseTileZ, baseTileX, baseTileY, tileSizePixels } = baseTile;
var scale = (z) => {
  return tileSizePixels / 2 * Math.pow(2, z - baseTileZ);
};

// src/js/util/context.js
var context_default = {};

// src/js/util/mouseevents.js
var isDragging = false;
var previousMousePosition = { x: 0, y: 0 };
var scaleZ = scale(15);
var mouseevents_default = (viewArray2) => {
  const canvas2 = document.getElementById("a");
  const v = document.getElementById("zoom");
  const view = () => {
    requestAnimationFrame(view);
    if (!viewArray2[3]) return;
    v.innerText = `zoom: ${viewArray2[2].toFixed(2)}, x:${viewArray2[0].toFixed(8)}, y:${viewArray2[1].toFixed(8)}`;
  };
  view();
  canvas2.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const oldScale = scaleZ;
      var dz = e.deltaY;
      dz = dz > 5 ? 5 : dz < -5 ? -5 : dz;
      var z = viewArray2[2] - dz / 100;
      z = Math.max(10, Math.min(z, 20));
      if (viewArray2[2] == z) return;
      viewArray2[2] = z;
      scaleZ = scale(z);
      const x = context_default.mapWidth / 2 - e.offsetX;
      const y = context_default.mapHeight / 2 - e.offsetY;
      viewArray2[0] -= x / oldScale - x / scaleZ;
      viewArray2[1] -= y / oldScale - y / scaleZ;
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
    viewArray2[0] -= deltaX / scaleZ;
    viewArray2[1] -= deltaY / scaleZ;
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
viewArray[0] = 1.984375;
viewArray[1] = 1.890625;
viewArray[2] = 15;
viewArray[3] = 1;
context_default.mapWidth = 400;
context_default.mapHeight = 400;
var canvas = tiny_default("canvas");
canvas[0].width = context_default.mapWidth * 2;
canvas[0].height = context_default.mapHeight * 2;
canvas.css({
  width: context_default.mapWidth + "px",
  height: context_default.mapHeight + "px"
});
var offcanvas = canvas[0].transferControlToOffscreen();
var blob = new Blob(['function aa(a,b){var c=C,k=c.createBuffer({size:1572864,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST}),d=0,e=[];for(var f=0;f<4;f++){var g=a[0][f];g.length?(e.push(d),d+=g.length*2):e.push(0)}f=d;g=[];var l=[];for(let m=0;m<4;m++){let n=a[1][m],p=n.length;p%2!=0&&(n.push(n[p-1]),p++);g.push(f);f+=n.length*2;l.push(p)}c.queue.writeBuffer(k,0,new Int16Array([].concat(...a[0])));c.queue.writeBuffer(k,d,new Uint16Array([].concat(...a[1])));console.log(Math.ceil([].concat(...a[0],\n...a[1]).length/512)+"KB");return{Y:b,buffer:k,X:e,U:g,N:l}}function D(a,b){this.x=a;this.y=b}function ba(a,b){a.x/=b;a.y/=b;return a}\nD.prototype={clone(){return new D(this.x,this.y)},add(a){var b=this.clone();b.x+=a.x;b.y+=a.y;return b},sub(a){var b=this.clone();b.x-=a.x;b.y-=a.y;return b},div(a){return ba(this.clone(),a)},rotate(a){var b=this.clone(),c=Math.cos(a);a=Math.sin(a);var k=a*b.x+c*b.y;b.x=c*b.x-a*b.y;b.y=k;return b},unit(){var a=this.clone();ba(a,Math.sqrt(a.x*a.x+a.y*a.y));return a},round(){var a=this.clone();a.x=Math.round(a.x);a.y=Math.round(a.y);return a},equals(a){return this.x===a.x&&this.y===a.y},angle(){return Math.atan2(this.y,\nthis.x)},constructor:D};function ca(a){if(a.J<0)console.log("feature has no geometry");else{var b=a.D;b.i=a.J;for(var c=F(b)+b.i,k=[],d,e=1,f=0,g=0,l=0;b.i<c;){if(f<=0&&(f=F(b),e=f&7,f>>=3,f===0))continue;f--;if(e===1)g+=G(b),l+=G(b),d&&k.push(d),d=[new D(g,l)];else if(e===2)g+=G(b),l+=G(b),d&&d.push(new D(g,l));else if(e===7)d&&d.push(d[0].clone());else{console.log(`unknown command ${e}`);return}}d&&k.push(d);return{lines:k,F:a.F}}}\nvar da=class{constructor(a,b,c,k,d){this.F=Object.create(null);this.M=c;this.type=0;this.id=void 0;this.D=a;this.J=-1;this.K=k;for(this.L=d;a.i<b;)if(c=F(a),c===8)this.id=F(a);else if(c===18)for(c=F(a)+a.i;a.i<c;){let e=k[F(a)],f=d[F(a)];this.F[e]=f}else c===24?this.type=F(a):(c===34&&(this.J=a.i),M(a,c))}};function ea(a,b){if(b<0||b>=a.H.length)console.log("feature index out of bounds");else return a.D.i=a.H[b],b=F(a.D)+a.D.i,new da(a.D,b,a.M,a.K,a.L)}\nvar ia=class{constructor(a,b){this.version=1;this.name="";this.M=4096;this.length=0;this.D=a;this.K=[];this.L=[];this.H=[];b===void 0&&(b=a.length);for(;a.i<b;){var c=F(a);if(c===10)this.name=fa(a);else if(c===18)this.H.push(a.i),M(a,c);else if(c===26)this.K.push(fa(a));else if(c===34){c=this.L;var k=c.push;{var d=a;var e=null;let f=F(d)+d.i;for(;d.i<f;)e=F(d),e===10?e=fa(d):e===21?(e=ha(d.v,d.i,23,4),d.i+=4):e===25?(e=ha(d.v,d.i,52,8),d.i+=8):e=e===32?F(d,!0):e===40?F(d):e===48?G(d):e===56?!!F(d):\n(M(d,e),null);e==null?(console.log("unknown feature value"),d=void 0):d=e}k.call(c,d)}else c===40?this.M=F(a):c===120?this.version=F(a):M(a,c)}this.length=this.H.length}},ja=class{constructor(a,b=a.length){for(var c=Object.create(null);a.i<b;){var k=F(a);k===26?(k=new ia(a,F(a)+a.i),k.length&&(c[k.name]=k)):M(a,k)}this.V=c}},ha=(a,b,c,k)=>{var d=k*8-c-1;var e=(1<<d)-1,f=e>>1,g=-7,l=k-1,m=a[b+l];l+=-1;k=m&(1<<-g)-1;m>>=-g;for(g+=d;g>0;k=k*256+a[b+l],l+=-1,g-=8);d=k&(1<<-g)-1;k>>=-g;for(g+=c;g>0;d=\nd*256+a[b+l],l+=-1,g-=8);if(k===0)k=1-f;else{if(k===e)return d?NaN:(m?-1:1)*Infinity;d+=Math.pow(2,c);k-=f}return(m?-1:1)*d*Math.pow(2,k-c)};function ka(a){this.v=ArrayBuffer.isView&&ArrayBuffer.isView(a)?a:new Uint8Array(a||0);this.type=this.i=0;this.length=this.v.length}\nfunction F(a,b){var c=a.v;var k=c[a.i++];var d=k&127;if(k<128)return d;k=c[a.i++];d|=(k&127)<<7;if(k<128)return d;k=c[a.i++];d|=(k&127)<<14;if(k<128)return d;k=c[a.i++];d|=(k&127)<<21;if(k<128)return d;k=c[a.i];return la(d|(k&15)<<28,b,a)}function M(a,b){b&=7;if(b===0)for(;a.v[a.i++]>127;);else b===2?a.i=F(a)+a.i:b===5?a.i+=4:b===1?a.i+=8:console.log("Unimplemented type: "+b)}function G(a){a=F(a);return a%2===1?(a+1)/-2:a/2}\nfunction fa(a){var b=F(a)+a.i;var c=a.v;for(var k="",d=a.i;d<b;){var e=c[d],f=null,g=e>239?4:e>223?3:e>191?2:1;if(d+g>b)break;if(g===1)e<128&&(f=e);else if(g===2){var l=c[d+1];(l&192)===128&&(f=(e&31)<<6|l&63,f<=127&&(f=null))}else if(g===3){l=c[d+1];var m=c[d+2];(l&192)===128&&(m&192)===128&&(f=(e&15)<<12|(l&63)<<6|m&63,f<=2047||f>=55296&&f<=57343)&&(f=null)}else if(g===4){l=c[d+1];m=c[d+2];var n=c[d+3];(l&192)===128&&(m&192)===128&&(n&192)===128&&(f=(e&15)<<18|(l&63)<<12|(m&63)<<6|n&63,f<=65535||\nf>=1114112)&&(f=null)}f===null?(f=65533,g=1):f>65535&&(f-=65536,k+=String.fromCharCode(f>>>10&1023|55296),f=56320|f&1023);k+=String.fromCharCode(f);d+=g}c=k;a.i=b;return c}ka.prototype={destroy:function(){this.v=null}};\nvar la=(a,b,c)=>{var k=c.v;var d=k[c.i++];var e=(d&112)>>4;if(d<128)return O(a,e,b);d=k[c.i++];e|=(d&127)<<3;if(d<128)return O(a,e,b);d=k[c.i++];e|=(d&127)<<10;if(d<128)return O(a,e,b);d=k[c.i++];e|=(d&127)<<17;if(d<128)return O(a,e,b);d=k[c.i++];e|=(d&127)<<24;if(d<128)return O(a,e,b);d=k[c.i++];e|=(d&1)<<31;if(d<128)return O(a,e,b);console.log("Expected varint not more than 10 bytes")},O=(a,b,c)=>c?b*4294967296+(a>>>0):(b>>>0)*4294967296+(a>>>0),P=new Set,ma=!1;\nfunction na(a,b){var c=b&&b.length,k=c?b[0]*2:a.length;P.size&&P.clear();var d=oa(a,0,k,!0),e=[];if(!d||d.next===d.j)return e;var f=0,g=0,l=0;if(c){c=d;d=[];for(let p=0,r=b.length;p<r;p++){var m=oa(a,b[p]*2,p<r-1?b[p+1]*2:a.length,!1);m===m.next&&P.add(m);var n=m;let q=m;do{if(n.x<q.x||n.x===q.x&&n.y<q.y)q=n;n=n.next}while(n!==m);d.push(q)}d.sort(pa);b=b.length;b=Math.ceil((a.length/2+2*b)/qa)+b+2;Q.length<b*4&&(Q=new Float64Array(b*4));ra=0;sa(c,c);ta=!0;for(b=0;b<d.length;b++)a:{m=d[b];n=c;c=ua(m,\nn);if(!c){c=n;break a}m=wa(c,m);sa(c,m.next.next);R(m,m.next);c=R(c,c.next)}ta=!1;d=R(c)}if(a.length>160){f=a[0];g=a[1];l=f;c=g;for(b=2;b<k;b+=2)m=a[b],n=a[b+1],m<f&&(f=m),n<g&&(g=n),m>l&&(l=m),n>c&&(c=n);l=Math.max(l-f,c-g);l=l!==0?32767/l:0}xa(d,e,f,g,l);return e}\nfunction oa(a,b,c,k){var d=null,e=0;for(let f=b,g=c-2;f<c;f+=2)e+=(a[g]-a[f])*(a[f+1]+a[g+1]),g=f;if(k===e>0)for(;b<c;b+=2)d=ya(b/2|0,a[b],a[b+1],d);else for(c-=2;c>=b;c-=2)d=ya(c/2|0,a[c],a[c+1],d);d&&S(d,d.next)&&(T(d),d=d.next);return d}function R(a,b=a){var c=b===a;do{var k=!1;if(!(a===a.next||P.size!==0&&P.has(a)||!S(a,a.next)&&U(a.j,a,a.next)!==0)){if(c||a===b)b=a.j;ma=!0;T(a);a=a.j;k=!0}else if(c||a!==b)a=a.next,k=!c}while(k||a!==b);return b}\nfunction xa(a,b,c,k,d){if(d){var e=a,f=e,g=0;do f.z=za(f.x,f.y,c,k,d),V[g++]=f,f=f.next;while(f!==e);e=g;if(e<=32)for(f=1;f<e;f++){for(var l=V[f],m=l.z,n=f-1;n>=0&&V[n].z>m;)V[n+1]=V[n],n--;V[n+1]=l}else{W.length<e&&(W=new Uint32Array(e),Aa=new Uint32Array(e),X=Array(e));for(f=0;f<e;f++)W[f]=V[f].z;Ba(e,V,W,X,Aa,0);Ba(e,X,Aa,V,W,8);Ba(e,V,W,X,Aa,16);Ba(e,X,Aa,V,W,24)}e=null;for(f=0;f<g;f++){l=V[f];if(l.C=e)e.A=l;e=l}e.A=null;V.fill(null,0,g);X.fill(null,0,g)}g=a;for(e=!1;a.j!==a.next;){f=a.j;l=a.next;\nif(m=U(f,a,l)<0)if(d)a:{var p=a.j;m=a.next;n=p.x;var r=a.x,q=m.x;p=p.y;var A=a.y,w=m.y,x=Math.min(n,r,q),z=Math.min(p,A,w),J=Math.max(n,r,q),N=Math.max(p,A,w),E=za(x,z,c,k,d),t=za(J,N,c,k,d);let u=a.C;for(;u&&u.z>=E;){if(u.x>=x&&u.x<=J&&u.y>=z&&u.y<=N&&u!==m&&(n!==u.x||p!==u.y)&&Ca(n,p,r,A,q,w,u.x,u.y)&&U(u.j,u,u.next)>=0){m=!1;break a}u=u.C}for(E=a.A;E&&E.z<=t;){if(E.x>=x&&E.x<=J&&E.y>=z&&E.y<=N&&E!==m&&(n!==E.x||p!==E.y)&&Ca(n,p,r,A,q,w,E.x,E.y)&&U(E.j,E,E.next)>=0){m=!1;break a}E=E.A}m=!0}else a:{m=\na.j;t=a.next;n=m.x;r=a.x;q=t.x;p=m.y;A=a.y;w=t.y;x=Math.min(n,r,q);z=Math.min(p,A,w);J=Math.max(n,r,q);N=Math.max(p,A,w);for(t=t.next;t!==m;){if(t.x>=x&&t.x<=J&&t.y>=z&&t.y<=N&&(n!==t.x||p!==t.y)&&Ca(n,p,r,A,q,w,t.x,t.y)&&U(t.j,t,t.next)>=0){m=!1;break a}t=t.next}m=!0}if(m)b.push(f.m,a.m,l.m),T(a),g=a=l;else if(a=l,a===g)if(ma=!1,a=R(a),ma)g=a;else if(e){a:{g=a;do{for(e=g.next.next;e!==g.j;){if(f=g.m!==e.m){f=S(g,e)&&U(g.j,g,g.next)>0&&U(e.j,e,e.next)>0;if(l=g.next.m!==e.m&&(f||Da(g,e)&&Da(e,g)&&\n(U(g.j,g,e.j)!==0||U(g,e.j,e)!==0))){b:{l=Math.min(g.x,e.x);m=Math.max(g.x,e.x);n=Math.min(g.y,e.y);r=Math.max(g.y,e.y);q=g;do{p=q.next;if(!(q.x>m&&p.x>m||q.x<l&&p.x<l||q.y>r&&p.y>r||q.y<n&&p.y<n)&&q.m!==g.m&&p.m!==g.m&&q.m!==e.m&&p.m!==e.m&&Ea(q,p,g,e)){l=!0;break b}q=p}while(q!==g);l=!1}l=!l}if(l){if(!f){f=g;l=!1;m=(g.x+e.x)/2;n=(g.y+e.y)/2;do r=f.next,f.y>n!==r.y>n&&m<(r.x-f.x)*(n-f.y)/(r.y-f.y)+f.x&&(l=!l),f=r;while(f!==g);f=l}l=f}f=l}if(f){a=wa(g,e);g=R(g,g.next);a=R(a,a.next);xa(g,b,c,k,d);\nxa(a,b,c,k,d);break a}e=e.next}g=g.next}while(g!==a)}break}else{g=b;e=a;f=!1;do l=e.j,m=e.next.next,Ea(l,e,e.next,m,!1)&&Da(l,m)&&Da(m,l)&&(g.push(l.m,e.m,m.m),T(e),T(e.next),e=a=m,f=!0),e=e.next;while(e!==a);g=a=f?R(e):e;e=!0}}}var ta=!1;function pa(a,b){return a.x-b.x||a.y-b.y||(a.next.y-a.y)/(a.next.x-a.x)-(b.next.y-b.y)/(b.next.x-b.x)}var qa=16,Q=new Float64Array(0),ra=0,Fa=[],Ga=[];\nfunction sa(a,b){do{var c=ra++;Fa[c]=a;let k=a.x,d=a.y,e=a.x,f=a.y,g=0;do{let l=a.next;a.z=c;l.x<k&&(k=l.x);l.x>e&&(e=l.x);l.y<d&&(d=l.y);l.y>f&&(f=l.y);a=l}while(++g<qa&&a!==b);Ga[c]=a;c*=4;Q[c]=k;Q[c+1]=d;Q[c+2]=e;Q[c+3]=f}while(a!==b)}function Ha(a){for(var b=Ga[a];b.j.next!==b;)b=b.next;return Ga[a]=b}function Ia(a){for(var b=Fa[a];b.j.next!==b;)b=b.next;return Fa[a]=b}\nfunction ua(a,b){var c=a.x,k=a.y,d=-Infinity;if(S(a,b))return b;for(let p=0,r=0;p<ra;p++,r+=4){if(k<Q[r+1]||k>Q[r+3]||Q[r]>c||Q[r+2]<=d)continue;var e=Ha(p);b=Ia(p);do{if(b.j.next===b){if(S(a,b.next))return b.next;if(k<=b.y&&k>=b.next.y&&b.next.y!==b.y){var f=b.x+(k-b.y)*(b.next.x-b.x)/(b.next.y-b.y);if(f<=c&&f>d){d=f;var g=b.x<b.next.x?b:b.next;if(f===c)return g}}}b=b.next}while(b!==e)}if(!g)return null;e=g.x;f=g.y;var l=Math.min(k,f),m=Math.max(k,f),n=Infinity;for(let p=0,r=0;p<ra;p++,r+=4){if(Q[r+\n2]<e||Q[r]>c||Q[r+3]<l||Q[r+1]>m)continue;let q=Ha(p);b=Ia(p);do{if(b.j.next===b&&c>=b.x&&b.x>=e&&c!==b.x&&Ca(k<f?c:d,k,e,f,k<f?d:c,k,b.x,b.y)){let A=Math.abs(k-b.y)/(c-b.x);(Da(b,a)||b.y===k&&b.next.y===k&&b.next.x>c)&&(A<n||A===n&&(b.x>g.x||b.x===g.x&&U(g.j,g,b.j)<0&&U(b.next,g,g.next)<0))&&(g=b,n=A)}b=b.next}while(b!==q)}return g}var V=[],X=[],W=new Uint32Array(0),Aa=new Uint32Array(0),Ja=new Uint32Array(256);\nfunction Ba(a,b,c,k,d,e){Ja.fill(0);for(var f=0;f<a;f++)Ja[c[f]>>>e&255]++;f=0;for(var g=0;g<256;g++){var l=Ja[g];Ja[g]=f;f+=l}for(f=0;f<a;f++)g=c[f],l=Ja[g>>>e&255]++,k[l]=b[f],d[l]=g}function za(a,b,c,k,d){a=(a-c)*d|0;b=(b-k)*d|0;a=(a|a<<8)&16711935;a=(a|a<<4)&252645135;a=(a|a<<2)&858993459;b=(b|b<<8)&16711935;b=(b|b<<4)&252645135;b=(b|b<<2)&858993459;return(a|a<<1)&1431655765|((b|b<<1)&1431655765)<<1}\nfunction Ca(a,b,c,k,d,e,f,g){return(d-f)*(b-g)>=(a-f)*(e-g)&&(a-f)*(k-g)>=(c-f)*(b-g)&&(c-f)*(e-g)>=(d-f)*(k-g)}function U(a,b,c){return(b.y-a.y)*(c.x-b.x)-(b.x-a.x)*(c.y-b.y)}function S(a,b){return a.x===b.x&&a.y===b.y}function Ea(a,b,c,k,d=!0){var e=U(a,b,c),f=U(a,b,k),g=U(c,k,a),l=U(c,k,b);return(e>0&&f<0||e<0&&f>0)&&(g>0&&l<0||g<0&&l>0)?!0:d?e===0&&Ka(a,c,b)||f===0&&Ka(a,k,b)||g===0&&Ka(c,a,k)||l===0&&Ka(c,b,k)?!0:!1:!1}\nfunction Ka(a,b,c){return b.x<=Math.max(a.x,c.x)&&b.x>=Math.min(a.x,c.x)&&b.y<=Math.max(a.y,c.y)&&b.y>=Math.min(a.y,c.y)}function Da(a,b){return U(a.j,a,a.next)<0?U(a,b,a.next)>=0&&U(a,a.j,b)>=0:U(a,b,a.j)<0||U(a,a.next,b)<0}function wa(a,b){var c=La(a.m,a.x,a.y),k=La(b.m,b.x,b.y),d=a.next,e=b.j;a.next=b;b.j=a;c.next=d;d.j=c;k.next=c;c.j=k;e.next=k;k.j=e;return k}function ya(a,b,c,k){a=La(a,b,c);k?(a.next=k.next,a.j=k,k.next.j=a,k.next=a):(a.j=a,a.next=a);return a}\nfunction T(a){a.next.j=a.j;a.j.next=a.next;a.C&&(a.C.A=a.A);a.A&&(a.A.C=a.C);if(ta){var b=a.next;a=a.j.z*4;b.x<Q[a]&&(Q[a]=b.x);b.y<Q[a+1]&&(Q[a+1]=b.y);b.x>Q[a+2]&&(Q[a+2]=b.x);b.y>Q[a+3]&&(Q[a+3]=b.y)}}function La(a,b,c){return{m:a,x:b,y:c,j:null,next:null,z:0,C:null,A:null}}\nvar Ma=(...a)=>{for(var b={},c=0;c<a.length;c+=2)b[a[c]]=a[c+1];self.postMessage(b)},Na=[{l:"l",o:"t",u:[.59,.59,.59],B:[[15,20],[18,50]]},{l:"f",o:"b",u:[.94,.96,.94],B:1,G:[[14,0],[17,1]]},{l:"l",o:"r1",u:[.39,.39,.39],B:1,G:[[16,0],[18,1]]},{l:"l",o:"r2",u:[.77,.63,0],B:1},{l:"f",o:"r5",u:[1,1,1]},{l:"f",o:"r3",u:[1,.77,.6]},{l:"l",o:"r8",u:[1,.77,.6],B:[[10,5],[13,10]]},{l:"f",o:"r4",u:[.93,.86,.58]},{l:"l",o:"r9",u:[.93,.86,.58],B:[[10,5],[16,30]]},{l:"l",o:"r6",u:[.39,.39,.39],B:2},{l:"f",o:"w",\nu:[.66,.86,1]},{l:"f",o:"g",u:[.8,.93,.66]},{l:"p",o:"c",u:[.4,.4,.4],I:14,Z:10},{l:"p",o:"rt",I:12,O:{border:"1px solid #fff","border-radius":"4px 4px 50% 50%",background:"#06a",padding:"5px",color:"#fff"}},{l:"p",o:"d",u:[.4,.4,.4],I:12,G:[[13,0],[14,1]]},{l:"s",o:"p"}],Oa=async a=>{function b(t,u,B){for(var I=[],y=0;y<t.length;y++){let K=ea(t,y),v=ca(K),H=v.F.c,L=v.F.t;H=="bs"&&L&&(L=L.replace("S","\\u897f\\u80a5\\u30d0\\u30b9").replace("W","\\u662d\\u548c\\u30d0\\u30b9"));I.push({p:v.lines[0][0],t:K.F.n,\nd:L,c:H})}Ma("d",{f:I,p:{type:u.l,layer:u.o,color:u.u,size:u.I,opacity:u.G,css:u.O},z:B})}function c(t){var u=0;for(let B=0;B<t.length;B++){let I=t[B],y=t[(B+1)%t.length];u+=(y[0]-I[0])*(y[1]+I[1])}return u<0}function k(t,u){var B=u.P,I=u.B||0;if(u.l=="f")for(u=0;u<t.length;u++){var y=ea(t,u);if(y.type!==3)continue;var K=ca(y).lines;y=[];for(var v of K){if(v.length===0)continue;K=v.map(H=>[H.x,H.y]);c(K)?(y.length>0&&e(y,B,I),y=[K]):y.push(K)}y.length>0&&e(y,B,I)}else for(u=0;u<t.length;u++){v=ea(t,\nu);if(v.type!==2)continue;v=ca(v).lines;for(y of v){if(y.length===0)continue;v=y.map(H=>[H.x,H.y]);I!=1?f(v,B):d(v,B)}}}function d(t,u){for(let B=0;B<t.length;B++)A.push(...t[B],u,0),B<t.length-1&&w.push(x+B,x+B+1);x+=t.length}function e(t,u,B){var I=[],y=[],K=0;for(let v=0;v<t.length;v++){let H=t[v];if(H.length){v>0&&y.push(K);for(let L=0;L<H.length;L++){let va=H[L];I.push(va[0],va[1]);g.push(...va,u,0);K++;B>0&&n.push(p+L,p+(L+1==H.length?0:L+1))}p+=H.length}}t=na(I,y);t.length&&(t.forEach(v=>{m.push(l+\nv)}),l+=K)}function f(t,u){var B=t.length;if(!(B<2))for(let I=0;I<B-1;I++){let y=t[I],K=t[I+1],v=r.length/6,H=K[0]-y[0],L=-K[1]+y[1];r.push(...y,u,L,-H,0);r.push(...y,u,-L,H,0);r.push(...K,u,-L,H,0);r.push(...K,u,L,-H,0);q.push(v,v+1,v+2,v+2,v+3,v);I>0&&q.push(v,v-1,v+1,v+1,v-2,v)}}var g=[],l=0,m=[],n=[],p=0,r=[],q=[],A=[],w=[],x=0,z=await fetch("https://192.168.11.2/t/"+a.join("/"));z=await new ka(await z.arrayBuffer());z=(new ja(z)).V;for(var J=Na.length;J--;){var N=Na[J],E=z[N.o];E&&(/p|s/.test(N.l)?\nb(E,N,a):k(E,N))}return[[g,[],A,r],[m,n,w,q]]},Pa=(a,b,c,k,d,e,f,g="fs_main",l,m={compare:"equal",passOp:"keep",failOp:"keep",depthFailOp:"keep"})=>{var n=C;a={layout:n.createPipelineLayout({bindGroupLayouts:[a]}),vertex:{module:c,entryPoint:k,buffers:[{arrayStride:d,stepMode:"vertex",attributes:e.map((p,r)=>({shaderLocation:r,offset:p[0],format:p[1]}))}]},fragment:{module:c,entryPoint:g,targets:[{format:b,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",\ndstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:f,cullMode:"none"},depthStencil:{format:"depth24plus-stencil8",depthWriteEnabled:!l,depthCompare:l?"always":"greater",stencilFront:m,stencilBack:m},multisample:{count:4}};l&&delete a.vertex.buffers;return n.createRenderPipeline(a)},Qa,Ra,Sa,Ta;({T:Qa,R:Ra,S:Sa,W:Ta}={T:10,R:879,S:410,W:1024});\nvar Ua=(a,b,c,k,d,e,f,g,l)=>{f=Ta*Math.pow(2,f-Qa);g=f/g*2;l=f/l*2;a-=Qa;f=1/Math.pow(2,a);return new Float32Array([f/k*g,0,0,-(f/k)*l,((b-Ra*Math.pow(2,a))*f-d)*g,-((c-Sa*Math.pow(2,a))*f-e)*l])},Y,Z,C,Va,Wa;self.onmessage=async a=>{a.data.c?(Y=a.data.c,Z=a.data.s,a=new Float32Array(a.data.b),Xa(a)):a.data.s&&(Z=a.data.s,Y.width=Z[0],Y.height=Z[1],Ya())};\nasync function Xa(a){function b(){requestAnimationFrame(b);if(a[3]){var q=performance.now(),A=C.createCommandEncoder(),w=A.beginRenderPass({colorAttachments:[{view:Va.createView(),resolveTarget:k.getCurrentTexture().createView(),clearValue:{r:.96,g:.97,b:.98,a:1},loadOp:"clear",storeOp:"discard"}],depthStencilAttachment:{view:Wa.createView(),depthClearValue:0,depthLoadOp:"clear",depthStoreOp:"store",stencilClearValue:0,stencilLoadOp:"clear",stencilStoreOp:"store"}});C.queue.writeBuffer(m,0,new Float32Array([a[2]]));\nvar x=new Float32Array(r.length*64);w.setPipeline(f);for(var z=0;z<r.length;z++){var J=Ua(...r[z].Y,4096,a[0],a[1],a[2],...Z);x.set(J,z*64)}C.queue.writeBuffer(n,0,x);w.setPipeline(f);for(x=0;x<r.length;x++)w.setBindGroup(0,p,[x*256]),w.setStencilReference(x+1),w.draw(4,1,0,0);for(x=0;x<4;x++)for(z=[0,1,1,2],x!=2&&w.setPipeline(g[z[x]]),z=0;z<r.length;z++)J=r[z],J.N[x]>0&&(w.setBindGroup(0,p,[z*256]),w.setStencilReference(z+1),w.setVertexBuffer(0,J.buffer,J.X[x]),w.setIndexBuffer(J.buffer,"uint16",\nJ.U[x]),w.drawIndexed(J.N[x],1,0,0,0));w.end();C.queue.submit([A.finish()]);a[3]=0;Ma("t",performance.now()-q)}}if(C=await (await navigator.gpu?.requestAdapter())?.requestDevice()){C.pushErrorScope("validation");var c=await C.popErrorScope();c&&console.error("WebGPU \\u30d0\\u30ea\\u30c7\\u30fc\\u30b7\\u30e7\\u30f3\\u30a8\\u30e9\\u30fc:",c.message);C.lost.then(q=>{console.error(`WebGPU \\u30C7\\u30D0\\u30A4\\u30B9\\u304C\\u55AA\\u5931\\u3057\\u307E\\u3057\\u305F\\u3002\\u7406\\u7531: ${q.reason}`);console.error(`\\u30E1\\u30C3\\u30BB\\u30FC\\u30B8: ${q.message}`);\nq.reason==="destroyed"?console.log("\\u30c7\\u30d0\\u30a4\\u30b9\\u306f\\u610f\\u56f3\\u7684\\u306b\\u7834\\u68c4\\u3055\\u308c\\u307e\\u3057\\u305f\\u3002"):console.log("\\u30c7\\u30d0\\u30a4\\u30b9\\u3092\\u518d\\u521d\\u671f\\u5316\\u3057\\u307e\\u3059...")});var k=Y.getContext("webgpu");Y.width=Z[0];Y.height=Z[1];var d=navigator.gpu.getPreferredCanvasFormat();k.configure({device:C,format:d,alphaMode:"premultiplied"});c=C.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform"}},\n{binding:1,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform",hasDynamicOffset:!0}}]});var e=C.createShaderModule({code:"struct Vertex{@location(0)pos:vec2i,@location(1)style_id:i32,}struct eVertex{@location(0)pos:vec2i,@location(1)style_id:i32,@location(2)normal:vec2i,}struct Style{fillColor:vec3f,opacity:f32,lineColor:vec3f,thickness:f32,}struct ClampTable{min_zoom:f32,min_val:f32,max_zoom:f32,max_val:f32,};struct Uniforms{zoom:f32,pad0:f32,pad1:f32,pad2:f32,clamps:array<ClampTable,6>,padvec1:vec4f,styles:array<Style,12>}struct Transform{matrix:mat3x2f,tile_opacity:f32,}@group(0)@binding(0)var<uniform> uniforms:Uniforms;@group(0)@binding(1)var<uniform> transform:Transform;struct VertexOutput{@builtin(position)position:vec4f,@location(0)color:vec4f,@location(1)normal:vec2f,@location(2)pos:vec2f,}fn sheer(color:vec3f,o:f32)->vec4f{var opacity=o;if(opacity<0){let style=uniforms.clamps[u32(-opacity-1)];let t=clamp((uniforms.zoom-style.min_zoom)/(style.max_zoom-style.min_zoom),0.0,1.0);opacity=mix(style.min_val,style.max_val,t);}return vec4f(color,opacity);}@vertex fn vs_polygon(input:Vertex)->VertexOutput{var output:VertexOutput;let prop=uniforms.styles[input.style_id];let cam_pos=transform.matrix*vec3f(vec2f(input.pos),1.0);var z=f32(input.style_id+1)*1e-6;output.position=vec4f(cam_pos,z,1.0);output.color=sheer(prop.fillColor,prop.opacity);return output;}@vertex fn vs_thinline(input:Vertex)->VertexOutput{var output:VertexOutput;let prop=uniforms.styles[input.style_id];let cam_pos=transform.matrix*vec3f(vec2f(input.pos),1.0);var z=f32(input.style_id+1)*1e-6+1e-7;output.position=vec4f(cam_pos,z,1.0);output.color=sheer(prop.lineColor,prop.opacity);return output;}@vertex fn vs_polyline(input:eVertex,)->VertexOutput{var output:VertexOutput;let prop=uniforms.styles[input.style_id];let cam_pos=transform.matrix*vec3f(vec2f(input.pos),1.0);var thickness=prop.thickness;if(thickness==-5){output.pos=vec2f(input.pos);}else{output.pos=vec2f(0,0);}if(thickness<0){let style=uniforms.clamps[u32(-thickness-1)];let t=clamp((uniforms.zoom-style.min_zoom)/(style.max_zoom-style.min_zoom),0.0,1.0);thickness=mix(style.min_val,style.max_val,t);}let normal=normalize(vec2f(input.normal));let thickness_ndc=thickness/512.0;let offset=vec2f(normal.x*thickness_ndc*0.5,normal.y*thickness_ndc*0.5);let final_pos=cam_pos+offset;var z=f32(input.style_id+1)*1e-6;output.position=vec4f(final_pos,z,1.0);output.color=sheer(prop.lineColor,prop.opacity);output.normal=normal;return output;}@fragment fn fs_main(input:VertexOutput)->@location(0)vec4f{return input.color;}@fragment fn fs_polyline(input:VertexOutput)->@location(0)vec4f{if(length(input.normal)<0.5&&length(input.pos)>0&&((input.pos.y+1)/30)% 2>0.5){discard;}return input.color;}@vertex fn vs_mask(@builtin(vertex_index)vertexIndex:u32)->VertexOutput{var out:VertexOutput;var local_pos=vec2<f32>(0.0,0.0);if(vertexIndex==1u){local_pos=vec2<f32>(4096.0,0.0);}if(vertexIndex==2u){local_pos=vec2<f32>(0.0,4096.0);}if(vertexIndex==3u){local_pos=vec2<f32>(4096.0,4096.0);}out.position=vec4f(transform.matrix*vec3<f32>(local_pos,1.0),1.0,1.0);return out;}@fragment fn fs_dummy()->@location(0)vec4<f32>{return vec4<f32>(0.0);}"}),\nf=Pa(c,d,e,"vs_mask",0,[],"triangle-strip","fs_dummy",!0,{compare:"always",passOp:"replace"}),g=[];g.push(Pa(c,d,e,"vs_polygon",8,[[0,"sint16x2"],[4,"sint16"]],"triangle-list"));g.push(Pa(c,d,e,"vs_thinline",8,[[0,"sint16x2"],[4,"sint16"]],"line-list"));g.push(Pa(c,d,e,"vs_polyline",12,[[0,"sint16x2"],[4,"sint16"],[8,"sint16x2"]],"triangle-list","fs_polyline"));d=await e.getCompilationInfo();for(var l of d.messages)console.error(`WGSL error: ${l.message} at line ${l.lineNum}`);var m=C.createBuffer({size:512,\nusage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),n=C.createBuffer({size:12800,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});l=[];d=[];for(e=Na.length;e--;){let q=Na[e];if(/p|s/.test(q.l))continue;q.P=~~(d.length/8);let A=q.B||1,w=q.G||1;Array.isArray(A)&&(l.push(...A.flat()),A=-(~~l.length/4));Array.isArray(w)&&(l.push(...w.flat()),w=-(~~l.length/4));let x=q.l=="f"?[0,0,0]:q.u;d.push(...(q.l=="l"?[1,1,1]:q.u),w,...x,A)}C.queue.writeBuffer(m,16,new Float32Array(l));C.queue.writeBuffer(m,\n128,new Float32Array(d));var p=C.createBindGroup({layout:c,entries:[{binding:0,resource:{buffer:m}},{binding:1,resource:{buffer:n,size:32}}]}),r=[];c=[[15,28191,13180],[15,28192,13180],[15,28191,13179],[15,28192,13179]];for(let q of c)c=await Oa(q),c=aa(c,q),r.push(c);Ya();b()}else Ma("e","WebGPU \\u3092\\u30b5\\u30dd\\u30fc\\u30c8\\u3057\\u3066\\u3044\\u306a\\u3044\\u30d6\\u30e9\\u30a6\\u30b6\\u3001\\u307e\\u305f\\u306f\\u74b0\\u5883\\u3067\\u3059\\u3002")}\nvar Ya=()=>{var a=Z;Va=C.createTexture({size:a,sampleCount:4,format:navigator.gpu.getPreferredCanvasFormat(),usage:GPUTextureUsage.RENDER_ATTACHMENT});Wa=C.createTexture({size:a,sampleCount:4,format:"depth24plus-stencil8",usage:GPUTextureUsage.RENDER_ATTACHMENT})};//# sourceMappingURL=/worker.map\n'], { type: "application/javascript" });
var workerUrl = URL.createObjectURL(blob);
var worker = new Worker(workerUrl);
worker.postMessage(
  {
    "c": offcanvas,
    "s": [context_default.mapWidth * 2, context_default.mapHeight * 2],
    "b": sab
  },
  [offcanvas]
);
var pTime = tiny_default("#time");
tiny_default(worker).on("message", (e) => {
  if (e.data["e"]) {
    alert(e.data["e"]);
  }
  if (e.data["d"]) {
  }
  if (e.data["t"]) {
    pTime[0].innerText = "\u5730\u56F3\u63CF\u753B\u6642\u9593\uFF1A" + (e.data["t"] * 1e3).toFixed(3) + "\u03BCs";
  }
});
mouseevents_default(viewArray);
tiny_default("#resize").on("click", () => {
  context_default.mapWidth = 400;
  context_default.mapHeight = 600;
  canvas.css({
    width: context_default.mapWidth + "px",
    height: context_default.mapHeight + "px"
  });
  worker.postMessage({ "s": [context_default.mapWidth * 2, context_default.mapHeight * 2] });
  viewArray[3] = 1;
});
tiny_default("#resize2").on("click", () => {
  context_default.mapWidth = 400;
  context_default.mapHeight = 400;
  canvas.css({
    width: context_default.mapWidth + "px",
    height: context_default.mapHeight + "px"
  });
  worker.postMessage({ "s": [context_default.mapWidth * 2, context_default.mapHeight * 2] });
  viewArray[3] = 1;
});
