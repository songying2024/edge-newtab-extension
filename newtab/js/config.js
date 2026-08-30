/**
 * config.js — 全局配置
 * 说明：搜索引擎、默认导航、WPS 开放平台接入参数均在此配置。
 * WPS 相关参数需要你在 open.wps.cn 开发者后台创建应用后，按实际值填入。
 */

export const CONFIG = {
  /* ========== 搜索引擎 ========== */
  defaultEngine: "bing",
  engines: {
    bing: { name: "必应", url: "https://www.bing.com/search?q=" },
    baidu: { name: "百度", url: "https://www.baidu.com/s?wd=" },
    google: { name: "Google", url: "https://www.google.com/search?q=" },
  },

  /* ========== 默认导航分组 ==========
   * 结合用户浏览器收藏归类整理；已有分组可在设置中增删改。
   */
  defaultGroups: [
    {
      id: "work",
      name: "工作",
      items: [
        { id: "wps", title: "WPS 365", url: "https://365.wps.cn" },
        { id: "wpsoffice", title: "金山办公", url: "https://www.wps.cn" },
        { id: "kdocs", title: "金山文档", url: "https://www.kdocs.cn" },
        { id: "aippt", title: "WPS 智能PPT", url: "https://aippt.wps.cn/welcome/" },
        { id: "mail", title: "企业邮箱", url: "https://mail.wps.cn" },
      ],
    },
    {
      id: "daily",
      name: "日常",
      items: [
        { id: "zhihu", title: "知乎", url: "https://www.zhihu.com" },
        { id: "bilibili", title: "哔哩哔哩", url: "https://www.bilibili.com" },
        { id: "weibo", title: "微博", url: "https://weibo.com" },
        { id: "weixin", title: "微信", url: "https://weixin.qq.com" },
        { id: "baidu", title: "百度", url: "https://www.baidu.com" },
      ],
    },
    {
      id: "ai-cn",
      name: "国内AI",
      items: [
        { id: "doubao", title: "豆包", url: "https://www.doubao.com/chat/" },
        { id: "kimi", title: "Kimi", url: "https://www.kimi.com" },
        { id: "deepseek", title: "DeepSeek", url: "https://chat.deepseek.com" },
        { id: "tongyi", title: "通义千问", url: "https://tongyi.aliyun.com/" },
        { id: "xinghuo", title: "讯飞星火", url: "https://xinghuo.xfyun.cn/" },
        { id: "wenxin", title: "文心一言", url: "https://yiyan.baidu.com/welcome" },
        { id: "chatglm", title: "智谱清言", url: "https://chatglm.cn/" },
        { id: "wpsai", title: "WPS 智能写作", url: "https://openai.wps.cn/" },
      ],
    },
    {
      id: "ai-global",
      name: "国外AI",
      items: [
        { id: "chatgpt", title: "ChatGPT", url: "https://chat.openai.com" },
        { id: "claude", title: "Claude", url: "https://claude.ai" },
        { id: "gemini", title: "Gemini", url: "https://gemini.google.com" },
        { id: "perplexity", title: "Perplexity", url: "https://www.perplexity.ai" },
        { id: "midjourney", title: "Midjourney", url: "https://www.midjourney.com" },
        { id: "huggingface", title: "Hugging Face", url: "https://huggingface.co" },
      ],
    },
    {
      id: "design",
      name: "设计网站",
      items: [
        { id: "zcool", title: "站酷", url: "https://www.zcool.com.cn" },
        { id: "gracg", title: "涂鸦王国", url: "https://www.gracg.com/" },
        { id: "tob", title: "Tob Design", url: "https://tob.design/#/home/" },
        { id: "billfish", title: "Billfish", url: "https://www.billfish.cn/" },
        { id: "blush", title: "Blush 插图", url: "https://blush.design/zh-CN" },
        { id: "spline", title: "Spline 3D", url: "https://spline.design/" },
        { id: "soutu", title: "搜图导航", url: "https://www.91sotu.com/" },
        { id: "iconpark", title: "IconPark", url: "https://iconpark.bytedance.com/" },
        { id: "undraw", title: "unDraw", url: "https://undraw.co/illustrations" },
      ],
    },
    {
      id: "shopping",
      name: "购物网站",
      items: [
        { id: "jd", title: "京东", url: "https://www.jd.com" },
        { id: "taobao", title: "淘宝", url: "https://www.taobao.com" },
        { id: "tmall", title: "天猫", url: "https://www.tmall.com" },
        { id: "pdd", title: "拼多多", url: "https://www.pinduoduo.com" },
        { id: "vip", title: "唯品会", url: "https://www.vip.com" },
        { id: "suning", title: "苏宁易购", url: "https://www.suning.com" },
      ],
    },
    {
      id: "ppt",
      name: "PPT演示",
      items: [
        { id: "sandun", title: "三顿PPT导航", url: "https://www.sandunppt.com/" },
        { id: "hippter", title: "HiPPTER", url: "https://www.hippter.com/" },
        { id: "aboutppt", title: "AboutPPT", url: "https://www.aboutppt.com/" },
        { id: "pptworld", title: "PPT世界", url: "https://www.pptx.cn/" },
        { id: "pptlib", title: "PPT效率库", url: "https://www.pptlib.com/" },
        { id: "youpinppt", title: "优品PPT", url: "https://www.ypppt.com/" },
        { id: "pptdao", title: "PPT导航", url: "https://www.pptdao.com/" },
        { id: "islide", title: "iSlide", url: "https://www.islide.cc/" },
        { id: "pocket", title: "口袋动画", url: "https://www.papocket.com/guide.html" },
        { id: "oktools", title: "OneKeyTools", url: "http://oktools.xyz/index.html" },
        { id: "processon", title: "ProcessOn", url: "https://www.processon.com/" },
        { id: "prezi", title: "Prezi", url: "https://prezi.com/" },
      ],
    },
    {
      id: "gov",
      name: "党建政务",
      items: [
        { id: "12371", title: "共产党员网", url: "https://www.12371.cn/" },
        { id: "people", title: "人民网", url: "http://www.people.com.cn/" },
        { id: "jhsjk", title: "重要讲话数据库", url: "http://jhsjk.people.cn/" },
        { id: "gsxt", title: "信用信息公示系统", url: "http://www.gsxt.gov.cn/" },
        { id: "guihuayun", title: "规划云", url: "http://www.guihuayun.com/" },
        { id: "ngchina", title: "国家地理中文网", url: "http://www.ngchina.com.cn/" },
        { id: "dswxyjy", title: "党史和文献研究院", url: "http://www.dswxyjy.org.cn/" },
      ],
    },
    {
      id: "video",
      name: "视频素材",
      items: [
        { id: "xinpianchang", title: "新片场", url: "https://www.xinpianchang.com/" },
        { id: "shipin520", title: "潮点视频", url: "https://shipin520.com/" },
        { id: "houzi8", title: "猴子音乐", url: "https://houzi8.com/" },
        { id: "51vimeo", title: "51vimeo", url: "https://www.51vimeo.com/" },
        { id: "spdpd", title: "视频大拍档", url: "http://spdpd.net/" },
        { id: "heycan", title: "黑罐头", url: "https://www.heycan.com/material" },
        { id: "jianying", title: "剪映", url: "https://www.jianying.com/" },
      ],
    },
    {
      id: "tools",
      name: "常用工具",
      items: [
        { id: "67tool", title: "67工具网", url: "https://www.67tool.com/" },
        { id: "todesk", title: "ToDesk", url: "https://www.todesk.com/" },
        { id: "aliyundrive", title: "阿里云盘", url: "https://www.aliyundrive.com/" },
        { id: "speedtest", title: "Speedtest", url: "https://www.speedtest.net/" },
        { id: "speedtestcn", title: "测速网", url: "https://www.speedtest.cn/" },
        { id: "dashengpan", title: "大圣盘", url: "https://www.dashengpan.com/" },
        { id: "msdn", title: "MSDN 我告诉你", url: "https://msdn.itellyou.cn/" },
        { id: "eraset", title: "Remove BG", url: "https://www.erase.bg/" },
        { id: "pixlr", title: "Pixlr 去背景", url: "https://pixlr.com/tw/remove-background/" },
      ],
    },
    {
      id: "vis",
      name: "数据可视化",
      items: [
        { id: "raykite", title: "RayData", url: "https://web.raykite.com/" },
        { id: "shanhaibi", title: "山海鲸", url: "https://www.shanhaibi.com/" },
        { id: "dycharts", title: "镝数图表", url: "https://dycharts.com/" },
        { id: "hightopo", title: "图扑软件", url: "https://www.hightopo.com/" },
      ],
    },
  ],

  /* ========== WPS 日历接入（wps_sid 会话方案） ==========
   * 无需开放平台 APPID / 企业资质。
   * 点击「登录授权」→ 弹出 WPS 网页版日历（365.kdocs.cn/rili）→
   * 用户用 WPS 账号登录后，扩展通过 chrome.cookies 读取登录会话 wps_sid，
   * 用 Cookie 头调用 WPS 日历网页版内部接口（rili.kdocs.cn/g-api/...）。
   * 参考已开发的 DSH 插件（wps-cloud-plugin-v2）同一套会话方案。
   */
  wps: {
    /** 日历 API 基地址（rili.kdocs.cn 与 rili.wps.cn 均可用，已实测） */
    apiBase: "https://rili.kdocs.cn",

    /** 弹出授权登录页：用户实际使用的 WPS 日历入口，未登录自动跳 WPS 官方统一登录 */
    loginUrl: "https://rili.wps.cn/?from=wpsweb",

    /** 「打开 WPS 日历」按钮跳转地址 */
    webUrl: "https://rili.wps.cn/?from=wpsweb",

    /** 会话 cookie 名称（读取与请求头均用此） */
    sidCookieName: "wps_sid",
    csrfCookieName: "csrf",

    /** 轮询 cookie 时探测的页面 URL（覆盖 kdocs.cn 与 wps.cn 两个根域） */
    cookieProbeUrls: [
      "https://365.kdocs.cn/",
      "https://rili.kdocs.cn/",
      "https://rili.wps.cn/",
      "https://www.wps.cn/",
    ],

    /** 请求头（与 DSH 插件一致的来源头） */
    referer: "https://365.kdocs.cn/",
    origin: "https://365.kdocs.cn",
  },
};

/* ========== 搜索引擎工具函数 ========== */

/** 合并内置引擎与用户自定义引擎，返回完整引擎表（key -> {name,url}） */
export function buildEngines(customEngines) {
  const all = { ...CONFIG.engines };
  for (const ce of customEngines || []) {
    if (ce && ce.id && ce.name && ce.url) {
      all["custom-" + ce.id] = { name: ce.name, url: ce.url };
    }
  }
  return all;
}

/** 按 key 取引擎：优先内置，其次自定义 */
export function engineByKey(key, customEngines) {
  if (CONFIG.engines[key]) return CONFIG.engines[key];
  const ce = (customEngines || []).find((c) => "custom-" + c.id === key);
  return ce ? { name: ce.name, url: ce.url } : null;
}
