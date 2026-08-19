// Vercel 서버리스 함수 — 공공 자료 정보원 통합 검색
//
// API 키는 클라이언트 코드에 넣지 않고 Vercel 환경변수로만 주입한다.
//   POLICY_BRIEFING_API_KEY  정책브리핑(공공데이터포털)
//   MOLEG_API_KEY            국가법령정보센터(공공데이터포털)
//   KOSIS_API_KEY            KOSIS 공유서비스
//   NANET_API_KEY            국회도서관 자료검색(공공데이터포털)
//   SCIENCEON_API_KEY        ScienceON 인증키
//   SCIENCEON_CLIENT_ID      ScienceON Client ID
//   SCIENCEON_MAC            ScienceON에 등록한 MAC 주소

const SOURCES = {
  policy: {
    name: "정책브리핑",
    provider: "대한민국 정책브리핑",
    kind: "정책·사례",
    key: "POLICY_BRIEFING_API_KEY",
  },
  law: {
    name: "국가법령정보센터",
    provider: "법제처 국가법령정보센터",
    kind: "법령·제도",
    key: "MOLEG_API_KEY",
  },
  kosis: {
    name: "KOSIS",
    provider: "국가통계포털 KOSIS",
    kind: "통계·수치",
    key: "KOSIS_API_KEY",
  },
  scienceon: {
    name: "ScienceON",
    provider: "한국과학기술정보연구원 ScienceON",
    kind: "연구·과학",
    key: "SCIENCEON_API_KEY",
  },
  nanet: {
    name: "국회도서관",
    provider: "대한민국 국회도서관",
    kind: "학술·도서",
    key: "NANET_API_KEY",
  },
};

function decodeOnce(value) {
  const v = String(value || "").trim();
  try { return decodeURIComponent(v); } catch (_) { return v; }
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#([0-9]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&quot;/gi, '"').replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&").replace(/&nbsp;/gi, " ");
}

function cleanText(value, max = 700) {
  const s = decodeEntities(value)
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

function escRe(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function xmlValue(block, names) {
  for (const name of names) {
    const n = escRe(name);
    const re = new RegExp("<(?:[\\w-]+:)?" + n + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w-]+:)?" + n + ">", "i");
    const m = String(block || "").match(re);
    if (m && cleanText(m[1])) return cleanText(m[1], 4000);
  }
  return "";
}

function xmlBlocks(xml) {
  const source = String(xml || "");
  const tags = ["item", "record", "result", "doc", "document", "row"];
  for (const tag of tags) {
    const re = new RegExp("<(?:[\\w-]+:)?" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w-]+:)?" + tag + ">", "gi");
    const rows = [];
    let m;
    while ((m = re.exec(source))) rows.push(m[1]);
    if (rows.length) return rows;
  }
  return [];
}

function firstUrl(value) {
  const decoded = decodeEntities(value);
  const m = decoded.match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0].replace(/[),.;]+$/, "") : "";
}

function safeUrl(value, base) {
  let raw = decodeEntities(value).trim();
  if (!raw) return "";
  if (!/^https?:\/\//i.test(raw)) raw = firstUrl(raw) || raw;
  try {
    const u = base ? new URL(raw, base) : new URL(raw);
    return (u.protocol === "http:" || u.protocol === "https:") ? u.href : "";
  } catch (_) { return ""; }
}

function isoishDate(value) {
  const s = cleanText(value, 80);
  const m = s.match(/(19|20)\d{2}[.\/-]?(0?[1-9]|1[0-2])?[.\/-]?(0?[1-9]|[12]\d|3[01])?/);
  if (!m) return s;
  const digits = m[0].replace(/\D/g, "");
  if (digits.length >= 8) return digits.slice(0, 4) + "-" + digits.slice(4, 6) + "-" + digits.slice(6, 8);
  if (digits.length >= 6) return digits.slice(0, 4) + "-" + digits.slice(4, 6);
  return digits.slice(0, 4);
}

function itemId(source, title, url, index) {
  const seed = source + "|" + title + "|" + url + "|" + index;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return source + "-" + (h >>> 0).toString(36);
}

function commonItem(source, row, index) {
  const cfg = SOURCES[source];
  const title = cleanText(row.title || "", 320);
  const url = safeUrl(row.url || "", row.base);
  return {
    id: itemId(source, title, url, index),
    sourceName: cfg.name,
    provider: cleanText(row.provider || cfg.provider, 160),
    kind: cfg.kind,
    title,
    description: cleanText(row.description || "", 700),
    url,
    date: isoishDate(row.date || ""),
  };
}

function compactItems(items, limit) {
  const seen = new Set();
  return items.filter(x => {
    if (!x || !x.title) return false;
    const k = (x.url || x.title).toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k); return true;
  }).slice(0, limit);
}

