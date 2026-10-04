/* 優惠鎖定錢包（GDBO 第 6 期）：進遊戲前確認優惠、錢包頁解鎖進度與領回。
 * 在 gd-live.js 之後載入；只使用 GD_API 與畫面既有元素。 */
(() => {
  const api = window.GD_API;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const coins = (v) => { const n = Number(v || 0); return n.toLocaleString(undefined, Number.isInteger(n) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const GAME_NAMES = { 'sha:plinko': '珠珠寶貝' };
  if (typeof lkgProducts === 'object') Object.entries(lkgProducts).forEach(([name, pid]) => (GAME_NAMES['lks:' + pid] = name));
  const STATUS = { ACTIVE: '鎖定中・尚未投注', ACTIVE_STARTED: '鎖定中・流水任務進行中', CLAIMABLE: '已達標・可領取', CLAIMED: '已領回', EXPIRED_UNUSED: '7 日未投注・已退回本金', FORCED_SETTLED: '已由客服特殊結算' };
  const OPEN = ['ACTIVE', 'ACTIVE_STARTED', 'CLAIMABLE'];
  const ERRORS = {
    ERR_PROMOTION_NOT_AVAILABLE: '這個優惠目前無法領取',
    ERR_PROMOTION_LIMIT: '進行中的優惠已達上限，請先完成或領回',
    ERR_PROMOTION_ALREADY_TAKEN: '這個優惠已經領過了',
    ERR_PROMOTION_NOT_CLAIMABLE: '流水尚未達標，暫時不能領取',
    ERR_PROMOTION_VIP_TOO_LOW: 'VIP 等級不足，無法領取這個優惠',
  };
  const message = (err) => ERRORS[err.code] || err.message;

  const style = document.createElement('style');
  style.textContent = `
    .gd-promo{border:0;padding:0;background:transparent;max-width:min(420px,calc(100% - 32px));width:100%;overflow:visible}
    .gd-promo::backdrop{background:#000a}
    .gd-promo-card{width:100%;box-sizing:border-box;max-height:calc(100dvh - 32px);overflow:auto;border-radius:20px;background:linear-gradient(155deg,#171f49,#0d1430);color:#f8faff;border:2px solid #783dff;box-shadow:0 18px 70px #000c,0 0 20px #783dff55;padding:18px;display:grid;gap:12px}
    .gd-promo-card h3{margin:0;text-align:center;font-size:19px;background:linear-gradient(100deg,#ffd166,#ff8a3d);-webkit-background-clip:text;background-clip:text;color:transparent}
    .gd-promo-card p{margin:0;font-size:12px;line-height:1.6;color:#aeb8e8}
    .gd-tier{display:grid;grid-template-columns:1fr auto;gap:4px 10px;align-items:center;border:1px solid #4d5688;border-radius:14px;background:#151d42;padding:12px}
    .gd-tier b{font-size:16px}.gd-tier b em{font-style:normal;color:#ffd166}
    .gd-tier small{grid-column:1;color:#aeb8e8;font-size:12px}
    .gd-tier button,.gd-promo-skip,.gd-claim{font:inherit;font-weight:900;border:0;border-radius:999px;padding:9px 14px;cursor:pointer;background:linear-gradient(90deg,#783dff,#ff3d9e);color:#fff}
    .gd-tier button{grid-row:1 / span 2;grid-column:2}
    .gd-promo-skip{background:#222b57;color:#ffd166;border:1px solid #ffd166}
    .gd-promo-cancel{font:inherit;background:none;border:0;color:#aeb8e8;cursor:pointer}
    .gd-promo button:disabled{opacity:.5;cursor:wait}
    .unlock-row .progress{transform-origin:left center}
    .unlock-row .progress span{width:0;transition:width 1.1s cubic-bezier(.22,1.2,.36,1)}
    .unlock-row .progress.gd-grow{animation:gdStretch .7s ease-out .25s}
    @keyframes gdStretch{0%{transform:scale(1,1)}35%{transform:scale(1.03,2.1)}65%{transform:scale(.99,.8)}100%{transform:scale(1,1)}}
    .unlock-row.gd-ready{box-shadow:0 0 0 2px #ffd166,0 0 18px #ffd16688}
    .gd-claim{margin-top:10px;width:100%;background:linear-gradient(90deg,#ffd166,#ff8a3d);color:#4b251b;animation:gdBreath 1.6s ease-in-out infinite}
    @keyframes gdBreath{50%{transform:scale(1.04)}}
    .gd-breakdown{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;font-size:11px;color:#977362}
    .gd-breakdown span{background:#ffffff14;color:#ffd166;border-radius:7px;padding:4px 6px}
    .gd-empty{text-align:center;padding:18px;color:#957060;font-size:13px}
    .gd-coin{position:fixed;z-index:120;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;pointer-events:none;
      background:radial-gradient(circle at 35% 30%,#fff7c2,#ffd166 40%,#e39b16 75%,#a8650c);box-shadow:0 0 8px #ffd166aa;
      display:grid;place-items:center;font:900 13px/1 system-ui;color:#8a4b0a}
    .gd-bump{animation:gdBump .45s ease}
    @keyframes gdBump{40%{transform:scale(1.35)}}
  `;
  document.head.appendChild(style);

  // ---------- 音效（WebAudio 合成，不需音檔） ----------
  let audio;
  function coinSound(count = 6) {
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      const now = audio.currentTime;
      for (let i = 0; i < count; i++) {
        const t = now + i * 0.07;
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(988 + i * 110, t);
        osc.frequency.exponentialRampToValueAtTime(1976 + i * 160, t + 0.08);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        osc.connect(gain).connect(audio.destination);
        osc.start(t);
        osc.stop(t + 0.25);
      }
    } catch { /* 沒有音效裝置時略過 */ }
  }

  // ---------- 金幣飛向 Header 餘額 ----------
  function coinBurst(from, count = 14) {
    const target = $('#balance') || $('.coin');
    if (!from || !target || reduceMotion || document.hidden) return Promise.resolve();
    const a = from.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    const sx = a.left + a.width / 2, sy = a.top + a.height / 2;
    const tx = b.left + b.width / 2, ty = b.top + b.height / 2;
    const flights = Array.from({ length: count }, (_, i) => {
      const coin = document.createElement('div');
      coin.className = 'gd-coin';
      coin.textContent = 'G';
      coin.style.left = sx + 'px';
      coin.style.top = sy + 'px';
      document.body.appendChild(coin);
      const spreadX = (Math.random() - 0.5) * 160, spreadY = -60 - Math.random() * 90;
      const anim = coin.animate([
        { transform: 'translate(0,0) scale(.4) rotate(0deg)', opacity: 0 },
        { transform: `translate(${spreadX}px,${spreadY}px) scale(1.1) rotate(${180 + Math.random() * 180}deg)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${tx - sx}px,${ty - sy}px) scale(.55) rotate(720deg)`, opacity: 0.9 },
      ], { duration: 900 + Math.random() * 250, delay: i * 45, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' });
      return anim.finished.then(() => coin.remove());
    });
    // 最多等 2 秒，避免動畫被暫停時卡住領取流程
    return Promise.race([Promise.all(flights), new Promise((r) => setTimeout(r, 2000))]).then(() => {
      target.classList.remove('gd-bump');
      void target.offsetWidth;
      target.classList.add('gd-bump');
    });
  }

  // ---------- 進遊戲前確認優惠 ----------
  // 用 <dialog> 的 top layer，才能疊在遊戲啟動視窗（也是 dialog）之上
  const layer = document.createElement('dialog');
  layer.className = 'gd-promo';
  document.body.appendChild(layer);

  /** 有可領優惠時讓玩家選方案或直接進入；回傳 true 表示繼續進遊戲。 */
  async function confirmPromotion(provider, gameId, gameName) {
    const [{ offers }, { promotions }] = await Promise.all([
      api.call(`/promotions/offers?provider=${provider}&gameId=${encodeURIComponent(gameId)}`),
      api.call('/promotions/me'),
    ]);
    // 已有這款遊戲的鎖定錢包：直接用它進遊戲
    if (promotions.some((p) => p.provider === provider && p.gameId === gameId && OPEN.includes(p.status))) return true;
    if (!offers.length) return true;
    const options = offers.flatMap((o) => o.tiers.map((t) => ({ offer: o, tier: t })));
    return new Promise((resolve) => {
      layer.innerHTML = `<div class="gd-promo-card" role="dialog" aria-label="優惠確認">
        <h3>${esc(gameName)}・專屬優惠</h3>
        ${options.map((o, i) => `<div class="gd-tier"><b>轉入 <em>${coins(o.tier.principal)}</em> 送 <em>${coins(o.tier.bonus)}</em></b>
          <small>${esc(o.offer.name)}・流水達 ${coins(o.tier.wagerTarget)} 後可領回</small><button data-i="${i}">領取並進入</button></div>`).join('')}
        <p>確認後會從主錢包轉入本金，連同優惠金幣鎖定在「${esc(gameName)}」。遊戲中先使用優惠金幣，完成流水後在錢包頁領回。開始投注後不能退回；7 日內都沒投注會自動退回本金。</p>
        <button class="gd-promo-skip">不使用優惠，直接進入</button>
        <button class="gd-promo-cancel">取消</button>
      </div>`;
      layer.showModal();
      const close = (go) => { layer.onclose = null; layer.close(); resolve(go); };
      layer.onclose = () => resolve(false);
      $('.gd-promo-skip', layer).onclick = () => close(true);
      $('.gd-promo-cancel', layer).onclick = () => close(false);
      $$('[data-i]', layer).forEach((b) => (b.onclick = async () => {
        const { offer, tier } = options[Number(b.dataset.i)];
        $$('button', layer).forEach((x) => (x.disabled = true));
        try {
          await api.call(`/promotions/${offer.id}/accept`, { method: 'POST', body: { tierIdx: tier.idx, gameId }, idempotent: true });
          close(true);
        } catch (err) {
          alert(message(err));
          $$('button', layer).forEach((x) => (x.disabled = false));
        }
      }));
    });
  }

  // ---------- 錢包頁：解鎖進度與領回 ----------
  const lastPercent = new Map();
  let promoRows = [];

  function rowHtml(p) {
    const name = GAME_NAMES[p.provider + ':' + p.gameId] || p.gameId;
    const ready = p.status === 'CLAIMABLE';
    return `<article class="unlock-row${ready ? ' gd-ready' : ''}" data-promo="${esc(p.id)}">
      <div><b>${esc(name)}</b><small>${esc(p.promotion)} · ${esc(STATUS[p.status] || p.status)}</small></div>
      <strong>${coins(OPEN.includes(p.status) ? p.balance.total : p.principal)}</strong>
      <div class="progress"><span></span></div>
      <em>進度 ${coins(p.progress)} / ${coins(p.wagerTarget)}（<i data-pct>0</i>%）</em>
      ${OPEN.includes(p.status) ? `<div class="gd-breakdown"><span>優惠 ${coins(p.balance.bonus)}</span><span>本金 ${coins(p.balance.cash)}</span><span>鎖定派彩 ${coins(p.balance.winnings)}</span><span>流水加速 ×${p.multiplier}</span>${p.status === 'ACTIVE' && p.activationDeadline ? `<span>未投注將於 ${new Date(p.activationDeadline).toLocaleDateString()} 退回</span>` : ''}</div>` : ''}
      ${ready ? `<button class="gd-claim" data-claim-promo="${esc(p.id)}">領取 ${coins(p.balance.total)} G幣</button>` : ''}
    </article>`;
  }

  /** 進度條從上次看到的位置伸長到最新進度，數字同步滾動。 */
  function animateRows(root) {
    $$('[data-promo]', root).forEach((row) => {
      const p = promoRows.find((x) => x.id === row.dataset.promo);
      const target = Math.min(100, p.percent);
      const from = lastPercent.has(p.id) ? lastPercent.get(p.id) : 0;
      const bar = $('.progress span', row);
      const label = $('[data-pct]', row);
      lastPercent.set(p.id, target);
      const fmt = (v) => v.toFixed(target % 1 ? 1 : 0);
      // 畫面不可見（背景分頁）時動畫不會跑，直接顯示最新進度
      if (document.hidden || reduceMotion) { bar.style.width = target + '%'; label.textContent = fmt(target); return; }
      bar.style.transition = 'none';
      bar.style.width = from + '%';
      label.textContent = Math.floor(from);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        bar.style.transition = '';
        bar.style.width = target + '%';
        if (target > from && !reduceMotion) $('.progress', row).classList.add('gd-grow');
        const start = performance.now();
        const step = (t) => {
          const k = Math.min(1, (t - start) / 1100);
          label.textContent = fmt(from + (target - from) * (1 - Math.pow(1 - k, 3)));
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }));
    });
  }

  async function renderWallet() {
    if (!api.isLoggedIn()) return;
    const body = $('#walletLayer .wallet-body');
    const heading = $('.wallet-heading', body);
    if (!heading) return;
    const { promotions } = await api.call('/promotions/me');
    promoRows = promotions.filter((p) => OPEN.includes(p.status) || Date.now() - Date.parse(p.closedAt || 0) < 7 * 86_400_000);
    $$('.unlock-row', body).forEach((r) => r.remove());
    $('.gd-empty', body)?.remove();
    const note = $('.wallet-note', body);
    if (note) note.textContent = '優惠金幣只能在指定遊戲使用；流水達標後按「領取」，鎖定錢包內的金額會全部回到主錢包。';
    heading.insertAdjacentHTML('afterend', promoRows.length ? promoRows.map(rowHtml).join('') : '<div class="gd-empty">目前沒有進行中的優惠。進入有優惠的遊戲前，會顯示可領取的方案。</div>');
    animateRows(body);
    $$('[data-claim-promo]', body).forEach((b) => (b.onclick = () => claim(b)));
  }

  async function claim(button) {
    button.disabled = true;
    try {
      const r = await api.call(`/promotions/me/${button.dataset.claimPromo}/claim`, { method: 'POST' });
      coinSound(7);
      await coinBurst(button);
      document.dispatchEvent(new CustomEvent('gd:refresh'));
      const balance = $('#balance');
      if (balance) balance.title = `已領回 ${coins(r.returned)} G幣`;
      await renderWallet();
    } catch (err) {
      alert(message(err));
      button.disabled = false;
    }
  }

  // 打開錢包時更新；從遊戲回大廳時也更新
  $('#openWallet')?.addEventListener('click', () => renderWallet().catch(() => {}));
  window.addEventListener('pageshow', () => { if (!$('#walletLayer').hidden) renderWallet().catch(() => {}); });
  window.GD_PROMO = { renderWallet, confirmPromotion, coinBurst, coinSound };
})();
