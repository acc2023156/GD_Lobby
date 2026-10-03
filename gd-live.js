/* 大廳串接真實會員資料（GD 會員後端）。
 * 未登入時保留原本的展示資料；登入後以後端資料覆蓋 Header、會員中心、錢包、商城儲值、禮物、家族與家族排行。
 * 本檔在 index.html 主程式之後載入，直接沿用主程式的 clans、rankData、renderClans 等變數與畫面。 */
(() => {
  const api = window.GD_API;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const num = (v) => Number(v || 0).toLocaleString();
  const time = (iso) => { const d = new Date(iso); return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const toast = (msg) => alert(msg);
  const ROLE = { LEADER: '家族長', VICE: '副家族長', MEMBER: '一般成員' };
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
    const level = me.vip.level;
    const pct = me.vipProgress.next ? Math.min(100, Math.floor((me.vipProgress.rollingDepositNtd / me.vipProgress.next.thresholdNtd) * 100)) : 100;
    // Header
    $('#openProfile b').textContent = name;
    $('#openProfile small').textContent = 'VIP ' + level;
    const bar = $('#openProfile .vip-progress');
    bar.setAttribute('aria-valuenow', pct);
    bar.setAttribute('aria-label', `VIP 進度 ${pct}%`);
    $('i', bar).style.width = pct + '%';
    $('#balance').textContent = num(me.mainAvailable);
    // 會員中心
    $('.person-head h2').textContent = name;
    $('.vip-badge').textContent = 'VIP' + level;
    const rows = $$('.profile-list li strong');
    rows[0].textContent = me.profile.aid;
    rows[1].textContent = num(me.mainAvailable);
    rows[2].textContent = me.profile.phone;
    $('.profile-list li button').onclick = () => navigator.clipboard?.writeText(me.profile.aid);
    // 錢包與商城
    $('.wallet-summary b').textContent = num(me.mainAvailable);
    $('.shop-balance span').textContent = 'VIP ' + level;
    $('.shop-balance b').textContent = 'G ' + num(me.mainAvailable);
    // 所屬家族
    api.call('/families/me').then((f) => { me.family = f; rows[4].textContent = f.name; renderMyClan(); }).catch(() => { me.family = null; rows[4].textContent = '無'; renderMyClan(); });
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
    $('.gift-status b', page).textContent = e.canSend ? num(Math.min(e.dailyRemaining, me.mainAvailable)) : '0';
    $('.gift-status span', page).textContent = e.canSend ? `手續費 ${(e.feeBps / 100).toFixed(0)}%（由送出金額內扣）` : '目前 VIP 等級尚未開放贈禮';
    const metrics = $$('.gift-metric b', page);
    metrics[0].textContent = e.canSend ? num(e.dailyRemaining) : '權限不足';
    metrics[1].textContent = e.canSend ? `${e.partnersUsed} / ${e.partnerCap} 人` : '權限不足';
    metrics[2].textContent = e.canSend ? num(e.remainingWager) : '權限不足';
    metrics[3].textContent = '已開通';
    const lock = $('.gift-lock', page);
    if (!e.canSend) { lock.innerHTML = '<strong>VIP 2 以上即可贈禮</strong><span>儲值累積達 VIP 2 後開放。</span>'; return; }
    lock.className = 'gift-lock gd-send';
    lock.innerHTML = '<div><input name="aid" placeholder="對方 UID" inputmode="numeric"><input name="amount" type="number" min="1" placeholder="G幣"></div><button type="button">送出禮物</button>';
    $('button', lock).onclick = async () => {
      const toAid = $('[name=aid]', lock).value.trim();
      const amount = Number($('[name=amount]', lock).value);
      try {
        const r = await api.call('/gifts', { method: 'POST', body: { toAid, amount }, idempotent: true });
        toast(`已送出，對方接受後可收到 ${num(r.receiveAmount)} G幣`);
        await refresh();
        renderGiftRules();
      } catch (err) { toast(err.message); }
    };
  }

  const nativeRenderGiftCenter = window.renderGiftCenter;
  window.renderGiftCenter = async function () {
    if (!me) return nativeRenderGiftCenter();
    const direction = giftDirection;
    const { gifts } = await api.call('/gifts?direction=' + direction);
    giftCenterRows.innerHTML = gifts.map((g) => {
      const other = direction === 'send' ? g.receiver_nickname || g.receiver_aid : g.sender_nickname || g.sender_aid;
      const actions = g.status !== 'PENDING' ? esc(GIFT_STATUS[g.status])
        : direction === 'receive' ? `<button class="gd-act" data-gift="${esc(g.id)}" data-act="accept">接受</button><button class="gd-act gray" data-gift="${esc(g.id)}" data-act="reject">拒收</button>`
        : `${GIFT_STATUS.PENDING}<br><button class="gd-act gray" data-gift="${esc(g.id)}" data-act="cancel">撤回</button>`;
      return `<tr><td>${esc(g.id.slice(0, 8).toUpperCase())}<br>${time(g.created_at)}</td><td>${esc(other)}<br>${num(direction === 'send' ? g.amount : g.receive_amount)} 點</td><td class="gift-state">${actions}</td></tr>`;
    }).join('') || '<tr><td colspan="3">目前沒有紀錄</td></tr>';
    $$('[data-gift]', giftCenterRows).forEach((b) => (b.onclick = async () => {
      try { await api.call(`/gifts/${b.dataset.gift}/${b.dataset.act}`, { method: 'POST' }); await refresh(); renderGiftCenter(); } catch (err) { toast(err.message); }
    }));
  };

  async function renderGiftHistory() {
    if (!me) return;
    const [sent, received] = await Promise.all([api.call('/gifts?direction=send'), api.call('/gifts?direction=receive')]);
    const rows = [...sent.gifts.map((g) => ({ ...g, out: true })), ...received.gifts.map((g) => ({ ...g, out: false }))]
      .filter((g) => g.status !== 'PENDING')
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const page = $('[data-gift-subpage="history"]');
    $('tbody', page).innerHTML = rows.map((g) => `<tr><td>${esc(g.id.slice(0, 8).toUpperCase())}<br>${time(g.created_at)}</td><td>${esc(g.out ? g.receiver_nickname || g.receiver_aid : g.sender_nickname || g.sender_aid)}<br>${num(g.out ? g.amount : g.receive_amount)} 點</td><td>${g.out ? '送出' : '收到'}・${esc(GIFT_STATUS[g.status])}</td></tr>`).join('') || '<tr><td colspan="3">目前沒有紀錄</td></tr>';
    $('.gift-info', page).textContent = '顯示最近 50 筆已完成的禮物。';
  }

  function renderGiftWallet() {
    if (!me) return;
    const page = $('[data-gift-page="wallet"]');
    $('.gift-status small', page).textContent = '主錢包餘額';
    $('.gift-status b', page).textContent = 'G ' + num(me.mainAvailable);
    $('.gift-safe', page).textContent = '餘額與交易紀錄由 GD 會員後端帳務系統提供。';
  }

  $('#openGift').addEventListener('click', () => { if (!requireLogin()) return; renderGiftRules(); renderGiftWallet(); });
  $$('.gift-subtab').forEach((tab) => tab.addEventListener('click', () => { if (tab.dataset.giftSub === 'history') renderGiftHistory(); }));

  // ---------- 家族 ----------
  /** 後端家族資料轉成主程式 clans 的格式（多一欄 id 供查詢明細）。 */
  async function loadClans() {
    if (!me) return;
    const { families } = await api.call('/families');
    clans.splice(0, clans.length, ...families.map((f) => [f.name, f.crest || '⚔️', String(f.level), num(f.exp), `${f.member_count} / ${f.max_members}`, f.slogan || '', f.id]));
    rankData.family = families.map((f) => [f.name, f.crest || '⚔️', num(f.exp)]);
  }

  const nativeShowClan = window.showClan;
  window.showClan = async function (c) {
    if (!me || !c[6]) return nativeShowClan(c);
    const f = await api.call('/families/' + c[6]);
    $('#detailCrest').innerHTML = familyIcon(esc(f.crest || '⚔️'));
    $('#detailName').textContent = f.name;
    $('#detailSlogan').textContent = f.slogan || '';
    $('#detailLevel').textContent = f.level;
    $('#detailRep').textContent = num(f.exp);
    $('#detailMembers').textContent = `${f.members.length} / ${f.max_members}`;
    $('#clanMembers').innerHTML = memberRows(f.members);
    clanDetail.hidden = false;
  };

  const memberRows = (members) => members.map((m) => `<div class="clan-member"><span>${ROLE[m.role]}　${esc(m.nickname || m.aid)}　<small>VIP ${m.vip_level}</small></span><small>貢獻 ${num(m.contribution)}</small></div>`).join('');

  function renderMyClan() {
    const panel = $('[data-clan-panel="mine"]');
    const f = me?.family;
    if (!f) return;
    panel.innerHTML = `<div class="clan-detail-head"><div class="clan-crest">${familyIcon(esc(f.crest || '⚔️'))}</div><h3>${esc(f.name)}</h3><span>${esc(f.notice || f.slogan || '')}</span></div>
      <div class="clan-detail-stats"><div><small>家族等級</small><b>${f.level}</b></div><div><small>家族聲望</small><b>${num(f.exp)}</b></div><div><small>家族公款</small><b>${num(f.fund)}</b></div></div>
      <div class="clan-members"><h4>我的身分：${ROLE[f.myRole]}　成員 ${f.members.length} / ${f.max_members}</h4>${memberRows(f.members)}</div>`;
  }

  $('#openClan').addEventListener('click', async () => { if (!requireLogin()) return; await loadClans(); renderClans($('#clanSearch').value.trim()); });
  $('#openRank').addEventListener('click', async () => { if (!me) return; await loadClans(); renderRank(); });

  // ---------- 會員選單：登出 ----------
  const logout = document.createElement('div');
  logout.innerHTML = '<span>會員帳號</span> <button>登出</button>';
  $('.tool-legal').appendChild(logout);
  $('button', logout).onclick = () => { api.logout(); location.reload(); };

  // 點會員頭像或錢包時，未登入就先登入
  ['#openProfile', '#openProfileAvatar', '#openWallet', '#openShop'].forEach((s) => $(s).addEventListener('click', () => { if (!me) showLogin(); }));

  if (api.isLoggedIn()) refresh(); else showLogin();
})();
