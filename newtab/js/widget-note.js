/**
 * widget-note.js — 便签小组件
 * 轻量文本便签，自动保存到 noteText。
 */
import { store } from "./storage.js";

export async function mountNote(container) {
  container.classList.add("widget-note");
  container.innerHTML =
    '<div class="widget-head">便签</div>' +
    '<textarea class="note-area" placeholder="随手记点什么…" spellcheck="false"></textarea>';

  const ta = container.querySelector(".note-area");
  const saved = (await store.get("noteText")) || "";
  ta.value = saved;

  let timer = null;
  ta.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      store.set({ noteText: ta.value });
    }, 400);
  });
}