function upstreamError(body) {
  const code = xmlValue(body, ["resultCode", "returnReasonCode", "errorCode", "errCode"]);
  const msg = xmlValue(body, ["resultMsg", "returnAuthMsg", "errorMessage", "errMsg", "message"]);
  if ((code && !/^(00|0|INFO-0)$/i.test(code)) || /SERVICE_(?:KEY|ACCESS)|PERMISSION_DENIED|APPLICATION_ERROR/i.test(body)) {
    return cleanText(msg || "정보원 API가 요청을 거부했습니다. 활용신청과 인증키 권한을 확인해 주세요.", 260);
  }
  return "";
}

async function fetchText(url, init) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(url, { ...(init || {}), signal: ctl.signal });
    const text = await r.text();
    if (!r.ok) {
      const e = new Error("정보원 응답 오류 (" + r.status + ")");
      e.status = r.status >= 400 && r.status < 500 ? 502 : r.status;
      throw e;
    }
    const apiError = upstreamError(text);
    if (apiError) { const e = new Error(apiError); e.status = 502; throw e; }
    return text;
  } catch (e) {
    if (e && e.name === "AbortError") { const x = new Error("정보원의 응답 시간이 초과되었습니다."); x.status = 504; throw x; }
    throw e;
  } finally { clearTimeout(timer); }
}

function serviceUrl(base, params) {
  const u = new URL(base);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v) !== "") u.searchParams.set(k, String(v));
  });
  return u.href;
}

async function searchKosis(query, limit, key) {
  const url = serviceUrl("https://kosis.kr/openapi/statisticsSearch.do", {
    method: "getList", apiKey: key, searchNm: query, sort: "RANK",
    startCount: 1, resultCount: limit, format: "json",
  });
  const body = await fetchText(url);
  let data;
  try { data = JSON.parse(body); } catch (_) { throw Object.assign(new Error("KOSIS 응답을 해석하지 못했습니다."), { status: 502 }); }
  const rows = Array.isArray(data) ? data : (data.result || data.data || []);
  const items = rows.map((r, i) => commonItem("kosis", {
    title: r.TBL_NM || r.STAT_NM,
    description: [r.STAT_NM, r.CONTENTS, r.MT_ATITLE, r.ITEM03].filter(Boolean).join(" · "),
    provider: r.ORG_NM || SOURCES.kosis.provider,
    date: [r.STRT_PRD_DE, r.END_PRD_DE].filter(Boolean).join("~"),
    url: r.LINK_URL || r.TBL_VIEW_URL,
    base: "https://kosis.kr",
  }, i));
  return { items: compactItems(items, limit) };
}

