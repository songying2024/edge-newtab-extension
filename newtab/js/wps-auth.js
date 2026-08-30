/**
 * wps-auth.js — WPS 日历会话授权（wps_sid 方案，免 APPID / 企业资质）
 *
 * 流程：点击「登录授权」→ 弹出 WPS 网页版日历（365.kdocs.cn/rili/），
 * 用户用 WPS 账号登录（未登录自动跳 account.wps.cn）→ 扩展通过
 * chrome.cookies 轮询读取登录会话 cookie「wps_sid」→ 保存到本地 storage。
 *
 * 与已开发的 DSH 插件（wps-cloud-plugin-v2）同一套会话方案：
 * 以 `Cookie: wps_sid=xxx; csrf=xxx` 调用 WPS 日历网页版内部接口。
 * wps_sid 属高敏感凭证，仅保存在本机扩展 storage，绝不外发。
 */
import { CONFIG } from "./config.js";
import { store } from "./storage.js";

const SID_KEY = "wpsSid";
const LOGOUT_KEY = "wpsLoggedOut"; // 手动登出标记：置位后忽略所有会话，直到重新登录
const POLL_INTERVAL = 1500; // 轮询间隔（ms）
const POLL_TIMEOUT = 120000; // 最长等待 120s

/* ---------- 读取 cookie ---------- */
async function getCookie(url, name) {
  if (!chrome.cookies || !chrome.cookies.get) return null;
  try {
    const c = await chrome.cookies.get({ url, name });
    return c && c.value ? c.value : null;
  } catch (e) {
    return null;
  }
}

/** 依次探测多个 URL，返回第一个命中的 wps_sid */
async function findSidCookie() {
  for (const url of CONFIG.wps.cookieProbeUrls) {
    const sid = await getCookie(url, CONFIG.wps.sidCookieName);
    if (sid) return sid;
  }
  return null;
}

/* ---------- 授权状态 ---------- */
/** 返回当前可用的 wps_sid：优先实时 cookie，其次已保存的本地会话；手动登出后返回 null */
async function getSid() {
  const loggedOut = !!(await store.get(LOGOUT_KEY));
  if (!loggedOut) {
    const live = await findSidCookie();
    if (live) return live;
  }
  if (loggedOut) return null;
  const saved = await store.get(SID_KEY);
  return saved || null;
}

async function isAuthorized() {
  const sid = await getSid();
  return !!sid;
}

/**
 * 发起授权登录：弹出 WPS 日历页，随后在后台轮询 wps_sid。
 * @returns {Promise<string|null>} 登录成功返回 sid，超时返回 null
 */
function login() {
  // 清除登出标记，允许重新读取会话；随后打开 WPS 日历页让用户登录
  store.set({ [LOGOUT_KEY]: false });
  chrome.tabs.create({ url: CONFIG.wps.loginUrl, active: true });

  return new Promise((resolve) => {
    const begin = Date.now();
    const timer = setInterval(async () => {
      const sid = await findSidCookie();
      if (sid) {
        clearInterval(timer);
        await store.set({ [SID_KEY]: sid, [LOGOUT_KEY]: false, wpsLoggedInAt: Date.now() });
        resolve(sid);
        return;
      }
      if (Date.now() - begin > POLL_TIMEOUT) {
        clearInterval(timer);
        resolve(null);
      }
    }, POLL_INTERVAL);
  });
}

async function logout() {
  await store.set({ [SID_KEY]: null, [LOGOUT_KEY]: true, wpsEvents: [], wpsLastSync: 0 });
}

export const wpsAuth = {
  login,
  isAuthorized,
  getSid,
  logout,
};
