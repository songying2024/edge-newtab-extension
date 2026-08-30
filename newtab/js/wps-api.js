/**
 * wps-api.js — WPS 日历网页版内部接口客户端（基于 wps_sid 会话）
 *
 * 真实端点：https://rili.kdocs.cn/g-api/...
 * 已实测验证（2026-08-29）：
 *   GET    /g-api/v3/list/time_range?startQueryTime=&endQueryTime=  查询时间段日程
 *   GET    /g-api/v2/recent_event2?num=                            最近日程
 *   POST   /g-api/v3/event                                         新建/修改日程（带 taskId 即修改）
 *   GET    /g-api/v3/event/{taskId}                                查询单个日程
 *   DELETE /g-api/v1/event/{taskId}                                删除日程
 *
 * 请求头：Cookie: wps_sid=xxx; csrf=xxx；Referer/Origin 指向 365.kdocs.cn。
 */
import { CONFIG } from "./config.js";
import { wpsAuth } from "./wps-auth.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";

/** 统一请求：附 wps_sid 会话与来源头 */
async function request(method, path, body) {
  const sid = await wpsAuth.getSid();
  if (!sid) throw new Error("WPS 未授权，请先登录");

  const headers = {
    Cookie: `wps_sid=${sid}; csrf=${sid}`,
    Referer: CONFIG.wps.referer,
    Origin: CONFIG.wps.origin,
    "User-Agent": UA,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(CONFIG.wps.apiBase + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = {};
  try {
    data = await res.json();
  } catch (e) {
    throw new Error("WPS 接口返回异常（HTTP " + res.status + "）");
  }
  if (data.code !== undefined && data.code !== 0) {
    const msg =
      data.msg || data.result || ("WPS 接口错误 code=" + data.code);
    throw new Error(msg + (data.code === 305 ? "（可能已被删除）" : ""));
  }
  return data.data;
}

/**
 * 查询时间段内日程（按天分组，去重跨天重复项）
 * @param {number} startMs  起始毫秒时间戳
 * @param {number} endMs    结束毫秒时间戳
 * @returns {Promise<Array>} 日程数组（taskId/summary/orgStartTime/orgEndTime/...）
 */
async function listEvents(startMs, endMs) {
  const q = new URLSearchParams({
    startQueryTime: String(startMs),
    endQueryTime: String(endMs),
  });
  const data = await request("GET", "/g-api/v3/list/time_range?" + q.toString());
  const group = (data && data.eventGroupList) || {};
  const events = [];
  const seen = new Set();
  for (const date of Object.keys(group)) {
    const vo = group[date] || {};
    const list = vo.eventSingleVOList || [];
    for (const e of list) {
      if (seen.has(e.taskId)) continue;
      seen.add(e.taskId);
      events.push(e);
    }
  }
  return events;
}

/** 新建日程。payload: { summary, startTime(ms), endTime(ms), eventType?, description? } */
async function createEvent(payload) {
  const body = {
    teamId: 0, // 0 = 个人日历，服务端自动映射
    summary: payload.summary,
    actionType: 1,
    startTime: payload.startTime,
    endTime: payload.endTime,
  };
  if (payload.eventType !== undefined) body.eventType = payload.eventType;
  if (payload.description) body.description = payload.description;
  const data = await request("POST", "/g-api/v3/event", body);
  return data;
}

/** 修改日程：同创建接口，带 taskId */
async function updateEvent(taskId, payload) {
  const body = {
    taskId,
    teamId: 0,
    summary: payload.summary,
    actionType: 1,
    startTime: payload.startTime,
    endTime: payload.endTime,
  };
  if (payload.eventType !== undefined) body.eventType = payload.eventType;
  if (payload.description) body.description = payload.description;
  const data = await request("POST", "/g-api/v3/event", body);
  return data;
}

/** 删除日程 */
async function deleteEvent(taskId) {
  return request(
    "DELETE",
    "/g-api/v1/event/" + encodeURIComponent(taskId) + "?teamId=0"
  );
}

/** 最近日程（用于新标签页快速展示） */
async function recentEvents(num = 10) {
  const data = await request("GET", "/g-api/v2/recent_event2?num=" + num);
  return (data && data.events) || [];
}

export const wpsApi = { listEvents, createEvent, updateEvent, deleteEvent, recentEvents };
