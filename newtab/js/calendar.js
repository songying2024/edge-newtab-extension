/**
 * calendar.js — 日历组件
 * 双模式：
 *  - 本地模式（未授权 WPS）：日程存 chrome.storage.local，离线可用
 *  - WPS 模式（已授权登录）：拉取/增删改 WPS 日历日程，实时同步
 * 组件内含：月历视图 + 当日日程列表 + 新建/编辑/删除日程。
 */
import { CONFIG } from "./config.js";
import { store } from "./storage.js";
import { wpsAuth } from "./wps-auth.js";
import { wpsApi } from "./wps-api.js";
import { lunarDateString, dayOfYear } from "./lunar.js";

/* ---------- 工具：日期 ---------- */
function pad(n) {
  return String(n).padStart(2, "0");
}
function fmtDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function today() {
  return fmtDate(new Date());
}
function parseDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
/* ---------- 状态 ---------- */
let localEvents = []; // 本地模式日程
let wpsEvents = []; // WPS 日程缓存
let authorized = false;
let viewYear, viewMonth; // 当前浏览的年月（month 0-11）
let selectedDate = today(); // 选中日期 YYYY-MM-DD

/* ---------- WPS 数据映射（真实字段：taskId/summary/orgStartTime/orgEndTime） ---------- */
function normalizeWpsEvent(e) {
  // WPS 返回 -> 内部结构
  const start = new Date(e.orgStartTime || e.startTime || Date.now());
  const end = new Date(e.orgEndTime || e.endTime || start);
  const startValid = !isNaN(start.getTime());
  const endValid = !isNaN(end.getTime());
  return {
    id: String(e.taskId), // 以 taskId 作为内部 id
    title: e.summary || e.title || "未命名日程",
    date: fmtDate(startValid ? start : new Date()),
    startTime: startValid ? `${pad(start.getHours())}:${pad(start.getMinutes())}` : "",
    endTime: endValid ? `${pad(end.getHours())}:${pad(end.getMinutes())}` : "",
    location: e.location || "",
    note: e.description || "",
    rawStart: startValid ? start.getTime() : null,
    rawEnd: endValid ? end.getTime() : null,
    wps: true,
  };
}
function toMs(dateStr, hm) {
  // 'YYYY-MM-DD' + 'HH:mm' -> 本地时区毫秒时间戳（与 WPS 存储口径一致）
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = (hm || "09:00").split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm).getTime();
}
function toWpsPayload(ev) {
  return {
    summary: ev.title,
    startTime: toMs(ev.date, ev.startTime),
    endTime: toMs(ev.date, ev.endTime || "18:00"),
    description: ev.note || "",
  };
}

/* ---------- 数据加载 ---------- */
async function load() {
  authorized = await wpsAuth.isAuthorized();
  localEvents = (await store.get("localEvents")) || [];
  if (authorized) {
    await syncFromWps();
  } else {
    wpsEvents = [];
  }
}

async function syncFromWps() {
  try {
    const start = new Date(viewYear, viewMonth, 1, 0, 0, 0).getTime();
    const end = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59).getTime();
    const list = await wpsApi.listEvents(start, end);
    wpsEvents = (list || []).map(normalizeWpsEvent);
    await store.set({ wpsEvents, wpsLastSync: Date.now() });
  } catch (e) {
    // 拉取失败：回退到缓存，保留上次数据
    const cached = (await store.get("wpsEvents")) || [];
    wpsEvents = cached;
    console.warn("WPS 日程拉取失败，使用缓存：", e);
  }
}

function activeEvents() {
  // 同步模式下：WPS 日程 + 本地上次同步失败降级保存的日程
  if (authorized) {
    return [...wpsEvents, ...localEvents.filter((e) => !e.wps)];
  }
  return localEvents;
}

async function saveLocal() {
  await store.set({ localEvents });
}

/* ---------- 增删改 ---------- */
function currentEventsOn(date) {
  return activeEvents().filter((e) => e.date === date);
}

function openForm(ev) {
  const f = document.getElementById("event-form");
  f.reset();
  f.dataset.editing = ev ? (ev.id || "") : "";
  f.dataset.isWps = ev && ev.wps ? "1" : "0";
  document.getElementById("ev-title").value = ev ? ev.title : "";
  document.getElementById("ev-date").value = ev ? ev.date : selectedDate;
  document.getElementById("ev-start").value = ev ? ev.startTime : "09:00";
  document.getElementById("ev-end").value = ev ? ev.endTime : "10:00";
  document.getElementById("ev-location").value = ev ? ev.location : "";
  document.getElementById("ev-note").value = ev ? ev.note : "";
  document.getElementById("event-modal").classList.add("open");
  document.getElementById("ev-title").focus();
}

