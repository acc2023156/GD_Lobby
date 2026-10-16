/* GD 卡冊與閃卡觀看器（大廳「個人」分頁，取代原本的紫色橫條）。
 * 寫法比照 music/gd-cd.js：純 JS、不用框架，掛在 window.GDCards；第一次打開個人分頁才載入，觀看器打開才建、關掉停止動畫。
 * - 卡冊：標題列＋已收集 X/Y＋總戰力＋進度條＋一排縮圖（水平捲動）。已收集點了開觀看器；未收集顯示 GD 卡背＋鎖頭，點了抖動＋提示。
 * - 觀看器：全螢幕；縮放 50–150%、左右 360° 拖曳（放手有慣性）、上下 ±80°、翻面、歸位、滑鼠懸停、陀螺儀（iOS 要按鈕授權）、11 種閃卡效果。
 * - 卡面：有 img（CDN 卡圖）就用圖；沒有就用遊戲圖示（icon）＋稀有度外框即時畫在 canvas 上，所以每款遊戲不用另外做卡圖。
 * - 卡背：所有卡共用；中間是正式 LOGO（gd-loading.js 同一份 Playfair Display Black 向量路徑：GD＋Club）。
 * 類名一律 gdc- 開頭、SVG 漸層 id 每份卡背各自加流水號，不會和大廳既有樣式衝突。
 * 用法：
 *   GDCards.mount(容器, cards, { onLocked })   // cards 由 GET /me/cards 回傳（見 CARD 欄位）
 *   GDCards.update(cards)                       // 收到新卡後重畫
 *   GDCards.open(cardId)                        // 直接開某張已收集的卡（例：剛抽到卡）
 *   GDCards.unmount()                           // 離開個人頁：拆掉 DOM 與所有事件
 * CARD：{ id, no, gameKey?, name, category, rarity, fx, power, owned, img?, thumb?, w?, h?, icon?, colors?:[c1,c2] }
 *   w／h：卡圖原始尺寸（預設 773×1024 直式）；w > h 為橫式卡，觀看器、縮圖、卡背都跟著改成橫式。thumb：卡冊縮圖（小圖）。
 *   未收集的卡後端只回 id／no／rarity／category（不回 name、icon、power）。
 */
