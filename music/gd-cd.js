/* GD 音源「CD 盒」：只在大廳的音源彈窗顯示。透明塑膠 CD 盒，專輯直接印在光碟正面（霧面擴散反光），光碟背面是雷射彩虹反光。
 * - 打開音源時才載入（gd-audio.js 載入這支），3D 版再下載 Three.js（music/vendor/three-cd-0.170.0.min.js）；關掉音源就釋放（GPU 資源、畫布全部清掉）。
 * - 只在手指操作時重畫：拖曳轉動、放開回彈、開關盒蓋的動畫跑完就停，平常不佔 CPU／GPU。
 * - 低階手機（記憶體 < 4GB、CPU < 4 核、省流量、減少動態效果、不支援 WebGL、Three.js 載入失敗）自動改用 CSS 3D 版，操作一樣。
 * 操作：點盒子打開／關上（盒蓋沿左邊鉸鏈翻開攤平）；拖曳轉動盒子，轉到背面看光碟的雷射面；打開後點光碟播放／暫停。
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
    .gdcd-css{height:100%;display:grid;place-items:center;padding-bottom:24px;perspective:800px}
    .gdcd-case{--k:1.05;position:relative;width:calc(142px*var(--k));height:calc(125px*var(--k));transform-style:preserve-3d;transition:transform .5s cubic-bezier(.2,.8,.2,1)}
    .gdcd-case.drag{transition:none}
    .gdcd-tray,.gdcd-lid{position:absolute;inset:0;border-radius:5px;border:1.5px solid #ffffff8c;background:linear-gradient(135deg,#ffffff1f,#ffffff08 45%,#ffffff14);box-shadow:inset 0 0 14px #ffffff1a}
    .gdcd-tray i{position:absolute;inset:6%;border:1px solid #ffffff40;border-radius:8px}
    .gdcd-tray b{position:absolute;left:50%;top:50%;width:26%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;border:1px solid #ffffff4d}
    .gdcd-disc{position:absolute;left:9%;top:3.4%;width:82%;aspect-ratio:1;transform-style:preserve-3d;transform:translateZ(3px)}
    .gdcd-disc canvas{position:absolute;inset:0;width:100%;height:100%;border-radius:50%;backface-visibility:hidden;-webkit-backface-visibility:hidden}
    .gdcd-disc canvas.b{transform:rotateY(180deg)}
    .gdcd-lid{transform-origin:left center;transform:translateZ(9px);transition:transform .6s cubic-bezier(.2,.8,.2,1);background:linear-gradient(120deg,#ffffff33 0%,#ffffff05 30%,#ffffff05 60%,#ffffff26 78%,#ffffff05 92%)}
    .gdcd-case.open .gdcd-lid{transform:translateZ(9px) rotateY(-176deg)}
    @media (prefers-reduced-motion:reduce){.gdcd-case,.gdcd-lid{transition:none}}`;
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

  const N = 512, R = N / 2;
  const circle = (g, r) => { g.beginPath(); g.arc(R, R, r, 0, Math.PI * 2); g.closePath(); };
  /** 中心：透明塑膠圈＋銀色內圈＋中心孔 */
  function hub(g) {
    g.save();
    g.globalCompositeOperation = 'destination-out';
    circle(g, R * 0.24); g.globalAlpha = 0.82; g.fill();
    g.restore();
    g.lineWidth = 2; g.strokeStyle = '#ffffffb0';
    circle(g, R * 0.24); g.stroke();
    circle(g, R * 0.15); g.fillStyle = '#c9ced9cc'; g.fill(); g.strokeStyle = '#ffffff'; g.stroke();
    g.save(); g.globalCompositeOperation = 'destination-out'; circle(g, R * 0.075); g.fill(); g.restore();
  }
  /** 光碟正面：專輯整面印在光碟上（霧面） */
  function frontCanvas(cover) {
    const c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d');
    g.save(); circle(g, R - 2); g.clip();
    if (cover) {
      const s = Math.max(N / cover.width, N / cover.height);
      g.drawImage(cover, R - (cover.width * s) / 2, R - (cover.height * s) / 2, cover.width * s, cover.height * s);
    } else {
      const bg = g.createLinearGradient(0, 0, N, N); bg.addColorStop(0, '#3a0a48'); bg.addColorStop(1, '#16051f');
      g.fillStyle = bg; g.fillRect(0, 0, N, N);
    }
    g.restore();
    g.lineWidth = 3; g.strokeStyle = '#ffffff66'; circle(g, R - 3); g.stroke();
    hub(g);
    return c;
  }
  /** 光碟背面：銀色雷射面，彩虹反光（3D 版轉動時跟著角度移動） */
  function backCanvas() {
    const c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d');
    circle(g, R - 2);
    const silver = g.createRadialGradient(R, R, R * 0.2, R, R, R);
    silver.addColorStop(0, '#eef1f8'); silver.addColorStop(1, '#9aa1b3');
    g.fillStyle = silver; g.fill();
    if (g.createConicGradient) {
      const rainbow = g.createConicGradient(0, R, R);
      const cols = ['#ff4fd8', '#ffd84f', '#4fffb0', '#4fd8ff', '#9a6bff', '#ff4fd8'];
      for (let k = 0; k < 2; k++) cols.forEach((col, i) => rainbow.addColorStop((k + i / (cols.length - 1)) / 2, col));
      g.globalAlpha = 0.55; g.fillStyle = rainbow; circle(g, R - 2); g.fill(); g.globalAlpha = 1;
    }
    // 細細的同心圓軌道紋
    g.lineWidth = 1;
    for (let r = R * 0.3; r < R - 6; r += 3) { g.strokeStyle = `rgba(255,255,255,${0.05 + 0.05 * Math.sin(r)})`; circle(g, r); g.stroke(); }
    hub(g);
    return c;
  }

  const hintText = (s, open) => (!open ? '點盒子打開・拖曳轉動看背面' : s.playing ? '♪ 播放中・點光碟暫停' : '點光碟播放');

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
  /** 拖曳轉動（左右可轉到背面）、放開回彈；沒有移動就算點擊 */
  function pointer(el, view) {
    let start = null, dragging = false;
    const down = (e) => { start = { x: e.clientX, y: e.clientY }; dragging = false; el.setPointerCapture(e.pointerId); view.grab(); };
    const move = (e) => {
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!dragging && Math.hypot(dx, dy) > 6) dragging = true;
      if (dragging) view.drag(Math.max(-Math.PI, Math.min(Math.PI, dx * 0.014)), Math.max(-0.6, Math.min(0.6, dy * 0.006)));
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
    el.innerHTML = '<div class="gdcd-css"><div class="gdcd-case"><div class="gdcd-tray"><i></i><b></b></div><div class="gdcd-disc"><canvas class="f"></canvas><canvas class="b"></canvas></div><div class="gdcd-lid"></div></div></div><div class="gdcd-hint"></div>';
    const box = el.querySelector('.gdcd-case'), discEl = el.querySelector('.gdcd-disc'), hint = el.querySelector('.gdcd-hint');
    const paint = (canvas, src) => { canvas.width = src.width; canvas.height = src.height; canvas.getContext('2d').drawImage(src, 0, 0); };
    paint(el.querySelector('canvas.b'), backCanvas());
    let open = false, yaw = 0, pitch = 0, cur = {};
    // 打開後盒蓋攤在左邊，整組往右移半個盒子置中
    const pose = () => { box.style.transform = `translateX(${open ? 50 : 0}%) rotateX(${-pitch}rad) rotateY(${yaw}rad)`; };
    async function update(s) {
      const coverChanged = s.cover !== cur.cover;
      cur = { ...s };
      hint.textContent = hintText(s, open); hint.classList.toggle('on', !!(open && s.playing));
      if (!coverChanged) return;
      const img = await loadImage(s.cover);
      if (cur.cover !== s.cover) return;
      paint(el.querySelector('canvas.f'), frontCanvas(img));
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
    const camera = new T.PerspectiveCamera(28, 1, 1, 4000);
    scene.add(new T.HemisphereLight(0xffffff, 0x2a3060, 1.5));
    const key = new T.DirectionalLight(0xffffff, 2.6); key.position.set(-160, 220, 320); scene.add(key);
    const rim = new T.DirectionalLight(0xbfd4ff, 1.4); rim.position.set(240, -140, 160); scene.add(rim);
    const back = new T.DirectionalLight(0xffffff, 1.6); back.position.set(0, 120, -320); scene.add(back);

    const root = new T.Group(); scene.add(root);
    // 透明塑膠：很淡的面＋亮的邊線＋高光
    const plastic = new T.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.09, shininess: 220, specular: 0xffffff, side: T.DoubleSide, depthWrite: false });
    const edge = new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
    const faint = new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28 });
    const clearBox = (w, h, d) => {
      const g = new T.Group();
      const geo = new T.BoxGeometry(w, h, d);
      g.add(new T.Mesh(geo, plastic));
      g.add(new T.LineSegments(new T.EdgesGeometry(geo), edge));
      return g;
    };
    const loop = (pts, z, mat) => {
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(pts.flatMap(([x, y]) => [x, y, z]), 3));
      return new T.LineLoop(geo, mat);
    };
    const roundRect = (w, h, r, n = 6) => {
      const pts = [];
      [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, 1], [-w / 2 + r, -h / 2 + r, 2], [w / 2 - r, -h / 2 + r, 3]].forEach(([cx, cy, q]) => {
        for (let i = 0; i <= n; i++) { const a = ((q + i / n) * Math.PI) / 2; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
      });
      return pts;
    };
    const ring = (r, n = 64) => Array.from({ length: n }, (_, i) => [r * Math.cos((i / n) * Math.PI * 2), r * Math.sin((i / n) * Math.PI * 2)]);

    // 底盒（托盤）＋托盤上的框線、中心卡榫圈
    const tray = clearBox(W, H, 3); tray.position.z = -D / 2 + 1.5; root.add(tray);
    const zf = -D / 2 + 3.1;
    root.add(loop(roundRect(W - 14, H - 12, 9), zf, faint));
    root.add(loop(roundRect(W - 24, H - 20, 14), zf, faint));
    root.add(loop(ring(9), zf, edge));
    root.add(loop(ring(17), zf, faint));
    const spine = clearBox(5, H, D); spine.position.set(-W / 2 + 2.5, 0, 0); root.add(spine);

    // 光碟：正面印專輯（霧面）、背面雷射面；側邊銀色
    const frontTex = new T.CanvasTexture(frontCanvas(null)); frontTex.colorSpace = T.SRGBColorSpace;
    // 圓柱上蓋的貼圖座標轉了 90 度，轉回來讓專輯正著
    frontTex.center.set(0.5, 0.5); frontTex.rotation = Math.PI / 2;
    const backTex = new T.CanvasTexture(backCanvas()); backTex.colorSpace = T.SRGBColorSpace; backTex.center.set(0.5, 0.5);
    const frontMat = new T.MeshStandardMaterial({ map: frontTex, transparent: true, roughness: 0.55, metalness: 0.08 });
    const backMat = new T.MeshPhongMaterial({ map: backTex, transparent: true, shininess: 260, specular: 0xffffff });
    const sideMat = new T.MeshPhongMaterial({ color: 0xc9ced9, shininess: 120, specular: 0xffffff });
    const disc = new T.Mesh(new T.CylinderGeometry(58, 58, 1.2, 96), [sideMat, frontMat, backMat]);
    disc.rotation.x = Math.PI / 2; disc.position.set(3, 0, -D / 2 + 3.9); root.add(disc);

    // 盒蓋：以左邊鉸鏈為軸，打開時翻到左邊攤平
    const lid = new T.Group(); lid.position.set(-W / 2, 0, D / 2 - 0.8); root.add(lid);
    const lidBox = clearBox(W, H, 1.6); lidBox.position.x = W / 2; lid.add(lidBox);
    const lidFrame = loop(roundRect(W - 10, H - 10, 6), -0.9, faint); lidFrame.position.x = W / 2; lid.add(lidFrame);

    // ---- 狀態與只在需要時重畫 ----
    let open = false, openK = 0, yaw = 0, pitch = 0, tYaw = 0, tPitch = 0, holding = false, raf = 0, cur = {}, zClosed = 400, zOpen = 600;
    const draw = () => {
      lid.rotation.y = -Math.PI * 0.985 * openK;
      root.position.x = (W / 2) * openK;
      root.rotation.y = yaw;
      root.rotation.x = 0.18 * openK + pitch;
      // 雷射反光跟著角度移動
      backTex.rotation = yaw * 1.6 + pitch * 2;
      camera.position.z = zClosed + (zOpen - zClosed) * openK;
      renderer.render(scene, camera);
    };
    const step = () => {
      raf = 0;
      const target = open ? 1 : 0;
      openK += (target - openK) * 0.14;
      if (!holding) { tYaw = 0; tPitch = 0; }
      yaw += (tYaw - yaw) * (holding ? 0.45 : 0.12);
      pitch += (tPitch - pitch) * (holding ? 0.45 : 0.12);
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
      camera.updateProjectionMatrix();
      // 關著：一個盒子放得下；打開：兩個盒子寬放得下
      const t = Math.tan((camera.fov * Math.PI) / 360);
      zClosed = Math.max((W * 0.75) / (t * camera.aspect), (H * 0.72) / t);
      zOpen = Math.max((W * 1.2) / (t * camera.aspect), (H * 0.72) / t);
      draw();
    };
    const ro = new ResizeObserver(size); ro.observe(el);

    async function update(s) {
      const coverChanged = s.cover !== cur.cover;
      cur = { ...s };
      hint.textContent = hintText(s, open); hint.classList.toggle('on', !!(open && s.playing));
      if (!coverChanged) return;
      const img = await loadImage(s.cover);
      if (cur.cover !== s.cover || !raycaster) return;
      frontTex.image = frontCanvas(img);
      frontTex.needsUpdate = true;
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
        scene.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : o.material ? [o.material] : []).forEach((m) => m.dispose());
        });
        frontTex.dispose(); backTex.dispose();
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
