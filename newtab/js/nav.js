/**
 * nav.js — 快速导航模块
 * 分组 Tab + 站点网格；支持增删改、拖拽排序、favicon（含首字母占位兜底）。
 */
import { CONFIG } from "./config.js";
import { store } from "./storage.js";

let groups = [];
let currentGroupId = null;

/** 站点 favicon：优先 chrome://favicon，失败回退首字母占位 */
function faviconFor(url, title) {
  const box = document.createElement("span");
  box.className = "item-icon";
  const img = new Image();
  img.className = "item-favicon";
  img.src = chrome.runtime.getURL(
    `_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`
  );
  img.onerror = () => {
    img.replaceWith(letterEl(title));
  };
  // 个别场景下返回占位图但无法显示，直接等加载完检查
  img.onload = () => {
    if (img.naturalWidth === 0) img.replaceWith(letterEl(title));
  };
  box.appendChild(img);
  return box;
}

function letterEl(title) {
  const el = document.createElement("span");
  el.className = "item-letter";
  el.textContent = (title || "?")[0].toUpperCase();
  return el;
}

function openUrl(url) {
  chrome.tabs.create({ url });
}

async function load() {
  let saved = await store.get("navGroups");
  if (!saved || !saved.length) {
    saved = JSON.parse(JSON.stringify(CONFIG.defaultGroups));
    await store.set({ navGroups: saved });
  }
  groups = saved;
  currentGroupId = groups[0]?.id || null;
}

async function persist() {
  await store.set({ navGroups: groups });
}

function currentGroup() {
  return groups.find((g) => g.id === currentGroupId) || groups[0];
}

/* ================= 渲染 ================= */

function render() {
  renderTabs();
  renderGrid();
}

function renderTabs() {
  const bar = document.getElementById("nav-tabs");
  bar.innerHTML = "";
  for (const g of groups) {
    const tab = document.createElement("button");
    tab.className = "nav-tab" + (g.id === currentGroupId ? " active" : "");
    tab.title = "切换到分组：" + g.name;
    tab.addEventListener("click", () => {
      currentGroupId = g.id;
      render();
    });
    const label = document.createElement("span");
    label.className = "nav-tab-label";
    label.textContent = g.name;
    tab.appendChild(label);
    const del = document.createElement("span");
    del.className = "nav-tab-del";
    del.textContent = "✕";
    del.title = "删除分组：" + g.name;
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteGroup(g.id);
    });
    tab.appendChild(del);
    bar.appendChild(tab);
  }

  // 管理分组按钮
  const mgr = document.createElement("button");
  mgr.className = "nav-tab nav-tab-action";
  mgr.textContent = "＋ 分组";
  mgr.title = "新增分组";
  mgr.addEventListener("click", () => addGroup());
  bar.appendChild(mgr);

  // 导出 / 导入导航配置
  const exp = document.createElement("button");
  exp.className = "nav-tab nav-tab-action";
  exp.textContent = "⤓";
  exp.title = "导出导航配置（JSON）";
  exp.addEventListener("click", () => exportNav());
  bar.appendChild(exp);

  const imp = document.createElement("button");
  imp.className = "nav-tab nav-tab-action";
  imp.textContent = "⤒";
  imp.title = "导入导航配置（JSON）";
  imp.addEventListener("click", () =>
    document.getElementById("nav-import-file").click()
  );
  bar.appendChild(imp);
}

function renderGrid() {
  const grid = document.getElementById("nav-grid");
  grid.innerHTML = "";
  const g = currentGroup();
  if (!g) return;

  for (const item of g.items) {
    const card = document.createElement("div");
    card.className = "nav-item";
    card.draggable = true;
    card.dataset.itemId = item.id;

    const link = document.createElement("a");
    link.href = "#";
    link.className = "nav-item-main";
    link.addEventListener("click", (e) => {
      e.preventDefault();
      openUrl(item.url);
    });
    link.appendChild(faviconFor(item.url, item.title));
    const label = document.createElement("span");
    label.className = "item-title";
    label.textContent = item.title;
    link.appendChild(label);
    card.appendChild(link);

    // 悬停操作
    const ops = document.createElement("div");
    ops.className = "item-ops";
    ops.innerHTML =
      '<button data-act="edit" title="编辑">✎</button>' +
      '<button data-act="del" title="删除">✕</button>';
    ops.querySelector('[data-act="edit"]').addEventListener("click", (e) => {
      e.stopPropagation();
      editItem(item);
    });
    ops.querySelector('[data-act="del"]').addEventListener("click", (e) => {
      e.stopPropagation();
      removeItem(item.id);
    });
    card.appendChild(ops);

    // 拖拽
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", item.id);
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
    card.addEventListener("dragover", (e) => e.preventDefault());
    card.addEventListener("drop", (e) => {
      e.preventDefault();
      const fromId = e.dataTransfer.getData("text/plain");
      reorder(fromId, item.id);
    });

    grid.appendChild(card);
  }

  // 添加站点按钮（iOS 圆角方块样式）
  const add = document.createElement("div");
  add.className = "nav-item nav-item-add";
  add.title = "添加站点";
  const addIcon = document.createElement("div");
  addIcon.className = "item-icon add-icon";
  addIcon.textContent = "＋";
  add.appendChild(addIcon);
  add.addEventListener("click", () => addItem());
  grid.appendChild(add);
}

