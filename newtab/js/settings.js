/**
 * settings.js — 设置面板
 * 主题（浅/深/跟随系统）、日历显示开关、WPS 登录状态与登出。
 */
import { CONFIG, buildEngines } from "./config.js";
import { store } from "./storage.js";
import { wpsAuth } from "./wps-auth.js";
import { reloadWeather } from "./weather.js";

const THEMES = ["auto", "light", "dark"];

export async function applyTheme(theme) {
  const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "auto" && sysDark);
  document.documentElement.classList.toggle("dark", dark);
}

export function initSettings() {
  const panel = document.getElementById("settings-panel");
  const openBtn = document.getElementById("open-settings");
  const closeBtn = document.getElementById("close-settings");

  openBtn.addEventListener("click", async () => {
    await refreshAuthStatus();
    refreshWidgetState();
    panel.classList.add("open");
  });
  closeBtn.addEventListener("click", () => panel.classList.remove("open"));

  // 主题
  const themeSel = document.getElementById("theme-select");
  store.get("settings").then((s) => {
    themeSel.value = THEMES.includes(s.theme) ? s.theme : "auto";
  });
  themeSel.addEventListener("change", async (e) => {
    await store.patch("settings", { theme: e.target.value });
    applyTheme(e.target.value);
  });

  // 系统主题变化自动响应（auto 模式）
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    store.get("settings").then((s) => applyTheme(s.theme));
  });

  // 搜索引擎：统一管理（勾选设默认 + 添加 / 删除）
  const engineListEl = document.getElementById("engine-manage-list");
  let customEngines = [];
  let currentEngine = CONFIG.defaultEngine;

  function renderEngineList() {
    const engines = buildEngines(customEngines);
    engineListEl.innerHTML = "";
    for (const [key, e] of Object.entries(engines)) {
      const row = document.createElement("label");
      row.className = "engine-row";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "engine-default";
      radio.value = key;
      radio.checked = key === currentEngine;
      radio.addEventListener("change", () => selectEngine(key));
      const name = document.createElement("span");
      name.className = "engine-row-name";
      name.textContent = e.name;
      name.title = e.url;
      row.append(radio, name);
      if (key.startsWith("custom-")) {
        const del = document.createElement("button");
        del.className = "ce-del";
        del.textContent = "✕";
        del.title = "删除 " + e.name;
        del.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          removeCustomEngine(key);
        });
        row.appendChild(del);
      }
      engineListEl.appendChild(row);
    }
  }

  async function selectEngine(key) {
    currentEngine = key;
    await store.patch("settings", { engine: key });
    // 同步顶部搜索栏下拉，保持一致
    const searchSelect = document.getElementById("engine-select");
    if (searchSelect) searchSelect.value = key;
  }

  async function removeCustomEngine(key) {
    const id = key.replace("custom-", "");
    customEngines = customEngines.filter((c) => c.id !== id);
    await store.patch("settings", { customEngines });
    // 若删除的是当前默认引擎，回退到内置默认
    if (currentEngine === key) {
      currentEngine = CONFIG.defaultEngine;
      await store.patch("settings", { engine: CONFIG.defaultEngine });
    }
    refreshEngineState();
  }

  function syncSearchSelect() {
    const searchSelect = document.getElementById("engine-select");
    if (!searchSelect) return;
    const engines = buildEngines(customEngines);
    searchSelect.innerHTML = "";
    for (const [key, e] of Object.entries(engines)) {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = e.name;
      searchSelect.appendChild(opt);
    }
    if (engines[currentEngine]) searchSelect.value = currentEngine;
  }

  async function refreshEngineState() {
    const s = await store.get("settings");
    customEngines = s.customEngines || [];
    currentEngine = s.engine || CONFIG.defaultEngine;
    const engines = buildEngines(customEngines);
    if (!engines[currentEngine]) currentEngine = CONFIG.defaultEngine;
    renderEngineList();
    syncSearchSelect();
  }

  // 添加自定义搜索引擎
  document.getElementById("ce-add").addEventListener("click", async () => {
    let name = document.getElementById("ce-name").value.trim();
    let url = document.getElementById("ce-url").value.trim();
    if (!name || !url) {
      alert("请填写引擎名称和搜索地址");
      return;
    }
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    if (buildEngines(customEngines)["custom-" + name]) {
      alert("该引擎名称已存在，请更换");
      return;
    }
    customEngines.push({ id: "e" + Date.now(), name, url });
    await store.patch("settings", { customEngines });
    document.getElementById("ce-name").value = "";
    document.getElementById("ce-url").value = "";
    refreshEngineState();
  });

  refreshEngineState();

  // 小组件：查看 / 添加 / 移除（动态 import 避免模块循环依赖）
  async function refreshWidgetState() {
    const mod = await import("./widgets.js");
    const list = await mod.getWidgets();
    const listEl = document.getElementById("widget-manage-list");
    const sel = document.getElementById("widget-add-select");
    if (!listEl || !sel) return;
    const used = new Set(list.map((w) => w.type));
    // 已添加的组件列表（可删除）
    listEl.innerHTML = "";
    for (const w of list) {
      const t = mod.WIDGET_TYPES[w.type];
      if (!t) continue;
      const row = document.createElement("div");
      row.className = "widget-manage-row";
      const icon = document.createElement("span");
      icon.className = "wm-icon";
      icon.textContent = t.icon;
      const name = document.createElement("span");
      name.className = "wm-name";
      name.textContent = t.name;
      const del = document.createElement("button");
      del.className = "wm-del";
      del.textContent = "✕";
      del.title = "移除 " + t.name;
      del.addEventListener("click", async () => {
        await mod.removeWidget(w.id);
        refreshWidgetState();
      });
      row.append(icon, name, del);
      listEl.appendChild(row);
    }
    // 可选类型下拉（仅未添加的类型）
    sel.innerHTML = "";
    let added = false;
    for (const [type, t] of Object.entries(mod.WIDGET_TYPES)) {
      if (used.has(type)) continue;
      const opt = document.createElement("option");
      opt.value = type;
      opt.textContent = t.name;
      sel.appendChild(opt);
      added = true;
    }
    if (!added) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "已添加全部组件";
      sel.appendChild(opt);
      sel.disabled = true;
    } else {
      sel.disabled = false;
    }
  }

  const widgetAddBtn = document.getElementById("widget-add-btn");
  if (widgetAddBtn) {
    widgetAddBtn.addEventListener("click", async () => {
      const sel = document.getElementById("widget-add-select");
      const type = sel && sel.value;
      if (!type) return;
      const mod = await import("./widgets.js");
      await mod.addWidget(type);
      refreshWidgetState();
    });
  }

  // 天气城市：设置后按城市定位，留空走 IP 定位
  const cityInput = document.getElementById("weather-city-input");
  const cityApply = document.getElementById("city-apply");
  const cityTip = document.getElementById("city-tip");

  async function applyCity() {
    if (!cityInput) return;
    const v = cityInput.value.trim();
    await store.patch("settings", { city: v });
    reloadWeather();
    if (cityTip) {
      cityTip.textContent = v
        ? "已应用：按「" + v + "」显示天气"
        : "已应用：按网络 IP 自动定位";
      cityTip.style.color = "var(--accent)";
      setTimeout(() => {
        cityTip.textContent = "填写后按该城市显示天气，留空则按网络 IP 自动定位。";
        cityTip.style.color = "";
      }, 3000);
    }
  }

  if (cityInput) {
    store.get("settings").then((s) => {
      cityInput.value = (s.city || "").trim();
    });
    cityInput.addEventListener("change", applyCity);
    cityInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applyCity();
      }
    });
    if (cityApply) cityApply.addEventListener("click", applyCity);
  }

  // 日历显示开关（默认收起完整日历；关闭时隐藏迷你日历与完整日历）
  const calToggle = document.getElementById("show-calendar");
  store.get("settings").then((s) => (calToggle.checked = s.showCalendar));
  calToggle.addEventListener("change", async (e) => {
    await store.patch("settings", { showCalendar: e.target.checked });
    const mini = document.getElementById("mini-cal");
    const panel = document.getElementById("calendar-panel");
    if (mini) mini.style.display = e.target.checked ? "" : "none";
    if (!e.target.checked && panel) panel.style.display = "none";
  });

  // WPS 登录 / 登出
  const loginBtn = document.getElementById("wps-login");
  const logoutBtn = document.getElementById("wps-logout");
  loginBtn.addEventListener("click", async () => {
    const sid = await wpsAuth.login();
    if (sid) {
      // 登录成功：刷新页面让日历进入 WPS 同步模式
      location.reload();
    } else {
      alert("未检测到登录会话。\n\n请在刚才弹出的 WPS 日历页面中用 WPS 账号完成登录，登录成功后刷新本页即可同步。");
    }
  });
  logoutBtn.addEventListener("click", async () => {
    await wpsAuth.logout();
    await refreshAuthStatus();
    location.reload();
  });
}

async function refreshAuthStatus() {
  const ok = await wpsAuth.isAuthorized();
  const state = document.getElementById("wps-auth-state");
  const loginBtn = document.getElementById("wps-login");
  const logoutBtn = document.getElementById("wps-logout");
  state.textContent = ok ? "已登录 · 同步 WPS 日历" : "未登录 · 本地模式";
  loginBtn.style.display = ok ? "none" : "";
  logoutBtn.style.display = ok ? "" : "none";
}

export { CONFIG };
