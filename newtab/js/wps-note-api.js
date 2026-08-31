/**
 * wps-note-api.js — WPS 笔记（.ainote）云端 API 封装
 *
 * 技术方案（与日历一致）：复用 wps_sid 会话，直接调 WPS 云盘 v7 API。
 * - 每条便签 = 云盘「笔记」文件夹下的一个 .ainote 文件
 * - 认证：扩展 host_permissions 含 *.wps.cn，fetch credentials:"include"
 *   时浏览器自动附带 .wps.cn 域的 wps_sid cookie（登录 WPS 后 SSO 写入）
 *
 * 已实测端点（api.wps.cn）：
 * - GET  /v7/drives?allotee_type=user&page_size=10&sources=special   我的云盘 ID
 * - GET  /v7/drives/{did}/files/{pid}/children?page_size=            列子项
 * - POST /v7/drives/{did}/files/{pid}/create       {name,file_type}  建文件夹
 * - GET  /v7/drives/{did}/files/{fid}/download     -> {url}          下载地址
 * - POST /v7/drives/{did}/files/{pid}/request_upload                 申请上传
 * - PUT  {store_request.url}（带 cookie）                            上传字节
 * - POST /v7/drives/{did}/files/{pid}/commit_upload                  确认
 *   （request_upload body 带 file_id 即原地覆盖更新，file_id 不变）
 * - POST /v7/drives/{did}/files/{fid}/delete                         删除（进回收站）
 */
import { store } from "./storage.js";
import { wpsAuth } from "./wps-auth.js";

const API = "https://api.wps.cn";
const FOLDER_NAME = "笔记";
const DRIVE_KEY = "wpsNoteDriveId";
const FOLDER_KEY = "wpsNoteFolderId";

const RESP_HEADERS = { "Accept": "application/json" };

async function api(path, options = {}) {
  const sid = await wpsAuth.getSid();
  if (!sid) throw new Error("未登录 WPS");
  const opt = {
    method: options.method || "GET",
    credentials: "include", // 浏览器自动附带 .wps.cn 域 wps_sid
    headers: { ...RESP_HEADERS, ...(options.headers || {}) },
  };
  if (options.body !== undefined) {
    opt.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
    opt.headers["Content-Type"] = "application/json";
  }
  const resp = await fetch(API + path, opt);
  if (!resp.ok && resp.status !== 200) {
    throw new Error("WPS 笔记接口错误 " + resp.status);
  }
  return resp.json();
}

/* ---------- 云盘 / 文件夹 ---------- */

async function getDriveId() {
  const cached = await store.get(DRIVE_KEY);
  if (cached) return cached;
  const d = await api("/v7/drives?allotee_type=user&page_size=10&sources=special");
  const items = (d.data && d.data.items) || [];
  if (!items.length) throw new Error("未找到我的云文档");
  const did = items[0].id;
  await store.set({ [DRIVE_KEY]: did });
  return did;
}

async function listChildren(did, pid, params = {}) {
  const qs = new URLSearchParams({ page_size: "200", ...params }).toString();
  const d = await api(`/v7/drives/${did}/files/${pid}/children?${qs}`);
  return (d.data && d.data.items) || [];
}

async function findOrCreateNotesFolder(did) {
  const cached = await store.get(FOLDER_KEY);
  if (cached) return cached;
  const children = await listChildren(did, "0", { filter_type: "folder" });
  let folder = children.find((c) => c.name === FOLDER_NAME && c.type === "folder");
  if (!folder) {
    const d = await api(`/v7/drives/${did}/files/0/create`, {
      method: "POST",
      body: { name: FOLDER_NAME, file_type: "folder" },
    });
    if (d.code !== 0) throw new Error("创建笔记文件夹失败: " + (d.msg || ""));
    folder = d.data || {};
  }
  const fid = folder.id;
  if (!fid) throw new Error("笔记文件夹 ID 缺失");
  await store.set({ [FOLDER_KEY]: fid });
  return fid;
}

/* ---------- .ainote 文档构造 ---------- */

function rid() {
  const h = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 12; i++) s += h[Math.floor(Math.random() * h.length)];
  return s;
}

function numId() {
  return String(Date.now()) + Math.floor(Math.random() * 1000);
}

function blockTile(inner) {
  return {
    attrs: { config: "{}", editedOffline: "", id: rid(), info: "{}" },
    content: [inner],
    type: "block_tile",
  };
}

function paragraph(text) {
  return {
    attrs: {
      backgroundColor: 0, lineHeight: 1, listFormat: "", listId: "", listLevel: 0,
      listType: "", listValue: "", marks: {}, paddingLeft: 0, textAlign: "left",
      textIndent: 0, todo_date: "", todo_id: "", todo_users: "",
    },
    content: (text || "").split("\n").map((line) => ({ text: line, type: "text" })),
    type: "paragraph",
  };
}

function heading(level, text) {
  return {
    attrs: {
      backgroundColor: 0, level, listFormat: "", listId: "", listLevel: 0,
      listType: "", listValue: "", marks: {}, paddingLeft: 0, textAlign: "left",
      textIndent: 0,
    },
    content: [{ text, type: "text" }],
    type: "heading",
  };
}