(() => {
  'use strict';
  if (window.GDCards) return;

  /** 稀有度：7 階。戰鬥力區間由後端 card_rarities 決定，這裡只管顏色與名稱（後端也會回 rarityName，以後端為準）。 */
  const RARITY = {
    N:   { name: '普通',     frame: ['#e9edf5', '#8d97ab', '#e9edf5'], badge: ['#f4f6fa', '#9aa3b5'], ink: '#26303f' },
    R:   { name: '稀有',     frame: ['#bfe6ff', '#2f8fe0', '#bfe6ff'], badge: ['#d6efff', '#3b9cf0'], ink: '#062a4d' },
    SR:  { name: '超稀有',   frame: ['#ead4ff', '#8f47ff', '#ead4ff'], badge: ['#f0e0ff', '#a066ff'], ink: '#2a0a52' },
    SSR: { name: '特級稀有', frame: ['#fff3c4', '#e2a83a', '#fff6d6'], badge: ['#fff3c4', '#e2a83a'], ink: '#3a2300' },
    UR:  { name: '極稀有',   frame: ['#ffd0dc', '#ff3d6e', '#ffd0dc'], badge: ['#ffe0e8', '#ff4f7a'], ink: '#4a0016' },
    LR:  { name: '傳說',     frame: 'rainbow',                          badge: 'rainbow',               ink: '#1a0a2e' },
    GDR: { name: '金龍',     frame: 'dragon',                           badge: 'dragon',                ink: '#fff2c0' },
  };
  const RARITY_ORDER = ['N', 'R', 'SR', 'SSR', 'UR', 'LR', 'GDR'];
  const CATEGORY = { exclusive: 'GD獨家', slots: '老虎機', poker: '撲克牌', fish: '捕魚', moto: '經典機車' };
  const FX = [['holo', 'Rainbow Holo'], ['glitter', 'Glitter'], ['cosmos', 'Cosmos'], ['reverse', 'Reverse Holo'], ['gold', 'Gold Foil'], ['rainbow', 'Rainbow Rare'], ['etched', 'Etched'], ['prism', 'Prism'], ['radiant', 'Radiant'], ['aurora', 'Aurora'], ['plain', '無閃']];
  const LOGO_GD = 'M82.1 18.6Q89.3 18.6 93.9 20.5Q98.5 22.5 102 25.2Q103.1 26.1 104 26.1Q106 26.1 106.6 20H108.9Q108.7 24.1 108.6 30Q108.5 35.9 108.5 45.6H106.2Q105.5 38.2 103.7 33.3Q101.9 28.3 96.8 24.8Q94.6 23.4 91.7 22.6Q88.9 21.7 86.2 21.7Q80.3 21.7 76.4 25Q72.5 28.2 70.2 33.4Q67.9 38.5 66.9 44.6Q65.9 50.7 65.9 56.5Q65.9 74.9 70.4 83.4Q75 91.9 82.4 91.9Q84.1 91.9 85.3 91.6Q86.5 91.3 87.4 90.7Q88.6 89.8 89.1 88.6Q89.6 87.4 89.6 85.5V75.3Q89.6 70.3 88.8 67.8Q88.1 65.4 85.8 64.4Q83.6 63.5 79.3 63.4V61.4Q81.6 61.5 85 61.5Q88.4 61.6 92.1 61.6Q95.7 61.7 98.8 61.7Q103.7 61.7 107.9 61.6Q112 61.5 114.6 61.4V63.4Q112.8 63.5 111.9 64.1Q111 64.7 110.7 66.6Q110.4 68.4 110.4 72.2V92.5H108.3Q108.2 90.8 107.5 88.7Q106.8 86.7 105.2 86.7Q104.3 86.7 102.9 87.1Q101.4 87.5 98.2 89Q94.2 91 89.8 92.4Q85.3 93.9 80.9 93.9Q68.1 93.9 59.5 89.5Q50.9 85.1 46.6 76.8Q42.4 68.5 42.4 56.9Q42.4 45.4 47.5 36.8Q52.5 28.2 61.5 23.4Q70.4 18.6 82.1 18.6ZM153.1 20Q174.6 20 185 29.2Q195.4 38.3 195.4 55.4Q195.4 66.6 190.3 74.9Q185.1 83.3 175.5 87.9Q165.8 92.5 152.2 92.5Q150.5 92.5 147.8 92.4Q145.1 92.3 142.1 92.2Q139.2 92.2 136.8 92.2Q131.7 92.2 126.8 92.2Q122 92.3 119 92.5V90.4Q122.2 90.2 123.7 89.6Q125.2 89 125.7 87.2Q126.3 85.3 126.3 81.6V30.9Q126.3 27.1 125.7 25.3Q125.2 23.5 123.6 22.8Q122.1 22.2 119 22V20Q122 20.1 126.8 20.3Q131.7 20.4 136.6 20.3Q140.4 20.2 145.1 20.1Q149.9 20 153.1 20ZM154.6 21.8Q149.9 21.8 148.5 23.6Q147 25.3 147 30.6V81.8Q147 87.2 148.5 88.9Q150 90.7 154.7 90.7Q161.7 90.7 165.9 86.6Q170.1 82.6 172 74.8Q173.9 67 173.9 55.8Q173.9 44.4 171.9 36.8Q169.9 29.3 165.6 25.6Q161.4 21.8 154.6 21.8Z';
  const LOGO_CLUB = 'M63.8 97.8Q66 97.8 67.5 98.5Q68.9 99.1 70.1 100Q70.8 100.5 71.1 100.2Q71.5 99.8 71.6 98.3H72.4Q72.3 99.7 72.3 101.6Q72.3 103.6 72.3 106.8H71.5Q71.3 105.2 71 103.9Q70.7 102.6 70.1 101.6Q69.5 100.7 68.3 99.9Q67.6 99.4 66.8 99.1Q66 98.9 65.2 98.9Q63.2 98.9 61.9 100Q60.7 101 60 102.8Q59.3 104.5 59 106.5Q58.7 108.5 58.7 110.4Q58.7 112.4 59 114.4Q59.3 116.4 60 118.1Q60.7 119.9 61.9 120.9Q63.2 122 65.2 122Q66 122 66.8 121.7Q67.6 121.4 68.3 121Q70 119.9 70.6 118.2Q71.2 116.4 71.5 113.6H72.3Q72.3 116.9 72.3 119Q72.3 121.1 72.4 122.5H71.6Q71.5 121 71.1 120.6Q70.8 120.2 70.1 120.7Q68.8 121.6 67.4 122.3Q66 122.9 63.8 122.9Q59.9 122.9 57 121.5Q54.1 120 52.5 117.2Q50.9 114.5 50.9 110.6Q50.9 106.8 52.5 103.9Q54.2 101 57.1 99.4Q60 97.8 63.8 97.8ZM102.5 95.8V119.3Q102.5 120.7 102.9 121.2Q103.4 121.7 104.4 121.7V122.5Q103.8 122.4 102.4 122.4Q101 122.3 99.6 122.3Q98.2 122.3 96.7 122.4Q95.2 122.4 94.5 122.5V121.7Q95.5 121.7 96 121.2Q96.4 120.7 96.4 119.3V99.9Q96.4 98.3 96 97.6Q95.6 96.9 94.5 96.9V96.1Q95.6 96.2 96.6 96.2Q98.3 96.2 99.8 96.1Q101.3 96 102.5 95.8ZM143.5 104.4V118.7Q143.5 120.3 143.9 121Q144.3 121.7 145.4 121.7V122.5Q144.3 122.4 143.3 122.4Q141.6 122.4 140.1 122.5Q138.6 122.6 137.3 122.8V120.4Q136.5 121.7 135.1 122.3Q133.7 122.9 131.9 122.9Q130.3 122.9 129.4 122.5Q128.5 122.2 128 121.6Q127.5 121 127.3 119.9Q127.1 118.9 127.1 117.2V108.5Q127.1 106.9 126.6 106.2Q126.2 105.5 125.1 105.5V104.7Q126.2 104.8 127.3 104.8Q129 104.8 130.4 104.7Q131.9 104.6 133.2 104.4V119Q133.2 119.7 133.4 120.2Q133.5 120.7 133.9 120.9Q134.3 121.2 134.9 121.2Q135.5 121.2 136.1 120.9Q136.6 120.6 137 120Q137.3 119.4 137.3 118.7V108.5Q137.3 106.9 136.9 106.2Q136.5 105.5 135.4 105.5V104.7Q136.5 104.8 137.5 104.8Q139.2 104.8 140.7 104.7Q142.2 104.6 143.5 104.4ZM179.2 104.3Q181.7 104.3 183.4 106.4Q185.1 108.5 185.1 112.8Q185.1 116.7 184 118.9Q182.9 121.1 181.1 122Q179.3 122.9 177.2 122.9Q176 122.9 175.1 122.8Q174.5 122.7 174 122.5Q172.9 122.1 171.7 122Q170.5 122 169.6 122.3Q168.6 122.5 168.1 123L167.6 122.7Q167.8 122.2 167.8 121.7Q167.9 121.3 167.9 120.8V99.9Q167.9 98.3 167.5 97.6Q167 96.9 166 96.9V96.1Q167 96.2 168.1 96.2Q169.8 96.2 171.3 96.1Q172.7 96 174 95.8V106.8Q174.8 105.5 176.1 104.9Q177.5 104.3 179.2 104.3ZM174 121.8Q174.3 122 174.6 122.1Q175.1 122.3 175.6 122.3Q177.2 122.3 178 120.1Q178.8 118 178.8 113.6Q178.8 110.6 178.4 108.9Q178.1 107.3 177.6 106.7Q177.1 106 176.5 106Q175.5 106 174.8 106.7Q174 107.4 174 108.5Z';

  // ---------- 樣式（全部 gdc- 開頭） ----------
  const CSS = `
.gdc-club{margin:15px 0;border-radius:14px;padding:12px 0 10px 14px;color:#fff;background:linear-gradient(100deg,#8a3cff 0%,#d03dc0 45%,#ff4f93 75%,#ff8a4c 100%);box-shadow:0 8px 24px -10px #ff4f93aa,inset 0 0 0 1px #ffffff33;position:relative;overflow:hidden;font-family:inherit}
.gdc-club::before{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 30%,#ffffff2a 45%,transparent 60%);background-size:250% 100%;animation:gdc-sweep 5s linear infinite;pointer-events:none}
@keyframes gdc-sweep{from{background-position:120% 0}to{background-position:-120% 0}}
.gdc-top{display:flex;align-items:center;gap:8px;padding-right:14px}
.gdc-title{font-size:16px;font-weight:900;letter-spacing:.02em;text-shadow:0 1px 6px #0004;white-space:nowrap}
.gdc-count{margin-left:auto;font-size:12px;font-weight:800;background:#0004;border:1px solid #fff5;border-radius:99px;padding:2px 10px;white-space:nowrap}
.gdc-sub{display:flex;align-items:center;gap:8px;margin:6px 14px 0 0;font-size:11px;font-weight:700;opacity:.92}
.gdc-sub b{font:900 12px/1 Cinzel,Georgia,serif;color:#fff3c4;letter-spacing:.03em;text-shadow:0 1px 4px #0006}
.gdc-bar{flex:1;height:4px;border-radius:4px;background:#0003;overflow:hidden}
.gdc-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#fff6c8,#ffd36e);border-radius:4px;transition:width .5s}
.gdc-shelf{display:flex;gap:10px;overflow-x:auto;padding:10px 14px 4px 2px;scroll-snap-type:x mandatory;scrollbar-width:none;overscroll-behavior-x:contain}
.gdc-shelf::-webkit-scrollbar{display:none}
.gdc-mini{flex:none;width:66px;scroll-snap-align:start;background:none;border:0;padding:0;cursor:pointer;color:#fff;font-family:inherit;text-align:center}
.gdc-mini.land{width:auto}
.gdc-art{position:relative;height:87px;aspect-ratio:773/1024;border-radius:5px;overflow:hidden;box-shadow:0 4px 10px #0006,0 0 0 1.5px #ffffffaa;transition:transform .2s;background:#1c0638}
.gdc-art canvas,.gdc-art img,.gdc-art svg{width:100%;height:100%;display:block;object-fit:cover}
.gdc-art::after{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 35%,#fff9 48%,hsla(190,100%,70%,.5) 52%,transparent 65%);background-size:300% 100%;mix-blend-mode:overlay;animation:gdc-sweep 3.2s ease-in-out infinite;pointer-events:none}
.gdc-mini:hover .gdc-art,.gdc-mini:focus-visible .gdc-art{transform:translateY(-3px) scale(1.04)}
.gdc-name{font-size:10px;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.95}
.gdc-mini.locked .gdc-art{filter:grayscale(.6) brightness(.45)}
.gdc-mini.locked .gdc-art::after{display:none}
.gdc-lock{position:absolute;inset:0;display:grid;place-items:center;font-size:20px;z-index:2}
.gdc-mini.shake .gdc-art{animation:gdc-shake .35s}
@keyframes gdc-shake{25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
.gdc-rar{display:inline-block;font:900 8px/1 Cinzel,Georgia,serif;padding:2px 4px;border-radius:3px;color:#3a2300;background:linear-gradient(#fff3c4,#e2a83a);letter-spacing:.02em}
.gdc-art .gdc-rar{position:absolute;top:3px;left:3px;z-index:3}
.gdc-rar[data-r=N]{background:linear-gradient(#f4f6fa,#9aa3b5);color:#26303f}
.gdc-rar[data-r=R]{background:linear-gradient(#d6efff,#3b9cf0);color:#062a4d}
.gdc-rar[data-r=SR]{background:linear-gradient(#f0e0ff,#a066ff);color:#2a0a52}
.gdc-rar[data-r=UR]{background:linear-gradient(#ffe0e8,#ff4f7a);color:#4a0016}
.gdc-rar[data-r=LR]{background:linear-gradient(100deg,#ff8a8a,#ffe17a,#8affb0,#7ad8ff,#c69bff);color:#1a0a2e}
.gdc-rar[data-r=GDR]{background:linear-gradient(#2a0505,#7a0d12);color:#ffe08a;box-shadow:inset 0 0 0 1px #ffd36e}
.gdc-toast{position:fixed;left:50%;bottom:28px;transform:translate(-50%,20px);background:#000c;color:#fff;border:1px solid #fff3;padding:8px 16px;border-radius:99px;font-size:13px;opacity:0;transition:.25s;pointer-events:none;z-index:2147482001}
.gdc-toast.show{opacity:1;transform:translate(-50%,0)}

.gdc-viewer{position:fixed;inset:0;z-index:2147482000;color:#f2f3ff;background:radial-gradient(ellipse at 50% 35%,#2b2145f2 0%,#0a0814f7 70%);display:flex;flex-direction:column;opacity:0;pointer-events:none;transition:opacity .25s;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);overscroll-behavior:contain;font-family:inherit}
.gdc-viewer.open{opacity:1;pointer-events:auto}
.gdc-vhead{display:flex;align-items:center;gap:8px;padding:calc(12px + env(safe-area-inset-top)) 16px 0}
.gdc-vhead .gdc-rar{font-size:11px;padding:3px 7px;border-radius:4px}
.gdc-vt{font-weight:900;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gdc-vcat{font-size:11px;color:#a9b0d6;border:1px solid #ffffff2a;border-radius:99px;padding:2px 8px;white-space:nowrap}
.gdc-vpow{margin-left:auto;font:900 15px/1 Cinzel,Georgia,serif;color:#ffd36e;white-space:nowrap}
.gdc-vpow small{font:700 11px/1 inherit;font-family:inherit;color:#a9b0d6;margin-right:4px}
.gdc-x{flex:none;width:36px;height:36px;border-radius:50%;border:1px solid #fff3;background:#fff1;color:#fff;font-size:18px;cursor:pointer}
.gdc-stage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;perspective:1100px;touch-action:none;position:relative}
.gdc-side{position:absolute;top:8px;left:50%;transform:translateX(-50%);font-size:12px;color:#a9b0d6;letter-spacing:.1em;background:#0006;padding:3px 10px;border-radius:99px}
.gdc-panel{flex:none;padding:10px 16px calc(14px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:10px;align-items:center}
.gdc-fx{display:flex;gap:6px;overflow-x:auto;max-width:100%;padding-bottom:4px;scrollbar-width:none}
.gdc-fx::-webkit-scrollbar{display:none}
.gdc-fx button,.gdc-prow button{flex:none;background:#ffffff12;color:#f2f3ff;border:1px solid #ffffff24;border-radius:999px;padding:7px 12px;font-size:13px;cursor:pointer;white-space:nowrap;font-family:inherit}
.gdc-fx button.on{background:#fff;color:#111;border-color:#fff}
.gdc-prow{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center}
.gdc-prow button.primary{background:#c79bff;color:#1a0b2e;border-color:#c79bff;font-weight:700}
.gdc-zoom{display:flex;align-items:center;gap:8px;font-size:12px;color:#a9b0d6}
.gdc-zoom input{width:130px;accent-color:#c79bff}
.gdc-zoom output{width:38px;text-align:right;color:#f2f3ff;font-variant-numeric:tabular-nums}
.gdc-hint{font-size:11px;color:#a9b0d6;text-align:center}

.gdc-card{--radius:4.55% / 3.5%;--ar:.755;width:min(70vw,340px,calc((100dvh - 290px) * var(--ar)));aspect-ratio:var(--ar);position:relative;transform-style:preserve-3d;transform:scale(var(--zoom,1));cursor:grab}
.gdc-card.land{--radius:2.4% / 4.2%;width:min(92vw,680px,calc((100dvh - 290px) * var(--ar)))}
.gdc-card.drag{cursor:grabbing}
.gdc-body{position:absolute;inset:0;transform-style:preserve-3d;transform:rotateX(var(--pitch,0deg)) rotateY(var(--yaw,0deg))}
.gdc-face{--mx:50%;--my:50%;--bx:50%;--by:50%;--o:0;--hyp:0;position:absolute;inset:0;border-radius:var(--radius);overflow:hidden;isolation:isolate;backface-visibility:hidden;-webkit-backface-visibility:hidden;transform:translateZ(.5px);
  box-shadow:0 0 3px -1px #fff8,0 0 calc(8px + var(--hyp)*36px) calc(var(--hyp)*5px) hsla(280,100%,70%,calc(var(--o)*.5)),0 30px 60px -20px #000c}
.gdc-face.back{transform:rotateY(180deg) translateZ(.5px)}
.gdc-face canvas,.gdc-face img,.gdc-face svg{width:100%;height:100%;display:block;object-fit:cover;pointer-events:none}
.gdc-shine,.gdc-glare{position:absolute;inset:0;pointer-events:none}
.gdc-glare{mix-blend-mode:overlay;opacity:var(--o);background:radial-gradient(farthest-corner circle at var(--mx) var(--my),hsla(0,0%,100%,.85) 10%,hsla(0,0%,100%,.5) 22%,hsla(0,0%,0%,.5) 90%)}
.gdc-glare::after{content:"";position:absolute;inset:0;mix-blend-mode:soft-light;opacity:.6;background:radial-gradient(farthest-corner circle at var(--mx) var(--my),#fff 0%,transparent 30%)}
.gdc-shine{opacity:var(--o);mix-blend-mode:color-dodge}
.gdc-shine::after{content:none;position:absolute;inset:0}
.gdc-card[data-fx=plain] .gdc-shine{display:none}

.gdc-card[data-fx=holo] .gdc-shine,.gdc-card[data-fx=glitter] .gdc-shine,.gdc-card[data-fx=reverse] .gdc-shine{filter:brightness(.85) contrast(2.2) saturate(.9);
  background-image:var(--gdc-sparkle),repeating-linear-gradient(0deg,hsl(2,100%,73%) 5%,hsl(53,100%,69%) 10%,hsl(93,100%,69%) 15%,hsl(176,100%,76%) 20%,hsl(228,100%,74%) 25%,hsl(283,100%,73%) 30%,hsl(2,100%,73%) 35%),repeating-linear-gradient(133deg,#0e152e 0%,hsl(180,10%,60%) 3.8%,hsl(180,29%,66%) 4.5%,hsl(180,10%,60%) 5.2%,#0e152e 10%,#0e152e 12%),radial-gradient(farthest-corner circle at var(--mx) var(--my),#0000001a 12%,#00000026 20%,#00000040 120%);
  background-blend-mode:screen,hue,hard-light;background-size:180px 180px,200% 700%,300% 100%,200% 100%;background-position:center,0% var(--by),var(--bx) var(--by),var(--bx) var(--by)}
.gdc-card[data-fx=holo] .gdc-shine::after,.gdc-card[data-fx=reverse] .gdc-shine::after{content:"";background-image:repeating-linear-gradient(0deg,hsl(2,100%,73%) 5%,hsl(53,100%,69%) 10%,hsl(93,100%,69%) 15%,hsl(176,100%,76%) 20%,hsl(228,100%,74%) 25%,hsl(283,100%,73%) 30%,hsl(2,100%,73%) 35%),repeating-linear-gradient(133deg,#0e152e 0%,hsl(180,10%,60%) 3.8%,hsl(180,29%,66%) 4.5%,hsl(180,10%,60%) 5.2%,#0e152e 10%,#0e152e 12%);
  background-size:200% 400%,300% 100%;background-position:0% calc(var(--by)*-1),calc(var(--bx)*-1) calc(var(--by)*-1);background-blend-mode:hue;mix-blend-mode:exclusion;opacity:.6}
.gdc-card[data-fx=glitter] .gdc-shine{background-size:110px 110px,200% 700%,300% 100%,200% 100%;filter:brightness(.95) contrast(2.8) saturate(1.1)}
.gdc-card[data-fx=cosmos] .gdc-shine{background-image:var(--gdc-sparkle),radial-gradient(circle at var(--mx) var(--my),hsla(0,0%,100%,.5) 0%,transparent 40%),conic-gradient(from 0deg at var(--bx) var(--by),hsl(0,100%,70%),hsl(60,100%,70%),hsl(120,100%,70%),hsl(180,100%,70%),hsl(240,100%,75%),hsl(300,100%,70%),hsl(360,100%,70%));
  background-size:150px 150px,100% 100%,100% 100%;background-blend-mode:overlay,soft-light;filter:brightness(.7) contrast(1.8) saturate(1.2)}
.gdc-card[data-fx=reverse] .gdc-shine{-webkit-mask-image:radial-gradient(ellipse 46% 40% at 50% 42%,transparent 55%,#000 100%);mask-image:radial-gradient(ellipse 46% 40% at 50% 42%,transparent 55%,#000 100%);filter:brightness(1) contrast(2.6) saturate(1.1)}
.gdc-card[data-fx=gold] .gdc-shine{mix-blend-mode:color-dodge;filter:brightness(.9) contrast(1.6);background-image:var(--gdc-sparkle-gold),linear-gradient(115deg,transparent 18%,#6b4300 30%,#ffd46b 40%,#fff6cf 46%,#c98a12 54%,#5a3600 64%,transparent 80%),radial-gradient(farthest-corner circle at var(--mx) var(--my),#ffcf6a55 0%,#0000 55%);
  background-size:120px 120px,300% 300%,100% 100%;background-position:center,var(--bx) var(--by),center;background-blend-mode:screen,normal}
.gdc-card[data-fx=gold] .gdc-shine::after{content:"";mix-blend-mode:soft-light;opacity:.55;background:linear-gradient(160deg,#ffe8a3,#b8860b 50%,#ffefb5)}
.gdc-card[data-fx=rainbow] .gdc-shine{mix-blend-mode:color;opacity:calc(.25 + var(--o)*.45);background-image:linear-gradient(-30deg,hsl(0,100%,65%),hsl(45,100%,62%),hsl(100,90%,62%),hsl(180,100%,62%),hsl(230,100%,68%),hsl(290,100%,68%),hsl(340,100%,66%),hsl(0,100%,65%));background-size:400% 400%;background-position:var(--bx) var(--by)}
.gdc-card[data-fx=rainbow] .gdc-shine::after{content:"";mix-blend-mode:color-dodge;opacity:var(--o);filter:contrast(2.5) brightness(.8);background-image:var(--gdc-sparkle),radial-gradient(farthest-corner circle at var(--mx) var(--my),#fff6 0%,#0000 50%);background-size:140px 140px,100% 100%}
.gdc-card[data-fx=etched] .gdc-shine{filter:brightness(.8) contrast(2.4) saturate(1.2);background-image:repeating-linear-gradient(55deg,#000 0 3px,#fff 3px 4px,#000 4px 7px),repeating-linear-gradient(-20deg,hsl(0,100%,70%) 0%,hsl(60,100%,68%) 6%,hsl(150,100%,68%) 12%,hsl(210,100%,72%) 18%,hsl(290,100%,72%) 24%,hsl(360,100%,70%) 30%),radial-gradient(farthest-corner circle at var(--mx) var(--my),#fff5 0%,#0006 70%);
  background-blend-mode:multiply,hard-light;background-size:100% 100%,300% 300%,100% 100%;background-position:center,var(--bx) var(--by),center}
.gdc-card[data-fx=prism] .gdc-shine{filter:brightness(.75) contrast(2.2) saturate(1.3);background-image:linear-gradient(60deg,#fff3 25%,#0000 25% 50%,#fff2 50% 75%,#0000 75%),linear-gradient(-60deg,#0000 25%,#fff4 25% 50%,#0000 50% 75%,#fff3 75%),linear-gradient(0deg,#fff2 50%,#0000 50%),conic-gradient(from 90deg at var(--mx) var(--my),hsl(0,100%,65%),hsl(70,100%,62%),hsl(160,100%,62%),hsl(220,100%,70%),hsl(300,100%,68%),hsl(360,100%,65%));
  background-size:56px 97px,56px 97px,56px 48.5px,100% 100%;background-position:calc(var(--bx)*.6) 0,calc(var(--bx)*-.6) 0,0 calc(var(--by)*.4),center;background-blend-mode:overlay,overlay,overlay,normal}
.gdc-card[data-fx=radiant] .gdc-shine{filter:brightness(.85) contrast(2) saturate(1.1);background-image:repeating-linear-gradient(45deg,#0000 0 10px,#fff8 12px,#0000 14px 24px),repeating-linear-gradient(-45deg,#0000 0 10px,#fff8 12px,#0000 14px 24px),linear-gradient(115deg,hsl(10,100%,70%),hsl(50,100%,70%),hsl(140,100%,70%),hsl(200,100%,72%),hsl(280,100%,72%),hsl(340,100%,70%));
  background-size:200% 200%,200% 200%,300% 300%;background-position:var(--bx) var(--by),calc(100% - var(--bx)) var(--by),var(--bx) var(--by);background-blend-mode:overlay,overlay,normal;
  -webkit-mask-image:radial-gradient(farthest-corner circle at var(--mx) var(--my),#000 0%,#0009 45%,#0003 90%);mask-image:radial-gradient(farthest-corner circle at var(--mx) var(--my),#000 0%,#0009 45%,#0003 90%)}
/* Aurora：強度為原版一半（不透明度 .75→.375、閃粉 .7→.35） */
.gdc-card[data-fx=aurora] .gdc-shine{mix-blend-mode:screen;opacity:calc(var(--o)*.375);filter:blur(6px) saturate(1.4);background-image:radial-gradient(ellipse 60% 25% at calc(var(--bx)*1.2 - 10%) 30%,hsla(160,100%,60%,.7),transparent 70%),radial-gradient(ellipse 55% 22% at calc(110% - var(--bx)*1.2) 55%,hsla(280,100%,65%,.65),transparent 70%),radial-gradient(ellipse 70% 20% at var(--mx) calc(var(--by) + 25%),hsla(200,100%,65%,.6),transparent 70%)}
.gdc-card[data-fx=aurora] .gdc-shine::after{content:"";mix-blend-mode:color-dodge;filter:none;opacity:.35;background-image:var(--gdc-sparkle);background-size:200px 200px}
@media (prefers-reduced-motion:reduce){.gdc-club::before,.gdc-art::after{animation:none}}
`;

  // ---------- 小工具 ----------
  const W = 773, H = 1024;
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const wrap = (a) => ((a + 180) % 360 + 360) % 360 - 180;
  const fmt = (n) => Number(n || 0).toLocaleString('en-US');
  const pad = (n) => 'No.' + String(n).padStart(3, '0');
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const SANS = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif';
  const SERIF = 'Cinzel,"Cinzel Decorative",Georgia,"Times New Roman",serif';
  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  // ---------- 卡背（所有卡共用；每份 SVG 的 id 加流水號，避免重複 id 互相干擾） ----------
  let backSeq = 0, backStatic = null;
  function backStaticParts(w, hh) {
    const key = w + 'x' + hh; backStatic ||= {};
    if (backStatic[key]) return backStatic[key];
    const cx = w / 2, cy = w > hh ? hh * 0.44 : 470, R = Math.max(w, hh) * 0.75;
    let rays = '';
    for (let i = 0; i < 36; i++) {
      const a = (i * 10) * Math.PI / 180, b = (i * 10 + 3.2) * Math.PI / 180;
      rays += `<path d="M${cx},${cy} L${(cx + R * Math.cos(a)).toFixed(1)},${(cy + R * Math.sin(a)).toFixed(1)} L${(cx + R * Math.cos(b)).toFixed(1)},${(cy + R * Math.sin(b)).toFixed(1)}Z"/>`;
    }
    const r = rng(20261016); let stars = '';
    for (let i = 0; i < 70; i++) stars += `<circle cx="${(60 + r() * (w - 120)) | 0}" cy="${(70 + r() * (hh - 140)) | 0}" r="${(0.8 + r() * 1.6).toFixed(1)}" opacity="${(0.25 + r() * 0.55).toFixed(2)}"/>`;
    const corner = (x, y, rot, p) => `<g transform="translate(${x},${y}) rotate(${rot})"><g fill="none" stroke="url(#${p}goldH)" stroke-width="2.5"><path d="M0,46 L0,0 L46,0"/><path d="M12,58 Q12,12 58,12"/><rect x="-7" y="-7" width="14" height="14" transform="rotate(45)" fill="url(#${p}gold)" stroke="none"/><circle cx="24" cy="24" r="4" fill="url(#${p}gold)" stroke="none"/></g></g>`;
    return (backStatic[key] = { rays, stars, corner });
  }
  /** 直式 773×1024 為原設計；橫式卡（w > h）用同一套底圖重新排版：徽章與緞帶依高度縮放置中。 */
  function backSVG(w = W, hh = H) {
    const p = `gdcb${++backSeq}-`, { rays, stars, corner } = backStaticParts(w, hh);
    const land = w > hh, k = land ? hh * 0.62 / 524 : 1, cx = w / 2, cy = land ? hh * 0.44 : 470;
    const topY = land ? cy - 262 * k - 30 : 118, botY = land ? hh - 60 : 946, ribY = cy + 300 * k;
    return `<svg viewBox="0 0 ${w} ${hh}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
<radialGradient id="${p}bg" cx="50%" cy="46%" r="75%"><stop offset="0" stop-color="#7a2fc4"/><stop offset=".45" stop-color="#3d0f78"/><stop offset="1" stop-color="#14032a"/></radialGradient>
<linearGradient id="${p}gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffbe0"/><stop offset=".22" stop-color="#ffd36e"/><stop offset=".48" stop-color="#a8701a"/><stop offset=".6" stop-color="#ffe9a3"/><stop offset=".82" stop-color="#8c5a10"/><stop offset="1" stop-color="#ffd36e"/></linearGradient>
<linearGradient id="${p}goldH" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff4c4"/><stop offset=".25" stop-color="#d9a640"/><stop offset=".5" stop-color="#fff1b8"/><stop offset=".75" stop-color="#9c6514"/><stop offset="1" stop-color="#ffe08a"/></linearGradient>
<linearGradient id="${p}logo" x1="0" y1="18" x2="0" y2="94" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fffbe0"/><stop offset=".3" stop-color="#ffd36e"/><stop offset=".55" stop-color="#a8701a"/><stop offset=".68" stop-color="#ffe9a3"/><stop offset="1" stop-color="#b07a1c"/></linearGradient>
<linearGradient id="${p}silver" x1="0" y1="95" x2="0" y2="124" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#d9d3f5"/><stop offset=".52" stop-color="#7d76a3"/><stop offset=".68" stop-color="#f4f1ff"/><stop offset="1" stop-color="#a59fca"/></linearGradient>
<radialGradient id="${p}core" cx="50%" cy="40%" r="65%"><stop offset="0" stop-color="#5a1fa0"/><stop offset="1" stop-color="#1c0638"/></radialGradient>
<pattern id="${p}dia" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0,0 H34 M0,0 V34" stroke="#fff" stroke-width="1" opacity=".07"/></pattern>
<path id="${p}ring" d="M386.5,470 m-222,0 a222,222 0 1,1 444,0 a222,222 0 1,1 -444,0"/>
<filter id="${p}sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#0a0018" flood-opacity=".8"/></filter>
</defs>
<rect width="${w}" height="${hh}" fill="url(#${p}bg)"/><rect width="${w}" height="${hh}" fill="url(#${p}dia)"/>
<g fill="#ffd36e" opacity=".07">${rays}</g><g fill="#fff">${stars}</g>
<rect x="18" y="18" width="${w - 36}" height="${hh - 36}" rx="26" fill="none" stroke="url(#${p}goldH)" stroke-width="10"/>
<rect x="38" y="38" width="${w - 76}" height="${hh - 76}" rx="14" fill="none" stroke="url(#${p}gold)" stroke-width="2" opacity=".85"/>
<rect x="46" y="46" width="${w - 92}" height="${hh - 92}" rx="10" fill="none" stroke="#ffd36e" stroke-width="1" stroke-dasharray="2 6" opacity=".5"/>
${corner(52, 52, 0, p)}${corner(w - 52, 52, 90, p)}${corner(w - 52, hh - 52, 180, p)}${corner(52, hh - 52, 270, p)}
<text x="${cx}" y="${topY}" text-anchor="middle" font-family="${SERIF.replace(/"/g, "'")}" font-weight="700" font-size="26" letter-spacing="8" fill="url(#${p}gold)">✦ COLLECTOR SERIES ✦</text>
<g transform="translate(${cx} ${cy}) scale(${k}) translate(-386.5 -470)">
<g filter="url(#${p}sh)">
<circle cx="386.5" cy="470" r="262" fill="#1c0638" stroke="url(#${p}goldH)" stroke-width="8"/>
<circle cx="386.5" cy="470" r="246" fill="none" stroke="url(#${p}gold)" stroke-width="1.5"/>
<text font-family="${SERIF.replace(/"/g, "'")}" font-weight="700" font-size="25" letter-spacing="5" fill="url(#${p}gold)"><textPath href="#${p}ring" textLength="1380">GD CLUB ✦ COLLECTOR SERIES ✦ GD CLUB ✦ COLLECTOR SERIES ✦ </textPath></text>
<circle cx="386.5" cy="470" r="196" fill="url(#${p}core)" stroke="url(#${p}goldH)" stroke-width="5"/>
<circle cx="386.5" cy="470" r="182" fill="none" stroke="url(#${p}gold)" stroke-width="1" opacity=".6"/>
</g>
<g filter="url(#${p}sh)" transform="translate(386.5 470) scale(2.15) translate(-118.9 -56.25)"><path d="${LOGO_GD}" fill="url(#${p}logo)" stroke="#2a0a4f" stroke-width="1.6" paint-order="stroke"/></g>
<g transform="translate(386.5,770)" filter="url(#${p}sh)">
<path d="M-250,-38 L-300,-38 L-275,0 L-300,38 L-250,38Z M250,-38 L300,-38 L275,0 L300,38 L250,38Z" fill="#4a1488" stroke="url(#${p}goldH)" stroke-width="3"/>
<rect x="-252" y="-52" width="504" height="104" rx="8" fill="#2a0a52" stroke="url(#${p}goldH)" stroke-width="5"/>
<rect x="-240" y="-40" width="480" height="80" rx="4" fill="none" stroke="url(#${p}gold)" stroke-width="1" opacity=".7"/>
<g transform="scale(2.5) translate(-118 -109.4)"><path d="${LOGO_CLUB}" fill="url(#${p}silver)" stroke="#1a0533" stroke-width=".8" paint-order="stroke"/></g>
</g>
</g>
<text x="${cx}" y="${botY}" text-anchor="middle" font-family="${SERIF.replace(/"/g, "'")}" font-weight="700" font-size="22" letter-spacing="6" fill="url(#${p}gold)" opacity=".9">GOLDEN DRAGON CLUB</text>
</svg>`;
  }

  // ---------- 卡面（沒有 img 時：遊戲圖示＋稀有度外框畫在 canvas） ----------
  const imgCache = new Map();
  function loadImg(src) {
    if (!src) return Promise.resolve(null);
    if (!imgCache.has(src)) imgCache.set(src, new Promise((res) => {
      const im = new Image();
      if (!/^data:|^blob:/.test(src)) im.crossOrigin = 'anonymous';
      im.onload = () => res(im); im.onerror = () => res(null); im.src = src;
    }));
    return imgCache.get(src);
  }
  let fontsReady = null;
  function waitFonts() {
    if (!fontsReady) fontsReady = !document.fonts ? Promise.resolve() : Promise.race([
      Promise.all([document.fonts.load(`900 40px ${SERIF}`), document.fonts.load(`900 40px ${SANS}`, '戰鬥力')]).catch(() => {}),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
    return fontsReady;
  }
  function rr(g, x, y, w, hh, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, hh, r); else { g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); } }
  function grad(g, stops, x0, y0, x1, y1) { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c)); return gr; }
  function frameFill(g, rar) {
    const f = RARITY[rar]?.frame || RARITY.N.frame;
    if (f === 'rainbow') return grad(g, ['#ff7a7a', '#ffd86b', '#7dffa6', '#6bd6ff', '#9c8bff', '#ff7ad9', '#ff7a7a'], 0, 0, W, H);
    if (f === 'dragon') return grad(g, ['#fff4c4', '#d9a640', '#fff1b8', '#9c6514', '#ffe08a', '#b8860b', '#fff4c4'], 0, 0, W, H);
    return grad(g, [f[0], f[1], f[2], f[1]], 0, 0, W, H);
  }

  /** opts.thumb：縮圖只畫圖與外框（字太小看不到，名稱與稀有度改用 HTML 顯示）。 */
  async function renderFront(card, { scale = 1, thumb = false } = {}) {
    const [icon] = await Promise.all([loadImg(card.icon), waitFonts()]);
    const c = document.createElement('canvas'); c.width = Math.round(W * scale); c.height = Math.round(H * scale);
    const g = c.getContext('2d'); g.scale(scale, scale);
    const rar = RARITY[card.rarity] ? card.rarity : 'N', R = RARITY[rar];
    const [c1, c2] = card.colors || ['#3a1a5e', '#120822'];
    rr(g, 0, 0, W, H, 36); g.save(); g.clip();
    // 底：遊戲主色放射漸層＋光芒＋暗角
    const bg = g.createRadialGradient(386, 400, 40, 386, 430, 760); bg.addColorStop(0, c1); bg.addColorStop(1, c2);
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.save(); g.translate(386, 400); g.fillStyle = 'rgba(255,255,255,.06)';
    for (let i = 0; i < 24; i++) { g.rotate(Math.PI / 12); g.beginPath(); g.moveTo(0, 0); g.lineTo(900, -60); g.lineTo(900, 60); g.closePath(); g.fill(); }
    g.restore();
    const vg = g.createRadialGradient(386, 460, 300, 386, 512, 760); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    // 遊戲圖示
    const ART = thumb ? 690 : 600, AY = thumb ? 470 : 405;
    if (icon) { g.save(); g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 30; g.shadowOffsetY = 12; g.drawImage(icon, 386.5 - ART / 2, AY - ART / 2, ART, ART); g.restore(); }
    else { g.fillStyle = 'rgba(255,255,255,.85)'; g.font = `900 120px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(card.name || '?', 386.5, AY); }
    if (!thumb) {
      // 稀有度徽章（左上）、編號（右上）
      g.font = `900 44px ${SERIF}`; const tw = Math.max(96, g.measureText(rar).width + 44);
      rr(g, 44, 44, tw, 64, 12);
      g.fillStyle = R.badge === 'rainbow' ? grad(g, ['#ff8a8a', '#ffe17a', '#8affb0', '#7ad8ff', '#c69bff'], 44, 0, 44 + tw, 0)
        : R.badge === 'dragon' ? grad(g, ['#2a0505', '#7a0d12'], 0, 44, 0, 108) : grad(g, R.badge, 0, 44, 0, 108);
      g.fill(); if (rar === 'GDR') { g.strokeStyle = '#ffd36e'; g.lineWidth = 3; g.stroke(); }
      g.fillStyle = R.ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(rar, 44 + tw / 2, 78);
      g.font = `700 28px ${SERIF}`; g.textAlign = 'right'; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText(pad(card.no ?? card.id), 729, 78);
      if (rar === 'GDR') { // 金龍：右上加一枚正式 GD LOGO
        g.save(); g.translate(560, 52); g.scale(.36, .36); g.translate(-42, -18);
        g.fillStyle = grad(g, ['#fffbe0', '#ffd36e', '#a8701a', '#ffe9a3'], 0, 18, 0, 94); g.fill(new Path2D(LOGO_GD)); g.restore();
      }
      // 下方資訊板：卡名、分類、戰鬥力
      rr(g, 52, 760, 669, 210, 24); g.fillStyle = 'rgba(10,6,24,.74)'; g.fill();
      g.lineWidth = 3; g.strokeStyle = frameFill(g, rar); g.stroke();
      g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = `900 56px ${SANS}`; g.fillText(card.name || '', 386.5, 820);
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(92, 860, 589, 2);
      const cat = CATEGORY[card.category] || ''; g.font = `700 28px ${SANS}`; const cw = g.measureText(cat).width + 36;
      rr(g, 92, 888, cw, 50, 25); g.fillStyle = 'rgba(255,255,255,.12)'; g.fill(); g.fillStyle = '#e6e8ff'; g.textAlign = 'left'; g.fillText(cat, 110, 914);
      g.textAlign = 'right'; g.font = `900 58px ${SERIF}`; g.fillStyle = grad(g, ['#fff6cf', '#ffd36e', '#c98a12'], 0, 885, 0, 945); g.fillText(fmt(card.power), 681, 916);
      const pw = g.measureText(fmt(card.power)).width; g.font = `700 26px ${SANS}`; g.fillStyle = '#c9cdee'; g.fillText('戰鬥力', 681 - pw - 14, 918);
    }
    g.restore();
    // 外框
    rr(g, 11, 11, W - 22, H - 22, 30); g.lineWidth = 22; g.strokeStyle = frameFill(g, rar); g.stroke();
    rr(g, 30, 30, W - 60, H - 60, 20); g.lineWidth = 2; g.strokeStyle = rar === 'GDR' ? 'rgba(200,16,46,.9)' : 'rgba(255,255,255,.55)'; g.stroke();
    return c;
  }
  const dims = (c) => [c.w || W, c.h || H];
  async function faceArt(card, opts = {}) {
    const src = opts.thumb ? card.thumb || card.img : card.img;
    if (src) { const im = new Image(); im.alt = ''; im.decoding = 'async'; im.src = src; return im; }
    return renderFront(card, opts);
  }

  // ---------- 卡冊 ----------
  let root = null, cards = [], opts = {}, toastEl = null, toastT = 0, styleEl = null;
  function ensureStyle() { if (!styleEl) { styleEl = h('style'); styleEl.id = 'gdc-style'; styleEl.textContent = CSS; document.head.append(styleEl); } }
  function toast(m) {
    if (!toastEl) { toastEl = h('div', 'gdc-toast'); document.body.append(toastEl); }
    toastEl.textContent = m; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 1600);
  }
  function rarBadge(r) { const b = h('span', 'gdc-rar', r); b.dataset.r = r; return b; }
  function render() {
    if (!root) return;
    const owned = cards.filter((c) => c.owned), total = cards.length;
    const power = owned.reduce((s, c) => s + (c.power || 0), 0);
    root.innerHTML = '';
    const top = h('div', 'gdc-top'); top.append(h('span', 'gdc-title', opts.title || '金龍俱樂部・GD 卡冊'), h('span', 'gdc-count', `已收集 ${owned.length}/${total}`));
    const sub = h('div', 'gdc-sub'); const bar = h('div', 'gdc-bar'), fill = h('i'); bar.append(fill);
    const pw = h('span'); pw.append('總戰力 ', h('b', '', fmt(power))); sub.append(bar, pw);
    const shelf = h('div', 'gdc-shelf');
    // 已收集的排前面，其餘依編號
    const order = [...cards].sort((x, y) => (y.owned - x.owned) || ((x.no ?? x.id) - (y.no ?? y.id)));
    for (const c of order) {
      const b = h('button', 'gdc-mini' + (c.owned ? '' : ' locked')); b.type = 'button';
      b.setAttribute('aria-label', c.owned ? `${c.name}（${c.rarity}）` : `${pad(c.no ?? c.id)} 未收集`);
      const art = h('div', 'gdc-art'), [cw, ch] = dims(c);
      art.style.aspectRatio = `${cw}/${ch}`; if (cw > ch) b.classList.add('land');
      if (c.owned) faceArt(c, { scale: .26, thumb: true }).then((el) => art.prepend(el));
      else { art.innerHTML = backSVG(cw, ch); art.append(h('div', 'gdc-lock', '🔒')); }
      art.append(rarBadge(c.rarity));
      b.append(art, h('div', 'gdc-name', c.owned ? c.name : pad(c.no ?? c.id)));
      b.onclick = () => {
        if (c.owned) return openViewer(c);
        b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
        toast('尚未收集這張卡'); opts.onLocked?.(c);
      };
      shelf.append(b);
    }
    root.append(top, sub, shelf);
    requestAnimationFrame(() => { fill.style.width = (total ? owned.length / total * 100 : 0) + '%'; });
  }

  // ---------- 觀看器 ----------
  let V = null; // 第一次打開才建
  const S = { yaw: 0, pitch: 0, zoom: 1, hy: 0, hp: 0 }, T = { ...S };
  let vYaw = 0, dragging = false, last = null, pinch = null, running = false, gyroOn = false, gyroListening = false;
  const pointers = new Map();
  function sparkle(gold) {
    const c = document.createElement('canvas'); c.width = c.height = 180; const g = c.getContext('2d');
    for (let i = 0; i < 260; i++) {
      g.fillStyle = gold ? `hsl(${38 + Math.random() * 16},100%,${55 + Math.random() * 40}%)` : `hsl(${Math.random() * 360},80%,${40 + Math.random() * 60}%)`;
      g.beginPath(); g.arc(Math.random() * 180, Math.random() * 180, Math.random() * 1.4 + .3, 0, 7); g.fill();
    }
    return `url(${c.toDataURL()})`;
  }
  function buildViewer() {
    const v = h('div', 'gdc-viewer'); v.setAttribute('role', 'dialog'); v.setAttribute('aria-modal', 'true'); v.setAttribute('aria-hidden', 'true');
    v.style.setProperty('--gdc-sparkle', sparkle(false)); v.style.setProperty('--gdc-sparkle-gold', sparkle(true));
    v.innerHTML = `<div class="gdc-vhead"><span class="gdc-rar" data-k="rar"></span><span class="gdc-vt" data-k="name"></span><span class="gdc-vcat" data-k="cat"></span><span class="gdc-vpow"><small>戰鬥力</small><span data-k="pow"></span></span><button class="gdc-x" data-k="close" aria-label="關閉">✕</button></div>
<div class="gdc-stage" data-k="stage"><div class="gdc-side" data-k="side">正面</div><div class="gdc-card" data-k="card"><div class="gdc-body"><div class="gdc-face front" data-k="front"><div class="gdc-shine"></div><div class="gdc-glare"></div></div><div class="gdc-face back" data-k="back">${backSVG()}<div class="gdc-shine"></div><div class="gdc-glare"></div></div></div></div></div>
<div class="gdc-panel"><div class="gdc-fx" data-k="fx">${FX.map(([k, n]) => `<button type="button" data-fx="${k}">${n}</button>`).join('')}</div>
<div class="gdc-prow"><div class="gdc-zoom"><button type="button" data-k="zm" aria-label="縮小">−</button><input data-k="zoom" type="range" min="50" max="150" value="100" aria-label="縮放"><button type="button" data-k="zp" aria-label="放大">＋</button><output data-k="zout">100%</output></div></div>
<div class="gdc-prow"><button type="button" class="primary" data-k="flip">⟲ 翻面</button><button type="button" data-k="reset">歸位</button><button type="button" data-k="gyro" hidden>啟用陀螺儀</button></div>
<div class="gdc-hint">左右拖曳 360° 翻轉・上下拖曳 ±80°・雙指／滾輪縮放</div></div>`;
    const q = (k) => v.querySelector(`[data-k="${k}"]`);
    V = { el: v, q, card: q('card'), stage: q('stage'), front: q('front'), back: q('back'), side: q('side'), zoom: q('zoom'), zout: q('zout') };
    document.body.append(v);
    const { stage, card } = V;
    q('close').onclick = closeViewer;
    stage.addEventListener('pointerdown', (e) => {
      stage.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: T.zoom }; dragging = false; return; }
      dragging = true; vYaw = 0; last = { x: e.clientX, y: e.clientY }; T.hy = T.hp = 0; card.classList.add('drag');
    });
    stage.addEventListener('pointermove', (e) => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size === 2) { const [a, b] = [...pointers.values()]; setZoom(pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d); return; }
      if (dragging) {
        const dx = e.clientX - last.x, dy = e.clientY - last.y;
        T.yaw += dx * .6; T.pitch = clamp(T.pitch - dy * .5, -80, 80); vYaw = vYaw * .5 + dx * .3; last = { x: e.clientX, y: e.clientY };
      } else if (e.pointerType === 'mouse' && !gyroOn) {
        const r = card.getBoundingClientRect(), inside = e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom;
        const px = clamp((e.clientX - r.left) / r.width * 100, 0, 100), py = clamp((e.clientY - r.top) / r.height * 100, 0, 100);
        T.hy = inside ? -(px - 50) / 3.5 : 0; T.hp = inside ? (py - 50) / 2.8 : 0;
      }
    });
    const end = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; if (!pointers.size) { dragging = false; card.classList.remove('drag'); } };
    stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
    stage.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !dragging) T.hy = T.hp = 0; });
    stage.addEventListener('wheel', (e) => { e.preventDefault(); setZoom(T.zoom - e.deltaY * .0012); }, { passive: false });
    V.zoom.addEventListener('input', () => setZoom(V.zoom.value / 100));
    q('zm').onclick = () => setZoom(Math.round(T.zoom * 10 - 1) / 10);
    q('zp').onclick = () => setZoom(Math.round(T.zoom * 10 + 1) / 10);
    q('flip').onclick = () => { vYaw = 0; T.yaw = Math.round(T.yaw / 180) * 180 + 180; };
    q('reset').onclick = () => { vYaw = 0; T.yaw = Math.round(T.yaw / 360) * 360; T.pitch = 0; T.hy = T.hp = 0; };
    q('fx').addEventListener('click', (e) => { const f = e.target.closest('[data-fx]'); if (f) setFx(f.dataset.fx); });
    const gb = q('gyro');
    if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
      gb.hidden = false;
      gb.onclick = () => DeviceOrientationEvent.requestPermission().then((p) => { if (p === 'granted') { gb.hidden = true; V.gyroGranted = true; listenGyro(true); } }).catch(() => {});
    } else if (window.DeviceOrientationEvent) V.gyroGranted = true;
  }
  function onOrient(e) { if (e.beta == null || !running) return; gyroOn = true; T.hy = clamp(-(e.gamma || 0) * .6, -20, 20); T.hp = clamp(((e.beta || 0) - 45) * .5, -20, 20); }
  function listenGyro(on) {
    if (on && V?.gyroGranted && !gyroListening) { addEventListener('deviceorientation', onOrient); gyroListening = true; }
    if (!on && gyroListening) { removeEventListener('deviceorientation', onOrient); gyroListening = false; gyroOn = false; }
  }
  const onKey = (e) => { if (e.key === 'Escape') closeViewer(); };
  function setFx(f) {
    V.card.dataset.fx = f;
    V.q('fx').querySelectorAll('button').forEach((b) => { const on = b.dataset.fx === f; b.classList.toggle('on', on); if (on) b.scrollIntoView({ inline: 'center', block: 'nearest' }); });
  }
  function setZoom(z) { T.zoom = clamp(z, .5, 1.5); V.zoom.value = Math.round(T.zoom * 100); V.zout.textContent = V.zoom.value + '%'; }
  let openSeq = 0;
  async function openViewer(c) {
    if (!V) buildViewer();
    const seq = ++openSeq, q = V.q, rb = q('rar');
    rb.textContent = c.rarity; rb.dataset.r = c.rarity; rb.title = RARITY[c.rarity]?.name || '';
    q('name').textContent = c.name; q('cat').textContent = CATEGORY[c.category] || ''; q('pow').textContent = fmt(c.power);
    setFx(c.fx || 'holo');
    V.front.querySelector('canvas,img')?.remove();
    const [cw, ch] = dims(c), land = cw > ch, orient = `${cw}x${ch}`;
    V.card.classList.toggle('land', land); V.card.style.setProperty('--ar', cw / ch);
    if (V.orient !== orient) { V.back.querySelector('svg')?.remove(); V.back.insertAdjacentHTML('afterbegin', backSVG(cw, ch)); V.orient = orient; }
    Object.assign(S, { yaw: -180, pitch: 10, zoom: .6, hy: 0, hp: 0 }); Object.assign(T, { yaw: 0, pitch: 0, hy: 0, hp: 0 }); vYaw = 0; setZoom(1); // 從背面翻入
    V.el.classList.add('open'); V.el.setAttribute('aria-hidden', 'false');
    addEventListener('keydown', onKey); listenGyro(true);
    if (!running) { running = true; requestAnimationFrame(tick); }
    const art = await faceArt(c, { scale: 1 });
    if (seq === openSeq) V.front.prepend(art);
  }
  function closeViewer() {
    if (!V) return;
    V.el.classList.remove('open'); V.el.setAttribute('aria-hidden', 'true'); running = false;
    removeEventListener('keydown', onKey); listenGyro(false);
  }
  function faceVars(el, ly, lp) {
    const mx = clamp(50 - ly * 3.5, 0, 100), my = clamp(50 + lp * 2.8, 0, 100), o = clamp(Math.hypot(ly, lp) / 14, 0, 1);
    el.style.setProperty('--mx', mx + '%'); el.style.setProperty('--my', my + '%');
    el.style.setProperty('--bx', (37 + 26 * mx / 100) + '%'); el.style.setProperty('--by', (33 + 34 * my / 100) + '%');
    el.style.setProperty('--o', o.toFixed(3)); el.style.setProperty('--hyp', clamp(Math.hypot(mx - 50, my - 50) / 50, 0, 1).toFixed(3));
  }
  function tick() {
    if (!running) return;
    if (!dragging && Math.abs(vYaw) > .02) { T.yaw += vYaw; vYaw *= .95; }
    const k = dragging ? .35 : .12;
    for (const key in S) S[key] += (T[key] - S[key]) * (key === 'hy' || key === 'hp' ? .1 : k);
    const yaw = S.yaw + S.hy, pitch = clamp(S.pitch + S.hp, -85, 85), c = V.card;
    c.style.setProperty('--yaw', yaw + 'deg'); c.style.setProperty('--pitch', pitch + 'deg'); c.style.setProperty('--zoom', S.zoom);
    const ly = wrap(yaw); faceVars(V.front, ly, pitch); faceVars(V.back, wrap(yaw - 180), pitch);
    V.side.textContent = Math.abs(ly) < 90 ? '正面' : '背面';
    requestAnimationFrame(tick);
  }

  // ---------- 對外 ----------
  window.GDCards = {
    RARITY, RARITY_ORDER, CATEGORY,
    mount(container, list, o = {}) {
      ensureStyle(); this.unmount(); opts = o; cards = list || [];
      root = h('section', 'gdc-club'); root.setAttribute('aria-label', 'GD 卡冊');
      container.replaceChildren(root); render(); return root;
    },
    update(list) { cards = list || []; render(); },
    open(id) { const c = cards.find((x) => x.id === id && x.owned); if (c) openViewer(c); },
    close: closeViewer,
    unmount() {
      closeViewer(); root?.remove(); root = null;
      if (V) { V.el.remove(); V = null; } pointers.clear();
      toastEl?.remove(); toastEl = null;
    },
  };
})();
