/* 獎勵中心「遊戲介紹」分頁：每款遊戲一頁（分頁切換），頁首兩格影片，接著玩法步驟、特色、派彩表／規則表、小提示。
 * 這支檔案不在大廳開啟時載入：第一次點「遊戲介紹」才由 index.html 載入（見 loadGuide），影片也要按播放才下載。
 * 數值照 GD_Slots 引擎設定（apps/worker slotConfig）：線數、押注倍數、免費遊戲場數與倍數、派彩表。
 * 影片：9:16（720×1280）。在 videos 的 src 填網址就會顯示播放器（poster 封面、dur 時長可省），沒填顯示「影片準備中」。 */
(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const num = (n) => Number(n).toLocaleString('en-US');

  // 符號圖取自 SLOTS 的 skin.json（gdclub.cc 同網址；本機預覽讀 dev）。各環境檔名不同，所以讀 skin.json，讀不到才用下面 syms 的預設檔名
  const SLOTS_BASE = /(^|\.)gdclub\.cc$/.test(location.hostname) ? '/slots' : 'https://dev.gdclub.cc/slots';
  const skins = {};
  const loadSkin = (key) => (skins[key] ??= fetch(`${SLOTS_BASE}/skins/${key}/skin.json`).then((r) => (r.ok ? r.json() : null)).then((j) => j?.symbols || null).catch(() => null));
  // 影片與封面放在 GD_Slots 的靜態檔（packages/client/public/guide/ → /slots/guide/）：/slots/* 直接由 static assets 回應，
  // 不經閘道 Worker、不算每日請求額度（大廳 Pages 的檔案每個請求都經過閘道，影片的分段請求也會一直算）
  const GUIDE_MEDIA = `${SLOTS_BASE}/guide`;
  // SHA 平台共用的公平性驗證頁（SHA repo apps/fairness-ui）。目前部署的是開發測試站；正式站有了改這一行。
  // 已接上回合驗證的遊戲在 fair.id 填 game_id（網址只預填遊戲，不帶種子或下注資料）。
  const FAIRNESS_URL = 'https://sha-fairness-dev.pages.dev/';
  // GD獨家共用的公平性說明影片：SHA-256、與區塊鏈相同原理、驗證頁示範
  const FAIRNESS_VIDEO = { title: 'SHA 公平性驗證', src: `${GUIDE_MEDIA}/fairness/sha.mp4`, poster: `${GUIDE_MEDIA}/fairness/sha.jpg`, dur: '58 秒' };
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
      videos: [
        { title: '重大獎', src: `${GUIDE_MEDIA}/gof-bigwin.mp4`, poster: `${GUIDE_MEDIA}/gof-bigwin.jpg`, dur: '13 秒' },
        { title: '購買免費遊戲', src: `${GUIDE_MEDIA}/gof-buy-feature.mp4`, poster: `${GUIDE_MEDIA}/gof-buy-feature.jpg`, dur: '52 秒' },
      ],
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

  /**
   * GD獨家：玩法各不相同，每款自己寫三步（steps）與規則表（table：cols 表頭、rows 每列；格子可用 {img} 放圖）。
   * 數值照各遊戲程式：小瑪莉 LittleMary/index.html 的 PAYS／DEFAULTS、黑粒仔 PaiGowTiles、六子骰 Dice、全壘打 HomeRun/js/derby.js、
   * 沖高高 Crash、寶石探險 MINES、珠珠寶貝 Plinko/js/engine.js。
   */
  const LM = (id) => ({ img: `LittleMary/img/${id}.webp` });
  const LM_PAYS = [['bar', 'BAR', 50], ['seven', '雙七', 40], ['star', '雙金星', 30], ['watermelon', '西瓜', 20], ['bell', '鈴鐺', 20], ['melon', '香瓜', 15], ['orange', '橘子', 10], ['apple', '蘋果', 5], ['grape', '葡萄', 2]];
  const lmTable = (extra = []) => ({ title: '符號賠率', hint: '派彩 = 該符號押注 × 倍率（含本金）。', cols: ['符號', '倍率'], rows: [...LM_PAYS.map(([id, n, x]) => [LM(id), n, `×${x}`]), ...extra].map(([ic, n, v]) => [{ ...ic, label: n }, v]) });
  const LM_STEPS = (third) => [
    { t: '選面額', p: '面額 1、5、10、20、100、500，點一下面額再點符號，同一個符號可以一直加注。' },
    { t: '押符號', p: '9 個符號可以押一個或多個，下方會顯示每個符號的押注；按「清除」重押。' },
    { t: '按啟動', p: third },
  ];
  const VIDEOS = [{ title: '快速上手', src: '' }, { title: '大獎實錄', src: '' }];
  const EXCLUSIVE_GUIDES = [
    {
      name: '傳統小瑪莉', fair: { how: '每局結果由伺服器以 SHA-256 決定，開局前先公布種子雜湊；遊戲右上「?」可看規則與最近結果。' }, tagline: '經典跑燈・一燈定輸贏',
      intro: '懷舊小瑪莉機台：押好水果與 BAR，按下啟動後單燈繞著 24 格跑，停在哪個符號就派彩。停到 ONCE MORE 還能免費再開一次。',
      chips: ['24 格跑燈', '9 種符號', '最高 ×50', '自動投注'],
      steps: LM_STEPS('單燈沿 24 格移動，停在有押的符號就依倍率派彩（含本金）；也可以自動投注 5～50 場。'),
      features: [
        { ...LM('bar'), title: 'BAR ×50', text: '最高倍率符號，押中一次 <em>50 倍</em>。' },
        { icon: '🔁', title: 'ONCE MORE', text: '盤面上 2 格 ONCE MORE，停到就<em>免費再開一次</em>，不重複扣押注。' },
        { icon: '🤖', title: '自動投注', text: '照目前的押注配置連開 <em>5／10／20／50</em> 場。' },
      ],
      table: lmTable(),
      tips: ['葡萄最常出但 ×2，BAR 少出但 ×50；可以同時押好幾個符號分散。', '結果由伺服器以 SHA-256 決定，開局前先公布種子的雜湊。'],
      videos: VIDEOS,
    },
    {
      name: '魔幻列車', fair: { how: '每局結果由伺服器以 SHA-256 決定，開局前先公布種子雜湊；遊戲右上「?」可看規則與最近結果。' }, tagline: '列車進站・多燈齊發',
      intro: '小瑪莉的列車版本：除了一般跑燈派彩，停在魔幻車頭、+3、+5 會開出魔幻列車，車身蓋到的每一格只要有押都一起派彩。',
      chips: ['24 格跑燈', '魔幻列車', '多燈同時派彩'],
      steps: LM_STEPS('停在符號格依倍率派彩；停在魔幻車頭、+3、+5 開出列車，車身蓋到的有押符號全部派彩。'),
      features: [
        { ...LM('train-head'), title: '魔幻車頭', text: '盤面 3 個車頭，停到開出 <em>3～5 節</em>的魔幻列車。' },
        { ...LM('train-plus3'), title: '+3 車廂', text: '直接開出三節列車。' },
        { ...LM('train-plus5'), title: '+5 車廂', text: '直接開出五節列車，蓋到的格子最多。' },
      ],
      table: lmTable([[LM('train-head'), '魔幻車頭', '開出 3–5 節列車'], [LM('train-plus3'), '+3', '開出 3 節列車'], [LM('train-plus5'), '+5', '開出 5 節列車']]),
      tips: ['列車蓋到的格子才派彩，所以押越多種符號，列車進站時越容易一次中好幾個。'],
      videos: VIDEOS,
    },
    {
      name: '皇冠列車', fair: { how: '每局結果由伺服器以 SHA-256 決定，開局前先公布種子雜湊；遊戲右上「?」可看規則與最近結果。' }, tagline: '皇冠啟程・JP ×500',
      intro: '小瑪莉的皇冠版本：停在皇冠開出 5 站免費列車，沿途符號派彩與 JP 一路累計，最後再乘上沿途遇到的最高倍率；停在 GRAND JP 直接派總押注 ×500。',
      chips: ['24 格跑燈', '5 站皇冠列車', 'GRAND JP ×500'],
      steps: LM_STEPS('停在符號格依倍率派彩；停在皇冠開出 5 站免費列車；停在 GRAND JP 派總押注 ×500。'),
      features: [
        { ...LM('crown-bonus'), title: '皇冠列車', text: '盤面 3 個皇冠，停到開出 <em>5 站</em>免費列車，沿途派彩累計。' },
        { icon: '✖️', title: '倍率站 ×2／×3／×5', text: '列車經過倍率站，最後總派彩乘上<em>沿途最高倍率</em>。直接停在倍率站不派彩。' },
        { ...LM('crown-jp'), title: 'GRAND JP', text: '停到 JP 派<em>本局總押注 ×500</em>，列車途中遇到 JP 也算。' },
      ],
      table: lmTable([[LM('crown-bonus'), '皇冠', '開出 5 站免費列車'], [LM('crown-jp'), 'GRAND JP', '總押注 ×500'], [{ icon: '✖️' }, '倍率站', '列車中 ×2／×3／×5']]),
      tips: ['倍率站只在皇冠列車裡生效；列車沿途遇到 ×5，整趟派彩就 ×5。'],
      videos: VIDEOS,
    },
    {
      name: '黑粒仔', fair: { how: '桌面右下「公平性」：查看本副牌與下一副牌的種子雜湊；這副牌打完會公開種子並顯示比對結果。' }, media: 'paigow', tagline: '台灣推牌九・五秒一局',
      intro: '台灣民間的推牌九：一莊三門，每家 4 張骨牌自動配成前、後兩對，跟莊家比大小。不用記牌、不用出牌，發完就翻開，一局約 5 秒。',
      chips: ['一莊三門', '壓一賠一不抽水', '一副牌打兩局'],
      steps: [
        { t: '押門', p: '押初門、川門、尾門其中一門或多門（直接點桌上的門也可以），每門同樣金額。' },
        { t: '自動配牌', p: '莊家與三門各拿 4 張，自動配成前對（小）與後對（大），取前對最大的配法。' },
        { t: '比大小', p: '前對比前對、後對比後對：兩對都贏派 1 賠 1，一勝一負退本金，兩對都輸輸掉押注。' },
      ],
      features: [
        { icon: '🀄', title: '至尊寶最大', text: '丁三＋二四為<em>至尊寶</em>，接著雙天、雙地、雙人……對子，再來天王、地王、天槓、地槓與點數。' },
        { icon: '⚖️', title: '同點莊吃', text: '兩對一樣大算莊家贏，鱉十遇鱉十也是莊家贏。' },
        { icon: '👑', title: '上莊', text: 'VIP 與錢包符合時可以<em>自己當莊</em>，吃三門的注、賠三門的贏。' },
      ],
      table: { title: '單門結果', hint: '每門獨立和莊家比，押幾門都不影響每門的期望值。', cols: ['結果', '條件', '派彩', '機率'], rows: [['贏', '前後兩對都贏', '1 賠 1（押 10 拿回 20）', '36.52%'], ['走', '一勝一負', '退回本金', '26.27%'], ['輸', '兩對都輸', '0', '37.21%']] },
      tips: ['點數 = 兩張相加取個位數；同點比兩張中較大的一張。', '至尊兩張不成對時可當 3 或 6 點，自動取大。', '莊家三門全贏顯示「通殺」，全輸顯示「通賠」。'],
      videos: [
        { title: '快速上手', src: `${GUIDE_MEDIA}/paigow/guide-a.mp4?v=3`, poster: `${GUIDE_MEDIA}/paigow/guide-a.jpg?v=3`, dur: '32 秒' },
        { title: '比牌規則', src: `${GUIDE_MEDIA}/paigow/guide-b.mp4?v=3`, poster: `${GUIDE_MEDIA}/paigow/guide-b.jpg?v=3`, dur: '48 秒' },
      ],
    },
    {
      name: '六子骰', fair: { how: '遊戲內「公平性」：查看每一局的種子與比對結果；客戶種子可以自己換。' }, media: 'dice', tagline: '一到六顆・押你想的點',
      intro: '實體骰子玩法：選 1～6 顆骰子，押總點數、某個點數出現幾顆，或豹子。下注前就看得到勝率、倍數與可贏派彩。',
      chips: ['1～6 顆骰子', '三種玩法', '下注前看勝率'],
      steps: [
        { t: '選骰子數', p: '1～6 顆，骰子越多，總點數的分布越集中。' },
        { t: '選玩法與目標', p: '總點數（剛好／以上／以下）、指定點數出現幾顆、豹子；點分布圖的長條可直接選目標。' },
        { t: '擲骰', p: '贏了派彩 = 下注 × 倍數，輸了失去下注；也可設定自動投注。' },
      ],
      features: [
        { icon: '📊', title: '分布圖', text: '每種結果一根長條，越高越常開出，<em>綠色 = 會贏</em>。' },
        { icon: '🎯', title: '勝率越低倍數越高', text: '下注前就顯示勝率與倍數，穩穩拿或拼大倍數自己選。' },
        { icon: '🐆', title: '豹子', text: '所有骰子同點；可押任意豹子或指定點數（2 顆骰以上）。' },
      ],
      table: { title: '押法範例（3 顆骰）', hint: '勝率超過 97% 的押法不開放（倍數會低於 1.01×）。', cols: ['玩法', '押法', '勝率', '倍數'], rows: [['總點數', '總點 ≥ 11（大）', '50%', '1.96×'], ['指定點數', '至少 1 個 6', '42.13%', '2.33×'], ['豹子', '任意豹子', '2.78%', '35.28×']] },
      tips: ['紅色的 1 點與 4 點是傳統骰子的樣式。', '每一局都可以在「公平性」查看種子與比對結果。'],
      videos: [
        { title: '快速上手', src: `${GUIDE_MEDIA}/dice/guide-a.mp4`, poster: `${GUIDE_MEDIA}/dice/guide-a.jpg`, dur: '25 秒' },
        { title: '三種玩法', src: `${GUIDE_MEDIA}/dice/guide-b.mp4`, poster: `${GUIDE_MEDIA}/dice/guide-b.jpg`, dur: '38 秒' },
      ],
    },
    {
      name: '全壘打', fair: { how: '遊戲內「公平性驗證」：查看每一球的種子與比對結果。' }, media: 'homerun', tagline: '十球競賽・猜全壘打支數',
      intro: '全壘打競賽：一局打 10 球，每球都有 40% 機率飛出全壘打牆。開打前猜這局會打出幾支全壘打，猜中依倍數派彩，最高 2,000 倍。',
      chips: ['一局 10 球', '猜全壘打支數', '最高 ×2,000'],
      steps: [
        { t: '下注', p: '每注 10～100，以 10 為單位。' },
        { t: '猜支數', p: '選「剛好 k 支」「k 支以上」「k 支以下」（k = 0～10），倍數馬上顯示。' },
        { t: '開打', p: '10 球依序打出，全壘打支數符合就派彩；猜中機率超過 97% 的選項不開放。' },
      ],
      features: [
        { icon: '⚾', title: '每球 40%', text: '每一球獨立判定，<em>40%</em> 機率是全壘打。' },
        { icon: '💥', title: '剛好 10 支 ×2,000', text: '最難的押法，十球全部飛出牆外。' },
        { icon: '🏟️', title: '飛出全壘打牆', text: '飛過牆就是一支，牆距依方向 <em>110～122 公尺</em>。' },
      ],
      table: { title: '「剛好 k 支」倍數', hint: '倍數無條件捨去到小數兩位；「以上／以下」的倍數在遊戲內的表格。', cols: ['支數', '機率', '倍數'], rows: [['0', '0.60%', '162.90×'], ['1', '4.03%', '24.43×'], ['2', '12.09%', '8.14×'], ['3', '21.50%', '4.58×'], ['4', '25.08%', '3.92×'], ['5', '20.07%', '4.90×'], ['6', '11.15%', '8.83×'], ['7', '4.25%', '23.19×'], ['8', '1.06%', '92.77×'], ['9', '0.16%', '626.24×'], ['10', '0.01%', '2,000×']] },
      tips: ['最常見的是 3～5 支；押「4 支以上」約 1.59×，勝率約六成。', '每一球都可以在「公平性驗證」查看種子與比對結果。'],
      videos: [
        { title: '快速上手', src: `${GUIDE_MEDIA}/homerun/guide-a.mp4`, poster: `${GUIDE_MEDIA}/homerun/guide-a.jpg`, dur: '38 秒' },
        { title: '三種押法', src: `${GUIDE_MEDIA}/homerun/guide-b.mp4`, poster: `${GUIDE_MEDIA}/homerun/guide-b.jpg`, dur: '42 秒' },
      ],
    },
    {
      name: '沖高高', fair: { id: 'crash', how: '遊戲內「驗證本局」：開局前公布種子雜湊，爆掉後公布種子並顯示比對結果。' }, media: 'crash', tagline: '倍數狂飆・見好就收',
      intro: '多人同時下注的倍數遊戲：火箭起飛後倍數一路往上沖，隨時可以兌現拿走目前倍數；來不及兌現就跟著爆掉。',
      chips: ['多人同局', '隨時兌現', '自動兌現'],
      steps: [
        { t: '下注', p: '每局有 7 秒下注時間；可先設定「自動兌現倍數」。' },
        { t: '倍數上升', p: '起飛後倍數從 1.00× 開始往上沖，約 10 秒 1.82×、20 秒 3.32×、30 秒 6.05×。' },
        { t: '兌現', p: '在爆掉前按「兌現」，派彩 = 下注 × 兌現倍數；沒兌現就輸掉這注。' },
      ],
      features: [
        { icon: '🚀', title: '自動兌現', text: '設定目標倍數，到了<em>自動兌現</em>，不怕手慢。' },
        { icon: '👥', title: '多人同局', text: '看得到其他玩家下注與兌現，一起拼誰收得漂亮。' },
        { icon: '💥', title: '說爆就爆', text: '倍數隨時可能爆掉，畫面立刻顯示爆掉的倍數；<em>沒兌現的注就輸了</em>。' },
      ],
      table: { title: '倍數與時間', hint: '爆掉點的中位數約 1.98×，約 10% 機率衝到 10× 以上。', cols: ['起飛後', '倍數'], rows: [['10 秒', '1.82×'], ['20 秒', '3.32×'], ['30 秒', '6.05×'], ['約 38 秒', '10×']] },
      tips: ['想穩就設低一點的自動兌現；想衝大倍數就要接受多數局會爆掉。', '開局前公布種子雜湊，爆掉後公布種子，「驗證本局」會顯示比對結果。'],
      videos: [
        { title: '快速上手', src: `${GUIDE_MEDIA}/crash/guide-a.mp4`, poster: `${GUIDE_MEDIA}/crash/guide-a.jpg`, dur: '44 秒' },
        { title: '自動兌現', src: `${GUIDE_MEDIA}/crash/guide-b.mp4`, poster: `${GUIDE_MEDIA}/crash/guide-b.jpg`, dur: '48 秒' },
      ],
    },
    {
      name: '寶石探險', fair: { id: 'mines', how: '遊戲內「驗證本局」：查看地雷位置的種子與比對結果；「公平性設定」可以換客戶種子。' }, media: 'mines', tagline: '翻寶石・避地雷',
      intro: '5×5 共 25 格，藏著你選的地雷數量，其餘都是寶石。每翻開一顆寶石倍數就往上加，隨時可以兌現；翻到地雷就輸掉這局。',
      chips: ['5 × 5 盤面', '地雷 1～24 顆', '隨時兌現'],
      steps: [
        { t: '下注選雷數', p: '選下注金額與地雷數（1～24），按「下注」。' },
        { t: '翻格子', p: '每翻開一顆寶石倍數上升；也可以「隨機翻一格」。翻到地雷本局輸掉下注。' },
        { t: '兌現', p: '翻開至少一格後可隨時兌現，派彩 = 下注 × 目前倍數；寶石全翻完自動兌現。' },
      ],
      features: [
        { icon: '💎', title: '翻寶石', text: '每翻開一顆寶石，<em>倍數就往上加</em>；翻到地雷本局輸掉。' },
        { icon: '📈', title: '倍數階梯', text: '畫面上隨時顯示下一格的勝率與倍數。' },
        { icon: '💰', title: '隨時兌現', text: '翻開至少一格後就能兌現，派彩 = 下注 × 目前倍數。' },
      ],
      table: { title: '倍數表（括號為勝率）', hint: '雷越多、翻越多格，倍數越高，翻中的機率也越低。', cols: ['地雷', '翻 1 格', '翻 3 格', '翻 5 格'], rows: [['1', '1.02×（96%）', '1.11×（88%）', '1.22×（80%）'], ['3', '1.11×（88%）', '1.46×（67%）', '1.98×（50%）'], ['5', '1.22×（80%）', '1.98×（50%）', '3.36×（29%）'], ['24', '24.50×（4%）', '—', '—']] },
      tips: ['想穩就少雷少翻；想拼大倍數就多雷，24 顆雷只翻 1 格就是 24.50×。', '自動模式可以預選要翻的格子，設定局數與停利停損。'],
      videos: VIDEOS,
    },
    {
      name: '珠珠寶貝', fair: { id: 'plinko', how: '遊戲內「驗證本局」：查看彈珠路徑的種子與比對結果。' }, media: 'plinko', tagline: '彈珠落下・倍數開獎',
      intro: '彈珠從頂端落下，一路撞釘子左右彈跳，最後掉進底部的倍數格。越靠邊的格子倍數越高，可以自己選排數與風險。',
      chips: ['8～16 排', '低／中／高風險', '最高 ×1,000', '可連續投注'],
      steps: [
        { t: '選排數與風險', p: '排數 8～16，風險低、中、高；倍數格會跟著變。' },
        { t: '下注', p: '設定下注金額與投注次數，一次可以放好幾顆彈珠。' },
        { t: '看落點', p: '彈珠掉進哪一格就派彩 = 下注 × 該格倍數。' },
      ],
      features: [
        { icon: '⚪', title: '邊格倍數最高', text: '高風險 16 排，兩側邊格 <em>1,000×</em>。' },
        { icon: '🎚️', title: '多顆同時落下', text: '連續投注，<em>好幾顆彈珠</em>同時在盤面上彈跳。' },
        { icon: '🔍', title: '最近落點', text: '右上角列出最近幾顆的倍數；落點由平台決定，動畫只是呈現。' },
      ],
      table: { title: '邊格最高倍數', hint: '中間格倍數最低，越往兩側越高。', cols: ['排數', '低風險', '中風險', '高風險'], rows: [['8', '5.6×', '13×', '29×'], ['12', '10×', '33×', '170×'], ['16', '16×', '110×', '1,000×']] },
      tips: ['排數越多，彈珠越容易落在中間，邊格越難但倍數越高。', '低風險中間格也常回本；高風險中間格只有 0.2×，賭邊格。'],
      videos: VIDEOS,
    },
  ];

  // 分類：GD獨家在老虎機左邊
  const GUIDE_CATS = [{ key: 'exclusive', name: 'GD獨家', list: EXCLUSIVE_GUIDES }, { key: 'slots', name: '老虎機', list: SLOT_GUIDES }];

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
    .gd-gd-strip button.on{border-color:var(--gd-pink);color:#fff;box-shadow:0 0 10px #ff3d9e66}
    .gd-gd-hero{display:grid;grid-template-columns:120px minmax(0,1fr);gap:14px;align-items:center;padding:14px;border-radius:18px;border:1px solid #35406d;background:radial-gradient(circle at 85% 10%,#783dff44,transparent 55%),linear-gradient(135deg,#1c2557,#121a40)}
    .gd-gd-hero>img{width:120px;height:120px;border-radius:18px;object-fit:cover;box-shadow:0 6px 18px #0008}
    .gd-gd-label{color:var(--gd-pink);font-size:12px;font-weight:900;letter-spacing:.08em}
    .gd-gd-hero h2{margin:2px 0 4px;font-size:26px;line-height:1.15;color:#fff}
    .gd-gd-hero h2 small{display:block;font-size:14px;color:var(--gd-gold);margin-top:4px}
    .gd-gd-hero p{margin:6px 0 0;color:#cfd5f5;font-size:13px;line-height:1.65}
    .gd-gd-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;grid-column:1/-1}
    .gd-gd-chips span{border:1px solid #35406d;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:900;color:#d6dcff;background:#0d1430}
    .gd-gd-videos{display:grid;grid-template-columns:repeat(2,minmax(0,240px));justify-content:center;gap:12px}
    .gd-gd-video{border-radius:14px;overflow:hidden;border:1px solid #35406d;background:#0b1026}
    .gd-gd-video video,.gd-gd-video .ph{display:block;width:100%;height:auto;aspect-ratio:9/16;object-fit:cover;background:#05081a}
    .gd-gd-vbox{aspect-ratio:9/16;background:#05081a}
    .gd-gd-vbox video{object-fit:contain}
    .gd-gd-zoomback{position:fixed;inset:0;z-index:1000;background:#000c;opacity:0;transition:opacity .3s}
    .gd-gd-zoomback.on{opacity:1}
    .gd-gd-zoomclose{position:fixed;top:max(12px,env(safe-area-inset-top));right:12px;z-index:1002;width:42px;height:42px;border:2px solid #ffffff66;border-radius:50%;background:#000a;color:#fff;font-size:26px;line-height:1;cursor:pointer;opacity:0;transition:opacity .3s}
    .gd-gd-zoomclose.on{opacity:1}
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
    .gd-gd-shot{display:block;width:100%;height:150px;object-fit:contain;background:#0b1026;border-radius:10px;margin-bottom:8px}
    .gd-gd-feat.has-shot{grid-template-columns:1fr;gap:0}
    .gd-gd-feat.has-shot>img.gd-gd-shot{width:100%;height:110px;object-fit:contain;background:#0b1026;border-radius:10px;display:block}
    .gd-gd-fairchip{margin-left:auto;display:inline-flex;align-items:center;border:1px solid #3fbf7f;border-radius:999px;padding:6px 14px;color:#7ff0c4;background:#0d2a22;font-weight:900;text-decoration:none;font-size:14px}
    .gd-gd-fair{border-radius:14px;padding:12px;background:linear-gradient(135deg,#0f2a24,#121a40);border:1px solid #2f6b55;display:grid;grid-template-columns:200px minmax(0,1fr);gap:14px;align-items:start}
    .gd-gd-fairtext{display:grid;gap:8px}
    @media (max-width:520px){.gd-gd-fair{grid-template-columns:1fr}.gd-gd-fairvid{width:min(220px,70%);justify-self:center}}
    .gd-gd-fair p{margin:0;color:#d6dcff;font-size:13px;line-height:1.7}
    .gd-gd-fair p.how{color:#bff3dc}
    .gd-gd-fair small{color:#8d97c7;font-size:12px}
    .gd-gd-fairbtn{justify-self:start;border-radius:999px;padding:9px 18px;background:linear-gradient(180deg,#5ef0a8,#22b874);color:#05301c;font-weight:900;text-decoration:none}
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
    .gd-gd-table{overflow-x:auto;border-radius:12px;border:1px solid var(--gd-line)}
    .gd-gd-table table{width:100%;border-collapse:collapse;font-size:13px;min-width:280px}
    .gd-gd-table th{background:#111838;color:var(--gd-gold);font-weight:900;text-align:left;padding:8px 10px;white-space:nowrap}
    .gd-gd-table td{padding:7px 10px;border-top:1px solid var(--gd-line);color:#d6dcff;background:#151b3d}
    .gd-gd-table td img{width:34px;height:34px;object-fit:contain;display:block}
    .gd-gd-table td .sym{display:flex;align-items:center;gap:10px;font-weight:900;color:#fff}
    .gd-gd-table td .ic{font-size:22px}
    .gd-gd-table tbody tr:nth-child(even) td{background:#121838}
    @media (max-width:520px){
      .gd-gd-hero{grid-template-columns:84px minmax(0,1fr)}.gd-gd-hero>img{width:84px;height:84px}.gd-gd-hero h2{font-size:21px}
      .gd-gd-videos{gap:8px}.gd-gd-steps{grid-template-columns:1fr}
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

  // 老虎機的三步由數值產生；GD獨家每款自己寫 steps
  const slotSteps = (g) => {
    const total = g.betX, range = `${num(LINE_BETS[0] * total)}～${num(LINE_BETS[1] * total)}`, free = g.features[0];
    return [
      { t: '設定押注', p: `每線押注 ${LINE_BETS[0]}～${LINE_BETS[1]}，${g.ways ? `243 WAYS 總押注為 ${total} 倍` : `${total} 條線全開`}，總押注 ${range}。` },
      { t: '按下旋轉', p: `${g.ways ? '從第 1 輪起，相鄰轉輪出現相同符號即得獎，不必在同一條線上。' : `由最左輪起，${total} 條連線上出現相同符號即得獎。`}也可設定自動 10～200 轉。` },
      { t: `觸發${free.title}`, p: free.text, html: true },
    ];
  };
  // GD獨家的真實畫面（遊戲實際截圖與動態圖，放在 /slots/guide/<media>/，不經閘道）
  const shot = (g, n) => (g.media ? `<img class="gd-gd-shot" src="${GUIDE_MEDIA}/${g.media}/${n}.webp" alt="" loading="lazy">` : '');
  const cell = (c) => (c && typeof c === 'object' ? `<span class="sym">${c.img ? `<img src="${esc(c.img)}" alt="" loading="lazy">` : `<span class="ic">${c.icon}</span>`}${c.label ? esc(c.label) : ''}</span>` : esc(c));
  const ruleTable = (t) => `<p class="gd-gd-hint">${esc(t.hint || '')}</p><div class="gd-gd-table"><table><thead><tr>${t.cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${t.rows.map((r) => `<tr>${r.map((c) => `<td>${cell(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

  /**
   * 影片放大：開始播放時從原本的小格放大到畫面中央（後面變暗），播完或按背景／× 縮回原位。
   * 背景與 × 放在獎勵中心那一層裡（同一個疊放層，影片才會在背景上面）；全部遊戲的影片都套用。
   */
  const zoom = { v: null, back: null, close: null, timer: 0 };
  const zoomTarget = () => {
    const h = Math.min(innerHeight * 0.9, (innerWidth - 24) * 16 / 9), w = h * 9 / 16;
    return { left: (innerWidth - w) / 2, top: (innerHeight - h) / 2, width: w, height: h };
  };
  const place = (v, r) => Object.assign(v.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  function zoomIn(v) {
    if (zoom.v === v) return;
    zoomOut(true);
    const host = panel.closest('.activity-layer') || document.body;
    const back = document.createElement('div'); back.className = 'gd-gd-zoomback';
    const close = document.createElement('button'); close.className = 'gd-gd-zoomclose'; close.type = 'button'; close.setAttribute('aria-label', '縮小影片'); close.textContent = '×';
    host.append(back, close);
    const r = v.getBoundingClientRect();
    Object.assign(v.style, { position: 'fixed', zIndex: 1001, margin: 0, transition: 'none', background: '#000', borderRadius: '14px' });
    place(v, r);
    v.getBoundingClientRect();
    requestAnimationFrame(() => {
      v.style.transition = 'left .3s ease, top .3s ease, width .3s ease, height .3s ease';
      place(v, zoomTarget());
      back.classList.add('on'); close.classList.add('on');
    });
    back.onclick = close.onclick = () => { v.pause(); zoomOut(); };
    Object.assign(zoom, { v, back, close });
  }
  function zoomOut(instant) {
    const { v, back, close } = zoom;
    if (!v) return;
    zoom.v = null;
    close.remove(); back.classList.remove('on');
    const done = () => { ['position', 'zIndex', 'margin', 'transition', 'left', 'top', 'width', 'height', 'background', 'borderRadius'].forEach((k) => (v.style[k] = '')); back.remove(); };
    if (instant || !v.isConnected) return done();
    place(v, v.parentElement.getBoundingClientRect());
    setTimeout(done, 320);
  }
  addEventListener('resize', () => { if (zoom.v) { zoom.v.style.transition = 'none'; place(zoom.v, zoomTarget()); } });

  function render() {
    const list = GUIDE_CATS[cat].list;
    const g = list[page];
    const slot = Boolean(g.syms);
    if (slot && !(g.key + ':map' in skins)) loadSkin(g.key).then((map) => { skins[g.key + ':map'] = map; if (map && list[page] === g) render(); });
    const chips = slot ? [...g.chips, `總押注 ${num(LINE_BETS[0] * g.betX)}～${num(LINE_BETS[1] * g.betX)}`] : g.chips;
    const steps = g.steps || slotSteps(g);
    const video = (v) => `<div class="gd-gd-video">${v.src ? `<div class="gd-gd-vbox"><video src="${esc(v.src)}"${v.poster ? ` poster="${esc(v.poster)}"` : ''} width="720" height="1280" controls playsinline preload="none"></video></div>` : '<div class="ph"><b>▶</b>影片準備中</div>'}<footer><span>${esc(v.title)}</span><small>${esc(v.dur || g.name)}</small></footer></div>`;
    const icon = (f) => (f.sym !== undefined ? symImg(g, f.sym) : f.img ? `<img src="${esc(f.img)}" alt="" loading="lazy">` : `<span>${f.icon}</span>`);
    panel.innerHTML = `<div class="gd-gd">
      <nav class="gd-gd-cats">${GUIDE_CATS.map((c, i) => `<button data-gd-cat="${i}" class="${i === cat ? 'on' : ''}">${esc(c.name)}</button>`).join('')}${GUIDE_CATS[cat].key === 'exclusive' ? `<a class="gd-gd-fairchip" href="${FAIRNESS_URL}" target="_blank" rel="noopener">🛡️ 公平性驗證</a>` : ''}</nav>
      <nav class="gd-gd-strip">${list.map((x, i) => `<button data-gd-page="${i}" class="${i === page ? 'on' : ''}"><img src="${esc(thumb(x.name))}" alt="" loading="lazy">${esc(x.name)}</button>`).join('')}</nav>
      <section class="gd-gd-hero"><img src="${esc(thumb(g.name))}" alt=""><div><div class="gd-gd-label">${esc(GUIDE_CATS[cat].name)} · ${page + 1} / ${list.length}</div><h2>${esc(g.name)}<small>${esc(g.tagline)}</small></h2><p>${esc(g.intro)}</p></div><div class="gd-gd-chips">${chips.map((c) => `<span>${esc(c)}</span>`).join('')}</div></section>
      <section class="gd-gd-videos">${g.videos.map(video).join('')}</section>
      <div class="gd-gd-cta"><button class="gd-gd-play" data-gd-play>立即遊玩 →</button><button class="gd-gd-link" data-gd-jump="pays">${slot ? '看派彩表' : '看規則表'}</button></div>
      <section class="gd-gd-sec"><h3><small>三步上手</small>${slot ? `從押注到${esc(g.features[0].title)}` : '照著做就會玩'}</h3><div class="gd-gd-steps">
        ${steps.map((s, i) => `<div class="gd-gd-step">${shot(g, `s${i + 1}`)}<i>${i + 1}</i><b>${esc(s.t)}</b><p>${s.html ? s.p : esc(s.p)}</p></div>`).join('')}
      </div></section>
      <section class="gd-gd-sec"><h3><small>遊戲特色</small>${slot ? '讓贏分翻倍的關鍵' : '這款好玩在哪'}</h3><div class="gd-gd-feats">${g.features.map((f, i) => (g.media ? `<div class="gd-gd-feat has-shot">${shot(g, `f${i + 1}`)}<div><b>${esc(f.title)}</b><p>${f.text}</p></div></div>` : `<div class="gd-gd-feat">${icon(f)}<div><b>${esc(f.title)}</b><p>${f.text}</p></div></div>`)).join('')}</div></section>
      ${slot
        ? `<section class="gd-gd-sec" data-gd-sec="pays"><h3><small>派彩表</small>符號賠率</h3><p class="gd-gd-hint">${g.ways ? `以押注 ${g.betX} 計算。` : '賠率 × 每線押注；分散獎賞 × 總押注。'}</p><div class="gd-gd-pays">${paytable(g)}</div></section>`
        : `<section class="gd-gd-sec" data-gd-sec="pays"><h3><small>規則表</small>${esc(g.table.title)}</h3>${ruleTable(g.table)}</section>`}
      ${g.fair ? `<section class="gd-gd-sec"><h3><small>公平性驗證</small>SHA-256 公開驗證</h3><div class="gd-gd-fair">
        <div class="gd-gd-fairvid">${video(FAIRNESS_VIDEO)}</div>
        <div class="gd-gd-fairtext">
          <p>GD獨家全部使用 SHA 平台同一套公平機制，<em>原理和區塊鏈相同</em>：開局前先公布伺服器種子的 SHA-256 雜湊（數位指紋），開獎後再公開種子。種子對得上開局前公布的指紋，就證明結果在下注前已經決定、事後沒有被更動。</p>
          <p>比對交給驗證頁完成，不需要自己計算。</p>
          <p class="how">🔍 ${esc(g.fair.how)}</p>
          <a class="gd-gd-fairbtn" href="${FAIRNESS_URL}${g.fair.id ? `?game_id=${g.fair.id}` : ''}" target="_blank" rel="noopener">開啟公平性驗證頁 ↗</a>
          ${g.fair.id ? '' : '<small>這款的回合驗證頁接入中，驗證頁可先看教學範例；遊戲內已可查看。</small>'}
        </div>
      </div></section>` : ''}
      <section class="gd-gd-sec"><h3><small>小提示</small>玩之前先知道</h3><ul class="gd-gd-tips">${g.tips.map((t) => `<li>${esc(t)}</li>`).join('')}<li>如遇程式故障，所有遊戲及派彩一律作廢。</li></ul></section>
      <nav class="gd-gd-pager"><button data-gd-step="-1" ${page === 0 ? 'disabled' : ''}>‹ ${page > 0 ? esc(list[page - 1].name) : '上一款'}</button><span>${page + 1} / ${list.length}</span><button data-gd-step="1" ${page === list.length - 1 ? 'disabled' : ''}>${page < list.length - 1 ? esc(list[page + 1].name) : '下一款'} ›</button></nav>
    </div>`;
    const go = (p) => { page = Math.max(0, Math.min(list.length - 1, p)); render(); panel.scrollTop = 0; $('.gd-gd-strip .on', panel)?.scrollIntoView({ block: 'nearest', inline: 'center' }); };
    zoomOut(true);
    // 播一段時暫停另一段；開始播就放大，播完縮回
    $$('video', panel).forEach((v) => {
      v.addEventListener('play', () => { $$('video', panel).forEach((o) => o !== v && o.pause()); zoomIn(v); });
      v.addEventListener('ended', () => zoomOut());
    });
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

  // 關閉獎勵中心或切到其他分頁時停止播放
  const stopVideos = () => { if ($('#activityLayer')?.hidden || !panel.classList.contains('active')) { $$('video', panel).forEach((v) => v.pause()); zoomOut(true); } };
  const layer = $('#activityLayer');
  if (layer) new MutationObserver(stopVideos).observe(layer, { attributes: true, attributeFilter: ['hidden'] });
  new MutationObserver(stopVideos).observe(panel, { attributes: true, attributeFilter: ['class'] });

  render();
})();
