/* 大廳背景音樂帶進遊戲：大廳「設定 → 聲音」開著、勾選「進入遊戲後繼續播放」且正在播時，
   遊戲頁從同一首、同一個位置接著播（音量較小，不蓋過遊戲音效）。
   大廳與遊戲都在 acc2023156.github.io，共用 localStorage 的 gd-music 設定。 */
(function () {
  'use strict';
  const KEY = 'gd-music';
  const LOBBY = 'https://acc2023156.github.io/GD_Lobby/';
  let prefs;
  try { prefs = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return; }
  if (prefs.on === false || prefs.carry === false || !prefs.playing) return;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ } };

  fetch(LOBBY + 'music/playlist.json', { cache: 'no-store' })
    .then((r) => r.json())
    .then((data) => {
      const tracks = (data.tracks || []).filter((t) => t && t.src);
      if (!tracks.length) return;
      const VOLUME = 0.35;
      const player = new Audio();
      player.volume = 0;
      player.preload = 'auto';
      // 淡入淡出：進遊戲時從 0 慢慢變大聲，回大廳前先淡出，換頁不會突然切斷
      let fadeRun = 0;
      const fadeTo = (volume, ms) => new Promise((done) => {
        const run = ++fadeRun, from = player.volume, t0 = performance.now();
        const step = (now) => {
          if (run !== fadeRun) return done();
          const k = Math.min(1, (now - t0) / ms);
          player.volume = from + (volume - from) * k;
          if (k < 1) setTimeout(() => step(performance.now()), 30); else done();
        };
        step(performance.now());
      });
      document.addEventListener('click', (e) => {
        const link = e.target.closest && e.target.closest('a[href]');
        if (!link || player.paused || !/\/GD_Lobby\//.test(link.href)) return;
        e.preventDefault();
        fadeTo(0, 450).then(() => { location.href = link.href; });
      }, true);
      let current = Math.min(Number(prefs.track) || 0, tracks.length - 1);
      const next = () => {
        if (prefs.shuffle && tracks.length > 1) return (current + 1 + Math.floor(Math.random() * (tracks.length - 1))) % tracks.length;
        return (current + 1) % tracks.length;
      };
      const load = (index, from) => {
        current = index;
        prefs.track = current;
        prefs.pos = from || 0;
        save();
        player.src = tracks[current].src;
        if (from) player.addEventListener('loadedmetadata', () => { player.currentTime = Math.min(from, Math.max(0, player.duration - 1)); }, { once: true });
      };
      player.addEventListener('ended', () => { load(next(), 0); player.play().catch(() => {}); });
      player.addEventListener('timeupdate', () => {
        if (Math.abs((prefs.pos || 0) - player.currentTime) > 3) { prefs.pos = Math.floor(player.currentTime); save(); }
      });
      window.addEventListener('pagehide', () => { prefs.pos = Math.floor(player.currentTime || 0); save(); });
      load(current, Number(prefs.pos) || 0);
      // 瀏覽器規定要先點過畫面才能出聲：能直接播就播，不行就等第一次點擊
      const start = () => {
        player.play().then(() => { document.removeEventListener('pointerdown', start, true); fadeTo(VOLUME, 900); }).catch(() => {});
      };
      document.addEventListener('pointerdown', start, true);
      start();
    })
    .catch(() => { /* 沒有歌單時不播 */ });
})();
