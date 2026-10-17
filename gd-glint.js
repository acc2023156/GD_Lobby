/* 大廳流光：頂部彩色線條、目前分類裡隨機一款遊戲，輪流閃過一道光。
 * 每次間隔 10 秒內隨機，一次只閃一個（上一道光跑完才排下一道），系統開「減少動態」就不閃。 */
(() => {
  'use strict';
  if (window.GDGlint) return;
  const css = `
.topbar::after{content:"";position:absolute;left:0;right:0;bottom:-2px;height:2px;pointer-events:none;opacity:0;background:linear-gradient(90deg,#0000,#fff 45%,#ffe6ff 50%,#fff 55%,#0000) no-repeat;background-size:28% 100%;filter:drop-shadow(0 0 4px #fff) drop-shadow(0 0 8px #ff9be3)}
.topbar.gd-glint::after{animation:gd-glint-line 1.4s ease-in-out}
@keyframes gd-glint-line{0%{opacity:1;background-position:-40% 0}100%{opacity:1;background-position:140% 0}}
.game.gd-glint::after{content:"";position:absolute;inset:0;z-index:2;pointer-events:none;background:linear-gradient(115deg,#0000 32%,#ffffff55 44%,#fffd 50%,#ffffff55 56%,#0000 68%);animation:gd-glint-tile 1.1s ease-in-out both}
@keyframes gd-glint-tile{from{transform:translateX(-130%)}to{transform:translateX(130%)}}`;
  const style = document.createElement('style'); style.textContent = css; document.head.append(style);
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const inView = (el) => { const r = el.getBoundingClientRect(); return r.width && r.bottom > 0 && r.top < innerHeight; };
  /** 下一個要閃的：線條或畫面上看得到的一款遊戲（即將上市、維護中的不閃）。 */
  function pick() {
    const line = document.querySelector('.topbar');
    const games = [...document.querySelectorAll('.games .game:not(.coming-soon):not(.maintenance)')].filter(inView);
    const all = [line, ...games].filter(Boolean);
    return all[Math.floor(Math.random() * all.length)];
  }
  function next() { setTimeout(glint, 1500 + Math.random() * 8500); }
  function glint() {
    const el = document.visibilityState === 'visible' && !calm() ? pick() : null;
    if (!el) return next();
    el.classList.add('gd-glint');
    let over = false;
    const done = () => { if (over) return; over = true; el.classList.remove('gd-glint'); next(); };
    el.addEventListener('animationend', done, { once: true });
    setTimeout(done, 2000); // 遊戲格被重畫掉時也會接著排下一道
  }
  next();
  window.GDGlint = { glint };
})();
