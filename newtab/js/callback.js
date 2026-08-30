/**
 * callback.js — WPS OAuth 授权回调页逻辑
 * WPS 授权完成后重定向回本页（redirectUri），携带 code/state，
 * 在此完成令牌交换，并提示用户返回新标签页。
 */
import { wpsAuth } from "./wps-auth.js";

const params = new URLSearchParams(location.search);
const result = document.getElementById("result");
const detail = document.getElementById("detail");

function fail(msg) {
  result.textContent = "授权失败";
  result.className = "err";
  detail.textContent = msg;
}

const error = params.get("error");
if (error) {
  fail(params.get("error_description") || error);
} else {
  const code = params.get("code");
  const state = params.get("state");
  if (code) {
    try {
      await wpsAuth.complete(code, state);
      result.textContent = "✓ 授权成功";
      result.className = "ok";
      detail.textContent = "WPS 日历已连接，正在回到新标签页…";
      setTimeout(() => {
        chrome.tabs.create({ url: "chrome://newtab/" });
        window.close();
      }, 1200);
    } catch (e) {
      fail(e.message || "令牌交换失败，请检查 config.js 配置");
    }
  } else {
    fail("未收到授权码，请重新登录授权。");
  }
}
