/* GD 音源「CD 盒」：只在大廳的音源彈窗顯示，專輯封面做成可以打開的 CD 盒，給玩家玩。
 * - 打開音源時才載入（gd-audio.js 載入這支），3D 版再下載 Three.js（music/vendor/three-cd-0.170.0.min.js）；關掉音源就釋放（GPU 資源、畫布全部清掉）。
 * - 只在手指操作時重畫：拖曳轉動、放開回彈、開關盒蓋的動畫跑完就停，平常不佔 CPU／GPU。
 * - 低階手機（記憶體 < 4GB、CPU < 4 核、省流量、減少動態效果、不支援 WebGL、Three.js 載入失敗）自動改用 CSS 3D 版，操作一樣。
 * 操作：拖曳轉動盒子；點盒子打開／關上；打開後點光碟播放／暫停。
 * 用法（gd-audio.js）：GDCD.mount(容器, { cover, title, playing }, { toggle })、GDCD.update(state)、GDCD.unmount()
 */
(() => {
  'use strict';
  if (window.GDCD) return;
  const SCRIPT = document.currentScript && document.currentScript.src;
  const THREE_URL = new URL('vendor/three-cd-0.170.0.min.js', SCRIPT || location.href).href;

  // ---------- 共用 ----------
  const css = `
    .gdcd{position:relative;height:100%;touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab}
    .gdcd>canvas{display:block;width:100%;height:100%}
    .gdcd-hint{position:absolute;left:50%;bottom:6px;transform:translateX(-50%);padding:3px 12px;border-radius:99px;background:#0009;color:#ffe9b0;font-size:12px;font-weight:800;white-space:nowrap;pointer-events:none}
    .gdcd-hint.on{color:#5ff2ff}
    .gdcd-css{height:100%;display:grid;place-items:center;padding-bottom:24px;perspective:700px}
    .gdcd-case{--k:1.15;position:relative;width:calc(142px*var(--k));height:calc(125px*var(--k));transform-style:preserve-3d;transition:transform .45s cubic-bezier(.2,.8,.2,1)}
    .gdcd-case.drag{transition:none}
    .gdcd-tray{position:absolute;inset:0;border-radius:4px;background:linear-gradient(135deg,#1a1d2e,#07080f);box-shadow:0 10px 30px #000a}
    .gdcd-disc{position:absolute;left:8%;top:3.6%;width:84%;height:auto;aspect-ratio:1;border-radius:50%;transform:translateZ(2px);transition:transform .5s cubic-bezier(.2,.8,.2,1)}
    .gdcd-lid{position:absolute;inset:0;transform-origin:left center;transform:translateZ(8px);transition:transform .55s cubic-bezier(.2,.8,.2,1);transform-style:preserve-3d}
    .gdcd-lid img,.gdcd-lid i{position:absolute;inset:3% 3% 3% 7%;width:90%;height:94%;object-fit:cover;border-radius:2px}
    .gdcd-lid:after{content:'';position:absolute;inset:0;border-radius:4px;border:1px solid #fff5;background:linear-gradient(120deg,#fff3 0%,#fff0 35%,#fff0 60%,#fff2 75%,#fff0 90%)}
    .gdcd-case.open .gdcd-lid{transform:translateZ(8px) rotateY(-112deg)}
    .gdcd-case.open .gdcd-disc{transform:translateZ(14px) translateX(12%)}
    @media (prefers-reduced-motion:reduce){.gdcd-case,.gdcd-lid,.gdcd-disc{transition:none}}`;
  let styleEl = null;
  const addStyle = () => { if (!styleEl) { styleEl = document.createElement('style'); styleEl.textContent = css; document.head.appendChild(styleEl); } };

  const loadImage = (src) => new Promise((ok) => {
    if (!src) return ok(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = src;
  });

  /** 光碟正面：銀色＋彩虹反光，中間圓形貼封面，中心挖洞 */
  function discCanvas(cover) {
    const n = 512, c = document.createElement('canvas');
    c.width = c.height = n;
    const g = c.getContext('2d'), r = n / 2;
    g.beginPath(); g.arc(r, r, r - 2, 0, Math.PI * 2); g.closePath();
    const silver = g.createRadialGradient(r, r, r * 0.2, r, r, r);
    silver.addColorStop(0, '#f4f6fb'); silver.addColorStop(1, '#a9afbf');
    g.fillStyle = silver; g.fill();
    if (g.createConicGradient) {
      const rainbow = g.createConicGradient(0.6, r, r);
      ['#ff5fd2', '#ffd36b', '#5ff2ff', '#8f7bff', '#ff5fd2', '#ffd36b', '#5ff2ff', '#8f7bff', '#ff5fd2'].forEach((col, i, a) => rainbow.addColorStop(i / (a.length - 1), col));
      g.globalAlpha = 0.28; g.fillStyle = rainbow; g.fill(); g.globalAlpha = 1;
    }
    // 封面標籤
    g.save(); g.beginPath(); g.arc(r, r, r * 0.6, 0, Math.PI * 2); g.clip();
    if (cover) {
      const s = Math.max((r * 1.2) / cover.width, (r * 1.2) / cover.height);
      g.drawImage(cover, r - (cover.width * s) / 2, r - (cover.height * s) / 2, cover.width * s, cover.height * s);
    } else { g.fillStyle = '#3a0a48'; g.fill(); }
    g.restore();
    g.lineWidth = 3; g.strokeStyle = '#fff8';
    g.beginPath(); g.arc(r, r, r * 0.6, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(r, r, r * 0.2, 0, Math.PI * 2); g.fillStyle = '#d9dde8'; g.fill();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.arc(r, r, r * 0.07, 0, Math.PI * 2); g.fill();
    return c;
  }

  const hintText = (s, open) => (!open ? '點 CD 盒打開・拖曳轉動' : s.playing ? '♪ 播放中・點光碟暫停' : '點光碟播放');

  function webglOK() {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return false;
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      return true;
    } catch (e) { return false; }
  }
  /** 低階手機或不適合跑 3D 的情況：改用 CSS 版 */
  function useCss() {
    const n = navigator;
    return matchMedia('(prefers-reduced-motion: reduce)').matches
      || (n.deviceMemory && n.deviceMemory < 4)
      || (n.hardwareConcurrency && n.hardwareConcurrency < 4)
      || (n.connection && n.connection.saveData)
      || !webglOK();
  }

  // ---------- 拖曳／點擊（兩個版本共用） ----------
  /** 拖曳轉動、放開回彈；沒有移動就算點擊。onMove 每次要重畫時呼叫，回傳 false 代表已靜止 */
  function pointer(el, view) {
    let start = null, dragging = false;
    const down = (e) => { start = { x: e.clientX, y: e.clientY }; dragging = false; el.setPointerCapture(e.pointerId); view.grab(); };
    const move = (e) => {
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!dragging && Math.hypot(dx, dy) > 6) dragging = true;
      if (dragging) view.drag(Math.max(-0.9, Math.min(0.9, dx * 0.008)), Math.max(-0.5, Math.min(0.5, dy * 0.006)));
    };
    const up = (e) => {
      if (!start) return;
      const tap = !dragging;
      start = null;
      view.release();
      if (tap) view.tap(e.clientX, e.clientY);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
  }

  // ---------- CSS 3D 版（低階手機） ----------
  function cssView(el, state, actions) {
    el.innerHTML = '<div class="gdcd-css"><div class="gdcd-case"><div class="gdcd-tray"></div><canvas class="gdcd-disc"></canvas><div class="gdcd-lid"><i></i></div></div></div><div class="gdcd-hint"></div>';
    const box = el.querySelector('.gdcd-case'), discEl = el.querySelector('.gdcd-disc'), lid = el.querySelector('.gdcd-lid'), hint = el.querySelector('.gdcd-hint');
    let open = false, yaw = 0, pitch = 0, cur = {};
    const pose = () => { box.style.transform = `rotateX(${-pitch}rad) rotateY(${yaw + (open ? 0.35 : 0)}rad)`; };
    async function update(s) {
      const coverChanged = s.cover !== cur.cover;
      cur = { ...s };
      hint.textContent = hintText(s, open); hint.classList.toggle('on', !!(open && s.playing));
      if (!coverChanged) return;
      const img = await loadImage(s.cover);
      if (cur.cover !== s.cover) return;
      const c = discCanvas(img);
      discEl.width = c.width; discEl.height = c.height; discEl.getContext('2d').drawImage(c, 0, 0);
      lid.firstChild.outerHTML = s.cover ? `<img src="${s.cover.replace(/"/g, '&quot;')}" alt="">` : '<i></i>';
    }
    const off = pointer(el, {
      grab: () => box.classList.add('drag'),
      drag: (y, p) => { yaw = y; pitch = p; pose(); },
      release: () => { box.classList.remove('drag'); yaw = 0; pitch = 0; pose(); },
      tap: (x, y) => {
        if (open) {
          const r = discEl.getBoundingClientRect();
          if (Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2)) < r.width / 2) { actions.toggle(); return; }
        }
        open = !open; box.classList.toggle('open', open); pose(); update(cur);
      },
    });
    update(state);
    return { update, destroy: () => { off(); el.innerHTML = ''; } };
  }

  // ---------- Three.js 版 ----------
  async function threeView(el, state, actions, alive) {
    const T = await import(THREE_URL);
    if (!alive()) return null;
    const W = 142, H = 125, D = 10;
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = T.SRGBColorSpace;
    el.innerHTML = '<div class="gdcd-hint"></div>';
    el.prepend(renderer.domElement);
    const hint = el.querySelector('.gdcd-hint');
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(28, 1, 1, 2000);
    camera.position.set(0, 0, 400);
    scene.add(new T.HemisphereLight(0xffffff, 0x223355, 1.6));
    const key = new T.DirectionalLight(0xffffff, 2.4); key.position.set(-160, 220, 300); scene.add(key);
    const rim = new T.DirectionalLight(0xff9de0, 1.2); rim.position.set(220, -120, 160); scene.add(rim);

    const root = new T.Group(); scene.add(root);
    const plastic = new T.MeshPhongMaterial({ color: 0x0d0f1a, shininess: 70, specular: 0x444455 });
    const tray = new T.Mesh(new T.BoxGeometry(W, H, 4), plastic); tray.position.z = -D / 2 + 2; root.add(tray);
    const spine = new T.Mesh(new T.BoxGeometry(6, H, D), plastic); spine.position.set(-W / 2 + 3, 0, 0); root.add(spine);
    const discMat = new T.MeshPhongMaterial({ transparent: true, shininess: 140, specular: 0xffffff });
    const disc = new T.Mesh(new T.CircleGeometry(58, 72), discMat); disc.position.set(4, 0, -D / 2 + 4.4); root.add(disc);
    // 盒蓋：以左邊鉸鏈為軸，裡面夾封面
    const lid = new T.Group(); lid.position.set(-W / 2, 0, D / 2); root.add(lid);
    const coverMat = new T.MeshLambertMaterial({ color: 0x3a0a48, side: T.DoubleSide });
    const cover = new T.Mesh(new T.PlaneGeometry(W - 12, H - 6), coverMat); cover.position.set(W / 2 + 4, 0, -1.3); lid.add(cover);
    const clear = new T.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, shininess: 160, specular: 0xffffff, depthWrite: false });
    const glass = new T.Mesh(new T.BoxGeometry(W, H, 2), clear); glass.position.set(W / 2, 0, 0); lid.add(glass);

    // ---- 狀態與只在需要時重畫 ----
    let open = false, openK = 0, yaw = 0, pitch = 0, tYaw = 0, tPitch = 0, holding = false, raf = 0, cur = {};
    const draw = () => {
      lid.rotation.y = -1.95 * openK;
      disc.position.z = -D / 2 + 4.4 + 10 * openK;
      disc.position.x = 4 + 22 * openK;
      root.rotation.y = yaw + 0.45 * openK;
      root.rotation.x = pitch;
      renderer.render(scene, camera);
    };
    const step = () => {
      raf = 0;
      const target = open ? 1 : 0;
      openK += (target - openK) * 0.16;
      if (!holding) { tYaw = 0; tPitch = 0; }
      yaw += (tYaw - yaw) * (holding ? 0.5 : 0.14);
      pitch += (tPitch - pitch) * (holding ? 0.5 : 0.14);
      const settled = Math.abs(target - openK) < 0.002 && Math.abs(tYaw - yaw) < 0.002 && Math.abs(tPitch - pitch) < 0.002;
      if (settled) { openK = target; yaw = tYaw; pitch = tPitch; }
      draw();
      if (!settled) raf = requestAnimationFrame(step); // 動畫跑完就停，不再重畫
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(step); };

    const size = () => {
      const w = el.clientWidth || 300, h = el.clientHeight || 200;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // 盒子打開後約佔 1.7 倍寬：寬、高都放得下的距離
      const t = Math.tan((camera.fov * Math.PI) / 360);
      camera.position.z = Math.max((W * 0.85) / (t * camera.aspect), (H * 0.7) / t);
      camera.updateProjectionMatrix();
      draw();
    };
    const ro = new ResizeObserver(size); ro.observe(el);

    let discTex = null, coverTex = null;
    async function update(s) {
      const coverChanged = s.cover !== cur.cover;
      cur = { ...s };
      hint.textContent = hintText(s, open); hint.classList.toggle('on', !!(open && s.playing));
      if (!coverChanged) return;
      const img = await loadImage(s.cover);
      if (cur.cover !== s.cover || !raycaster) return;
      if (discTex) discTex.dispose();
      if (coverTex) coverTex.dispose();
      discTex = new T.CanvasTexture(discCanvas(img)); discTex.colorSpace = T.SRGBColorSpace;
      discMat.map = discTex; discMat.needsUpdate = true;
      if (img) {
        coverTex = new T.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = c.height = 512; c.getContext('2d').drawImage(img, 0, 0, 512, 512); return c; })());
        coverTex.colorSpace = T.SRGBColorSpace;
        coverMat.map = coverTex; coverMat.color.set(0xffffff);
      } else { coverMat.map = null; coverMat.color.set(0x3a0a48); coverTex = null; }
      coverMat.needsUpdate = true;
      draw();
    }

    let raycaster = new T.Raycaster();
    const off = pointer(el, {
      grab: () => { holding = true; },
      drag: (y, p) => { tYaw = y; tPitch = p; kick(); },
      release: () => { holding = false; kick(); },
      tap: (x, y) => {
        if (open) {
          const r = renderer.domElement.getBoundingClientRect();
          raycaster.setFromCamera(new T.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), camera);
          if (raycaster.intersectObject(disc).length) { actions.toggle(); return; }
        }
        open = !open; update(cur); kick();
      },
    });
    size();
    update(state);

    return {
      update,
      destroy() {
        off(); ro.disconnect(); if (raf) cancelAnimationFrame(raf);
        raycaster = null;
        scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
        if (discTex) discTex.dispose();
        if (coverTex) coverTex.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        el.innerHTML = '';
      },
    };
  }

  // ---------- 對外 ----------
  let view = null, run = 0, latest = null;
  async function mount(el, state, actions) {
    unmount();
    addStyle();
    const id = ++run;
    latest = state;
    el.classList.add('gdcd');
    const alive = () => id === run;
    let v = null;
    if (!useCss()) {
      try { v = await threeView(el, state, actions, alive); } catch (e) { v = null; }
      if (!alive()) { if (v) v.destroy(); return; }
    }
    if (!v) v = cssView(el, latest, actions);
    view = v;
    if (latest !== state) view.update(latest);
  }
  function update(state) { latest = state; if (view) view.update(state); }
  function unmount() { run++; if (view) { view.destroy(); view = null; } }
  window.GDCD = { mount, update, unmount };
})();
