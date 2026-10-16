/* GD 商城與鑽石商城（大廳）：只負責顯示，方案、獎池、機率、單曲、分享規則都由後台（GDBO）提供。
 * - GD 商城：方案改讀 GET /shop/products（登入：/me/shop/products，含首購倍數）；分 G幣、鑽石兩頁。
 *   點方案 → 選付款方式時建立訂單（POST /me/shop/orders）→ 付款。金流還沒接：DEV 用「確認付款（測試）」呼叫 /dev/shop/orders/:id/pay。
 * - 鑽石商城（GD 禮物 → 原「轉點」分頁）：獎池、公開機率、保底進度、單抽／十連、結果（卡片用卡冊閃卡觀看器、單曲可試聽）、分享到家族。
 * - 家族聊天室的分享訊息：點開 → POST /me/shares/:id/open（看卡面或聽歌，符合條件領 G幣紅利）。
 * 需要 gd-api.js（window.GD_API）；gd-live.js 提供 window.GDRefresh（更新餘額）。
 */
(() => {
  'use strict';
  if (window.GDShop) return;
  const API = window.GD_API;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => Number(n || 0).toLocaleString('en-US');
  const pct = (x) => (x * 100 >= 1 ? (x * 100).toFixed(2) : (x * 100).toFixed(3)) + '%';
  const logged = () => !!(API && API.isLoggedIn());
  const call = (path, opts) => API.call(path, opts);
  const refreshWallet = () => { try { window.GDRefresh && window.GDRefresh(); } catch (e) { /* ignore */ } };
  const toast = (m) => {
    let t = $('.gds-toast');
    if (!t) { t = document.createElement('div'); t.className = 'gds-toast'; document.body.append(t); }
    t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200);
  };
  const loadScript = (src) => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.append(s); });
  let cardMeta = null;
  async function cardViewer() {
    if (!window.GDCards) await loadScript('cards/gd-cards.js?v=20261017a');
    if (!cardMeta) cardMeta = (await call('/cards')).meta;
    return cardMeta;
  }
  async function showCard(card) { try { const meta = await cardViewer(); window.GDCards.preview(card, meta); } catch (e) { toast('卡片載入失敗'); } }

  const css = `
.shop-balance>b:first-of-type{margin-left:auto}.shop-balance [data-dia]{color:#7ad8ff;margin-left:14px}
.gds-tabs{display:flex;gap:6px;margin:0 0 10px}.gds-tabs button{flex:1;border:1px solid #4e578c;background:#111838;color:#aeb8e8;border-radius:999px;padding:8px;font:inherit;font-weight:900;cursor:pointer}
.gds-tabs button.on{background:linear-gradient(100deg,#783dff,#ff3d9e);color:#fff;border-color:#ff6ec7}
.credit-option .gds-badge{position:absolute;top:8px;right:8px;font-size:11px;font-weight:900;color:#4a2b00;background:linear-gradient(#ffe9a0,#ffb63c);border-radius:6px;padding:2px 6px}
.credit-option{position:relative}.credit-option .gds-old{font-size:12px;color:#aeb8e8;text-decoration:line-through;margin-left:6px}
.gds-toast{position:fixed;left:50%;bottom:90px;transform:translate(-50%,20px);background:#000d;color:#fff;border:1px solid #fff3;padding:9px 16px;border-radius:99px;font-size:14px;opacity:0;transition:.25s;pointer-events:none;z-index:2147482500;max-width:86vw;text-align:center}
.gds-toast.show{opacity:1;transform:translate(-50%,0)}
.gds-pool{border:1px solid #ff70c8;border-radius:16px;padding:14px;background:linear-gradient(135deg,#2a1450,#14183a);color:#f8faff;margin-bottom:12px}
.gds-pool h3{margin:0 0 4px;font-size:18px}.gds-pool p{margin:2px 0;color:#c9cdee;font-size:13px}
.gds-dia{display:flex;align-items:center;justify-content:space-between;margin:0 0 10px;padding:10px 14px;border-radius:12px;background:#0d1430;border:1px solid #3f4879;color:#f8faff;font-weight:900}
.gds-dia b{color:#7ad8ff;font-size:18px}.gds-dia button{border:0;border-radius:999px;padding:6px 12px;font:inherit;font-weight:900;background:linear-gradient(180deg,#ffd166,#f4a51c);color:#4a2b00;cursor:pointer}
.gds-draw{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.gds-draw button{border:0;border-radius:12px;padding:12px 6px;font:inherit;font-weight:900;font-size:16px;cursor:pointer;color:#fff;background:linear-gradient(100deg,#783dff,#ff3d9e)}
.gds-draw button small{display:block;font-size:12px;opacity:.9}.gds-draw button:disabled{opacity:.5}
.gds-pity{height:6px;border-radius:6px;background:#0005;overflow:hidden;margin:8px 0 2px}.gds-pity i{display:block;height:100%;background:linear-gradient(90deg,#fff6c8,#ffd36e)}
.gds-link{border:0;background:none;color:#ffd166;font:inherit;font-size:13px;text-decoration:underline;cursor:pointer;padding:4px 0}
.gds-odds{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}.gds-odds td{padding:5px 6px;border-bottom:1px solid #434b79;color:#dce2ff}.gds-odds td:last-child{text-align:right}
.gds-layer{position:fixed;inset:0;z-index:2147481000;background:#050817e6;display:flex;flex-direction:column;align-items:center;justify-content:safe center;padding:calc(16px + env(safe-area-inset-top,0px)) 16px calc(16px + env(safe-area-inset-bottom,0px));overflow:auto;color:#f8faff;font-family:inherit}
.gds-layer[hidden]{display:none}.gds-layer h3{margin:0 0 4px}.gds-layer .gds-sum{color:#ffd166;font-weight:900;margin-bottom:10px}
.gds-res{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;width:min(100%,720px)}
.gds-item{border:1px solid #4e578c;border-radius:14px;background:#111838;padding:10px;display:flex;flex-direction:column;gap:6px;animation:gds-in .4s both}
.gds-item.rare{border-color:#ffd166;box-shadow:0 0 18px #ffd16655}
@keyframes gds-in{from{opacity:0;transform:translateY(10px) scale(.96)}to{opacity:1;transform:none}}
.gds-item .t{font-weight:900;font-size:14px;line-height:1.3}.gds-item small{color:#aeb8e8;font-size:12px}
.gds-item .tag{display:inline-block;font-size:11px;font-weight:900;padding:1px 6px;border-radius:5px;background:#ffd166;color:#4a2b00;margin-right:4px}
.gds-item .tag.new{background:#2fe39a;color:#033}.gds-item .tag.pity{background:#ff6ec7;color:#fff}
.gds-item .row{display:flex;gap:6px;flex-wrap:wrap}.gds-item button{border:1px solid #5d66a0;background:#222b57;color:#ffd166;border-radius:8px;padding:5px 8px;font:inherit;font-size:12px;cursor:pointer}
.gds-close{margin-top:14px;border:0;border-radius:999px;padding:10px 26px;font:inherit;font-weight:900;background:linear-gradient(180deg,#ffd166,#f4a51c);color:#4a2b00;cursor:pointer}
.msg.share{display:block;text-align:left;cursor:pointer;border:1px solid #ff70c8;background:linear-gradient(135deg,#2a1450,#14183a);color:#f8faff;border-radius:12px;padding:8px 10px;margin:6px 0;font:inherit;width:100%}
.msg.share small{display:block;color:#aeb8e8}.msg.share em{font-style:normal;color:#ffd166;font-weight:900}`;
  const style = document.createElement('style'); style.textContent = css; document.head.append(style);

  // ---------- GD 商城 ----------
  let products = [], kind = 'GCOIN', selected = null, order = null;
  const grid = $('#creditGrid');
  const plansPage = $('[data-shop-page="plans"]');
  const tabs = document.createElement('div'); tabs.className = 'gds-tabs';
  tabs.innerHTML = '<button type="button" data-kind="GCOIN">G幣</button><button type="button" data-kind="DIAMOND">💎 鑽石</button>';
  if (plansPage && grid) {
    plansPage.insertBefore(tabs, plansPage.firstChild);
    const title = $('.shop-section-title', plansPage); if (title) title.remove();
  }
  tabs.addEventListener('click', (e) => { const b = e.target.closest('[data-kind]'); if (b) { kind = b.dataset.kind; renderProducts(); } });
  const unit = (k) => (k === 'DIAMOND' ? '鑽石' : 'G幣 (G Coin)');
  function renderProducts() {
    $$('button', tabs).forEach((b) => b.classList.toggle('on', b.dataset.kind === kind));
    if (!grid) return;
    const list = products.filter((p) => p.kind === kind);
    grid.innerHTML = list.length ? list.map((p) => `<button class="credit-option" data-product="${p.id}"${p.soldOut ? ' disabled' : ''}>${p.badge && p.firstAvailable !== false ? `<em class="gds-badge">${esc(p.badge)}</em>` : ''}<small>${esc(p.name)}</small><b>${num(p.credit)}${p.credit !== p.amount + p.bonus ? `<span class="gds-old">${num(p.amount + p.bonus)}</span>` : ''}</b><span>NT$ ${num(p.priceNtd)}${p.soldOut ? '・已達限購' : ''}</span></button>`).join('')
      : '<p class="shop-note">目前沒有上架的方案</p>';
    $$('[data-product]', grid).forEach((b) => b.onclick = () => {
      selected = products.find((p) => String(p.id) === b.dataset.product); order = null;
      $('#selectedCredit').textContent = num(selected.credit);
      const u = $('#selectedCredit')?.nextElementSibling; if (u) u.textContent = unit(selected.kind);
      $('#paymentAmount').textContent = num(selected.priceNtd);
      window.showShop && window.showShop('methods');
    });
  }
  async function loadProducts() {
    try {
      const r = await call(logged() ? '/me/shop/products' : '/shop/products');
      products = r.products || [];
      renderProducts();
    } catch (e) { /* 留著原本畫面 */ }
  }
  const openShopBtn = $('#openShop');
  if (openShopBtn) openShopBtn.addEventListener('click', () => { kind = 'GCOIN'; loadProducts(); });
  const note = $('[data-shop-page="plans"] .shop-note');
  const payButton = $('.payment-demo');
  if (payButton) payButton.textContent = '確認付款（測試）';
  const payNote = $('.pay-detail .shop-note');
  if (payNote) payNote.textContent = '金流尚未串接：DEV 按「確認付款（測試）」即視為付款成功並入帳，不會收集卡號、帳密或任何付款資料。';
  // 選付款方式時建立真的訂單
  $$('[data-method]').forEach((b) => b.addEventListener('click', async () => {
    const rows = $$('.pay-detail .pay-row b');
    $('.pay-result')?.remove();
    order = null;
    if (rows[1]) rows[1].textContent = '—';
    if (rows[2]) { rows[2].textContent = '等待付款'; rows[2].style.color = ''; }
    if (payButton) { payButton.disabled = true; payButton.textContent = '確認付款（測試）'; }
    if (!selected) { window.showShop && window.showShop('plans'); return; }
    if (!logged()) { toast('請先登入'); window.showShop && window.showShop('plans'); return; }
    try {
      order = await call('/me/shop/orders', { method: 'POST', body: { productId: selected.id } });
      if (rows[1]) rows[1].textContent = order.id.slice(0, 8).toUpperCase();
      if (rows[0]) rows[0].textContent = 'NT$ ' + num(order.priceNtd);
      if (payButton) payButton.disabled = false;
    } catch (e) { toast(e.code === 'ERR_PRODUCT_LIMIT' ? '這個方案已達購買上限' : e.message); }
  }));
  if (payButton) payButton.onclick = async () => {
    if (!logged()) return toast('請先登入');
    if (!order) return toast('請重新選擇付款方式');
    payButton.disabled = true; payButton.textContent = '處理中…';
    try {
      const r = await call(`/dev/shop/orders/${order.id}/pay`, { method: 'POST' });
      const rows = $$('.pay-detail .pay-row b');
      if (rows[2]) { rows[2].textContent = '付款成功 ✓'; rows[2].style.color = '#2fe39a'; }
      payButton.textContent = '已完成付款';
      refreshWallet();
      $('.pay-result')?.remove();
      $('.pay-detail').insertAdjacentHTML('beforeend', `<div class="pay-result"><b>購買成功 +${num(r.credit)} ${r.kind === 'DIAMOND' ? '鑽石' : 'G幣'}</b><small>${r.firstPurchase ? '首購加倍已套用' : ''}</small><div><button type="button" data-pay-again>再買一筆</button>${r.kind === 'DIAMOND' ? '<button type="button" class="ghost" data-go-gacha>前往鑽石商城</button>' : ''}</div></div>`);
      $('[data-pay-again]').onclick = () => { $('.pay-result')?.remove(); loadProducts(); window.showShop && window.showShop('plans'); };
      const go = $('[data-go-gacha]'); if (go) go.onclick = () => { $('#shopLayer').hidden = true; openGacha(); };
      order = null;
    } catch (e) {
      toast(e.code === 'ERR_NOT_FOUND' ? '金流尚未開放，請稍後再試' : e.message);
      payButton.disabled = false; payButton.textContent = '確認付款（測試）';
    }
  };
  if (note) note.textContent = '方案由後台設定。測試期間：選方案 → 選付款方式 → 確認付款即完成（暫代金流，不會實際扣款）。';

  // ---------- 鑽石商城 ----------
  const gTab = $('[data-gift-main="transfer"]');
  const gPage = $('[data-gift-page="transfer"]');
  if (gTab) gTab.textContent = '鑽石商城';
  let pools = [], diamonds = 0, busy = false;
  async function loadGacha() {
    if (!gPage) return;
    try {
      const r = await call(logged() ? '/me/gacha/pools' : '/gacha/pools');
      pools = r.pools || []; diamonds = r.diamonds || 0;
    } catch (e) { pools = []; }
    renderGacha();
  }
  function renderGacha() {
    if (!gPage) return;
    gPage.innerHTML = `<div class="gds-dia"><span>我的鑽石 <b>💎 ${num(diamonds)}</b></span><button type="button" data-buy-dia>購買鑽石</button></div>` +
      (pools.length ? pools.map((p) => {
        const left = p.pityCount ? Math.max(0, p.pityCount - p.pitySince) : 0;
        return `<div class="gds-pool"><h3>${esc(p.name)}</h3>
          <p>每抽必得卡片或魔曲單曲，另送 ${num(p.priceSingle * p.coinPerDiamond)} G幣${p.dupSongCoins ? `；重複單曲改送 ${num(p.dupSongCoins)} G幣` : ''}</p>
          ${p.pityCount ? `<p>保底：${p.pityCount} 抽內必出 ${esc(p.pityRarity)} 以上卡片（還差 ${left} 抽）</p><div class="gds-pity"><i style="width:${Math.min(100, (p.pitySince / p.pityCount) * 100)}%"></i></div>` : ''}
          <div class="gds-draw"><button type="button" data-draw="${p.id}" data-n="1">單抽<small>💎 ${num(p.priceSingle)}</small></button><button type="button" data-draw="${p.id}" data-n="10">十連<small>💎 ${num(p.priceTen)}</small></button></div>
          <button type="button" class="gds-link" data-odds="${p.id}">查看機率</button><div class="gds-odds-box" data-odds-box="${p.id}" hidden></div></div>`;
      }).join('') : '<div class="gift-blank"><div><strong>鑽石商城</strong><p>獎池準備中，敬請期待。</p></div></div>') +
      '<button type="button" class="gds-link" data-history>我的抽獎紀錄</button><div data-history-box hidden></div>';
    $('[data-buy-dia]', gPage).onclick = () => { $('#giftLayer').hidden = true; $('#openShop')?.click(); kind = 'DIAMOND'; renderProducts(); };
    $$('[data-draw]', gPage).forEach((b) => b.onclick = () => doDraw(Number(b.dataset.draw), Number(b.dataset.n)));
    $$('[data-odds]', gPage).forEach((b) => b.onclick = () => {
      const p = pools.find((x) => String(x.id) === b.dataset.odds), box = $(`[data-odds-box="${b.dataset.odds}"]`, gPage);
      box.hidden = !box.hidden;
      if (!box.hidden) box.innerHTML = `<table class="gds-odds">${p.odds.rarities.map((r) => `<tr><td>卡片 ${esc(r.rarity)} ${esc(r.name)}（${r.cards} 張，每張 ${pct(r.perCard)}）</td><td>${pct(r.rate)}</td></tr>`).join('')}<tr><td>魔曲單曲（${p.odds.songs} 首，每首 ${pct(p.odds.perSong)}）</td><td>${pct(p.odds.songRate)}</td></tr></table>`;
    });
    $('[data-history]', gPage).onclick = async () => {
      const box = $('[data-history-box]', gPage); box.hidden = !box.hidden;
      if (box.hidden || !logged()) return;
      const { draws } = await call('/me/gacha/history');
      box.innerHTML = draws.length ? `<table class="gds-odds">${draws.map((d) => `<tr><td>${new Date(d.at).toLocaleString('zh-TW', { hour12: false })}<br>${esc(d.item)}${d.duplicate ? '（重複）' : ''}</td><td>+${num(d.coins)} G</td></tr>`).join('')}</table>` : '<p class="shop-note">還沒有抽獎紀錄</p>';
    };
  }
  const RARE = ['UR', 'LR', 'GDR'];
  async function doDraw(poolId, n) {
    if (!logged()) return toast('請先登入');
    if (busy) return;
    const p = pools.find((x) => x.id === poolId);
    if (diamonds < (n === 1 ? p.priceSingle : p.priceTen)) { toast('鑽石不足，請先購買鑽石'); return; }
    busy = true; $$('[data-draw]', gPage).forEach((b) => b.disabled = true);
    try {
      const r = await call(`/me/gacha/pools/${poolId}/draw`, { method: 'POST', body: { count: n }, idempotent: true });
      diamonds = r.diamonds;
      showResults(r);
      refreshWallet();
      try { window.GDAudio && window.GDAudio.reload && window.GDAudio.reload(); } catch (e) { /* ignore */ }
      loadGacha();
    } catch (e) { toast(e.code === 'ERR_INSUFFICIENT_DIAMONDS' ? '鑽石不足，請先購買鑽石' : e.code === 'ERR_POOL_CLOSED' ? '這個獎池目前沒有開放' : e.message); } finally { busy = false; $$('[data-draw]', gPage).forEach((b) => b.disabled = false); }
  }
  let layer = null, audio = null, audioId = null;
  function ensureLayer() {
    if (layer) return layer;
    layer = document.createElement('div'); layer.className = 'gds-layer'; layer.hidden = true; document.body.append(layer);
    return layer;
  }
  function stopAudio() { if (audio) { audio.pause(); audio = null; } }
  function showResults(r) {
    const l = ensureLayer();
    l.innerHTML = `<h3>抽獎結果</h3><div class="gds-sum">獲得 ${num(r.coins)} G幣・剩餘 💎 ${num(r.diamonds)}</div><div class="gds-res">${r.draws.map((d, i) => d.kind === 'CARD'
      ? `<div class="gds-item${RARE.includes(d.card.rarity) ? ' rare' : ''}" style="animation-delay:${i * 0.08}s"><div>${d.pity ? '<span class="tag pity">保底</span>' : ''}${d.duplicate ? '' : '<span class="tag new">NEW</span>'}<span class="tag">${esc(d.card.rarity)}</span></div><div class="t">${esc(d.card.code)} ${esc(d.card.name)}</div><small>戰鬥力 ${num(d.card.power)}${d.duplicate ? '・重複' : ''}</small><small>+${num(d.coins)} G幣</small><div class="row"><button type="button" data-view="${i}">看卡面</button><button type="button" data-share="${i}">分享到家族</button></div></div>`
      : `<div class="gds-item" style="animation-delay:${i * 0.08}s"><div>${d.duplicate ? '' : '<span class="tag new">NEW</span>'}<span class="tag">單曲</span></div><div class="t">🎵 ${esc(d.song.title)}</div><small>${esc(d.song.album)}${d.duplicate ? '・重複' : '・已解鎖'}</small><small>+${num(d.coins)} G幣</small><div class="row"><button type="button" data-play="${i}">試聽</button><button type="button" data-share="${i}">分享到家族</button></div></div>`).join('')}</div><button type="button" class="gds-close">關閉</button>`;
    l.hidden = false;
    $('.gds-close', l).onclick = () => { stopAudio(); l.hidden = true; };
    $$('[data-view]', l).forEach((b) => b.onclick = () => showCard(r.draws[Number(b.dataset.view)].card));
    $$('[data-play]', l).forEach((b) => b.onclick = () => {
      const d = r.draws[Number(b.dataset.play)];
      if (audio && audioId === d.song.id) { stopAudio(); b.textContent = '試聽'; return; }
      stopAudio(); audio = new Audio(d.song.src); audioId = d.song.id; audio.play().catch(() => {});
      $$('[data-play]', l).forEach((x) => x.textContent = '試聽'); b.textContent = '停止';
    });
    $$('[data-share]', l).forEach((b) => b.onclick = async () => {
      const d = r.draws[Number(b.dataset.share)];
      try {
        const s = await call('/me/shares', { method: 'POST', body: { kind: d.kind, id: d.kind === 'CARD' ? d.card.id : d.song.id } });
        b.disabled = true; b.textContent = '已分享';
        toast(`已分享到家族聊天室（今天還能分享 ${s.remainingToday} 次）`);
      } catch (e) { toast(e.code === 'ERR_SHARE_NO_FAMILY' ? '加入家族後才能分享' : e.code === 'ERR_SHARE_DAILY_LIMIT' ? '今天的分享次數已用完' : e.message); }
    });
  }
  function openGacha() {
    const g = $('#giftLayer'); if (!g) return;
    g.hidden = false; gTab?.click();
  }
  if (gTab) gTab.addEventListener('click', loadGacha);
  $('#openGift')?.addEventListener('click', () => { if (gTab?.classList.contains('active')) loadGacha(); });

  // ---------- 家族分享 ----------
  const REWARD = { PAID: (a) => `獲得分享紅利 ${num(a)} G幣！`, CLAIMED: () => '這則分享的紅利已經領過了', OWN_SHARE: () => '這是你自己的分享', VIP_TOO_LOW: () => 'VIP 2 以上才能領分享紅利',
    JOINED_TOO_RECENTLY: () => '加入家族滿 72 小時後才能領分享紅利', DAILY_LIMIT: () => '今天可領的分享紅利已達上限', SOLD_OUT: () => '今天的分享紅利已發完' };
  async function openShare(id) {
    try {
      const r = await call(`/me/shares/${encodeURIComponent(id)}/open`, { method: 'POST' });
      const msg = (REWARD[r.reward.status] || (() => ''))(r.reward.amount);
      if (r.reward.status === 'PAID') refreshWallet();
      if (r.kind === 'CARD') { await showCard(r.item); if (msg) toast(msg); return; }
      const l = ensureLayer();
      l.innerHTML = `<h3>🎵 ${esc(r.item.title)}</h3><div class="gds-sum">${esc(r.item.album)}・${esc(r.sharer.nickname || r.sharer.aid)} 分享</div>${msg ? `<p>${esc(msg)}</p>` : ''}<audio controls autoplay src="${esc(r.item.src)}"></audio><button type="button" class="gds-close">關閉</button>`;
      l.hidden = false;
      $('.gds-close', l).onclick = () => { $('audio', l)?.pause(); l.hidden = true; };
    } catch (e) { toast(e.message); }
  }
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-share-open]'); if (b) openShare(b.dataset.shareOpen); });

  loadProducts();
  window.GDShop = { loadProducts, loadGacha, openShare, openGacha, openDiamond: openGacha };
})();
