// Vercel 서버리스 함수 — 네이버 검색 API(뉴스/블로그) 중계
// 브라우저는 CORS로 openapi.naver.com에 직접 접근할 수 없고, 키를 노출하면 안 되므로
// 이 함수가 서버에서 대신 호출한다. 키는 Vercel 환경변수로 주입한다:
//   NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
module.exports = async (req, res) => {
  const q = (req.query && req.query.query || "").trim();
  const type = (req.query && req.query.type) === "blog" ? "blog" : "news";
  const sort = (req.query && req.query.sort) === "date" ? "date" : "sim";
  const display = Math.min(30, Math.max(1, parseInt((req.query && req.query.display) || "10", 10) || 10));

  if (!q) { res.status(400).json({ error: "검색어(query)가 필요합니다." }); return; }
  if (q.length > 100) { res.status(400).json({ error: "검색어는 100자 이하로 입력하세요." }); return; }

  // 같은 사이트에서의 호출만 허용(브라우저 기준 간이 차단 — referer가 있는 경우에만 검사)
  const ref = req.headers.referer || "";
  const host = req.headers.host || "";
  if (ref && host && !ref.includes(host)) {
    res.status(403).json({ error: "허용되지 않은 출처의 요청입니다." });
    return;
  }

  // 간이 레이트리밋: 같은 IP 분당 30회 (서버리스 인스턴스 메모리 기준)
  global.__nvRate = global.__nvRate || new Map();
  const ip = ((req.headers["x-forwarded-for"] || "").split(",")[0] || "").trim() || "unknown";
  const now = Date.now();
  const recent = (global.__nvRate.get(ip) || []).filter(t => now - t < 60000);
  if (recent.length >= 30) {
    res.status(429).json({ error: "요청이 너무 잦습니다. 잠시 후 다시 시도하세요." });
    return;
  }
  recent.push(now);
  global.__nvRate.set(ip, recent);
  if (global.__nvRate.size > 5000) global.__nvRate.clear(); // 메모리 보호

  const id = process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret) {
    res.status(500).json({
      error: "서버에 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수가 설정되지 않았습니다. Vercel 프로젝트 Settings → Environment Variables 에서 추가한 뒤 다시 배포하세요.",
    });
    return;
  }

  const url = "https://openapi.naver.com/v1/search/" + type + ".json"
    + "?query=" + encodeURIComponent(q)
    + "&display=" + display
    + "&sort=" + sort;

  try {
    const r = await fetch(url, {
      headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret },
    });
    const text = await r.text();
    res.setHeader("content-type", "application/json; charset=utf-8");
    // 브라우저 캐시 방지(최신 기사 반영)
    res.setHeader("cache-control", "no-store");
    res.status(r.status).send(text);
  } catch (e) {
    res.status(502).json({ error: "네이버 API 호출 실패: " + (e && e.message ? e.message : String(e)) });
  }
};
