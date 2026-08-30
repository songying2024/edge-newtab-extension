/**
 * widget-todo.js — 待办清单小组件
 * 支持添加、勾选完成、删除；数据保存在 todoItems。
 */
import { store } from "./storage.js";

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

export async function mountTodo(container) {
  container.classList.add("widget-todo");
  container.innerHTML =
    '<div class="widget-head">待办清单</div>' +
    '<div class="todo-list"></div>' +
    '<div class="todo-add">' +
    '<input class="todo-input" type="text" placeholder="添加待办…" />' +
    '<button class="todo-add-btn" title="添加">＋</button>' +
    "</div>";

  const listEl = container.querySelector(".todo-list");
  const input = container.querySelector(".todo-input");
  const addBtn = container.querySelector(".todo-add-btn");

  let items = (await store.get("todoItems")) || [];

  function render() {
    listEl.innerHTML = "";
    if (!items.length) {
      listEl.innerHTML = '<div class="widget-empty">暂无待办</div>';
      return;
    }
    items.forEach((it, i) => {
      const row = document.createElement("div");
      row.className = "todo-row" + (it.done ? " done" : "");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!it.done;
      cb.addEventListener("change", async () => {
        items[i].done = cb.checked;
        await store.set({ todoItems: items });
        render();
      });
      const span = document.createElement("span");
      span.className = "todo-text";
      span.textContent = it.text;
      const del = document.createElement("button");
      del.className = "todo-del";
      del.textContent = "✕";
      del.title = "删除";
      del.addEventListener("click", async () => {
        items.splice(i, 1);
        await store.set({ todoItems: items });
        render();
      });
      row.append(cb, span, del);
      listEl.appendChild(row);
    });
  }

  async function add() {
    const v = input.value.trim();
    if (!v) return;
    items.push({ text: v, done: false });
    input.value = "";
    await store.set({ todoItems: items });
    render();
  }

  addBtn.addEventListener("click", add);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") add();
  });

  render();
}
