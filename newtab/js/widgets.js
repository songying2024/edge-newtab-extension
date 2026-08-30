/**
 * widgets.js — 小组件系统（参照 WeTab 新标签页技术方案）
 * 通过注册表管理可用小组件类型，按用户在设置中配置的 widgets 列表动态渲染到小组件行。
 * 支持自由添加 / 删除；数据保存在 settings.widgets（[{ id, type }]）。
 */
import { store } from "./storage.js";
import { mountWeather } from "./weather.js";
import { mountMiniCal } from "./calendar.js";
import { mountTodo } from "./widget-todo.js";
import { mountNote } from "./widget-note.js";

/** 小组件注册表：type -> 元信息与挂载函数 */
export const WIDGET_TYPES = {
  weather: { name: "天气", icon: "🌤️", mount: mountWeather },
  minical: { name: "日历", icon: "📅", mount: mountMiniCal },
  todo: { name: "待办清单", icon: "✅", mount: mountTodo },
  note: { name: "便签", icon: "📝", mount: mountNote },
};

/** 默认小组件（首次使用） */
const DEFAULT_WIDGETS = [
  { id: "w-weather", type: "weather" },
  { id: "w-minical", type: "minical" },
];

let widgets = null; // 当前小组件列表缓存

async function loadConfig() {
  if (widgets) return widgets;
  const s = await store.get("settings");
  if (Array.isArray(s.widgets) && s.widgets.length) {
    widgets = s.widgets.slice();
  } else {
    widgets = DEFAULT_WIDGETS.slice();
  }
  return widgets;
}

/** 初始化：渲染小组件行 */
export async function initWidgets() {
  const row = document.getElementById("widgets-row");
  if (!row) return;
  const list = await loadConfig();
  row.innerHTML = "";
  for (const w of list) {
    const t = WIDGET_TYPES[w.type];
    if (!t) continue;
    const box = document.createElement("div");
    box.className = "widget";
    box.dataset.widgetType = w.type;
    row.appendChild(box);
    try {
      t.mount(box);
    } catch (e) {
      box.innerHTML = '<div class="widget-empty">组件加载失败</div>';
    }
  }
}

/** 新增小组件（按类型） */
export async function addWidget(type) {
  if (!WIDGET_TYPES[type]) return;
  const list = await loadConfig();
  list.push({ id: "w" + Date.now(), type });
  widgets = list;
  await store.patch("settings", { widgets: list });
  await initWidgets();
}

/** 删除小组件（按 id） */
export async function removeWidget(id) {
  const list = await loadConfig();
  widgets = list.filter((w) => w.id !== id);
  await store.patch("settings", { widgets });
  await initWidgets();
}

/** 供设置面板读取当前小组件 */
export async function getWidgets() {
  return loadConfig();
}
