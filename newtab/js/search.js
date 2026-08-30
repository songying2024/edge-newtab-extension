/**
 * search.js — 多引擎搜索模块
 * 顶部搜索框：回车后按当前选中引擎打开搜索结果（新标签页）。
 */
import { CONFIG, buildEngines, engineByKey } from "./config.js";
import { store } from "./storage.js";

export function initSearch() {
  const form = document.getElementById("search-form");
  const input = document.getElementById("search-input");
  const select = document.getElementById("engine-select");

  if (!form || !input) return;

  let customEngines = [];

  // 填充引擎下拉（内置 + 自定义）并恢复上次选择
  store.get("settings").then((s) => {
    customEngines = s.customEngines || [];
    const engines = buildEngines(customEngines);
    select.innerHTML = "";
    for (const [key, engine] of Object.entries(engines)) {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = engine.name;
      select.appendChild(opt);
    }
    const saved = s.engine || CONFIG.defaultEngine;
    select.value = engines[saved] ? saved : CONFIG.defaultEngine;
  });

  // 切换引擎时记住偏好
  select.addEventListener("change", async () => {
    await store.patch("settings", { engine: select.value });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    const engine =
      engineByKey(select.value, customEngines) ||
      CONFIG.engines[CONFIG.defaultEngine];
    chrome.tabs.create({ url: engine.url + encodeURIComponent(q) });
    input.value = "";
  });

  // 快捷键：/ 或 ctrl+k 聚焦搜索框
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (e.key === "/" || (e.ctrlKey && e.key.toLowerCase() === "k")) {
      e.preventDefault();
      input.focus();
    }
  });
}
