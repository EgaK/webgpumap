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
var blob = new Blob(['function aa(a,b,c){var g=32,e=c.J.length*g,d=a.createBuffer({size:e,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),f=new Uint8Array(e);c.J.forEach((w,B)=>{B*=g;w=new Float32Array([...w.fillColor,w.opacity,...w.P,w.v]);f.set(new Uint8Array(w.buffer),B)});a.queue.writeBuffer(d,0,f);e=a.createBuffer({size:c.W.length*16,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});var k=new Int32Array(c.W);a.queue.writeBuffer(e,0,k);k=a.createBuffer({size:c.S.length*4,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});\nvar l=new Uint32Array(c.S);a.queue.writeBuffer(k,0,l);l=a.createBuffer({size:c.N.length*4,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});var m=new Uint32Array(c.N);a.queue.writeBuffer(l,0,m);g=32;var n=c.V.length*g;m=a.createBuffer({size:n,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});var q=new Uint8Array(n);c.V.forEach((w,B)=>{B*=g;var I=new Int32Array([...w.i,w.H]);w=new Float32Array(w.I);q.set(new Uint8Array(I.buffer),B);q.set(new Uint8Array(w.buffer),B+16)});a.queue.writeBuffer(m,\n0,q);n=a.createBuffer({size:c.R.length*4,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});var v=new Uint32Array(c.R);a.queue.writeBuffer(n,0,v);v=a.createBuffer({size:c.X.length*16,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});var t=new Int32Array(c.X);a.queue.writeBuffer(v,0,t);t=a.createBuffer({size:c.T.length*4,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});var y=new Uint32Array(c.T);a.queue.writeBuffer(t,0,y);return{Y:a.createBindGroup({layout:b,entries:[{binding:0,resource:{buffer:d}}]}),\nJ:c.J,oa:d,ga:e,ea:k,fa:c.S.length,Z:l,$:c.N.length,da:m,ba:n,ca:c.R.length,ka:v,ia:t,ja:c.T.length}}function z(a,b){this.x=a;this.y=b}function ba(a,b){a.x/=b;a.y/=b;return a}\nz.prototype={clone(){return new z(this.x,this.y)},add(a){var b=this.clone();b.x+=a.x;b.y+=a.y;return b},sub(a){var b=this.clone();b.x-=a.x;b.y-=a.y;return b},div(a){return ba(this.clone(),a)},rotate(a){var b=this.clone(),c=Math.cos(a);a=Math.sin(a);var g=a*b.x+c*b.y;b.x=c*b.x-a*b.y;b.y=g;return b},unit(){var a=this.clone();ba(a,Math.sqrt(a.x*a.x+a.y*a.y));return a},round(){var a=this.clone();a.x=Math.round(a.x);a.y=Math.round(a.y);return a},equals(a){return this.x===a.x&&this.y===a.y},angle(){return Math.atan2(this.y,\nthis.x)},constructor:z};function ca(a){if(a.K<0)console.log("feature has no geometry");else{var b=a.F;b.i=a.K;a=A(b)+b.i;for(var c=[],g,e=1,d=0,f=0,k=0;b.i<a;){if(d<=0&&(d=A(b),e=d&7,d>>=3,d===0))continue;d--;if(e===1)f+=C(b),k+=C(b),g&&c.push(g),g=[new z(f,k)];else if(e===2)f+=C(b),k+=C(b),g&&g.push(new z(f,k));else if(e===7)g&&g.push(g[0].clone());else{console.log(`unknown command ${e}`);return}}g&&c.push(g);return c}}\nvar da=class{constructor(a,b,c,g,e){this.ha=Object.create(null);this.O=c;this.type=0;this.id=void 0;this.F=a;this.K=-1;this.L=g;for(this.M=e;a.i<b;)if(c=A(a),c===8)this.id=A(a);else if(c===18)for(c=A(a)+a.i;a.i<c;){let d=g[A(a)],f=e[A(a)];this.ha[d]=f}else c===24?this.type=A(a):(c===34&&(this.K=a.i),J(a,c))}};function ea(a,b){if(b<0||b>=a.G.length)console.log("feature index out of bounds");else return a.F.i=a.G[b],b=A(a.F)+a.F.i,new da(a.F,b,a.O,a.L,a.M)}\nvar ia=class{constructor(a,b){this.version=1;this.name="";this.O=4096;this.length=0;this.F=a;this.L=[];this.M=[];this.G=[];b===void 0&&(b=a.length);for(;a.i<b;){var c=A(a);if(c===10)this.name=fa(a);else if(c===18)this.G.push(a.i),J(a,c);else if(c===26)this.L.push(fa(a));else if(c===34){c=this.M;var g=c.push;{var e=a;var d=null;let f=A(e)+e.i;for(;e.i<f;)d=A(e),d===10?d=fa(e):d===21?(d=ha(e.A,e.i,23,4),e.i+=4):d===25?(d=ha(e.A,e.i,52,8),e.i+=8):d=d===32?A(e,!0):d===40?A(e):d===48?C(e):d===56?!!A(e):\n(J(e,d),null);d==null?(console.log("unknown feature value"),e=void 0):e=d}g.call(c,e)}else c===40?this.O=A(a):c===120?this.version=A(a):J(a,c)}this.length=this.G.length}},ja=class{constructor(a,b=a.length){for(var c=Object.create(null);a.i<b;){var g=A(a);g===26?(g=new ia(a,A(a)+a.i),g.length&&(c[g.name]=g)):J(a,g)}this.aa=c}},ha=(a,b,c,g)=>{var e=g*8-c-1;var d=(1<<e)-1,f=d>>1,k=-7,l=g-1,m=a[b+l];l+=-1;g=m&(1<<-k)-1;m>>=-k;for(k+=e;k>0;g=g*256+a[b+l],l+=-1,k-=8);e=g&(1<<-k)-1;g>>=-k;for(k+=c;k>0;e=\ne*256+a[b+l],l+=-1,k-=8);if(g===0)g=1-f;else{if(g===d)return e?NaN:(m?-1:1)*Infinity;e+=Math.pow(2,c);g-=f}return(m?-1:1)*e*Math.pow(2,g-c)};function ka(a){this.A=ArrayBuffer.isView&&ArrayBuffer.isView(a)?a:new Uint8Array(a||0);this.type=this.i=0;this.length=this.A.length}\nfunction A(a,b){var c=a.A;var g=c[a.i++];var e=g&127;if(g<128)return e;g=c[a.i++];e|=(g&127)<<7;if(g<128)return e;g=c[a.i++];e|=(g&127)<<14;if(g<128)return e;g=c[a.i++];e|=(g&127)<<21;if(g<128)return e;g=c[a.i];return la(e|(g&15)<<28,b,a)}function J(a,b){b&=7;if(b===0)for(;a.A[a.i++]>127;);else b===2?a.i=A(a)+a.i:b===5?a.i+=4:b===1?a.i+=8:console.log("Unimplemented type: "+b)}function C(a){a=A(a);return a%2===1?(a+1)/-2:a/2}\nfunction fa(a){var b=A(a)+a.i;var c=a.A;for(var g="",e=a.i;e<b;){var d=c[e],f=null,k=d>239?4:d>223?3:d>191?2:1;if(e+k>b)break;if(k===1)d<128&&(f=d);else if(k===2){var l=c[e+1];(l&192)===128&&(f=(d&31)<<6|l&63,f<=127&&(f=null))}else if(k===3){l=c[e+1];var m=c[e+2];(l&192)===128&&(m&192)===128&&(f=(d&15)<<12|(l&63)<<6|m&63,f<=2047||f>=55296&&f<=57343)&&(f=null)}else if(k===4){l=c[e+1];m=c[e+2];var n=c[e+3];(l&192)===128&&(m&192)===128&&(n&192)===128&&(f=(d&15)<<18|(l&63)<<12|(m&63)<<6|n&63,f<=65535||\nf>=1114112)&&(f=null)}f===null?(f=65533,k=1):f>65535&&(f-=65536,g+=String.fromCharCode(f>>>10&1023|55296),f=56320|f&1023);g+=String.fromCharCode(f);e+=k}c=g;a.i=b;return c}ka.prototype={destroy:function(){this.A=null}};\nvar la=(a,b,c)=>{var g=c.A;var e=g[c.i++];var d=(e&112)>>4;if(e<128)return P(a,d,b);e=g[c.i++];d|=(e&127)<<3;if(e<128)return P(a,d,b);e=g[c.i++];d|=(e&127)<<10;if(e<128)return P(a,d,b);e=g[c.i++];d|=(e&127)<<17;if(e<128)return P(a,d,b);e=g[c.i++];d|=(e&127)<<24;if(e<128)return P(a,d,b);e=g[c.i++];d|=(e&1)<<31;if(e<128)return P(a,d,b);console.log("Expected varint not more than 10 bytes")},P=(a,b,c)=>c?b*4294967296+(a>>>0):(b>>>0)*4294967296+(a>>>0),Q=new Set,ma=!1;\nfunction na(a,b){var c=b&&b.length,g=c?b[0]*2:a.length;Q.size&&Q.clear();var e=oa(a,0,g,!0),d=[];if(!e||e.next===e.j)return d;var f=0,k=0,l=0;if(c){c=e;e=[];for(let q=0,v=b.length;q<v;q++){var m=oa(a,b[q]*2,q<v-1?b[q+1]*2:a.length,!1);m===m.next&&Q.add(m);var n=m;let t=m;do{if(n.x<t.x||n.x===t.x&&n.y<t.y)t=n;n=n.next}while(n!==m);e.push(t)}e.sort(pa);b=b.length;b=Math.ceil((a.length/2+2*b)/qa)+b+2;R.length<b*4&&(R=new Float64Array(b*4));ra=0;sa(c,c);ta=!0;for(b=0;b<e.length;b++)a:{m=e[b];n=c;c=ua(m,\nn);if(!c){c=n;break a}m=va(c,m);sa(c,m.next.next);S(m,m.next);c=S(c,c.next)}ta=!1;e=S(c)}if(a.length>160){f=a[0];k=a[1];l=f;c=k;for(b=2;b<g;b+=2)m=a[b],n=a[b+1],m<f&&(f=m),n<k&&(k=n),m>l&&(l=m),n>c&&(c=n);l=Math.max(l-f,c-k);l=l!==0?32767/l:0}wa(e,d,f,k,l);return d}\nfunction oa(a,b,c,g){var e=null,d=0;for(let f=b,k=c-2;f<c;f+=2)d+=(a[k]-a[f])*(a[f+1]+a[k+1]),k=f;if(g===d>0)for(;b<c;b+=2)e=xa(b/2|0,a[b],a[b+1],e);else for(c-=2;c>=b;c-=2)e=xa(c/2|0,a[c],a[c+1],e);e&&T(e,e.next)&&(U(e),e=e.next);return e}function S(a,b=a){var c=b===a;do{var g=!1;if(!(a===a.next||Q.size!==0&&Q.has(a)||!T(a,a.next)&&V(a.j,a,a.next)!==0)){if(c||a===b)b=a.j;ma=!0;U(a);a=a.j;g=!0}else if(c||a!==b)a=a.next,g=!c}while(g||a!==b);return b}\nfunction wa(a,b,c,g,e){if(e){var d=a,f=d,k=0;do f.z=ya(f.x,f.y,c,g,e),W[k++]=f,f=f.next;while(f!==d);d=k;if(d<=32)for(f=1;f<d;f++){for(var l=W[f],m=l.z,n=f-1;n>=0&&W[n].z>m;)W[n+1]=W[n],n--;W[n+1]=l}else{X.length<d&&(X=new Uint32Array(d),Y=new Uint32Array(d),Z=Array(d));for(f=0;f<d;f++)X[f]=W[f].z;za(d,W,X,Z,Y,0);za(d,Z,Y,W,X,8);za(d,W,X,Z,Y,16);za(d,Z,Y,W,X,24)}d=null;for(f=0;f<k;f++){l=W[f];if(l.D=d)d.B=l;d=l}d.B=null;W.fill(null,0,k);Z.fill(null,0,k)}k=a;for(d=!1;a.j!==a.next;){f=a.j;l=a.next;\nif(m=V(f,a,l)<0)if(e)a:{var q=a.j;m=a.next;n=q.x;var v=a.x,t=m.x;q=q.y;var y=a.y,w=m.y,B=Math.min(n,v,t),I=Math.min(q,y,w),L=Math.max(n,v,t),N=Math.max(q,y,w),r=ya(B,I,c,g,e),p=ya(L,N,c,g,e);let u=a.D;for(;u&&u.z>=r;){if(u.x>=B&&u.x<=L&&u.y>=I&&u.y<=N&&u!==m&&(n!==u.x||q!==u.y)&&Aa(n,q,v,y,t,w,u.x,u.y)&&V(u.j,u,u.next)>=0){m=!1;break a}u=u.D}for(r=a.B;r&&r.z<=p;){if(r.x>=B&&r.x<=L&&r.y>=I&&r.y<=N&&r!==m&&(n!==r.x||q!==r.y)&&Aa(n,q,v,y,t,w,r.x,r.y)&&V(r.j,r,r.next)>=0){m=!1;break a}r=r.B}m=!0}else a:{m=\na.j;p=a.next;n=m.x;v=a.x;t=p.x;q=m.y;y=a.y;w=p.y;B=Math.min(n,v,t);I=Math.min(q,y,w);L=Math.max(n,v,t);N=Math.max(q,y,w);for(p=p.next;p!==m;){if(p.x>=B&&p.x<=L&&p.y>=I&&p.y<=N&&(n!==p.x||q!==p.y)&&Aa(n,q,v,y,t,w,p.x,p.y)&&V(p.j,p,p.next)>=0){m=!1;break a}p=p.next}m=!0}if(m)b.push(f.l,a.l,l.l),U(a),k=a=l;else if(a=l,a===k)if(ma=!1,a=S(a),ma)k=a;else if(d){a:{k=a;do{for(d=k.next.next;d!==k.j;){if(f=k.l!==d.l){f=T(k,d)&&V(k.j,k,k.next)>0&&V(d.j,d,d.next)>0;if(l=k.next.l!==d.l&&(f||Ba(k,d)&&Ba(d,k)&&\n(V(k.j,k,d.j)!==0||V(k,d.j,d)!==0))){b:{l=Math.min(k.x,d.x);m=Math.max(k.x,d.x);n=Math.min(k.y,d.y);v=Math.max(k.y,d.y);t=k;do{q=t.next;if(!(t.x>m&&q.x>m||t.x<l&&q.x<l||t.y>v&&q.y>v||t.y<n&&q.y<n)&&t.l!==k.l&&q.l!==k.l&&t.l!==d.l&&q.l!==d.l&&Ca(t,q,k,d)){l=!0;break b}t=q}while(t!==k);l=!1}l=!l}if(l){if(!f){f=k;l=!1;m=(k.x+d.x)/2;n=(k.y+d.y)/2;do v=f.next,f.y>n!==v.y>n&&m<(v.x-f.x)*(n-f.y)/(v.y-f.y)+f.x&&(l=!l),f=v;while(f!==k);f=l}l=f}f=l}if(f){a=va(k,d);k=S(k,k.next);a=S(a,a.next);wa(k,b,c,g,e);\nwa(a,b,c,g,e);break a}d=d.next}k=k.next}while(k!==a)}break}else{k=b;d=a;f=!1;do l=d.j,m=d.next.next,Ca(l,d,d.next,m,!1)&&Ba(l,m)&&Ba(m,l)&&(k.push(l.l,d.l,m.l),U(d),U(d.next),d=a=m,f=!0),d=d.next;while(d!==a);k=a=f?S(d):d;d=!0}}}var ta=!1;function pa(a,b){return a.x-b.x||a.y-b.y||(a.next.y-a.y)/(a.next.x-a.x)-(b.next.y-b.y)/(b.next.x-b.x)}var qa=16,R=new Float64Array(0),ra=0,Da=[],Ea=[];\nfunction sa(a,b){do{var c=ra++;Da[c]=a;let g=a.x,e=a.y,d=a.x,f=a.y,k=0;do{let l=a.next;a.z=c;l.x<g&&(g=l.x);l.x>d&&(d=l.x);l.y<e&&(e=l.y);l.y>f&&(f=l.y);a=l}while(++k<qa&&a!==b);Ea[c]=a;c*=4;R[c]=g;R[c+1]=e;R[c+2]=d;R[c+3]=f}while(a!==b)}function Fa(a){for(var b=Ea[a];b.j.next!==b;)b=b.next;return Ea[a]=b}function Ga(a){for(var b=Da[a];b.j.next!==b;)b=b.next;return Da[a]=b}\nfunction ua(a,b){var c=a.x,g=a.y,e=-Infinity;if(T(a,b))return b;for(let q=0,v=0;q<ra;q++,v+=4){if(g<R[v+1]||g>R[v+3]||R[v]>c||R[v+2]<=e)continue;var d=Fa(q);b=Ga(q);do{if(b.j.next===b){if(T(a,b.next))return b.next;if(g<=b.y&&g>=b.next.y&&b.next.y!==b.y){var f=b.x+(g-b.y)*(b.next.x-b.x)/(b.next.y-b.y);if(f<=c&&f>e){e=f;var k=b.x<b.next.x?b:b.next;if(f===c)return k}}}b=b.next}while(b!==d)}if(!k)return null;d=k.x;f=k.y;var l=Math.min(g,f),m=Math.max(g,f),n=Infinity;for(let q=0,v=0;q<ra;q++,v+=4){if(R[v+\n2]<d||R[v]>c||R[v+3]<l||R[v+1]>m)continue;let t=Fa(q);b=Ga(q);do{if(b.j.next===b&&c>=b.x&&b.x>=d&&c!==b.x&&Aa(g<f?c:e,g,d,f,g<f?e:c,g,b.x,b.y)){let y=Math.abs(g-b.y)/(c-b.x);(Ba(b,a)||b.y===g&&b.next.y===g&&b.next.x>c)&&(y<n||y===n&&(b.x>k.x||b.x===k.x&&V(k.j,k,b.j)<0&&V(b.next,k,k.next)<0))&&(k=b,n=y)}b=b.next}while(b!==t)}return k}var W=[],Z=[],X=new Uint32Array(0),Y=new Uint32Array(0),Ha=new Uint32Array(256);\nfunction za(a,b,c,g,e,d){Ha.fill(0);for(var f=0;f<a;f++)Ha[c[f]>>>d&255]++;f=0;for(var k=0;k<256;k++){var l=Ha[k];Ha[k]=f;f+=l}for(f=0;f<a;f++)k=c[f],l=Ha[k>>>d&255]++,g[l]=b[f],e[l]=k}function ya(a,b,c,g,e){a=(a-c)*e|0;b=(b-g)*e|0;a=(a|a<<8)&16711935;a=(a|a<<4)&252645135;a=(a|a<<2)&858993459;b=(b|b<<8)&16711935;b=(b|b<<4)&252645135;b=(b|b<<2)&858993459;return(a|a<<1)&1431655765|((b|b<<1)&1431655765)<<1}\nfunction Aa(a,b,c,g,e,d,f,k){return(e-f)*(b-k)>=(a-f)*(d-k)&&(a-f)*(g-k)>=(c-f)*(b-k)&&(c-f)*(d-k)>=(e-f)*(g-k)}function V(a,b,c){return(b.y-a.y)*(c.x-b.x)-(b.x-a.x)*(c.y-b.y)}function T(a,b){return a.x===b.x&&a.y===b.y}function Ca(a,b,c,g,e=!0){var d=V(a,b,c),f=V(a,b,g),k=V(c,g,a),l=V(c,g,b);return(d>0&&f<0||d<0&&f>0)&&(k>0&&l<0||k<0&&l>0)?!0:e?d===0&&Ia(a,c,b)||f===0&&Ia(a,g,b)||k===0&&Ia(c,a,g)||l===0&&Ia(c,b,g)?!0:!1:!1}\nfunction Ia(a,b,c){return b.x<=Math.max(a.x,c.x)&&b.x>=Math.min(a.x,c.x)&&b.y<=Math.max(a.y,c.y)&&b.y>=Math.min(a.y,c.y)}function Ba(a,b){return V(a.j,a,a.next)<0?V(a,b,a.next)>=0&&V(a,a.j,b)>=0:V(a,b,a.j)<0||V(a,a.next,b)<0}function va(a,b){var c=Ja(a.l,a.x,a.y),g=Ja(b.l,b.x,b.y),e=a.next,d=b.j;a.next=b;b.j=a;c.next=e;e.j=c;g.next=c;c.j=g;d.next=g;g.j=d;return g}function xa(a,b,c,g){a=Ja(a,b,c);g?(a.next=g.next,a.j=g,g.next.j=a,g.next=a):(a.j=a,a.next=a);return a}\nfunction U(a){a.next.j=a.j;a.j.next=a.next;a.D&&(a.D.B=a.B);a.B&&(a.B.D=a.D);if(ta){var b=a.next;a=a.j.z*4;b.x<R[a]&&(R[a]=b.x);b.y<R[a+1]&&(R[a+1]=b.y);b.x>R[a+2]&&(R[a+2]=b.x);b.y>R[a+3]&&(R[a+3]=b.y)}}function Ja(a,b,c){return{l:a,x:b,y:c,j:null,next:null,z:0,D:null,B:null}}\nvar Ka=[{m:"l",o:"t",u:[.59,.59,.59],v:[[15,20],[18,50]]},{m:"f",o:"b",u:[.94,.96,.94],v:1,C:[[14,0],[17,1]]},{m:"l",o:"r1",u:[.39,.39,.39],v:1,C:[[16,0],[18,1]]},{m:"l",o:"r2",u:[.77,.63,0],v:1},{m:"f",o:"r5",u:[1,1,1]},{m:"f",o:"r3",u:[1,.77,.6]},{m:"l",o:"r8",u:[1,.77,.6],v:[[10,5],[13,10]]},{m:"f",o:"r4",u:[.93,.86,.58]},{m:"l",o:"r9",u:[.93,.86,.58],v:[[10,5],[16,30]]},{m:"l",o:"r6",u:[.39,.39,.39],v:2,ma:[20,20]},{m:"f",o:"w",u:[.66,.86,1]},{m:"f",o:"g",u:[.8,.93,.66]},{m:"p",o:"c",u:[.4,.4,\n.4],U:14,na:10},{m:"p",o:"rt",U:12,la:{border:"1px solid #fff","border-radius":"4px 4px 50% 50%",background:"#06a",padding:"5px",color:"#fff"}},{m:"p",o:"d",u:[.4,.4,.4],U:12,C:[[13,0],[14,1]]},{m:"s",o:"p"}],La=async()=>{function a(r){var p=0;for(let u=0;u<r.length;u++){let D=r[u],K=r[(u+1)%r.length];p+=(K[0]-D[0])*(K[1]+D[1])}return p<0}function b(r,p){var u=p.v||0;if(p.m=="f"){var D=p.u;p=p.C||1;for(var K=[.3,.3,.3],F=0;F<r.length;F++){var E=ea(r,F);if(E.type!==3)continue;var H=ca(E);E=[];for(var x of H){if(x.length===\n0)continue;H=x.map(G=>[G.x,G.y]);a(H)?(E.length>0&&g(E,D,K,u,p),E=[H]):E.push(H)}E.length>0&&g(E,D,K,u,p)}}else for(K=p.u,p=p.C||1,F=0;F<r.length;F++){x=ea(r,F);if(x.type!==2)continue;x=ca(x);for(D of x){if(D.length===0)continue;x=D.map(G=>[G.x,G.y]);u!=1?e(x,K,u,p):c(x,K,p)}}}function c(r,p,u){for(let D=0;D<r.length;D++)t.push(...r[D],d.length,1),D<r.length-1&&y.push(w+D,w+D+1);w+=r.length;d.push({fillColor:[1,1,1],P:p,opacity:u,v:1})}function g(r,p,u,D,K){var F=[],E=[],H=0;for(let x=0;x<r.length;x++){let G=\nr[x];if(G.length){x>0&&E.push(H);for(let M=0;M<G.length;M++){let O=G[M];F.push(O[0],O[1]);f.push(...O,d.length,1);H++;D>0&&m.push(n+M,n+(M+1==G.length?0:M+1))}n+=G.length}}r=na(F,E);r.length&&(r.forEach(x=>{l.push(k+x)}),d.push({fillColor:p,P:u,opacity:K,v:D}),k+=H)}function e(r,p,u,D){var K=r.length;if(!(K<2)){for(let F=0;F<K-1;F++){let E=r[F],H=r[F+1],x=q.length,G=d.length,M=H[0]-E[0],O=-H[1]+E[1];q.push({i:E,H:G,I:[O,-M]});q.push({i:E,H:G,I:[-O,M]});q.push({i:H,H:G,I:[-O,M]});q.push({i:H,H:G,I:[O,\n-M]});v.push(x,x+1,x+2,x+2,x+3,x);F>0&&v.push(x,x-1,x+1,x+1,x-2,x)}d.push({fillColor:[1,1,1],P:p,opacity:D,v:u})}}var d=[],f=[],k=0,l=[],m=[],n=0,q=[],v=[],t=[],y=[],w=0,B=await fetch("https://192.168.11.2/t/"+[15,28191,13180].join("/"));B=await new ka(await B.arrayBuffer());B=(new ja(B)).aa;for(var I=Ka.length;I--;){var L=Ka[I],N=B[L.o];N&&L.m!="p"&&L.m!="s"&&b(N,L)}return{J:d,W:f,S:l,N:m,V:q,R:v,X:t,T:y}},Ma=(a,b,c,g,e,d,f,k,l,m="fs_main")=>a.createRenderPipeline({layout:a.createPipelineLayout({bindGroupLayouts:[b,\nc]}),vertex:{module:e,entryPoint:d,buffers:[{arrayStride:f,stepMode:"vertex",attributes:k.map((n,q)=>({shaderLocation:q,offset:n[0],format:n[1]}))}]},fragment:{module:e,entryPoint:m,targets:[{format:g,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:l},depthStencil:{format:"depth24plus",depthWriteEnabled:!0,depthCompare:"greater"},multisample:{count:4}});\nself.onmessage=async a=>{if(a.data.c){let b=new Float32Array(a.data.b);Na(a.data.c,a.data.s,b)}};\nasync function Na(a,b,c){function g(){d.queue.writeBuffer(y,64,new Float32Array([c[0],c[1],c[2],Math.pow(2,c[2])*3E-5]))}function e(){requestAnimationFrame(e);if(c[3]){g();var r=d.createCommandEncoder(),p=r.beginRenderPass({colorAttachments:[{view:L.createView(),resolveTarget:k.getCurrentTexture().createView(),clearValue:{r:.96,g:.97,b:.98,a:1},loadOp:"clear",storeOp:"discard"}],depthStencilAttachment:{view:N.createView(),depthClearValue:0,depthLoadOp:"clear",depthStoreOp:"store"}});p.setBindGroup(0,\nB);for(let u of I)p.setBindGroup(1,u.Y),p.setVertexBuffer(0,u.ga),p.setPipeline(n),p.setIndexBuffer(u.ea,"uint32"),p.drawIndexed(u.fa,1,0,0,0),p.setPipeline(q),p.setIndexBuffer(u.Z,"uint32"),p.drawIndexed(u.$,1,0,0,0),p.setVertexBuffer(0,u.da),p.setPipeline(v),p.setIndexBuffer(u.ba,"uint32"),p.drawIndexed(u.ca,1,0,0,0),p.setVertexBuffer(0,u.ka),p.setPipeline(q),p.setIndexBuffer(u.ia,"uint32"),p.drawIndexed(u.ja,1,0,0,0);p.end();d.queue.submit([r.finish()]);c[3]=0}}var d=await (await navigator.gpu?.requestAdapter())?.requestDevice();\nif(d){d.pushErrorScope("validation");var f=await d.popErrorScope();f&&console.error("WebGPU \\u30d0\\u30ea\\u30c7\\u30fc\\u30b7\\u30e7\\u30f3\\u30a8\\u30e9\\u30fc:",f.message);d.lost.then(r=>{console.error(`WebGPU \\u30C7\\u30D0\\u30A4\\u30B9\\u304C\\u55AA\\u5931\\u3057\\u307E\\u3057\\u305F\\u3002\\u7406\\u7531: ${r.reason}`);console.error(`\\u30E1\\u30C3\\u30BB\\u30FC\\u30B8: ${r.message}`);r.reason==="destroyed"?console.log("\\u30c7\\u30d0\\u30a4\\u30b9\\u306f\\u610f\\u56f3\\u7684\\u306b\\u7834\\u68c4\\u3055\\u308c\\u307e\\u3057\\u305f\\u3002"):\nconsole.log("\\u30c7\\u30d0\\u30a4\\u30b9\\u3092\\u518d\\u521d\\u671f\\u5316\\u3057\\u307e\\u3059...")});var k=a.getContext("webgpu");a.width=b[0];a.height=b[1];var l=navigator.gpu.getPreferredCanvasFormat();k.configure({device:d,format:l,alphaMode:"premultiplied"});f=d.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});b=d.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]});\nvar m=d.createShaderModule({code:"struct PrimitiveVertex{@location(0)pos:vec2i,@location(1)feature_id:i32,}struct PolylineVertex{@location(0)pos:vec2i,@location(1)feature_id:i32,@location(2)pad:u32,@location(3)normal:vec2f,}struct Property{fillColor:vec3f,opacity:f32,lineColor:vec3f,thickness:f32,}struct Style{min_zoom:f32,min_val:f32,max_zoom:f32,max_val:f32,};struct Uniforms{u_mvp_matrix:mat4x4<f32>,u_offset:vec2<f32>,u_zoom:f32,u_scale:f32,u_res_x:f32,u_res_y:f32,u_tile_z:u32,u_tile_x:u32,u_tile_y:u32,u_tile_extent:f32,u_tile_opacity:f32,pad0:f32,pad1:f32,pad2:f32,pad3:f32,pad4:f32,styles:array<Style,8>,};@group(0)@binding(0)var<uniform> uniforms:Uniforms;@group(1)@binding(0)var<storage,read>properties:array<Property>;struct VertexOutput{@builtin(position)position:vec4f,@location(0)color:vec4f,@location(1)normal:vec2f,@location(2)pos:vec2f,}fn raw_to_ndc(pos:vec2i)->vec2f{let normalized_x=f32(pos.x)/4096.0;let normalized_y=1.0-(f32(pos.y)/4096.0);return vec2f(normalized_x,normalized_y)*2.0-1.0;}fn sheer(color:vec3f,o:f32)->vec4f{var opacity=o;if(opacity<0){let style=uniforms.styles[u32(-opacity-1)];let t=clamp((uniforms.u_zoom-style.min_zoom)/(style.max_zoom-style.min_zoom),0.0,1.0);opacity=mix(style.min_val,style.max_val,t);}return vec4f(color,opacity);}@vertex fn vs_polygon(input:PrimitiveVertex)->VertexOutput{var output:VertexOutput;let prop=properties[input.feature_id];let ndc_pos=raw_to_ndc(input.pos);let cam_pos=(ndc_pos-uniforms.u_offset)*uniforms.u_scale;var z=f32(input.feature_id+1)*1e-6;output.position=vec4f(cam_pos,z,1.0);output.color=sheer(prop.fillColor,prop.opacity);return output;}@vertex fn vs_thinline(input:PrimitiveVertex)->VertexOutput{var output:VertexOutput;let prop=properties[input.feature_id];let ndc_pos=raw_to_ndc(input.pos);let cam_pos=(ndc_pos-uniforms.u_offset)*uniforms.u_scale;var z=f32(input.feature_id+1)*1e-6+1e-7;output.position=vec4f(cam_pos,z,1.0);output.color=sheer(prop.lineColor,prop.opacity);return output;}@vertex fn vs_polyline(input:PolylineVertex,)->VertexOutput{var output:VertexOutput;let ndc_pos=raw_to_ndc(input.pos);let prop=properties[input.feature_id];let cam_pos=(ndc_pos-uniforms.u_offset)*uniforms.u_scale;var thickness=prop.thickness;if(thickness==-1){output.pos=cam_pos;}else{output.pos=vec2f(0,0);}if(thickness<0){let style=uniforms.styles[u32(-thickness-1)];let t=clamp((uniforms.u_zoom-style.min_zoom)/(style.max_zoom-style.min_zoom),0.0,1.0);thickness=mix(style.min_val,style.max_val,t);}let aspect=uniforms.u_res_x/uniforms.u_res_y;let normal=normalize(vec2f(input.normal.x*aspect,input.normal.y));let thickness_ndc=thickness/uniforms.u_res_x;let offset=vec2f(normal.x*thickness_ndc*0.5/aspect,normal.y*thickness_ndc*0.5);let final_pos=cam_pos+offset;var z=f32(input.feature_id+1)*1e-6;output.position=vec4f(final_pos,z,1.0);output.color=sheer(prop.lineColor,prop.opacity);output.normal=normal;return output;}@fragment fn fs_main(input:VertexOutput)->@location(0)vec4f{return input.color;}@fragment fn fs_polyline(input:VertexOutput)->@location(0)vec4f{if(length(input.pos)>0&&length(input.normal)<0.5&&((input.pos.y+1)*20)% 2>0.5){discard;}return input.color;}"}),\nn=Ma(d,f,b,l,m,"vs_polygon",16,[[0,"sint32x2"],[8,"sint32"]],"triangle-list"),q=Ma(d,f,b,l,m,"vs_thinline",16,[[0,"sint32x2"],[8,"sint32"]],"line-list"),v=Ma(d,f,b,l,m,"vs_polyline",32,[[0,"sint32x2"],[8,"sint32"],[12,"uint32"],[16,"float32x2"]],"triangle-list","fs_polyline");l=await m.getCompilationInfo();for(var t of l.messages)console.error(`WGSL error: ${t.message} at line ${t.lineNum}`);var y=d.createBuffer({size:256,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t=[];for(var w of Ka)Array.isArray(w.v)&&\n(t.push(...w.v.flat()),w.v=-(~~t.length/4)),Array.isArray(w.C)&&(t.push(...w.C.flat()),w.C=-(~~t.length/4));console.log("style",t,Ka);d.queue.writeBuffer(y,128,new Float32Array(t));var B=d.createBindGroup({layout:f,entries:[{binding:0,resource:{buffer:y}}]});w=await La();console.log("tileData",w);var I=[aa(d,b,w)];console.log("tiles",I);g();d.queue.writeBuffer(y,80,new Float32Array([a.width,a.height]));var L=d.createTexture({size:[a.width,a.height],sampleCount:4,format:navigator.gpu.getPreferredCanvasFormat(),\nusage:GPUTextureUsage.RENDER_ATTACHMENT}),N=d.createTexture({size:[a.width,a.height],sampleCount:4,format:"depth24plus",usage:GPUTextureUsage.RENDER_ATTACHMENT});e()}else self.postMessage({type:"error",message:"WebGPU \\u3092\\u30b5\\u30dd\\u30fc\\u30c8\\u3057\\u3066\\u3044\\u306a\\u3044\\u30d6\\u30e9\\u30a6\\u30b6\\u3001\\u307e\\u305f\\u306f\\u74b0\\u5883\\u3067\\u3059\\u3002"})};//# sourceMappingURL=/worker.map\n'], { type: "application/javascript" });
var workerUrl = URL.createObjectURL(blob);
var worker = new Worker(workerUrl);
worker.postMessage({ "c": offcanvas, "s": [800, 800], "b": sab }, [offcanvas]);
mouseevents_default(viewArray);
