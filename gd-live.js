/* 大廳串接真實會員資料（GD 會員後端）。
 * 登入後以後端資料填入 Header、會員中心、錢包、商城儲值、禮物、家族（建立、邀請、私訊）與家族排行。
 * 本檔在 index.html 主程式之後載入，直接沿用主程式的 clans、rankData、renderClans 等變數與畫面。 */
(() => {
  const api = window.GD_API;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const num = (v) => Number(v || 0).toLocaleString();
  /** 金幣金額：後端已捨去到小數兩位，有小數才顯示兩位。 */
  const coins = (v) => { const n = Number(v || 0); return n.toLocaleString(undefined, Number.isInteger(n) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  /** 版面窄的地方（Header 餘額）：百萬以上縮寫為 M／B，無條件捨去到小數兩位；完整金額在錢包頁顯示。 */
  const compact = (v) => {
    const n = Number(v || 0);
    const [div, unit] = n >= 1e9 ? [1e9, 'B'] : n >= 1e6 ? [1e6, 'M'] : [1, ''];
    return unit ? (Math.floor((n / div) * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) + unit : coins(n);
  };
  const time = (iso) => { const d = new Date(iso); return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const toast = (msg) => alert(msg);
  const ROLE = { LEADER: '家族長', VICE: '副家族長', MEMBER: '一般成員' };
  const INVITE_STATUS = { ACCEPTED: '已加入家族', DECLINED: '已拒絕邀請', EXPIRED: '邀請已過期' };
  /** 邀請倒數：剩幾天幾小時。 */
  const countdown = (iso) => { const ms = Date.parse(iso) - Date.now(); if (ms <= 0) return ''; const h = Math.floor(ms / 3_600_000); return h >= 24 ? `${Math.floor(h / 24)} 天 ${h % 24} 小時` : `${h} 小時 ${Math.floor((ms % 3_600_000) / 60_000)} 分`; };
  const inviteState = (m) => {
    const left = m.invite_status === 'PENDING' ? countdown(m.invite_expires_at) : '';
    if (m.invite_status === 'PENDING' && left) return '';
    const status = m.invite_status === 'PENDING' ? 'EXPIRED' : m.invite_status;
    const refund = m.invite_bonus && status !== 'ACCEPTED' ? '，金幣已退回族長' : m.invite_bonus && status === 'ACCEPTED' ? `，已領取 ${coins(m.invite_bonus)} 金幣` : '';
    return `<small>${INVITE_STATUS[status] || ''}${refund}</small>`;
  };
  const GIFT_STATUS = { PENDING: '等待接受', ACCEPTED: '已完成', REJECTED: '已拒收', CANCELLED: '已撤回', EXPIRED: '已逾期' };
  let me = null;

  // ---------- 登入 ----------
  const loginLayer = document.createElement('section');
  loginLayer.className = 'gd-login';
  loginLayer.hidden = true;
  loginLayer.innerHTML = `
    <style>
      .gd-login{position:fixed;inset:0;z-index:90;display:grid;place-items:center;padding:16px;background:#0008}
      .gd-login[hidden]{display:none}
      .gd-login form{width:min(360px,100%);background:var(--cream);color:var(--ink);border:2px solid var(--gold);border-radius:18px;padding:22px;display:grid;gap:12px;box-shadow:0 18px 40px #0007}
      .gd-login h2{margin:0;text-align:center;color:var(--red)}
      .gd-login input{font:inherit;padding:12px;border-radius:10px;border:1px solid #c9a35a;background:#fff;color:#222}
      .gd-login button{font:inherit;font-weight:900;padding:12px;border-radius:10px;border:0;cursor:pointer}
      .gd-login .primary{background:linear-gradient(180deg,var(--gold),#e39b16);color:#4b251b}
      .gd-login .ghost{background:transparent;color:inherit;opacity:.75}
      .gd-login small{text-align:center;opacity:.75}
      .gd-login .error{color:#d62828;text-align:center;font-weight:700}
      .gd-send{display:grid;grid-template-columns:minmax(0,1fr);gap:8px}
      .gd-send div{display:flex;gap:8px}
      .gd-send input{flex:1;width:0;font:inherit;padding:10px;border-radius:10px;border:1px solid #c9a35a}
      .gd-send button,.gd-act{font:inherit;font-weight:800;border:0;border-radius:8px;padding:8px 12px;cursor:pointer;background:linear-gradient(180deg,var(--gold),#e39b16);color:#4b251b}
      .gd-act{padding:4px 8px;margin:2px}
      .gd-act.gray{background:#ddd;color:#333}
    </style>
    <form>
      <h2>GD 會員登入</h2>
      <input name="phone" type="tel" inputmode="numeric" placeholder="手機號碼" autocomplete="tel" required>
      <input name="code" inputmode="numeric" placeholder="驗證碼" autocomplete="one-time-code" hidden>
      <div class="error" hidden></div>
      <button class="primary" type="submit">取得驗證碼</button>
      <button class="ghost" type="button" data-skip>先逛逛</button>
      <small>測試階段不會發送簡訊，驗證碼會自動填入。</small>
    </form>`;
  document.body.appendChild(loginLayer);
  const loginForm = $('form', loginLayer);
  let challengeId = null;
  const showLogin = () => { challengeId = null; loginForm.code.hidden = true; loginForm.code.value = ''; $('.primary', loginForm).textContent = '取得驗證碼'; $('.error', loginForm).hidden = true; loginLayer.hidden = false; };
  $('[data-skip]', loginForm).onclick = () => (loginLayer.hidden = true);
  loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const error = $('.error', loginForm);
    error.hidden = true;
    try {
      if (!challengeId) {
        const otp = await api.requestOtp(loginForm.phone.value.trim());
        challengeId = otp.challengeId;
        loginForm.code.hidden = false;
        loginForm.code.value = otp.devCode || '';
        $('.primary', loginForm).textContent = '登入';
      } else {
        await api.login(challengeId, loginForm.code.value.trim());
        loginLayer.hidden = true;
        await refresh();
        loadNotices().catch(() => {});
      }
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
    }
  };

  /** 需要登入的操作：未登入時開啟登入畫面並中止。 */
  const requireLogin = () => { if (me) return true; showLogin(); return false; };

  // ---------- 會員資料 ----------
  async function refresh() {
    if (!api.isLoggedIn()) return;
    try {
      const [summary, vip, profile] = await Promise.all([api.call('/me/summary'), api.call('/me/vip'), api.call('/me')]);
      me = { ...summary, vipProgress: vip, profile };
    } catch (err) {
      me = null;
      if (err.code === 'ERR_UNAUTHORIZED') showLogin();
      return;
    }
    const name = me.member.nickname || 'GD會員';
    const v = me.vipProgress;
    const level = v.level;
    me.vip.level = level; // /me/vip 已依最新儲值與投注重算
    // VIP 只看近 60 日有效投注
    const pct = v.next ? Math.min(100, Math.floor((v.rollingWager / v.next.wagerThreshold) * 100)) : 100;
    // Header
    $('#openProfile b').textContent = name;
    $('#openProfile small').textContent = 'VIP ' + level;
    const bar = $('#openProfile .vip-progress');
    bar.setAttribute('aria-valuenow', pct);
    bar.setAttribute('aria-label', `VIP 進度 ${pct}%`);
    $('i', bar).style.width = pct + '%';
    $('#balance').textContent = compact(me.mainAvailable);
    $('#balance').title = coins(me.mainAvailable);
    // 會員中心
    $('.person-head h2').textContent = name;
    $('.vip-badge').textContent = 'VIP' + level;
    const rows = $$('.profile-list li strong');
    rows[0].textContent = me.profile.aid;
    rows[1].textContent = coins(me.mainAvailable);
    rows[2].textContent = me.profile.phone;
    rows[5].innerHTML = v.next ? `投注 ${coins(v.rollingWager)} / ${num(v.next.wagerThreshold)}<br><small>達標升 VIP ${v.next.level}</small>` : `投注 ${coins(v.rollingWager)}<br><small>已達最高等級</small>`;
    $('.profile-list li button').onclick = () => navigator.clipboard?.writeText(me.profile.aid);
    // 錢包與商城
    $('.wallet-summary b').textContent = coins(me.mainAvailable);
    $('.shop-balance span').textContent = 'VIP ' + level;
    $('.shop-balance b').textContent = 'G ' + coins(me.mainAvailable);
    if (!$('#walletLayer').hidden) renderWallet();
    // 所屬家族
    loadMail().catch(() => {});
    loadMyFamily();
    loadReferral().catch(() => {});
    handleShareLink();
  }

  // ---------- 商城：模擬付款 → 後端模擬儲值 ----------
  $('.payment-demo').onclick = async () => {
    if (!requireLogin()) return;
    const amountNtd = Number($('#paymentAmount').textContent.replace(/,/g, ''));
    try {
      const r = await api.call('/dev/deposits', { method: 'POST', body: { amountNtd }, idempotent: true });
      await refresh();
      toast(`儲值成功：${num(amountNtd)} G幣，目前 VIP ${r.vipLevel}`);
    } catch (err) { toast(err.message); }
  };

  // ---------- 禮物 ----------
  async function renderGiftRules() {
    if (!me) return;
    const page = $('[data-gift-subpage="rules"]');
    const e = await api.call('/gifts/eligibility');
    $('.gift-status b', page).textContent = e.canSend ? coins(Math.min(e.dailyRemaining, me.mainAvailable)) : '0';
    $('.gift-status span', page).textContent = e.canSend ? `手續費 ${(e.feeBps / 100).toFixed(0)}%（由送出金額內扣）` : '目前 VIP 等級尚未開放贈禮';
    const metrics = $$('.gift-metric b', page);
    metrics[0].textContent = e.canSend ? coins(e.dailyRemaining) : '權限不足';
    metrics[1].textContent = e.canSend ? `${e.partnersUsed} / ${e.partnerCap} 人` : '權限不足';
    metrics[2].textContent = e.canSend ? coins(e.remainingWager) : '權限不足';
    const phone = me.profile.phoneVerified;
    metrics[3].textContent = phone ? '已開通' : '需綁定手機';
    const lock = $('.gift-lock', page);
    if (!phone) { lock.innerHTML = '<strong>請先綁定手機</strong><span>綁定手機後才能贈禮與私訊。</span>'; return; }
    if (!e.canSend) { lock.innerHTML = '<strong>VIP 2 以上即可贈禮</strong><span>儲值累積達 VIP 2 後開放。</span>'; return; }
    lock.className = 'gift-lock gd-send';
    lock.innerHTML = '<strong>四步驟安全送禮</strong><span>確認對象 → 輸入金額 → 確認明細 → 完成</span><br><button type="button">開始送禮</button>';
    $('button', lock).onclick = () => giftWizard();
  }

  /** 送禮（送禮精靈第 3 步）；成功回傳結果，失敗顯示原因並回傳 null。 */
  async function sendGift(toAid, amount) {
    try {
      const r = await api.call('/gifts', { method: 'POST', body: { toAid, amount }, idempotent: true });
      await refresh();
      return r;
    } catch (err) { toast(err.message); return null; }
  }

  const nativeRenderGiftCenter = window.renderGiftCenter;
  window.renderGiftCenter = async function () {
    if (!me) return nativeRenderGiftCenter();
    const direction = giftDirection;
    const { gifts } = await api.call('/gifts?direction=' + direction);
    giftCenterRows.innerHTML = gifts.map((g) => {
      const other = direction === 'send' ? g.receiver_nickname || g.receiver_aid : g.sender_nickname || g.sender_aid;
      const actions = g.kind === 'INVITE_BONUS' ? `入會金幣<br>${g.status === 'PENDING' ? '等待入會' : esc(GIFT_STATUS[g.status])}`
        : g.status !== 'PENDING' ? esc(GIFT_STATUS[g.status])
        : direction === 'receive' ? `<button class="gd-act" data-gift="${esc(g.id)}" data-act="accept">接受</button><button class="gd-act gray" data-gift="${esc(g.id)}" data-act="reject">拒收</button>`
        : `${GIFT_STATUS.PENDING}<br><button class="gd-act gray" data-gift="${esc(g.id)}" data-act="cancel">撤回</button>`;
      return `<tr><td>${esc(g.id.slice(0, 8).toUpperCase())}<br>${time(g.created_at)}</td><td>${esc(other)}<br>${coins(direction === 'send' ? g.amount : g.receive_amount)} 點</td><td class="gift-state">${actions}</td></tr>`;
    }).join('') || '<tr><td colspan="3">目前沒有紀錄</td></tr>';
    $$('[data-gift]', giftCenterRows).forEach((b) => (b.onclick = async () => {
      try { await api.call(`/gifts/${b.dataset.gift}/${b.dataset.act}`, { method: 'POST' }); await refresh(); renderGiftCenter(); } catch (err) { toast(err.message); }
    }));
  };

  const GIFT_RANGES = [['today', '今天'], ['7d', '近7日'], ['30d', '近1月']];
  /** 收贈紀錄：期間篩選、贈送／收到合計與明細。 */
  async function renderGiftHistory(range = 'today') {
    if (!me) return;
    const page = $('[data-gift-subpage="history"]');
    let head = $('[data-gift-range-head]', page);
    if (!head) {
      page.insertAdjacentHTML('afterbegin', `<div data-gift-range-head><div class="gift-center-tabs">${GIFT_RANGES.map(([k, t]) => `<button class="gift-center-tab" data-gift-range="${k}">${t}</button>`).join('')}</div><div class="gift-metrics"><div class="gift-metric"><small>贈送合計</small><b data-sum="sent">0</b></div><div class="gift-metric"><small>收到合計</small><b data-sum="received">0</b></div></div></div>`);
      head = $('[data-gift-range-head]', page);
      $$('[data-gift-range]', head).forEach((b) => (b.onclick = () => renderGiftHistory(b.dataset.giftRange)));
    }
    $$('[data-gift-range]', head).forEach((b) => b.classList.toggle('active', b.dataset.giftRange === range));
    const h = await api.call('/gifts/history?range=' + range);
    $('[data-sum="sent"]', head).textContent = `${coins(h.sent.amount)}（${h.sent.count} 筆）`;
    $('[data-sum="received"]', head).textContent = `${coins(h.received.amount)}（${h.received.count} 筆）`;
    $('tbody', page).innerHTML = h.gifts.map((g) => {
      const out = g.direction === 'send';
      return `<tr><td>${esc(g.id.slice(0, 8).toUpperCase())}<br>${time(g.created_at)}</td><td>${esc(out ? g.receiver_nickname || g.receiver_aid : g.sender_nickname || g.sender_aid)}<br>${coins(out ? g.amount : g.receive_amount)} 點</td><td>${g.kind === 'INVITE_BONUS' ? '入會金幣・' : ''}${out ? '送出' : '收到'}・${esc(GIFT_STATUS[g.status])}</td></tr>`;
    }).join('') || '<tr><td colspan="3">這段期間沒有紀錄</td></tr>';
    $('.gift-info', page).textContent = '含家族入會金幣；合計只計已完成（對方已接受）的紀錄，時間以台灣時間計算。';
  }

  function renderGiftWallet() {
    if (!me) return;
    const page = $('[data-gift-page="wallet"]');
    $('.gift-status small', page).textContent = '主錢包餘額';
    $('.gift-status b', page).textContent = 'G ' + coins(me.mainAvailable);
    $('.gift-safe', page).textContent = '餘額與交易紀錄由 GD 會員後端帳務系統提供。';
  }

  $('#openGift').addEventListener('click', () => { if (!requireLogin()) return; renderGiftRules(); renderGiftWallet(); });
  $$('.gift-subtab').forEach((tab) => tab.addEventListener('click', () => { if (tab.dataset.giftSub === 'history') renderGiftHistory(); }));

  // ---------- 家族 ----------
  const familyStyle = document.createElement('style');
  familyStyle.textContent = `
    .fam-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;padding:0 12px 12px}
    .fam-btn{font:inherit;font-weight:900;border:0;border-radius:10px;padding:9px 14px;cursor:pointer;background:linear-gradient(180deg,#ffd166,#e39b16);color:#4b251b;position:relative}
    .fam-btn.ghost{background:#222b57;color:#ffd166;border:1px solid #ffd16688}
    .fam-btn.danger{background:#3a1430;color:#ff8fb8;border:1px solid #ff3d9e66}
    .fam-badge{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;border-radius:9px;background:#ff3d9e;color:#fff;font-size:11px;line-height:18px;padding:0 4px}
    .fam-form{display:grid;gap:10px;max-width:420px;margin:0 auto;padding:6px 4px;text-align:left}
    .fam-form label{display:grid;gap:4px;color:#aeb8e8;font-size:13px}
    .fam-form input{font:inherit;padding:10px;border-radius:10px;border:1px solid #4d5688;background:#0d1430;color:#f8faff}
    .fam-crests{display:flex;flex-wrap:wrap;gap:6px}
    .fam-crests button{width:42px;height:42px;border-radius:50%;border:2px solid #4d5688;background:#151d42;font-size:20px;cursor:pointer}
    .fam-crests button.on{border-color:#ffd166;box-shadow:0 0 8px #ffd166}
    .fam-note{color:#aeb8e8;font-size:12px;text-align:center;margin:4px 0 0}
    .clan-member{background:#151d42;color:#f8faff;border:1px solid #2c3566}
    .clan-member .fam-who{display:flex;align-items:center;gap:8px;text-align:left;background:none;border:0;color:inherit;font:inherit;cursor:pointer;padding:0}
    .clan-member .fam-who b{font-weight:900}
    .clan-member .fam-uid{color:#ffd166;text-decoration:underline;font-size:12px}
    .clan-member small{color:#aeb8e8}
    .fam-dot{width:8px;height:8px;border-radius:50%;background:#59607f;flex:none}
    .fam-dot.on{background:#2fe39a;box-shadow:0 0 6px #2fe39a}
    .fam-role{font-size:11px;border-radius:6px;padding:1px 6px;background:#783dff55;color:#d9c8ff}
    .fam-section{padding:4px 12px 12px}
    .fam-section h4{margin:6px 0 8px;color:#ffd166}
    .fam-apply{display:flex;justify-content:space-between;align-items:center;gap:8px;background:#151d42;border-radius:9px;padding:8px 10px;margin-bottom:6px}
    .fam-sheet,.gd-chat{position:fixed;inset:0;z-index:80;display:grid;place-items:center;padding:16px;background:#050817d9}
    .fam-sheet[hidden],.gd-chat[hidden]{display:none}
    .fam-sheet{z-index:90}
    .fam-btn:disabled{opacity:.45;cursor:not-allowed}
    .gd-chat form[hidden]{display:none}
    .fam-sheet>div{width:min(360px,100%);background:linear-gradient(155deg,#171f49,#0d1430);border:2px solid #783dff;border-radius:18px;padding:18px;display:grid;gap:10px;color:#f8faff;text-align:center}
    .fam-sheet h3{margin:0;color:#ffd166}
    .fam-sheet input{font:inherit;padding:10px;border-radius:10px;border:1px solid #4d5688;background:#0d1430;color:#f8faff}
    .gd-chat>div{width:min(460px,100%);height:min(640px,calc(100dvh - 32px));display:flex;flex-direction:column;background:linear-gradient(155deg,#171f49,#0d1430);border:2px solid #783dff;border-radius:22px;overflow:hidden;color:#f8faff}
    .gd-chat header{display:flex;align-items:center;gap:8px;padding:10px 12px;background:linear-gradient(100deg,#783dff,#ff3d9e 60%,#ff8a3d)}
    .gd-chat header b{flex:1;text-align:center}
    .gd-chat header button{border:0;background:#0003;color:#fff;border-radius:8px;padding:6px 10px;font:inherit;font-weight:900;cursor:pointer}
    .gd-chat .chat-body{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px}
    .gd-chat .msg{max-width:78%;align-self:flex-start;background:#222b57;border-radius:12px 12px 12px 4px;padding:8px 10px;white-space:pre-wrap;word-break:break-word}
    .gd-chat .msg.mine{align-self:flex-end;background:#783dff;border-radius:12px 12px 4px 12px}
    .gd-chat .msg small{display:block;color:#ffffffaa;font-size:11px;margin-bottom:2px}
    .gd-chat .conv{display:flex;justify-content:space-between;gap:8px;align-items:center;text-align:left;background:#151d42;border:1px solid #2c3566;border-radius:10px;padding:10px;color:inherit;font:inherit;cursor:pointer}
    .gd-chat .conv small{display:block;color:#aeb8e8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px}
    .gd-chat form{display:flex;gap:8px;padding:10px;border-top:1px solid #35406d}
    .gd-chat form input{flex:1;width:0;font:inherit;padding:10px;border-radius:10px;border:1px solid #4d5688;background:#0d1430;color:#f8faff}
    .clan-detail .clan-back{position:static;display:block;margin:10px 12px}
    .promo-bar{height:8px;border-radius:99px;background:#ffffff1f;overflow:hidden;margin:2px 0}
    .promo-bar i{display:block;height:100%;background:linear-gradient(90deg,#783dff,#ff3d9e)}
    .gd-chat .msg.sys{align-self:center;max-width:90%;background:#ffffff14;border-radius:999px;padding:5px 12px;font-size:12px;color:#c9d0f5;text-align:center}
    .gd-chat .msg.sys.join{background:linear-gradient(90deg,#783dff55,#ff3d9e55);color:#ffe7a3}
    .gd-chat .msg.sys small{display:inline;margin:0 0 0 6px}
    .gd-chat .emoji-panel{display:grid;grid-template-columns:repeat(8,1fr);gap:2px;padding:8px 10px;border-top:1px solid #35406d;background:#0d1430}
    .gd-chat .emoji-panel[hidden]{display:none}
    .gd-chat .emoji-panel button{border:0;background:none;font-size:22px;padding:4px;border-radius:8px;cursor:pointer}
    .gd-chat .emoji-panel button:hover{background:#ffffff1a}
    .gd-chat .emoji-btn{border:1px solid #4d5688;background:#151d42;border-radius:10px;font-size:20px;padding:0 8px;cursor:pointer}
    .fam-check{display:flex;align-items:center;gap:6px;font-size:13px}
    .fam-stepper{display:grid;grid-template-columns:48px 1fr 48px;align-items:center;gap:8px}
    .fam-stepper b{text-align:center;font-size:18px;color:#ffd166}
    .fam-stepper button{height:40px;border:1px solid #ffd166;border-radius:10px;background:#222b57;color:#ffd166;font-size:16px;cursor:pointer}
    .fam-stepper button:disabled{opacity:.35;cursor:default}
    .gd-chat .chat-safe{font-size:11px;color:#aeb8e8;text-align:center;padding:6px 10px 0}
    .fam-notice{position:relative;margin:2px 14px 12px;background:#fff6d6;color:#5a3418;border-radius:14px;padding:10px 12px;font-size:13px;text-align:left;white-space:pre-wrap;word-break:break-word}
    .fam-notice:before{content:"";position:absolute;top:-8px;left:30px;border:8px solid transparent;border-top:0;border-bottom-color:#fff6d6}
    .fam-notice b{color:#b3261e}
    .fam-notice button{float:right;border:0;border-radius:8px;background:#b3261e;color:#fff;font:inherit;font-size:12px;padding:2px 8px;cursor:pointer}
    .fam-contrib{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
    .fam-contrib div{background:#151d42;border-radius:10px;padding:8px 4px;text-align:center}
    .fam-contrib small{display:block;color:#aeb8e8;font-size:11px}
    .fam-contrib b{color:#ffd166;font-size:13px}
    .fam-state{font-size:11px;color:#2fe39a}.fam-state.today{color:#ffd166}.fam-state.off{color:#7d84a6}
    .fam-sheet textarea{font:inherit;padding:10px;border-radius:10px;border:1px solid #4d5688;background:#0d1430;color:#f8faff;min-height:90px;resize:vertical}
    .gd-tabs{display:flex;gap:6px;position:sticky;top:-12px;background:#121a3f;padding:4px 0 8px;z-index:1}
    .gd-tabs button{flex:1;border:1px solid #4d5688;border-radius:10px;background:#151d42;color:#aeb8e8;font:inherit;font-weight:900;padding:8px 4px;cursor:pointer}
    .gd-tabs button.on{background:#783dff;color:#fff;border-color:#783dff}
    .gd-search{display:flex;gap:6px}.gd-search input{flex:1;width:0;font:inherit;padding:10px;border-radius:10px;border:1px solid #4d5688;background:#0d1430;color:#f8faff}
    .gw-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;font-size:11px;color:#7d84a6}
    .gw-steps span{border-top:3px solid #35406d;padding-top:4px}.gw-steps span.on{color:#ffd166;font-weight:900;border-color:#ffd166}
    .gw-card{background:#151d42;border-radius:12px;padding:10px 12px;text-align:left;display:grid;gap:6px}
    .gw-card div{display:flex;justify-content:space-between;gap:8px}.gw-card small{color:#aeb8e8}.gw-card b{color:#ffd166}`;
  document.head.appendChild(familyStyle);
  clanDetail.prepend($('#clanBack'));

  /** 後端家族資料轉成主程式 clans 的格式（多一欄 id 供查詢明細）。 */
  async function loadClans() {
    if (!me) return;
    const { families } = await api.call('/families');
    clans.splice(0, clans.length, ...families.map((f) => [f.name, f.crest || '⚔️', String(f.level), num(f.exp), `${f.member_count} / ${f.max_members}`, f.slogan || '', f.id]));
    rankData.family = families.map((f) => [f.name, f.crest || '⚔️', num(f.exp)]);
  }

  window.showClan = async function (c) {
    const f = await api.call('/families/' + c[6]);
    $('#detailCrest').innerHTML = familyIcon(esc(f.crest || '⚔️'));
    $('#detailName').textContent = f.name;
    $('#detailSlogan').textContent = f.slogan || '';
    $('#detailLevel').textContent = f.level;
    $('#detailRep').textContent = num(f.exp);
    $('#detailMembers').textContent = `${f.members.length} / ${f.max_members}`;
    const apply = me && !me.family ? `<div class="fam-actions"><button class="fam-btn" data-apply="${esc(f.id)}">申請加入</button></div>` : '';
    $('#clanMembers').innerHTML = noticeBubble(f, false) + apply + memberRows(f.members, false);
    bindMemberRows($('#clanMembers'));
    const btn = $('[data-apply]', $('#clanMembers'));
    if (btn) btn.onclick = async () => {
      try { await api.call(`/families/${btn.dataset.apply}/applications`, { method: 'POST' }); toast('已送出申請，等待家族長審核'); } catch (err) { toast(err.message); }
    };
    clanDetail.hidden = false;
  };

  const memberState = (m) => (m.online ? '<span class="fam-state">在線</span>' : m.today ? '<span class="fam-state today">今日</span>' : '<span class="fam-state off">離線</span>');

  /** 成員列表（依貢獻排序，族長戴皇冠）；點 UID 開啟私訊／送禮（自己除外）。 */
  const memberRows = (members, manage) => members.map((m) => `<div class="clan-member">
      <button class="fam-who" data-member="${esc(m.aid)}" data-name="${esc(m.nickname || m.aid)}" data-role="${m.role}"${manage ? ' data-manage' : ''}>
        <i class="fam-dot${m.online ? ' on' : ''}"></i><span><b>${m.role === 'LEADER' ? '👑 ' : ''}${esc(m.nickname || 'GD會員')}</b> <span class="fam-role">${ROLE[m.role]}</span> ${memberState(m)}<br><span class="fam-uid">UID ${esc(m.aid)}</span>　<small>VIP ${m.vip_level}</small></span>
      </button><small>貢獻 ${num(m.contribution)}</small></div>`).join('');

  /** 會長公告泡泡；editable 時顯示編輯按鈕。 */
  const noticeBubble = (f, editable) => `<div class="fam-notice"><b>📢 會長公告</b>${editable ? '<button data-notice>編輯</button>' : ''}<br>${esc(f.notice || '家族長尚未發布公告')}</div>`;

  function noticeSheet(f) {
    const s = openSheet(`<h3>編輯會長公告</h3><textarea name="notice" maxlength="500" placeholder="給家族成員的話">${esc(f.notice || '')}</textarea>`);
    $('textarea', s).insertAdjacentHTML('afterend', '<button class="fam-btn" data-send>發布公告</button>');
    $('[data-send]', s).onclick = () => familyAction('/families/me/notice', { method: 'PUT', body: { notice: $('textarea', s).value.trim() } }, '已發布公告');
  }

  const CONTRIB = [['SLOT', '電子'], ['FISH', '捕魚'], ['TABLE', '押分'], ['PLATFORM', '平台']];

  function bindMemberRows(root) {
    $$('[data-member]', root).forEach((b) => (b.onclick = () => {
      if (!me || b.dataset.member === me.profile.aid) return;
      memberSheet({ aid: b.dataset.member, name: b.dataset.name, role: b.dataset.role, manage: b.hasAttribute('data-manage') });
    }));
  }

  // 小視窗：成員動作、送禮、邀請、建立家族共用
  const sheet = document.createElement('section');
  sheet.className = 'fam-sheet';
  sheet.hidden = true;
  document.body.appendChild(sheet);
  sheet.onclick = (e) => { if (e.target === sheet) sheet.hidden = true; };
  const openSheet = (html) => { sheet.innerHTML = `<div>${html}<button class="fam-btn ghost" data-close>關閉</button></div>`; $('[data-close]', sheet).onclick = () => (sheet.hidden = true); sheet.hidden = false; return sheet; };

  function memberSheet(m) {
    const f = me.family;
    const sameFamily = f && f.members.some((x) => x.aid === m.aid);
    const isLeader = f?.myRole === 'LEADER';
    const canKick = m.manage && (isLeader || (f?.myRole === 'VICE' && m.role === 'MEMBER'));
    const s = openSheet(`<h3>${esc(m.name)}</h3><small>UID ${esc(m.aid)}</small>
      ${sameFamily ? '<button class="fam-btn" data-act="chat">💬 私訊</button>' : ''}
      <button class="fam-btn" data-act="gift">🎁 送禮</button>
      ${m.manage && isLeader ? `<button class="fam-btn ghost" data-act="role">${m.role === 'VICE' ? '改為一般成員' : '任命副家族長'}</button>` : ''}
      ${canKick ? '<button class="fam-btn danger" data-act="kick">移出家族</button>' : ''}`);
    const act = (name, fn) => { const b = $(`[data-act="${name}"]`, s); if (b) b.onclick = fn; };
    act('chat', () => { sheet.hidden = true; openChat(m.aid, m.name); });
    act('gift', () => giftWizard({ aid: m.aid, name: m.name }));
    act('role', () => familyAction(`/families/me/members/${m.aid}/role`, { method: 'PUT', body: { role: m.role === 'VICE' ? 'MEMBER' : 'VICE' } }, '已更新職位'));
    act('kick', () => { if (confirm(`確定將 ${m.name} 移出家族？`)) familyAction(`/families/me/members/${m.aid}/kick`, { method: 'POST' }, '已移出家族'); });
  }

  /** 家族操作共用：呼叫後重新整理家族面板。 */
  async function familyAction(path, opts, done) {
    try { await api.call(path, opts); sheet.hidden = true; await refresh(); if (done) toast(done); } catch (err) { toast(err.message); }
  }

  /** 送禮四步驟：1 確認對象 → 2 輸入金額 → 3 確認明細 → 4 完成。帶入對象時從第 2 步開始。 */
  async function giftWizard(preset) {
    if (!me.profile.phoneVerified) return toast('請先綁定手機才能送禮');
    const e = await api.call('/gifts/eligibility').catch((err) => (toast(err.message), null));
    if (!e) return;
    if (!e.canSend) return toast('目前 VIP 等級尚未開放贈禮');
    if (e.remainingWager > 0) return toast(`尚需有效投注 ${coins(e.remainingWager)} 才能贈禮`);
    const max = Math.min(e.dailyRemaining, me.mainAvailable);
    const steps = (n) => `<div class="gw-steps">${['確認對象', '輸入金額', '確認明細', '完成'].map((t, i) => `<span class="${i < n ? 'on' : ''}">${i + 1}. ${t}</span>`).join('')}</div>`;
    const who = (p) => `<div class="gw-card"><div><small>暱稱</small><b>${esc(p.name)}</b></div><div><small>UID</small><b>${esc(p.aid)}</b></div>${p.vip ? `<div><small>VIP／家族</small><b>VIP ${p.vip}・${esc(p.family || '無家族')}</b></div>` : ''}</div>`;
    const fee = (amt) => Math.floor((Math.round(amt * 100) * e.feeBps) / 10000) / 100;

    const pickTarget = () => {
      const s = openSheet(`${steps(1)}<h3>輸入對方 UID</h3><div class="gd-search"><input name="aid" inputmode="numeric" placeholder="對方 UID"><button class="fam-btn" data-find>查詢</button></div><div data-found></div>`);
      $('[data-find]', s).onclick = async () => {
        const aid = $('[name=aid]', s).value.trim();
        const { players } = await api.call('/social/search?q=' + encodeURIComponent(aid)).catch(() => ({ players: [] }));
        const p = players.find((x) => x.aid === aid);
        if (!p) return toast('找不到這位玩家');
        const target = { aid: p.aid, name: p.nickname || p.aid, vip: p.vip_level, family: p.family_name };
        $('[data-found]', s).innerHTML = `${who(target)}<button class="fam-btn" data-ok style="margin-top:8px">確認是這位玩家</button>`;
        $('[data-ok]', s).onclick = () => enterAmount(target);
      };
    };
    const enterAmount = (to) => {
      const s = openSheet(`${steps(2)}<h3>送禮給 ${esc(to.name)}</h3><small>本次最多可送 ${coins(max)} G幣（今日額度 ${coins(e.dailyRemaining)}・主錢包 ${coins(me.mainAvailable)}）</small>
        <input name="amount" type="number" min="0.01" step="0.01" placeholder="G幣"><button class="fam-btn" data-next>下一步</button>`);
      $('[data-next]', s).onclick = () => {
        const amt = Math.floor(Number($('[name=amount]', s).value) * 100) / 100;
        if (!(amt > 0)) return toast('請輸入贈送金額');
        if (amt > max) return toast(`超過可贈額度 ${coins(max)}`);
        confirmGift(to, amt);
      };
    };
    const confirmGift = (to, amt) => {
      const f = fee(amt);
      const s = openSheet(`${steps(3)}<h3>確認送禮明細</h3>${who(to)}<div class="gw-card"><div><small>送出</small><b>${coins(amt)}</b></div><div><small>手續費 ${(e.feeBps / 100).toFixed(0)}%</small><b>${coins(f)}</b></div><div><small>對方實收</small><b>${coins(Math.round((amt - f) * 100) / 100)}</b></div></div>
        <small>對方需在 72 小時內接受，逾期或拒收全額退回</small><button class="fam-btn" data-send>確認送出</button><button class="fam-btn ghost" data-back>修改金額</button>`);
      $('[data-back]', s).onclick = () => enterAmount(to);
      $('[data-send]', s).onclick = async (ev) => {
        ev.target.disabled = true;
        const r = await sendGift(to.aid, amt);
        if (!r) { ev.target.disabled = false; return; }
        const done = openSheet(`${steps(4)}<h3>🎁 已送出</h3><p>對方接受後可收到 ${coins(r.receiveAmount)} G幣</p><button class="fam-btn" data-center>查看禮物中心</button>`);
        $('[data-center]', done).onclick = () => { sheet.hidden = true; $('#openGift').click(); $('[data-gift-sub="center"]').click(); };
      };
    };
    if (preset) enterAmount(preset); else pickTarget();
  }

  const INVITE_STEP = 1000;
  async function inviteSheet() {
    const { inviteBonus: b } = await api.call('/families/crests');
    let bonus = b.min;
    const s = openSheet(`<h3>邀請成員</h3><small>輸入對方 UID，對方會在信箱收到邀請信，3 天內未接受即過期</small><input name="aid" inputmode="numeric" placeholder="對方 UID">
      <label class="fam-check"><input type="checkbox" name="withBonus" checked> 附贈入會金幣</label>
      <div class="fam-stepper"><button type="button" data-step="-1" aria-label="減少">▼</button><b data-bonus></b><button type="button" data-step="1" aria-label="增加">▲</button></div>
      <small>附贈金幣 ${num(b.min)}–${num(b.max)}，先從你的主錢包暫扣；對方接受即入帳（入會後 ${b.lockDays} 天內不可退出），拒絕或過期全額退回</small><button class="fam-btn" data-send>寄出邀請</button>`);
    const on = $('[name=withBonus]', s);
    const show = () => {
      $('[data-bonus]', s).textContent = on.checked ? num(bonus) + ' 金幣' : '不附金幣';
      $$('[data-step]', s).forEach((x) => (x.disabled = !on.checked || (x.dataset.step < 0 ? bonus <= b.min : bonus >= b.max)));
    };
    $$('[data-step]', s).forEach((x) => (x.onclick = () => { bonus = Math.min(b.max, Math.max(b.min, bonus + Number(x.dataset.step) * INVITE_STEP)); show(); }));
    on.onchange = show;
    show();
    $('[data-send]', s).onclick = () => {
      const amount = on.checked ? bonus : 0;
      familyAction('/families/me/invites', { method: 'POST', body: { aid: $('[name=aid]', s).value.trim(), bonus: amount } }, amount ? `已寄出邀請信，暫扣 ${num(amount)} 金幣` : '已寄出邀請信');
    };
  }

  async function createSheet() {
    const { crests, createMinVip, createFee } = await api.call('/families/crests');
    let crest = crests[0];
    const s = openSheet(`<h3>建立家族</h3><div class="fam-form">
      <label>家族名稱（2–16 字）<input name="name" maxlength="16"></label>
      <label>家族標語<input name="slogan" maxlength="60" placeholder="一起挑戰本週目標"></label>
      <label>家族徽章<div class="fam-crests">${crests.map((c, i) => `<button type="button" data-crest="${c}" class="${i ? '' : 'on'}">${c}</button>`).join('')}</div></label>
      </div><p class="fam-note">VIP ${createMinVip} 以上可申請${me.vip.level < createMinVip ? `（目前 VIP ${me.vip.level}）` : ''}・手續費 ${coins(createFee)} G幣（審核未通過全額退回）<br>送出後由官方審核，通過即成立家族</p><button class="fam-btn" data-send>送出申請</button>`);
    $$('[data-crest]', s).forEach((b) => (b.onclick = () => { crest = b.dataset.crest; $$('[data-crest]', s).forEach((x) => x.classList.toggle('on', x === b)); }));
    $('[data-send]', s).onclick = () => familyAction('/families', { method: 'POST', body: { name: $('[name=name]', s).value, slogan: $('[name=slogan]', s).value, crest } }, '已送出申請，審核通過後即成立家族');
  }

  /** 重新讀取所屬家族，更新會員中心與「我的家族」。 */
  async function loadMyFamily() {
    me.family = await api.call('/families/me').catch(() => null);
    $$('.profile-list li strong')[4].textContent = me.family ? me.family.name : '無';
    $$('.profile-list li button')[4].textContent = me.family ? '管理' : '加入';
    await renderMyClan().catch(() => {});
  }

  async function renderMyClan() {
    const panel = $('[data-clan-panel="mine"]');
    const f = me?.family;
    if (!f) {
      const req = me ? (await api.call('/families/requests/me').catch(() => ({}))).request : null;
      const pending = req?.status === 'PENDING';
      const status = pending ? `<p class="fam-note">「${esc(req.crest)} ${esc(req.name)}」建立申請審核中（已暫扣 ${coins(req.fee)} G幣）</p>`
        : req?.status === 'REJECTED' ? `<p class="fam-note">上次申請「${esc(req.name)}」未通過${req.note ? '：' + esc(req.note) : ''}，手續費已退回</p>` : '';
      panel.innerHTML = `<div class="clan-empty"><div><div class="crest">⚔️</div><strong>尚未加入家族</strong><p>申請建立自己的家族，或到「所有家族」申請加入。<br>收到家族邀請信時，可在信箱直接加入。</p>${status}
        <div class="fam-actions">${!me ? '' : pending ? '<button class="fam-btn danger" data-cancel>撤回申請</button>' : '<button class="fam-btn" data-create>申請建立家族</button>'}<button class="fam-btn ghost" data-browse>瀏覽所有家族</button></div></div></div>`;
      const create = $('[data-create]', panel);
      if (create) create.onclick = () => createSheet().catch((err) => toast(err.message));
      const cancel = $('[data-cancel]', panel);
      if (cancel) cancel.onclick = () => { if (confirm('確定撤回申請？手續費會退回主錢包。')) familyAction('/families/requests/me/cancel', { method: 'POST' }, '已撤回申請，手續費已退回'); };
      $('[data-browse]', panel).onclick = () => $('[data-clan-page="all"]').click();
      return;
    }
    const officer = f.myRole !== 'MEMBER';
    const [applications, chat] = await Promise.all([
      officer ? api.call('/families/me/applications').then((r) => r.applications).catch(() => []) : [],
      api.call('/chat').catch(() => ({ unread: 0 })),
    ]);
    const c = f.myContribution || {};
    panel.innerHTML = `<div class="clan-detail-head"><div class="clan-crest">${familyIcon(esc(f.crest || '⚔️'))}</div><h3>${esc(f.name)}</h3><span>${esc(f.slogan || '')}</span></div>
      ${noticeBubble(f, officer)}
      <div class="clan-detail-stats"><div><small>家族等級</small><b>${f.level}</b></div><div><small>家族聲望</small><b>${num(f.exp)}</b></div><div><small>家族公款</small><b>${coins(f.fund)}</b></div></div>
      <div class="fam-actions">
        <button class="fam-btn" data-room>💬 家族聊天${chat.unread ? `<span class="fam-badge">${chat.unread}</span>` : ''}</button>
        <button class="fam-btn ghost" data-inbox>關注／私訊</button>
        ${officer ? '<button class="fam-btn" data-invite>＋ 邀請成員</button>' : ''}
      </div>
      <div class="fam-section"><h4>我的貢獻 <small>加入後累計有效投注 ${coins(c.total)}</small></h4><div class="fam-contrib">${CONTRIB.map(([k, t]) => `<div><small>${t}</small><b>${coins(c[k])}</b></div>`).join('')}</div></div>
      ${applications.length ? `<div class="fam-section"><h4>入族申請（${applications.length}）</h4>${applications.map((a) => `<div class="fam-apply"><span>${esc(a.nickname || 'GD會員')} <small>UID ${esc(a.aid)}・VIP ${a.vip_level}</small></span><span><button class="gd-act" data-decide="${esc(a.id)}" data-to="approve">同意</button><button class="gd-act gray" data-decide="${esc(a.id)}" data-to="reject">拒絕</button></span></div>`).join('')}</div>` : ''}
      <div class="clan-members"><h4>我的身分：${ROLE[f.myRole]}　成員 ${f.members.length} / ${f.max_members}　<small>點成員可私訊或送禮</small></h4>${memberRows(f.members, officer)}</div>`;
    bindMemberRows(panel);
    $('[data-room]', panel).onclick = () => openChat('family', '家族聊天室');
    $('[data-inbox]', panel).onclick = () => openInbox();
    if ($('[data-notice]', panel)) $('[data-notice]', panel).onclick = () => noticeSheet(f);
    if ($('[data-invite]', panel)) $('[data-invite]', panel).onclick = () => inviteSheet().catch((err) => toast(err.message));
    $$('[data-decide]', panel).forEach((b) => (b.onclick = () => familyAction(`/families/me/applications/${b.dataset.decide}/${b.dataset.to}`, { method: 'POST' }, b.dataset.to === 'approve' ? '已同意加入' : '已拒絕')));
  }

  $('#openClan').addEventListener('click', async () => { if (!requireLogin()) return; loadMyFamily(); await loadClans(); renderClans($('#clanSearch').value.trim()); });
  $('#clanInfo').onclick = () => toast('家族說明：達到 VIP 門檻並支付手續費可申請建立家族，官方審核通過後成立；一人同時只能加入一個家族。家族長與副家族長可寄邀請信、審核申請；成員之間可私訊、送禮，並一起累積家族聲望。');

  // ---------- 聊天：家族聊天室與私訊（每 3 秒更新） ----------
  const chatLayer = document.createElement('section');
  chatLayer.className = 'gd-chat';
  chatLayer.hidden = true;
  chatLayer.innerHTML = '<div><header><button data-back>←</button><b></b><button data-x>✕</button></header><div class="chat-body"></div><p class="chat-safe">請勿在聊天中提供帳號密碼或驗證碼；交易請使用遊戲內贈禮功能。</p><div class="emoji-panel" hidden></div><form hidden><button type="button" class="emoji-btn" aria-label="表情">🐲</button><input maxlength="300" placeholder="輸入訊息" autocomplete="off"><button class="fam-btn">送出</button></form></div>';
  document.body.appendChild(chatLayer);
  const chatBody = $('.chat-body', chatLayer);
  const chatForm = $('form', chatLayer);
  // GD 風表情：金龍、紅包、幣、牌桌與常用心情
  const GD_EMOJI = ['🐲', '🐉', '🧧', '💰', '🪙', '💎', '👑', '🎰', '🎲', '🀄', '🃏', '🎯', '🔥', '⚡', '🍀', '🏆', '🎉', '🥳', '🤑', '😎', '😂', '😭', '😡', '🙏', '👍', '👏', '💪', '❤️', '🫶', '🌟', '🚀', '💯'];
  const emojiPanel = $('.emoji-panel', chatLayer);
  emojiPanel.innerHTML = GD_EMOJI.map((e) => `<button type="button">${e}</button>`).join('');
  $('.emoji-btn', chatForm).onclick = () => { emojiPanel.hidden = !emojiPanel.hidden; };
  emojiPanel.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const input = $('input', chatForm);
    const at = input.selectionStart ?? input.value.length;
    input.value = input.value.slice(0, at) + b.textContent + input.value.slice(input.selectionEnd ?? at);
    input.focus();
    input.setSelectionRange(at + b.textContent.length, at + b.textContent.length);
  };
  let chatTarget = null;
  let chatLast = 0;
  let chatTimer = null;
  const stopChat = () => { clearInterval(chatTimer); chatTimer = null; chatTarget = null; };
  $('[data-x]', chatLayer).onclick = () => { stopChat(); chatLayer.hidden = true; refresh(); };
  $('[data-back]', chatLayer).onclick = () => openInbox();

  const INBOX_TABS = [['follows', '關注列表'], ['chats', '聊天記錄'], ['search', '搜尋']];
  let inboxTab = 'chats';
  const playerRow = (p) => `<button class="conv" data-player="${esc(p.aid)}"><span><b>${esc(p.nickname || 'GD會員')}</b><small>UID ${esc(p.aid)}・VIP ${p.vip_level}・${esc(p.family_name || '無家族')}</small></span>${p.online ? '<span class="fam-state">在線</span>' : '<span class="fam-state off">離線</span>'}</button>`;
  const bindPlayers = (list) => $$('[data-player]', chatBody).forEach((b) => (b.onclick = () => playerSheet(list.find((p) => p.aid === b.dataset.player))));

  /** 訊息中心：關注列表／聊天記錄／搜尋（ID 或暱稱）。 */
  async function openInbox(tab = inboxTab) {
    stopChat();
    inboxTab = tab;
    $('header b', chatLayer).textContent = '訊息';
    chatForm.hidden = true;
    chatLayer.hidden = false;
    const tabs = `<div class="gd-tabs">${INBOX_TABS.map(([k, t]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    if (tab === 'chats') {
      const { conversations } = await api.call('/chat');
      chatBody.innerHTML = tabs + (conversations.map((c) => `<button class="conv" data-target="${esc(c.target)}" data-title="${esc(c.title)}"><span><b>${c.target === 'family' ? '👥 ' : ''}${esc(c.title)}</b><small>${esc(c.lastBody || '還沒有訊息')}</small></span>${c.unread ? `<span class="fam-badge" style="position:static">${c.unread}</span>` : ''}</button>`).join('') || '<div class="tool-empty">目前沒有對話，可私訊家族成員或互相關注的玩家</div>');
      $$('[data-target]', chatBody).forEach((b) => (b.onclick = () => openChat(b.dataset.target, b.dataset.title)));
    } else if (tab === 'follows') {
      const { follows } = await api.call('/social/follows');
      chatBody.innerHTML = tabs + (follows.map(playerRow).join('') || '<div class="tool-empty">還沒有關注的玩家，到「搜尋」找玩家關注</div>');
      bindPlayers(follows);
    } else {
      chatBody.innerHTML = tabs + '<form class="gd-search" data-search><input name="q" placeholder="輸入玩家 ID 或暱稱" autocomplete="off"><button class="fam-btn">搜尋</button></form><div data-results></div>';
      $('[data-search]', chatBody).onsubmit = async (e) => {
        e.preventDefault();
        const { players } = await api.call('/social/search?q=' + encodeURIComponent(e.target.q.value.trim()));
        $('[data-results]', chatBody).innerHTML = players.map(playerRow).join('') || '<div class="tool-empty">找不到符合的玩家</div>';
        bindPlayers(players);
      };
      $('[name=q]', chatBody).focus();
    }
    $$('[data-tab]', chatBody).forEach((b) => (b.onclick = () => openInbox(b.dataset.tab)));
  }

  /** 玩家小卡：關注、私訊（同家族或互相關注）、送禮。 */
  function playerSheet(p) {
    const sameFamily = me.family && me.family.members.some((x) => x.aid === p.aid);
    const canChat = sameFamily || (p.followed && p.follows_me);
    const s = openSheet(`<h3>${esc(p.nickname || 'GD會員')}</h3><small>UID ${esc(p.aid)}・VIP ${p.vip_level}・${esc(p.family_name || '無家族')}</small>
      <button class="fam-btn${p.followed ? ' ghost' : ''}" data-follow>${p.followed ? '取消關注' : '＋ 關注'}</button>
      <button class="fam-btn" data-chat ${canChat ? '' : 'disabled'}>💬 私訊</button>${canChat ? '' : '<small>同家族或互相關注後即可私訊</small>'}
      <button class="fam-btn" data-gift>🎁 送禮</button>`);
    $('[data-follow]', s).onclick = async () => {
      try {
        await api.call('/social/follows/' + p.aid, { method: p.followed ? 'DELETE' : 'PUT' });
        sheet.hidden = true;
        toast(p.followed ? '已取消關注' : '已關注，對方也關注你後即可私訊');
        openInbox();
      } catch (err) { toast(err.message); }
    };
    $('[data-chat]', s).onclick = () => { sheet.hidden = true; openChat(p.aid, p.nickname || p.aid); };
    $('[data-gift]', s).onclick = () => giftWizard({ aid: p.aid, name: p.nickname || p.aid, vip: p.vip_level, family: p.family_name });
  }

  async function openChat(target, title) {
    stopChat();
    chatTarget = target;
    chatLast = 0;
    $('header b', chatLayer).textContent = title;
    chatBody.innerHTML = '';
    emojiPanel.hidden = true;
    chatForm.hidden = false;
    chatLayer.hidden = false;
    await pollChat();
    chatTimer = setInterval(() => pollChat().catch(() => {}), 3000);
    $('input', chatForm).focus();
  }

  async function pollChat() {
    const target = chatTarget;
    if (!target) return;
    const { messages } = await api.call(`/chat/${encodeURIComponent(target)}?after=${chatLast}`);
    if (target !== chatTarget || !messages.length) return;
    chatLast = messages.at(-1).id;
    const showName = target === 'family';
    chatBody.insertAdjacentHTML('beforeend', messages.map((m) => m.kind && m.kind !== 'TEXT' ? `<div class="msg sys${m.kind === 'JOIN' ? ' join' : ''}">${m.kind === 'JOIN' ? '🎉 ' : ''}${esc(m.body)}<small>${time(m.created_at)}</small></div>` : `<div class="msg${m.mine ? ' mine' : ''}"><small>${showName && !m.mine ? esc(m.nickname || m.aid) + '・' : ''}${time(m.created_at)}</small>${esc(m.body)}</div>`).join(''));
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  chatForm.onsubmit = async (e) => {
    e.preventDefault();
    const input = $('input', chatForm);
    const body = input.value.trim();
    if (!body || !chatTarget) return;
    try { await api.call(`/chat/${encodeURIComponent(chatTarget)}`, { method: 'POST', body: { body } }); input.value = ''; emojiPanel.hidden = true; await pollChat(); } catch (err) { toast(err.message); }
  };
  /** 本週投注榜：每列帶所屬家族（[暱稱, 頭像, 投注, 家族, VIP]）。 */
  async function loadBetBoard() {
    const { board } = await api.call('/social/leaderboard/bet');
    rankData.bet = board.map((p) => [p.nickname || 'GD會員', p.family_crest || '🎲', coins(p.total), p.family_name || '無家族', p.vip_level]);
  }
  $('#openRank').addEventListener('click', async () => { if (!me) return; await Promise.all([loadClans(), loadBetBoard().catch(() => {})]); renderRank(); });

  // 設定裡的「好友」改為關注／聊天
  const friendsItem = $('[data-tool="friends"]');
  if (friendsItem) friendsItem.innerHTML = '<span>👥</span>關注／聊天';
  $('#toolLayer').addEventListener('click', (e) => {
    if (!e.target.closest('[data-tool="friends"]')) return;
    e.stopPropagation();
    if (requireLogin()) openInbox('follows').catch((err) => toast(err.message));
  }, true);

  // ---------- 自家哈希遊戲：由 GDBO 發 token，用會員錢包下注 ----------
  const HASH_GAMES = { 珠珠寶貝: 'plinko', 寶石探險: 'mines', 沖高高: 'crash' };
  // capture 階段先攔截，未登入或後端失敗時不落回舊的展示連結
  playButton.addEventListener('click', async (e) => {
    const gameId = HASH_GAMES[selectedGame];
    if (!gameId) return;
    e.stopImmediatePropagation();
    if (!requireLogin()) { dialog.close(); return; }
    playButton.disabled = true;
    modalStatus.textContent = '正在取得遊戲連線…';
    modalStatus.hidden = false;
    try {
      if (pendingOffer && $('input', offerCard)?.checked) {
        modalStatus.textContent = '正在鎖定優惠錢包…';
        await api.call(`/promotions/${pendingOffer.promotionId}/accept`, { method: 'POST', body: { tierIdx: pendingOffer.tierIdx, gameId }, idempotent: true });
        pendingOffer = null;
        modalStatus.textContent = '正在取得遊戲連線…';
      }
      const { url } = await api.call('/game-sessions', { method: 'POST', body: { gameId, returnUrl: location.origin + location.pathname + '?cat=exclusive' } });
      location.href = url;
    } catch (err) {
      modalStatus.textContent = '遊戲連線失敗：' + err.message;
      playButton.disabled = false;
    }
  }, true);

  // ---------- 優惠鎖定錢包：進遊戲前確認、錢包頁進度與領取 ----------
  const HASH_PROVIDER = 'sha';
  const GAME_NAMES = Object.fromEntries(Object.entries(HASH_GAMES).map(([name, id]) => [id, name]));
  const OPEN_PROMO = ['ACTIVE', 'ACTIVE_STARTED', 'CLAIMABLE'];
  const PROMO_STATUS = { ACTIVE: '尚未投注', ACTIVE_STARTED: '流水解鎖中', CLAIMABLE: '已達標，可領取' };
  const promoStyle = document.createElement('style');
  promoStyle.textContent = `
    .gd-promo .progress span,.modal-progress span{transition:width 1.1s cubic-bezier(.34,1.56,.64,1)}
    .gd-grow{animation:gdStretch .9s ease-out}
    @keyframes gdStretch{0%{transform:scaleY(1)}35%{transform:scaleY(1.9)}60%{transform:scaleY(.8)}100%{transform:scaleY(1)}}
    .gd-promo .wallet-config span{white-space:nowrap}
    .gd-claim{display:block;width:100%;margin-top:10px;font:inherit;font-weight:900;border:0;border-radius:10px;padding:10px;cursor:pointer;background:linear-gradient(180deg,var(--gold),#e39b16);color:#4b251b;animation:gdPulse 1.4s ease-in-out infinite}
    .gd-claim:disabled{animation:none;opacity:.6}
    @keyframes gdPulse{0%,100%{transform:scale(1);box-shadow:0 0 0 #ffc64100}50%{transform:scale(1.04);box-shadow:0 0 14px #ffc641cc}}
    .modal-offer label{display:flex;gap:6px;align-items:center;margin-top:8px;font-size:13px;font-weight:800}
    .modal-offer .gd-short{display:block;margin-top:8px;color:#ff6e8a;font-weight:900}
    .gd-coin{position:fixed;z-index:100;width:24px;height:24px;margin:-12px 0 0 -12px;border-radius:50%;pointer-events:none;background:radial-gradient(circle at 35% 30%,#fff7b0,#ffd23f 45%,#d48a0b);border:2px solid #fff0a0;box-shadow:0 2px 6px #0006}`;
  document.head.appendChild(promoStyle);

  const myPromotions = async () => (await api.call('/promotions/me')).promotions.filter((p) => OPEN_PROMO.includes(p.status));
  const progressText = (p) => `進度 ${p.percent}%　${coins(p.progress)} / ${coins(p.wagerTarget)}`;
  /** 進度條從上次的寬度伸縮到目前進度；有增加時加一下彈跳。 */
  function growBar(bar, from, to) {
    bar.style.width = from + '%';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      bar.style.width = to + '%';
      if (to > from) { bar.classList.remove('gd-grow'); void bar.offsetWidth; bar.classList.add('gd-grow'); }
    }));
  }

  // 進遊戲前的確認：已有鎖定錢包就顯示進度；否則顯示可領優惠，預設勾選，進入遊戲時鎖定
  // 原本的展示卡片留給其他遊戲；有串後端的遊戲改用這張
  const demoOffer = $('.modal-offer');
  const offerCard = document.createElement('article');
  offerCard.className = 'modal-offer';
  offerCard.hidden = true;
  demoOffer.after(offerCard);
  let pendingOffer = null;
  async function prepareOffer() {
    pendingOffer = null;
    const gameId = HASH_GAMES[selectedGame];
    demoOffer.hidden = true;
    offerCard.hidden = true;
    if (!gameId || !me) return;
    try {
      const locked = (await myPromotions()).find((p) => p.provider === HASH_PROVIDER && p.gameId === gameId);
      if (locked) {
        offerCard.innerHTML = `<b>${esc(locked.promotion)}</b><small>鎖定錢包・${PROMO_STATUS[locked.status]}</small><strong>${coins(locked.balance.total)}</strong><div class="modal-progress"><span></span></div><em>${progressText(locked)}</em>`;
        offerCard.hidden = false;
        growBar($('.modal-progress span', offerCard), 0, locked.percent);
        return;
      }
      const { offers } = await api.call(`/promotions/offers?provider=${HASH_PROVIDER}&gameId=${gameId}`);
      const offerHead = (o, tier) => `<b>${esc(o.name)}</b><small>本金 ${coins(tier.principal)} ＋ 優惠 ${coins(tier.bonus)}，流水達 ${coins(tier.wagerTarget)} 可領回</small><strong>${coins(tier.principal + tier.bonus)}</strong>`;
      // 不讓玩家選金額：主錢包付得起的最高方案
      const options = offers.map((o) => ({ o, tiers: [...o.tiers].sort((a, b) => b.principal - a.principal) }));
      const pick = options.map(({ o, tiers }) => ({ o, tier: tiers.find((t) => t.principal <= me.mainAvailable) })).find((x) => x.tier);
      if (pick) {
        pendingOffer = { promotionId: pick.o.id, tierIdx: pick.tier.idx };
        offerCard.innerHTML = `${offerHead(pick.o, pick.tier)}<label><input type="checkbox" checked> 使用此優惠（主錢包扣 ${coins(pick.tier.principal)}）</label><em>下注先扣優惠金幣；開始下注後不可退回，完成流水才能領回主錢包。</em>`;
        offerCard.hidden = false;
        return;
      }
      // 都付不起：仍顯示最低方案，提示主錢包不足，不帶入優惠
      if (options.length) {
        const { o, tiers } = options[0];
        const tier = tiers[tiers.length - 1];
        offerCard.innerHTML = `${offerHead(o, tier)}<em class="gd-short">主錢包不足，需 ${coins(tier.principal)}（目前 ${coins(me.mainAvailable)}）</em>`;
        offerCard.hidden = false;
      }
    } catch (err) { console.warn('offers', err); }
  }
  new MutationObserver(() => { if (dialog.open) prepareOffer(); }).observe(dialog, { attributes: true, attributeFilter: ['open'] });

  // 錢包頁：鎖定錢包列表、進度、領取
  const walletLayer = $('#walletLayer');
  const walletNote = $('.wallet-note', walletLayer);
  const lastPercent = new Map();
  async function renderWallet() {
    if (!me) return;
    let list;
    try { list = await myPromotions(); } catch (err) { console.warn('promotions', err); return; }
    $$('.unlock-row', walletLayer).forEach((row) => row.remove());
    walletNote.textContent = list.length ? '優惠金幣只能在指定遊戲使用；下注先扣優惠金幣，完成流水後可領回主錢包。' : '目前沒有進行中的優惠。進入有優惠的遊戲時可以領取。';
    walletNote.insertAdjacentHTML('beforebegin', list.map((p) => `<article class="unlock-row gd-promo" data-promo="${esc(p.id)}"><div><b>${esc(GAME_NAMES[p.gameId] || p.gameId)}</b><small>${esc(p.promotion)}・${PROMO_STATUS[p.status]}</small></div><strong>${coins(p.balance.total)}</strong><div class="progress"><span></span></div><em>${progressText(p)}</em><div class="wallet-config"><span>本金 ${coins(p.balance.cash)}</span><span>優惠 ${coins(p.balance.bonus)}</span><span>派彩 ${coins(p.balance.winnings)}</span></div>${
      p.status === 'CLAIMABLE' ? `<button class="gd-claim">領取 ${coins(p.balance.total)} G幣</button>` : p.activationDeadline ? `<small>${time(p.activationDeadline)} 前未下注，將退回本金並收回優惠</small>` : ''}</article>`).join(''));
    list.forEach((p) => {
      const row = $(`[data-promo="${p.id}"]`, walletLayer);
      growBar($('.progress span', row), lastPercent.get(p.id) ?? 0, p.percent);
      lastPercent.set(p.id, p.percent);
      const claim = $('.gd-claim', row);
      if (claim) claim.onclick = () => claimPromotion(p, claim);
    });
  }

  async function claimPromotion(p, button) {
    button.disabled = true;
    try {
      const from = me.mainAvailable;
      const r = await api.call(`/promotions/me/${p.id}/claim`, { method: 'POST' });
      // 動畫被暫停（背景分頁）或玩家開了「減少動態效果」時不等動畫，入帳照常
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        await Promise.race([coinBurst(button, $('#openWallet .coin')), new Promise((r) => setTimeout(r, 2500))]);
      }
      countUp($('#balance'), from, from + Number(r.returned));
      await refresh();
    } catch (err) { toast(err.message); button.disabled = false; }
  }

  /** 金幣從領取按鈕飛到右上角錢包，每顆落地有音效。 */
  function coinBurst(fromEl, toEl, count = 12) {
    const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
    const start = { x: a.left + a.width / 2, y: a.top + a.height / 2 }, end = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    const flights = Array.from({ length: count }, (_, i) => {
      const coin = document.createElement('i');
      coin.className = 'gd-coin';
      coin.style.left = start.x + 'px';
      coin.style.top = start.y + 'px';
      document.body.appendChild(coin);
      const spread = (Math.random() - 0.5) * 140, lift = 60 + Math.random() * 60;
      const dx = end.x - start.x, dy = end.y - start.y;
      const anim = coin.animate([
        { transform: 'translate(0,0) scale(.6)', opacity: 0 },
        { transform: `translate(${spread}px,${-lift}px) scale(1.15)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${dx}px,${dy}px) scale(.7)`, opacity: 1 },
      ], { duration: 750 + Math.random() * 250, delay: i * 55, easing: 'cubic-bezier(.5,0,.6,1)' });
      return anim.finished.then(() => { coin.remove(); coinSound(); popCoin(toEl); });
    });
    return Promise.all(flights);
  }

  function popCoin(el) { el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 220 }); }

  let audio;
  function coinSound() {
    if (!$('#musicSwitch')?.classList.contains('on')) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      const t = audio.currentTime;
      [[988, 0], [1319, 0.07]].forEach(([freq, at]) => {
        const osc = audio.createOscillator(), gain = audio.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.06, t + at);
        gain.gain.exponentialRampToValueAtTime(0.001, t + at + 0.18);
        osc.connect(gain).connect(audio.destination);
        osc.start(t + at);
        osc.stop(t + at + 0.2);
      });
    } catch { /* 瀏覽器不支援音效時略過 */ }
  }

  function countUp(el, from, to, ms = 800) {
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      el.textContent = compact(Math.floor((from + (to - from) * (1 - (1 - k) ** 3)) * 100) / 100);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  $('#openWallet').addEventListener('click', () => renderWallet());

  // ---------- 活動輪播、獎勵活動、公告（後台有資料才取代展示內容） ----------
  async function loadBanners() {
    const { banners } = await api.call('/content/banners');
    const byCategory = {};
    banners.forEach((b) => (byCategory[b.category] ||= []).push(b.image_url
      ? { image: true, bg: `url('${encodeURI(b.image_url)}')` }
      : { eye: esc(b.subtitle), title: esc(b.title), sub: '', bg: 'linear-gradient(135deg,#783dff,#ff3d9e)' }));
    Object.entries(byCategory).forEach(([category, list]) => { if (heroBanners[category]) heroBanners[category] = list; });
    if (byCategory[active]) renderHero(active);
  }

  const period = (item) => (item.starts_at || item.ends_at ? [item.starts_at, item.ends_at].map((t) => (t ? time(t) : '')).join('～') : '常態活動');
  function showEvent(e) {
    const hero = $('.detail-hero', eventDetail);
    $('.detail-title', eventDetail).textContent = e.title;
    $('span', hero).textContent = '🎁';
    $('strong', hero).textContent = e.title;
    hero.classList.toggle('event-image', Boolean(e.image_url));
    if (e.image_url) hero.style.setProperty('--event-image', `url('${encodeURI(e.image_url)}')`); else hero.style.removeProperty('--event-image');
    $('.detail-date', eventDetail).textContent = '活動時間 ' + period(e);
    $('.detail-box', eventDetail).hidden = true;
    $('.detail-copy', eventDetail).textContent = e.body || e.subtitle || '';
    activityList.classList.add('hidden');
    eventDetail.classList.add('active');
    activityBack.classList.add('show');
  }

  async function loadEvents() {
    const { events } = await api.call('/content/events');
    if (!events.length) return;
    activityList.innerHTML = events.map((e, i) => `<button class="event-card" data-gd-event="${i}"><div class="event-banner ${e.image_url ? 'event-image' : ''}" data-icon="🎁" style="--a1:#ffcc35;--a2:#a31a1d;${e.image_url ? `--event-image:url('${esc(encodeURI(e.image_url))}')` : ''}"><strong>${esc(e.title)}</strong></div><footer><b>${esc(e.title)}</b><small>活動時間 ${esc(period(e))}</small></footer></button>`).join('');
    $$('[data-gd-event]', activityList).forEach((card) => (card.onclick = () => showEvent(events[Number(card.dataset.gdEvent)])));
  }

  // 公告：設定選單裡的一頁
  const noticeItem = document.createElement('button');
  noticeItem.className = 'tool-item';
  noticeItem.innerHTML = '<span>📢</span>公告';
  $('.tool-grid').appendChild(noticeItem);
  const noticePage = document.createElement('section');
  noticePage.className = 'tool-page';
  noticePage.dataset.toolPage = 'notices';
  $('[data-tool-page="mail"]').after(noticePage);
  noticeItem.onclick = () => { showTool('notices'); loadNotices().catch(() => {}); };
  async function loadNotices() {
    const { notices } = await api.call('/notices');
    const panel = noticePage;
    panel.innerHTML = '<button class="tool-back">← 返回設定</button><h3>公告</h3>' + (notices.map((n) => `<div class="tool-row" data-notice="${esc(n.id)}"><b>${n.pinned ? '📌 ' : ''}${esc(n.title)}${me && !n.read ? ' <small style="display:inline;color:#ff6ec7">NEW</small>' : ''}</b>${n.starts_at ? `<small>${time(n.starts_at)}</small>` : ''}<p style="margin:8px 0 0;white-space:pre-wrap">${esc(n.body)}</p></div>`).join('') || '<div class="tool-empty">目前尚無公告</div>');
    $('.tool-back', panel).onclick = () => showTool('');
    if (me) notices.filter((n) => !n.read).forEach((n) => api.call(`/notices/${n.id}/read`, { method: 'POST' }).catch(() => {}));
    const popup = me && notices.find((n) => n.popup && !n.read);
    if (popup) toast(`【公告】${popup.title}\n\n${popup.body || ''}`);
  }

  const loadContent = () => Promise.all([loadBanners(), loadEvents(), loadNotices()]).catch((err) => console.warn('content', err));

  // ---------- 設定：信箱、禮包兌換、條款 ----------
  const mailItem = $('[data-tool="mail"]');
  async function loadMail() {
    if (!me) return;
    const { mail, unread } = await api.call('/mail');
    mailItem.innerHTML = `<span>✉️</span>信箱（${unread}）`;
    const page = $('[data-tool-page="mail"]');
    page.innerHTML = '<button class="tool-back">← 返回設定</button><h3>信箱</h3>' + (mail.map((m) => `<div class="tool-row"><b>${m.read_at ? '' : '● '}${esc(m.title)}</b><small>${time(m.created_at)}${m.expires_at ? '・到期 ' + time(m.invite_expires_at || m.expires_at) : ''}</small><p style="margin:8px 0;white-space:pre-wrap">${esc(m.body)}</p>${
      m.reward_coins ? (m.claimed_at ? `<small>已領取 ${coins(m.reward_coins)} G幣</small>` : `<button class="gd-act" data-claim="${esc(m.id)}">領取 ${coins(m.reward_coins)} G幣</button>`) : ''}${
      m.invite_id ? (inviteState(m) || `<small>⏳ 剩 ${countdown(m.invite_expires_at)} 過期</small><br><button class="gd-act" data-invite="${esc(m.invite_id)}" data-to="accept">${m.invite_bonus ? '加入並領取' : '加入家族'}</button><button class="gd-act gray" data-invite="${esc(m.invite_id)}" data-to="decline">拒絕</button>`) : ''}</div>`).join('') || '<div class="tool-empty">目前沒有信件</div>');
    $$('[data-invite]', page).forEach((b) => (b.onclick = async () => {
      try {
        const r = await api.call(`/families/invites/${b.dataset.invite}/${b.dataset.to}`, { method: 'POST' });
        await refresh();
        toast(b.dataset.to === 'decline' ? '已拒絕邀請' : r.bonus ? `已加入家族並獲得 ${coins(r.bonus)} 金幣（${day(r.lockedUntil)} 前不可退出）` : '已加入家族');
      } catch (err) { toast(err.message); loadMail().catch(() => {}); }
    }));
    $('.tool-back', page).onclick = () => showTool('');
    $$('[data-claim]', page).forEach((b) => (b.onclick = async () => {
      try { await api.call(`/mail/${b.dataset.claim}/claim`, { method: 'POST' }); await refresh(); toast('已領取'); } catch (err) { toast(err.message); }
    }));
    mail.filter((m) => !m.read_at && !m.reward_coins).forEach((m) => api.call(`/mail/${m.id}/read`, { method: 'POST' }).catch(() => {}));
  }
  mailItem.addEventListener('click', () => { if (requireLogin()) loadMail().catch((err) => toast(err.message)); });

  const LEGAL = { terms: 'terms', privacy: 'privacy', rules: 'rules' };
  Object.keys(LEGAL).forEach((tool) => $(`[data-tool="${tool}"]`).addEventListener('click', async () => {
    try {
      const doc = await api.call('/legal/' + LEGAL[tool]);
      const page = $(`[data-tool-page="${tool}"]`);
      $('h3', page).textContent = doc.title;
      $('.tool-note', page).innerHTML = `<small>版本 ${doc.version}・${time(doc.effective_at)} 生效</small><div style="white-space:pre-wrap;margin-top:8px">${esc(doc.body)}</div>${
        me && !doc.accepted_at ? `<button class="gd-act" data-accept="${esc(doc.id)}" style="margin-top:10px">我已閱讀並同意</button>` : ''}`;
      const accept = $('[data-accept]', page);
      if (accept) accept.onclick = async () => { try { await api.call(`/legal/${doc.id}/accept`, { method: 'POST' }); accept.replaceWith('已同意'); } catch (err) { toast(err.message); } };
    } catch { /* 後台尚未發布時保留原本說明 */ }
  }));

  // ---------- 獎勵中心：每日簽到、每日任務／本週加碼、家族任務 ----------
  const msStyle = document.createElement('style');
  msStyle.textContent = `
    .activity-tabs{grid-template-columns:repeat(auto-fit,minmax(0,1fr));padding:0 24px}
    .gd-ms{display:grid;gap:12px}
    .gd-checkin{border:1px solid #35406d;border-radius:16px;padding:12px;background:linear-gradient(135deg,#1c2557,#121a40)}
    .gd-checkin header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
    .gd-checkin header b{color:#ffd166;font-size:17px}
    .gd-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
    .gd-day{border-radius:10px;padding:6px 2px;text-align:center;background:#0d1430;border:1px solid #2b3566;font-size:11px;color:#aeb8e8}
    .gd-day b{display:block;color:#ffd166;font-size:13px;margin-top:2px}
    .gd-day.done{opacity:.55}.gd-day.done b:after{content:" ✓";color:#7ff0c4}
    .gd-day.today{border-color:#ff3d9e;box-shadow:0 0 10px #ff3d9e88;color:#fff}
    .gd-seg{display:grid;grid-template-columns:1fr 1fr;background:#111838;border:1px solid #35406d;border-radius:14px;padding:4px}
    .gd-seg button{border:0;border-radius:10px;padding:10px;font:inherit;font-weight:900;background:none;color:#aeb8e8;cursor:pointer}
    .gd-seg button.on{background:linear-gradient(180deg,#ffd166,#f2a516);color:#3a1d05}
    .gd-ms-card{display:grid;grid-template-columns:76px minmax(0,1fr) 92px;gap:10px;align-items:center;padding:10px;border-radius:16px;background:#151b3d;border:1px solid #2b3566}
    .gd-ms-card>img,.gd-ms-card>span{width:76px;height:76px;border-radius:12px;object-fit:cover;display:grid;place-items:center;font-size:34px;background:#0d1430}
    .gd-ms-card b{display:block;color:#fff;font-size:15px;line-height:1.3}
    .gd-ms-bar{position:relative;height:22px;border-radius:11px;background:#0b1026;border:1px solid #35406d;margin:6px 0 4px;overflow:hidden}
    .gd-ms-bar span{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,#783dff,#ff3d9e)}
    .gd-ms-bar em{position:relative;display:block;text-align:center;font-style:normal;font-size:12px;font-weight:900;line-height:20px;color:#fff}
    .gd-ms-card small{color:#8d97c7;font-size:11px}
    .gd-ms-reward{text-align:center;border-left:1px solid #2b3566;padding-left:8px}
    .gd-ms-reward strong{display:block;color:#ffd166;font-size:17px;margin:2px 0 6px}
    .gd-ms-reward .coin{display:inline-grid;place-items:center;width:28px;height:28px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff7b0,#ffd23f 45%,#d48a0b);color:#7a4300;font-weight:1000;font-style:normal}
    .gd-ms-btn{width:100%;border:0;border-radius:999px;padding:7px 0;font:inherit;font-weight:900;cursor:pointer;background:#2e3a78;color:#d6dcff}
    .gd-ms-btn.claim{background:linear-gradient(180deg,#ffd166,#f2a516);color:#3a1d05;animation:gdPulse 1.4s ease-in-out infinite}
    .gd-ms-btn:disabled{opacity:.5;cursor:default;animation:none}
    .gd-ms-all{justify-self:center;min-width:150px;border:0;border-radius:999px;padding:11px 28px;font:inherit;font-weight:900;cursor:pointer;background:linear-gradient(180deg,#ff6ec7,#ff3d9e);color:#fff}
    .gd-ms-all:disabled{background:#3b4472;color:#9aa3cf;cursor:default}
    .gd-ms-empty{text-align:center;color:#8d97c7;padding:24px 0}`;
  document.head.appendChild(msStyle);

  const missionPanel = $('[data-activity-panel="missions"]');
  const familyPanel = $('[data-activity-panel="family"]');
  const familyTab = $('[data-activity-tab="family"]');
  let msData = null, msTab = 'daily';
  const day = (iso) => { const d = new Date(iso); return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`; };
  /** 任務圖示：後台上傳的圖 → 大廳遊戲圖示 → 預設。 */
  const missionIcon = (m) => {
    const src = m.imageUrl || catalog.find((g) => g[0] === m.gameName)?.[7];
    return src ? `<img src="${esc(src)}" alt="">` : '<span>🎯</span>';
  };
  const missionCard = (m) => {
    const pct = Math.min(100, Math.floor((m.progress / m.target) * 100));
    const unit = m.metric === 'WAGER' ? coins : num;
    const button = m.state === 'CLAIMABLE' ? `<button class="gd-ms-btn claim" data-ms-claim="${esc(m.id)}">領取</button>`
      : m.state === 'CLAIMED' ? '<button class="gd-ms-btn" disabled>已領取</button>' : `<button class="gd-ms-btn" data-ms-go="${esc(m.gameName || '')}">前往</button>`;
    return `<article class="gd-ms-card">${missionIcon(m)}<div><b>${esc(m.title)}</b><div class="gd-ms-bar"><span style="width:${pct}%"></span><em>${unit(m.progress)}/${unit(m.target)}</em></div><small>截止日期 ${day(new Date(new Date(m.deadline).getTime() - 1).toISOString())}</small></div><div class="gd-ms-reward"><i class="coin">G</i><strong>${coins(m.reward)}</strong>${button}</div></article>`;
  };
  const missionList = (list, tab) => `${list.length ? list.map(missionCard).join('') : '<div class="gd-ms-empty">目前沒有任務</div>'}<button class="gd-ms-all" data-ms-all="${tab}" ${list.some((m) => m.state === 'CLAIMABLE') ? '' : 'disabled'}>全領取</button>`;

  function renderCheckin(c) {
    const cells = c.rewards.map((r) => {
      const state = r.day < c.day || (r.day === c.day && c.checkedIn) ? 'done' : r.day === c.day ? 'today' : '';
      return `<div class="gd-day ${state}">第${r.day}天<b>${coins(r.coins)}</b></div>`;
    }).join('');
    return `<section class="gd-checkin"><header><b>每日簽到</b><button class="gd-ms-btn ${c.checkedIn ? '' : 'claim'}" style="width:auto;padding:7px 18px" data-checkin ${c.checkedIn ? 'disabled' : ''}>${c.checkedIn ? '今日已簽到' : '簽到'}</button></header><div class="gd-days">${cells}</div></section>`;
  }

  function renderMissions() {
    if (!msData) return;
    missionPanel.innerHTML = `<div class="gd-ms">${renderCheckin(msData.checkin)}<div class="gd-seg"><button data-ms-tab="daily" class="${msTab === 'daily' ? 'on' : ''}">每日任務</button><button data-ms-tab="weekly" class="${msTab === 'weekly' ? 'on' : ''}">本週加碼</button></div>${missionList(msData[msTab], msTab)}</div>`;
    familyTab.hidden = !msData.family;
    familyPanel.innerHTML = msData.family ? `<div class="gd-ms">${missionList(msData.family, 'family')}</div>` : '';
    $$('[data-ms-tab]', missionPanel).forEach((b) => (b.onclick = () => { msTab = b.dataset.msTab; renderMissions(); }));
    $$('[data-ms-claim]').forEach((b) => (b.onclick = () => claimMissions(b, `/missions/${b.dataset.msClaim}/claim`)));
    $$('[data-ms-all]').forEach((b) => (b.onclick = () => claimMissions(b, '/missions/claim-all', { tab: b.dataset.msAll })));
    $$('[data-ms-go]').forEach((b) => (b.onclick = () => goToGame(b.dataset.msGo)));
    const checkinButton = $('[data-checkin]', missionPanel);
    if (checkinButton) checkinButton.onclick = () => claimMissions(checkinButton, '/missions/checkin');
  }

  async function loadMissions() {
    if (!me) return;
    msData = await api.call('/missions');
    renderMissions();
  }

  /** 領取任務、全領取、簽到共用：入帳後金幣飛到錢包並重新整理。 */
  async function claimMissions(button, path, body) {
    button.disabled = true;
    try {
      const from = me.mainAvailable;
      const r = await api.call(path, { method: 'POST', body });
      if (Number(r.coins) > 0) {
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) await Promise.race([coinBurst(button, $('#openWallet .coin')), new Promise((ok) => setTimeout(ok, 2500))]);
        countUp($('#balance'), from, from + Number(r.coins));
      }
      await refresh();
      await loadMissions();
    } catch (err) { toast(err.message); button.disabled = false; }
  }

  /** 前往：開啟任務指定的遊戲；不限遊戲時回到大廳。 */
  function goToGame(name) {
    activityLayer.hidden = true;
    const g = catalog.find((x) => x[0] === name);
    if (g) openGame(g);
  }

  $('#openActivity').addEventListener('click', () => { if (me) loadMissions().catch((err) => console.warn('missions', err)); });
  $('[data-activity-tab="missions"]').addEventListener('click', () => { if (requireLogin()) loadMissions().catch((err) => toast(err.message)); });

  // ---------- 會員中心：遊戲紀錄 ----------
  const RECORD_PERIODS = ['today', 'yesterday', 'week', 'lastweek'];
  async function loadRecords(period = 'today') {
    if (!me) return;
    const { records } = await api.call('/me/game-records?period=' + period);
    $('#recordRows').innerHTML = records.map((r) => `<tr><td>${esc(r.gameName)}<br><small>${num(r.rounds)} 局</small></td><td>${coins(r.wager)}</td></tr>`).join('') || '<tr><td colspan="2">這段期間沒有遊戲紀錄</td></tr>';
  }
  $('[data-panel="records"] .page-note').textContent = '遊戲紀錄即時更新（台灣時間）';
  $$('.periods button').forEach((b, i) => b.addEventListener('click', () => loadRecords(RECORD_PERIODS[i]).catch(() => {})));
  $('[data-page="records"]').addEventListener('click', () => loadRecords(RECORD_PERIODS[$$('.periods button').findIndex((b) => b.classList.contains('active'))] || 'today').catch(() => {}));

  // ---------- 會員選單：登出 ----------
  // ---------- 推薦與分享 ----------
  // 分享連結 ?ref=<UID>&family=<家族ID>：先記下來，登入後綁定推薦人並開啟家族邀請頁
  const SHARE_KEY = 'gd-share';
  (() => {
    const q = new URLSearchParams(location.search);
    if (!q.get('ref') && !q.get('family')) return;
    try { localStorage.setItem(SHARE_KEY, JSON.stringify({ ref: q.get('ref') || '', family: q.get('family') || '' })); } catch {}
    history.replaceState(null, '', location.pathname);
  })();
  const shareLink = (family) => `${location.origin}${location.pathname}?ref=${encodeURIComponent(me.profile.aid)}${family ? '&family=' + encodeURIComponent(family) : ''}`;

  async function handleShareLink() {
    let share = null;
    try { share = JSON.parse(localStorage.getItem(SHARE_KEY) || 'null'); localStorage.removeItem(SHARE_KEY); } catch {}
    if (!share) return;
    if (share.ref && share.ref !== me.profile.aid) await api.call('/referrals/bind', { method: 'POST', body: { code: share.ref } }).then(() => loadReferral()).catch(() => {});
    if (share.family) familyInviteSheet(share.family, share.ref).catch(() => {});
  }

  /** 分享連結開啟的家族邀請頁。 */
  async function familyInviteSheet(familyId, ref) {
    const f = await api.call('/families/' + familyId);
    const mine = me.family?.id === f.id;
    const s = openSheet(`<div class="clan-crest" style="margin:0 auto">${familyIcon(esc(f.crest || '⚔️'))}</div><h3>${esc(f.name)}</h3><small>Lv.${f.level}・成員 ${f.members.length} / ${f.max_members}</small>
      ${noticeBubble(f, false)}${mine ? '<p class="fam-note">你已經是這個家族的成員</p>' : me.family ? `<p class="fam-note">你已加入「${esc(me.family.name)}」，需先退出才能加入</p>` : '<button class="fam-btn" data-join>加入家族</button>'}`);
    const join = $('[data-join]', s);
    if (join) join.onclick = async () => {
      try {
        const r = await api.call(`/families/${f.id}/join-link`, { method: 'POST', body: { ref } });
        sheet.hidden = true;
        await refresh();
        toast(r.status === 'JOINED' ? `已加入「${f.name}」` : '已送出入族申請，等待家族長審核');
      } catch (err) { toast(err.message); }
    };
  }

  const REF_STATUS = { PAID: '已發獎勵', BELOW_MIN: '首儲未達門檻', BLOCKED_SAME_IP: '同 IP 不發' };
  let referral = null;
  async function loadReferral() {
    referral = await api.call('/referrals/me');
    const r = referral;
    $$('.profile-list li strong')[3].textContent = r.referrer ? `${r.referrer.nickname || 'GD會員'}（${r.referrer.aid}）` : '無';
    $$('.profile-list li button')[3].hidden = Boolean(r.referrer) || !r.canBind;
  }

  /** 我推薦的會員：首儲與獎勵（推薦分享頁內）。 */
  const referralList = (r) => `<div class="fam-section"><h4>我的推薦（${r.totals.count} 人・已首儲 ${r.totals.deposited}・累計 ${coins(r.totals.earned)}）</h4>${r.referred.length
    ? `<table class="data-table"><thead><tr><th>暱稱</th><th>加入日</th><th>首儲</th><th>獎勵</th></tr></thead><tbody>${r.referred.map((x) => `<tr><td>${esc(x.nickname || 'GD會員')}<br><small>${esc(x.aid)}</small></td><td>${day(x.referred_at)}</td><td>${x.status ? esc(REF_STATUS[x.status]) : '尚未儲值'}</td><td>${x.status === 'PAID' ? coins(x.referrer_amount) : '—'}</td></tr>`).join('')}</tbody></table>`
    : '<small>還沒有推薦的會員</small>'}</div>`;

  // ---------- 會員中心：優惠紀錄（近一個月領取與進行中） ----------
  const PROMO_STATE = { ACTIVE: '進行中', ACTIVE_STARTED: '進行中', CLAIMABLE: '可領取', CLAIMED: '已領取', EXPIRED_UNUSED: '已過期', FORCED_SETTLEMENT_REVIEW: '結算審核中', FORCED_SETTLED: '已結算' };
  async function loadPromoRecords() {
    const { promotions } = await api.call('/promotions/me?days=30');
    $('#promoRows').innerHTML = promotions.map((p) => `<tr><td>${esc(p.promotion)}<br><small>${esc(PROMO_STATE[p.status] || p.status)}</small></td><td><div class="promo-bar"><i style="width:${p.percent}%"></i></div><small>${p.percent}%</small></td><td>${day(p.acceptedAt)}${p.closedAt ? `<br><small>${day(p.closedAt)} 結束</small>` : ''}</td></tr>`).join('')
      || '<tr><td colspan="3" style="text-align:center">近一個月沒有優惠紀錄</td></tr>';
  }
  $('[data-page="referral"]').addEventListener('click', () => { if (me) loadPromoRecords().catch((err) => toast(err.message)); });

  async function copyText(text, done) {
    try { await navigator.clipboard.writeText(text); toast(done); } catch { prompt('請複製連結', text); }
  }
  const shareButtons = (url, text) => `<input readonly value="${esc(url)}"><button class="fam-btn" data-copy>複製連結</button>
    <a class="fam-btn ghost" style="text-decoration:none" target="_blank" rel="noopener" href="https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}">用 LINE 分享</a>
    ${navigator.share ? '<button class="fam-btn ghost" data-native>其他分享方式</button>' : ''}`;
  const bindShare = (s, url, text) => {
    $('[data-copy]', s).onclick = () => copyText(url, '已複製連結');
    if ($('[data-native]', s)) $('[data-native]', s).onclick = () => navigator.share({ title: 'GD 金龍娛樂城', text, url }).catch(() => {});
  };

  /** 推薦分享：一個連結同時帶推薦碼與家族邀請；顯示獎勵規則與補綁推薦人。 */
  async function referralSheet() {
    await loadReferral();
    const r = referral;
    const f = me.family;
    const url = shareLink(f?.id);
    const text = f ? `一起加入「${f.name}」家族，在 GD 一起玩！首儲雙方都有獎勵。` : '用我的推薦碼加入 GD，首儲雙方都有獎勵！';
    const how = f ? `朋友點連結進入 GD，登入後會看到「${esc(f.name)}」的邀請頁${f.myRole === 'MEMBER' ? '並送出入族申請' : '並可直接加入'}；還沒有推薦人的會自動綁定你` : '朋友點連結註冊即綁定你為推薦人；加入家族後，同一個連結也會帶家族邀請';
    const bind = r.referrer ? `<small>推薦人：${esc(r.referrer.nickname || 'GD會員')}（${esc(r.referrer.aid)}）</small>`
      : r.canBind ? `<small>還沒有推薦人？${day(r.bindUntil)} 前可補填</small><div class="gd-search"><input name="code" inputmode="numeric" placeholder="推薦人 UID"><button class="fam-btn" data-bind>綁定</button></div>` : '<small>已超過可補填推薦人的期限</small>';
    const s = openSheet(`<h3>推薦分享</h3><div class="gw-card"><div><small>我的推薦碼</small><b>${esc(r.code)}</b></div><div><small>好友首儲滿 ${num(r.rules.minDepositNtd)} 元</small><b>雙方各得 ${coins(r.rules.referrerReward)}</b></div></div>
      <small>${how}</small>${shareButtons(url, text)}${bind}${referralList(r)}`);
    bindShare(s, url, text);
    const b = $('[data-bind]', s);
    if (b) b.onclick = async () => {
      try { await api.call('/referrals/bind', { method: 'POST', body: { code: $('[name=code]', s).value.trim() } }); toast('已綁定推薦人'); referralSheet(); } catch (err) { toast(err.message); }
    };
  }

  const refBtn = $('.person-actions button');
  refBtn.onclick = () => { if (requireLogin()) referralSheet().catch((err) => toast(err.message)); };
  $$('.profile-list li button')[3].onclick = refBtn.onclick;

  /** 會員中心「所屬家族」：未加入時開家族中心；已加入時可開啟家族或退出。 */
  $$('.profile-list li button')[4].onclick = () => {
    if (!requireLogin()) return;
    const f = me.family;
    if (!f) return $('#openClan').click();
    const lone = f.myRole === 'LEADER' && f.members.length === 1;
    const locked = f.lockedUntil && f.lockedUntil > new Date().toISOString();
    const s = openSheet(`<h3>${esc(f.name)}</h3><small>我的身分：${ROLE[f.myRole]}${locked ? `・${day(f.lockedUntil)} 前不可退出（入會金幣）` : ''}</small>
      <button class="fam-btn" data-open>開啟家族</button><button class="fam-btn danger" data-leave>${lone ? '解散家族' : '退出家族'}</button>`);
    $('[data-open]', s).onclick = () => { s.hidden = true; $('#openClan').click(); };
    $('[data-leave]', s).onclick = () => { if (confirm(f.myRole === 'LEADER' && !lone ? '家族長需先移交職位才能退出。仍要繼續？' : lone ? '確定解散家族？' : '確定退出家族？')) familyAction('/families/me/leave', { method: 'POST' }, lone ? '已解散家族' : '已退出家族'); };
  };

  const logout = document.createElement('div');
  logout.innerHTML = '<span>會員帳號</span> <button>登出</button>';
  $('.tool-legal').appendChild(logout);
  $('button', logout).onclick = () => { api.logout(); location.reload(); };

  // 點會員頭像或錢包時，未登入就先登入
  ['#openProfile', '#openProfileAvatar', '#openWallet', '#openShop'].forEach((s) => $(s).addEventListener('click', () => { if (!me) showLogin(); }));

  // 先取得會員資料，公告才有已讀狀態
  if (api.isLoggedIn()) refresh().then(loadContent); else { loadContent(); showLogin(); }

  // 從遊戲返回大廳（瀏覽器返回鍵會還原快取頁面）或切回此分頁時，重新取得餘額
  window.addEventListener('pageshow', (e) => { if (e.persisted) refresh(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
})();
