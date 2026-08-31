/**
 * widget-note.js — 便签小组件（WPS 笔记同步版）
 *
 * 已登录 WPS：每条便签 = 云盘「笔记」文件夹下的一个 .ainote 文件，
 *   编写 / 删除即时同步 WPS 笔记（wps-note-api.js）。
 * 未登录：降级本地模式，存 storage.noteItems。
 */
import { store } from "./storage.js";
import { wpsAuth } from "./wps-auth.js";
import { listNotes, readNote, saveNote, deleteNote } from "./wps-note-api.js";

const WPS_NOTE_URL = "https://365.kdocs.cn/l/cb1P29vgeHux?page=home";

const LOCAL_KEY = "noteItems"; // 本地模式：[{ id, text, mtime }]

export async function mountNote(container) {
  container.classList.add("widget-note");
  container.innerHTML =
    '<div class="widget-head"><span>便签</span><span class="note-head-right">' +
    '<span class="note-status"></span>' +
    '<button class="note-open-btn" type="button" title="打开 WPS 笔记">WPS笔记 ↗</button>' +
    '</span></div>' +
    '<div class="note-list"></div>' +
    '<div class="note-add">' +
    '  <input class="note-input" type="text" placeholder="记一条便签…" />' +
    '  <button class="note-add-btn" type="button" title="添加便签">＋</button>' +
    "</div>";

  const listEl = container.querySelector(".note-list");
  const statusEl = container.querySelector(".note-status");
  container.querySelector(".note-open-btn").addEventListener("click", () => {
    chrome.tabs.create({ url: WPS_NOTE_URL });
  });
  const input = container.querySelector(".note-input");
  const addBtn = container.querySelector(".note-add-btn");

  const authorized = await wpsAuth.isAuthorized();
  statusEl.textContent = authorized ? "已同步 WPS 笔记" : "本地模式";
  container.classList.toggle("note-cloud", authorized);

  let notes = []; // [{ id, title, text }]

  function titleOf(text) {
    const first = (text || "").split("\n").find((l) => l.trim()) || "";
    return first.trim().slice(0, 30) || "便签";
  }

  function render() {
    listEl.innerHTML = "";
    if (!notes.length) {
      const empty = document.createElement("div");
      empty.className = "note-empty";
      empty.textContent = authorized ? "暂无便签，记一条吧" : "暂无便签，记一条吧";
      listEl.appendChild(empty);
      return;
    }
    for (const n of notes) {
      const row = document.createElement("div");
      row.className = "note-item";
      row.dataset.id = n.id;

      const ta = document.createElement("textarea");
      ta.className = "note-text";
      ta.value = n.text;
      ta.rows = 1;
      ta.spellcheck = false;
      ta.placeholder = "便签内容…";
      const fit = () => {
        ta.style.height = "auto";
        ta.style.height = Math.min(ta.scrollHeight, 96) + "px";
      };
      requestAnimationFrame(fit);

      let timer = null;
      ta.addEventListener("input", () => {
        fit();
        n.text = ta.value;
        n.title = titleOf(n.text);
        clearTimeout(timer);
        timer = setTimeout(async () => {
          if (!authorized) {
            await saveLocal();
            return;
          }
          try {
            await saveNote(n.id, n.title, n.text);
          } catch (e) {
            statusEl.textContent = "同步失败：点击重试";
          }
        }, 900);
      });
      ta.addEventListener("blur", fit);

      const del = document.createElement("button");
      del.className = "note-del";
      del.textContent = "✕";
      del.title = "删除便签";
      del.addEventListener("click", async () => {
        notes = notes.filter((x) => x.id !== n.id);
        render();
        if (authorized) {
          try {
            await deleteNote(n.id);
          } catch (e) {
            statusEl.textContent = "删除失败：请重试";
          }
        } else {
          await saveLocal();
        }
      });

      row.append(ta, del);
      listEl.appendChild(row);
    }
  }

  async function saveLocal() {
    await store.set({
      [LOCAL_KEY]: notes.map((n) => ({ id: n.id, text: n.text, mtime: n.mtime || 0 })),
    });
  }

  async function addNote() {
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    const item = { id: null, title: titleOf(text), text, mtime: Date.now() };
    notes.unshift(item);
    render();
    if (authorized) {
      try {
        item.id = await saveNote(null, item.title, item.text);
      } catch (e) {
        statusEl.textContent = "添加失败：内容保留在本地";
        await saveLocal();
        return;
      }
    } else {
      item.id = "local-" + Date.now();
      await saveLocal();
    }
    render();
  }

  addBtn.addEventListener("click", addNote);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addNote();
  });

  /* 初始加载 */
  if (authorized) {
    try {
      const items = await listNotes();
      notes = [];
      for (const it of items.slice(0, 20)) {
        let text = "";
        try {
          text = await readNote(it.id);
        } catch (e) {
          text = "（读取失败）";
        }
        notes.push({ id: it.id, title: it.name, text, mtime: it.mtime });
      }
      render();
    } catch (e) {
      // 云端失败降级本地
      statusEl.textContent = "同步不可用 · 本地模式";
      container.classList.remove("note-cloud");
      notes = (await store.get(LOCAL_KEY)) || [];
      render();
    }
  } else {
    notes = (await store.get(LOCAL_KEY)) || [];
    render();
  }
}
