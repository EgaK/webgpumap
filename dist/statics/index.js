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
var blob = new Blob(['function aa(a,b,c){var f=D,g=f.createBuffer({size:b.aa.length*16,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),d=new Int32Array(b.aa);f.queue.writeBuffer(g,0,d);d=f.createBuffer({size:b.V.length*4,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});var e=new Uint32Array(b.V);f.queue.writeBuffer(d,0,e);e=f.createBuffer({size:b.S.length*4,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});var k=new Uint32Array(b.S);f.queue.writeBuffer(e,0,k);var l=b.Z.length*32;k=f.createBuffer({size:l,usage:GPUBufferUsage.VERTEX|\nGPUBufferUsage.COPY_DST});var m=new Uint8Array(l);b.Z.forEach((w,A)=>{A*=32;var x=new Int32Array([...w.i,w.M]);w=new Float32Array(w.L);m.set(new Uint8Array(x.buffer),A);m.set(new Uint8Array(w.buffer),A+16)});f.queue.writeBuffer(k,0,m);l=f.createBuffer({size:b.U.length*4,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});var n=new Uint32Array(b.U);f.queue.writeBuffer(l,0,n);n=f.createBuffer({size:b.da.length*16,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});var q=new Int32Array(b.da);f.queue.writeBuffer(n,\n0,q);q=f.createBuffer({size:b.W.length*4,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});var p=new Uint32Array(b.W);f.queue.writeBuffer(q,0,p);p=f.createBuffer({size:24,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});a=f.createBindGroup({layout:a,entries:[{binding:0,resource:{buffer:p}}]});return{I:c,G:a,H:p,ba:g,na:d,$:b.V.length,ja:e,X:b.S.length,ma:k,la:l,Y:b.U.length,pa:n,oa:q,ca:b.W.length}}function E(a,b){this.x=a;this.y=b}function ba(a,b){a.x/=b;a.y/=b;return a}\nE.prototype={clone(){return new E(this.x,this.y)},add(a){var b=this.clone();b.x+=a.x;b.y+=a.y;return b},sub(a){var b=this.clone();b.x-=a.x;b.y-=a.y;return b},div(a){return ba(this.clone(),a)},rotate(a){var b=this.clone(),c=Math.cos(a);a=Math.sin(a);var f=a*b.x+c*b.y;b.x=c*b.x-a*b.y;b.y=f;return b},unit(){var a=this.clone();ba(a,Math.sqrt(a.x*a.x+a.y*a.y));return a},round(){var a=this.clone();a.x=Math.round(a.x);a.y=Math.round(a.y);return a},equals(a){return this.x===a.x&&this.y===a.y},angle(){return Math.atan2(this.y,\nthis.x)},constructor:E};function ca(a){if(a.O<0)console.log("feature has no geometry");else{var b=a.D;b.i=a.O;for(var c=G(b)+b.i,f=[],g,d=1,e=0,k=0,l=0;b.i<c;){if(e<=0&&(e=G(b),d=e&7,e>>=3,e===0))continue;e--;if(d===1)k+=H(b),l+=H(b),g&&f.push(g),g=[new E(k,l)];else if(d===2)k+=H(b),l+=H(b),g&&g.push(new E(k,l));else if(d===7)g&&g.push(g[0].clone());else{console.log(`unknown command ${d}`);return}}g&&f.push(g);return{lines:f,F:a.F}}}\nvar da=class{constructor(a,b,c,f,g){this.F=Object.create(null);this.T=c;this.type=0;this.id=void 0;this.D=a;this.O=-1;this.P=f;for(this.R=g;a.i<b;)if(c=G(a),c===8)this.id=G(a);else if(c===18)for(c=G(a)+a.i;a.i<c;){let d=f[G(a)],e=g[G(a)];this.F[d]=e}else c===24?this.type=G(a):(c===34&&(this.O=a.i),N(a,c))}};function ea(a,b){if(b<0||b>=a.K.length)console.log("feature index out of bounds");else return a.D.i=a.K[b],b=G(a.D)+a.D.i,new da(a.D,b,a.T,a.P,a.R)}\nvar ia=class{constructor(a,b){this.version=1;this.name="";this.T=4096;this.length=0;this.D=a;this.P=[];this.R=[];this.K=[];b===void 0&&(b=a.length);for(;a.i<b;){var c=G(a);if(c===10)this.name=fa(a);else if(c===18)this.K.push(a.i),N(a,c);else if(c===26)this.P.push(fa(a));else if(c===34){c=this.R;var f=c.push;{var g=a;var d=null;let e=G(g)+g.i;for(;g.i<e;)d=G(g),d===10?d=fa(g):d===21?(d=ha(g.v,g.i,23,4),g.i+=4):d===25?(d=ha(g.v,g.i,52,8),g.i+=8):d=d===32?G(g,!0):d===40?G(g):d===48?H(g):d===56?!!G(g):\n(N(g,d),null);d==null?(console.log("unknown feature value"),g=void 0):g=d}f.call(c,g)}else c===40?this.T=G(a):c===120?this.version=G(a):N(a,c)}this.length=this.K.length}},ja=class{constructor(a,b=a.length){for(var c=Object.create(null);a.i<b;){var f=G(a);f===26?(f=new ia(a,G(a)+a.i),f.length&&(c[f.name]=f)):N(a,f)}this.ka=c}},ha=(a,b,c,f)=>{var g=f*8-c-1;var d=(1<<g)-1,e=d>>1,k=-7,l=f-1,m=a[b+l];l+=-1;f=m&(1<<-k)-1;m>>=-k;for(k+=g;k>0;f=f*256+a[b+l],l+=-1,k-=8);g=f&(1<<-k)-1;f>>=-k;for(k+=c;k>0;g=\ng*256+a[b+l],l+=-1,k-=8);if(f===0)f=1-e;else{if(f===d)return g?NaN:(m?-1:1)*Infinity;g+=Math.pow(2,c);f-=e}return(m?-1:1)*g*Math.pow(2,f-c)};function ka(a){this.v=ArrayBuffer.isView&&ArrayBuffer.isView(a)?a:new Uint8Array(a||0);this.type=this.i=0;this.length=this.v.length}\nfunction G(a,b){var c=a.v;var f=c[a.i++];var g=f&127;if(f<128)return g;f=c[a.i++];g|=(f&127)<<7;if(f<128)return g;f=c[a.i++];g|=(f&127)<<14;if(f<128)return g;f=c[a.i++];g|=(f&127)<<21;if(f<128)return g;f=c[a.i];return la(g|(f&15)<<28,b,a)}function N(a,b){b&=7;if(b===0)for(;a.v[a.i++]>127;);else b===2?a.i=G(a)+a.i:b===5?a.i+=4:b===1?a.i+=8:console.log("Unimplemented type: "+b)}function H(a){a=G(a);return a%2===1?(a+1)/-2:a/2}\nfunction fa(a){var b=G(a)+a.i;var c=a.v;for(var f="",g=a.i;g<b;){var d=c[g],e=null,k=d>239?4:d>223?3:d>191?2:1;if(g+k>b)break;if(k===1)d<128&&(e=d);else if(k===2){var l=c[g+1];(l&192)===128&&(e=(d&31)<<6|l&63,e<=127&&(e=null))}else if(k===3){l=c[g+1];var m=c[g+2];(l&192)===128&&(m&192)===128&&(e=(d&15)<<12|(l&63)<<6|m&63,e<=2047||e>=55296&&e<=57343)&&(e=null)}else if(k===4){l=c[g+1];m=c[g+2];var n=c[g+3];(l&192)===128&&(m&192)===128&&(n&192)===128&&(e=(d&15)<<18|(l&63)<<12|(m&63)<<6|n&63,e<=65535||\ne>=1114112)&&(e=null)}e===null?(e=65533,k=1):e>65535&&(e-=65536,f+=String.fromCharCode(e>>>10&1023|55296),e=56320|e&1023);f+=String.fromCharCode(e);g+=k}c=f;a.i=b;return c}ka.prototype={destroy:function(){this.v=null}};\nvar la=(a,b,c)=>{var f=c.v;var g=f[c.i++];var d=(g&112)>>4;if(g<128)return O(a,d,b);g=f[c.i++];d|=(g&127)<<3;if(g<128)return O(a,d,b);g=f[c.i++];d|=(g&127)<<10;if(g<128)return O(a,d,b);g=f[c.i++];d|=(g&127)<<17;if(g<128)return O(a,d,b);g=f[c.i++];d|=(g&127)<<24;if(g<128)return O(a,d,b);g=f[c.i++];d|=(g&1)<<31;if(g<128)return O(a,d,b);console.log("Expected varint not more than 10 bytes")},O=(a,b,c)=>c?b*4294967296+(a>>>0):(b>>>0)*4294967296+(a>>>0),P=new Set,ma=!1;\nfunction na(a,b){var c=b&&b.length,f=c?b[0]*2:a.length;P.size&&P.clear();var g=oa(a,0,f,!0),d=[];if(!g||g.next===g.j)return d;var e=0,k=0,l=0;if(c){c=g;g=[];for(let q=0,p=b.length;q<p;q++){var m=oa(a,b[q]*2,q<p-1?b[q+1]*2:a.length,!1);m===m.next&&P.add(m);var n=m;let w=m;do{if(n.x<w.x||n.x===w.x&&n.y<w.y)w=n;n=n.next}while(n!==m);g.push(w)}g.sort(pa);b=b.length;b=Math.ceil((a.length/2+2*b)/qa)+b+2;Q.length<b*4&&(Q=new Float64Array(b*4));ra=0;sa(c,c);ta=!0;for(b=0;b<g.length;b++)a:{m=g[b];n=c;c=ua(m,\nn);if(!c){c=n;break a}m=va(c,m);sa(c,m.next.next);R(m,m.next);c=R(c,c.next)}ta=!1;g=R(c)}if(a.length>160){e=a[0];k=a[1];l=e;c=k;for(b=2;b<f;b+=2)m=a[b],n=a[b+1],m<e&&(e=m),n<k&&(k=n),m>l&&(l=m),n>c&&(c=n);l=Math.max(l-e,c-k);l=l!==0?32767/l:0}xa(g,d,e,k,l);return d}\nfunction oa(a,b,c,f){var g=null,d=0;for(let e=b,k=c-2;e<c;e+=2)d+=(a[k]-a[e])*(a[e+1]+a[k+1]),k=e;if(f===d>0)for(;b<c;b+=2)g=ya(b/2|0,a[b],a[b+1],g);else for(c-=2;c>=b;c-=2)g=ya(c/2|0,a[c],a[c+1],g);g&&S(g,g.next)&&(T(g),g=g.next);return g}function R(a,b=a){var c=b===a;do{var f=!1;if(!(a===a.next||P.size!==0&&P.has(a)||!S(a,a.next)&&U(a.j,a,a.next)!==0)){if(c||a===b)b=a.j;ma=!0;T(a);a=a.j;f=!0}else if(c||a!==b)a=a.next,f=!c}while(f||a!==b);return b}\nfunction xa(a,b,c,f,g){if(g){var d=a,e=d,k=0;do e.z=za(e.x,e.y,c,f,g),V[k++]=e,e=e.next;while(e!==d);d=k;if(d<=32)for(e=1;e<d;e++){for(var l=V[e],m=l.z,n=e-1;n>=0&&V[n].z>m;)V[n+1]=V[n],n--;V[n+1]=l}else{W.length<d&&(W=new Uint32Array(d),Aa=new Uint32Array(d),X=Array(d));for(e=0;e<d;e++)W[e]=V[e].z;Ba(d,V,W,X,Aa,0);Ba(d,X,Aa,V,W,8);Ba(d,V,W,X,Aa,16);Ba(d,X,Aa,V,W,24)}d=null;for(e=0;e<k;e++){l=V[e];if(l.C=d)d.A=l;d=l}d.A=null;V.fill(null,0,k);X.fill(null,0,k)}k=a;for(d=!1;a.j!==a.next;){e=a.j;l=a.next;\nif(m=U(e,a,l)<0)if(g)a:{var q=a.j;m=a.next;n=q.x;var p=a.x,w=m.x;q=q.y;var A=a.y,x=m.y,I=Math.min(n,p,w),t=Math.min(q,A,x),y=Math.max(n,p,w),v=Math.max(q,A,x),F=za(I,t,c,f,g),r=za(y,v,c,f,g);let u=a.C;for(;u&&u.z>=F;){if(u.x>=I&&u.x<=y&&u.y>=t&&u.y<=v&&u!==m&&(n!==u.x||q!==u.y)&&Ca(n,q,p,A,w,x,u.x,u.y)&&U(u.j,u,u.next)>=0){m=!1;break a}u=u.C}for(F=a.A;F&&F.z<=r;){if(F.x>=I&&F.x<=y&&F.y>=t&&F.y<=v&&F!==m&&(n!==F.x||q!==F.y)&&Ca(n,q,p,A,w,x,F.x,F.y)&&U(F.j,F,F.next)>=0){m=!1;break a}F=F.A}m=!0}else a:{m=\na.j;r=a.next;n=m.x;p=a.x;w=r.x;q=m.y;A=a.y;x=r.y;I=Math.min(n,p,w);t=Math.min(q,A,x);y=Math.max(n,p,w);v=Math.max(q,A,x);for(r=r.next;r!==m;){if(r.x>=I&&r.x<=y&&r.y>=t&&r.y<=v&&(n!==r.x||q!==r.y)&&Ca(n,q,p,A,w,x,r.x,r.y)&&U(r.j,r,r.next)>=0){m=!1;break a}r=r.next}m=!0}if(m)b.push(e.m,a.m,l.m),T(a),k=a=l;else if(a=l,a===k)if(ma=!1,a=R(a),ma)k=a;else if(d){a:{k=a;do{for(d=k.next.next;d!==k.j;){if(e=k.m!==d.m){e=S(k,d)&&U(k.j,k,k.next)>0&&U(d.j,d,d.next)>0;if(l=k.next.m!==d.m&&(e||Da(k,d)&&Da(d,k)&&\n(U(k.j,k,d.j)!==0||U(k,d.j,d)!==0))){b:{l=Math.min(k.x,d.x);m=Math.max(k.x,d.x);n=Math.min(k.y,d.y);p=Math.max(k.y,d.y);w=k;do{q=w.next;if(!(w.x>m&&q.x>m||w.x<l&&q.x<l||w.y>p&&q.y>p||w.y<n&&q.y<n)&&w.m!==k.m&&q.m!==k.m&&w.m!==d.m&&q.m!==d.m&&Ea(w,q,k,d)){l=!0;break b}w=q}while(w!==k);l=!1}l=!l}if(l){if(!e){e=k;l=!1;m=(k.x+d.x)/2;n=(k.y+d.y)/2;do p=e.next,e.y>n!==p.y>n&&m<(p.x-e.x)*(n-e.y)/(p.y-e.y)+e.x&&(l=!l),e=p;while(e!==k);e=l}l=e}e=l}if(e){a=va(k,d);k=R(k,k.next);a=R(a,a.next);xa(k,b,c,f,g);\nxa(a,b,c,f,g);break a}d=d.next}k=k.next}while(k!==a)}break}else{k=b;d=a;e=!1;do l=d.j,m=d.next.next,Ea(l,d,d.next,m,!1)&&Da(l,m)&&Da(m,l)&&(k.push(l.m,d.m,m.m),T(d),T(d.next),d=a=m,e=!0),d=d.next;while(d!==a);k=a=e?R(d):d;d=!0}}}var ta=!1;function pa(a,b){return a.x-b.x||a.y-b.y||(a.next.y-a.y)/(a.next.x-a.x)-(b.next.y-b.y)/(b.next.x-b.x)}var qa=16,Q=new Float64Array(0),ra=0,Fa=[],Ga=[];\nfunction sa(a,b){do{var c=ra++;Fa[c]=a;let f=a.x,g=a.y,d=a.x,e=a.y,k=0;do{let l=a.next;a.z=c;l.x<f&&(f=l.x);l.x>d&&(d=l.x);l.y<g&&(g=l.y);l.y>e&&(e=l.y);a=l}while(++k<qa&&a!==b);Ga[c]=a;c*=4;Q[c]=f;Q[c+1]=g;Q[c+2]=d;Q[c+3]=e}while(a!==b)}function Ha(a){for(var b=Ga[a];b.j.next!==b;)b=b.next;return Ga[a]=b}function Ia(a){for(var b=Fa[a];b.j.next!==b;)b=b.next;return Fa[a]=b}\nfunction ua(a,b){var c=a.x,f=a.y,g=-Infinity;if(S(a,b))return b;for(let q=0,p=0;q<ra;q++,p+=4){if(f<Q[p+1]||f>Q[p+3]||Q[p]>c||Q[p+2]<=g)continue;var d=Ha(q);b=Ia(q);do{if(b.j.next===b){if(S(a,b.next))return b.next;if(f<=b.y&&f>=b.next.y&&b.next.y!==b.y){var e=b.x+(f-b.y)*(b.next.x-b.x)/(b.next.y-b.y);if(e<=c&&e>g){g=e;var k=b.x<b.next.x?b:b.next;if(e===c)return k}}}b=b.next}while(b!==d)}if(!k)return null;d=k.x;e=k.y;var l=Math.min(f,e),m=Math.max(f,e),n=Infinity;for(let q=0,p=0;q<ra;q++,p+=4){if(Q[p+\n2]<d||Q[p]>c||Q[p+3]<l||Q[p+1]>m)continue;let w=Ha(q);b=Ia(q);do{if(b.j.next===b&&c>=b.x&&b.x>=d&&c!==b.x&&Ca(f<e?c:g,f,d,e,f<e?g:c,f,b.x,b.y)){let A=Math.abs(f-b.y)/(c-b.x);(Da(b,a)||b.y===f&&b.next.y===f&&b.next.x>c)&&(A<n||A===n&&(b.x>k.x||b.x===k.x&&U(k.j,k,b.j)<0&&U(b.next,k,k.next)<0))&&(k=b,n=A)}b=b.next}while(b!==w)}return k}var V=[],X=[],W=new Uint32Array(0),Aa=new Uint32Array(0),Ja=new Uint32Array(256);\nfunction Ba(a,b,c,f,g,d){Ja.fill(0);for(var e=0;e<a;e++)Ja[c[e]>>>d&255]++;e=0;for(var k=0;k<256;k++){var l=Ja[k];Ja[k]=e;e+=l}for(e=0;e<a;e++)k=c[e],l=Ja[k>>>d&255]++,f[l]=b[e],g[l]=k}function za(a,b,c,f,g){a=(a-c)*g|0;b=(b-f)*g|0;a=(a|a<<8)&16711935;a=(a|a<<4)&252645135;a=(a|a<<2)&858993459;b=(b|b<<8)&16711935;b=(b|b<<4)&252645135;b=(b|b<<2)&858993459;return(a|a<<1)&1431655765|((b|b<<1)&1431655765)<<1}\nfunction Ca(a,b,c,f,g,d,e,k){return(g-e)*(b-k)>=(a-e)*(d-k)&&(a-e)*(f-k)>=(c-e)*(b-k)&&(c-e)*(d-k)>=(g-e)*(f-k)}function U(a,b,c){return(b.y-a.y)*(c.x-b.x)-(b.x-a.x)*(c.y-b.y)}function S(a,b){return a.x===b.x&&a.y===b.y}function Ea(a,b,c,f,g=!0){var d=U(a,b,c),e=U(a,b,f),k=U(c,f,a),l=U(c,f,b);return(d>0&&e<0||d<0&&e>0)&&(k>0&&l<0||k<0&&l>0)?!0:g?d===0&&Ka(a,c,b)||e===0&&Ka(a,f,b)||k===0&&Ka(c,a,f)||l===0&&Ka(c,b,f)?!0:!1:!1}\nfunction Ka(a,b,c){return b.x<=Math.max(a.x,c.x)&&b.x>=Math.min(a.x,c.x)&&b.y<=Math.max(a.y,c.y)&&b.y>=Math.min(a.y,c.y)}function Da(a,b){return U(a.j,a,a.next)<0?U(a,b,a.next)>=0&&U(a,a.j,b)>=0:U(a,b,a.j)<0||U(a,a.next,b)<0}function va(a,b){var c=La(a.m,a.x,a.y),f=La(b.m,b.x,b.y),g=a.next,d=b.j;a.next=b;b.j=a;c.next=g;g.j=c;f.next=c;c.j=f;d.next=f;f.j=d;return f}function ya(a,b,c,f){a=La(a,b,c);f?(a.next=f.next,a.j=f,f.next.j=a,f.next=a):(a.j=a,a.next=a);return a}\nfunction T(a){a.next.j=a.j;a.j.next=a.next;a.C&&(a.C.A=a.A);a.A&&(a.A.C=a.C);if(ta){var b=a.next;a=a.j.z*4;b.x<Q[a]&&(Q[a]=b.x);b.y<Q[a+1]&&(Q[a+1]=b.y);b.x>Q[a+2]&&(Q[a+2]=b.x);b.y>Q[a+3]&&(Q[a+3]=b.y)}}function La(a,b,c){return{m:a,x:b,y:c,j:null,next:null,z:0,C:null,A:null}}\nvar Ma=(...a)=>{for(var b={},c=0;c<a.length;c+=2)b[a[c]]=a[c+1];self.postMessage(b)},Na=[{l:"l",o:"t",u:[.59,.59,.59],B:[[15,20],[18,50]]},{l:"f",o:"b",u:[.94,.96,.94],B:1,J:[[14,0],[17,1]]},{l:"l",o:"r1",u:[.39,.39,.39],B:1,J:[[16,0],[18,1]]},{l:"l",o:"r2",u:[.77,.63,0],B:1},{l:"f",o:"r5",u:[1,1,1]},{l:"f",o:"r3",u:[1,.77,.6]},{l:"l",o:"r8",u:[1,.77,.6],B:[[10,5],[13,10]]},{l:"f",o:"r4",u:[.93,.86,.58]},{l:"l",o:"r9",u:[.93,.86,.58],B:[[10,5],[16,30]]},{l:"l",o:"r6",u:[.39,.39,.39],B:2},{l:"f",o:"w",\nu:[.66,.86,1]},{l:"f",o:"g",u:[.8,.93,.66]},{l:"p",o:"c",u:[.4,.4,.4],N:14,ra:10},{l:"p",o:"rt",N:12,ea:{border:"1px solid #fff","border-radius":"4px 4px 50% 50%",background:"#06a",padding:"5px",color:"#fff"}},{l:"p",o:"d",u:[.4,.4,.4],N:12,J:[[13,0],[14,1]]},{l:"s",o:"p"}],Oa=async a=>{function b(r,u,C){for(var K=[],B=0;B<r.length;B++){let L=ea(r,B),z=ca(L),J=z.F.c,M=z.F.t;J=="bs"&&M&&(M=M.replace("S","\\u897f\\u80a5\\u30d0\\u30b9").replace("W","\\u662d\\u548c\\u30d0\\u30b9"));K.push({p:z.lines[0][0],t:L.F.n,\nd:M,c:J})}Ma("d",{f:K,p:{type:u.l,layer:u.o,color:u.u,size:u.N,opacity:u.J,css:u.ea},z:C})}function c(r){var u=0;for(let C=0;C<r.length;C++){let K=r[C],B=r[(C+1)%r.length];u+=(B[0]-K[0])*(B[1]+K[1])}return u<0}function f(r,u){var C=u.fa,K=u.B||0;if(u.l=="f")for(u=0;u<r.length;u++){var B=ea(r,u);if(B.type!==3)continue;var L=ca(B).lines;B=[];for(var z of L){if(z.length===0)continue;L=z.map(J=>[J.x,J.y]);c(L)?(B.length>0&&d(B,C,K),B=[L]):B.push(L)}B.length>0&&d(B,C,K)}else for(u=0;u<r.length;u++){z=\nea(r,u);if(z.type!==2)continue;z=ca(z).lines;for(B of z){if(B.length===0)continue;z=B.map(J=>[J.x,J.y]);K!=1?e(z,C):g(z,C)}}}function g(r,u){for(let C=0;C<r.length;C++)A.push(...r[C],u,1),C<r.length-1&&x.push(I+C,I+C+1);I+=r.length}function d(r,u,C){var K=[],B=[],L=0;for(let z=0;z<r.length;z++){let J=r[z];if(J.length){z>0&&B.push(L);for(let M=0;M<J.length;M++){let wa=J[M];K.push(wa[0],wa[1]);k.push(...wa,u,1);L++;C>0&&n.push(q+M,q+(M+1==J.length?0:M+1))}q+=J.length}}r=na(K,B);r.length&&(r.forEach(z=>\n{m.push(l+z)}),l+=L)}function e(r,u){var C=r.length;if(!(C<2))for(let K=0;K<C-1;K++){let B=r[K],L=r[K+1],z=p.length,J=L[0]-B[0],M=-L[1]+B[1];p.push({i:B,M:u,L:[M,-J]});p.push({i:B,M:u,L:[-M,J]});p.push({i:L,M:u,L:[-M,J]});p.push({i:L,M:u,L:[M,-J]});w.push(z,z+1,z+2,z+2,z+3,z);K>0&&w.push(z,z-1,z+1,z+1,z-2,z)}}var k=[],l=0,m=[],n=[],q=0,p=[],w=[],A=[],x=[],I=0,t=await fetch("https://192.168.11.2/t/"+a.join("/"));t=await new ka(await t.arrayBuffer());t=(new ja(t)).ka;for(var y=Na.length;y--;){var v=\nNa[y],F=t[v.o];F&&(/p|s/.test(v.l)?b(F,v,a):f(F,v))}return{aa:k,V:m,S:n,Z:p,U:w,da:A,W:x}},Pa=(a,b,c,f,g,d,e,k,l="fs_main",m,n={compare:"equal",passOp:"keep",failOp:"keep",depthFailOp:"keep"})=>{var q=D;a={layout:q.createPipelineLayout({bindGroupLayouts:[a,b]}),vertex:{module:f,entryPoint:g,buffers:[{arrayStride:d,stepMode:"vertex",attributes:e.map((p,w)=>({shaderLocation:w,offset:p[0],format:p[1]}))}]},fragment:{module:f,entryPoint:l,targets:[{format:c,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",\noperation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:k,cullMode:"none"},depthStencil:{format:"depth24plus-stencil8",depthWriteEnabled:!m,depthCompare:m?"always":"greater",stencilFront:n,stencilBack:n},multisample:{count:4}};d||delete a.vertex.buffers;return q.createRenderPipeline(a)},Y,Z,D,Qa,Ra,Sa,Ta,Ua,Va,Wa;({ia:Ta,ga:Ua,ha:Va,qa:Wa}={ia:10,ga:879,ha:410,qa:1024});\nself.onmessage=async a=>{a.data.c?(Y=a.data.c,Z=a.data.s,a=new Float32Array(a.data.b),Xa(a)):a.data.s&&(Z=a.data.s,Y.width=Z[0],Y.height=Z[1],Ya())};\nasync function Xa(a){function b(x,I){D.queue.writeBuffer(Qa,0,new Float32Array([a[2]]));x=Za(...x,4096,a[0],a[1],a[2],...Z);D.queue.writeBuffer(I,0,x)}function c(){requestAnimationFrame(c);if(a[3]){var x=performance.now(),I=D.createCommandEncoder(),t=I.beginRenderPass({colorAttachments:[{view:Ra.createView(),resolveTarget:g.getCurrentTexture().createView(),clearValue:{r:.96,g:.97,b:.98,a:1},loadOp:"clear",storeOp:"discard"}],depthStencilAttachment:{view:Sa.createView(),depthClearValue:0,depthLoadOp:"clear",\ndepthStoreOp:"store",stencilClearValue:0,stencilLoadOp:"clear",stencilStoreOp:"store"}});t.setBindGroup(0,w);t.setPipeline(l);for(var y=0;y<A.length;y++){var v=A[y];b(v.I,v.H);t.setStencilReference(y+1);t.setBindGroup(1,v.G);t.draw(4,1,0,0)}t.setPipeline(m);for(y=0;y<A.length;y++)v=A[y],v.$>0&&(b(v.I,v.H),t.setBindGroup(1,v.G),t.setStencilReference(y+1),t.setVertexBuffer(0,v.ba),t.setIndexBuffer(v.na,"uint32"),t.drawIndexed(v.$,1,0,0,0));t.setPipeline(n);for(y=0;y<A.length;y++)v=A[y],v.X>0&&(b(v.I,\nv.H),t.setBindGroup(1,v.G),t.setStencilReference(y+1),t.setVertexBuffer(0,v.ba),t.setIndexBuffer(v.ja,"uint32"),t.drawIndexed(v.X,1,0,0,0));t.setPipeline(q);for(y=0;y<A.length;y++)v=A[y],v.Y>0&&(b(v.I,v.H),t.setBindGroup(1,v.G),t.setStencilReference(y+1),t.setVertexBuffer(0,v.ma),t.setIndexBuffer(v.la,"uint32"),t.drawIndexed(v.Y,1,0,0,0));t.setPipeline(n);for(y=0;y<A.length;y++)v=A[y],v.ca>0&&(b(v.I,v.H),t.setBindGroup(1,v.G),t.setStencilReference(y+1),t.setVertexBuffer(0,v.pa),t.setIndexBuffer(v.oa,\n"uint32"),t.drawIndexed(v.ca,1,0,0,0));t.end();D.queue.submit([I.finish()]);a[3]=0;Ma("t",performance.now()-x)}}if(D=await (await navigator.gpu?.requestAdapter())?.requestDevice()){D.pushErrorScope("validation");var f=await D.popErrorScope();f&&console.error("WebGPU \\u30d0\\u30ea\\u30c7\\u30fc\\u30b7\\u30e7\\u30f3\\u30a8\\u30e9\\u30fc:",f.message);D.lost.then(x=>{console.error(`WebGPU \\u30C7\\u30D0\\u30A4\\u30B9\\u304C\\u55AA\\u5931\\u3057\\u307E\\u3057\\u305F\\u3002\\u7406\\u7531: ${x.reason}`);console.error(`\\u30E1\\u30C3\\u30BB\\u30FC\\u30B8: ${x.message}`);\nx.reason==="destroyed"?console.log("\\u30c7\\u30d0\\u30a4\\u30b9\\u306f\\u610f\\u56f3\\u7684\\u306b\\u7834\\u68c4\\u3055\\u308c\\u307e\\u3057\\u305f\\u3002"):console.log("\\u30c7\\u30d0\\u30a4\\u30b9\\u3092\\u518d\\u521d\\u671f\\u5316\\u3057\\u307e\\u3059...")});var g=Y.getContext("webgpu");Y.width=Z[0];Y.height=Z[1];var d=navigator.gpu.getPreferredCanvasFormat();g.configure({device:D,format:d,alphaMode:"premultiplied"});var e=D.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform"}}]});\nf=D.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform"}}]});var k=D.createShaderModule({code:"struct PrimitiveVertex{@location(0)pos:vec2i,@location(1)style_id:i32,}struct PolylineVertex{@location(0)pos:vec2i,@location(1)style_id:i32,@location(2)pad:i32,@location(3)normal:vec2f,}struct Style{fillColor:vec3f,opacity:f32,lineColor:vec3f,thickness:f32,}struct ClampTable{min_zoom:f32,min_val:f32,max_zoom:f32,max_val:f32,};struct Uniforms{zoom:f32,tile_opacity:f32,pad0:f32,pad1:f32,clamps:array<ClampTable,6>,padvec1:vec4f,styles:array<Style,12>}struct Transform{matrix:mat3x2f,}@group(0)@binding(0)var<uniform> uniforms:Uniforms;@group(1)@binding(0)var<uniform> transform:Transform;struct VertexOutput{@builtin(position)position:vec4f,@location(0)color:vec4f,@location(1)normal:vec2f,@location(2)pos:vec2f,}fn sheer(color:vec3f,o:f32)->vec4f{var opacity=o;if(opacity<0){let style=uniforms.clamps[u32(-opacity-1)];let t=clamp((uniforms.zoom-style.min_zoom)/(style.max_zoom-style.min_zoom),0.0,1.0);opacity=mix(style.min_val,style.max_val,t);}return vec4f(color,opacity);}@vertex fn vs_polygon(input:PrimitiveVertex)->VertexOutput{var output:VertexOutput;let prop=uniforms.styles[input.style_id];let cam_pos=transform.matrix*vec3f(vec2f(input.pos),1.0);var z=f32(input.style_id+1)*1e-6;output.position=vec4f(cam_pos,z,1.0);output.color=sheer(prop.fillColor,prop.opacity);return output;}@vertex fn vs_thinline(input:PrimitiveVertex)->VertexOutput{var output:VertexOutput;let prop=uniforms.styles[input.style_id];let cam_pos=transform.matrix*vec3f(vec2f(input.pos),1.0);var z=f32(input.style_id+1)*1e-6+1e-7;output.position=vec4f(cam_pos,z,1.0);output.color=sheer(prop.lineColor,prop.opacity);return output;}@vertex fn vs_polyline(input:PolylineVertex,)->VertexOutput{var output:VertexOutput;let prop=uniforms.styles[input.style_id];let cam_pos=transform.matrix*vec3f(vec2f(input.pos),1.0);var thickness=prop.thickness;if(thickness==-5){output.pos=vec2f(input.pos);}else{output.pos=vec2f(0,0);}if(thickness<0){let style=uniforms.clamps[u32(-thickness-1)];let t=clamp((uniforms.zoom-style.min_zoom)/(style.max_zoom-style.min_zoom),0.0,1.0);thickness=mix(style.min_val,style.max_val,t);}let normal=normalize(input.normal);let thickness_ndc=thickness/512.0;let offset=vec2f(normal.x*thickness_ndc*0.5,normal.y*thickness_ndc*0.5);let final_pos=cam_pos+offset;var z=f32(input.style_id+1)*1e-6;output.position=vec4f(final_pos,z,1.0);output.color=sheer(prop.lineColor,prop.opacity);output.normal=normal;return output;}@fragment fn fs_main(input:VertexOutput)->@location(0)vec4f{return input.color;}@fragment fn fs_polyline(input:VertexOutput)->@location(0)vec4f{if(length(input.normal)<0.5&&length(input.pos)>0&&((input.pos.y+1)/30)% 2>0.5){discard;}return input.color;}@vertex fn vs_mask(@builtin(vertex_index)vertexIndex:u32)->VertexOutput{var out:VertexOutput;var local_pos=vec2<f32>(0.0,0.0);if(vertexIndex==1u){local_pos=vec2<f32>(4096.0,0.0);}if(vertexIndex==2u){local_pos=vec2<f32>(0.0,4096.0);}if(vertexIndex==3u){local_pos=vec2<f32>(4096.0,4096.0);}out.position=vec4f(transform.matrix*vec3<f32>(local_pos,1.0),1.0,1.0);return out;}@fragment fn fs_dummy()->@location(0)vec4<f32>{return vec4<f32>(0.0);}"}),\nl=Pa(e,f,d,k,"vs_mask",0,[],"triangle-strip","fs_dummy",!0,{compare:"always",passOp:"replace"}),m=Pa(e,f,d,k,"vs_polygon",16,[[0,"sint32x2"],[8,"sint32"]],"triangle-list"),n=Pa(e,f,d,k,"vs_thinline",16,[[0,"sint32x2"],[8,"sint32"]],"line-list"),q=Pa(e,f,d,k,"vs_polyline",32,[[0,"sint32x2"],[8,"sint32"],[12,"sint32"],[16,"float32x2"]],"triangle-list","fs_polyline");d=await k.getCompilationInfo();for(var p of d.messages)console.error(`WGSL error: ${p.message} at line ${p.lineNum}`);Qa=D.createBuffer({size:512,\nusage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});p=[];d=[];for(k=Na.length;k--;){let x=Na[k];if(/p|s/.test(x.l))continue;x.fa=~~(d.length/8);let I=x.B||1,t=x.J||1;Array.isArray(I)&&(p.push(...I.flat()),I=-(~~p.length/4));Array.isArray(t)&&(p.push(...t.flat()),t=-(~~p.length/4));let y=x.l=="f"?[0,0,0]:x.u;d.push(...(x.l=="l"?[1,1,1]:x.u),t,...y,I)}D.queue.writeBuffer(Qa,16,new Float32Array(p));D.queue.writeBuffer(Qa,128,new Float32Array(d));var w=D.createBindGroup({layout:e,entries:[{binding:0,\nresource:{buffer:Qa}}]}),A=[];e=[[15,28191,13180],[15,28192,13180],[15,28191,13179],[15,28192,13179]];for(let x of e)e=await Oa(x),e=aa(f,e,x),A.push(e);Ya();c()}else Ma("e","WebGPU \\u3092\\u30b5\\u30dd\\u30fc\\u30c8\\u3057\\u3066\\u3044\\u306a\\u3044\\u30d6\\u30e9\\u30a6\\u30b6\\u3001\\u307e\\u305f\\u306f\\u74b0\\u5883\\u3067\\u3059\\u3002")}\nfunction Za(a,b,c,f,g,d,e,k,l){e=Wa*Math.pow(2,e-Ta);k=e/k*2;l=e/l*2;a-=Ta;e=1/Math.pow(2,a);return new Float32Array([e/f*k,0,0,-(e/f)*l,((b-Ua*Math.pow(2,a))*e-g)*k,-((c-Va*Math.pow(2,a))*e-d)*l])}function Ya(){var a=Z;Ra=D.createTexture({size:a,sampleCount:4,format:navigator.gpu.getPreferredCanvasFormat(),usage:GPUTextureUsage.RENDER_ATTACHMENT});Sa=D.createTexture({size:a,sampleCount:4,format:"depth24plus-stencil8",usage:GPUTextureUsage.RENDER_ATTACHMENT})};//# sourceMappingURL=/worker.map\n'], { type: "application/javascript" });
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
