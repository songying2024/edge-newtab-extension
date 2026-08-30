/**
 * clock.js — 顶部黑体数字时钟（时:分 + 日期星期）
 */
const WEEK = ["日", "一", "二", "三", "四", "五", "六"];

function pad(n) {
  return String(n).padStart(2, "0");
}

function tick() {
  const now = new Date();
  const timeEl = document.getElementById("clock-time");
  const dateEl = document.getElementById("clock-date");
  if (timeEl) timeEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  if (dateEl) {
    dateEl.textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${WEEK[now.getDay()]}`;
  }
}

export function initClock() {
  tick();
  // 每秒刷新，分钟变化即更新
  setInterval(tick, 1000);
}