async function searchPolicy(query, limit, key) {
  // 전문자료 API는 검색어 파라미터를 제공하지 않아 최근 목록을 받아 제목·내용에서 선별한다.
  const url = serviceUrl("https://apis.data.go.kr/1371000/expDocService/expDocList", {
    serviceKey: decodeOnce(key), pageNo: 1, numOfRows: 100,
  });
  const body = await fetchText(url);
  const q = query.toLowerCase();
  const all = xmlBlocks(body).map((b, i) => commonItem("policy", {
    title: xmlValue(b, ["title", "articleTitle", "newsTitle", "subject", "sj"]),
    description: [
      xmlValue(b, ["subtitle", "subTitle", "subhead"]),
      xmlValue(b, ["content", "articleContent", "contents", "description", "summary"]),
    ].filter(Boolean).join(" "),
    provider: xmlValue(b, ["department", "deptName", "organName", "provider"]) || SOURCES.policy.provider,
    date: xmlValue(b, ["approvalDate", "approveDate", "regDate", "date", "createdDate"]),
    url: xmlValue(b, ["originalUrl", "originUrl", "articleUrl", "newsUrl", "url", "link"]) || firstUrl(b),
    base: "https://www.korea.kr",
  }, i));
  const valid = all.filter(x => x.title);
  const matched = valid.filter(x => (x.title + " " + x.description).toLowerCase().includes(q));
  return {
    items: compactItems(matched.length ? matched : valid, limit),
    notice: matched.length ? "" : "정확히 일치하는 최근 자료가 없어 정책브리핑 최신 전문자료를 표시합니다.",
  };
}

async function searchLaw(query, limit, key) {
  const url = serviceUrl("https://apis.data.go.kr/1170000/law/lawSearchList.do", {
    serviceKey: decodeOnce(key), target: "law", type: "XML",
    query, display: limit, page: 1,
  });
  const body = await fetchText(url);
  const items = xmlBlocks(body).map((b, i) => commonItem("law", {
    title: xmlValue(b, ["법령명한글", "법령명", "lawNameKor", "lawName", "title"]),
    description: [
      xmlValue(b, ["법령구분명", "lawTypeName", "법령분야명"]),
      xmlValue(b, ["소관부처명", "ministryName", "공포번호", "promulgationNo"]),
    ].filter(Boolean).join(" · "),
    provider: xmlValue(b, ["소관부처명", "ministryName"]) || SOURCES.law.provider,
    date: xmlValue(b, ["시행일자", "공포일자", "enforcementDate", "promulgationDate"]),
    url: xmlValue(b, ["법령상세링크", "lawDetailLink", "상세링크", "url", "link"]) || firstUrl(b),
    base: "https://www.law.go.kr",
  }, i));
  return { items: compactItems(items, limit) };
}

function nanetRows(body) {
  const blocks = xmlBlocks(body);
  // 응답이 name/value 쌍의 연속인 경우, 자료명 항목을 기준으로 레코드를 묶는다.
  const pairRows = blocks.map(b => ({ name: xmlValue(b, ["name"]), value: xmlValue(b, ["value"]), raw: b }));
  if (pairRows.filter(x => x.name && x.value).length < Math.max(2, pairRows.length / 2)) return blocks;
  const grouped = []; let current = "";
  pairRows.forEach(p => {
    if (/자료명|표제|title/i.test(p.name) && current) grouped.push(current);
    current += "<field><name>" + p.name + "</name><value>" + p.value + "</value></field>";
  });
  if (current) grouped.push(current);
  return grouped;
}

function nanetField(block, pattern) {
  const fields = String(block).match(/<field>[\s\S]*?<\/field>/gi) || [];
  for (const f of fields) {
    const name = xmlValue(f, ["name"]);
    if (pattern.test(name)) return xmlValue(f, ["value"]);
  }
  return "";
}

async function searchNanet(query, limit, key) {
  const url = serviceUrl("https://apis.data.go.kr/9720000/searchservice/basic", {
    serviceKey: decodeOnce(key), pageno: 1, displaylines: limit, search: "자료명," + query,
  });
  const body = await fetchText(url);
  const items = nanetRows(body).map((b, i) => {
    const title = xmlValue(b, ["title", "자료명", "value"]) || nanetField(b, /자료명|표제|title/i);
    const author = xmlValue(b, ["author", "저자사항", "creator"]) || nanetField(b, /저자|author|creator/i);
    const publication = xmlValue(b, ["publisher", "발행사항", "publication"]) || nanetField(b, /발행|publisher|publication/i);
    const date = xmlValue(b, ["date", "발행년", "발행일"]) || nanetField(b, /발행년|발행일|date/i);
    const direct = xmlValue(b, ["url", "link", "상세보기", "detailUrl"]) || firstUrl(b);
    return commonItem("nanet", {
      title,
      description: [author, publication].filter(Boolean).join(" · "),
      date,
      url: direct || "https://dl.nanet.go.kr/search/searchInnerList.do",
      base: "https://dl.nanet.go.kr",
    }, i);
  });
  return { items: compactItems(items, limit) };
}

