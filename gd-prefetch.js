/* 老虎機背景預載：玩家停在大廳時，趁閒置依序把各款 SLOTS 開場要用的檔案（程式、圖、開場必要音效）先下載到瀏覽器快取，
 * 點進遊戲時直接從快取讀，幾乎不用等 LOADING。
 * - 只在 gdclub.cc 執行：大廳與遊戲同網址（/slots/），共用同一份瀏覽器快取。
 * - 省流量模式、2G／3G 不預載；行動網路只預載第一款（財神）；分頁切到背景時暫停；同一個分頁工作階段每款只預載一次。
 * - 一次最多同時下載 3 個檔，低優先權，不跟大廳本身搶網路。
 * 開場檔案的範圍要跟 GD_Slots 的 packages/client/src/skin.ts（loadSkin 的 files）與 sound.ts（ESSENTIAL_SOUNDS）一致。
 */
(() => {
  if (!/(^|\.)gdclub\.cc$/.test(location.hostname)) return;
  const net = navigator.connection;
  if (net && (net.saveData || /(^|-)(2g|3g)$/.test(net.effectiveType || ''))) return;

  const BASE = '/slots';
  // 財神優先，其餘照大廳老虎機的順序
  const GAMES = net && net.type === 'cellular' ? ['gof'] : ['gof', 'thor', 'demon', 'roma', 'pirate', 'farm'];
  // 開場必要音效（同 GD_Slots sound.ts 的 ESSENTIAL_SOUNDS）
  const SOUNDS = [
    'spin', 'button', 'stop1', 'stop2', 'stop3', 'stop4', 'stop5',
    'score1', 'score2', 'score3', 'scoreEnd',
    'scatter1', 'scatter2', 'scatter3', 'scatter4', 'scatter5', 'bonusWaiting',
    'wild', 'wildVox1', 'wildVox2', 'winCoins', 'opening',
  ];
  const english = !/^zh/i.test(navigator.language || 'zh');
  const KEY = 'gd-slots-prefetched';
  const done = new Set((() => { try { return JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch { return []; } })());
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify([...done])); } catch {} };

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const whileHidden = async () => { while (document.hidden) await wait(1000); };
  const seen = new Set();
  // 下載一個檔到瀏覽器快取（讀完內容才算數）；失敗就略過
  const get = async (url) => {
    if (seen.has(url)) return;
    seen.add(url);
    await whileHidden();
    try {
      const r = await fetch(url, { priority: 'low', credentials: 'same-origin' });
      if (r.ok) await r.arrayBuffer();
    } catch {}
  };
  const pool = async (urls, n = 3) => {
    const queue = [...new Set(urls)];
    await Promise.all(Array.from({ length: n }, async () => { while (queue.length) await get(queue.shift()); }));
  };
  const text = (url) => fetch(url, { credentials: 'same-origin' }).then((r) => (r.ok ? r.text() : '')).catch(() => '');

  /** 遊戲程式：index.html 引用的 js／css，加上主程式動態載入的分塊（assets/*.js，檔名帶雜湊、可長期快取） */
  async function codeFiles(game) {
    const page = `${location.origin}${BASE}/${game}/index.html`;
    const html = await text(page);
    const urls = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((m) => new URL(m[1], page).href);
    const main = urls.find((u) => /\/assets\/index-[^/]+\.js$/.test(u));
    if (main) {
      const code = await text(main);
      for (const m of code.matchAll(/["'`(/]((?:\.\/)?[\w-]+\.js)["'`)]/g)) {
        if (/^(\.\/)?[\w]+-[\w-]{6,}\.js$/.test(m[1])) urls.push(new URL(m[1], main).href);
      }
    }
    return urls;
  }

  /** 開場要等的圖與音效（同 skin.ts 的 loadSkin：符號、中獎分層靜態圖、背景、標題、底框、按鈕；逐格動畫與特效不在內） */
  function skinFiles(game, skin) {
    const root = `${BASE}/skins/${game}/`;
    const files = [];
    const add = (f) => { if (typeof f === 'string' && f) files.push(root + f); };
    const pick = (l) => (english && l.srcEn ? l.srcEn : l.src);
    Object.values({ ...skin.symbols, ...(english ? skin.symbolsEn : {}) }).forEach(add);
    Object.values(skin.win || {}).forEach((w) => (w.layers || []).forEach((l) => { if (!l.sheet) add(pick(l)); }));
    (skin.wild2x?.layers || []).forEach((l) => add(pick(l)));
    [skin.background, skin.freeBackground, skin.title, skin.linesPlate, skin.buyButton, skin.freeLogo].forEach(add);
    if (skin.messagePlate) [skin.messagePlate.normal, skin.messagePlate.free].forEach(add);
    if (skin.spinButton) [skin.spinButton.base, skin.spinButton.active, skin.spinButton.disabled].forEach(add);
    SOUNDS.forEach((k) => add(skin.sounds?.[k]));
    return files;
  }

  async function prefetch(game) {
    const skin = await fetch(`${BASE}/skins/${game}/skin.json`, { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (!skin) return;
    await pool([...(await codeFiles(game)), ...skinFiles(game, skin)]);
  }

  async function run() {
    for (const game of GAMES) {
      if (done.has(game)) continue;
      await prefetch(game);
      done.add(game);
      save();
      await wait(800);
    }
  }

  // 大廳本身載完、再等 3 秒且瀏覽器閒置時才開始
  const start = () => setTimeout(() => (window.requestIdleCallback || ((f) => setTimeout(f, 1)))(() => void run(), { timeout: 5000 }), 3000);
  if (document.readyState === 'complete') start();
  else addEventListener('load', start, { once: true });
})();
