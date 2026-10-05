/* GD 會員後端（Cloudflare Workers）連線設定與共用呼叫。
 * 後端網址只在這裡設定；登入後的 token 存在 localStorage，關閉瀏覽器後仍保持登入（12 小時內）。 */
window.GD_API = (() => {
  const baseUrl = 'https://gdbo-api.sha-platform.workers.dev';
  const TOKEN_KEY = 'gd-member-token';
  const store = {
    get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
    set: (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {} },
  };

  /** 後端錯誤碼轉成玩家看得懂的訊息。 */
  const MESSAGES = {
    ERR_UNAUTHORIZED: '登入已過期，請重新登入',
    ERR_OTP_INVALID: '驗證碼錯誤或已過期',
    ERR_OTP_RATE_LIMITED: '驗證碼請求太頻繁，請稍後再試',
    ERR_INSUFFICIENT_BALANCE: '餘額不足',
    ERR_GIFT_NOT_ALLOWED: '目前 VIP 等級尚未開放贈禮',
    ERR_WAGER_NOT_MET: '有效投注尚未達標',
    ERR_GIFT_DAILY_CAP: '已達今日贈禮額度',
    ERR_GIFT_PARTNER_LIMIT: '已達今日贈禮對象上限',
    ERR_GIFT_RECEIVER_INVALID: '找不到這位玩家',
    ERR_GIFT_NOT_PENDING: '這筆禮物已處理',
    ERR_MEMBER_NOT_ACTIVE: '帳號已停用，請聯絡客服',
    ERR_VALIDATION: '輸入資料有誤',
    ERR_NICKNAME_TAKEN: '這個暱稱已經有人使用了',
    ERR_NICKNAME_LOCKED: '暱稱通過後 2 週內不能再修改',
    ERR_NICKNAME_UNCHANGED: '和目前的暱稱相同',
    ERR_CODE_INVALID: '兌換碼無效或已過期',
    ERR_CODE_ALREADY_REDEEMED: '這個兌換碼已經用過了',
    ERR_CODE_EXHAUSTED: '兌換碼已被領完',
    ERR_CODE_VIP_REQUIRED: 'VIP 等級不足，無法使用這個兌換碼',
    ERR_NOTHING_TO_CLAIM: '這封信沒有可領取的獎勵',
    ERR_PROMOTION_NOT_AVAILABLE: '這個優惠已結束或不符資格',
    ERR_PROMOTION_LIMIT: '進行中的優惠已達上限',
    ERR_PROMOTION_ALREADY_TAKEN: '這個優惠已經領過了',
    ERR_PROMOTION_NOT_CLAIMABLE: '流水尚未達標，暫時不能領取',
    ERR_PROMOTION_VIP_TOO_LOW: 'VIP 等級不足，無法參加這個優惠',
    ERR_MISSION_NOT_COMPLETE: '任務尚未完成',
    ERR_MISSION_ALREADY_CLAIMED: '這個任務的獎勵已經領過了',
    ERR_ALREADY_CHECKED_IN: '今天已經簽到過了',
    ERR_FAMILY_VIP_TOO_LOW: 'VIP 等級不足',
    ERR_FAMILY_ALREADY_MEMBER: '已經加入家族了',
    ERR_FAMILY_NOT_MEMBER: '尚未加入家族',
    ERR_FAMILY_NOT_OFFICER: '只有家族長或副家族長可以操作',
    ERR_FAMILY_NAME_TAKEN: '這個家族名稱已經有人使用',
    ERR_FAMILY_FULL: '家族人數已滿',
    ERR_FAMILY_LEADER_CANNOT_LEAVE: '家族長需先移交職位才能退出',
    ERR_FAMILY_INVITE_PENDING: '已經邀請過這位玩家，等待對方回覆',
    ERR_FAMILY_INVITE_INVALID: '邀請已過期或失效',
    ERR_FAMILY_LEAVE_LOCKED: '收邀請金幣入會後 14 天內不可退出',
    ERR_FAMILY_REQUEST_PENDING: '已有審核中的建立申請',
    ERR_FAMILY_REQUEST_NOT_PENDING: '沒有審核中的申請',
    ERR_CHAT_NOT_ALLOWED: '同家族成員或互相關注後才能私訊',
    ERR_REFERRAL_INVALID: '推薦碼無效，不能填自己或你推薦的人',
    ERR_REFERRAL_ALREADY_BOUND: '已經綁定過推薦人',
    ERR_REFERRAL_EXPIRED: '已超過可補填推薦人的期限',
    ERR_PHONE_NOT_BOUND: '請先綁定手機才能私訊與送禮',
    ERR_CHAT_RATE_LIMITED: '訊息太頻繁，請稍後再試',
    ERR_NOT_FOUND: '找不到這位玩家或資料',
  };

  async function call(path, { method = 'GET', body, idempotent } = {}) {
    const headers = {};
    const token = store.get();
    if (token) headers.Authorization = 'Bearer ' + token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (idempotent) headers['Idempotency-Key'] = crypto.randomUUID();
    const res = await fetch(baseUrl + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) store.set(null);
      const err = new Error(MESSAGES[data.error] || data.message || '連線失敗，請稍後再試');
      err.code = data.error;
      err.detail = data;
      throw err;
    }
    return data;
  }

  return {
    call,
    isLoggedIn: () => Boolean(store.get()),
    async login(challengeId, code) {
      const { token } = await call('/auth/otp/verify', { method: 'POST', body: { challengeId, code } });
      store.set(token);
    },
    requestOtp: (phone) => call('/auth/otp/request', { method: 'POST', body: { phone } }),
    logout: () => store.set(null),
  };
})();
