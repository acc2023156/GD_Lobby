/* GD 共用「音源」：大廳與所有遊戲（GD 獨家六款、之後的 SLOT 等）共用同一個彈窗與設定。
   - 音樂：專輯／歌單播放（上一首、下一首、暫停、隨機、點歌），音量 靜音／25%／50%／75%／100%
   - 音效：遊戲內音效音量 靜音／25%／50%／75%／100%（遊戲的 sound.js 讀 GDAudio.sfx）
   - 設定存在 localStorage 的 gd-music（大廳與遊戲都在 acc2023156.github.io，同一份設定）
   使用方式：頁面載入這支檔案；右上喇叭按鈕加 data-gd-audio（舊遊戲的 #soundBtn、#sound 也會自動接上）。
   歌單與曲名：music/playlist.json（albums → tracks 的 title 就是前端顯示的曲名）。 */
(function () {
  'use strict';
  if (window.GDAudio) return;

  const SCRIPT = document.currentScript && document.currentScript.src;
  const LOBBY = new URL('../', SCRIPT || 'https://acc2023156.github.io/GD_Lobby/music/gd-audio.js').href;
  const IN_LOBBY = location.href.startsWith(LOBBY) && !/\/(Plinko|MINES|Crash|Dice|PaiGowTiles|HomeRun)\//.test(location.pathname);
  const KEY = 'gd-music';
  const LEVELS = [0, 25, 50, 75, 100];

  // ---------- 設定 ----------
  const prefs = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })();
  // 舊版「聲音」開關關閉 → 音樂靜音
  if (prefs.music === undefined) prefs.music = prefs.on === false ? 0 : 50;
  if (prefs.sfx === undefined) prefs.sfx = 100;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* storage unavailable */ } };
  save();
  const changed = () => { renderButtons(); render(); window.dispatchEvent(new CustomEvent('gd-audio-change', { detail: api.state() })); };

  // ---------- 歌單 ----------
  let albums = [];
  let album = null;
  let tracks = [];
  let current = 0;
  const findAlbum = (id) => albums.find((a) => a.id === id) || albums[0] || null;
  function useAlbum(id) {
    album = findAlbum(id);
    tracks = album ? album.tracks : [];
    if (album) prefs.album = album.id;
  }

  // ---------- 播放器 ----------
  const player = new Audio();
  player.preload = 'none';
  const preloader = new Audio();
  preloader.preload = 'auto';
  preloader.muted = true;
  const targetVolume = () => prefs.music / 100;
  let fadeRun = 0;
  // 淡入淡出：換歌、進出遊戲時聲音不會突然開始或切斷（iPhone 不能用程式調音量，會直接播放）
  function fadeTo(volume, ms) {
    const run = ++fadeRun, from = player.volume, t0 = Date.now();
    return new Promise((done) => {
      const step = () => {
        if (run !== fadeRun) return done();
        const k = Math.min(1, (Date.now() - t0) / ms);
        try { player.volume = from + (volume - from) * k; } catch (e) { /* ignore */ }
        if (k < 1) setTimeout(step, 30); else done();
      };
      step();
    });
  }
  const startPlaying = () => {
    if (!prefs.music) return Promise.resolve();
    try { player.volume = 0; } catch (e) { /* ignore */ }
    return player.play().then(() => fadeTo(targetVolume(), 900)).catch(() => {}).finally(changed);
  };
  let upcoming = 0, preloaded = false;
  const randomOther = () => (tracks.length < 2 ? current : (current + 1 + Math.floor(Math.random() * (tracks.length - 1))) % tracks.length);
  const pickNext = () => (prefs.shuffle ? randomOther() : (current + 1) % Math.max(1, tracks.length));
  function load(index, from) {
    if (!tracks.length) return;
    current = (index + tracks.length) % tracks.length;
    prefs.track = current;
    prefs.pos = from || 0;
    save();
    player.src = tracks[current].src;
    if (from) player.addEventListener('loadedmetadata', () => { player.currentTime = Math.min(from, Math.max(0, player.duration - 1)); }, { once: true });
    upcoming = pickNext();
    preloaded = false;
  }
  function playTrack(index, from) {
    if (!tracks.length) return;
    load(index, from);
    prefs.userPaused = false;
    if (!prefs.music) prefs.music = 50;
    save();
    startPlaying();
  }
  const nextTrack = () => playTrack(upcoming);
  player.addEventListener('ended', nextTrack);
  player.addEventListener('timeupdate', () => {
    if (!preloaded && tracks[upcoming] && player.duration - player.currentTime < 30) {
      preloaded = true;
      preloader.src = tracks[upcoming].src;
      preloader.load();
    }
    // 記住播到哪裡：進遊戲或回大廳時從這裡接著播
    if (Math.abs((prefs.pos || 0) - player.currentTime) > 3) { prefs.pos = Math.floor(player.currentTime); save(); }
  });
  const remember = () => { prefs.playing = !player.paused; prefs.pos = Math.floor(player.currentTime || 0); save(); };
  player.addEventListener('play', () => { remember(); changed(); });
  player.addEventListener('pause', () => { if (document.visibilityState === 'visible') remember(); changed(); });
  player.addEventListener('error', () => { if (tracks.length > 1 && player.src) setTimeout(nextTrack, 800); });
  window.addEventListener('pagehide', () => { prefs.pos = Math.floor(player.currentTime || 0); save(); });

  function action(name) {
    if (name === 'prev') playTrack(current - 1);
    else if (name === 'next') nextTrack();
    else if (name === 'shuffle') { prefs.shuffle = !prefs.shuffle; upcoming = pickNext(); preloaded = false; save(); changed(); }
    else if (name === 'carry') { prefs.carry = prefs.carry === false; save(); changed(); }
    else if (player.paused) { prefs.userPaused = false; save(); if (player.src) startPlaying(); else playTrack(current); }
    else { prefs.userPaused = true; save(); player.pause(); }
  }
  function setMusic(level) {
    prefs.music = level;
    save();
    if (!level) player.pause();
    else if (player.paused && !prefs.userPaused && tracks.length) (player.src ? startPlaying() : playTrack(current));
    else { fadeRun++; try { player.volume = targetVolume(); } catch (e) { /* ignore */ } }
    changed();
  }
  function setSfx(level) { prefs.sfx = level; save(); changed(); }
  function setAlbum(id) {
    if (album && album.id === id) return;
    useAlbum(id);
    save();
    playTrack(0);
  }

  // 瀏覽器規定要先點過畫面才能出聲：
  // 大廳：音樂沒關、玩家沒按暫停就自動播；遊戲：大廳播放中且勾選「進入遊戲後繼續播放」才接著播
  const shouldAutoplay = () => prefs.music > 0 && tracks.length && (IN_LOBBY ? !prefs.userPaused : prefs.carry !== false && prefs.playing);
  const startOnTap = () => {
    if (!shouldAutoplay() || !player.paused) { document.removeEventListener('pointerdown', startOnTap, true); return; }
    if (!player.src) load(current, prefs.playing ? prefs.pos || 0 : 0);
    startPlaying().then(() => { if (!player.paused) document.removeEventListener('pointerdown', startOnTap, true); });
  };
  document.addEventListener('pointerdown', startOnTap, true);

  // 遊戲裡點回大廳的連結：先淡出音樂再換頁
  if (!IN_LOBBY) {
    document.addEventListener('click', (e) => {
      const link = e.target.closest && e.target.closest('a[href]');
      if (!link || player.paused || !link.href.startsWith(LOBBY)) return;
      e.preventDefault();
      fadeTo(0, 450).then(() => { location.href = link.href; });
    }, true);
  }

  fetch(new URL('music/playlist.json', LOBBY), { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : {}))
    .then((data) => {
      // 新格式 { albums: [{ id, title, cover, tracks }] }；舊格式 { cover, tracks } 視為一張專輯
      const list = data.albums || [{ id: 'default', title: data.title || '歌單', cover: data.cover, tracks: data.tracks }];
      albums = list.map((a) => ({
        id: String(a.id),
        title: a.title || '歌單',
        cover: a.cover ? new URL(a.cover, LOBBY).href : '',
        tracks: (a.tracks || []).filter((t) => t && t.title && t.src).map((t) => ({ ...t, cover: t.cover ? new URL(t.cover, LOBBY).href : '' })),
      })).filter((a) => a.tracks.length);
      useAlbum(prefs.album);
      current = Math.min(Number(prefs.track) || 0, Math.max(0, tracks.length - 1));
      if (shouldAutoplay()) {
        load(current, prefs.playing ? prefs.pos || 0 : 0);
        startPlaying();
      }
      changed();
    })
    .catch(() => changed());

  // ---------- 彈窗 ----------
  const style = document.createElement('style');
  style.textContent = `
    .gda-layer{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:calc(10px + env(safe-area-inset-top,0px)) 12px calc(10px + env(safe-area-inset-bottom,0px));background:#050817d9;backdrop-filter:blur(6px);font-family:inherit}
    .gda-layer[hidden]{display:none}
    .gda-card{width:min(100%,440px);max-height:100%;display:flex;flex-direction:column;border:2px solid #783dff;border-radius:22px;background:linear-gradient(155deg,#171f49,#0d1430);color:#f8faff;box-shadow:0 18px 70px #000c,0 0 20px #783dff55;overflow:hidden}
    .gda-head{flex:none;position:relative;padding:12px 44px;text-align:center;font-size:18px;font-weight:900;background:linear-gradient(100deg,#783dff,#ff3d9e 60%,#ff8a3d)}
    .gda-x{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:32px;height:32px;border:0;border-radius:50%;background:#0003;color:#fff;font-size:18px;cursor:pointer}
    .gda-body{flex:1;min-height:0;overflow:auto;padding:14px;display:grid;gap:12px;align-content:start;overscroll-behavior:contain}
    .gda-sec{display:grid;gap:8px}
    .gda-sec>b{font-size:14px;color:#ffd166}
    .gda-albums{display:flex;gap:8px;overflow-x:auto;padding-bottom:2px}
    .gda-album{flex:none;display:flex;align-items:center;gap:8px;border:1px solid #35406d;border-radius:12px;background:#1b2350;color:#f8faff;font:inherit;font-size:13px;font-weight:800;padding:6px 12px 6px 6px;cursor:pointer}
    .gda-album img{width:34px;height:34px;border-radius:8px;object-fit:cover}
    .gda-album.on{border-color:#ffd166;box-shadow:0 0 8px #ffd16666}
    .gda-now{border:1px solid #35406d;border-radius:14px;padding:12px;background:#1b2350;display:grid;gap:10px}
    .gda-now-head{display:flex;align-items:center;gap:12px}
    .gda-now-head img{width:64px;height:64px;flex:none;border-radius:10px;object-fit:cover;box-shadow:0 0 10px #783dff88}
    .gda-now-head small{color:#aeb8e8;font-size:12px}.gda-now-head b{display:block;color:#ffd166;font-size:16px;margin-top:2px}
    .gda-ctrl{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
    .gda-ctrl button,.gda-seg button{border:1px solid #35406d;border-radius:999px;background:#222b57;color:#f8faff;font:inherit;font-size:13px;font-weight:800;padding:8px 4px;cursor:pointer}
    .gda-ctrl button.on,.gda-seg button.on{background:linear-gradient(100deg,#783dff,#ff3d9e);border-color:transparent;color:#fff;box-shadow:0 0 10px #ff3d9e55}
    .gda-seg{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
    .gda-carry{display:flex;justify-content:space-between;align-items:center;color:#aeb8e8;font-size:13px}
    .gda-switch{width:46px;height:26px;border:0;border-radius:99px;background:#35406d;position:relative;cursor:pointer;flex:none}
    .gda-switch:after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:left .2s}
    .gda-switch.on{background:linear-gradient(100deg,#783dff,#ff3d9e)}.gda-switch.on:after{left:23px}
    .gda-list{display:grid;gap:6px}
    .gda-list button{display:flex;gap:10px;align-items:center;text-align:left;border:1px solid #35406d;border-radius:12px;padding:9px 12px;background:#121a40;color:#f8faff;font:inherit;font-size:14px;cursor:pointer}
    .gda-list button.on{border-color:#ffd166;box-shadow:0 0 8px #ffd16666}
    .gda-list i{font-style:normal;color:#8993bd;width:22px;text-align:right;flex:none}
    .gda-empty{color:#8993bd;text-align:center;padding:16px 8px}
    .gda-note{color:#8993bd;font-size:11px;line-height:1.5}
    [data-gd-audio].gda-off{opacity:.65}`;
  document.head.appendChild(style);

  let layer = null;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const levelName = (v) => (v ? v + '%' : '靜音');
  const seg = (kind, value) => `<div class="gda-seg">${LEVELS.map((v) => `<button type="button" data-${kind}="${v}" class="${v === value ? 'on' : ''}">${levelName(v)}</button>`).join('')}</div>`;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function render() {
    if (!layer || layer.hidden) return;
    const t = tracks[current];
    const cover = (t && t.cover) || (album && album.cover) || '';
    const playing = !player.paused;
    $body().innerHTML = `
      ${albums.length ? `<div class="gda-sec"><b>專輯</b><div class="gda-albums">${albums.map((a) => `<button type="button" class="gda-album ${album && a.id === album.id ? 'on' : ''}" data-album="${esc(a.id)}">${a.cover ? `<img src="${esc(a.cover)}" alt="">` : ''}<span>${esc(a.title)}</span></button>`).join('')}</div></div>` : ''}
      ${t ? `<div class="gda-now"><div class="gda-now-head">${cover ? `<img src="${esc(cover)}" alt="">` : ''}<div><small>${playing ? '正在播放' : '目前選擇'}・${esc(album.title)}</small><b>${esc(t.title)}</b></div></div>
        <div class="gda-ctrl"><button type="button" data-act="prev">⏮ 上一首</button><button type="button" data-act="next">⏭ 下一首</button><button type="button" data-act="play">${playing ? '⏸ 暫停' : '▶ 播放'}</button><button type="button" data-act="shuffle" class="${prefs.shuffle ? 'on' : ''}">🔀 隨機：${prefs.shuffle ? '開' : '關'}</button></div>
        <label class="gda-carry">進入遊戲後繼續播放<button type="button" class="gda-switch ${prefs.carry === false ? '' : 'on'}" data-act="carry" aria-label="進入遊戲後繼續播放"></button></label></div>` : '<div class="gda-empty">歌曲即將上架，敬請期待。</div>'}
      <div class="gda-sec"><b>🎵 音樂音量</b>${seg('music', prefs.music)}</div>
      <div class="gda-sec"><b>🔊 音效音量（遊戲內）</b>${seg('sfx', prefs.sfx)}</div>
      ${isIOS ? '<p class="gda-note">iPhone／iPad 的音樂只能用靜音或手機音量鍵調整大小聲；音效音量可在這裡調整。</p>' : ''}
      ${tracks.length ? `<div class="gda-sec"><b>歌單</b><div class="gda-list">${tracks.map((x, i) => `<button type="button" data-track="${i}" class="${i === current ? 'on' : ''}"><i>${i === current && playing ? '♪' : i + 1}</i><span>${esc(x.title)}</span></button>`).join('')}</div></div>` : ''}`;
  }
  const $body = () => layer.querySelector('.gda-body');

  function open() {
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'gda-layer';
      layer.hidden = true;
      layer.innerHTML = '<div class="gda-card" role="dialog" aria-label="音源"><div class="gda-head">音源<button type="button" class="gda-x" aria-label="關閉">✕</button></div><div class="gda-body"></div></div>';
      document.body.appendChild(layer);
      layer.addEventListener('click', (e) => {
        if (e.target === layer || e.target.closest('.gda-x')) return close();
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.act) action(b.dataset.act);
        else if (b.dataset.track) playTrack(Number(b.dataset.track));
        else if (b.dataset.album) setAlbum(b.dataset.album);
        else if (b.dataset.music !== undefined) setMusic(Number(b.dataset.music));
        else if (b.dataset.sfx !== undefined) setSfx(Number(b.dataset.sfx));
      });
    }
    layer.hidden = false;
    render();
  }
  function close() { if (layer) layer.hidden = true; }

  // ---------- 喇叭按鈕：data-gd-audio，或舊遊戲的 #soundBtn／#sound ----------
  const BUTTONS = '[data-gd-audio], #soundBtn, button#sound';
  function renderButtons() {
    document.querySelectorAll(BUTTONS).forEach((b) => {
      if (b.hasAttribute('data-gd-audio-text')) return;
      const muted = !prefs.sfx && (!prefs.music || player.paused);
      b.textContent = muted ? '🔇' : '🔊';
      b.classList.toggle('off', muted);
      b.title = '音源';
      b.setAttribute('aria-label', '音源');
    });
  }
  // 用捕捉階段攔下點擊：遊戲原本的「音效開關」不再執行，改開共用彈窗
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest(BUTTONS);
    if (!b) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    open();
  }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderButtons); else renderButtons();

  const api = {
    open,
    close,
    /** 音效音量 0–1（遊戲 sound.js 用來調整音效大小聲；0 = 靜音） */
    get sfx() { return prefs.sfx / 100; },
    /** 音樂音量 0–1 */
    get music() { return prefs.music / 100; },
    fadeOut: (ms = 450) => (player.paused ? Promise.resolve() : fadeTo(0, ms)),
    /** 大廳設定列顯示用 */
    status() {
      if (!tracks.length) return '歌曲即將上架';
      if (!prefs.music) return '音樂已靜音';
      return `${player.paused ? '暫停' : '播放中'}：${tracks[current].title}`;
    },
    state: () => ({ music: prefs.music, sfx: prefs.sfx, playing: !player.paused, album: album && album.id, track: current }),
  };
  window.GDAudio = api;
  window.GDMusic = { fadeOut: api.fadeOut };
})();