async function submitForm() {
  const editing = document.getElementById("event-form").dataset.editing;
  const isWps = document.getElementById("event-form").dataset.isWps === "1";
  const title = document.getElementById("ev-title").value.trim();
  const date = document.getElementById("ev-date").value;
  const startTime = document.getElementById("ev-start").value;
  const endTime = document.getElementById("ev-end").value;
  if (!title || !date) return;

  const payload = { title, date, startTime, endTime, location: document.getElementById("ev-location").value.trim(), note: document.getElementById("ev-note").value.trim() };

  if (authorized) {
    try {
      if (isWps && editing) {
        await wpsApi.updateEvent(Number(editing), toWpsPayload(payload));
      } else {
        await wpsApi.createEvent(toWpsPayload(payload));
      }
      await syncFromWps();
    } catch (e) {
      alert("同步到 WPS 失败：" + e.message + "\n已改存本地。");
      await upsertLocal(payload);
      render();
    }
  } else {
    await upsertLocal(payload);
    render();
  }
  document.getElementById("event-modal").classList.remove("open");
}

async function upsertLocal(payload) {
  const editing = document.getElementById("event-form").dataset.editing;
  if (editing && !document.getElementById("event-form").dataset.isWps) {
    const it = localEvents.find((x) => x.id === editing);
    if (it) Object.assign(it, payload);
  } else {
    localEvents.push({ id: "ev" + Date.now(), ...payload, wps: false });
  }
  await saveLocal();
}

async function removeEvent(ev) {
  if (!confirm(`删除日程「${ev.title}」？`)) return;
  if (authorized && ev.wps) {
    try {
      await wpsApi.deleteEvent(ev.id);
      await syncFromWps();
      return;
    } catch (e) {
      alert("删除 WPS 日程失败：" + e.message);
      return;
    }
  }
  localEvents = localEvents.filter((x) => x.id !== ev.id);
  await saveLocal();
  render();
}

/* ---------- 渲染 ---------- */
function render() {
  renderStatus();
  renderCalendar();
  renderDayList();
}

function renderStatus() {
  const badge = document.getElementById("cal-status");
  const openBtn = document.getElementById("cal-open-wps");
  if (authorized) {
    badge.textContent = "已同步 WPS 日历";
    badge.className = "cal-badge synced";
    openBtn.textContent = "打开 WPS 日历";
  } else {
    badge.textContent = "本地模式 · 未登录";
    badge.className = "cal-badge local";
    openBtn.textContent = "登录 WPS 日历";
  }
}