/* ================= 增删改 ================= */

function showModal(modalId) {
  const m = document.getElementById(modalId);
  m.classList.add("open");
}

function hideModal(modalId) {
  document.getElementById(modalId).classList.remove("open");
}

function addItem() {
  const g = currentGroup();
  const f = document.getElementById("nav-form");
  f.reset();
  document.getElementById("nav-title").value = "";
  document.getElementById("nav-url").value = "";
  document.getElementById("nav-form").dataset.editing = "";
  showModal("nav-modal");
  document.getElementById("nav-title").focus();
}

function editItem(item) {
  document.getElementById("nav-title").value = item.title;
  document.getElementById("nav-url").value = item.url;
  document.getElementById("nav-form").dataset.editing = item.id;
  showModal("nav-modal");
  document.getElementById("nav-title").focus();
}

async function saveItem() {
  const g = currentGroup();
  const title = document.getElementById("nav-title").value.trim();
  const url = document.getElementById("nav-url").value.trim();
  if (!title || !url) return;
  const norm = /^https?:\/\//i.test(url) ? url : "https://" + url;
  const editing = document.getElementById("nav-form").dataset.editing;
  if (editing) {
    const it = g.items.find((x) => x.id === editing);
    if (it) {
      it.title = title;
      it.url = norm;
    }
  } else {
    g.items.push({ id: "i" + Date.now(), title, url: norm });
  }
  await persist();
  hideModal("nav-modal");
  render();
}

function removeItem(id) {
  const g = currentGroup();
  g.items = g.items.filter((x) => x.id !== id);
  persist().then(render);
}

function reorder(fromId, toId) {
  const g = currentGroup();
  const from = g.items.findIndex((x) => x.id === fromId);
  const to = g.items.findIndex((x) => x.id === toId);
  if (from < 0 || to < 0) return;
  const [moved] = g.items.splice(from, 1);
  g.items.splice(to, 0, moved);
  persist().then(render);
}

/* ================= 导入导出 ================= */

/** 导出当前导航分组为 JSON 文件下载 */
function exportNav() {
  try {
    const blob = new Blob([JSON.stringify(groups, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "标签开视页-导航配置.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert("导出失败：" + e.message);
  }
}

/** 从 JSON 文件导入导航分组（替换当前配置） */
function importNav(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data) || !data.length) {
        throw new Error("文件不是有效的导航配置（缺少分组）");
      }
      const stamp = Date.now();
      groups = data.map((g, i) => {
        const name = (g && g.name && String(g.name).trim()) || "分组" + (i + 1);
        const items = Array.isArray(g && g.items)
          ? g.items.map((it, j) => {
              const raw = it && it.url ? String(it.url).trim() : "";
              return {
                id: (it && it.id) || "i" + stamp + j,
                title: (it && (it.title || it.name)) || "未命名",
                url: /^https?:\/\//i.test(raw) ? raw : "https://" + raw,
              };
            })
          : [];
        return {
          id: (g && g.id) || "g" + stamp + i,
          name,
          items,
        };
      });
      currentGroupId = groups[0].id;
      persist().then(render);
      alert("导入成功：" + groups.length + " 个分组。");
    } catch (e) {
      alert("导入失败：" + e.message);
    }
  };
  reader.readAsText(file);
}

/* ================= 分组管理 ================= */

async function addGroup() {
  const name = prompt("请输入新分组名称：");
  if (!name || !name.trim()) return;
  groups.push({ id: "g" + Date.now(), name: name.trim(), items: [] });
  currentGroupId = groups[groups.length - 1].id;
  await persist();
  render();
}

async function deleteGroup(id) {
  const g = groups.find((x) => x.id === id);
  if (!g) return;
  if (groups.length <= 1) {
    alert("至少需要保留一个分组");
    return;
  }
  if (!confirm(`确定删除分组「${g.name}」？组内站点将一并删除。`)) return;
  groups = groups.filter((x) => x.id !== id);
  if (currentGroupId === id) currentGroupId = groups[0].id;
  await persist();
  render();
}

export function initNav() {
  document.getElementById("nav-form").addEventListener("submit", (e) => {
    e.preventDefault();
    saveItem();
  });
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      hideModal(btn.dataset.close);
    });
  });
  const fileInput = document.getElementById("nav-import-file");
  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) importNav(f);
      fileInput.value = ""; // 允许重复选择同一文件
    });
  }
  return load().then(render);
}