/** 构造便签 .ainote 文档：heading 标题 + paragraph 正文 */
function buildAinote(title, text) {
  return {
    content: {
      attrs: {
        cover: {},
        docStyle: { font: "SystemFont", pageWidth: "STANDARD_WIDTH" },
        listdatas: {},
      },
      content: [{
        attrs: { config: "{}", id: rid(), info: "{}" },
        type: "logic_block",
        content: [
          {
            attrs: { config: "{}", editedOffline: "", id: rid(), info: "{}" },
            content: [{
              attrs: { extraAttrs: { rightsEditors: [] }, textAlign: "left" },
              type: "outline-title",
            }],
            type: "block_tile",
          },
          blockTile(heading(2, title || "便签")),
          blockTile(paragraph(text || "")),
        ],
      }],
      type: "doc",
    },
    id: numId(),
    initVersion: "8.7.35",
    ranges: {},
    schemaVersion: 8,
    srcDocID: "",
    updateFlag: 5,
    version: 1,
  };
}

/** 从 .ainote JSON 提取纯文本（heading + paragraph） */
export function ainoteToText(doc) {
  const lines = [];
  const blocks = (doc && doc.content && doc.content.content) || [];
  for (const lb of blocks) {
    for (const bt of lb.content || []) {
      for (const blk of bt.content || []) {
        if (blk.type !== "heading" && blk.type !== "paragraph") continue;
        const line = (blk.content || [])
          .map((t) => (typeof t === "string" ? t : t.text || ""))
          .join("");
        if (line) lines.push(line);
      }
    }
  }
  return lines.join("\n");
}

/* ---------- 上传（创建 / 覆盖） ---------- */

async function uploadBytes(did, pid, name, data, targetFileId) {
  const sha = await sha256Hex(data);
  const body = {
    name, size: data.length, mode: "sequential",
    hashes: [{ type: "sha256", sum: sha }],
  };
  if (targetFileId) body.file_id = targetFileId; // 带即原地覆盖，file_id 不变

  const r1 = await api(`/v7/drives/${did}/files/${pid}/request_upload`, { method: "POST", body });
  if (r1.code !== 0) throw new Error("申请上传失败: " + (r1.msg || ""));
  const up = r1.data || {};
  const storeReq = up.store_request || {};
  if (!up.upload_id || !storeReq.url) throw new Error("上传响应异常");

  // 上传字节（存储服务同样需要会话 cookie）
  const put = await fetch(storeReq.url, {
    method: storeReq.method || "PUT",
    credentials: "include",
    body: data,
  });
  if (put.status !== 200) throw new Error("上传文件失败 " + put.status);

  const storeKey = storeReq.url.replace(/\/+$/, "").split("/").pop();
  const r3 = await api(`/v7/drives/${did}/files/${pid}/commit_upload`, {
    method: "POST",
    body: { upload_id: up.upload_id, file_name: name, size: data.length, file: { key: storeKey } },
  });
  if (r3.code !== 0) throw new Error("确认上传失败: " + (r3.msg || ""));
  const info = r3.data || {};
  return info.id || info.link_id || targetFileId || "";
}

async function sha256Hex(buf) {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ---------- 对外 API ---------- */

/** 笔记内容页地址（www.kdocs.cn 个人版 / 365 版账号通用） */
export function notePageUrl(fileId) {
  return `https://www.kdocs.cn/l/${fileId}?page=home`;
}

export const NOTE_HOME_URL = "https://ainote.kdocs.cn/home/";

/** 便签列表：[{ id(fileId), title, text, mtime }] */
export async function listNotes() {
  const did = await getDriveId();
  const pid = await findOrCreateNotesFolder(did);
  const items = await listChildren(did, pid, { filter_type: "file" });
  const notes = [];
  for (const it of items) {
    if (!/\.ainote$/i.test(it.name || "")) continue;
    notes.push({
      id: it.id,
      name: it.name.replace(/\.ainote$/i, ""),
      mtime: it.mtime || 0,
    });
  }
  notes.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
  return notes;
}

/** 读取单条便签正文 */
export async function readNote(fileId) {
  const did = await getDriveId();
  const d = await api(`/v7/drives/${did}/files/${fileId}/download`);
  const url = d.data && d.data.url;
  if (!url) throw new Error("下载地址缺失");
  const resp = await fetch(url, { credentials: "include" });
  const doc = await resp.json();
  return ainoteToText(doc);
}

/** 保存（创建或覆盖）便签，返回 file_id */
export async function saveNote(fileId, title, text) {
  const did = await getDriveId();
  const pid = await findOrCreateNotesFolder(did);
  const doc = buildAinote(title, text);
  const data = new TextEncoder().encode(JSON.stringify(doc));
  const safeName = (title || "便签").replace(/[\\/:*?"<>|]/g, "_").slice(0, 30) + ".ainote";
  return uploadBytes(did, pid, safeName, data, fileId || null);
}

/** 删除便签（进回收站） */
export async function deleteNote(fileId) {
  const did = await getDriveId();
  const d = await api(`/v7/drives/${did}/files/${fileId}/delete`, { method: "POST" });
  if (d.code !== 0) throw new Error("删除失败: " + (d.msg || ""));
  return true;
}
