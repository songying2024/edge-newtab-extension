/**
 * weather.js — 天气小组件（蓝色卡片风格）
 * 定位优先级：设置中手动指定的"天气城市" > IP 定位 > 回退北京。
 * 数据源：Open-Meteo（当前温度 + 未来6天）+ geocoding 地理编码（无需 key）。
 */
import { store } from "./storage.js";

const WEEK = ["日", "一", "二", "三", "四", "五", "六"];

// WMO 天气代码 -> 图标 / 文案
const WMO = {
  0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
  45: "🌫️", 48: "🌫️",
  51: "🌦️", 53: "🌦️", 55: "🌦️", 56: "🌧️", 57: "🌧️",
  61: "🌧️", 63: "🌧️", 65: "🌧️", 66: "🌧️", 67: "🌧️",
  71: "🌨️", 73: "🌨️", 75: "🌨️", 77: "🌨️",
  80: "🌦️", 81: "🌦️", 82: "🌦️", 85: "🌨️", 86: "🌨️",
  95: "⛈️", 96: "⛈️", 99: "⛈️",
};
const WMO_TEXT = {
  0: "晴", 1: "少云", 2: "多云", 3: "阴",
  45: "雾", 48: "雾",
  51: "毛毛雨", 53: "毛毛雨", 55: "毛毛雨", 56: "冻雨", 57: "冻雨",
  61: "小雨", 63: "中雨", 65: "大雨", 66: "冻雨", 67: "冻雨",
  71: "小雪", 73: "中雪", 75: "大雪", 77: "雪粒",
  80: "阵雨", 81: "阵雨", 82: "强阵雨", 85: "阵雪", 86: "阵雪",
  95: "雷阵雨", 96: "雷阵雨", 99: "雷阵雨",
};
function wmoIcon(code) {
  return WMO[code] || "🌡️";
}
function wmoText(code) {
  return WMO_TEXT[code] || "";
}

/* 城市名候选：如“衡水”会尝试 衡水 / 衡水市 / 衡水县…，提高中文地名命中率 */
const CITY_SUFFIXES = ["", "市", "县", "区", "自治州"];

async function geoCode(city) {
  const trimmed = city.replace(/[市县区]$/, "");
  const candidates = [city];
  if (trimmed !== city) candidates.push(trimmed);
  for (const s of CITY_SUFFIXES) {
    const c = trimmed + s;
    if (!candidates.includes(c)) candidates.push(c);
  }
  for (const name of candidates) {
    try {
      const res = await fetch(
        "https://geocoding-api.open-meteo.com/v1/search?name=" +
          encodeURIComponent(name) +
          "&count=3&language=zh&format=json"
      );
      const d = await res.json();
      const results = d.results || [];
      const r = results.find((x) => x.country_code === "CN") || results[0];
      if (r && typeof r.latitude === "number") {
        const region = r.admin1 ? "·" + r.admin1 : "";
        return { lat: r.latitude, lon: r.longitude, city: r.name + region };
      }
    } catch (e) {
      /* 尝试下一候选 */
    }
  }
  return null;
}

async function ipLocate() {
  try {
    const res = await fetch("https://ipapi.co/json/", { cache: "no-store" });
    const d = await res.json();
    if (d && typeof d.latitude === "number") {
      const region = d.region ? "·" + d.region : "";
      return { lat: d.latitude, lon: d.longitude, city: (d.city || "") + region };
    }
  } catch (e) {
    /* 尝试备用源 */
  }
  try {
    const res = await fetch("https://ipwho.is/");
    const d = await res.json();
    if (d && d.success && typeof d.latitude === "number") {
      const region = d.region ? "·" + d.region : "";
      return { lat: d.latitude, lon: d.longitude, city: (d.city || "") + region };
    }
  } catch (e) {
    /* 回退 */
  }
  return null;
}

/** 解析定位：优先设置中的城市（城市名变体重试），否则 IP 定位（双源） */
async function resolveLocation(settings) {
  const city = settings && settings.city ? String(settings.city).trim() : "";
  if (city) {
    const g = await geoCode(city);
    if (g) return g;
  }
  const ip = await ipLocate();
  if (ip) return ip;
  return { lat: null, lon: null, city: "定位失败" };
}

