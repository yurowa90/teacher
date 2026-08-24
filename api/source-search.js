// Vercel 서버리스 함수 — 공공 자료 정보원 통합 검색
//
// API 키는 클라이언트 코드에 넣지 않고 Vercel 환경변수로만 주입한다.
//   POLICY_BRIEFING_API_KEY  정책브리핑(공공데이터포털)
//   MOLEG_API_KEY            국가법령정보센터(공공데이터포털)
//   KOSIS_API_KEY            KOSIS 공유서비스
//   NANET_API_KEY            국회도서관 자료검색(공공데이터포털)
//   SCIENCEON_API_KEY        ScienceON 인증키(32바이트)
//   SCIENCEON_CLIENT_ID      ScienceON Client ID
//   SCIENCEON_MAC_ADDRESS    ScienceON에 등록한 MAC 주소

const crypto = require("crypto");

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

function credentialValue(value) {
  let v = String(value || "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  const assignment = v.match(/^SCIENCEON_(?:API_KEY|AUTH_KEY|CLIENT_ID)\s*=\s*([\s\S]+)$/i);
  if (assignment) v = assignment[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

function scienceOnEnvironment() {
  const namedClientId = credentialValue(process.env.SCIENCEON_CLIENT_ID);
  const values = [
    credentialValue(process.env.SCIENCEON_AUTH_KEY),
    credentialValue(process.env.SCIENCEON_API_KEY),
    namedClientId,
  ].filter(Boolean);
  const authKey = values.find(value => Buffer.byteLength(value, "utf8") === 32) || values[0] || "";
  const clientId = values.find(value => value !== authKey && /^[a-f0-9]{64}$/i.test(value))
    || namedClientId;
  return {
    authKey,
    clientId,
    macAddress: credentialValue(process.env.SCIENCEON_MAC_ADDRESS || process.env.SCIENCEON_MAC),
  };
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
  // 실제 레코드 태그를 포괄 루트인 result보다 먼저 찾는다.
  const tags = ["NewsItem", "item", "record", "doc", "document", "row", "law", "result"];
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
  const monthFirst = s.match(/\b(0?[1-9]|1[0-2])\/([0-2]?\d|3[01])\/((?:19|20)\d{2})\b/);
  if (monthFirst) {
    return monthFirst[3] + "-" + monthFirst[1].padStart(2, "0") + "-" + monthFirst[2].padStart(2, "0");
  }
  const separated = s.match(/\b((?:19|20)\d{2})\s*[.\/-]\s*(1[0-2]|0?[1-9])(?:\s*[.\/-]\s*(3[01]|[12]\d|0?[1-9]))?(?!\d)/);
  if (separated) {
    return separated[1] + "-" + separated[2].padStart(2, "0") +
      (separated[3] ? "-" + separated[3].padStart(2, "0") : "");
  }
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
    // 검색 카드는 CSS로 두 줄만 보이지만 문항 생성에는 초록·본문 요약의 근거 맥락이 필요하다.
    description: cleanText(row.description || "", 3600),
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

function queryParts(query) {
  const phrase = cleanText(query, 100).toLowerCase();
  const compactPhrase = phrase.replace(/[\s\p{P}\p{S}]+/gu, "");
  const tokens = Array.from(new Set(
    phrase.split(/[\s,./·()\[\]{}:+\-]+/).map(x => x.trim()).filter(x => x.length > 1)
  ));
  return { phrase, compactPhrase, tokens };
}

function relevanceScore(item, query) {
  const { phrase, compactPhrase, tokens } = queryParts(query);
  const title = String(item && item.title || "").toLowerCase();
  const description = String(item && (item.content || item.description) || "").toLowerCase();
  const full = title + " " + description;
  const compactTitle = title.replace(/[\s\p{P}\p{S}]+/gu, "");
  const compactDescription = description.replace(/[\s\p{P}\p{S}]+/gu, "");
  if (!phrase) return 0;
  if (title.includes(phrase) || (compactPhrase && compactTitle.includes(compactPhrase))) return 100;
  if (description.includes(phrase) || (compactPhrase && compactDescription.includes(compactPhrase))) return 88;
  if (!tokens.length) return 0;

  let matched = 0;
  let titleMatched = 0;
  tokens.forEach(token => {
    if (title.includes(token)) { matched += 1; titleMatched += 1; }
    else if (description.includes(token)) matched += 1;
  });
  if (!matched) return 0;
  const coverage = matched / tokens.length;
  const titleCoverage = titleMatched / tokens.length;
  return Math.min(84, Math.round(coverage * 56 + titleCoverage * 28));
}

function rankWithRelevance(items, query) {
  return (items || []).map((item, index) => ({
    item: { ...item, relevance: relevanceScore(item, query) }, index,
  })).sort((a, b) => b.item.relevance - a.item.relevance || a.index - b.index)
    .map(entry => entry.item);
}

function querySuggestions(query) {
  const q = cleanText(query, 100);
  const compact = q.replace(/\s+/g, "");
  const domain = [
    [/생태|먹이|생물다양/, ["생태계 변화", "생물다양성", "먹이그물"]],
    [/기후|탄소|온실|온난/, ["기후변화 적응", "탄소중립", "온실가스 배출"]],
    [/에너지|전력|재생/, ["에너지 소비", "재생에너지", "전력 수요"]],
    [/감염|질병|바이러스/, ["감염병 대응", "질병 예방", "백신 정책"]],
    [/유전|유전자|생명윤리/, ["유전자 편집", "생명윤리", "유전 정보"]],
  ].find(([re]) => re.test(compact));
  const candidates = domain ? domain[1] : queryParts(q).tokens;
  return Array.from(new Set(candidates.filter(x => x && x !== q))).slice(0, 3);
}

function alternativeSources(source) {
  const map = {
    policy: ["scienceon", "kosis", "law"],
    law: ["policy", "scienceon"],
    kosis: ["scienceon", "policy"],
    scienceon: ["kosis", "policy"],
    nanet: ["scienceon", "policy"],
  };
  return (map[source] || []).map(id => ({ id, name: SOURCES[id].name, kind: SOURCES[id].kind }));
}

function upstreamError(body) {
  const code = xmlValue(body, ["resultCode", "returnReasonCode", "errorCode", "errCode"]);
  const msg = xmlValue(body, ["resultMsg", "returnAuthMsg", "errorMessage", "errMsg", "message"]);
  if ((code && !/^(00|0|INFO-0)$/i.test(code)) || /SERVICE_(?:KEY|ACCESS)|PERMISSION_DENIED|APPLICATION_ERROR/i.test(body)) {
    return cleanText(msg || "정보원 API가 요청을 거부했습니다. 활용신청과 인증키 권한을 확인해 주세요.", 260);
  }
  return "";
}

function safeUpstreamDetail(body) {
  let detail = upstreamError(body);
  if (!detail) {
    try {
      const data = JSON.parse(String(body || "").replace(/^\uFEFF/, "").trim());
      detail = cleanText(
        data && (data.errorMessage || data.error || data.message || data.resultMsg || data.msg),
        260
      );
    } catch (_) {}
  }
  if (!detail) {
    detail = xmlValue(body, [
      "returnAuthMsg", "resultMsg", "errorMessage", "errMsg", "message", "faultstring",
    ]) || cleanText(body, 260);
  }
  // 상위 서버가 요청 URL이나 키를 오류 본문에 되돌려도 사용자·로그에 노출하지 않는다.
  return cleanText(detail, 260)
    .replace(/((?:serviceKey|apiKey)\s*[=:]\s*)[^\s&<]+/gi, "$1[인증정보 숨김]")
    .replace(/[A-Za-z0-9+/%_-]{40,}={0,2}/g, "[인증정보 숨김]");
}

function upstreamMessage(name, status, detail) {
  const d = String(detail || "");
  if (/SERVICE_ACCESS_DENIED|PERMISSION_DENIED|접근\s*권한|이용\s*권한/i.test(d)) {
    return name + " 활용 권한이 확인되지 않습니다. 해당 API의 활용신청·승인 상태와 연결한 서비스키를 확인해 주세요.";
  }
  if (/SERVICE_KEY_IS_NOT_REGISTERED|등록되지\s*않은.*(?:키|인증)|INVALID.*(?:KEY|AUTH)/i.test(d)) {
    return name + " 인증키가 등록되지 않았거나 이 서비스에 연결되지 않았습니다. 발급처의 키와 활용신청을 확인해 주세요.";
  }
  if (/INVALID_REQUEST_PARAMETER|HTTP_ERROR|허용되지\s*않은\s*HTTP|파라미터/i.test(d)) {
    return name + " 요청 규격을 상위 API가 거부했습니다" + (d ? " · " + d : "") + ".";
  }
  if (status === 403) {
    return name + " API가 요청을 거부했습니다 (403). 해당 API의 활용신청 승인 여부와 이 신청에 발급된 키인지 확인해 주세요" + (d ? " · " + d : "") + ".";
  }
  return name + " 응답 오류 (" + status + ")" + (d ? " · " + d : "");
}

async function fetchText(url, init, meta) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(url, { ...(init || {}), signal: ctl.signal });
    const text = await r.text();
    if (!r.ok) {
      const detail = safeUpstreamDetail(text);
      console.error("[source-search] upstream rejected", {
        source: meta && meta.source,
        host: new URL(url).host,
        status: r.status,
        detail,
      });
      const e = new Error(upstreamMessage((meta && meta.name) || "정보원", r.status, detail));
      e.status = r.status >= 400 && r.status < 500 ? 502 : r.status;
      throw e;
    }
    const apiError = upstreamError(text);
    if (apiError) {
      console.error("[source-search] upstream api error", {
        source: meta && meta.source,
        host: new URL(url).host,
        status: r.status,
        detail: safeUpstreamDetail(text),
      });
      const e = new Error(upstreamMessage((meta && meta.name) || "정보원", r.status, safeUpstreamDetail(text)));
      e.status = 502;
      throw e;
    }
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

function quoteBareJsonKeys(value) {
  const src = String(value || "");
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    out += ch;
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch !== "{" && ch !== ",") continue;

    let j = i + 1;
    let ws = "";
    while (j < src.length && /\s/.test(src[j])) ws += src[j++];
    if (!/[A-Za-z_$]/.test(src[j] || "")) continue;
    const start = j;
    while (j < src.length && /[A-Za-z0-9_$]/.test(src[j])) j++;
    const key = src.slice(start, j);
    let after = "";
    while (j < src.length && /\s/.test(src[j])) after += src[j++];
    if (src[j] !== ":") continue;
    out += ws + JSON.stringify(key) + after + ":";
    i = j;
  }
  return out;
}

async function searchKosis(query, limit, key) {
  const url = serviceUrl("https://kosis.kr/openapi/statisticsSearch.do", {
    method: "getList", apiKey: String(key || "").trim(), searchNm: query, sort: "RANK",
    startCount: 1, resultCount: limit, format: "json", content: "json",
  });
  const body = await fetchText(url, null, { source: "kosis", name: SOURCES.kosis.name });
  let data;
  const normalized = String(body || "").replace(/^\uFEFF/, "").trim();
  try { data = JSON.parse(normalized); }
  catch (_) {
    try { data = JSON.parse(quoteBareJsonKeys(normalized)); }
    catch (_) {
      const detail = safeUpstreamDetail(body);
      console.error("[source-search] invalid upstream payload", {
        source: "kosis", host: "kosis.kr", status: 200, detail,
      });
      throw Object.assign(new Error(
        "KOSIS 응답 형식을 해석하지 못했습니다" + (detail ? " · " + detail : "") + ". KOSIS 활용신청 상태를 확인해 주세요."
      ), { status: 502 });
    }
  }
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

function firstHtmlText(block, selectors) {
  for (const selector of selectors) {
    const re = selector instanceof RegExp ? selector : new RegExp(selector, "i");
    const m = String(block || "").match(re);
    if (m && cleanText(m[m.length - 1], 1200)) return cleanText(m[m.length - 1], 1200);
  }
  return "";
}

function policySearchItems(body, query, limit) {
  const html = String(body || "");
  const anchorRe = /<a\b([^>]*\bhref\s*=\s*(["'])([^"']*policyNewsView\.do\?[^"']*newsId=[^"']*)\2[^>]*)>([\s\S]*?)<\/a>/gi;
  const anchors = [];
  let match;
  while ((match = anchorRe.exec(html))) {
    anchors.push({ index: match.index, end: anchorRe.lastIndex, attrs: match[1], href: match[3], inner: match[4] });
  }

  const items = anchors.map((anchor, index) => {
    const next = anchors[index + 1];
    const scopeEnd = Math.min(html.length, next ? next.index : anchor.end + 5000);
    const scope = anchor.inner + " " + html.slice(anchor.end, scopeEnd);
    const anchorTitle = firstHtmlText(anchor.attrs, [
      /\btitle\s*=\s*["']([^"']+)["']/i,
      /\baria-label\s*=\s*["']([^"']+)["']/i,
    ]);
    const structuredTitle = firstHtmlText(anchor.inner, [
      /<([a-z0-9]+)\b[^>]*class\s*=\s*["'][^"']*(?:title|subject|\btit\b)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/i,
      /<(?:h2|h3|h4|strong|dt)\b[^>]*>([\s\S]*?)<\/(?:h2|h3|h4|strong|dt)>/i,
      /<img\b[^>]*\balt\s*=\s*["']([^"']+)["'][^>]*>/i,
    ]);
    const anchorText = cleanText(anchor.inner, 4000);
    const scopeText = cleanText(scope, 6000);
    const dateMatch = scopeText.match(/(?:19|20)\d{2}\s*[.\/-]\s*(?:0?[1-9]|1[0-2])\s*[.\/-]\s*(?:0?[1-9]|[12]\d|3[01])/);
    const date = isoishDate(dateMatch ? dateMatch[0] : "");
    const title = cleanText(
      anchorTitle || structuredTitle || anchorText.split(/(?:19|20)\d{2}\s*[.\/-]/)[0],
      320
    );
    let description = firstHtmlText(scope, [
      /<p\b[^>]*class\s*=\s*["'][^"']*(?:summary|desc|text|cont)[^"']*["'][^>]*>([\s\S]*?)<\/p>/i,
      /<p\b[^>]*>([\s\S]*?)<\/p>/i,
    ]);
    if (!description || description === title) {
      description = scopeText.replace(title, "").replace(dateMatch ? dateMatch[0] : "", "").trim();
    }
    return commonItem("policy", {
      title,
      description,
      provider: SOURCES.policy.provider,
      date,
      url: anchor.href,
      base: "https://www.korea.kr",
    }, index);
  }).filter(item => item.title && item.url && item.date);

  // 사이트가 검색어를 무시하거나 추천 콘텐츠를 함께 섞더라도 무관한 최신 뉴스는 반환하지 않는다.
  return compactItems(rankWithRelevance(items, query).filter(item => item.relevance >= 50), limit);
}

function policyArticleDetails(body) {
  const html = String(body || "");
  const published = firstHtmlText(html, [
    /<meta\b[^>]*property\s*=\s*["']article:published_time["'][^>]*content\s*=\s*["']([^"']+)["']/i,
    /<meta\b[^>]*content\s*=\s*["']([^"']+)["'][^>]*property\s*=\s*["']article:published_time["']/i,
    /<span\b[^>]*>\s*((?:19|20)\d{2}\s*[.\/-]\s*\d{1,2}\s*[.\/-]\s*\d{1,2})\s*<\/span>/i,
  ]);
  const startMatch = /<div\b[^>]*class\s*=\s*["'][^"']*\bview_cont\b[^"']*["'][^>]*>/i.exec(html);
  let article = "";
  if (startMatch) {
    const start = startMatch.index + startMatch[0].length;
    const rest = html.slice(start);
    const footer = rest.search(/<div\b[^>]*class\s*=\s*["'][^"']*\barticle_footer\b/i);
    article = footer >= 0 ? rest.slice(0, footer) : rest.slice(0, 18000);
    article = article
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<figure\b[\s\S]*?<\/figure>/gi, " ");
  }
  return {
    date: isoishDate(published),
    content: cleanText(article, 3600).replace(/\s*문의\s*:[\s\S]*$/i, "").trim(),
  };
}

async function enrichPolicyItems(items) {
  const enrichmentCount = Math.min(6, items.length);
  const settled = await Promise.allSettled(items.slice(0, enrichmentCount).map(async item => {
    const body = await fetchText(item.url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "TeacherEssayTest/1.0 (+https://teacher-essaytest.vercel.app)",
      },
    }, { source: "policy", name: SOURCES.policy.name });
    const details = policyArticleDetails(body);
    return {
      ...item,
      description: details.content || item.description,
      date: details.date || item.date,
    };
  }));
  return items.map((item, index) => {
    const result = settled[index];
    if (!result || result.status !== "fulfilled") return item;
    const enriched = result.value;
    // 검색 단계에서 계산한 점수는 검색어 문맥을 이미 반영하므로 유지한다.
    return { ...enriched, relevance: item.relevance };
  });
}

async function searchPolicySite(query, limit) {
  const variants = Array.from(new Set([
    cleanText(query, 100),
    cleanText(query, 100).replace(/\s+/g, ""),
  ].filter(Boolean)));
  let lastError = null;
  for (const keyword of variants) {
    try {
      const url = serviceUrl("https://www.korea.kr/news/policyNewsList.do", { srchWord: keyword });
      const body = await fetchText(url, {
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "TeacherEssayTest/1.0 (+https://teacher-essaytest.vercel.app)",
        },
      }, { source: "policy", name: SOURCES.policy.name });
      const searchItems = policySearchItems(body, query, limit);
      const items = await enrichPolicyItems(searchItems);
      if (items.length) return { items, searchedKeyword: keyword };
    } catch (error) {
      lastError = error;
    }
  }
  return { items: [], error: lastError };
}

async function searchRecentPolicyApi(query, limit, key) {
  if (!key) return { items: [] };
  // 공공데이터 정책뉴스 API는 최대 3일 목록만 제공하므로 최신 자료의 보조 경로로만 사용한다.
  const end = new Date();
  const start = new Date(end.getTime() - 2 * 24 * 60 * 60 * 1000);
  const ymd = d => d.toISOString().slice(0, 10).replace(/-/g, "");
  const url = serviceUrl("https://apis.data.go.kr/1371000/policyNewsService2/policyNewsList2", {
    serviceKey: decodeOnce(key), startDate: ymd(start), endDate: ymd(end),
  });
  const body = await fetchText(url, null, { source: "policy", name: SOURCES.policy.name });
  const all = xmlBlocks(body).map((b, i) => commonItem("policy", {
    title: xmlValue(b, ["title", "articleTitle", "newsTitle", "subject", "sj", "news_title"]),
    description: [
      ["SubTitle1", "SubTitle2", "SubTitle3"]
        .map(name => xmlValue(b, [name])).filter(Boolean).join(" · ") ||
        xmlValue(b, ["subtitle", "subTitle", "subhead", "sub_title"]),
      xmlValue(b, ["DataContents", "content", "articleContent", "contents", "description", "summary", "article_content"]),
    ].filter(Boolean).join(" "),
    provider: xmlValue(b, ["MinisterCode", "department", "departmentName", "deptName", "organName", "provider", "department_name"]) || SOURCES.policy.provider,
    date: xmlValue(b, ["ApproveDate", "approvalDate", "regDate", "date", "createdDate", "approve_date"]),
    url: xmlValue(b, ["originalUrl", "originUrl", "articleUrl", "newsUrl", "url", "link", "original_url"]) || firstUrl(b),
    base: "https://www.korea.kr",
  }, i));
  const valid = all.filter(x => x.title);
  const matched = rankWithRelevance(valid, query).filter(x => x.relevance >= 50);
  return { items: compactItems(matched, limit) };
}

async function searchPolicy(query, limit, key) {
  const site = await searchPolicySite(query, limit);
  if (site.items.length) {
    return {
      items: site.items,
      notice: site.searchedKeyword === cleanText(query, 100)
        ? "정책브리핑 전체 키워드 검색 결과입니다."
        : "띄어쓰기를 보정해 정책브리핑 전체 검색 결과를 찾았습니다.",
    };
  }

  const recent = await searchRecentPolicyApi(query, limit, key);
  return {
    items: recent.items,
    notice: recent.items.length
      ? "정책브리핑 전체 검색이 일시적으로 제한되어 최신 정책뉴스에서 찾은 결과를 표시합니다."
      : "정책브리핑 전체 검색에서 관련 자료를 찾지 못했습니다. 관련 없는 최신 뉴스는 표시하지 않습니다.",
  };
}

async function searchLaw(query, limit, key) {
  const url = serviceUrl("https://apis.data.go.kr/1170000/law/lawSearchList.do", {
    serviceKey: decodeOnce(key), target: "law", query,
    numOfRows: limit, pageNo: 1,
  });
  const body = await fetchText(url, null, { source: "law", name: SOURCES.law.name });
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
  const body = await fetchText(url, null, { source: "nanet", name: SOURCES.nanet.name });
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

function scienceOnTimestamp() {
  // ScienceON 발급 화면과 같은 한국 표준시 기준 YYYYMMDDHHMMSS.
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString()
    .slice(0, 19).replace(/[-:T]/g, "");
}

function scienceOnAccounts(authKey, macAddress) {
  const key = Buffer.from(credentialValue(authKey), "utf8");
  if (key.length !== 32) {
    const e = new Error("ScienceON 인증키 형식이 올바르지 않습니다. 인증키는 32바이트여야 합니다.");
    e.status = 503; throw e;
  }
  const plain = JSON.stringify({ datetime: scienceOnTimestamp(), mac_address: macAddress });
  const cipher = crypto.createCipheriv(
    "aes-256-cbc", key, Buffer.from("jvHJ1EFA0IXBrxxz", "utf8")
  );
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return encrypted.toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
}

async function scienceOnAccessToken(authKey, clientId, macAddress) {
  const cached = global.__scienceOnAccessToken;
  if (cached && cached.clientId === clientId && cached.expiresAt > Date.now() + 90000) {
    return cached.token;
  }
  const url = serviceUrl("https://apigateway.kisti.re.kr/tokenrequest.do", {
    client_id: clientId,
    accounts: scienceOnAccounts(authKey, macAddress),
  });
  const body = await fetchText(url, null, { source: "scienceon", name: SOURCES.scienceon.name });
  let data;
  try { data = JSON.parse(String(body || "").replace(/^\uFEFF/, "").trim()); }
  catch (_) {
    const e = new Error("ScienceON 토큰 응답 형식을 해석하지 못했습니다.");
    e.status = 502; throw e;
  }
  const token = data && (data.access_token || data.accessToken);
  if (!token) {
    const detail = cleanText(data && (
      data.errorMessage || data.error_message || data.message || data.resultMsg || data.errorCode
    ), 180);
    const e = new Error("ScienceON 토큰을 발급받지 못했습니다" + (detail ? " · " + detail : "") + ". 등록 MAC·IP와 승인 상태를 확인해 주세요.");
    e.status = 502; throw e;
  }
  // Access Token의 공식 기본 만료시간은 2시간이며 100분만 캐시해 여유를 둔다.
  global.__scienceOnAccessToken = { token, clientId, expiresAt: Date.now() + 100 * 60 * 1000 };
  return token;
}

function scienceOnRecords(xml) {
  const rows = [];
  const re = /<(?:[\w-]+:)?record(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w-]+:)?record>/gi;
  let m;
  while ((m = re.exec(String(xml || "")))) rows.push(m[1]);
  return rows;
}

function scienceOnValue(block, names) {
  for (const name of names) {
    const n = escRe(name);
    const re = new RegExp(
      "<(?:[\\w-]+:)?item\\b[^>]*\\bmetaCode\\s*=\\s*[\\\"']" + n +
      "[\\\"'][^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?item>", "i"
    );
    const m = String(block || "").match(re);
    if (m && cleanText(m[1])) return cleanText(m[1], 4000);
  }
  return "";
}

async function searchScienceOnTarget(query, limit, clientId, token, target) {
  const url = serviceUrl("https://apigateway.kisti.re.kr/openapicall.do", {
    client_id: clientId,
    token,
    version: "1.0",
    action: "search",
    target,
    searchQuery: JSON.stringify({ BI: query }),
    curPage: 1,
    rowCount: limit,
    include: "Title,Title2,Publisher,Pubyear,Pubdate,Abstract,Abstract2,Author,JournalName,Keyword,Keyword2,DOI,ContentURL,FulltextURL",
  });
  const body = await fetchText(url, null, { source: "scienceon", name: SOURCES.scienceon.name });
  const records = scienceOnRecords(body);
  const statusCode = xmlValue(body, ["statusCode", "StatusCode"]);
  const totalCount = xmlValue(body, ["TotalCount", "totalCount", "recordCount"]);
  const statusMessage = xmlValue(body, ["statusMessage", "errorMessage", "message"]);
  console.info("[source-search] ScienceON response", {
    target, statusCode, totalCount, recordCount: records.length,
  });
  if (statusCode && statusCode !== "200") {
    const e = new Error(
      "ScienceON 검색 요청 오류 (" + statusCode + ")" +
      (statusMessage ? " · " + cleanText(statusMessage, 160) : "")
    );
    e.status = 502; throw e;
  }
  const items = records.map((b, i) => {
    const doi = scienceOnValue(b, ["DOI", "doi"]);
    const contentUrl = scienceOnValue(b, ["ContentURL", "FulltextURL", "MobileURL", "Link", "url"]);
    return commonItem("scienceon", {
      title: scienceOnValue(b, ["Title", "Title2", "TI", "title", "reportTitle", "titleName"]),
      description: [
        scienceOnValue(b, ["Abstract", "Abstract2", "AB", "abstract"]),
        scienceOnValue(b, ["Keyword", "Keyword2", "KW", "keyword"]),
      ].filter(Boolean).join(" · "),
      provider: scienceOnValue(b, ["Publisher", "PB", "Organization", "publisherName"]) || SOURCES.scienceon.provider,
      date: scienceOnValue(b, ["Pubdate", "Pubyear", "PubYear", "PY", "year", "PublishYear"]),
      url: contentUrl || (doi ? "https://doi.org/" + doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "") : ""),
      base: "https://scienceon.kisti.re.kr",
    }, target + "-" + i);
  });
  return { items };
}

function scienceOnRelevance(item, query) {
  const phrase = cleanText(query, 100).toLowerCase();
  const title = String(item.title || "").toLowerCase();
  const description = String(item.description || "").toLowerCase();
  const full = title + " " + description;
  const tokens = phrase.split(/\s+/).filter(token => token.length > 1);
  let score = 0;
  if (phrase && title.includes(phrase)) score += 120;
  else if (phrase && description.includes(phrase)) score += 70;
  if (tokens.length && tokens.every(token => full.includes(token))) score += 40;
  tokens.forEach(token => {
    if (title.includes(token)) score += 14;
    else if (description.includes(token)) score += 4;
  });
  return score;
}

async function searchScienceOn(query, limit, credentials) {
  const { authKey, clientId, macAddress } = credentials;
  const missing = [];
  if (!clientId) missing.push("SCIENCEON_CLIENT_ID");
  if (!macAddress) missing.push("SCIENCEON_MAC_ADDRESS");
  if (missing.length) {
    const e = new Error("ScienceON 연결에 필요한 환경변수가 없습니다: " + missing.join(", ") + ".");
    e.status = 503; throw e;
  }

  const token = await scienceOnAccessToken(authKey, clientId, macAddress);
  // 상위 API의 후보를 조금 넓게 받은 뒤 검색어 일치도를 다시 계산한다.
  const candidateLimit = Math.min(30, Math.max(12, limit * 2));
  const settled = await Promise.allSettled([
    searchScienceOnTarget(query, candidateLimit, clientId, token, "ARTI"),
    searchScienceOnTarget(query, candidateLimit, clientId, token, "REPORT"),
  ]);
  const items = settled.filter(x => x.status === "fulfilled").flatMap(x => x.value.items)
    .map((item, index) => ({ item, index, score: scienceOnRelevance(item, query) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(entry => entry.item);
  if (!items.length && settled.every(x => x.status === "rejected")) throw settled[0].reason;
  return {
    items: compactItems(items, limit),
    notice: settled.some(x => x.status === "rejected")
      ? "승인된 ScienceON 콘텐츠 범위에서 검색 결과를 표시합니다."
      : "",
  };
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

  const scienceOnConfig = source === "scienceon" ? scienceOnEnvironment() : null;
  const key = source === "scienceon"
    ? scienceOnConfig.authKey
    : process.env[cfg.key];
  if (!key && source !== "policy") {
    res.status(503).json({ error: cfg.name + " API 연결이 아직 설정되지 않았습니다. 배포 환경변수를 확인해 주세요." });
    return;
  }

  try {
    let result;
    if (source === "kosis") result = await searchKosis(query, limit, key);
    else if (source === "policy") result = await searchPolicy(query, limit, key);
    else if (source === "law") result = await searchLaw(query, limit, key);
    else if (source === "nanet") result = await searchNanet(query, limit, key);
    else result = await searchScienceOn(query, limit, scienceOnConfig);

    res.setHeader("cache-control", "public, s-maxage=900, stale-while-revalidate=86400");
    const items = rankWithRelevance(result.items || [], query);
    res.status(200).json({
      source,
      sourceName: cfg.name,
      items,
      notice: result.notice || "",
      suggestions: items.length ? [] : querySuggestions(query),
      recommendedSources: items.length ? [] : alternativeSources(source),
    });
  } catch (e) {
    res.setHeader("cache-control", "no-store");
    res.status((e && e.status) || 502).json({ error: (e && e.message) || "자료 검색에 실패했습니다. 잠시 후 다시 시도하세요." });
  }
};
