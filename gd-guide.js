/* 獎勵中心「遊戲介紹」分頁：每款遊戲一頁（分頁切換），頁首兩格影片，接著玩法步驟、特色、派彩表、小提示。
 * 數值照 GD_Slots 引擎設定（apps/worker slotConfig）：線數、押注倍數、免費遊戲場數與倍數、派彩表。
 * 影片：在 videos 的 src 填網址就會顯示播放器，沒填顯示「影片準備中」。 */
(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const num = (n) => Number(n).toLocaleString('en-US');

  // 符號圖取自 SLOTS 的 skin.json（gdclub.cc 同網址；本機預覽讀 dev）。各環境檔名不同，所以讀 skin.json，讀不到才用下面 syms 的預設檔名
  const SLOTS_BASE = /(^|\.)gdclub\.cc$/.test(location.hostname) ? '/slots' : 'https://dev.gdclub.cc/slots';
  const skins = {};
  const loadSkin = (key) => (skins[key] ??= fetch(`${SLOTS_BASE}/skins/${key}/skin.json`).then((r) => (r.ok ? r.json() : null)).then((j) => j?.symbols || null).catch(() => null));
  const LINE_BETS = [1, 100]; // 每線押注最小、最大
  const BUY_X = 100;

  /**
   * 每款：key＝SLOTS 遊戲代號、name＝大廳卡片名稱、syms＝符號 id → 圖檔、pays＝一般符號賠率（X1…X5）、
   * betX＝總押注倍數（線數或 WAYS 的押注倍數）、ways＝243 WAYS、features＝特色卡（sym：符號 id）。
   */
  const SLOT_GUIDES = [
    {
      key: 'gof', name: '財神', tagline: '紅包滿天・財神送福', ways: false, betX: 25,
      intro: '經典 5 輪 3 列、25 條固定連線。百搭參與連線贏分加倍，湊齊 3 個分散符號開啟 15 場免費遊戲，免費期間所有贏分 4 倍。',
      chips: ['5 × 3 盤面', '25 條連線', '免費遊戲 ×4', '最高再觸發 90 場'],
      syms: { 0: 'sym_9', 1: 'sym_10', 2: 'sym_j', 3: 'sym_q', 4: 'sym_k', 5: 'sym_a', 6: 'sym_m5', 7: 'sym_m4', 8: 'sym_m3', 9: 'sym_m2', 10: 'sym_m1', 11: 'sym_scatter_zh', '-1': 'sym_wild_zh' },
      pays: { 0: [0, 0, 5, 25, 125], 1: [0, 0, 5, 25, 125], 2: [0, 0, 5, 25, 125], 3: [0, 0, 10, 50, 250], 4: [0, 0, 10, 50, 250], 5: [0, 0, 10, 50, 250], 6: [0, 0, 15, 75, 500], 7: [0, 0, 15, 75, 500], 8: [0, 2, 25, 125, 750], 9: [0, 2, 25, 125, 750], 10: [0, 2, 50, 250, 1250] },
      special: [
        { sym: -1, title: '百搭', pays: [0, 5, 125, 1250, 5000], text: '可替代分散符號以外的所有符號；參與連線時贏分 <em>×2</em>。' },
        { sym: 11, title: '分散獎賞', pays: [0, 2, 5, 0, 0], basis: 'total', text: '只出現在第 2、3、4 輪，任意位置即得獎，贏分乘以總押注。' },
      ],
      features: [
        { sym: 11, title: '免費遊戲', text: '3 個分散符號贏得 <em>15 場</em>免費遊戲，免費期間所有贏分 <em>×4</em>；可再次觸發，最多 90 場。' },
        { sym: -1, title: '百搭加倍', text: '百搭替代其他符號組成連線時，該線贏分 <em>×2</em>；5 個百搭連線 5,000 倍。' },
        { icon: '🎟️', title: '購買免費遊戲', text: `以 <em>${BUY_X} 倍</em>總押注直接進入免費遊戲。` },
      ],
      tips: ['分散符號只會出現在中間三輪，看到第 2、3 輪都有就準備好吧。', '免費遊戲 ×4 再加上百搭 ×2，同一條線最高可達 8 倍加成。'],
      videos: [{ title: '快速上手', src: '' }, { title: '免費遊戲實錄', src: '' }],
    },
    {
      key: 'pirate', name: '金銀島', tagline: '揚帆出海・寶藏滿艙', ways: true, betX: 50,
      intro: '5 輪 3 列 243 WAYS，相鄰轉輪由左到右出現相同符號就得獎。百搭帶隨機倍數，免費遊戲每次中獎再乘 ×4～×8，金幣越多獎越大。',
      chips: ['5 × 3 盤面', '243 WAYS', '百搭 ×2～×5', '免費遊戲 ×4～×8'],
      syms: { 0: 'sym_j', 1: 'sym_q', 2: 'sym_k', 3: 'sym_a', 4: 'sym_m3', 5: 'sym_m2', 6: 'sym_m1', 9: 'sym_bonus', 10: 'sym_c2', '-1': 'sym_wild' },
      pays: { 0: [0, 0, 1, 5, 20], 1: [0, 0, 1, 5, 20], 2: [0, 0, 5, 12, 40], 3: [0, 0, 5, 12, 40], 4: [0, 0, 12, 25, 50], 5: [0, 0, 12, 30, 100], 6: [0, 0, 15, 50, 200] },
      special: [
        { sym: -1, title: '百搭', text: '可替代兩種分散符號以外的所有符號；主遊戲及免費遊戲中可能帶 <em>×2～×5</em> 隨機倍數，多個百搭以最高倍數計算。' },
        { sym: 10, title: '金幣獎賞', pays: [1, 3, 6, 15, 45, 90, 180, 450, 900, 1800], text: '任意位置出現即得獎，最多計 10 個。' },
      ],
      features: [
        { sym: 9, title: '免費遊戲', text: '只出現在第 1～3 輪，3 個贏得 <em>15 場</em>免費遊戲；免費遊戲中每次中獎隨機乘以 <em>×4～×8</em>，可再次觸發，最多 99 場。' },
        { sym: -1, title: '隨機倍數百搭', text: '百搭可能帶 <em>×2～×5</em> 倍數，同一轉出現多個時取最高倍數。' },
        { sym: 10, title: '金幣獎賞', text: '金幣出現在任意位置即派彩，10 個最高 <em>1,800</em>。' },
        { icon: '🎟️', title: '購買免費遊戲', text: `以 <em>${BUY_X} 倍</em>總押注直接進入免費遊戲。` },
      ],
      tips: ['243 WAYS 不用看線，只要從第 1 輪開始相鄰轉輪有相同符號就算。', '免費遊戲的觸發符號只在前三輪，三輪都停到就中。'],
      videos: [{ title: '快速上手', src: '' }, { title: '免費遊戲實錄', src: '' }],
    },
    {
      key: 'roma', name: '羅馬競技場', tagline: '榮耀之戰・競技稱王', ways: false, betX: 30,
      intro: '5 輪 3 列、30 條連線。百搭參與連線贏分加倍；分散符號 5 輪都會出現，5 個直接 500 倍總押注，3 個以上開啟 15 場 3 倍免費遊戲。',
      chips: ['5 × 3 盤面', '30 條連線', '免費遊戲 ×3', '分散最高 500 倍'],
      syms: { 0: 'sym_9', 1: 'sym_10', 2: 'sym_j', 3: 'sym_q', 4: 'sym_k', 5: 'sym_a', 6: 'sym_m5', 7: 'sym_m4', 8: 'sym_m3', 9: 'sym_m2', 10: 'sym_m1', 11: 'sym_bonus', '-1': 'sym_wild' },
      pays: { 0: [0, 2, 5, 25, 100], 1: [0, 0, 5, 25, 100], 2: [0, 0, 5, 25, 100], 3: [0, 0, 5, 25, 100], 4: [0, 0, 10, 50, 125], 5: [0, 0, 10, 50, 125], 6: [0, 0, 15, 75, 250], 7: [0, 0, 15, 75, 250], 8: [0, 0, 20, 100, 400], 9: [0, 2, 25, 125, 750], 10: [0, 2, 25, 125, 750] },
      special: [
        { sym: -1, title: '百搭', pays: [0, 5, 125, 1250, 5000], text: '可替代分散符號以外的所有符號；參與連線時贏分 <em>×2</em>。' },
        { sym: 11, title: '分散獎賞', pays: [0, 2, 5, 20, 500], basis: 'total', text: '5 輪都會出現，任意位置即得獎，贏分乘以總押注。' },
      ],
      features: [
        { sym: 11, title: '免費遊戲', text: '3 個以上分散符號贏得 <em>15 場</em>免費遊戲，免費期間所有贏分 <em>×3</em>；可再次觸發，最多 90 場。' },
        { sym: -1, title: '百搭加倍', text: '百搭替代組成連線時贏分 <em>×2</em>；5 個百搭連線 5,000 倍。' },
        { icon: '🎟️', title: '購買免費遊戲', text: `以 <em>${BUY_X} 倍</em>總押注直接進入免費遊戲。` },
      ],
      tips: ['分散符號 2 個就有獎，5 個一次 500 倍總押注。', '最高的兩個人物符號 2 連線就開始派彩。'],
      videos: [{ title: '快速上手', src: '' }, { title: '免費遊戲實錄', src: '' }],
    },
    {
      key: 'thor', name: '雷神索爾', tagline: '雷霆降臨・神鎚開獎', ways: false, betX: 30,
      intro: '5 輪 3 列、30 條連線。分散符號只出現在第 1、3、5 輪，三輪同時停到就開啟 12 場獎勵遊戲，獎勵遊戲中可再觸發。',
      chips: ['5 × 3 盤面', '30 條連線', '獎勵遊戲 12 場', '最高再觸發 96 場'],
      syms: { 0: 'sym_10', 1: 'sym_j', 2: 'sym_q', 3: 'sym_k', 4: 'sym_a', 5: 'sym_m4', 6: 'sym_m3', 7: 'sym_m2', 8: 'sym_m1', 9: 'sym_bonus', '-1': 'sym_wild' },
      pays: { 0: [0, 0, 5, 20, 100], 1: [0, 0, 5, 20, 100], 2: [0, 0, 5, 20, 100], 3: [0, 0, 10, 50, 200], 4: [0, 0, 10, 50, 200], 5: [0, 0, 20, 100, 400], 6: [0, 0, 20, 100, 400], 7: [0, 0, 50, 150, 500], 8: [0, 10, 50, 200, 1000] },
      special: [
        { sym: -1, title: '百搭', text: '可替代分散符號以外的所有符號，幫你補齊連線。' },
      ],
      features: [
        { sym: 9, title: '獎勵遊戲', text: '分散符號出現在第 1、3、5 輪，3 個贏得 <em>12 場</em>獎勵遊戲；可再次觸發，最多 96 場。' },
        { sym: 8, title: '雷神連線', text: '最高符號 2 連線就派彩，5 連線 <em>1,000 倍</em>每線押注。' },
        { icon: '🎟️', title: '購買獎勵遊戲', text: `以 <em>${BUY_X} 倍</em>總押注直接進入獎勵遊戲。` },
      ],
      tips: ['觸發符號固定在第 1、3、5 輪，第 1、3 輪都停到時就看最後一輪。'],
      videos: [{ title: '快速上手', src: '' }, { title: '獎勵遊戲實錄', src: '' }],
    },
    {
      key: 'farm', name: '開心農場', tagline: '豐收時節・滿倉好運', ways: false, betX: 20,
      intro: '5 輪 3 列、20 條連線。百搭參與連線贏分加倍、5 個百搭 5,000 倍；分散符號任意位置就派彩，觸發符號開啟 10 場 2 倍免費遊戲。',
      chips: ['5 × 3 盤面', '20 條連線', '免費遊戲 ×2', '最高再觸發 100 場'],
      syms: { 0: 'sym_j', 1: 'sym_q', 2: 'sym_k', 3: 'sym_a', 4: 'sym_m5', 5: 'sym_m4', 6: 'sym_m3', 7: 'sym_m2', 8: 'sym_m1', 11: 'sym_scatter', 12: 'sym_bonus', '-1': 'sym_wild' },
      pays: { 0: [0, 0, 5, 25, 100], 1: [0, 0, 5, 25, 100], 2: [0, 0, 5, 25, 100], 3: [0, 0, 5, 25, 100], 4: [0, 0, 10, 50, 250], 5: [0, 0, 10, 50, 250], 6: [0, 0, 10, 50, 250], 7: [0, 2, 25, 100, 750], 8: [0, 2, 25, 100, 750] },
      special: [
        { sym: -1, title: '百搭', pays: [0, 5, 50, 500, 5000], text: '可替代分散符號以外的所有符號；參與連線時贏分 <em>×2</em>。' },
        { sym: 11, title: '分散獎賞', pays: [0, 0, 5, 25, 100], basis: 'total', text: '任意位置出現即得獎，贏分乘以總押注。' },
      ],
      features: [
        { sym: 12, title: '免費遊戲', text: '觸發符號只出現在第 1、3、5 輪，3 個贏得 <em>10 場</em>免費遊戲，免費期間所有贏分 <em>×2</em>；可再次觸發，最多 100 場。' },
        { sym: 11, title: '分散獎賞', text: '3 個以上任意位置即派彩，5 個 <em>100 倍</em>總押注。' },
        { icon: '🎟️', title: '購買免費遊戲', text: `以 <em>${BUY_X} 倍</em>總押注直接進入免費遊戲。` },
      ],
      tips: ['畫面上有兩種特殊符號：一種直接派彩、一種開免費遊戲，別搞混了。'],
      videos: [{ title: '快速上手', src: '' }, { title: '免費遊戲實錄', src: '' }],
    },
    {
      key: 'demon', name: '惡魔偵探', tagline: '暗夜追查・真相現形', ways: true, betX: 25,
      intro: '5 輪 3 列 243 WAYS，相鄰轉輪由左到右出現相同符號就得獎。分散符號 5 輪都會出現，3 個以上既派彩又開啟 10 場獎勵遊戲。',
      chips: ['5 × 3 盤面', '243 WAYS', '獎勵遊戲 10 場', '分散最高 250 倍'],
      syms: { 0: 'sym_9', 1: 'sym_10', 2: 'sym_j', 3: 'sym_q', 4: 'sym_k', 5: 'sym_a', 6: 'sym_m4', 7: 'sym_m3', 8: 'sym_m2', 9: 'sym_m1', 10: 'sym_scatter', 11: 'sym_c2', '-1': 'sym_wild' },
      pays: { 0: [0, 0, 5, 15, 100], 1: [0, 0, 5, 15, 100], 2: [0, 0, 10, 25, 150], 3: [0, 0, 10, 25, 150], 4: [0, 0, 10, 25, 150], 5: [0, 0, 15, 30, 250], 6: [0, 0, 25, 50, 300], 7: [0, 0, 30, 100, 500], 8: [0, 0, 30, 100, 500], 9: [0, 0, 50, 150, 1000], 11: [3, 5, 25, 50, 100] },
      special: [
        { sym: -1, title: '百搭', text: '可替代分散符號以外的所有符號，幫你補齊 WAYS 組合。' },
        { sym: 10, title: '分散獎賞', pays: [0, 0, 5, 25, 250], basis: 'total', text: '5 輪都會出現，任意位置即得獎。' },
      ],
      features: [
        { sym: 10, title: '獎勵遊戲', text: '3 個以上分散符號贏得 <em>10 場</em>獎勵遊戲；可再次觸發，最多 99 場。' },
        { sym: 10, title: '分散獎賞', text: '觸發的同時派彩，5 個 <em>250 倍</em>總押注。' },
        { icon: '🎟️', title: '購買獎勵遊戲', text: `以 <em>${BUY_X} 倍</em>總押注直接進入獎勵遊戲。` },
      ],
      tips: ['243 WAYS 同一轉可能同時有很多組合得獎，每組各自派彩。'],
      videos: [{ title: '快速上手', src: '' }, { title: '獎勵遊戲實錄', src: '' }],
    },
  ];

  // 分類：先做老虎機，之後在這裡加其他分類
  const GUIDE_CATS = [{ key: 'slots', name: '老虎機', list: SLOT_GUIDES }];

  const style = document.createElement('style');
  style.textContent = `
    .gd-gd{--gd-line:#2b3566;--gd-gold:#ffd166;--gd-pink:#ff3d9e;--gd-sub:#aeb8e8;color:#eef1ff;display:grid;gap:14px}
    .gd-gd em{font-style:normal;color:var(--gd-gold);font-weight:900}
    .gd-gd-cats{display:flex;gap:8px;flex-wrap:wrap}
    .gd-gd-cats button{border:1px solid #35406d;border-radius:999px;padding:6px 16px;background:#111838;color:var(--gd-sub);font:inherit;font-weight:900;cursor:pointer}
    .gd-gd-cats button.on{background:linear-gradient(180deg,#ff6ec7,#ff3d9e);border-color:transparent;color:#fff}
    .gd-gd-strip{display:grid;grid-auto-flow:column;grid-auto-columns:84px;justify-content:start;gap:8px;overflow-x:auto;padding-bottom:4px;scrollbar-width:thin}
    .gd-gd-strip button{border:2px solid transparent;border-radius:14px;padding:4px 4px 6px;background:#111838;color:var(--gd-sub);font:inherit;font-size:12px;font-weight:900;cursor:pointer;display:grid;gap:4px;justify-items:center;position:relative}
    .gd-gd-strip button img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;display:block}
    .gd-gd-strip button i{position:absolute;left:6px;top:6px;min-width:20px;height:20px;border-radius:10px;background:#0b1026cc;color:var(--gd-gold);font-style:normal;font-size:11px;line-height:20px}
    .gd-gd-strip button.on{border-color:var(--gd-pink);color:#fff;box-shadow:0 0 10px #ff3d9e66}
    .gd-gd-hero{display:grid;grid-template-columns:120px minmax(0,1fr);gap:14px;align-items:center;padding:14px;border-radius:18px;border:1px solid #35406d;background:radial-gradient(circle at 85% 10%,#783dff44,transparent 55%),linear-gradient(135deg,#1c2557,#121a40)}
    .gd-gd-hero>img{width:120px;height:120px;border-radius:18px;object-fit:cover;box-shadow:0 6px 18px #0008}
    .gd-gd-label{color:var(--gd-pink);font-size:12px;font-weight:900;letter-spacing:.08em}
    .gd-gd-hero h2{margin:2px 0 4px;font-size:26px;line-height:1.15;color:#fff}
    .gd-gd-hero h2 small{display:block;font-size:14px;color:var(--gd-gold);margin-top:4px}
    .gd-gd-hero p{margin:6px 0 0;color:#cfd5f5;font-size:13px;line-height:1.65}
    .gd-gd-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;grid-column:1/-1}
    .gd-gd-chips span{border:1px solid #35406d;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:900;color:#d6dcff;background:#0d1430}
    .gd-gd-videos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .gd-gd-video{border-radius:14px;overflow:hidden;border:1px solid #35406d;background:#0b1026}
    .gd-gd-video video,.gd-gd-video .ph{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:#05081a}
    .gd-gd-video .ph{display:grid;place-items:center;align-content:center;gap:6px;color:#6f79ad;font-size:12px;background:repeating-linear-gradient(135deg,#0b1026 0 12px,#0e1430 12px 24px)}
    .gd-gd-video .ph b{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;background:#ff3d9e33;border:2px solid #ff3d9e88;color:#fff;font-size:18px}
    .gd-gd-video footer{display:flex;justify-content:space-between;padding:7px 10px;font-size:13px;font-weight:900}
    .gd-gd-video footer small{color:#8d97c7;font-weight:400}
    .gd-gd-cta{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
    .gd-gd-play{border:0;border-radius:999px;padding:11px 26px;font:inherit;font-weight:900;cursor:pointer;background:linear-gradient(180deg,#ffd166,#f2a516);color:#3a1d05}
    .gd-gd-link{border:0;background:none;color:var(--gd-sub);font:inherit;font-weight:900;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
    .gd-gd-sec{border-top:1px solid #2b3566;padding-top:12px}
    .gd-gd-sec>h3{margin:0 0 10px;font-size:19px;color:#fff}
    .gd-gd-sec>h3 small{display:block;color:var(--gd-pink);font-size:12px;letter-spacing:.08em;margin-bottom:2px}
    .gd-gd-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .gd-gd-step{border-radius:14px;padding:10px;background:#151b3d;border:1px solid var(--gd-line)}
    .gd-gd-step i{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:linear-gradient(180deg,#ff6ec7,#ff3d9e);color:#fff;font-style:normal;font-weight:900;margin-bottom:6px}
    .gd-gd-step b{display:block;color:#fff;font-size:14px;margin-bottom:3px}
    .gd-gd-step p{margin:0;color:#aeb8e8;font-size:12px;line-height:1.6}
    .gd-gd-feats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px}
    .gd-gd-feat{display:grid;grid-template-columns:54px minmax(0,1fr);gap:10px;align-items:start;border-radius:14px;padding:10px;background:#151b3d;border:1px solid var(--gd-line)}
    .gd-gd-feat>img,.gd-gd-feat>span{width:54px;height:54px;object-fit:contain;border-radius:10px;background:#0d1430;display:grid;place-items:center;font-size:28px}
    .gd-gd-feat b{display:block;color:#fff;margin-bottom:2px}
    .gd-gd-feat p{margin:0;color:#aeb8e8;font-size:12px;line-height:1.6}
    .gd-gd-hint{margin:-4px 0 8px;color:#8d97c7;font-size:12px}
    .gd-gd-pays{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
    .gd-gd-pay{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:center;border-radius:12px;padding:8px;background:#151b3d;border:1px solid var(--gd-line)}
    .gd-gd-pay.wide{grid-column:1/-1;grid-template-columns:auto minmax(0,1fr)}
    .gd-gd-pay .icons{display:flex;gap:2px}
    .gd-gd-pay .icons img{width:44px;height:44px;object-fit:contain}
    .gd-gd-pay .odds{display:grid;gap:1px;font-size:12px;color:#d6dcff}
    .gd-gd-pay .odds b{color:var(--gd-gold);display:inline-block;min-width:28px}
    .gd-gd-pay .odds h4{margin:0 0 2px;font-size:13px;color:#fff}
    .gd-gd-pay .odds.cols{grid-template-columns:repeat(auto-fill,minmax(70px,1fr))}
    .gd-gd-pay small{grid-column:1/-1;color:#aeb8e8;font-size:12px;line-height:1.55}
    .gd-gd-tips{margin:0;padding-left:18px;color:#cfd5f5;font-size:13px;line-height:1.8}
    .gd-gd-pager{display:flex;justify-content:space-between;align-items:center;gap:10px;padding-top:4px}
    .gd-gd-pager button{border:1px solid #35406d;border-radius:999px;padding:8px 14px;background:#111838;color:#d6dcff;font:inherit;font-weight:900;cursor:pointer;min-width:0;max-width:44%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .gd-gd-pager button:disabled{opacity:.35;cursor:default}
    .gd-gd-pager span{color:#8d97c7;font-size:13px;font-weight:900}
    .activity-tab{white-space:nowrap}
    @media (max-width:520px){
      .activity-tabs{padding:0 6px}.activity-tab{font-size:15px}
      .gd-gd-hero{grid-template-columns:84px minmax(0,1fr)}.gd-gd-hero>img{width:84px;height:84px}.gd-gd-hero h2{font-size:21px}
      .gd-gd-videos,.gd-gd-steps{grid-template-columns:1fr}
    }`;
  document.head.appendChild(style);

  const panel = $('[data-activity-panel="guide"]');
  if (!panel) return;
  let cat = 0, page = 0;

  const thumb = (name) => (typeof catalog !== 'undefined' ? catalog.find((g) => g[0] === name)?.[7] : '') || '';
  const symSrc = (g, id) => {
    const own = skins[g.key + ':map']?.[id];
    return own ? `${SLOTS_BASE}/skins/${g.key}/${own}` : g.syms[id] ? `${SLOTS_BASE}/skins/${g.key}/symbols/${g.syms[id]}.webp` : '';
  };
  const symImg = (g, id) => { const src = symSrc(g, id); return src ? `<img src="${esc(src)}" alt="" loading="lazy">` : ''; };
  // WAYS 遊戲派彩表寫最小押注的贏分（每線押注 1 × 押注倍數）；分散 total 基準 × 押注倍數
  const shown = (g, p, basis) => (g.ways ? p * (basis === 'total' ? g.betX : 1) : p);
  const payRows = (g, pays, basis) => pays.map((p, i) => ({ n: i + 1, p })).filter((x) => x.p > 0).reverse()
    .map((x) => `<div><b>X${x.n}</b> ${num(shown(g, x.p, basis))}</div>`).join('');

  function paytable(g) {
    const special = g.special.map((s) => `<div class="gd-gd-pay wide"><div class="icons">${symImg(g, s.sym)}</div><div class="odds${s.pays && s.pays.length > 5 ? ' cols' : ''}"><h4>${esc(s.title)}</h4>${s.pays ? payRows(g, s.pays, s.basis) : ''}</div><small>${s.text}</small></div>`).join('');
    const groups = new Map();
    for (const [id, pays] of Object.entries(g.pays)) {
      const k = JSON.stringify(pays);
      groups.set(k, [...(groups.get(k) || []), Number(id)]);
    }
    const regular = [...groups.entries()].sort((a, b) => Math.max(...JSON.parse(b[0])) - Math.max(...JSON.parse(a[0])))
      .map(([k, ids]) => `<div class="gd-gd-pay${ids.length >= 3 ? ' wide' : ''}"><div class="icons">${ids.map((id) => symImg(g, id)).join('')}</div><div class="odds">${payRows(g, JSON.parse(k))}</div></div>`).join('');
    return special + regular;
  }

  function render() {
    const list = GUIDE_CATS[cat].list;
    const g = list[page];
    if (!(g.key + ':map' in skins)) loadSkin(g.key).then((map) => { skins[g.key + ':map'] = map; if (map && list[page] === g) render(); });
    const total = g.betX;
    const range = `${num(LINE_BETS[0] * total)}～${num(LINE_BETS[1] * total)}`;
    const free = g.features[0];
    const video = (v) => `<div class="gd-gd-video">${v.src ? `<video src="${esc(v.src)}" controls playsinline preload="metadata"></video>` : '<div class="ph"><b>▶</b>影片準備中</div>'}<footer><span>${esc(v.title)}</span><small>${esc(g.name)}</small></footer></div>`;
    const icon = (f) => (f.sym !== undefined ? symImg(g, f.sym) : `<span>${f.icon}</span>`);
    panel.innerHTML = `<div class="gd-gd">
      <nav class="gd-gd-cats">${GUIDE_CATS.map((c, i) => `<button data-gd-cat="${i}" class="${i === cat ? 'on' : ''}">${esc(c.name)}</button>`).join('')}</nav>
      <nav class="gd-gd-strip">${list.map((x, i) => `<button data-gd-page="${i}" class="${i === page ? 'on' : ''}"><i>${i + 1}</i><img src="${esc(thumb(x.name))}" alt="" loading="lazy">${esc(x.name)}</button>`).join('')}</nav>
      <section class="gd-gd-hero"><img src="${esc(thumb(g.name))}" alt=""><div><div class="gd-gd-label">${esc(GUIDE_CATS[cat].name)} · ${page + 1} / ${list.length}</div><h2>${esc(g.name)}<small>${esc(g.tagline)}</small></h2><p>${esc(g.intro)}</p></div><div class="gd-gd-chips">${g.chips.map((c) => `<span>${esc(c)}</span>`).join('')}<span>總押注 ${range}</span></div></section>
      <section class="gd-gd-videos">${g.videos.map(video).join('')}</section>
      <div class="gd-gd-cta"><button class="gd-gd-play" data-gd-play>立即遊玩 →</button><button class="gd-gd-link" data-gd-jump="pays">看派彩表</button></div>
      <section class="gd-gd-sec"><h3><small>三步上手</small>從押注到${esc(free.title)}</h3><div class="gd-gd-steps">
        <div class="gd-gd-step"><i>1</i><b>設定押注</b><p>每線押注 ${LINE_BETS[0]}～${LINE_BETS[1]}，${g.ways ? `243 WAYS 總押注為 ${total} 倍` : `${total} 條線全開`}，總押注 ${range}。</p></div>
        <div class="gd-gd-step"><i>2</i><b>按下旋轉</b><p>${g.ways ? '從第 1 輪起，相鄰轉輪出現相同符號即得獎，不必在同一條線上。' : `由最左輪起，${total} 條連線上出現相同符號即得獎。`}也可設定自動 10～200 轉。</p></div>
        <div class="gd-gd-step"><i>3</i><b>觸發${esc(free.title)}</b><p>${free.text}</p></div>
      </div></section>
      <section class="gd-gd-sec"><h3><small>遊戲特色</small>讓贏分翻倍的關鍵</h3><div class="gd-gd-feats">${g.features.map((f) => `<div class="gd-gd-feat">${icon(f)}<div><b>${esc(f.title)}</b><p>${f.text}</p></div></div>`).join('')}</div></section>
      <section class="gd-gd-sec" data-gd-sec="pays"><h3><small>派彩表</small>符號賠率</h3><p class="gd-gd-hint">${g.ways ? `以押注 ${total} 計算。` : '賠率 × 每線押注；分散獎賞 × 總押注。'}</p><div class="gd-gd-pays">${paytable(g)}</div></section>
      <section class="gd-gd-sec"><h3><small>小提示</small>玩之前先知道</h3><ul class="gd-gd-tips">${g.tips.map((t) => `<li>${esc(t)}</li>`).join('')}<li>如遇程式故障，所有遊戲及派彩一律作廢。</li></ul></section>
      <nav class="gd-gd-pager"><button data-gd-step="-1" ${page === 0 ? 'disabled' : ''}>‹ ${page > 0 ? esc(list[page - 1].name) : '上一款'}</button><span>${page + 1} / ${list.length}</span><button data-gd-step="1" ${page === list.length - 1 ? 'disabled' : ''}>${page < list.length - 1 ? esc(list[page + 1].name) : '下一款'} ›</button></nav>
    </div>`;
    const go = (p) => { page = Math.max(0, Math.min(list.length - 1, p)); render(); panel.scrollTop = 0; $('.gd-gd-strip .on', panel)?.scrollIntoView({ block: 'nearest', inline: 'center' }); };
    $$('[data-gd-cat]', panel).forEach((b) => (b.onclick = () => { cat = Number(b.dataset.gdCat); page = 0; render(); }));
    $$('[data-gd-page]', panel).forEach((b) => (b.onclick = () => go(Number(b.dataset.gdPage))));
    $$('[data-gd-step]', panel).forEach((b) => (b.onclick = () => go(page + Number(b.dataset.gdStep))));
    $('[data-gd-jump]', panel).onclick = () => $('[data-gd-sec="pays"]', panel).scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('[data-gd-play]', panel).onclick = () => {
      const tile = typeof catalog !== 'undefined' && catalog.find((x) => x[0] === g.name);
      if (!tile || typeof openGame !== 'function') return;
      $('#activityLayer').hidden = true;
      openGame(tile);
    };
  }

  // 左右滑動換頁（手機）
  let touchX = null, touchY = 0;
  panel.addEventListener('touchstart', (e) => { if (e.target.closest('.gd-gd-strip,video')) return; touchX = e.touches[0].clientX; touchY = e.touches[0].clientY; }, { passive: true });
  panel.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX, dy = e.changedTouches[0].clientY - touchY;
    touchX = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) $(`[data-gd-step="${dx < 0 ? 1 : -1}"]`, panel)?.click();
  });

  render();
})();