async function searchScienceOn() {
  // ScienceON은 인증키만으로 호출할 수 없고 Client ID, 등록 MAC/IP, 콘텐츠 승인이 함께 필요하다.
  // 규격이 계정의 API Gateway 신청 화면에서 제공되므로 불완전한 호출을 추측하지 않는다.
  if (!process.env.SCIENCEON_CLIENT_ID || !process.env.SCIENCEON_MAC) {
    const e = new Error("ScienceON은 인증키 외에 Client ID와 등록 MAC/IP가 필요합니다. ScienceON API Gateway 승인 정보를 배포 환경변수에 추가해 주세요.");
    e.status = 503; throw e;
  }
  const e = new Error("ScienceON 검색은 계정별 API Gateway 호출 규격 확인이 필요합니다. 승인 화면의 요청 예시를 확인해 연결을 완료해 주세요.");
  e.status = 503; throw e;
}

function validCaller(req) {
  const host = String(req.headers.host || "").toLowerCase();
  if (!host) return true;
  for (const header of [req.headers.origin, req.headers.referer]) {
    if (!header) continue;
    try { if (new URL(header).host.toLowerCase() !== host) return false; }
    catch (_) { return false; }
  }
  return true;
}

function rateAllowed(req) {
  global.__publicSourceRate = global.__publicSourceRate || new Map();
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  const now = Date.now();
  const recent = (global.__publicSourceRate.get(ip) || []).filter(t => now - t < 60000);
  if (recent.length >= 40) return false;
  recent.push(now); global.__publicSourceRate.set(ip, recent);
  if (global.__publicSourceRate.size > 5000) global.__publicSourceRate.clear();
  return true;
}

module.exports = async (req, res) => {
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("x-content-type-options", "nosniff");
  if (req.method && req.method !== "GET") {
    res.setHeader("allow", "GET"); res.status(405).json({ error: "GET 요청만 허용됩니다." }); return;
  }
  if (!validCaller(req)) { res.status(403).json({ error: "허용되지 않은 출처의 요청입니다." }); return; }
  if (!rateAllowed(req)) { res.status(429).json({ error: "요청이 너무 잦습니다. 잠시 후 다시 시도하세요." }); return; }

  const source = String((req.query && req.query.source) || "").trim().toLowerCase();
  const query = String((req.query && req.query.query) || "").trim();
  const limit = Math.min(20, Math.max(1, parseInt((req.query && req.query.limit) || "10", 10) || 10));
  const cfg = SOURCES[source];
  if (!cfg) { res.status(400).json({ error: "지원하지 않는 자료 정보원입니다." }); return; }
  if (!query) { res.status(400).json({ error: "검색어가 필요합니다." }); return; }
  if (query.length > 100) { res.status(400).json({ error: "검색어는 100자 이하로 입력하세요." }); return; }

  const key = process.env[cfg.key];
  if (!key) {
    res.status(503).json({ error: cfg.name + " API 연결이 아직 설정되지 않았습니다. 배포 환경변수를 확인해 주세요." });
    return;
  }

  try {
    let result;
    if (source === "kosis") result = await searchKosis(query, limit, key);
    else if (source === "policy") result = await searchPolicy(query, limit, key);
    else if (source === "law") result = await searchLaw(query, limit, key);
    else if (source === "nanet") result = await searchNanet(query, limit, key);
    else result = await searchScienceOn(query, limit, key);

    res.setHeader("cache-control", "public, s-maxage=900, stale-while-revalidate=86400");
    res.status(200).json({ source, sourceName: cfg.name, items: result.items || [], notice: result.notice || "" });
  } catch (e) {
    res.setHeader("cache-control", "no-store");
    res.status((e && e.status) || 502).json({ error: (e && e.message) || "자료 검색에 실패했습니다. 잠시 후 다시 시도하세요." });
  }
};
