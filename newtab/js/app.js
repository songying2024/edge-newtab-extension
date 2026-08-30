/**
 * app.js — 应用入口
 * 依次初始化：时钟 -> 小组件行 -> 搜索 -> 导航 -> 日历 -> 设置面板。
 */
import { store } from "./storage.js";
import { initClock } from "./clock.js";
import { initWidgets } from "./widgets.js";
import { initSearch } from "./search.js";
import { initNav } from "./nav.js";
import { initCalendar } from "./calendar.js";
import { applyTheme, initSettings } from "./settings.js";

async function boot() {
  const settings = await store.get("settings");
  await applyTheme(settings.theme);

  // 日历显示开关生效：关闭时隐藏日历小组件与完整日历
  if (!settings.showCalendar) {
    const panel = document.getElementById("calendar-panel");
    if (panel) panel.style.display = "none";
  }

  // 点击弹层背景关闭
  document.querySelectorAll(".modal").forEach((m) => {
    m.addEventListener("click", (e) => {
      if (e.target === m) m.classList.remove("open");
    });
  });

  initClock();
  await initWidgets();
  if (!settings.showCalendar) {
    document.querySelectorAll('#widgets-row [data-widget-type="minical"]').forEach((el) => {
      el.style.display = "none";
    });
  }
  initSearch();
  await initNav();
  await initCalendar();
  initSettings();
}

boot();