function renderCalendar() {
  const grid = document.getElementById("cal-grid");
  const head = document.getElementById("cal-head");
  head.textContent = `${viewYear}年 ${viewMonth + 1}月`;
  grid.innerHTML = "";

  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
  for (const w of weekDays) {
    const cell = document.createElement("div");
    cell.className = "cal-weekday";
    cell.textContent = w;
    grid.appendChild(cell);
  }

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const eventsByDate = {};
  for (const e of activeEvents()) {
    (eventsByDate[e.date] = eventsByDate[e.date] || []).push(e);
  }

  const todayStr = today();
  for (let i = 0; i < firstDow; i++) {
    grid.appendChild(document.createElement("div"));
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(d)}`;
    const cell = document.createElement("div");
    cell.className = "cal-cell";
    if (dateStr === todayStr) cell.classList.add("today");
    if (dateStr === selectedDate) cell.classList.add("selected");
    if ((eventsByDate[dateStr] || []).length > 0) cell.classList.add("has-event");

    const num = document.createElement("span");
    num.className = "cal-day";
    num.textContent = d;
    cell.appendChild(num);
    if ((eventsByDate[dateStr] || []).length > 0) {
      const dot = document.createElement("span");
      dot.className = "cal-dot";
      cell.appendChild(dot);
    }
    cell.addEventListener("click", () => {
      selectedDate = dateStr;
      renderCalendar();
      renderDayList();
    });
    grid.appendChild(cell);
  }
}

function renderDayList() {
  const list = document.getElementById("day-list");
  const dateLabel = document.getElementById("day-label");
  dateLabel.textContent = selectedDate;
  list.innerHTML = "";
  const events = currentEventsOn(selectedDate).sort((a, b) =>
    (a.startTime || "").localeCompare(b.startTime || "")
  );

  if (!events.length) {
    const empty = document.createElement("div");
    empty.className = "day-empty";
    empty.textContent = "今日暂无日程";
    list.appendChild(empty);
  }

  for (const ev of events) {
    const row = document.createElement("div");
    row.className = "event-row";
    const time = document.createElement("span");
    time.className = "event-time";
    time.textContent = ev.startTime
      ? `${ev.startTime}${ev.endTime ? " - " + ev.endTime : ""}`
      : "全天";
    const info = document.createElement("span");
    info.className = "event-info";
    info.textContent = ev.title + (ev.location ? " · " + ev.location : "");
    const ops = document.createElement("span");
    ops.className = "event-ops";
    ops.innerHTML =
      '<button data-act="edit" title="编辑">✎</button>' +
      '<button data-act="del" title="删除">✕</button>';
    ops.querySelector('[data-act="edit"]').addEventListener("click", () => openForm(ev));
    ops.querySelector('[data-act="del"]').addEventListener("click", () => removeEvent(ev));
    row.append(time, info, ops);
    list.appendChild(row);
  }
}

/* ---------- 导航与操作绑定 ---------- */
function init() {
  const now = new Date();
  viewYear = now.getFullYear();
  viewMonth = now.getMonth();

  document.getElementById("cal-prev").addEventListener("click", () => {
    viewMonth--;
    if (viewMonth < 0) {
      viewMonth = 11;
      viewYear--;
    }
    syncThenRender();
  });
  document.getElementById("cal-next").addEventListener("click", () => {
    viewMonth++;
    if (viewMonth > 11) {
      viewMonth = 0;
      viewYear++;
    }
    syncThenRender();
  });
  document.getElementById("cal-today").addEventListener("click", () => {
    const n = new Date();
    viewYear = n.getFullYear();
    viewMonth = n.getMonth();
    selectedDate = today();
    syncThenRender();
  });

  document.getElementById("cal-add").addEventListener("click", () => openForm(null));
  document.getElementById("cal-open-wps").addEventListener("click", async () => {
    if (authorized) {
      chrome.tabs.create({ url: CONFIG.wps.webUrl });
    } else {
      const sid = await wpsAuth.login();
      if (sid) location.reload();
      else alert("未检测到登录会话，请在 WPS 日历页面完成登录后刷新。");
    }
  });

  document.getElementById("event-form").addEventListener("submit", (e) => {
    e.preventDefault();
    submitForm();
  });
}

async function syncThenRender() {
  if (authorized) await syncFromWps();
  render();
}

/* ---------- 迷你日历小组件（可挂载到任意容器）----------
 * 参照图设计：年月 header + 大日期 + 年内序/周 + 农历；点击展开完整日历。
 */
function weekOfYear(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

export function mountMiniCal(container) {
  container.classList.add("widget-minical");
  container.title = "点击展开 / 收起日历";
  container.innerHTML =
    '<div class="mini-cal-head">----年--月</div>' +
    '<div class="mini-cal-date">--</div>' +
    '<div class="mini-cal-seq"></div>' +
    '<div class="mini-cal-sub"></div>';

  const headEl = container.querySelector(".mini-cal-head");
  const dateEl = container.querySelector(".mini-cal-date");
  const seqEl = container.querySelector(".mini-cal-seq");
  const subEl = container.querySelector(".mini-cal-sub");

  function updateMini() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    if (headEl) headEl.textContent = y + "年" + m + "月";
    if (dateEl) dateEl.textContent = d;
    if (seqEl) seqEl.textContent = "第" + dayOfYear(y, m, d) + "天 第" + weekOfYear(now) + "周";
    if (subEl) {
      subEl.textContent =
        lunarDateString(y, m, d) + " " + "周" + ["日", "一", "二", "三", "四", "五", "六"][now.getDay()];
    }
  }
  updateMini();
  setInterval(updateMini, 60000); // 每分钟校准跨日

  container.addEventListener("click", () => {
    const panel = document.getElementById("calendar-panel");
    if (!panel) return;
    // 内联样式初始为空串（CSS display:none 不影响 style.display），统一用 "block" 判断
    const isOpen = panel.style.display === "block";
    if (isOpen) {
      panel.style.display = "none";
      return;
    }
    // 展开完整日历：回到今天并刷新，同时滚动到面板让用户立即看到
    panel.style.display = "block";
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
    selectedDate = today();
    render();
    if (!localEvents.length && !wpsEvents.length) {
      load().then(render);
    }
  });
}

export function initCalendar() {
  init();
  return load().then(render);
}
