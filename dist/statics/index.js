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
var blob = new Blob(['function aa(a,b,c){var g=D,e=32,d=b.$.length*e,f=g.createBuffer({size:d,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),k=new Uint8Array(d);b.$.forEach((z,J)=>{J*=e;z=new Float32Array([...z.fillColor,z.opacity,...z.R,z.v]);k.set(new Uint8Array(z.buffer),J)});g.queue.writeBuffer(f,0,k);d=g.createBuffer({size:b.Z.length*16,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});var l=new Int32Array(b.Z);g.queue.writeBuffer(d,0,l);l=g.createBuffer({size:b.T.length*4,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});\nvar m=new Uint32Array(b.T);g.queue.writeBuffer(l,0,m);m=g.createBuffer({size:b.O.length*4,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});var n=new Uint32Array(b.O);g.queue.writeBuffer(m,0,n);e=32;var p=b.X.length*e;n=g.createBuffer({size:p,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});var t=new Uint8Array(p);b.X.forEach((z,J)=>{J*=e;var w=new Int32Array([...z.i,z.I]);z=new Float32Array(z.J);t.set(new Uint8Array(w.buffer),J);t.set(new Uint8Array(z.buffer),J+16)});g.queue.writeBuffer(n,\n0,t);p=g.createBuffer({size:b.S.length*4,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});var r=new Uint32Array(b.S);g.queue.writeBuffer(p,0,r);r=g.createBuffer({size:b.ba.length*16,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});var x=new Int32Array(b.ba);g.queue.writeBuffer(r,0,x);x=g.createBuffer({size:b.U.length*4,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});var u=new Uint32Array(b.U);g.queue.writeBuffer(x,0,u);u=g.createBuffer({size:24,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});\na=g.createBindGroup({layout:a,entries:[{binding:0,resource:{buffer:u}},{binding:1,resource:{buffer:f}}]});return{ra:c,ga:a,qa:u,ma:d,la:l,Y:b.T.length,ha:m,V:b.O.length,ka:n,ja:p,W:b.S.length,oa:r,na:x,aa:b.U.length}}function E(a,b){this.x=a;this.y=b}function ba(a,b){a.x/=b;a.y/=b;return a}\nE.prototype={clone(){return new E(this.x,this.y)},add(a){var b=this.clone();b.x+=a.x;b.y+=a.y;return b},sub(a){var b=this.clone();b.x-=a.x;b.y-=a.y;return b},div(a){return ba(this.clone(),a)},rotate(a){var b=this.clone(),c=Math.cos(a);a=Math.sin(a);var g=a*b.x+c*b.y;b.x=c*b.x-a*b.y;b.y=g;return b},unit(){var a=this.clone();ba(a,Math.sqrt(a.x*a.x+a.y*a.y));return a},round(){var a=this.clone();a.x=Math.round(a.x);a.y=Math.round(a.y);return a},equals(a){return this.x===a.x&&this.y===a.y},angle(){return Math.atan2(this.y,\nthis.x)},constructor:E};function ca(a){if(a.L<0)console.log("feature has no geometry");else{var b=a.F;b.i=a.L;for(var c=G(b)+b.i,g=[],e,d=1,f=0,k=0,l=0;b.i<c;){if(f<=0&&(f=G(b),d=f&7,f>>=3,f===0))continue;f--;if(d===1)k+=H(b),l+=H(b),e&&g.push(e),e=[new E(k,l)];else if(d===2)k+=H(b),l+=H(b),e&&e.push(new E(k,l));else if(d===7)e&&e.push(e[0].clone());else{console.log(`unknown command ${d}`);return}}e&&g.push(e);return{lines:g,G:a.G}}}\nvar ea=class{constructor(a,b,c,g,e){this.G=Object.create(null);this.P=c;this.type=0;this.id=void 0;this.F=a;this.L=-1;this.M=g;for(this.N=e;a.i<b;)if(c=G(a),c===8)this.id=G(a);else if(c===18)for(c=G(a)+a.i;a.i<c;){let d=g[G(a)],f=e[G(a)];this.G[d]=f}else c===24?this.type=G(a):(c===34&&(this.L=a.i),da(a,c))}};function fa(a,b){if(b<0||b>=a.H.length)console.log("feature index out of bounds");else return a.F.i=a.H[b],b=G(a.F)+a.F.i,new ea(a.F,b,a.P,a.M,a.N)}\nvar ja=class{constructor(a,b){this.version=1;this.name="";this.P=4096;this.length=0;this.F=a;this.M=[];this.N=[];this.H=[];b===void 0&&(b=a.length);for(;a.i<b;){var c=G(a);if(c===10)this.name=ha(a);else if(c===18)this.H.push(a.i),da(a,c);else if(c===26)this.M.push(ha(a));else if(c===34){c=this.N;var g=c.push;{var e=a;var d=null;let f=G(e)+e.i;for(;e.i<f;)d=G(e),d===10?d=ha(e):d===21?(d=ia(e.B,e.i,23,4),e.i+=4):d===25?(d=ia(e.B,e.i,52,8),e.i+=8):d=d===32?G(e,!0):d===40?G(e):d===48?H(e):d===56?!!G(e):\n(da(e,d),null);d==null?(console.log("unknown feature value"),e=void 0):e=d}g.call(c,e)}else c===40?this.P=G(a):c===120?this.version=G(a):da(a,c)}this.length=this.H.length}},ka=class{constructor(a,b=a.length){for(var c=Object.create(null);a.i<b;){var g=G(a);g===26?(g=new ja(a,G(a)+a.i),g.length&&(c[g.name]=g)):da(a,g)}this.ia=c}},ia=(a,b,c,g)=>{var e=g*8-c-1;var d=(1<<e)-1,f=d>>1,k=-7,l=g-1,m=a[b+l];l+=-1;g=m&(1<<-k)-1;m>>=-k;for(k+=e;k>0;g=g*256+a[b+l],l+=-1,k-=8);e=g&(1<<-k)-1;g>>=-k;for(k+=c;k>\n0;e=e*256+a[b+l],l+=-1,k-=8);if(g===0)g=1-f;else{if(g===d)return e?NaN:(m?-1:1)*Infinity;e+=Math.pow(2,c);g-=f}return(m?-1:1)*e*Math.pow(2,g-c)};function la(a){this.B=ArrayBuffer.isView&&ArrayBuffer.isView(a)?a:new Uint8Array(a||0);this.type=this.i=0;this.length=this.B.length}\nfunction G(a,b){var c=a.B;var g=c[a.i++];var e=g&127;if(g<128)return e;g=c[a.i++];e|=(g&127)<<7;if(g<128)return e;g=c[a.i++];e|=(g&127)<<14;if(g<128)return e;g=c[a.i++];e|=(g&127)<<21;if(g<128)return e;g=c[a.i];return ma(e|(g&15)<<28,b,a)}function da(a,b){b&=7;if(b===0)for(;a.B[a.i++]>127;);else b===2?a.i=G(a)+a.i:b===5?a.i+=4:b===1?a.i+=8:console.log("Unimplemented type: "+b)}function H(a){a=G(a);return a%2===1?(a+1)/-2:a/2}\nfunction ha(a){var b=G(a)+a.i;var c=a.B;for(var g="",e=a.i;e<b;){var d=c[e],f=null,k=d>239?4:d>223?3:d>191?2:1;if(e+k>b)break;if(k===1)d<128&&(f=d);else if(k===2){var l=c[e+1];(l&192)===128&&(f=(d&31)<<6|l&63,f<=127&&(f=null))}else if(k===3){l=c[e+1];var m=c[e+2];(l&192)===128&&(m&192)===128&&(f=(d&15)<<12|(l&63)<<6|m&63,f<=2047||f>=55296&&f<=57343)&&(f=null)}else if(k===4){l=c[e+1];m=c[e+2];var n=c[e+3];(l&192)===128&&(m&192)===128&&(n&192)===128&&(f=(d&15)<<18|(l&63)<<12|(m&63)<<6|n&63,f<=65535||\nf>=1114112)&&(f=null)}f===null?(f=65533,k=1):f>65535&&(f-=65536,g+=String.fromCharCode(f>>>10&1023|55296),f=56320|f&1023);g+=String.fromCharCode(f);e+=k}c=g;a.i=b;return c}la.prototype={destroy:function(){this.B=null}};\nvar ma=(a,b,c)=>{var g=c.B;var e=g[c.i++];var d=(e&112)>>4;if(e<128)return O(a,d,b);e=g[c.i++];d|=(e&127)<<3;if(e<128)return O(a,d,b);e=g[c.i++];d|=(e&127)<<10;if(e<128)return O(a,d,b);e=g[c.i++];d|=(e&127)<<17;if(e<128)return O(a,d,b);e=g[c.i++];d|=(e&127)<<24;if(e<128)return O(a,d,b);e=g[c.i++];d|=(e&1)<<31;if(e<128)return O(a,d,b);console.log("Expected varint not more than 10 bytes")},O=(a,b,c)=>c?b*4294967296+(a>>>0):(b>>>0)*4294967296+(a>>>0),na=new Set,oa=!1;\nfunction pa(a,b){var c=b&&b.length,g=c?b[0]*2:a.length;na.size&&na.clear();var e=qa(a,0,g,!0),d=[];if(!e||e.next===e.j)return d;var f=0,k=0,l=0;if(c){c=e;e=[];for(let p=0,t=b.length;p<t;p++){var m=qa(a,b[p]*2,p<t-1?b[p+1]*2:a.length,!1);m===m.next&&na.add(m);var n=m;let r=m;do{if(n.x<r.x||n.x===r.x&&n.y<r.y)r=n;n=n.next}while(n!==m);e.push(r)}e.sort(ra);b=b.length;b=Math.ceil((a.length/2+2*b)/sa)+b+2;S.length<b*4&&(S=new Float64Array(b*4));ta=0;ua(c,c);va=!0;for(b=0;b<e.length;b++)a:{m=e[b];n=c;c=\nwa(m,n);if(!c){c=n;break a}m=xa(c,m);ua(c,m.next.next);T(m,m.next);c=T(c,c.next)}va=!1;e=T(c)}if(a.length>160){f=a[0];k=a[1];l=f;c=k;for(b=2;b<g;b+=2)m=a[b],n=a[b+1],m<f&&(f=m),n<k&&(k=n),m>l&&(l=m),n>c&&(c=n);l=Math.max(l-f,c-k);l=l!==0?32767/l:0}ya(e,d,f,k,l);return d}\nfunction qa(a,b,c,g){var e=null,d=0;for(let f=b,k=c-2;f<c;f+=2)d+=(a[k]-a[f])*(a[f+1]+a[k+1]),k=f;if(g===d>0)for(;b<c;b+=2)e=za(b/2|0,a[b],a[b+1],e);else for(c-=2;c>=b;c-=2)e=za(c/2|0,a[c],a[c+1],e);e&&Aa(e,e.next)&&(Ba(e),e=e.next);return e}function T(a,b=a){var c=b===a;do{var g=!1;if(!(a===a.next||na.size!==0&&na.has(a)||!Aa(a,a.next)&&U(a.j,a,a.next)!==0)){if(c||a===b)b=a.j;oa=!0;Ba(a);a=a.j;g=!0}else if(c||a!==b)a=a.next,g=!c}while(g||a!==b);return b}\nfunction ya(a,b,c,g,e){if(e){var d=a,f=d,k=0;do f.z=Ca(f.x,f.y,c,g,e),V[k++]=f,f=f.next;while(f!==d);d=k;if(d<=32)for(f=1;f<d;f++){for(var l=V[f],m=l.z,n=f-1;n>=0&&V[n].z>m;)V[n+1]=V[n],n--;V[n+1]=l}else{W.length<d&&(W=new Uint32Array(d),Da=new Uint32Array(d),X=Array(d));for(f=0;f<d;f++)W[f]=V[f].z;Ea(d,V,W,X,Da,0);Ea(d,X,Da,V,W,8);Ea(d,V,W,X,Da,16);Ea(d,X,Da,V,W,24)}d=null;for(f=0;f<k;f++){l=V[f];if(l.D=d)d.C=l;d=l}d.C=null;V.fill(null,0,k);X.fill(null,0,k)}k=a;for(d=!1;a.j!==a.next;){f=a.j;l=a.next;\nif(m=U(f,a,l)<0)if(e)a:{var p=a.j;m=a.next;n=p.x;var t=a.x,r=m.x;p=p.y;var x=a.y,u=m.y,z=Math.min(n,t,r),J=Math.min(p,x,u),w=Math.max(n,t,r),Q=Math.max(p,x,u),B=Ca(z,J,c,g,e),A=Ca(w,Q,c,g,e);let q=a.D;for(;q&&q.z>=B;){if(q.x>=z&&q.x<=w&&q.y>=J&&q.y<=Q&&q!==m&&(n!==q.x||p!==q.y)&&Fa(n,p,t,x,r,u,q.x,q.y)&&U(q.j,q,q.next)>=0){m=!1;break a}q=q.D}for(B=a.C;B&&B.z<=A;){if(B.x>=z&&B.x<=w&&B.y>=J&&B.y<=Q&&B!==m&&(n!==B.x||p!==B.y)&&Fa(n,p,t,x,r,u,B.x,B.y)&&U(B.j,B,B.next)>=0){m=!1;break a}B=B.C}m=!0}else a:{m=\na.j;A=a.next;n=m.x;t=a.x;r=A.x;p=m.y;x=a.y;u=A.y;z=Math.min(n,t,r);J=Math.min(p,x,u);w=Math.max(n,t,r);Q=Math.max(p,x,u);for(A=A.next;A!==m;){if(A.x>=z&&A.x<=w&&A.y>=J&&A.y<=Q&&(n!==A.x||p!==A.y)&&Fa(n,p,t,x,r,u,A.x,A.y)&&U(A.j,A,A.next)>=0){m=!1;break a}A=A.next}m=!0}if(m)b.push(f.l,a.l,l.l),Ba(a),k=a=l;else if(a=l,a===k)if(oa=!1,a=T(a),oa)k=a;else if(d){a:{k=a;do{for(d=k.next.next;d!==k.j;){if(f=k.l!==d.l){f=Aa(k,d)&&U(k.j,k,k.next)>0&&U(d.j,d,d.next)>0;if(l=k.next.l!==d.l&&(f||Ga(k,d)&&Ga(d,k)&&\n(U(k.j,k,d.j)!==0||U(k,d.j,d)!==0))){b:{l=Math.min(k.x,d.x);m=Math.max(k.x,d.x);n=Math.min(k.y,d.y);t=Math.max(k.y,d.y);r=k;do{p=r.next;if(!(r.x>m&&p.x>m||r.x<l&&p.x<l||r.y>t&&p.y>t||r.y<n&&p.y<n)&&r.l!==k.l&&p.l!==k.l&&r.l!==d.l&&p.l!==d.l&&Ha(r,p,k,d)){l=!0;break b}r=p}while(r!==k);l=!1}l=!l}if(l){if(!f){f=k;l=!1;m=(k.x+d.x)/2;n=(k.y+d.y)/2;do t=f.next,f.y>n!==t.y>n&&m<(t.x-f.x)*(n-f.y)/(t.y-f.y)+f.x&&(l=!l),f=t;while(f!==k);f=l}l=f}f=l}if(f){a=xa(k,d);k=T(k,k.next);a=T(a,a.next);ya(k,b,c,g,e);\nya(a,b,c,g,e);break a}d=d.next}k=k.next}while(k!==a)}break}else{k=b;d=a;f=!1;do l=d.j,m=d.next.next,Ha(l,d,d.next,m,!1)&&Ga(l,m)&&Ga(m,l)&&(k.push(l.l,d.l,m.l),Ba(d),Ba(d.next),d=a=m,f=!0),d=d.next;while(d!==a);k=a=f?T(d):d;d=!0}}}var va=!1;function ra(a,b){return a.x-b.x||a.y-b.y||(a.next.y-a.y)/(a.next.x-a.x)-(b.next.y-b.y)/(b.next.x-b.x)}var sa=16,S=new Float64Array(0),ta=0,Ia=[],Ja=[];\nfunction ua(a,b){do{var c=ta++;Ia[c]=a;let g=a.x,e=a.y,d=a.x,f=a.y,k=0;do{let l=a.next;a.z=c;l.x<g&&(g=l.x);l.x>d&&(d=l.x);l.y<e&&(e=l.y);l.y>f&&(f=l.y);a=l}while(++k<sa&&a!==b);Ja[c]=a;c*=4;S[c]=g;S[c+1]=e;S[c+2]=d;S[c+3]=f}while(a!==b)}function Ka(a){for(var b=Ja[a];b.j.next!==b;)b=b.next;return Ja[a]=b}function La(a){for(var b=Ia[a];b.j.next!==b;)b=b.next;return Ia[a]=b}\nfunction wa(a,b){var c=a.x,g=a.y,e=-Infinity;if(Aa(a,b))return b;for(let p=0,t=0;p<ta;p++,t+=4){if(g<S[t+1]||g>S[t+3]||S[t]>c||S[t+2]<=e)continue;var d=Ka(p);b=La(p);do{if(b.j.next===b){if(Aa(a,b.next))return b.next;if(g<=b.y&&g>=b.next.y&&b.next.y!==b.y){var f=b.x+(g-b.y)*(b.next.x-b.x)/(b.next.y-b.y);if(f<=c&&f>e){e=f;var k=b.x<b.next.x?b:b.next;if(f===c)return k}}}b=b.next}while(b!==d)}if(!k)return null;d=k.x;f=k.y;var l=Math.min(g,f),m=Math.max(g,f),n=Infinity;for(let p=0,t=0;p<ta;p++,t+=4){if(S[t+\n2]<d||S[t]>c||S[t+3]<l||S[t+1]>m)continue;let r=Ka(p);b=La(p);do{if(b.j.next===b&&c>=b.x&&b.x>=d&&c!==b.x&&Fa(g<f?c:e,g,d,f,g<f?e:c,g,b.x,b.y)){let x=Math.abs(g-b.y)/(c-b.x);(Ga(b,a)||b.y===g&&b.next.y===g&&b.next.x>c)&&(x<n||x===n&&(b.x>k.x||b.x===k.x&&U(k.j,k,b.j)<0&&U(b.next,k,k.next)<0))&&(k=b,n=x)}b=b.next}while(b!==r)}return k}var V=[],X=[],W=new Uint32Array(0),Da=new Uint32Array(0),Ma=new Uint32Array(256);\nfunction Ea(a,b,c,g,e,d){Ma.fill(0);for(var f=0;f<a;f++)Ma[c[f]>>>d&255]++;f=0;for(var k=0;k<256;k++){var l=Ma[k];Ma[k]=f;f+=l}for(f=0;f<a;f++)k=c[f],l=Ma[k>>>d&255]++,g[l]=b[f],e[l]=k}function Ca(a,b,c,g,e){a=(a-c)*e|0;b=(b-g)*e|0;a=(a|a<<8)&16711935;a=(a|a<<4)&252645135;a=(a|a<<2)&858993459;b=(b|b<<8)&16711935;b=(b|b<<4)&252645135;b=(b|b<<2)&858993459;return(a|a<<1)&1431655765|((b|b<<1)&1431655765)<<1}\nfunction Fa(a,b,c,g,e,d,f,k){return(e-f)*(b-k)>=(a-f)*(d-k)&&(a-f)*(g-k)>=(c-f)*(b-k)&&(c-f)*(d-k)>=(e-f)*(g-k)}function U(a,b,c){return(b.y-a.y)*(c.x-b.x)-(b.x-a.x)*(c.y-b.y)}function Aa(a,b){return a.x===b.x&&a.y===b.y}function Ha(a,b,c,g,e=!0){var d=U(a,b,c),f=U(a,b,g),k=U(c,g,a),l=U(c,g,b);return(d>0&&f<0||d<0&&f>0)&&(k>0&&l<0||k<0&&l>0)?!0:e?d===0&&Na(a,c,b)||f===0&&Na(a,g,b)||k===0&&Na(c,a,g)||l===0&&Na(c,b,g)?!0:!1:!1}\nfunction Na(a,b,c){return b.x<=Math.max(a.x,c.x)&&b.x>=Math.min(a.x,c.x)&&b.y<=Math.max(a.y,c.y)&&b.y>=Math.min(a.y,c.y)}function Ga(a,b){return U(a.j,a,a.next)<0?U(a,b,a.next)>=0&&U(a,a.j,b)>=0:U(a,b,a.j)<0||U(a,a.next,b)<0}function xa(a,b){var c=Oa(a.l,a.x,a.y),g=Oa(b.l,b.x,b.y),e=a.next,d=b.j;a.next=b;b.j=a;c.next=e;e.j=c;g.next=c;c.j=g;d.next=g;g.j=d;return g}function za(a,b,c,g){a=Oa(a,b,c);g?(a.next=g.next,a.j=g,g.next.j=a,g.next=a):(a.j=a,a.next=a);return a}\nfunction Ba(a){a.next.j=a.j;a.j.next=a.next;a.D&&(a.D.C=a.C);a.C&&(a.C.D=a.D);if(va){var b=a.next;a=a.j.z*4;b.x<S[a]&&(S[a]=b.x);b.y<S[a+1]&&(S[a+1]=b.y);b.x>S[a+2]&&(S[a+2]=b.x);b.y>S[a+3]&&(S[a+3]=b.y)}}function Oa(a,b,c){return{l:a,x:b,y:c,j:null,next:null,z:0,D:null,C:null}}\nvar Pa=(...a)=>{for(var b={},c=0;c<a.length;c+=2)b[a[c]]=a[c+1];self.postMessage(b)},Qa=[{m:"l",o:"t",u:[.59,.59,.59],v:[[15,20],[18,50]]},{m:"f",o:"b",u:[.94,.96,.94],v:1,A:[[14,0],[17,1]]},{m:"l",o:"r1",u:[.39,.39,.39],v:1,A:[[16,0],[18,1]]},{m:"l",o:"r2",u:[.77,.63,0],v:1},{m:"f",o:"r5",u:[1,1,1]},{m:"f",o:"r3",u:[1,.77,.6]},{m:"l",o:"r8",u:[1,.77,.6],v:[[10,5],[13,10]]},{m:"f",o:"r4",u:[.93,.86,.58]},{m:"l",o:"r9",u:[.93,.86,.58],v:[[10,5],[16,30]]},{m:"l",o:"r6",u:[.39,.39,.39],v:2,sa:[20,20]},\n{m:"f",o:"w",u:[.66,.86,1]},{m:"f",o:"g",u:[.8,.93,.66]},{m:"p",o:"c",u:[.4,.4,.4],K:14,ta:10},{m:"p",o:"rt",K:12,ca:{border:"1px solid #fff","border-radius":"4px 4px 50% 50%",background:"#06a",padding:"5px",color:"#fff"}},{m:"p",o:"d",u:[.4,.4,.4],K:12,A:[[13,0],[14,1]]},{m:"s",o:"p"}],Ra=async a=>{function b(q,y,K){for(var C=[],L=0;L<q.length;L++){let I=fa(q,L),F=ca(I),M=F.G.c,v=F.G.t;M=="bs"&&v&&(v=v.replace("S","\\u897f\\u80a5\\u30d0\\u30b9").replace("W","\\u662d\\u548c\\u30d0\\u30b9"));C.push({p:F.lines[0][0],\nt:I.G.n,d:v,c:M})}Pa("d",{f:C,p:{type:y.m,layer:y.o,color:y.u,size:y.K,opacity:y.A,css:y.ca},z:K})}function c(q){var y=0;for(let K=0;K<q.length;K++){let C=q[K],L=q[(K+1)%q.length];y+=(L[0]-C[0])*(L[1]+C[1])}return y<0}function g(q,y){var K=y.v||0;if(y.m=="f"){var C=y.u;y=y.A||1;for(var L=[.3,.3,.3],I=0;I<q.length;I++){var F=fa(q,I);if(F.type!==3)continue;var M=ca(F).lines;F=[];for(var v of M){if(v.length===0)continue;M=v.map(N=>[N.x,N.y]);c(M)?(F.length>0&&d(F,C,L,K,y),F=[M]):F.push(M)}F.length>0&&\nd(F,C,L,K,y)}}else for(L=y.u,y=y.A||1,I=0;I<q.length;I++){v=fa(q,I);if(v.type!==2)continue;v=ca(v).lines;for(C of v){if(C.length===0)continue;v=C.map(N=>[N.x,N.y]);K!=1?f(v,L,K,y):e(v,L,y)}}}function e(q,y,K){for(let C=0;C<q.length;C++)u.push(...q[C],k.length,1),C<q.length-1&&z.push(J+C,J+C+1);J+=q.length;k.push({fillColor:[1,1,1],R:y,opacity:K,v:1})}function d(q,y,K,C,L){var I=[],F=[],M=0;for(let v=0;v<q.length;v++){let N=q[v];if(N.length){v>0&&F.push(M);for(let P=0;P<N.length;P++){let R=N[P];I.push(R[0],\nR[1]);l.push(...R,k.length,1);M++;C>0&&p.push(t+P,t+(P+1==N.length?0:P+1))}t+=N.length}}q=pa(I,F);q.length&&(q.forEach(v=>{n.push(m+v)}),k.push({fillColor:y,R:K,opacity:L,v:C}),m+=M)}function f(q,y,K,C){var L=q.length;if(!(L<2)){for(let I=0;I<L-1;I++){let F=q[I],M=q[I+1],v=r.length,N=k.length,P=M[0]-F[0],R=-M[1]+F[1];r.push({i:F,I:N,J:[R,-P]});r.push({i:F,I:N,J:[-R,P]});r.push({i:M,I:N,J:[-R,P]});r.push({i:M,I:N,J:[R,-P]});x.push(v,v+1,v+2,v+2,v+3,v);I>0&&x.push(v,v-1,v+1,v+1,v-2,v)}k.push({fillColor:[1,\n1,1],R:y,opacity:C,v:K})}}var k=[],l=[],m=0,n=[],p=[],t=0,r=[],x=[],u=[],z=[],J=0,w=await fetch("https://192.168.11.2/t/"+a.join("/"));w=await new la(await w.arrayBuffer());w=(new ka(w)).ia;for(var Q=Qa.length;Q--;){var B=Qa[Q],A=w[B.o];A&&(/p|s/.test(B.m)?b(A,B,a):g(A,B))}return{$:k,Z:l,T:n,O:p,X:r,S:x,ba:u,U:z}},Sa=(a,b,c,g,e,d,f,k,l="fs_main")=>{var m=D;return m.createRenderPipeline({layout:m.createPipelineLayout({bindGroupLayouts:[a,b]}),vertex:{module:g,entryPoint:e,buffers:[{arrayStride:d,stepMode:"vertex",\nattributes:f.map((n,p)=>({shaderLocation:p,offset:n[0],format:n[1]}))}]},fragment:{module:g,entryPoint:l,targets:[{format:c,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:k},depthStencil:{format:"depth24plus",depthWriteEnabled:!0,depthCompare:"greater"},multisample:{count:4}})},Y,Z,D,Ta,Ua,Va,Wa,Xa,Ya,Za;({fa:Wa,da:Xa,ea:Ya,pa:Za}={fa:10,da:879,ea:410,pa:1024});\nself.onmessage=async a=>{a.data.c?(Y=a.data.c,Z=a.data.s,a=new Float32Array(a.data.b),$a(a)):a.data.s&&(Z=a.data.s,Y.width=Z[0],Y.height=Z[1],ab())};\nasync function $a(a){function b(){requestAnimationFrame(b);if(a[3]){var x=D.createCommandEncoder(),u=x.beginRenderPass({colorAttachments:[{view:Ua.createView(),resolveTarget:g.getCurrentTexture().createView(),clearValue:{r:.96,g:.97,b:.98,a:1},loadOp:"clear",storeOp:"discard"}],depthStencilAttachment:{view:Va.createView(),depthClearValue:0,depthLoadOp:"clear",depthStoreOp:"store"}});u.setBindGroup(0,t);for(let w of r){var z=w.ra,J=w.qa;D.queue.writeBuffer(Ta,0,new Float32Array([a[2]]));z=bb(...z,\n4096,a[0],a[1],a[2],...Z);D.queue.writeBuffer(J,0,z);u.setBindGroup(1,w.ga);w.Y>0&&(u.setVertexBuffer(0,w.ma),u.setPipeline(k),u.setIndexBuffer(w.la,"uint32"),u.drawIndexed(w.Y,1,0,0,0));w.V>0&&(u.setPipeline(l),u.setIndexBuffer(w.ha,"uint32"),u.drawIndexed(w.V,1,0,0,0));w.W>0&&(u.setVertexBuffer(0,w.ka),u.setPipeline(m),u.setIndexBuffer(w.ja,"uint32"),u.drawIndexed(w.W,1,0,0,0));w.aa>0&&(u.setVertexBuffer(0,w.oa),u.setPipeline(l),u.setIndexBuffer(w.na,"uint32"),u.drawIndexed(w.aa,1,0,0,0))}u.end();\nD.queue.submit([x.finish()]);a[3]=0}}if(D=await (await navigator.gpu?.requestAdapter())?.requestDevice()){D.pushErrorScope("validation");var c=await D.popErrorScope();c&&console.error("WebGPU \\u30d0\\u30ea\\u30c7\\u30fc\\u30b7\\u30e7\\u30f3\\u30a8\\u30e9\\u30fc:",c.message);D.lost.then(x=>{console.error(`WebGPU \\u30C7\\u30D0\\u30A4\\u30B9\\u304C\\u55AA\\u5931\\u3057\\u307E\\u3057\\u305F\\u3002\\u7406\\u7531: ${x.reason}`);console.error(`\\u30E1\\u30C3\\u30BB\\u30FC\\u30B8: ${x.message}`);x.reason==="destroyed"?console.log("\\u30c7\\u30d0\\u30a4\\u30b9\\u306f\\u610f\\u56f3\\u7684\\u306b\\u7834\\u68c4\\u3055\\u308c\\u307e\\u3057\\u305f\\u3002"):\nconsole.log("\\u30c7\\u30d0\\u30a4\\u30b9\\u3092\\u518d\\u521d\\u671f\\u5316\\u3057\\u307e\\u3059...")});var g=Y.getContext("webgpu");Y.width=Z[0];Y.height=Z[1];var e=navigator.gpu.getPreferredCanvasFormat();g.configure({device:D,format:e,alphaMode:"premultiplied"});var d=D.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});c=D.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},\n{binding:1,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]});var f=D.createShaderModule({code:"struct PrimitiveVertex{@location(0)pos:vec2i,@location(1)feature_id:i32,}struct PolylineVertex{@location(0)pos:vec2i,@location(1)feature_id:i32,@location(2)pad:u32,@location(3)normal:vec2f,}struct Property{fillColor:vec3f,opacity:f32,lineColor:vec3f,thickness:f32,}struct Style{min_zoom:f32,min_val:f32,max_zoom:f32,max_val:f32,};struct Uniforms{zoom:f32,pad0:f32,pad1:f32,pad2:f32,styles:array<Style,6>,}struct Transform{matrix:mat3x2f,}@group(0)@binding(0)var<uniform> uniforms:Uniforms;@group(1)@binding(0)var<uniform> transform:Transform;@group(1)@binding(1)var<storage,read>properties:array<Property>;struct VertexOutput{@builtin(position)position:vec4f,@location(0)color:vec4f,@location(1)normal:vec2f,@location(2)pos:vec2f,}fn sheer(color:vec3f,o:f32)->vec4f{var opacity=o;if(opacity<0){let style=uniforms.styles[u32(-opacity-1)];let t=clamp((uniforms.zoom-style.min_zoom)/(style.max_zoom-style.min_zoom),0.0,1.0);opacity=mix(style.min_val,style.max_val,t);}return vec4f(color,opacity);}@vertex fn vs_polygon(input:PrimitiveVertex)->VertexOutput{var output:VertexOutput;let prop=properties[input.feature_id];let cam_pos=transform.matrix*vec3f(vec2f(input.pos),1.0);var z=f32(input.feature_id+1)*1e-6;output.position=vec4f(cam_pos,z,1.0);output.color=sheer(prop.fillColor,prop.opacity);return output;}@vertex fn vs_thinline(input:PrimitiveVertex)->VertexOutput{var output:VertexOutput;let prop=properties[input.feature_id];let cam_pos=transform.matrix*vec3f(vec2f(input.pos),1.0);var z=f32(input.feature_id+1)*1e-6+1e-7;output.position=vec4f(cam_pos,z,1.0);output.color=sheer(prop.lineColor,prop.opacity);return output;}@vertex fn vs_polyline(input:PolylineVertex,)->VertexOutput{var output:VertexOutput;let prop=properties[input.feature_id];let cam_pos=transform.matrix*vec3f(vec2f(input.pos),1.0);var thickness=prop.thickness;if(thickness==-1){output.pos=cam_pos;}else{output.pos=vec2f(0,0);}if(thickness<0){let style=uniforms.styles[u32(-thickness-1)];let t=clamp((uniforms.zoom-style.min_zoom)/(style.max_zoom-style.min_zoom),0.0,1.0);thickness=mix(style.min_val,style.max_val,t);}let normal=normalize(input.normal);let thickness_ndc=thickness/512.0;let offset=vec2f(normal.x*thickness_ndc*0.5,normal.y*thickness_ndc*0.5);let final_pos=cam_pos+offset;var z=f32(input.feature_id+1)*1e-6;output.position=vec4f(final_pos,z,1.0);output.color=sheer(prop.lineColor,prop.opacity);output.normal=normal;return output;}@fragment fn fs_main(input:VertexOutput)->@location(0)vec4f{return input.color;}@fragment fn fs_polyline(input:VertexOutput)->@location(0)vec4f{if(length(input.pos)>0&&length(input.normal)<0.5&&((input.pos.y+1)*20)% 2>0.5){discard;}return input.color;}"}),\nk=Sa(d,c,e,f,"vs_polygon",16,[[0,"sint32x2"],[8,"sint32"]],"triangle-list"),l=Sa(d,c,e,f,"vs_thinline",16,[[0,"sint32x2"],[8,"sint32"]],"line-list"),m=Sa(d,c,e,f,"vs_polyline",32,[[0,"sint32x2"],[8,"sint32"],[12,"uint32"],[16,"float32x2"]],"triangle-list","fs_polyline");e=await f.getCompilationInfo();for(var n of e.messages)console.error(`WGSL error: ${n.message} at line ${n.lineNum}`);Ta=D.createBuffer({size:128,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});n=[];for(var p of Qa)/p|s/.test(p.m)||\n(Array.isArray(p.v)&&(n.push(...p.v.flat()),p.v=-(~~n.length/4)),Array.isArray(p.A)&&(n.push(...p.A.flat()),p.A=-(~~n.length/4)));D.queue.writeBuffer(Ta,16,new Float32Array(n));var t=D.createBindGroup({layout:d,entries:[{binding:0,resource:{buffer:Ta}}]}),r=[];p=[[15,28191,13180],[15,28192,13180]];for(let x of p)p=await Ra(x),console.log("tileData",p),p=aa(c,p,x),r.push(p);console.log("tiles",r);ab();b()}else Pa("e","WebGPU \\u3092\\u30b5\\u30dd\\u30fc\\u30c8\\u3057\\u3066\\u3044\\u306a\\u3044\\u30d6\\u30e9\\u30a6\\u30b6\\u3001\\u307e\\u305f\\u306f\\u74b0\\u5883\\u3067\\u3059\\u3002")}\nfunction bb(a,b,c,g,e,d,f,k,l){f=Za*Math.pow(2,f-Wa);k=f/k*2;l=f/l*2;a-=Wa;f=1/Math.pow(2,a);return new Float32Array([f/g*k,0,0,-(f/g)*l,((b-Xa*Math.pow(2,a))*f-e)*k,-((c-Ya*Math.pow(2,a))*f-d)*l])}function ab(){var a=Z;Ua=D.createTexture({size:a,sampleCount:4,format:navigator.gpu.getPreferredCanvasFormat(),usage:GPUTextureUsage.RENDER_ATTACHMENT});Va=D.createTexture({size:a,sampleCount:4,format:"depth24plus",usage:GPUTextureUsage.RENDER_ATTACHMENT})};//# sourceMappingURL=/worker.map\n'], { type: "application/javascript" });
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
tiny_default(worker).on("message", (e) => {
  if (e.data["e"]) {
    alert(e.data["e"]);
  }
  if (e.data["d"]) {
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