// 记录已挂载的天气组件容器，供 reloadWeather 刷新
const mounted = [];

/** 挂载天气小组件到指定容器 */
export function mountWeather(container) {
  container.classList.add("widget-weather");
  container.innerHTML =
    '<div class="weather-top">' +
    '<div class="weather-loc"><span class="weather-loc-ico">📍</span><span class="weather-city">定位中…</span></div>' +
    '<div class="weather-now">' +
    '<div class="weather-cond"><span class="weather-cond-text">--</span><span class="weather-cond-ico">🌡️</span></div>' +
    '<div class="weather-range">最高--°~最低--°</div>' +
    "</div></div>" +
    '<div class="weather-main"><div class="weather-temp">--°</div></div>' +
    '<div class="weather-forecast"></div>';
  mounted.push(container);
  loadWeather(container);
}

async function loadWeather(container) {
  const settings = await store.get("settings");
  const loc = await resolveLocation(settings);

  const cityEl = container.querySelector(".weather-city");
  if (cityEl) cityEl.textContent = loc.city || "--";

  // 定位失败（城市编码 + IP 均不可用）：给出提示，不再请求天气
  if (loc.lat === null || loc.lon === null) {
    const box = container.querySelector(".weather-forecast");
    if (box) box.innerHTML = '<div class="widget-empty">定位失败，请检查城市名称或网络</div>';
    return;
  }

  try {
    const q = new URLSearchParams({
      latitude: String(loc.lat),
      longitude: String(loc.lon),
      current: "temperature_2m,weather_code",
      daily: "weather_code,temperature_2m_max,temperature_2m_min",
      timezone: "auto",
      forecast_days: "6",
    });
    const res = await fetch("https://api.open-meteo.com/v1/forecast?" + q);
    const d = await res.json();

    // 当前温度 + 天气状况
    const cur = d.current;
    if (cur) {
      const tempEl = container.querySelector(".weather-temp");
      if (tempEl) tempEl.textContent = Math.round(cur.temperature_2m) + "°";
      const condEl = container.querySelector(".weather-cond-text");
      if (condEl) condEl.textContent = wmoText(cur.weather_code) || "";
      const icoEl = container.querySelector(".weather-cond-ico");
      if (icoEl) icoEl.textContent = wmoIcon(cur.weather_code);
    }

    const days = d.daily;
    if (days && days.time && days.time.length) {
      // 今日温度区间
      const hi = Math.round(days.temperature_2m_max[0]);
      const lo = Math.round(days.temperature_2m_min[0]);
      const rangeEl = container.querySelector(".weather-range");
      if (rangeEl) rangeEl.textContent = "最高" + hi + "°~最低" + lo + "°";

      // 底部未来 5 天（明天起）
      const box = container.querySelector(".weather-forecast");
      if (box) {
        box.innerHTML = "";
        for (let i = 1; i <= 5; i++) {
          if (!days.time[i]) break;
          const dt = new Date(days.time[i] + "T00:00:00");
          const cell = document.createElement("div");
          cell.className = "wf-day";
          const label = i === 1 ? "明天" : "周" + WEEK[dt.getDay()];
          const h = Math.round(days.temperature_2m_max[i]);
          const lo2 = Math.round(days.temperature_2m_min[i]);
          cell.innerHTML =
            '<div class="wf-wk">' + label + "</div>" +
            '<div class="wf-ico">' + wmoIcon(days.weather_code[i]) + "</div>" +
            '<div class="wf-temp">' + h + '° <span class="wf-lo">' + lo2 + "°</span></div>";
          box.appendChild(cell);
        }
      }
    }
  } catch (e) {
    const box = container.querySelector(".weather-forecast");
    if (box) box.innerHTML = '<div class="widget-empty">天气加载失败</div>';
  }
}

/** 保存天气城市后调用，立即按新城市重新加载全部天气组件 */
export function reloadWeather() {
  for (const c of mounted) loadWeather(c);
}
