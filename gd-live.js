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
  const time = (iso) => { const d = new Date(iso); return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const toast = (msg) => alert(msg);
  const ROLE = { LEADER: '家族長', VICE: '副家族長', MEMBER: '一般成員' };
  const INVITE_STATUS = { ACCEPTED: '已加入家族', DECLINED: '已拒絕邀請', EXPIRED: '邀請已失效' };
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
    const level = me.vip.level;
    const pct = me.vipProgress.next ? Math.min(100, Math.floor((me.vipProgress.rollingDepositNtd / me.vipProgress.next.thresholdNtd) * 100)) : 100;
    // Header
    $('#openProfile b').textContent = name;
    $('#openProfile small').textContent = 'VIP ' + level;
    const bar = $('#openProfile .vip-progress');
    bar.setAttribute('aria-valuenow', pct);
    bar.setAttribute('aria-label', `VIP 進度 ${pct}%`);
    $('i', bar).style.width = pct + '%';
    $('#balance').textContent = coins(me.mainAvailable);
    // 會員中心
    $('.person-head h2').textContent = name;
    $('.vip-badge').textContent = 'VIP' + level;
    const rows = $$('.profile-list li strong');
    rows[0].textContent = me.profile.aid;
    rows[1].textContent = coins(me.mainAvailable);
    rows[2].textContent = me.profile.phone;
    $('.profile-list li button').onclick = () => navigator.clipboard?.writeText(me.profile.aid);
    // 錢包與商城
    $('.wallet-summary b').textContent = coins(me.mainAvailable);
    $('.shop-balance span').textContent = 'VIP ' + level;
    $('.shop-balance b').textContent = 'G ' + coins(me.mainAvailable);
    if (!$('#walletLayer').hidden) renderWallet();
    // 所屬家族
    loadMail().catch(() => {});
    loadMyFamily();
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
    metrics[3].textContent = '已開通';
    const lock = $('.gift-lock', page);
    if (!e.canSend) { lock.innerHTML = '<strong>VIP 2 以上即可贈禮</strong><span>儲值累積達 VIP 2 後開放。</span>'; return; }
    lock.className = 'gift-lock gd-send';
    lock.innerHTML = '<div><input name="aid" placeholder="對方 UID" inputmode="numeric"><input name="amount" type="number" min="0.01" step="0.01" placeholder="G幣"></div><button type="button">送出禮物</button>';
    $('button', lock).onclick = async () => { if (await sendGift($('[name=aid]', lock).value.trim(), Number($('[name=amount]', lock).value))) renderGiftRules(); };
  }

  /** 送禮共用（禮物頁與家族成員）；成功回傳 true。 */
  async function sendGift(toAid, amount) {
    try {
      const r = await api.call('/gifts', { method: 'POST', body: { toAid, amount }, idempotent: true });
      toast(`已送出，對方接受後可收到 ${coins(r.receiveAmount)} G幣`);
      await refresh();
      return true;
    } catch (err) { toast(err.message); return false; }
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
      return `<tr><td>${esc(g.id.slice(0, 8).toUpperCase())}<br>${time(g.created_at)}</td><td>${esc(other)}<br>${coins(direction === 'send' ? g.amount : g.receive_amount)} 點</td><td class="gift-state">${actions}</td></tr>`;
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
    $('tbody', page).innerHTML = rows.map((g) => `<tr><td>${esc(g.id.slice(0, 8).toUpperCase())}<br>${time(g.created_at)}</td><td>${esc(g.out ? g.receiver_nickname || g.receiver_aid : g.sender_nickname || g.sender_aid)}<br>${coins(g.out ? g.amount : g.receive_amount)} 點</td><td>${g.out ? '送出' : '收到'}・${esc(GIFT_STATUS[g.status])}</td></tr>`).join('') || '<tr><td colspan="3">目前沒有紀錄</td></tr>';
    $('.gift-info', page).textContent = '顯示最近 50 筆已完成的禮物。';
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
    .gd-chat .chat-safe{font-size:11px;color:#aeb8e8;text-align:center;padding:6px 10px 0}`;
  document.head.appendChild(familyStyle);

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
    $('#clanMembers').innerHTML = apply + memberRows(f.members, false);
    bindMemberRows($('#clanMembers'));
    const btn = $('[data-apply]', $('#clanMembers'));
    if (btn) btn.onclick = async () => {
      try { await api.call(`/families/${btn.dataset.apply}/applications`, { method: 'POST' }); toast('已送出申請，等待家族長審核'); } catch (err) { toast(err.message); }
    };
    clanDetail.hidden = false;
  };

  /** 成員列表；點 UID 開啟私訊／送禮（自己除外）。 */
  const memberRows = (members, manage) => members.map((m) => `<div class="clan-member">
      <button class="fam-who" data-member="${esc(m.aid)}" data-name="${esc(m.nickname || m.aid)}" data-role="${m.role}"${manage ? ' data-manage' : ''}>
        <i class="fam-dot${m.online ? ' on' : ''}"></i><span><b>${esc(m.nickname || 'GD會員')}</b> <span class="fam-role">${ROLE[m.role]}</span><br><span class="fam-uid">UID ${esc(m.aid)}</span>　<small>VIP ${m.vip_level}</small></span>
      </button><small>貢獻 ${num(m.contribution)}</small></div>`).join('');

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
    act('gift', () => giftSheet(m.aid, m.name));
    act('role', () => familyAction(`/families/me/members/${m.aid}/role`, { method: 'PUT', body: { role: m.role === 'VICE' ? 'MEMBER' : 'VICE' } }, '已更新職位'));
    act('kick', () => { if (confirm(`確定將 ${m.name} 移出家族？`)) familyAction(`/families/me/members/${m.aid}/kick`, { method: 'POST' }, '已移出家族'); });
  }

  /** 家族操作共用：呼叫後重新整理家族面板。 */
  async function familyAction(path, opts, done) {
    try { await api.call(path, opts); sheet.hidden = true; await refresh(); if (done) toast(done); } catch (err) { toast(err.message); }
  }

  function giftSheet(toAid, name) {
    const s = openSheet(`<h3>送禮給 ${esc(name)}</h3><small>主錢包可用 ${coins(me.mainAvailable)} G幣，手續費由送出金額內扣</small>
      <input name="amount" type="number" min="0.01" step="0.01" placeholder="G幣"><button class="fam-btn" data-send>送出禮物</button>`);
    $('[data-send]', s).onclick = async () => { if (await sendGift(toAid, Number($('[name=amount]', s).value))) sheet.hidden = true; };
  }

  function inviteSheet() {
    const s = openSheet(`<h3>邀請成員</h3><small>輸入對方 UID，對方會在信箱收到邀請信</small><input name="aid" inputmode="numeric" placeholder="對方 UID"><button class="fam-btn" data-send>寄出邀請</button>`);
    $('[data-send]', s).onclick = () => familyAction('/families/me/invites', { method: 'POST', body: { aid: $('[name=aid]', s).value.trim() } }, '已寄出邀請信');
  }

  async function createSheet() {
    const { crests, createMinVip } = await api.call('/families/crests');
    let crest = crests[0];
    const s = openSheet(`<h3>建立家族</h3><div class="fam-form">
      <label>家族名稱（2–16 字）<input name="name" maxlength="16"></label>
      <label>家族標語<input name="slogan" maxlength="60" placeholder="一起挑戰本週目標"></label>
      <label>家族徽章<div class="fam-crests">${crests.map((c, i) => `<button type="button" data-crest="${c}" class="${i ? '' : 'on'}">${c}</button>`).join('')}</div></label>
      </div><p class="fam-note">VIP ${createMinVip} 以上可建立家族${me.vip.level < createMinVip ? `（目前 VIP ${me.vip.level}）` : ''}</p><button class="fam-btn" data-send>建立家族</button>`);
    $$('[data-crest]', s).forEach((b) => (b.onclick = () => { crest = b.dataset.crest; $$('[data-crest]', s).forEach((x) => x.classList.toggle('on', x === b)); }));
    $('[data-send]', s).onclick = () => familyAction('/families', { method: 'POST', body: { name: $('[name=name]', s).value, slogan: $('[name=slogan]', s).value, crest } }, '家族建立成功');
  }

  /** 重新讀取所屬家族，更新會員中心與「我的家族」。 */
  async function loadMyFamily() {
    me.family = await api.call('/families/me').catch(() => null);
    $$('.profile-list li strong')[4].textContent = me.family ? me.family.name : '無';
    await renderMyClan().catch(() => {});
  }

  async function renderMyClan() {
    const panel = $('[data-clan-panel="mine"]');
    const f = me?.family;
    if (!f) {
      panel.innerHTML = `<div class="clan-empty"><div><div class="crest">⚔️</div><strong>尚未加入家族</strong><p>建立自己的家族，或到「所有家族」申請加入。<br>收到家族邀請信時，可在信箱直接加入。</p>
        <div class="fam-actions">${me ? '<button class="fam-btn" data-create>建立家族</button>' : ''}<button class="fam-btn ghost" data-browse>瀏覽所有家族</button></div></div></div>`;
      const create = $('[data-create]', panel);
      if (create) create.onclick = () => createSheet().catch((err) => toast(err.message));
      $('[data-browse]', panel).onclick = () => $('[data-clan-page="all"]').click();
      return;
    }
    const officer = f.myRole !== 'MEMBER';
    const [applications, chat] = await Promise.all([
      officer ? api.call('/families/me/applications').then((r) => r.applications).catch(() => []) : [],
      api.call('/chat').catch(() => ({ unread: 0 })),
    ]);
    panel.innerHTML = `<div class="clan-detail-head"><div class="clan-crest">${familyIcon(esc(f.crest || '⚔️'))}</div><h3>${esc(f.name)}</h3><span>${esc(f.notice || f.slogan || '')}</span></div>
      <div class="clan-detail-stats"><div><small>家族等級</small><b>${f.level}</b></div><div><small>家族聲望</small><b>${num(f.exp)}</b></div><div><small>家族公款</small><b>${coins(f.fund)}</b></div></div>
      <div class="fam-actions">
        <button class="fam-btn" data-room>💬 家族聊天${chat.unread ? `<span class="fam-badge">${chat.unread}</span>` : ''}</button>
        <button class="fam-btn ghost" data-inbox>私訊列表</button>
        ${officer ? '<button class="fam-btn" data-invite>＋ 邀請成員</button>' : ''}
        <button class="fam-btn danger" data-leave>${f.myRole === 'LEADER' && f.members.length === 1 ? '解散家族' : '退出家族'}</button>
      </div>
      ${applications.length ? `<div class="fam-section"><h4>入族申請（${applications.length}）</h4>${applications.map((a) => `<div class="fam-apply"><span>${esc(a.nickname || 'GD會員')} <small>UID ${esc(a.aid)}・VIP ${a.vip_level}</small></span><span><button class="gd-act" data-decide="${esc(a.id)}" data-to="approve">同意</button><button class="gd-act gray" data-decide="${esc(a.id)}" data-to="reject">拒絕</button></span></div>`).join('')}</div>` : ''}
      <div class="clan-members"><h4>我的身分：${ROLE[f.myRole]}　成員 ${f.members.length} / ${f.max_members}　<small>點成員可私訊或送禮</small></h4>${memberRows(f.members, officer)}</div>`;
    bindMemberRows(panel);
    $('[data-room]', panel).onclick = () => openChat('family', '家族聊天室');
    $('[data-inbox]', panel).onclick = () => openInbox();
    if ($('[data-invite]', panel)) $('[data-invite]', panel).onclick = inviteSheet;
    $('[data-leave]', panel).onclick = () => { if (confirm(f.myRole === 'LEADER' && f.members.length > 1 ? '家族長需先移交職位才能退出。仍要繼續？' : '確定退出家族？')) familyAction('/families/me/leave', { method: 'POST' }, '已退出家族'); };
    $$('[data-decide]', panel).forEach((b) => (b.onclick = () => familyAction(`/families/me/applications/${b.dataset.decide}/${b.dataset.to}`, { method: 'POST' }, b.dataset.to === 'approve' ? '已同意加入' : '已拒絕')));
  }

  $('#openClan').addEventListener('click', async () => { if (!requireLogin()) return; loadMyFamily(); await loadClans(); renderClans($('#clanSearch').value.trim()); });
  $('#clanInfo').onclick = () => toast('家族說明：VIP 6 以上可建立家族；一人同時只能加入一個家族。家族長與副家族長可寄邀請信、審核申請；成員之間可私訊、送禮，並一起累積家族聲望。');

  // ---------- 聊天：家族聊天室與私訊（每 3 秒更新） ----------
  const chatLayer = document.createElement('section');
  chatLayer.className = 'gd-chat';
  chatLayer.hidden = true;
  chatLayer.innerHTML = '<div><header><button data-back>←</button><b></b><button data-x>✕</button></header><div class="chat-body"></div><p class="chat-safe">請勿在聊天中提供帳號密碼或驗證碼；交易請使用遊戲內贈禮功能。</p><form hidden><input maxlength="300" placeholder="輸入訊息" autocomplete="off"><button class="fam-btn">送出</button></form></div>';
  document.body.appendChild(chatLayer);
  const chatBody = $('.chat-body', chatLayer);
  const chatForm = $('form', chatLayer);
  let chatTarget = null;
  let chatLast = 0;
  let chatTimer = null;
  const stopChat = () => { clearInterval(chatTimer); chatTimer = null; chatTarget = null; };
  $('[data-x]', chatLayer).onclick = () => { stopChat(); chatLayer.hidden = true; refresh(); };
  $('[data-back]', chatLayer).onclick = () => openInbox();

  async function openInbox() {
    stopChat();
    $('header b', chatLayer).textContent = '訊息';
    chatForm.hidden = true;
    chatLayer.hidden = false;
    const { conversations } = await api.call('/chat');
    chatBody.innerHTML = conversations.map((c) => `<button class="conv" data-target="${esc(c.target)}" data-title="${esc(c.title)}"><span><b>${c.target === 'family' ? '👥 ' : ''}${esc(c.title)}</b><small>${esc(c.lastBody || '還沒有訊息')}</small></span>${c.unread ? `<span class="fam-badge" style="position:static">${c.unread}</span>` : ''}</button>`).join('') || '<div class="tool-empty">目前沒有對話，點家族成員即可私訊</div>';
    $$('[data-target]', chatBody).forEach((b) => (b.onclick = () => openChat(b.dataset.target, b.dataset.title)));
  }

  async function openChat(target, title) {
    stopChat();
    chatTarget = target;
    chatLast = 0;
    $('header b', chatLayer).textContent = title;
    chatBody.innerHTML = '';
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
    chatBody.insertAdjacentHTML('beforeend', messages.map((m) => `<div class="msg${m.mine ? ' mine' : ''}"><small>${showName && !m.mine ? esc(m.nickname || m.aid) + '・' : ''}${time(m.created_at)}</small>${esc(m.body)}</div>`).join(''));
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  chatForm.onsubmit = async (e) => {
    e.preventDefault();
    const input = $('input', chatForm);
    const body = input.value.trim();
    if (!body || !chatTarget) return;
    try { await api.call(`/chat/${encodeURIComponent(chatTarget)}`, { method: 'POST', body: { body } }); input.value = ''; await pollChat(); } catch (err) { toast(err.message); }
  };
  $('#openRank').addEventListener('click', async () => { if (!me) return; await loadClans(); renderRank(); });

  // ---------- 自家哈希遊戲：由 GDBO 發 token，用會員錢包下注 ----------
  const HASH_GAMES = { 珠珠寶貝: 'plinko' };
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
      const { url } = await api.call('/game-sessions', { method: 'POST', body: { gameId, returnUrl: location.origin + location.pathname } });
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
      el.textContent = coins(Math.floor((from + (to - from) * (1 - (1 - k) ** 3)) * 100) / 100);
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
    page.innerHTML = '<button class="tool-back">← 返回設定</button><h3>信箱</h3>' + (mail.map((m) => `<div class="tool-row"><b>${m.read_at ? '' : '● '}${esc(m.title)}</b><small>${time(m.created_at)}${m.expires_at ? '・到期 ' + time(m.expires_at) : ''}</small><p style="margin:8px 0;white-space:pre-wrap">${esc(m.body)}</p>${
      m.reward_coins ? (m.claimed_at ? `<small>已領取 ${coins(m.reward_coins)} G幣</small>` : `<button class="gd-act" data-claim="${esc(m.id)}">領取 ${coins(m.reward_coins)} G幣</button>`) : ''}${
      m.invite_id ? (m.invite_status === 'PENDING' ? `<button class="gd-act" data-invite="${esc(m.invite_id)}" data-to="accept">加入家族</button><button class="gd-act gray" data-invite="${esc(m.invite_id)}" data-to="decline">拒絕</button>` : `<small>${INVITE_STATUS[m.invite_status] || ''}</small>`) : ''}</div>`).join('') || '<div class="tool-empty">目前沒有信件</div>');
    $$('[data-invite]', page).forEach((b) => (b.onclick = async () => {
      try { await api.call(`/families/invites/${b.dataset.invite}/${b.dataset.to}`, { method: 'POST' }); await refresh(); toast(b.dataset.to === 'accept' ? '已加入家族' : '已拒絕邀請'); } catch (err) { toast(err.message); loadMail().catch(() => {}); }
    }));
    $('.tool-back', page).onclick = () => showTool('');
    $$('[data-claim]', page).forEach((b) => (b.onclick = async () => {
      try { await api.call(`/mail/${b.dataset.claim}/claim`, { method: 'POST' }); await refresh(); toast('已領取'); } catch (err) { toast(err.message); }
    }));
    mail.filter((m) => !m.read_at && !m.reward_coins).forEach((m) => api.call(`/mail/${m.id}/read`, { method: 'POST' }).catch(() => {}));
  }
  mailItem.addEventListener('click', () => { if (requireLogin()) loadMail().catch((err) => toast(err.message)); });

  const codePage = $('[data-tool-page="giftcode"]');
  $('.tool-empty', codePage).outerHTML = '<div class="gd-send"><div><input name="code" placeholder="請輸入兌換碼" autocomplete="off"></div><button type="button">兌換</button></div><p class="tool-note">每個兌換碼每個帳號限用一次，獎勵會直接存入主錢包。</p>';
  $('.gd-send button', codePage).onclick = async () => {
    if (!requireLogin()) return;
    const input = $('[name=code]', codePage);
    try {
      const r = await api.call('/redemptions', { method: 'POST', body: { code: input.value.trim() } });
      input.value = '';
      await refresh();
      toast(`兌換成功，獲得 ${coins(r.coins)} G幣`);
    } catch (err) { toast(err.message); }
  };
  $('.redeem').addEventListener('click', () => { $('#toolLayer').hidden = false; showTool('giftcode'); });

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
