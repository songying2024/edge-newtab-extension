/**
 * storage.js — chrome.storage.local 封装（Promise 化 + 默认值合并）
 * 数据模型：
 *   settings     用户偏好（主题/引擎/小组件/天气城市）
 *   navGroups    导航分组
 *   localEvents  本地模式日程（未授权 WPS 时使用）
 *   wpsSid       WPS 会话（wps_sid，登录 WPS 日历后自动保存）
 *   wpsEvents    最近一次从 WPS 拉取的日程缓存（离线可读）
 */

const DEFAULTS = {
  settings: {
    theme: "auto", // light | dark | auto
    engine: null, // null 表示使用 CONFIG.defaultEngine
    customEngines: [], // 用户自定义搜索引擎 [{ id, name, url }]
    widgets: null, // 小组件配置 [{ id, type }]，null 表示使用默认
  },
  todoItems: [], // 待办清单 [{ text, done }]
  noteText: "", // 便签文本
  navGroups: null, // null 表示使用 CONFIG.defaultGroups
  localEvents: [],
  // WPS 会话（必须在 DEFAULTS 声明，否则 getAll() 不会返回这些键）
  wpsSid: null, // 登录 WPS 日历后保存的 wps_sid
  wpsLoggedOut: false, // 登出标记：置位后忽略所有会话
  wpsLoggedInAt: 0, // 最近登录时间戳
  wpsEvents: [],
  wpsLastSync: 0,
};

/** 读取全部数据，并与默认值合并 */
async function getAll() {
  const raw = await chrome.storage.local.get(null);
  const merged = {};
  for (const key of Object.keys(DEFAULTS)) {
    if (raw[key] !== undefined) merged[key] = raw[key];
    else merged[key] = DEFAULTS[key];
  }
  return merged;
}

/** 读取单个键 */
async function get(key) {
  const all = await getAll();
  return all[key];
}

/** 写入一个或多个键（局部更新） */
async function set(partial) {
  await chrome.storage.local.set(partial);
}

/** 更新对象类型字段的局部字段（如 settings） */
async function patch(key, fields) {
  const current = await get(key) || {};
  await set({ [key]: { ...current, ...fields } });
}

export const store = { getAll, get, set, patch, DEFAULTS };
