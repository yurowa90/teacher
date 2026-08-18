/*
 * 논술형 평가 문항 설계 — 앱 소스 (JSX)
 * 이 파일이 소스의 원본이다. 수정 후 아래 명령으로 app.js를 다시 생성해 함께 커밋할 것:
 *   npx esbuild app.jsx --loader:.jsx=jsx --minify --charset=utf8 --outfile=app.js
 * (배포는 컴파일된 app.js를 정적으로 서빙한다 — 브라우저 내 Babel 컴파일 제거됨)
 */
const { useState, useEffect, useRef } = React;

/* ──────────────────────────────────────────────────────────────
   교육과정 데이터 — 2022 개정 과학과 (위계 순서)
   각 과목은 hierarchy 레벨(낮을수록 하위 학년/기초)을 가진다.
   상위 레벨 과목에서 처음 도입되는 개념은 선행학습 방지를 위해 배제.
   ────────────────────────────────────────────────────────────── */
const SUBJECTS = [
  { v:"중학교 과학", lv:0, group:"중학교" },
  { v:"통합과학1", lv:1, group:"고1 공통" },
  { v:"통합과학2", lv:1, group:"고1 공통" },
  { v:"과학탐구실험1", lv:1, group:"고1 공통" },
  { v:"과학탐구실험2", lv:1, group:"고1 공통" },
  { v:"물리학", lv:2, group:"일반선택" },
  { v:"화학", lv:2, group:"일반선택" },
  { v:"생명과학", lv:2, group:"일반선택" },
  { v:"지구과학", lv:2, group:"일반선택" },
  { v:"역학과 에너지", lv:3, group:"진로선택" },
  { v:"전자기와 양자", lv:3, group:"진로선택" },
  { v:"물질과 에너지", lv:3, group:"진로선택" },
  { v:"화학 반응의 세계", lv:3, group:"진로선택" },
  { v:"세포와 물질대사", lv:3, group:"진로선택" },
  { v:"생물의 유전", lv:3, group:"진로선택" },
  { v:"지구시스템과학", lv:3, group:"진로선택" },
  { v:"행성우주과학", lv:3, group:"진로선택" },
  { v:"과학의 역사와 문화", lv:4, group:"융합선택" },
  { v:"기후변화와 환경생태", lv:4, group:"융합선택" },
  { v:"융합과학 탐구", lv:4, group:"융합선택" },
];

/* ──────────────────────────────────────────────────────────────
   실제 성취기준·성취수준 데이터 (2022 개정 과학과)
   standards-data.js(window.SCIENCE_STANDARDS)에서 로드한다.
   출처: 과학과 교육과정(교육부 고시 2022-33호 별책9) + 성취수준 3종(교육부·평가원).
   20개 과목·성취기준 371개, 각 A~E 성취수준.
   ────────────────────────────────────────────────────────────── */
const STANDARDS = (typeof window !== "undefined" && window.SCIENCE_STANDARDS) || {};

// 문항 형식 (FORMATS 6종 + 자동)
const FORMATS = ["자동","자료제시형","문제해결형","비교분석형","논증형","실험탐구형","자유서술형"];

// 입력 방식
const MODES = [
  { v:"standard",  t:"성취기준으로 새 문항 만들기", d:"성취기준과 성취수준을 바탕으로 새 문항을 만듭니다." },
  { v:"convert",   t:"기존 지필 문항을 논술형으로 바꾸기", d:"선택형이나 단답형 문항을 서술 과정이 드러나는 문항으로 바꿉니다." },
  { v:"transform", t:"기존 논술형 문항 변형하기", d:"기존 문항의 맥락, 자료 또는 질문 방식을 바꿉니다." },
  { v:"idea",      t:"주제·아이디어로 만들기", d:"수업 주제나 아이디어를 바탕으로 문항을 만듭니다." },
];

// 성취수준 (LEVELS A~E)
const LEVELS = ["A","B","C","D","E"];

// 그림자료 옵션
const VISUALS = [
  { v:"auto",   t:"필요할 때만 포함" },
  { v:"always", t:"항상 포함" },
  { v:"none",   t:"포함하지 않음" },
];

const formatDisplay = value => value === "자동" ? "내용에 맞게 선택" : value;

// 길라잡이 반응 지시어 17종
const DIRECTIVES = ["요약","분류","비교","대조","분석","추론","적용","논증","설명",
  "예측","평가","종합","해석","서술","구분","제안","도출"];

/* ──────────────────────────────────────────────────────────────
   시스템 지침 (GUIDE)
   — KICE 「서·논술형 평가도구 자료」(과학과) 양식
   — 「2025 중등 논술형 평가 길라잡이」(경기도교육청) 방법론
   ────────────────────────────────────────────────────────────── */
const GUIDE = `당신은 한국교육과정평가원(KICE) 「서·논술형 평가도구 자료」(과학과) 양식과 「2025 중등 논술형 평가 길라잡이」(경기도교육청) 방법론을 따르는 과학과 서·논술형 평가 도구 개발 전문가다. 결과물은 KICE 평가도구 자료 한 편과 같은 완결된 문서 구조를 갖는다: ① 평가 도구 정보표 → ② 평가 문항 → ③ 예시 답안 → ④ 채점 기준 → ⑤ 성취수준별 학생 수행 특성 → ⑥ 채점 시 유의점 → ⑦ 채점 및 피드백 사례 → ⑧ 피드백 제공 시 유의점 → ⑨ 수행평가 적용을 위한 Tip.

[문항 제작 절차]
1) 성취기준·성취수준 분석 → 2) 평가요소(내용요소) 도출 → 3) 문항 제작(발문·자료·조건) → 4) 채점기준표 작성 → 5) 예시 답안·성취수준별 수행 특성·피드백 사례 작성. 이 순서를 따른다.

[문항 구성요소]
- 발문: 학생이 무엇을 수행할지 명확히 제시한다. 반드시 아래 반응 지시어 중 하나로 발문을 끝맺어(예: "~을 비교하시오", "~을 논증하시오", "~을 분석하시오") 요구하는 인지 활동이 발문 자체로 분명하게 한다. 필요하면 하위 문항 (1), (2)로 나눈다.
- 자료: (가), (나) … 라벨을 붙인 제시문·그림자료. 문항 해결에 실제로 필요할 때만 넣는다(장식 금지). 출처가 있는 듯한 제시문은 "– ○○ 자료, 20XX 변형" 식 표기를 붙일 수 있다.
- 조건: 조건은 꼭 필요할 때만 최소한으로 넣는다. 원칙적으로 발문의 반응 지시어만으로 요구가 분명하도록 설계하고, 조건 없이 푸는 문항을 우선한다. 논술형에서 분량 제한(예: "500~700자로 작성할 것")처럼 발문만으로 통제하기 어려운 것만 조건으로 둔다. 조건을 넣지 않는 문항은 conditions.content·conditions.form을 모두 빈 배열([])로 둔다.

[반응 지시어 활용 — 필수] 발문에는 아래 반응 지시어를 문항 의도에 맞게 반드시 사용하고, 그 지시어의 인지 활동에 맞게 발문·채점 요소를 설계한다. 각 문항 directive에 사용한 지시어를 적는다.
  · 요약: 자료의 핵심 개념·결론을 간결하게 정리   · 분류: 공통된 과학적 특성으로 상위·하위 범주로 묶기
  · 구분: 명확한 기준에 따라 개념·현상을 나눔   · 비교: 둘 이상의 공통점과 차이점을 모두 진술
  · 대조: 차이점을 중심으로 진술   · (의견) 제시: 주장·자료를 해석해 자신의 판단과 근거를 제시
  · 설명: 용어·개념의 의미와 작동 원리를 구체적 사례로   · 분석: 자료·그래프를 구성 요소별로 해석해 의미 도출
  · 평가: 자료의 장점과 한계를 기준에 따라 판단   · 논증: 과학적 주장에 근거와 자료를 연결해 타당성을 설득력 있게 제시
  · 서술: 현상·과정·절차를 조건에 맞게 자세히 기록   (그 밖: 추론·적용·예측·종합·해석·도출도 의미에 맞게 사용 가능)

[평가요소 표기] 평가요소·채점 요소는 반드시 명사형 '~하기'로 적는다(예: "기후변화로부터 감염병 문제 추론하기").

[자료-발문 연계 원칙] 자료가 있으면 최소 한 문항 이상이 그 자료를 직접 분석·해석해야만 풀 수 있게 하고, 발문/조건에서 자료를 명시적으로 가리킨다("(나)에 제시된 ~를 근거로", "(가)와 (나)를 비교하여"). 자료에 없는 사실을 묻거나 답의 단서를 자료에서 빠뜨리지 않는다. 자료 없이 일반 지식만으로 풀리는 문항은 배제한다.

[채점 기준] 분석적 채점을 원칙으로 한다. 하위 문항(또는 문항)마다 채점 요소를 정하고, 만점부터 0점까지 모든 점수 단계에 '수행 특성'을 기술한다(예: 3점=3가지를 옳게 제시함 / 2점=2가지 / 1점=1가지 / 0점=옳게 제시하지 못하거나 답안을 작성하지 않음). 단계 간 기준이 서로 중복되지 않게 하고, 도움이 되면 점수 단계별 예시 답안을 덧붙인다. 배점은 3층으로 정합해야 한다: 각 하위 문항 배점 = 그 하위 문항 채점 요소 만점의 합, 문항 배점 = 하위 문항 배점의 합. 논증·평가·해석 요소는 개수가 아니라 수행의 질로 단계를 구분한다(예: 3점=근거와 자료를 연결해 타당하게 논증함 / 2점=근거는 있으나 자료와의 연결이 불완전함 / 1점=근거 없이 주장만 제시함). 점수 단계는 만점부터 0점까지 촘촘히 두는 것을 원칙으로 하되, 건너뛸 경우 그 이유가 수행 특성에서 드러나야 한다.

[성취수준별 학생 수행 특성] 밴드 구획은 정보표 achievementLevels의 밴드와 동일하게 하고, scoreRange는 전체 문항 배점 합계를 기준으로 0점부터 만점까지 빠짐·겹침 없이 나눈다. 각 밴드별로 그 구간 학생이 무엇을 해냈고 무엇을 보완해야 하는지 '~하였습니다 / ~해야 합니다' 문체로 2~4문장 기술한다.

[채점 및 피드백 사례] 수준이 다른 가상 학생 사례 2개를 만든다. 각 사례는 ① 학생 답안 예시(실제 학생이 쓴 듯한 불완전한 답안), ② 채점 요소별 부여 점수, ③ 'ooo 학생은 ~'으로 시작하는 개별 피드백(잘한 점 → 보완할 점 → 학습 제안 순, '~할 수 있을 것입니다' 문체)으로 구성한다. 부여 점수는 채점 기준의 점수 단계 값 중 하나와 정확히 일치해야 한다.

[수행평가 적용을 위한 Tip] ① 교수·학습 및 평가 계획(도구 활용 개요 1~2문장 + 차시별 계획 1~2차시: 활동 제목, 주요 학습 내용, 평가 계획), ② 문항 변형 방향 2~3개, ③ 채점기준표 변형 방향 2~3개를 제안한다.

[평가 도구 정보표] 학교급·학년·영역(단원)은 성취기준·과목에서 추론해 채운다. 성취수준은 입력에 있으면 그대로 쓰고, 없으면 성취기준으로부터 A~E 수준 기술을 만들어 2~3개 밴드(예: A·B / C·D / E)로 묶어 작성한다. 평가 도구 개발 취지는 '~하도록 한다 / ~평가한다' 문체 2~3문장으로 쓴다.

[성취수준과 최소능력자 변별] 각 문항의 '타겟 수준'은 그 수준의 최소능력자(borderline) 기준으로 설계한다. 예: 타겟이 C인 문항은 A·B·C 수준 학생은 해결하고 D·E 수준 학생은 해결하지 못하는 변별점을 갖는다. 타겟 수준의 최소능력자가 각 채점 요소에서 어느 점수 단계에 도달하는지(예: "C 최소능력자 기대 득점 4점/7점")를 levelAnalysis.rationale에 명시하고, 그 기대 득점이 levelCharacteristics의 해당 밴드 점수 구간과 맞물리게 하라. 채점기준 만점 단계와 성취수준별 수행 특성은 성취수준 기술의 행동 동사·내용요소를 재사용해 일관되게 작성한다(성취수준을 직접 입력받지 않은 모드에서도 동일하게 적용).

[교육과정 정합성] 2022 개정 과학과를 기본으로 한다. 입력된 성취기준 코드가 2015 개정(과목명에 로마숫자 Ⅰ·Ⅱ가 붙거나 통합과학 코드가 [10통과01-..] 형태)이면 curriculum을 "2015"로 판정하고 대응하는 2022 개정 과목·표기를 standardNote에 안내한다. 2022 개정이면 "2022"로 판정한다.

[위계 통제] 대상 과목이 지정되면 그 과목의 학습 범위 안에서만 출제하고, 상위 학년·심화 과목에서 처음 도입되는 개념은 자료·문항·조건·예시 답안에서 배제한다. 배제한 상위 개념을 hierarchyBlock에 한 문장으로 기술한다.

[예시 답안] 하위 문항마다 발문·조건을 모두 충족하는 만점 예시 답안을 작성한다. 자료가 있으면 그 구체적 내용을 인용하고, 채점 기준 만점 단계의 기술과 일치시킨다.

[그림자료 — SVG 도식 디자인 규격] 그림자료는 SVG 벡터 도식으로 만든다. 기본 문법은 '둥근 상자 + 화살표 흐름도'다. 아래 규격을 정확히 지킨다.
- 상자: 둥근 사각형(rx=10, 테두리 1.5px), 내부에 두 줄 텍스트 — 1줄째 핵심 용어(굵게 15px, text-anchor="middle"), 2줄째 짧은 부연(11.5px, 회색). 상자 폭은 텍스트보다 넉넉하게(글자수×15px+40 이상), 높이 54~60.
- 흐름(과정형): 상자 3~5개를 가로 등간격 배치하고 사이에 화살표(선 굵기 2, marker 또는 삼각형 폴리곤). 순환·반복 개념은 흐름 아래 중앙에 "↻ 여러 세대에 걸쳐 반복" 같은 주석 텍스트(12px)를 단다.
- 분기(비교·갈래형): 상단 중앙에 시작 상자, 거기서 좌우 두 갈래로 비스듬한 화살표를 내려 두 경로의 상자를 배치하고, 각 경로 아래로 수직 화살표→결과 상자. 두 경로는 좌우 대칭 정렬.
- 그래프: 축·눈금·수치·단위를 정확히 표기하고 데이터가 문항·답안과 일치해야 한다.
- 텍스트는 모두 <text>로 쓰고(줄바꿈은 tspan), 좌표를 계산해 잘림·겹침이 없게 한다. 상자 밖 주석은 12px.
- 색은 [인쇄 설정] 지시를 따른다. 컬러 지정 시에도 상자 채움은 연한 톤(예: #f4f1ea·#e8efe6·#e4ecf5), 테두리·글자는 진한 톤으로 대비를 확보한다.
- viewBox만 지정한다(width/height 속성 금지). viewBox="0 0 900 260"(흐름형)·"0 0 760 480"(분기형) 내외.
- 접근성: <svg>의 첫 자식으로 <title>도식 한 줄 요약</title>을 넣는다.

[첨부 이미지의 자료 활용] 사용자가 이미지를 첨부하며 자료로 쓰라고 지시한 경우, 그 이미지를 다시 그리지 말고 materials 항목에 "imageIndex": N (첨부 순서, 1부터)을 지정하고 svg는 null, label과 caption만 작성하라. 그 이미지는 앱이 문서에 원본 그대로 삽입한다. 문항은 그 이미지의 내용을 직접 분석·해석해야 풀리도록 설계한다.

[출력 형식] 반드시 아래 JSON 스키마의 객체 하나만 출력한다. 코드펜스나 설명 문장을 절대 포함하지 않는다. 한국어로 작성한다. scoring의 levels는 만점→0점 순서로 나열한다.

{
  "curriculum": "2022" | "2015",
  "standardCode": "감지된 성취기준 코드 또는 ''",
  "standardText": "성취기준 문장(있으면) 또는 ''",
  "standardNote": "교육과정 혼용/대응 안내 또는 ''",
  "subjectScope": "출제에 적용한 과목 범위 설명",
  "hierarchyBlock": "위계상 배제한 상위 개념 설명 또는 ''",
  "info": {
    "schoolLevel": "고등학교",
    "subject": "통합과학2",
    "grade": "1학년",
    "domain": "(3) 과학과 미래 사회",
    "toolName": "평가 도구명",
    "achievementLevels": [ { "band": "A·B", "text": "해당 수준 성취수준 기술" } ],
    "purpose": "평가 도구 개발 취지(2~3문장)",
    "itemSummary": [ { "item": "문항 1", "type": "논술형", "elements": ["성취기준 기반 평가 요소"] } ]
  },
  "contentElements": { "knowledge": ["지식·이해 요소"], "process": ["과정·기능 요소"], "value": ["가치·태도 요소"] },
  "evaluationElements": ["명사형 ~하기 평가요소"],
  "items": [
    {
      "number": 1,
      "type": "서술형" | "논술형",
      "format": "자료제시형",
      "directive": "논증",
      "targetLevel": "C",
      "points": 7,
      "intro": "(가)와 (나)의 내용을 바탕으로 물음에 답하시오.",
      "materials": [ { "label": "(가)", "body": "제시문 본문 또는 ''", "svg": "<svg viewBox=...>...</svg>" 또는 null, "svgBlank": "빈칸 변형 지시가 있을 때 ㉠㉡㉢ 빈칸본 SVG, 아니면 null", "caption": "", "imageIndex": 첨부 이미지를 자료로 쓸 때 그 순번(1부터) 또는 null } ],
      "questions": [
        { "label": "(1)" 또는 "",
          "stem": "발문",
          "points": 3,
          "conditions": { "content": ["내용적 측면 조건"], "form": ["형식적 측면 조건(없으면 빈 배열)"] },
          "modelAnswer": "만점 예시 답안" }
      ],
      "tips": ["활용 Tip 문장(답안 작성 예상 시간·변형 아이디어 등) 2~3개"],
      "scoring": [
        { "question": "(1)" 또는 "",
          "element": "채점 요소(~하기)",
          "levels": [ { "points": 3, "criteria": "수행 특성", "example": "이 단계 예시 답안 또는 ''" } ] }
      ],
      "levelAnalysis": {
        "standardElements": "이 문항이 성취기준에서 가져온 내용요소",
        "levelElements": "타겟 수준 성취수준의 내용요소 분석",
        "rationale": "왜 타겟 수준 이상은 도달하고 미만은 도달하지 못하는지 근거"
      }
    }
  ],
  "levelCharacteristics": [ { "band": "A·B", "scoreRange": "5점~7점", "text": "수행 특성 및 보완 방향 기술" } ],
  "scoringNotes": ["채점 시 유의점 2~3개"],
  "feedbackCases": [
    { "title": "사례 1",
      "itemNumber": 1,
      "studentAnswer": "학생 답안 예시",
      "awarded": [ { "question": "(1)", "element": "채점 요소", "points": 2 } ],
      "feedback": "ooo 학생은 ~" }
  ],
  "feedbackNotes": ["피드백 제공 시 유의점 2~3개"],
  "applicationTip": {
    "planIntro": ["교수·학습 및 평가 계획 개요 문장"],
    "lessonPlan": {
      "relatedItem": "평가 도구명-문항1(논술형)",
      "sessions": [ { "session": "1차시", "topic": "활동 제목", "details": ["주요 학습 내용"], "assessment": "보고서 평가·동료 평가" } ]
    },
    "variation": ["문항 변형 방향"],
    "rubricVariation": ["채점기준표 변형 방향"]
  }
}`;

/* ── Gemini API 호출 ─────────────────────────────────────────── */
async function callGemini({ apiKey, model, system, userText, images, maxTokens }) {
  const parts = [{ text:userText }];
  for (const img of images) {
    parts.push({ inline_data:{ mime_type:img.mime, data:img.data } });
  }
  const body = {
    system_instruction: { parts:[{ text:system }] },
    contents: [{ role:"user", parts }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: maxTokens || 32000,
      responseMimeType: "application/json", // JSON 출력 강제
    },
  };
  const url = "https://generativelanguage.googleapis.com/v1beta/models/"
    + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(apiKey);
  const MAX_TRY = 4;
  let res;
  for (let attempt = 1; attempt <= MAX_TRY; attempt++) {
    res = await fetch(url, {
      method:"POST",
      headers:{ "content-type":"application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) break;
    // 503(과부하)·500(일시 오류)은 잠시 뒤 자동 재시도
    if ((res.status === 503 || res.status === 500) && attempt < MAX_TRY) {
      await new Promise(r => setTimeout(r, attempt * 2500));
      continue;
    }
    let detail = "";
    try { const e = await res.json(); if (e.error && e.error.message) detail = e.error.message; } catch(_){}
    let msg, kind = "";
    if (res.status === 400)      { msg = "요청이 거부되었습니다. 모델명 또는 입력을 확인하세요."; kind = "bad_request"; }
    else if (res.status === 403) { msg = "API 키가 올바르지 않거나 권한이 없습니다. 키를 다시 확인하세요."; kind = "auth"; }
    else if (res.status === 404) { msg = "이 키로는 '" + model + "' 모델을 사용할 수 없습니다."; kind = "model_unavailable"; }
    else if (res.status === 429) { msg = "요청 한도를 초과했습니다(무료 등급 할당량 부족일 수 있음)."; kind = "quota"; }
    else if (res.status === 503 || res.status === 500) { msg = "Google 모델 서버가 일시적으로 혼잡합니다. 잠시 뒤 다시 시도하거나 다른 Gemini 모델을 선택하세요."; kind = "overloaded"; }
    else                         { msg = "API 오류 (" + res.status + ")."; }
    if (detail) msg += " (구글 응답: " + detail + ")";
    const err = new Error(msg); err.kind = kind; err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const cand = (data.candidates || [])[0];
  const stop = cand && cand.finishReason;
  const text = cand && cand.content && cand.content.parts
    ? cand.content.parts.map(p=>p.text||"").join("") : "";
  if (!text) {
    const block = data.promptFeedback && data.promptFeedback.blockReason;
    throw new Error(block ? ("요청이 안전 정책으로 차단되었습니다: "+block) : "빈 응답을 받았습니다. 다시 시도해 주세요.");
  }
  return { raw:text, stop };
}

// 잘리거나(truncation) 사소하게 깨진 JSON도 최대한 복구해 파싱
function autoCloseJson(s) {
  let inStr = false, esc = false; const stack = []; let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i]; out += c;
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{" || c === "[") stack.push(c);
    else if (c === "}" || c === "]") stack.pop();
  }
  if (inStr) out += '"';                                   // 문자열 도중에 끊겼으면 닫기
  out = out.replace(/,\s*"[^"]*"\s*:?\s*$/,"")             // 끝에 매달린 미완성 key 제거
           .replace(/:\s*$/,": null")                       // 값 없는 key
           .replace(/,\s*$/,"");                            // 매달린 콤마
  for (let i = stack.length - 1; i >= 0; i--) out += (stack[i] === "{" ? "}" : "]");
  return out;
}

function parseResult(raw) {
  let s = (raw || "").trim();
  s = s.replace(/^```(json)?/i,"").replace(/```\s*$/,"").trim();
  const a = s.indexOf("{");
  if (a > 0) s = s.slice(a);
  const b = s.lastIndexOf("}");
  const noTrailingComma = x => x.replace(/,\s*([}\]])/g, "$1");
  const attempts = [
    s,
    b > 0 ? s.slice(0, b + 1) : s,
    noTrailingComma(b > 0 ? s.slice(0, b + 1) : s),
    noTrailingComma(autoCloseJson(s)),   // 잘린 출력 복구
  ];
  for (const t of attempts) { try { return JSON.parse(t); } catch(_){} }
  throw new Error("PARSE_FAIL");
}

/* ── 도식 빈칸 편집: SVG의 텍스트를 교사가 골라 ㉠㉡ 빈칸으로 ── */
const BLANK_SYMS = ["㉠","㉡","㉢","㉣","㉤","㉥","㉦","㉧"];
function extractSvgTexts(svg){
  try{
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    return Array.from(doc.querySelectorAll("text")).map(t=>t.textContent.replace(/\s+/g," ").trim());
  }catch(_){ return []; }
}
function buildBlankSvg(svg, sel){
  try{
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const texts = Array.from(doc.querySelectorAll("text"));
    const ordered = [...sel].sort((a,b)=>a-b);
    ordered.forEach((idx,k)=>{
      const el = texts[idx]; if(!el) return;
      while(el.firstChild) el.removeChild(el.firstChild);
      el.textContent = "(  " + (BLANK_SYMS[k]||"?") + "  )";
    });
    return new XMLSerializer().serializeToString(doc.documentElement);
  }catch(_){ return null; }
}

/* ── SVG 무해화: script·이벤트 핸들러·외부 참조 제거 (XSS 방어) ── */
function sanitizeSvg(svg){
  try{
    const doc = new DOMParser().parseFromString(svg||"", "image/svg+xml");
    if (!doc.documentElement || doc.documentElement.nodeName.toLowerCase() !== "svg") return "";
    doc.querySelectorAll("script,foreignObject,iframe,object,embed,animate,set,animateTransform").forEach(e=>e.remove());
    doc.querySelectorAll("*").forEach(el=>{
      Array.from(el.attributes).forEach(a=>{
        const n = a.name.toLowerCase(), v = (a.value||"").toLowerCase();
        if (n.startsWith("on") || ((n==="href"||n==="xlink:href") && !v.startsWith("#")) || v.includes("javascript:"))
          el.removeAttribute(a.name);
      });
    });
    return new XMLSerializer().serializeToString(doc.documentElement);
  }catch(_){ return ""; }
}

/* ── SVG → PNG 변환 (개별 저장·docx 삽입용) ─────────────────── */
function svgDims(svg){
  const m = (svg||"").match(/viewBox\s*=\s*["']\s*[\d.\-]+[ ,]+[\d.\-]+[ ,]+([\d.]+)[ ,]+([\d.]+)/);
  return m ? { w: parseFloat(m[1]), h: parseFloat(m[2]) } : { w: 900, h: 400 };
}
function svgToPngDataUrl(svg, scale){
  return new Promise((resolve, reject)=>{
    const { w, h } = svgDims(svg);
    svg = sanitizeSvg(svg) || svg;
    // 이미지 로드가 되려면 독립 SVG 문서 요건(xmlns·크기)이 필요 — 없으면 보정
    if (!/xmlns\s*=/.test(svg)) svg = svg.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    if (!/<svg[^>]*\swidth\s*=/.test(svg)) svg = svg.replace(/<svg/i, '<svg width="'+w+'" height="'+h+'"');
    const img = new Image();
    img.onload = ()=>{
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w * (scale||2)));
      c.height = Math.max(1, Math.round(h * (scale||2)));
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      try { resolve(c.toDataURL("image/png")); } catch(e){ reject(e); }
    };
    img.onerror = ()=>reject(new Error("도식(SVG)을 그림으로 변환하지 못했습니다."));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
}
function loadImgDims(dataUrl){
  return new Promise((resolve)=>{
    const img = new Image();
    img.onload = ()=>resolve({ w: img.naturalWidth||600, h: img.naturalHeight||400 });
    img.onerror = ()=>resolve({ w: 600, h: 400 });
    img.src = dataUrl;
  });
}
function downloadDataUrl(dataUrl, name){
  const a = document.createElement("a");
  a.href = dataUrl; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

/* ── 자동 정합성 검증: 배점 산수·채점 단계·반응지시어 대조 ──── */
function auditResult(r){
  const issues = [];
  const items = r.items||[];
  const okDirectives = DIRECTIVES.concat(["제시"]);
  items.forEach(it=>{
    const qs = normQuestions(it);
    const qSum = qs.reduce((n,q)=>n+(Number(q.points)||0),0);
    const sSum = (it.scoring||[]).reduce((n,g)=>{
      const tops = (g.levels||[]).map(l=>Number(l.points)||0);
      return n + (tops.length ? Math.max(...tops) : 0);
    },0);
    const pts = Number(it.points)||0;
    if (pts && qSum && pts !== qSum) issues.push(`문항 ${it.number}: 문항 배점 ${pts}점 ≠ 하위 문항 배점 합 ${qSum}점`);
    if (pts && sSum && pts !== sSum) issues.push(`문항 ${it.number}: 문항 배점 ${pts}점 ≠ 채점 요소 만점 합 ${sSum}점`);
    if (it.directive && !okDirectives.includes(it.directive)) issues.push(`문항 ${it.number}: 반응지시어 '${it.directive}'는 표준 17종 목록에 없음`);
  });
  (r.feedbackCases||[]).forEach((cs,ci)=>{
    const it = items.find(x=>x.number===cs.itemNumber) || items[0];
    (cs.awarded||[]).forEach(a=>{
      const g = ((it&&it.scoring)||[]).find(g=> a.element ? g.element===a.element : (a.question && g.question===a.question));
      if (g && !(g.levels||[]).some(l=>Number(l.points)===Number(a.points)))
        issues.push(`${cs.title||`사례 ${ci+1}`}: '${g.element}' 부여 점수 ${a.points}점이 채점 기준의 단계에 없음`);
    });
  });
  const total = items.reduce((n,it)=>n+(Number(it.points)||0),0);
  const bands = r.levelCharacteristics||[];
  if (bands.length && total){
    const nums = bands.flatMap(b=>String(b.scoreRange||"").match(/\d+/g)||[]).map(Number);
    if (nums.length && Math.max(...nums) !== total)
      issues.push(`성취수준별 점수 구간의 최댓값(${Math.max(...nums)}점)이 문서 총점(${total}점)과 다름`);
  }
  return issues;
}

/* ── 구버전 결과 호환: questions가 없으면 stem으로 구성 ──────── */
function normQuestions(it) {
  if ((it.questions||[]).length) return it.questions;
  if (it.stem) return [{ label:"", stem:it.stem, points:it.points,
    conditions:{ content:it.conditions||[], form:[] }, modelAnswer:it.modelAnswer||"" }];
  return [];
}

/* ── 마크다운 변환 (KICE 평가도구 문서 구조) ───────────────── */
function toMarkdown(r, showTeacher) {
  const L = [];
  const info = r.info || {};
  L.push(`# ${info.toolName || "서·논술형 평가 문항"}`);
  L.push("");
  L.push(`- 교육과정: ${r.curriculum === "2015" ? "2015 개정" : "2022 개정"}`);
  if (r.standardCode) L.push(`- 성취기준 코드: ${r.standardCode}`);
  if (r.subjectScope) L.push(`- 과목 범위: ${r.subjectScope}`);
  if (r.standardNote) L.push(`> ⚠ ${r.standardNote}`);
  if (r.hierarchyBlock) L.push(`> 위계 점검: ${r.hierarchyBlock}`);

  if (showTeacher) {
    L.push(""); L.push("## 1. 평가 도구 정보표");
    L.push("");
    L.push(`| 학교급 | ${info.schoolLevel||""} | 과목 | ${info.subject||""} |`);
    L.push(`|---|---|---|---|`);
    L.push(`| 학년 | ${info.grade||""} | 영역(단원) | ${info.domain||""} |`);
    L.push("");
    if (r.standardText) L.push(`**성취기준** ${r.standardCode?`[${r.standardCode}] `:""}${r.standardText}`);
    (info.achievementLevels||[]).forEach(a=>L.push(`- **${a.band}**: ${a.text}`));
    if (info.purpose) { L.push(""); L.push(`**평가 도구 개발 취지** ${info.purpose}`); }
    if ((info.itemSummary||[]).length) {
      L.push(""); L.push("| 문항 번호 | 문항 유형 | 성취기준 기반 평가 요소 |"); L.push("|---|---|---|");
      (info.itemSummary||[]).forEach(s=>L.push(`| ${s.item} | ${s.type} | ${(s.elements||[]).join(" / ")} |`));
    }
  }

  L.push(""); L.push("## 2. 평가 문항");
  (r.items||[]).forEach(it=>{
    L.push(""); L.push(`### 평가 문항 ${it.number}(${it.type||"논술형"})`);
    if (it.intro) { L.push(""); L.push(`**${it.intro}${it.points?` (${it.points}점)`:""}**`); }
    (it.materials||[]).forEach(m=>{
      L.push("");
      L.push(`> **${m.label||""}** ${(m.body||"").replace(/\n/g,"\n> ")}`);
      if (m.svg) L.push(`> (그림자료: ${m.caption||"SVG 도식"})`);
    });
    normQuestions(it).forEach(q=>{
      L.push(""); L.push(`**${q.label?q.label+" ":""}${q.stem}${q.points?` (${q.points}점)`:""}**`);
      const c = q.conditions||{};
      if ((c.content||[]).length || (c.form||[]).length) {
        L.push(""); L.push("〈조건〉");
        if ((c.form||[]).length) {
          L.push("[내용적 측면]"); (c.content||[]).forEach(x=>L.push(`- ${x}`));
          L.push("[형식적 측면]"); (c.form||[]).forEach(x=>L.push(`- ${x}`));
        } else {
          (c.content||[]).forEach(x=>L.push(`- ${x}`));
        }
      }
    });
    if (showTeacher && (it.tips||[]).length) {
      L.push(""); L.push("**활용 Tip!**"); (it.tips||[]).forEach(t=>L.push(`- ${t}`));
    }
    const la = it.levelAnalysis||{};
    if (showTeacher && (la.standardElements||la.levelElements||la.rationale)) {
      L.push(""); L.push(`**수준 설계 해설 (목표 수준 ${it.targetLevel||"-"})**`);
      if (la.standardElements) L.push(`- 성취기준 내용요소: ${la.standardElements}`);
      if (la.levelElements) L.push(`- 해당 수준 내용요소: ${la.levelElements}`);
      if (la.rationale) L.push(`- 수준 적합성: ${la.rationale}`);
    }
    if (showTeacher) (it.materials||[]).forEach(m=>{
      if ((m.blankSel||[]).length && m.svg) {
        const texts = extractSvgTexts(m.svg);
        const key = [...m.blankSel].sort((a,b)=>a-b).map((idx,k)=>BLANK_SYMS[k]+" "+(texts[idx]||"")).join(" · ");
        L.push(""); L.push(`**${m.label||"자료"} 빈칸 정답**: ${key}`);
      }
    });
  });

  if (showTeacher) {
    L.push(""); L.push("## 예시 답안");
    L.push(""); L.push("| 문항 | 예시 답안 |"); L.push("|---|---|");
    (r.items||[]).forEach(it=>normQuestions(it).forEach(q=>{
      L.push(`| ${it.number}${q.label?`-${q.label}`:""} | ${(q.modelAnswer||"").replace(/\n/g,"<br>")} |`);
    }));

    L.push(""); L.push("## 채점 기준");
    L.push(""); L.push("| 문항 | 채점 요소 | 점수 | 수행 특성 |"); L.push("|---|---|---|---|");
    (r.items||[]).forEach(it=>(it.scoring||[]).forEach(g=>(g.levels||[]).forEach(lv=>{
      const ex = lv.example ? `<br>_예시 답안: ${lv.example.replace(/\n/g," ")}_` : "";
      L.push(`| ${it.number}${g.question?`-${g.question}`:""} | ${g.element} | ${lv.points}점 | ${(lv.criteria||"").replace(/\n/g," ")}${ex} |`);
    })));

    if ((r.levelCharacteristics||[]).length) {
      L.push(""); L.push("## 성취수준별 학생 수행 특성");
      L.push(""); L.push("| 수준 | 점수 구간 | 수행 특성 |"); L.push("|---|---|---|");
      (r.levelCharacteristics||[]).forEach(b=>L.push(`| ${b.band} | ${b.scoreRange||""} | ${(b.text||"").replace(/\n/g," ")} |`));
    }
    if ((r.scoringNotes||[]).length) {
      L.push(""); L.push("## 채점 시 유의점"); (r.scoringNotes||[]).forEach(x=>L.push(`- ${x}`));
    }
    (r.feedbackCases||[]).forEach((cs,i)=>{
      L.push(""); L.push(`## 채점 및 피드백 — ${cs.title||`사례 ${i+1}`}`);
      L.push(""); L.push("**학생 답안 예시**"); L.push(""); L.push(`> ${(cs.studentAnswer||"").replace(/\n/g,"\n> ")}`);
      if ((cs.awarded||[]).length) {
        L.push(""); L.push("**채점 결과 예시**");
        (cs.awarded||[]).forEach(a=>L.push(`- ${a.question?a.question+" ":""}${a.element}: **${a.points}점**`));
      }
      if (cs.feedback) { L.push(""); L.push("**학생 개별 피드백 예시**"); L.push(""); L.push(cs.feedback); }
    });
    if ((r.feedbackNotes||[]).length) {
      L.push(""); L.push("## 피드백 제공 시 유의점"); (r.feedbackNotes||[]).forEach(x=>L.push(`- ${x}`));
    }
    const ap = r.applicationTip;
    if (ap) {
      L.push(""); L.push("## 수행평가 적용을 위한 Tip");
      if ((ap.planIntro||[]).length) { L.push(""); L.push("**교수·학습 및 평가 계획**"); (ap.planIntro||[]).forEach(x=>L.push(`- ${x}`)); }
      const lp = ap.lessonPlan;
      if (lp && (lp.sessions||[]).length) {
        L.push("");
        if (lp.relatedItem) L.push(`관련 문항(문항 유형): ${lp.relatedItem}`);
        L.push(""); L.push("| 차시 | 교수·학습 활동 | 평가 계획 |"); L.push("|---|---|---|");
        (lp.sessions||[]).forEach(s=>L.push(`| ${s.session} | **${s.topic||""}**<br>${(s.details||[]).map(d=>"· "+d).join("<br>")} | ${s.assessment||""} |`));
      }
      if ((ap.variation||[]).length) { L.push(""); L.push("**문항 변형 방향**"); (ap.variation||[]).forEach(x=>L.push(`- ${x}`)); }
      if ((ap.rubricVariation||[]).length) { L.push(""); L.push("**채점기준표 변형 방향**"); (ap.rubricVariation||[]).forEach(x=>L.push(`- ${x}`)); }
    }
  }
  return L.join("\n");
}

/* ── DOCX(OOXML) 생성 — 한글(HWP)·훈워드·MS워드에서 모두 열림 ── */
function xesc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function dRun(text, o){ o=o||{};
  return '<w:r><w:rPr>'+(o.bold?'<w:b/>':'')+(o.color?'<w:color w:val="'+o.color+'"/>':'')+
    (o.size?'<w:sz w:val="'+o.size+'"/><w:szCs w:val="'+o.size+'"/>':'')+'</w:rPr>'+
    '<w:t xml:space="preserve">'+xesc(text)+'</w:t></w:r>';
}
function dP(text, o){ o=o||{};
  return '<w:p><w:pPr>'+(o.shade?'<w:shd w:val="clear" w:fill="'+o.shade+'"/>':'')+
    '<w:spacing w:before="'+(o.before||0)+'" w:after="'+(o.after==null?80:o.after)+'"/>'+
    (o.center?'<w:jc w:val="center"/>':'')+'</w:pPr>'+
    (Array.isArray(text)?text.join(""):dRun(text,o))+'</w:p>';
}
function dCell(content, o){ o=o||{};
  const paras = Array.isArray(content) ? content.join("") : dP(content,{bold:o.bold,center:o.center,after:40});
  return '<w:tc><w:tcPr>'+(o.w?'<w:tcW w:w="'+o.w+'" w:type="dxa"/>':'')+
    (o.span?'<w:gridSpan w:val="'+o.span+'"/>':'')+
    (o.fill?'<w:shd w:val="clear" w:fill="'+o.fill+'"/>':'')+
    '<w:vAlign w:val="center"/></w:tcPr>'+paras+'</w:tc>';
}
function dTable(rows){
  const borders = ['top','left','bottom','right','insideH','insideV']
    .map(b=>'<w:'+b+' w:val="single" w:sz="6" w:color="777777"/>').join('');
  return '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>'+borders+'</w:tblBorders></w:tblPr>'+
    rows.map(cs=>'<w:tr>'+cs.join("")+'</w:tr>').join("")+'</w:tbl>'+dP("",{after:60});
}
const D_GREEN="3A5A40", D_SOFT="E8EFE6";
function dDrawing(g){ // 문서 본문에 인라인 그림 삽입
  return '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="80"/></w:pPr><w:r><w:drawing>'+
    '<wp:inline distT="0" distB="0" distL="0" distR="0">'+
    '<wp:extent cx="'+g.cx+'" cy="'+g.cy+'"/>'+
    '<wp:docPr id="'+(100+g.id)+'" name="그림'+g.id+'"/>'+
    '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'+
    '<pic:pic>'+
    '<pic:nvPicPr><pic:cNvPr id="'+(100+g.id)+'" name="그림'+g.id+'"/><pic:cNvPicPr/></pic:nvPicPr>'+
    '<pic:blipFill><a:blip r:embed="'+g.rid+'"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'+
    '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="'+g.cx+'" cy="'+g.cy+'"/></a:xfrm>'+
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'+
    '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
}
function dBanner(t){ return dP(t,{bold:true,color:"FFFFFF",size:26,shade:D_GREEN,before:240,after:120}); }
function dHd(t){ return dP(t,{bold:true,color:"2B4531",size:24,before:220,after:80}); }
function dSq(t){ return dP("■ "+t,{bold:true,before:140,after:60}); }
function dBul(list){ return (list||[]).map(x=>dP("• "+x,{after:40})).join(""); }

function buildDocxXml(r, showTeacher){
  const info = r.info||{}; const B=[];
  B.push(dP("서·논술형 평가도구 자료 (과학과)",{color:"2B4531",size:18,after:40}));
  B.push(dBanner(info.toolName||"서·논술형 평가 문항"));
  if (!showTeacher) B.push(dP("(   )학년 (   )반 (   )번    이름: ________________",{after:120}));

  if (showTeacher){
    B.push(dBanner("1. 평가 도구 정보표"));
    const rows=[];
    rows.push([dCell("학교급",{fill:D_SOFT,bold:true,center:true,w:1600}), dCell(info.schoolLevel||"",{w:3200}),
               dCell("과목",{fill:D_SOFT,bold:true,center:true,w:1600}), dCell(info.subject||"",{w:3200})]);
    rows.push([dCell("학년",{fill:D_SOFT,bold:true,center:true}), dCell(info.grade||""),
               dCell("영역(단원)",{fill:D_SOFT,bold:true,center:true}), dCell(info.domain||"")]);
    rows.push([dCell("평가 도구명",{fill:D_SOFT,bold:true,center:true}), dCell([dP(info.toolName||"",{bold:true,after:40})],{span:3})]);
    if (r.standardText)
      rows.push([dCell("성취기준",{fill:D_SOFT,bold:true,center:true}), dCell((r.standardCode?"["+r.standardCode+"] ":"")+r.standardText,{span:3})]);
    (info.achievementLevels||[]).forEach(a=>{
      rows.push([dCell("성취수준 "+a.band,{fill:D_SOFT,bold:true,center:true}), dCell(a.text||"",{span:3})]);
    });
    if (info.purpose) rows.push([dCell("개발 취지",{fill:D_SOFT,bold:true,center:true}), dCell(info.purpose,{span:3})]);
    B.push(dTable(rows));
    if ((info.itemSummary||[]).length){
      const t=[[dCell("문항 번호",{fill:D_SOFT,bold:true,center:true,w:1800}),dCell("문항 유형",{fill:D_SOFT,bold:true,center:true,w:1800}),dCell("성취기준 기반 평가 요소",{fill:D_SOFT,bold:true,center:true})]];
      (info.itemSummary||[]).forEach(s=>t.push([dCell(s.item||"",{center:true}),dCell(s.type||"",{center:true}),dCell([( (s.elements||[]).map(e=>dP("• "+e,{after:20})).join("") )||dP("",{after:20})])]));
      B.push(dTable(t));
    }
  }

  B.push(dBanner(showTeacher?"2. 평가 문항":"평가 문항"));
  (r.items||[]).forEach(it=>{
    B.push(dHd("평가 문항 "+(it.number||"")+"("+(it.type||"논술형")+")"));
    if (it.intro) B.push(dP(it.intro+(it.points?" ("+it.points+"점)":""),{bold:true,after:100}));
    (it.materials||[]).forEach(m=>{
      if (m.body) B.push(dP((m.label?m.label+" ":"")+m.body,{after:100}));
      if (m.__docxImg) {
        B.push(dDrawing(m.__docxImg));
        if (m.label || m.caption)
          B.push(dP("〔"+(m.label||"")+(m.caption?" "+m.caption:"")+"〕",{color:"666666",center:true,after:100}));
      } else if (m.imageData || m.svg || m.svgBlank) {
        B.push(dP("〔"+(m.label||"자료")+" 그림: "+(m.caption||"도식")+" — 그림 변환에 실패해 웹 화면의 인쇄/PDF에서 확인하세요〕",{color:"888888",after:100}));
      }
    });
    normQuestions(it).forEach(q=>{
      B.push(dP((q.label?q.label+" ":"")+(q.stem||"")+(q.points?" ("+q.points+"점)":""),{bold:true,before:100,after:60}));
      const c=q.conditions||{};
      if ((c.content||[]).length||(c.form||[]).length){
        B.push(dP("〈조건〉",{bold:true,after:40}));
        if ((c.form||[]).length){
          B.push(dP("[내용적 측면]",{bold:true,after:20})); B.push(dBul(c.content));
          B.push(dP("[형식적 측면]",{bold:true,after:20})); B.push(dBul(c.form));
        } else B.push(dBul(c.content));
      }
      if (!showTeacher){
        B.push(dP("[답안 작성란]",{color:"888888",after:40}));
        const n = Math.min(14, Math.max(5, (q.points||3)*2));
        for(let k=0;k<n;k++) B.push(dP("＿".repeat(38),{color:"BBBBBB",after:100}));
      }
    });
    if (showTeacher && (it.tips||[]).length){ B.push(dSq("활용 Tip !")); B.push(dBul(it.tips)); }
    const la = it.levelAnalysis||{};
    if (showTeacher && (la.standardElements||la.levelElements||la.rationale)){
      B.push(dSq("수준 설계 해설 (목표 수준 "+(it.targetLevel||"-")+")"));
      const rows=[];
      if (la.standardElements) rows.push("성취기준 내용요소: "+la.standardElements);
      if (la.levelElements) rows.push("해당 수준 내용요소: "+la.levelElements);
      if (la.rationale) rows.push("수준 적합성: "+la.rationale);
      B.push(dBul(rows));
    }
    if (showTeacher) (it.materials||[]).forEach(m=>{
      if ((m.blankSel||[]).length && m.svg){
        try{
          const texts = extractSvgTexts(m.svg);
          const key = [...m.blankSel].sort((a,b)=>a-b).map((idx,k)=>BLANK_SYMS[k]+" "+(texts[idx]||"")).join(" · ");
          B.push(dP((m.label||"자료")+" 빈칸 정답: "+key,{bold:true,color:"7A1E2B",after:100}));
        }catch(_){}
      }
    });
  });

  if (showTeacher){
    B.push(dHd("예시 답안"));
    { const t=[[dCell("문항",{fill:D_SOFT,bold:true,center:true,w:1400}),dCell("예시 답안",{fill:D_SOFT,bold:true,center:true})]];
      (r.items||[]).forEach(it=>normQuestions(it).forEach(q=>{
        t.push([dCell(String(it.number||"")+(q.label?"-"+q.label:""),{center:true}), dCell(q.modelAnswer||"")]);
      })); B.push(dTable(t)); }
    if ((r.items||[]).some(it=>(it.scoring||[]).length)){
      B.push(dHd("채점 기준"));
      const t=[[dCell("문항",{fill:D_SOFT,bold:true,center:true,w:1000}),dCell("채점 요소",{fill:D_SOFT,bold:true,center:true,w:2400}),dCell("점수",{fill:D_SOFT,bold:true,center:true,w:900}),dCell("수행 특성",{fill:D_SOFT,bold:true,center:true})]];
      (r.items||[]).forEach(it=>(it.scoring||[]).forEach(g=>(g.levels||[]).forEach(lv=>{
        t.push([dCell(String(it.number||""),{center:true}),
                dCell((g.question?g.question+" ":"")+(g.element||"")),
                dCell((lv.points!=null?lv.points+"점":""),{center:true}),
                dCell([(dP(lv.criteria||"",{after:20}))+(lv.example?dP("예시 답안: "+lv.example,{color:"666666",after:20}):"")])]);
      }))); B.push(dTable(t));
    }
    if ((r.levelCharacteristics||[]).length){
      B.push(dHd("성취수준별 학생 수행 특성"));
      const t=(r.levelCharacteristics||[]).map(b=>[dCell(b.band||"",{fill:D_SOFT,bold:true,center:true,w:1200}),dCell(b.scoreRange||"",{center:true,w:1500}),dCell(b.text||"")]);
      B.push(dTable(t));
    }
    if ((r.scoringNotes||[]).length){ B.push(dSq("채점 시 유의점")); B.push(dBul(r.scoringNotes)); }
    (r.feedbackCases||[]).forEach((cs,i)=>{
      B.push(dHd(cs.title||("사례 "+(i+1))));
      if (cs.studentAnswer){ B.push(dSq("학생 답안 예시")); B.push(dP(cs.studentAnswer,{after:80})); }
      if ((cs.awarded||[]).length){ B.push(dSq("채점 결과 예시")); B.push(dBul((cs.awarded||[]).map(a=>(a.question?a.question+" ":"")+(a.element||"")+": "+a.points+"점"))); }
      if (cs.feedback){ B.push(dSq("학생 개별 피드백 예시")); B.push(dP(cs.feedback,{after:80})); }
    });
    if ((r.feedbackNotes||[]).length){ B.push(dSq("피드백 제공 시 유의점")); B.push(dBul(r.feedbackNotes)); }
    const ap=r.applicationTip;
    if (ap){
      B.push(dHd("수행평가 적용을 위한 Tip"));
      if ((ap.planIntro||[]).length){ B.push(dSq("교수·학습 및 평가 계획")); B.push(dBul(ap.planIntro)); }
      if (ap.lessonPlan && (ap.lessonPlan.sessions||[]).length){
        const t=[[dCell("차시",{fill:D_SOFT,bold:true,center:true,w:1000}),dCell("교수·학습 활동",{fill:D_SOFT,bold:true,center:true}),dCell("평가 계획",{fill:D_SOFT,bold:true,center:true,w:1800})]];
        (ap.lessonPlan.sessions||[]).forEach(s=>t.push([dCell(s.session||"",{center:true}),
          dCell([dP(s.topic||"",{bold:true,after:20})+((s.details||[]).map(d=>dP("• "+d,{after:20})).join(""))]),
          dCell(s.assessment||"",{center:true})]));
        B.push(dTable(t));
      }
      if ((ap.variation||[]).length){ B.push(dSq("문항 변형 방향")); B.push(dBul(ap.variation)); }
      if ((ap.rubricVariation||[]).length){ B.push(dSq("채점기준표 변형 방향")); B.push(dBul(ap.rubricVariation)); }
    }
  }

  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'+
    ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'+
    ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"'+
    ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'+
    ' xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>'+
    B.join("")+
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>'+
    '</w:body></w:document>';
}

async function downloadDocx(r, showTeacher){
  if (!window.JSZip) { throw new Error("문서 모듈(JSZip)을 불러오지 못했습니다. 인터넷 연결을 확인하고 새로고침해 주세요."); }

  // 도식(SVG)·첨부 그림을 PNG로 변환해 문서에 그림으로 포함
  const imgs = [], tagged = [];
  for (const it of (r.items||[])) {
    for (const m of (it.materials||[])) {
      try{
        let dataUrl = null, w = 600, h = 400;
        if (m.imageData) {
          dataUrl = m.imageData;
          const d = await loadImgDims(dataUrl); w = d.w; h = d.h;
        } else {
          const svg = showTeacher ? (m.svg || m.svgBlank) : (m.svgBlank || m.svg);
          if (svg) { const d = svgDims(svg); w = d.w; h = d.h; dataUrl = await svgToPngDataUrl(svg, 2); }
        }
        if (!dataUrl) continue;
        const base64 = dataUrl.slice(dataUrl.indexOf(",")+1);
        const mime = dataUrl.slice(5, dataUrl.indexOf(";"));
        const ext = mime === "image/jpeg" ? "jpeg" : "png";
        const id = imgs.length + 1;
        const dispW = Math.min(600, w||600);                 // 문서 안 표시 폭(px)
        const cx = Math.round(dispW * 9525);                  // EMU 변환
        const cy = Math.round(dispW * ((h||400)/(w||600)) * 9525);
        imgs.push({ id, base64, ext, rid: "rImg"+id });
        m.__docxImg = { id, rid: "rImg"+id, cx, cy };
        tagged.push(m);
      }catch(_){/* 변환 실패한 자료는 안내문으로 대체 */}
    }
  }

  const zip = new JSZip();
  zip.file("[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
    '<Default Extension="xml" ContentType="application/xml"/>'+
    '<Default Extension="png" ContentType="image/png"/>'+
    '<Default Extension="jpeg" ContentType="image/jpeg"/>'+
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'+
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'+
    '</Types>');
  zip.file("_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'+
    '</Relationships>');
  zip.file("word/_rels/document.xml.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'+
    imgs.map(g=>'<Relationship Id="'+g.rid+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image'+g.id+'.'+g.ext+'"/>').join("")+
    '</Relationships>');
  zip.file("word/styles.xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr>'+
    '<w:rFonts w:ascii="Malgun Gothic" w:eastAsia="Malgun Gothic" w:hAnsi="Malgun Gothic"/>'+
    '<w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>');
  imgs.forEach(g=>zip.file("word/media/image"+g.id+"."+g.ext, g.base64, { base64:true }));
  zip.file("word/document.xml", buildDocxXml(r, showTeacher));
  tagged.forEach(m=>{ delete m.__docxImg; }); // 결과 상태·히스토리 오염 방지
  const blob = await zip.generateAsync({ type:"blob",
    mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const info = r.info||{};
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = ((info.toolName||"평가도구").replace(/[\\/:*?"<>|]/g,"_")) + (showTeacher ? "" : "_학생배부본") + ".docx";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
}

/* ── UI 컴포넌트 ────────────────────────────────────────────── */
function Pill({on, onClick, children, cls}) {
  return <button type="button" aria-pressed={on} className={"pill "+(cls||"")+(on?" on":"")} onClick={onClick}>{children}</button>;
}

/* 올바른 Claude 답변 예시(붙여넣기 안내용) */
const EX_JSON = '{\n  "curriculum": "2022",\n  "info": { "toolName": "…", "subject": "통합과학1", "grade": "1학년", … },\n  "items": [ { "number": 1, "type": "논술형", "intro": "…",\n      "questions": [ … ], "scoring": [ … ] } ],\n  "levelCharacteristics": [ … ],\n  "feedbackCases": [ … ]\n}\n\n※ 위처럼 여는 { 부터 닫는 } 까지 전체가 있어야 합니다.\n※ 코드블록(```)에 싸여 있어도 자동으로 추출합니다.';

/* 성취기준 선택 목록 — 본문 타이핑 시 재렌더 차단(memo) */
const StdList = React.memo(function StdList({subject, filter, selected, onToggle}){
  const all = STANDARDS[subject]||[];
  const f = filter.trim().toLowerCase();
  const list = f ? all.filter(s=>(s.code + " " + s.text + " " + s.area).toLowerCase().includes(f)) : all;
  return (
    <div className="std-list">
      {list.length===0 && <div className="hint" style={{padding:8}}>검색 결과가 없습니다. 다른 키워드로 시도하세요.</div>}
      {list.map(s=>{
        const on = selected.includes(s.code);
        return (
          <div key={s.code} role="checkbox" aria-checked={on} tabIndex={0}
            onKeyDown={e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); onToggle(s.code); } }}
            onClick={()=>onToggle(s.code)}
            className={"std-row"+(on?" is-on":"")}>
            <b>{on?"✓ ":""}[{s.code}]</b> {s.text}
            <span className="std-area">{s.area}</span>
          </div>
        );
      })}
    </div>
  );
}, (p,n)=> p.subject===n.subject && p.filter===n.filter && p.selected===n.selected);

/* 클릭해서 고치는 편집 필드 — 수정이 문서 데이터에 저장된다 */
function Ed({v, editing, onC}){
  const [on, setOn] = useState(false);
  if (!editing) return <React.Fragment>{v}</React.Fragment>;
  if (!on) return (
    <span className="edt" tabIndex={0} title="클릭해서 수정"
      onClick={()=>setOn(true)}
      onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); setOn(true); } }}>
      {v || "(비어 있음 — 클릭해 입력)"}
    </span>
  );
  return (
    <textarea className="edt-input" defaultValue={v} autoFocus
      onBlur={e=>{ setOn(false); const nv=e.target.value; if(nv!==v && onC) onC(nv); }}
      onKeyDown={e=>{ if(e.key==="Escape") setOn(false); }} />
  );
}

function EmptyDoc({subject, targets, hasInput, runMode}){
  const nextTitle = hasInput
    ? (runMode==="paste" ? "Claude에서 만든 답변을 가져오세요" : "평가 문서를 만들 준비가 되었습니다")
    : "출제 자료를 입력하세요";
  const nextText = hasInput
    ? (runMode==="paste"
        ? "Claude용 요청문을 복사한 뒤, 받은 답변을 4단계에 붙여넣으세요."
        : "4단계에서 평가 문서 만들기를 실행하세요.")
    : "2단계에서 성취기준, 기존 문항 또는 수업 자료를 입력하세요.";
  return (
    <div className="emptydoc noprint">
      <div className="empty-sheet-head" aria-hidden="true"><span></span><span></span><span></span></div>
      <div className="empty-content">
        <div className="empty-eyebrow">결과 미리보기</div>
        <h2 className="empty-title">{nextTitle}</h2>
        <p className="ed-desc">{nextText}</p>
        <dl className="ready-grid">
          <div><dt>과목</dt><dd>{subject!=="자동" ? subject : "지정하지 않음"}</dd></div>
          <div><dt>목표 성취수준</dt><dd>{targets.length ? targets.join(" · ")+" 수준" : "지정하지 않음"}</dd></div>
          <div><dt>출제 자료</dt><dd className={hasInput?"ready-ok":"ready-needed"}>{hasInput ? "입력 완료" : "입력 필요"}</dd></div>
        </dl>
      </div>
    </div>
  );
}

function SkeletonDoc({sec}){
  return (
    <div className="skeldoc noprint" role="status" aria-live="polite">
      <div className="sk" style={{height:26,width:"55%"}}></div>
      <div className="sk" style={{height:12,width:"30%",marginBottom:24}}></div>
      <div className="sk" style={{height:12,width:"100%"}}></div>
      <div className="sk" style={{height:12,width:"96%"}}></div>
      <div className="sk" style={{height:12,width:"88%",marginBottom:24}}></div>
      <div className="sk" style={{height:120,width:"100%",marginBottom:24}}></div>
      <div className="sk" style={{height:12,width:"92%"}}></div>
      <div className="sk" style={{height:12,width:"84%",marginBottom:24}}></div>
      <div className="sk" style={{height:90,width:"100%"}}></div>
      <p className="skmsg">평가 문서를 만들고 있습니다. {sec}초 경과</p>
    </div>
  );
}

function App() {
  const [apiKey, setApiKey]   = useState(()=>localStorage.getItem("gemini_key")||"");
  const [model, setModel]     = useState(()=>{
    const saved = localStorage.getItem("gemini_model");
    // 새 키에 막혀 있는 구 기본값은 안전한 모델로 자동 교체
    if (!saved || saved === "gemini-2.5-flash") return "gemini-2.0-flash";
    return saved;
  });
  const [subject, setSubject] = useState("자동");
  const [selectedStds, setSelectedStds] = useState([]); // 선택한 실제 성취기준 코드(복수)
  const [stdFilter, setStdFilter] = useState("");       // 성취기준 검색 필터
  const [targets, setTargets] = useState([]);          // 타겟 수준 다중선택
  const [targetMsg, setTargetMsg] = useState("");      // 타겟 선택 상한 안내
  const [mode, setMode]       = useState("standard");
  const [text, setText]       = useState("");
  const [images, setImages]   = useState([]);
  const [format, setFormat]   = useState("자동");
  const [style, setStyle]     = useState("");
  const [visual, setVisual]   = useState("auto");
  const [mono, setMono]       = useState(true);   // 흑백 인쇄용 (기본 켬)
  const [blankVer, setBlankVer] = useState(false); // 빈칸 변형(㉠㉡ 도식 완성형)
  const [count, setCount]     = useState(1);
  const [countStr, setCountStr] = useState("1");   // 입력 중간 상태(키보드 입력 허용)
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [result, setResult]   = useState(null);
  const [showTeacher, setShowTeacher] = useState(true);
  const [copied, setCopied]   = useState(false);
  const [runMode, setRunMode] = useState(()=>localStorage.getItem("run_mode")||"paste"); // "paste"=claude.ai(Pro/Max) · "api"=Gemini
  const [showRunCfg, setShowRunCfg] = useState(false); // 실행 방식 설정(기본 접힘)
  const [promptCopied, setPromptCopied] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [mobileTab, setMobileTab]     = useState("form");  // 모바일: 설정/결과 탭
  const [advOpen, setAdvOpen]         = useState(false);    // 고급 문항 설정 접기
  const [inputErr, setInputErr]       = useState("");       // 입력 자료 인라인 오류
  const [showEx, setShowEx]           = useState(false);    // 올바른 답변 예시
  const [modelList, setModelList]     = useState([]);   // 키로 조회한 사용 가능 모델
  const [modelLoading, setModelLoading] = useState(false);
  const [modelMsg, setModelMsg]       = useState("");
  // 실생활 자료(네이버 뉴스/블로그) 검색 — 선택형(기본 사용 안 함)
  const [useNews, setUseNews]         = useState(false);
  const [newsQuery, setNewsQuery]     = useState("");
  const [newsType, setNewsType]       = useState("news"); // news | blog(칼럼·에세이)
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsResults, setNewsResults] = useState([]);
  const [newsMsg, setNewsMsg]         = useState("");
  const [articles, setArticles]       = useState([]);     // 선택한 실생활 자료
  const [loadSec, setLoadSec]         = useState(0);      // 생성 경과 시간(초)
  const HKEY = "eval_history_v1";
  const [historyList, setHistoryList] = useState(()=>{ try{ return JSON.parse(localStorage.getItem(HKEY)||"[]"); }catch(_){ return []; } });

  useEffect(()=>{ localStorage.setItem("run_mode", runMode); }, [runMode]);

  useEffect(()=>{ if(apiKey) localStorage.setItem("gemini_key", apiKey); }, [apiKey]);
  useEffect(()=>{ localStorage.setItem("gemini_model", model); }, [model]);

  // 생성 경과 시간 표시
  useEffect(()=>{
    if (!loading) { setLoadSec(0); return; }
    const t = setInterval(()=>setLoadSec(s=>s+1), 1000);
    return ()=>clearInterval(t);
  }, [loading]);

  // 결과 자동 저장(브라우저 localStorage, 최근 10건)
  function saveToHistory(r){
    try{
      let slim = r;
      try{
        slim = JSON.parse(JSON.stringify(r));
        (slim.items||[]).forEach(it=>(it.materials||[]).forEach(m=>{ delete m.imageData; delete m.__docxImg; }));
      }catch(_){ slim = r; }
      const s = JSON.stringify(slim);
      if (s.length > 1500000) return; // 너무 크면 저장 생략(용량 보호)
      if (historyList[0] && JSON.stringify(historyList[0].data) === s) return; // 중복 방지
      const entry = { ts: Date.now(), name: (r.info&&r.info.toolName)||"평가도구",
        subject: (r.info&&r.info.subject)||"", data: slim };
      const next = [entry, ...historyList].slice(0,10);
      localStorage.setItem(HKEY, JSON.stringify(next));
      setHistoryList(next);
    }catch(_){/* 용량 초과 등은 무시 */}
  }
  function importHistoryFile(e){
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = ()=>{
      try{
        const j = JSON.parse(rd.result);
        const data = j && j.data && j.data.items ? j.data : (j && j.items ? j : null);
        if (!data) throw new Error();
        setResult(attachImages(JSON.parse(JSON.stringify(data))));
        setError(""); saveToHistory(data);
      }catch(_){ setError("JSON 파일을 해석하지 못했습니다. 이 앱에서 백업한 파일인지 확인하세요."); }
    };
    rd.readAsText(f); e.target.value = "";
  }
  function deleteHistory(i){
    const next = historyList.filter((_,x)=>x!==i);
    setHistoryList(next);
    try{ localStorage.setItem(HKEY, JSON.stringify(next)); }catch(_){}
  }

  // 성취기준 복수 선택 토글 — 자동 채움은 사용자가 직접 쓴 입력을 덮어쓰지 않는다
  const autoTextRef = useRef("");
  const textRef = useRef(text); textRef.current = text;
  function toggleStd(code){
    setSelectedStds(prev=>{
      const next = prev.includes(code) ? prev.filter(c=>c!==code) : [...prev, code];
      const arr = (STANDARDS[subject]||[]).filter(s=>next.includes(s.code));
      const auto = arr.map(s=>`[${s.code}] ${s.text}`).join("\n");
      const cur = textRef.current;
      if (arr.length && (cur.trim()==="" || cur===autoTextRef.current)) {
        setMode("standard"); setText(auto); autoTextRef.current = auto;
      }
      return next;
    });
  }

  const MAX_ITEMS = 4; // 문항 수 상한(타겟 수준 선택 상한과 동일)

  function reducedMotion(){
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  // 결과 도착 시: 모바일은 결과 탭으로, 데스크톱은 결과 패널로 포커스 이동
  function afterResult(){
    setMobileTab("preview");
    setTimeout(()=>{
      const el = document.getElementById("panel-prev");
      if (!el) return;
      el.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
      el.focus({ preventScroll: true });
    }, 120);
  }
  // 필수 입력 검증: 인라인 오류 + 해당 입력란으로 스크롤·포커스
  function requireInput(){
    if (text.trim() || images.length) { setInputErr(""); return true; }
    setInputErr("문항 제작에 사용할 내용을 입력하거나 참고 자료를 첨부하세요.");
    setError("2단계에서 출제 자료를 입력하세요.");
    setMobileTab("form");
    setTimeout(()=>{
      const el = document.getElementById("mainInput");
      if (el){
        el.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
        el.focus({ preventScroll: true });
      }
    }, 80);
    return false;
  }
  function toggleTarget(l){
    setTargets(t=>{
      if (t.includes(l)) { setTargetMsg(""); return t.filter(x=>x!==l); }
      if (t.length >= MAX_ITEMS) {
        setTargetMsg(`목표 성취수준은 최대 ${MAX_ITEMS}개까지 선택할 수 있습니다. 다른 수준을 해제한 뒤 선택하세요.`);
        return t;
      }
      setTargetMsg(""); return [...t, l];
    });
  }

  // API 키로 사용 가능한 모델 목록 조회 (generateContent 지원 모델만)
  async function fetchModels(auto) {
    setModelMsg("");
    const key = apiKey.trim();
    if (!key) { setModelMsg("먼저 API 키를 입력하세요."); return; }
    setModelLoading(true);
    try {
      let names = [], pageToken = "";
      do {
        const url = "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key="
          + encodeURIComponent(key) + (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : "");
        const res = await fetch(url);
        if (!res.ok) {
          let m = "모델 목록을 불러오지 못했습니다 (" + res.status + ").";
          if (res.status === 400 || res.status === 403) m = "API 키가 올바르지 않거나 권한이 없습니다. 키를 확인하세요.";
          try { const e = await res.json(); if (e.error && e.error.message) m += " " + e.error.message; } catch(_){}
          throw new Error(m);
        }
        const data = await res.json();
        (data.models || []).forEach(mo => {
          const methods = mo.supportedGenerationMethods || [];
          if (methods.includes("generateContent")) {
            names.push((mo.name || "").replace(/^models\//, ""));
          }
        });
        pageToken = data.nextPageToken || "";
      } while (pageToken);

      // 최신 버전 → 무료 등급 친화(flash) 순으로 정렬 (3.5 > 2.5 > 2.0 …, flash 우선)
      const ver = n => { const m = n.match(/(\d+)\.(\d+)/); return m ? (parseInt(m[1],10)*100 + parseInt(m[2],10)) : 0; };
      const pr  = n => (/flash-lite/.test(n)?1 : /flash/.test(n)?0 : /pro/.test(n)?2 : 3); // 무료 한도 넉넉한 flash 우선
      names = Array.from(new Set(names)).sort((a, b) => ver(b)-ver(a) || pr(a)-pr(b) || a.localeCompare(b));

      if (!names.length) { setModelMsg("이 키로 사용할 수 있는 모델을 찾지 못했습니다."); }
      else {
        setModelList(names);
        // 자동 조회(키 입력 직후)면 최신 flash 선택, 수동 새로고침이면 유효할 때 현재 선택 유지
        if (auto || !names.includes(model)) setModel(names[0]);
        setModelMsg("사용 가능한 모델 " + names.length + "개를 불러왔습니다. 최신 모델을 자동 선택했습니다.");
      }
    } catch(e) {
      setModelList([]);
      setModelMsg(e.message || String(e));
    } finally {
      setModelLoading(false);
    }
  }

  // HTML 태그·엔티티 제거(네이버 응답은 <b>…</b> 등이 섞여 있음)
  function stripTags(s){
    return (s||"").replace(/<[^>]*>/g,"")
      .replace(/&quot;/g,'"').replace(/&amp;/g,"&").replace(/&lt;/g,"<")
      .replace(/&gt;/g,">").replace(/&#39;/g,"'").replace(/&apos;/g,"'").replace(/&nbsp;/g," ");
  }

  // 실생활 자료 검색 (서버리스 함수 /api/naver-news 경유)
  async function searchNews(){
    setNewsMsg("");
    if(!newsQuery.trim()){ setNewsMsg("검색어를 입력하세요. 예: 기후변화, 감염병, 미세먼지"); return; }
    setNewsLoading(true);
    try{
      const r = await fetch("/api/naver-news?query=" + encodeURIComponent(newsQuery.trim())
        + "&type=" + newsType + "&display=10&sort=sim");
      let data = {};
      try { data = await r.json(); } catch(_){}
      if(!r.ok){ throw new Error(data.error || ("검색에 실패했습니다 (" + r.status + ").")); }
      const items = (data.items||[]).map(it=>{
        const link = it.originallink || it.link || "";
        return {
          title: stripTags(it.title),
          desc: stripTags(it.description),
          link,
          source: link.replace(/^https?:\/\//,"").split("/")[0],
          date: (it.pubDate || it.postdate || "").trim(),
        };
      });
      setNewsResults(items);
      if(!items.length) setNewsMsg("검색 결과가 없습니다. 다른 검색어로 시도하세요.");
    }catch(e){
      setNewsResults([]);
      setNewsMsg((e.message||String(e)) + " (배포된 사이트에서만 동작하며, 관리자가 Vercel에 네이버 API 키를 설정해야 합니다.)");
    }finally{ setNewsLoading(false); }
  }
  function toggleArticle(a){
    setArticles(prev=> prev.some(x=>x.link===a.link) ? prev.filter(x=>x.link!==a.link) : [...prev, a]);
  }

  function onFiles(e){
    const files = Array.from(e.target.files||[]);
    files.forEach(f=>{
      const isImg = (f.type||"").startsWith("image/");
      const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
      if (!isImg && !isPdf) { setError("이미지 또는 PDF 파일만 올릴 수 있습니다: " + f.name); return; }
      if (f.size > 18*1024*1024) { setError("파일이 너무 큽니다(18MB 초과): " + f.name + ". 필요한 페이지만 잘라 올리거나 용량을 줄여주세요."); return; }
      const reader = new FileReader();
      reader.onload = ()=>{
        const res = reader.result;       // data:<mime>;base64,xxxx
        const mime = res.substring(5, res.indexOf(";"));
        const data = res.substring(res.indexOf(",")+1);
        setImages(prev=>[...prev, { mime, data, url:res, name:f.name, kind: isPdf ? "pdf" : "image" }]);
      };
      reader.readAsDataURL(f);
    });
    e.target.value = ""; // 같은 파일 재선택 허용
  }
  function removeImage(i){ setImages(prev=>prev.filter((_,idx)=>idx!==i)); }
  function toggleAsMaterial(i){ setImages(prev=>prev.map((x,idx)=>idx===i?{...x, asMaterial:!x.asMaterial}:x)); }

  // 결과의 materials.imageIndex → 첨부 이미지 원본을 문서에 삽입
  function attachImages(r){
    try{
      (r.items||[]).forEach(it=>(it.materials||[]).forEach(m=>{
        if (m.imageIndex && images[m.imageIndex-1] && images[m.imageIndex-1].kind!=="pdf") {
          m.imageData = images[m.imageIndex-1].url;
        }
      }));
    }catch(_){}
    return r;
  }

  function buildPrompt() {
    const P = [];
    const modeText = {
      standard:"아래에 주어진 성취기준(및 성취수준)을 바탕으로 KICE 서·논술형 평가도구 자료 한 편을 제작하라.",
      convert:"아래에 주어진 지필/선다형/단답형/학력평가 문항을 같은 성취기준·개념을 유지한 채 서·논술형 문항으로 변환하고, KICE 평가도구 자료 한 편으로 완성하라.",
      transform:"아래에 주어진 논술형 문항을 평가 의도는 유지하되 소재·맥락을 바꾸어 변형하고, KICE 평가도구 자료 한 편으로 완성하라.",
      idea:"아래에 주어진 아이디어·주제·키워드를 바탕으로 KICE 서·논술형 평가도구 자료 한 편을 제작하라.",
    }[mode];
    P.push(modeText);
    // 여러 타겟 수준을 고르면 각 수준마다 최소 1개 문항을 보장 → 문항 수를 수준 개수까지 자동 확대(상한 4)
    const effCount = Math.min(MAX_ITEMS, targets.length ? Math.max(count, targets.length) : count);
    P.push(`제작할 문항 수: ${effCount}개. (필요하면 각 문항 안에 하위 문항 (1), (2)를 구성해도 된다.)`);

    if (subject !== "자동") {
      const cur = SUBJECTS.find(s=>s.v===subject);
      const higher = SUBJECTS.filter(s=>s.lv > cur.lv).map(s=>s.v);
      P.push(`대상 과목: '${subject}'. 이 과목의 학습 범위 안에서만 출제하고, 상위/심화 과목(${higher.join(", ")})에서 처음 도입되는 개념은 자료·문항·조건·예시 답안에서 배제하라(선행학습 방지). 배제한 상위 개념을 hierarchyBlock에 기술하라.`);
    } else {
      P.push("대상 과목: 자동. 성취기준에서 수준을 추정해 출제하되 위계 통제는 적용하지 않는다(hierarchyBlock는 '').");
    }

    // 선택된 실제 성취기준·성취수준(공식 원문)을 그대로 사용하도록 강제 (복수 가능)
    const stds = (STANDARDS[subject]||[]).filter(s=>selectedStds.includes(s.code));
    if (stds.length) {
      const blocks = stds.map(std=>{
        const lv = std.levels.map(l=>`  - ${l.level}: ${l.text}`).join("\n");
        return `[공식 성취기준 (원문 그대로 사용)]\n[${std.code}] ${std.text}\n소속 영역: ${std.area}\n` +
               `[공식 성취수준 (원문 그대로 사용 — 절대 새로 지어내지 말 것)]\n${lv}`;
      }).join("\n\n");
      P.push(
        blocks + "\n→ standardCode·standardText·info.domain·info.achievementLevels는 위 공식 원문을 그대로 옮겨라(요약·변형 금지). " +
        (stds.length>1
          ? `성취기준이 ${stds.length}개다: 이들을 통합·연계한 문항으로 설계하고, standardCode에는 모든 코드를 ', '로 연결해 적고 standardText도 각 성취기준을 병기하며, info.achievementLevels에는 코드별 수준 기술을 구분해 담아라. `
          : "") +
        "채점기준·성취수준별 수행 특성도 이 공식 성취수준의 표현·위계와 일관되게 작성하라."
      );
    }

    if (targets.length) {
      if (targets.length === 1) {
        P.push(`각 문항의 타겟 성취수준: ${targets[0]}. 모든 문항을 이 수준으로 설계하라. 타겟이 C인 문항이라면 A·B·C 수준 학생은 해결하고 D·E 수준 학생은 해결하지 못하는 변별점을 갖도록 최소능력자 기준으로 설계하라. 각 문항 levelAnalysis에 근거를 적어라.`);
      } else {
        P.push(`타겟 성취수준: ${targets.join(", ")} (${targets.length}개 선택). 반드시 선택된 각 수준마다 최소 1개 이상의 문항을 배정하라. 총 ${effCount}개 문항 중 ${targets.join("·")} 수준을 각각 최소 1회 포함하고, 남는 문항이 있으면 이 수준들에 고르게 추가 배분하라. 문항마다 그 문항이 겨냥하는 수준을 targetLevel에 명시하고, 어떤 수준의 문항인지 알 수 있게 하라. 예를 들어 타겟이 C인 문항은 A·B·C 수준 학생은 해결하고 D·E 수준 학생은 해결하지 못하는 변별점을 최소능력자 기준으로 설계하라. 각 문항 levelAnalysis에 배정 수준과 변별 근거를 적어라.`);
      }
    } else {
      P.push("타겟 성취수준: 자동(난이도를 고르게 분포). 각 문항에 적절한 targetLevel을 지정하라.");
    }

    P.push("발문 작성: 모든 발문을 반응 지시어(요약·분류·구분·비교·대조·제시·설명·분석·평가·논증·서술 등)로 끝맺고, 그 지시어의 인지 활동에 맞게 설계하라. 각 문항 directive에 사용한 지시어를 명시하라.");
    P.push("조건 최소화: 가급적 문항별 조건(conditions)을 넣지 말고 발문만으로 요구가 분명하게 하라. 분량 제한 등 꼭 필요한 경우에만 최소한으로 넣고, 없으면 conditions.content·conditions.form을 빈 배열([])로 둬라.");

    P.push(format==="자동" ? "문항 형식: 내용에 맞게 자동 선택." : `문항 형식: '${format}'으로 고정.`);

    if (visual === "none") {
      P.push("그림자료: 생성하지 말라(materials의 svg는 모두 null).");
    } else {
      P.push(visual==="always" ? "그림자료: 적절한 자료 상자에 SVG 도식을 반드시 생성하라."
                               : "그림자료: 자료가 필요한 경우에만 SVG 도식을 생성하라.");
      P.push(mono
        ? "[인쇄 설정] 흑백 인쇄용. 모든 SVG는 무채색만 사용한다(#000000, #333333, #666666, #999999, #cccccc, #f2f2f2, 흰색). 컬러 금지. 구분이 필요하면 명도 차·상자 채움 톤(흰/연회색)·선 굵기·점선으로 표현하라."
        : "[인쇄 설정] 컬러. 상자 채움은 연한 톤(#f4f1ea, #e8efe6, #e4ecf5), 테두리·글자·화살표는 진한 톤(#3a5a40, #333333)으로 3~4색 이내.");
      if (blankVer) {
        P.push("[빈칸 변형 — 필수] 각 SVG 그림자료마다 완성본(svg)과 함께, 상자 속 핵심 용어 2~4개를 ㉠, ㉡, ㉢ … 빈칸으로 바꾼 빈칸본(svgBlank)을 만들어라. 빈칸은 밑줄 친 기호(예: '㉠' 뒤에 밑줄 공간)나 빈 상자로 표시하고, 빈칸 외의 모든 요소·좌표는 완성본과 동일해야 한다. 빈칸으로 바꾼 용어의 부연 설명 줄이 정답 힌트가 되면 부연도 함께 가리거나 일반화하라. 최소 한 문항(또는 하위 문항)은 '도식의 ㉠~㉢에 들어갈 내용을 쓰고, 그 근거를 서술'하게 하라. 예시 답안과 채점 기준에 각 빈칸의 정답을 반드시 포함하라.");
      }
    }

    if (style.trim()) P.push(`추가 스타일/요청: ${style.trim()}`);
    if (images.length) {
      const nPdf = images.filter(x=>x.kind==="pdf").length;
      const nImg = images.length - nPdf;
      const parts = [];
      if (nImg) parts.push(`사진 ${nImg}장`);
      if (nPdf) parts.push(`PDF ${nPdf}개(보고서·활동자료 등)`);
      P.push(`첨부 자료(${parts.join(", ")})가 있다. 첨부된 사진·PDF의 내용·자료·표·그림·데이터를 읽어 성취기준·과목 범위에 맞는 논술형 평가 문항의 근거로 반영하라. PDF에 담긴 실험 결과·보고서·활동 내용을 제시문·자료로 활용하고, 최소 한 문항 이상이 그 자료를 직접 분석·해석해야 풀리도록 설계하라.`);
      const mats = images.map((x,i)=>({ ...x, idx:i+1 })).filter(x=>x.asMaterial && x.kind!=="pdf");
      if (mats.length) {
        P.push(`그중 ${mats.map(m=>`${m.idx}번째 이미지(${m.name})`).join(", ")}는 문서에 원본 그대로 그림자료로 삽입된다. 이 이미지를 SVG로 다시 그리지 말고, materials 항목에 "imageIndex"(첨부 순번)로 참조하라(label·caption 작성, svg는 null). 최소 한 문항이 이 그림의 내용을 직접 분석·해석해야 풀리도록 발문을 설계하라.`);
      }
    }

    if (useNews && articles.length) {
      const A = articles.map((a,i)=>`(${i+1}) ${a.title}${a.source?` — ${a.source}`:""}${a.date?` · ${a.date}`:""}\n    ${a.desc}\n    출처: ${a.link}`).join("\n");
      P.push(
        `[실생활 자료 (신문기사·칼럼) — 제시문·발문의 근거로 활용]\n${A}\n` +
        `→ 위 실생활 자료를 바탕으로 제시문(materials)을 구성하고, 최소 한 문항 이상이 이 자료를 직접 분석·해석해야만 풀리도록 발문·조건을 설계하라. ` +
        `제시문 말미에 출처를 "– 매체명, 날짜" 형식으로 표기하라. 자료의 사실을 왜곡하지 말고, 학생 수준에 맞게 요약·재구성하되 핵심 내용과 맥락은 유지하라. ` +
        `제공된 자료가 성취기준·과목 범위와 맞지 않는 부분은 제외하라.`
      );
    }

    P.push("\n[입력 내용]\n" + (text.trim() || "(텍스트 입력 없음 — 첨부 이미지를 근거로 작업하라.)"));
    return P.join("\n");
  }

  // Gemini API 자동 호출 모드
  async function generate() {
    setError(""); setResult(null);
    if (!apiKey.trim()) {
      setError("상단 작업 방식에서 Gemini API 키를 입력하세요.");
      setShowRunCfg(true);
      setTimeout(()=>{
        const el = document.getElementById("apiKey");
        if (el) { el.focus(); el.scrollIntoView({block:"center",behavior:"smooth"}); }
      }, 150);
      return;
    }
    if (!requireInput()) return;
    setLoading(true);
    try {
      const { raw, stop } = await callGemini({
        apiKey: apiKey.trim(), model: model.trim(), system: GUIDE,
        userText: buildPrompt(), images,
        maxTokens: 32000,
      });
      const bigTip = "\n\n해결 방법\n1. 문항 수를 1개로 줄입니다.\n2. 도식·그림을 '포함하지 않음'으로 바꿉니다.\n3. 출력 한도가 큰 Gemini 모델을 선택합니다.\n4. 같은 문제가 계속되면 'Claude에 요청문 붙여넣기' 작업 방식을 사용합니다.";
      let parsed = null;
      try { parsed = parseResult(raw); } catch(_){}
      if (parsed) {
        attachImages(parsed);
        setResult(parsed);
        saveToHistory(parsed);
        afterResult();
        if (stop === "MAX_TOKENS") {
          setError("출력이 모델의 최대 길이에 도달해 예시답안, 채점기준, 피드백 일부가 빠졌을 수 있습니다." + bigTip + "\n\n현재 모델: " + model);
        }
      } else {
        if (stop === "MAX_TOKENS") {
          throw new Error("출력이 모델의 최대 길이에서 잘려 문서를 해석하지 못했습니다 (현재 모델: " + model + ")." + bigTip);
        }
        throw new Error("결과(JSON) 해석에 실패했습니다 (응답 종료 사유: " + (stop || "알 수 없음") + ")." + bigTip);
      }
    } catch(e) {
      const kind = e.kind;
      const paste = "\n\n무료 API 키의 사용량 또는 정책 제한일 수 있습니다. 상단 [작업 방식]에서 'Claude에 요청문 붙여넣기'를 선택하면 Gemini API 키 없이 작업할 수 있습니다. Gemini를 계속 사용하려면 Google AI Studio에서 결제 설정과 사용 한도를 확인하세요.";
      if (kind === "model_unavailable" && model.trim() !== "gemini-2.0-flash") {
        setModel("gemini-2.0-flash");
        setError((e.message || "") + "\n\n모델을 gemini-2.0-flash로 변경했습니다. 「평가 문서 만들기」를 다시 눌러 주세요.");
      } else if (kind === "quota" || kind === "model_unavailable") {
        setError((e.message || String(e)) + paste);
      } else {
        setError(e.message || String(e));
      }
    } finally {
      setLoading(false);
    }
  }

  // claude.ai 붙여넣기 모드 (Pro/Max, API 불필요)
  function copyPromptForClaude() {
    setError("");
    if (!requireInput()) return;
    const full =
      GUIDE +
      "\n\n========== 작업 지시 ==========\n" +
      buildPrompt() +
      (images.length ? "\n\n※ 사진·PDF 자료는 Claude 대화에 직접 첨부합니다. 첨부한 자료의 내용을 근거로 작업하세요." : "") +
      "\n\n반드시 위 [출력 형식]의 JSON 객체 하나만 출력하세요. 코드블록이나 설명 문장은 넣지 마세요.";
    navigator.clipboard.writeText(full).then(()=>{
      setPromptCopied(true); setTimeout(()=>setPromptCopied(false), 2000);
    }).catch(()=>setError("클립보드 복사에 실패했습니다. 브라우저의 클립보드 권한을 확인해 주세요."));
  }

  function showPasted() {
    setError("");
    if (!pasteText.trim()) { setError("Claude의 답변 전체를 붙여넣으세요."); return; }
    try {
      const p = attachImages(parseResult(pasteText));
      setResult(p); saveToHistory(p); afterResult();
    } catch(e) {
      setError("답변 형식을 읽지 못했습니다. Claude의 답변을 처음부터 끝까지 다시 복사해 붙여넣으세요.\n\n문제 해결: 답변 안에 중괄호로 묶인 결과 데이터가 포함되어 있어야 합니다. 코드 블록은 그대로 붙여넣어도 됩니다. 기존에 표시된 문서는 유지됩니다.");
    }
  }

  // 붙여넣는 즉시 자동 인식(성공하면 바로 문서 표시)
  function onPasteChange(v){
    setPasteText(v);
    if (v.trim().length > 80 && v.includes('"items"')) {
      try {
        const p = attachImages(parseResult(v));
        setResult(p); setError(""); saveToHistory(p); afterResult();
      } catch(_){/* 아직 불완전하면 무시 — ③ 버튼으로 수동 시도 가능 */}
    }
  }

  function copyMd() {
    if (!result) return;
    const md = toMarkdown(result, showTeacher);
    navigator.clipboard.writeText(md).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),1500); }).catch(()=>setError("클립보드 복사에 실패했습니다. 브라우저의 클립보드 권한을 확인해 주세요."));
  }

  // 과목 그룹핑 (드롭다운 optgroup)
  const groups = SUBJECTS.reduce((m,s)=>{ (m[s.group]=m[s.group]||[]).push(s); return m; }, {});

  return (
    <div className="wrap">
      <header className="app noprint">
        <div className="mast">
          <div>
            <h1>논술형 평가 문항 설계</h1>
            <p>성취기준과 수업 자료를 바탕으로 문항, 채점기준, 피드백 예시를 설계합니다.</p>
          </div>
          <div className="stamp" aria-hidden="true">
            <span className="s1">과학과</span><span>2022 개정</span><span>서·논술형</span>
          </div>
        </div>
      </header>

      {/* 실행 환경 */}
      <div className="envline noprint">
        <span className="env-l">작업 방식</span>
        <b>{runMode==="paste" ? "Claude 새 대화에서 문항 만들기" : "Gemini API로 바로 만들기"}</b>
        <button className="btn ghost env-change"
          onClick={()=>setShowRunCfg(!showRunCfg)} aria-expanded={showRunCfg}>
          {showRunCfg ? "닫기" : "작업 방식 변경"}
        </button>
      </div>
      {showRunCfg &&
        <div className="envcfg noprint">
          <div className="pills">
            <Pill on={runMode==="paste"} onClick={()=>setRunMode("paste")}>Claude에 요청문 붙여넣기</Pill>
            <Pill on={runMode==="api"} onClick={()=>setRunMode("api")}>Gemini API로 바로 만들기</Pill>
          </div>
          <div className="hint">
            {runMode==="paste"
              ? "요청문을 Claude에 붙여넣고, 받은 답변을 이 화면으로 가져옵니다. API 키는 필요하지 않습니다."
              : "개인 Gemini API 키를 사용해 이 화면에서 평가 문서를 만듭니다."}
          </div>
          {runMode==="api" &&
            <div style={{marginTop:14,borderTop:"1px dashed var(--line)",paddingTop:14}}>
              <div className="row" style={{alignItems:"flex-end"}}>
                <div style={{flex:2}}>
                  <label className="fld" htmlFor="apiKey">Gemini API 키 (AIza…)</label>
                  <input id="apiKey" type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)}
                    onBlur={()=>{ if(apiKey.trim().length>20 && !modelList.length && !modelLoading) fetchModels(true); }}
                    placeholder="AIza..." />
                </div>
                <div style={{flex:"0 0 auto"}}>
                  <button className="btn sec" onClick={()=>fetchModels(false)} disabled={modelLoading} style={{whiteSpace:"nowrap"}}>
                    {modelLoading ? "불러오는 중…" : "모델 목록 확인"}
                  </button>
                </div>
              </div>
              <div style={{marginTop:12}}>
                <label className="fld">모델</label>
                {modelList.length > 0
                  ? <select value={modelList.includes(model)?model:"__custom__"}
                      onChange={e=>{ if(e.target.value!=="__custom__") setModel(e.target.value); }}>
                      {modelList.map(m=><option key={m} value={m}>{m}</option>)}
                      <option value="__custom__">직접 입력…</option>
                    </select>
                  : <input type="text" value={model} onChange={e=>setModel(e.target.value)}
                      placeholder="gemini-2.5-flash" />}
                {modelList.length > 0 && !modelList.includes(model) &&
                  <input type="text" value={model} onChange={e=>setModel(e.target.value)}
                    placeholder="모델명 직접 입력 (예: gemini-2.5-flash)" style={{marginTop:8}} />}
              </div>
              {modelMsg && <div className="hint" style={{color: /불러왔습니다/.test(modelMsg)?"var(--ui-success)":"var(--ui-danger)", fontWeight:600}}>{modelMsg}</div>}
              <div className="hint">
                API 키는 이 브라우저에만 저장됩니다. 모델 목록을 불러오거나 문서를 만들 때 Google Gemini API 호출에 사용됩니다. 발급: aistudio.google.com.
                {apiKey && <a href="#" style={{marginLeft:8,color:"var(--warn)"}} onClick={ev=>{ev.preventDefault(); setApiKey(""); setModelList([]); setModelMsg(""); localStorage.removeItem("gemini_key");}}>키 지우기</a>}
              </div>
            </div>}
        </div>}

      {/* 모바일: 설정/결과 탭 */}
      <div className="mtabs noprint" role="tablist" aria-label="설정과 결과 전환">
        <button type="button" role="tab" id="tab-form" aria-selected={mobileTab==="form"} aria-controls="panel-form"
          tabIndex={mobileTab==="form"?0:-1}
          onKeyDown={e=>{ if(e.key==="ArrowLeft"||e.key==="ArrowRight"){ e.preventDefault(); setMobileTab("preview"); } }}
          onClick={()=>setMobileTab("form")}>설정</button>
        <button type="button" role="tab" id="tab-prev" aria-selected={mobileTab==="preview"} aria-controls="panel-prev"
          tabIndex={mobileTab==="preview"?0:-1}
          onKeyDown={e=>{ if(e.key==="ArrowLeft"||e.key==="ArrowRight"){ e.preventDefault(); setMobileTab("form"); } }}
          onClick={()=>setMobileTab("preview")}>결과 미리보기{result && <><span className="tab-status" aria-hidden="true">결과 있음</span><span className="sr">결과가 있습니다</span></>}</button>
      </div>

      <div className={"workbench"+(mobileTab==="preview"?" show-preview":"")}>
      <aside className="tools noprint" id="panel-form" role="tabpanel" aria-labelledby="tab-form">

      {/* 1단계: 출제 조건 */}
      <div className="card">
        <h2><span className="num">1</span> 출제 조건</h2>

        <label className="fld" htmlFor="subjectSel">과목</label>
        <select id="subjectSel" value={subject} onChange={e=>{ setSubject(e.target.value); setSelectedStds([]); setStdFilter(""); }}>
          <option value="자동">과목을 지정하지 않음</option>
          {Object.keys(groups).map(g=>(
            <optgroup key={g} label={g}>
              {groups[g].map(s=><option key={s.v} value={s.v}>{s.v}</option>)}
            </optgroup>
          ))}
        </select>
        <div className="hint">과목을 선택하면 해당 교육과정 범위를 벗어난 개념은 사용하지 않습니다.</div>

        {(STANDARDS[subject]||[]).length > 0 &&
          <div style={{marginTop:14,borderTop:"1px dashed var(--line)",paddingTop:14}}>
            <label className="fld" htmlFor="stdFilterIn">성취기준 선택</label>
            <div className="hint compact">여러 개를 선택할 수 있습니다. 공식 성취수준은 문항과 채점기준에 함께 적용됩니다.</div>
            <input id="stdFilterIn" type="text" value={stdFilter} onChange={e=>setStdFilter(e.target.value)}
              placeholder="성취기준 코드나 개념어로 검색하세요. 예: 광합성, 03-05"
              style={{marginBottom:8}} />
            <StdList subject={subject} filter={stdFilter} selected={selectedStds} onToggle={toggleStd}/>
            {selectedStds.length>0 &&
              <div className="note info" style={{marginTop:10}}>
                성취기준 <b>{selectedStds.length}개</b>를 선택했습니다.{selectedStds.length>1?" 선택한 성취기준을 연결해 문항을 설계합니다.":""}
                <a href="#" style={{marginLeft:8,color:"var(--warn)"}} onClick={ev=>{ev.preventDefault(); setSelectedStds([]);}}>모두 해제</a>
              </div>}
            {selectedStds.map(code=>{
              const std=(STANDARDS[subject]||[]).find(s=>s.code===code); if(!std) return null;
              return (
                <div className="box blue" key={code} style={{marginTop:10}}>
                  <h4>[{std.code}] 공식 성취수준</h4>
                  <div className="hint compact">문항과 채점기준에 적용됩니다.</div>
                  <table className="ktbl std-table" style={{margin:"4px 0 0"}}>
                    <tbody>{std.levels.map((lv,i)=>(
                      <tr key={i}><th style={{width:52}}>{lv.level}</th><td>{lv.text}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              );
            })}
          </div>}
        {(STANDARDS[subject]||[]).length === 0 && subject !== "자동" &&
          <div className="note info" style={{marginTop:12}}>이 과목의 공식 성취기준 목록은 아직 준비 중입니다. 2단계 출제 자료에 성취기준과 성취수준을 직접 붙여넣으세요.</div>}

        <fieldset className="fset">
          <legend className="subh">목표 성취수준</legend>
          <div className="pills level-grid">
            {LEVELS.map(l=><Pill key={l} cls="lv" on={targets.includes(l)} onClick={()=>toggleTarget(l)}>{l} 수준</Pill>)}
          </div>
          {targetMsg && <div className="note" style={{marginTop:10}}>⚠ {targetMsg}</div>}
          <div className="hint">
            {targets.length
              ? `여러 수준을 선택하면 수준별 문항을 하나씩 만듭니다. 최대 ${MAX_ITEMS}개까지 선택할 수 있습니다.`
              : "선택하지 않으면 입력한 자료에 맞춰 난이도를 구성합니다."}
          </div>
        </fieldset>

        <fieldset className="fset">
          <legend className="subh">설계 방식</legend>
          <div className="pills mode-grid">
            {MODES.map(m=><Pill key={m.v} on={mode===m.v} onClick={()=>setMode(m.v)}>{m.t}</Pill>)}
          </div>
          <div className="hint">{MODES.find(m=>m.v===mode).d}</div>
        </fieldset>
      </div>

      {/* 2단계: 출제 자료 */}
      <div className="card">
        <h2><span className="num">2</span> 출제 자료</h2>

        <label className="fld" htmlFor="mainInput">
          {mode==="standard" ? "성취기준과 성취수준" :
           mode==="convert"  ? "기존 지필 문항" :
           mode==="transform"? "기존 논술형 문항" : "수업 주제와 아이디어"}
        </label>
        <textarea id="mainInput" value={text}
          aria-invalid={inputErr?true:undefined} aria-describedby={inputErr?"mainInputErr":undefined}
          onChange={e=>{ setText(e.target.value); if(inputErr && (e.target.value.trim()||images.length)) setInputErr(""); }}
          placeholder={
            mode==="standard" ? "성취기준과 성취수준을 붙여넣으세요." :
            mode==="convert"  ? "바꾸려는 문항과 정답 또는 해설을 붙여넣으세요." :
            mode==="transform"? "변형할 문항과 채점기준을 붙여넣으세요." :
                                "문항으로 만들 주제, 자료, 수업 맥락을 적어 주세요."
          } />
        {inputErr && <div className="fielderr" id="mainInputErr" role="alert">⚠ {inputErr}</div>}

        <div style={{marginTop:10}}>
          <label className="btn ghost upload-btn">
            참고 자료 첨부
            <input type="file" accept="image/*,application/pdf,.pdf" multiple onChange={onFiles} style={{display:"none"}} />
          </label>
          {images.length>0 &&
            <div className="thumbs">
              {images.map((im,i)=>(
                im.kind === "pdf"
                  ? <div className="thumb pdf-thumb" key={i}>
                      <div className="pdf-card">
                        <span className="file-type">PDF</span>
                        <span className="file-name">{im.name}</span>
                      </div>
                      <button onClick={()=>removeImage(i)} title="삭제" aria-label={"첨부 삭제: "+im.name}>×</button>
                    </div>
                  : <div className="thumb" key={i}>
                      <img src={im.url} alt={im.name}/>
                      <button onClick={()=>removeImage(i)} title="삭제" aria-label={"첨부 삭제: "+im.name}>×</button>
                      <label className={"material-check"+(im.asMaterial?" is-on":"")}>
                        <input type="checkbox" checked={!!im.asMaterial} onChange={()=>toggleAsMaterial(i)} style={{verticalAlign:-2,marginRight:2}}/>제시 자료로 사용
                      </label>
                    </div>
              ))}
            </div>}
        </div>
        <div className="hint">교과서, 활동지, 보고서의 사진이나 PDF를 첨부할 수 있습니다. 파일당 최대 용량은 18MB입니다.</div>
        <details className="file-note">
          <summary>파일 처리 안내</summary>
          <p>Claude 방식에서는 첨부 파일을 Claude 대화에 직접 넣어야 합니다.</p>
          <p>파일은 이 브라우저에서 읽습니다. Gemini 방식으로 문서를 만들 때는 선택한 파일이 Google API로 전송됩니다. 원본 파일은 최근 결과에 저장되지 않습니다.</p>
        </details>

        <div className="subh inline-title">기사·칼럼 활용 <span className="optional-badge">선택</span></div>
        <div className="pills">
          <Pill on={!useNews} onClick={()=>setUseNews(false)}>사용하지 않음</Pill>
          <Pill on={useNews} onClick={()=>setUseNews(true)}>기사·칼럼 추가</Pill>
        </div>
        {!useNews &&
          <div className="hint" style={{marginTop:8}}>필요하면 기사나 칼럼을 검색해 제시 자료로 추가할 수 있습니다.</div>}
        {useNews && <React.Fragment>
        <div className="row" style={{alignItems:"flex-end",marginTop:12}}>
          <div style={{flex:2}}>
            <label className="fld">검색어</label>
            <input type="text" value={newsQuery} onChange={e=>setNewsQuery(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter") searchNews(); }}
              placeholder="예: 기후변화 감염병, 미세먼지, 생물다양성" />
          </div>
          <div style={{flex:"0 0 130px"}}>
            <label className="fld">종류</label>
            <select value={newsType} onChange={e=>setNewsType(e.target.value)}>
              <option value="news">신문기사</option>
              <option value="blog">칼럼·블로그</option>
            </select>
          </div>
          <div style={{flex:"0 0 auto"}}>
            <button className="btn sec" onClick={searchNews} disabled={newsLoading} style={{whiteSpace:"nowrap"}}>
              {newsLoading ? "검색 중…" : "검색"}
            </button>
          </div>
        </div>
        {newsMsg && <div className="hint" style={{color:"var(--warn)",fontWeight:600,marginTop:8}}>{newsMsg}</div>}
        {newsResults.length>0 &&
          <div className="news-results">
            {newsResults.map((a,i)=>{
              const on = articles.some(x=>x.link===a.link);
              return (
                <div key={i} role="checkbox" aria-checked={on} tabIndex={0}
                  onKeyDown={e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); toggleArticle(a); } }}
                  onClick={()=>toggleArticle(a)}
                  className={"news-row"+(on?" is-on":"")}>
                  <div className="news-title">{on?"✓ ":""}{a.title}</div>
                  <div className="news-source">{a.source}{a.date?` · ${a.date}`:""}</div>
                  <div className="news-desc">{a.desc}</div>
                </div>
              );
            })}
          </div>}
        {articles.length>0 &&
          <div className="note info" style={{marginTop:10}}>
            기사 <b>{articles.length}건</b>을 선택했습니다.
            <a href="#" style={{marginLeft:8,color:"var(--warn)"}} onClick={ev=>{ev.preventDefault(); setArticles([]);}}>모두 해제</a>
          </div>}
        <div className="hint">선택한 기사를 분석해야 해결할 수 있는 문항을 만듭니다. 검색 기능을 사용하려면 배포 환경에 네이버 검색 API 설정이 필요합니다.</div>
        </React.Fragment>}
      </div>

      {/* 3단계: 문항 구성 */}
      <div className="card">
        <h2><span className="num">3</span> 문항 구성</h2>
        <div className="row">
          <div>
            <label className="fld" htmlFor="cntIn">문항 수</label>
            <input id="cntIn" type="number" min="1" max="4" step="1" inputMode="numeric" value={countStr}
              onChange={e=>{
                const v = e.target.value;
                setCountStr(v);
                const n = parseInt(v, 10);
                if (n >= 1 && n <= 4) setCount(n);
              }}
              onBlur={()=>{
                let n = parseInt(countStr, 10);
                if (!Number.isFinite(n) || n < 1) n = 1;
                if (n > 4) n = 4;
                setCount(n); setCountStr(String(n));
              }} />
          </div>
          <div>
            <label className="fld" htmlFor="fmtSel">문항 형식</label>
            <select id="fmtSel" value={format} onChange={e=>setFormat(e.target.value)}>
              {FORMATS.map(f=><option key={f} value={f}>{formatDisplay(f)}</option>)}
            </select>
          </div>
        </div>
        <div className="hint">1개부터 4개까지 만들 수 있습니다. 한 번에 검토하기에는 1~2개가 적절합니다.</div>

        <button type="button" className="advtgl" aria-expanded={advOpen} onClick={()=>setAdvOpen(!advOpen)}>
          <span>고급 설정</span>
          <span className="chevron" aria-hidden="true">{advOpen ? "⌃" : "⌄"}</span>
          <span className="sr">{advOpen ? "접기" : "펼치기"}</span>
          <span className="advsum">{[
            "도식: "+(visual==="none" ? "포함하지 않음" : (visual==="always" ? "항상" : "필요할 때")),
            "인쇄: "+(mono ? "흑백" : "컬러"),
            blankVer ? "빈칸 문항: 사용" : null,
            style.trim() ? "추가 요청: 있음" : null
          ].filter(Boolean).join(" / ")}</span>
        </button>
        {advOpen && <div style={{paddingTop:12}}>
          <label className="fld" htmlFor="visSel">도식·그림</label>
          <select id="visSel" value={visual} onChange={e=>setVisual(e.target.value)}>
            {VISUALS.map(v=><option key={v.v} value={v.v}>{v.t}</option>)}
          </select>
          {visual!=="none" &&
            <div style={{marginTop:10,display:"flex",gap:18,flexWrap:"wrap",alignItems:"center"}}>
              <label className={"setting-check"+(mono?" is-on":"")}>
                <input type="checkbox" checked={mono} onChange={()=>setMono(!mono)} style={{verticalAlign:-2,marginRight:5}}/>
                 흑백 인쇄에 맞게 만들기
              </label>
              <label className={"setting-check"+(blankVer?" is-on":"")}>
                <input type="checkbox" checked={blankVer} onChange={()=>setBlankVer(!blankVer)} style={{verticalAlign:-2,marginRight:5}}/>
                 빈칸이 있는 도식 문항도 만들기
              </label>
            </div>}
          {visual!=="none" && blankVer &&
            <div className="hint" style={{marginTop:4}}>학생용에는 빈칸 도식을, 교사용에는 완성 도식과 정답을 넣습니다.</div>}
          <div style={{marginTop:12}}>
            <label className="fld" htmlFor="styleIn">추가 요청</label>
            <input id="styleIn" type="text" value={style} onChange={e=>setStyle(e.target.value)}
              placeholder='예: 그래프 해석을 포함하고, 600자 안팎으로 답하게 해 주세요.' />
          </div>
        </div>}
      </div>

      {/* 4단계: 문항 만들기 */}
      <div className="card">
        <h2><span className="num">4</span> {runMode==="paste" ? "Claude에서 문항 만들기" : "평가 문서 만들기"}</h2>

        {(()=>{ const eff = Math.min(MAX_ITEMS, targets.length ? Math.max(count, targets.length) : count);
          const parts = [
            "과목: "+(subject!=="자동" ? subject : "미지정"),
            "성취수준: "+(targets.length ? targets.join(" · ") : "미지정"),
            "문항 유형: "+formatDisplay(format),
            "문항 수: "+eff+"개",
            "인쇄: "+(mono ? "흑백" : "컬러")
          ];
          if (visual==="none") parts.push("도식: 포함하지 않음");
          if (blankVer) parts.push("빈칸 문항: 사용");
          if (useNews && articles.length) parts.push("기사: "+articles.length+"건");
          const need = (!text.trim() && !images.length);
          return (
            <div className="sumline" aria-live="polite">
              <span>{parts.join(" / ")}</span>
              {need && <span className="sum-warn">출제 자료를 입력하세요.</span>}
            </div>
          );
        })()}

        {error && <div className="err" role="alert" style={{whiteSpace:"pre-wrap"}}>⚠ {error}</div>}
        <span className="sr" aria-live="polite">{promptCopied ? "요청문이 클립보드에 복사되었습니다" : ""}</span>

        {runMode==="api" && <React.Fragment>
          <button className="btn primary-wide" onClick={generate} disabled={loading}>
            {loading ? <><span className="spin"></span>평가 문서를 만들고 있습니다. {loadSec}초 경과</> : "평가 문서 만들기"}
          </button>
          {loading &&
            <div className="hint" style={{textAlign:"center",marginTop:8}}>
              보통 30~60초가 걸립니다. 서버가 혼잡하면 더 오래 걸릴 수 있으니 창을 닫지 마세요.
            </div>}
        </React.Fragment>}

        {runMode==="paste" && <React.Fragment>
          <button className="btn primary-wide" onClick={copyPromptForClaude}>
            {promptCopied ? "요청문을 복사했습니다" : "Claude용 요청문 복사"}
          </button>
          {promptCopied &&
            <a href="https://claude.ai/new" target="_blank" rel="noopener noreferrer" className="claude-link">
              Claude 새 대화 열기
            </a>}
          <ol className="copy-steps">
            <li>요청문을 복사해 Claude 새 대화에 붙여넣습니다.</li>
            <li>사진이나 PDF를 사용했다면 같은 대화에 첨부합니다.</li>
            <li>Claude의 답변 전체를 복사해 아래에 붙여넣습니다.</li>
          </ol>
          <label className="fld paste-label" htmlFor="pasteIn">Claude 답변</label>
          <textarea id="pasteIn" value={pasteText} onChange={e=>onPasteChange(e.target.value)}
            placeholder="Claude의 답변 전체를 붙여넣으세요." className="paste-input" />
          <div className="actions-row">
            <button className="btn sec" onClick={showPasted}>결과 확인</button>
            <button className="btn ghost" onClick={()=>setShowEx(!showEx)} aria-expanded={showEx}>
              {showEx ? "입력 예시 닫기" : "입력 예시"}
            </button>
          </div>
          {showEx && <pre className="exbox">{EX_JSON}</pre>}
        </React.Fragment>}
      </div>

      {/* 최근 결과 */}
      {historyList.length>0 &&
        <div className="card history-card">
          <h2>최근 결과
            <span className="history-meta">이 브라우저에 최근 10건 저장</span>
            <label className="btn ghost history-import">
              백업 파일 불러오기
              <input type="file" accept="application/json,.json" onChange={importHistoryFile} style={{display:"none"}}/>
            </label>
          </h2>
          <div className="hint history-help">공용 컴퓨터에서는 작업 후 결과를 삭제하세요. 내려받은 백업 파일은 다른 컴퓨터에서도 불러올 수 있습니다.</div>
          {historyList.map((h,i)=>(
            <div key={h.ts} className={"history-row"+(i<historyList.length-1?" has-divider":"")}>
              <b className="history-name">{h.name}</b>
              <span className="history-date">{h.subject}{h.subject?" · ":""}{new Date(h.ts).toLocaleString("ko-KR",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}</span>
              <button className="btn sec mini-action" onClick={()=>{ try{ setResult(attachImages(JSON.parse(JSON.stringify(h.data)))); }catch(_){ setResult(h.data); } setError(""); afterResult(); }}>열기</button>
              <button className="btn ghost mini-action"
                onClick={()=>downloadDataUrl("data:application/json;charset=utf-8,"+encodeURIComponent(JSON.stringify(h)), (h.name||"평가도구").replace(/[\\/:*?"<>|]/g,"_")+".json")}>백업</button>
              <button className="btn ghost mini-action danger-action" onClick={()=>deleteHistory(i)}>삭제</button>
            </div>
          ))}
        </div>}
      </aside>

      <main className="paperpane" id="panel-prev" role="tabpanel" aria-labelledby="tab-prev" tabIndex={-1}>
        {loading && runMode==="api"
          ? <SkeletonDoc sec={loadSec}/>
          : (result
              ? <Result r={result} showTeacher={showTeacher} setShowTeacher={setShowTeacher} onUpdate={nr=>setResult({...nr})}
                        onSave={()=>{ if(result) saveToHistory(result); }}
                        copyMd={copyMd} copied={copied} />
              : <EmptyDoc subject={subject} targets={targets} hasInput={!!text.trim()||images.length>0} runMode={runMode}/>)}
      </main>
      </div>

      {/* 모바일 하단 CTA */}
      {mobileTab==="form" &&
        <div className="mcta noprint">
          {runMode==="paste"
            ? <button className="btn" onClick={copyPromptForClaude}>{promptCopied?"요청문을 복사했습니다":"Claude용 요청문 복사"}</button>
            : <button className="btn" onClick={generate} disabled={loading}>{loading?("평가 문서를 만들고 있습니다. "+loadSec+"초"):"평가 문서 만들기"}</button>}
        </div>}

      <p className="noprint footer-note">
        사용 전에는 성취기준과 성취수준의 일치, 자료 출처, 정답과 채점기준을 확인하세요.<br/>
        참고 기준: 경기도교육청 「2025 중등 논술형 평가 길라잡이」 / KICE 「서·논술형 평가도구 자료」 / 2022 개정 교육과정
      </p>
    </div>
  );
}

/* ── KICE 문서 구성 요소 ────────────────────────────────────── */
function KCallout({label, items}) {
  if (!(items||[]).length) return null;
  return (
    <div className="kcall">
      <span className="lb">{label}</span>
      <ul>{(items||[]).map((x,i)=><li key={i}>{x}</li>)}</ul>
    </div>
  );
}

function KCond({cond}) {
  const c = cond || {};
  if (!((c.content||[]).length || (c.form||[]).length)) return null;
  return (
    <div className="kcond">
      <span className="t">〈조건〉</span>
      {(c.form||[]).length>0 ? <React.Fragment>
        <b className="axis">[내용적 측면]</b>
        <ul>{(c.content||[]).map((x,i)=><li key={i}>{x}</li>)}</ul>
        <b className="axis">[형식적 측면]</b>
        <ul>{(c.form||[]).map((x,i)=><li key={i}>{x}</li>)}</ul>
      </React.Fragment> :
        <ul>{(c.content||[]).map((x,i)=><li key={i}>{x}</li>)}</ul>}
    </div>
  );
}

/* 채점 기준 표 — awarded가 있으면 ✓ 열 추가(채점 결과 예시) */
function ScoringTable({items, forItem, awarded, editing, onEdited}) {
  const list = forItem ? [forItem] : (items||[]);
  return (
    <table className="ktbl">
      <thead>
        <tr>
          <th style={{width:56}}>문항</th><th style={{width:150}}>채점 요소</th>
          <th style={{width:52}}>점수</th>
          {awarded ? <th style={{width:30}}></th> : null}
          <th>수행 특성</th>
        </tr>
      </thead>
      <tbody>
        {list.map(it=>{
          const groups = (it.scoring||[]);
          const totalRows = groups.reduce((n,g)=>n+((g.levels||[]).length||0),0) || 1;
          let firstOfItem = true;
          return groups.map((g,gi)=>(g.levels||[]).map((lv,li)=>{
            const cells = [];
            if (firstOfItem) {
              cells.push(<td key="n" className="c" rowSpan={totalRows}>{it.number}</td>);
              firstOfItem = false;
            }
            if (li===0) {
              cells.push(
                <td key="e" className="kel" rowSpan={(g.levels||[]).length}>
                  {g.question ? <span>{g.question}<br/></span> : null}{g.element}
                </td>);
            }
            cells.push(<td key="p" className="c">{lv.points}점</td>);
            if (awarded) {
              const hit = (awarded||[]).some(a=>
                (a.element ? a.element===g.element : (a.question && g.question && a.question===g.question))
                && a.points===lv.points);
              cells.push(<td key="k" className="kchk">{hit?"✓":""}</td>);
            }
            cells.push(
              <td key="d">
                <Ed v={lv.criteria} editing={editing && !awarded} onC={nv=>{ lv.criteria=nv; onEdited&&onEdited(); }}/>
                {lv.example ? <div className="kex"><b>예시 답안</b> {lv.example}</div> : null}
              </td>);
            return <tr key={gi+"-"+li}>{cells}</tr>;
          }));
        })}
      </tbody>
    </table>
  );
}

/* 도식 빈칸 편집기 — 교사가 용어를 체크해 ㉠㉡ 빈칸 지정 */
function BlankEditor({m, onChange}) {
  const [open, setOpen] = useState(false);
  const texts = extractSvgTexts(m.svg);
  const sel = m.blankSel || [];
  function toggle(i){
    if (m.aiBlank === undefined) m.aiBlank = m.svgBlank || null; // AI 제안본 백업
    const next = sel.includes(i) ? sel.filter(x=>x!==i) : [...sel, i];
    m.blankSel = next;
    m.svgBlank = next.length ? buildBlankSvg(m.svg, next) : m.aiBlank;
    if (onChange) onChange();
  }
  if (!texts.length) return null;
  return (
    <div className="noprint" style={{textAlign:"left",marginTop:6}}>
      <button className="btn ghost mini-doc-action" onClick={()=>setOpen(!open)}>
        {open ? "빈칸 편집 닫기" : ("빈칸 직접 선택" + (sel.length ? ` (${sel.length}개 지정됨)` : ""))}
      </button>
      {open &&
        <div className="blank-editor-panel">
          <b>빈칸으로 바꿀 용어를 선택하세요.</b> 선택한 용어는 학생 배부본 도식에서 ㉠㉡㉢…으로 표시됩니다. 모두 해제하면 처음 제안된 빈칸이 적용됩니다.
          <div style={{marginTop:6,display:"flex",flexWrap:"wrap",gap:"4px 14px"}}>
            {texts.map((t,i)=> t ?
              <label key={i} className={"blank-choice"+(sel.includes(i)?" is-on":"")}>
                <input type="checkbox" checked={sel.includes(i)} onChange={()=>toggle(i)} style={{verticalAlign:-2,marginRight:3}}/>{t}
              </label> : null)}
          </div>
        </div>}
    </div>
  );
}

/* 평가 문항 블록 */
function ItemBlock({it, showTeacher, onEdited, editing}) {
  const qs = normQuestions(it);
  return (
    <div>
      <div className="kpillrow">
        <span className="kpill">평가 문항 {it.number}({it.type||"논술형"})</span>
        <span className="kline"></span>
      </div>
      <div className="tags noprint">
        {it.format && <span className="tag fmt">{it.format}</span>}
        {it.directive && <span className="tag">반응지시어: {it.directive}</span>}
        {it.targetLevel && <span className="tag lvl">목표 수준 {it.targetLevel}</span>}
      </div>
      {it.intro && <p className="kintro"><Ed v={it.intro} editing={editing} onC={nv=>{ it.intro=nv; onEdited&&onEdited(); }}/>{it.points?` (${it.points}점)`:""}</p>}

      {(it.materials||[]).map((m,i)=>(
        <div className="kmat" key={i}>
          {m.body
            ? <div style={{whiteSpace:"pre-wrap"}}><span className="lbl">{m.label} </span><Ed v={m.body} editing={editing} onC={nv=>{ m.body=nv; onEdited&&onEdited(); }}/></div>
            : (m.label ? <span className="lbl">{m.label}</span> : null)}
          {m.imageData &&
            <div className="kvis">
              <img src={m.imageData} alt={m.caption||m.label||"자료 그림"} style={{maxWidth:"100%",borderRadius:4}}/>
              {m.caption && <div className="cap">{m.caption}</div>}
              <div className="noprint" style={{marginTop:4}}>
                <button className="btn ghost mini-doc-action"
                  onClick={()=>downloadDataUrl(m.imageData, ("자료그림_"+(m.label||"").replace(/[()\\/:*?"<>|]/g,"")||"자료그림")+".png")}>
                  그림 저장
                </button>
              </div>
            </div>}
          {!m.imageData && (m.svg || m.svgBlank) &&
            <div className="kvis">
              <div role="img" aria-label={(m.label||"자료 그림")+(m.caption?": "+m.caption:"")}
                dangerouslySetInnerHTML={{__html: sanitizeSvg((!showTeacher && m.svgBlank) ? m.svgBlank : (m.svg || m.svgBlank))}} />
              {m.caption && <div className="cap">{m.caption}</div>}
              {showTeacher && (m.blankSel||[]).length>0 && (()=>{
                const texts = extractSvgTexts(m.svg);
                const key = [...(m.blankSel||[])].sort((a,b)=>a-b)
                  .map((idx,k)=>BLANK_SYMS[k]+" "+(texts[idx]||"")).join("  ·  ");
                return <div className="cap" style={{color:"var(--kred-dk)",fontWeight:700}}>빈칸 정답: {key}</div>;
              })()}
              {showTeacher && m.svgBlank &&
                <div className="cap noprint" style={{color:"var(--accent)",fontWeight:600}}>※ 학생 배부본에는 ㉠㉡ 빈칸 도식이 실립니다. (위는 완성본)</div>}
              <div className="noprint" style={{marginTop:4,display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
                {m.svg &&
                  <button className="btn ghost mini-doc-action"
                    onClick={async()=>{ try{ downloadDataUrl(await svgToPngDataUrl(m.svg,3), "도식_"+((m.label||"자료").replace(/[()]/g,""))+"_완성본.png"); }catch(e){ alert(e.message); } }}>
                    완성 도식 PNG 저장
                  </button>}
                {m.svgBlank &&
                  <button className="btn ghost mini-doc-action"
                    onClick={async()=>{ try{ downloadDataUrl(await svgToPngDataUrl(m.svgBlank,3), "도식_"+((m.label||"자료").replace(/[()]/g,""))+"_빈칸.png"); }catch(e){ alert(e.message); } }}>
                    빈칸 도식 PNG 저장
                  </button>}
              </div>
              {showTeacher && m.svg && <BlankEditor m={m} onChange={onEdited}/>}
            </div>}
        </div>
      ))}

      {qs.map((q,i)=>(
        <div key={i}>
          <p className="kq">{q.label?`${q.label} `:""}<Ed v={q.stem} editing={editing} onC={nv=>{ q.stem=nv; onEdited&&onEdited(); }}/>{q.points?` (${q.points}점)`:""}</p>
          <KCond cond={q.conditions}/>
          {!showTeacher &&
            <div className="kans">
              <div className="kans-t">[답안 작성란]</div>
              {Array.from({length: Math.min(14, Math.max(5, (q.points||3)*2))}).map((_,k)=><div className="ln" key={k}></div>)}
            </div>}
        </div>
      ))}

      {showTeacher && <KCallout label="활용 Tip !" items={it.tips}/>}

      {showTeacher && it.levelAnalysis &&
        (it.levelAnalysis.rationale || it.levelAnalysis.levelElements || it.levelAnalysis.standardElements) &&
        <div className="box blue noprint">
          <h4>수준 설계 해설 · 목표 수준 {it.targetLevel||"-"} <span className="optional-badge">화면에서만 표시</span></h4>
          <div className="level-analysis">
            {it.levelAnalysis.standardElements && <p style={{margin:"4px 0"}}><b>성취기준 내용요소</b> · {it.levelAnalysis.standardElements}</p>}
            {it.levelAnalysis.levelElements && <p style={{margin:"4px 0"}}><b>해당 수준 내용요소</b> · {it.levelAnalysis.levelElements}</p>}
            {it.levelAnalysis.rationale && <p style={{margin:"4px 0"}}><b>수준 적합성</b> · {it.levelAnalysis.rationale}</p>}
          </div>
        </div>}
    </div>
  );
}

const Result = React.memo(function Result({ r, showTeacher, setShowTeacher, copyMd, copied, onUpdate, onSave }) {
  const info = r.info || {};
  const items = r.items || [];
  const ce = r.contentElements || {};
  const ap = r.applicationTip;
  const caseItem = n => items.find(x=>x.number===n) || items[0];
  const [editing, setEditing] = useState(false);
  const audit = auditResult(r);

  // Word(.docx) 다운로드 — 진짜 OOXML 문서라 한글(HWP)·훈워드·MS워드 모두 열림
  const [docErr, setDocErr] = useState("");
  function onDownloadDoc(teacher){
    setDocErr("");
    downloadDocx(r, teacher).catch(e=>setDocErr(e.message||String(e)));
  }
  function printAs(teacher){
    if (teacher === showTeacher) { window.print(); return; }
    setShowTeacher(teacher);
    setTimeout(()=>window.print(), 450);
  }

  return (
    <div style={{marginTop:24}}>
      <div className="toolbar noprint">
        <span className={"badge "+(r.curriculum==="2015"?"b15":"b22")}>
          {r.curriculum==="2015"?"2015 개정":"2022 개정"}
        </span>
        {r.standardCode && <span className="tag">{r.standardCode}</span>}
        <span style={{flex:1}}></span>
        <button className="btn sec" onClick={()=>setShowTeacher(!showTeacher)}>
          {showTeacher?"학생 배부본 보기":"교사용 보기"}
        </button>
        <button className="btn sec" onClick={()=>{ if(editing && onSave) onSave(); setEditing(!editing); }}
          style={editing?{background:"var(--accent)",color:"#fff"}:null}>
          {editing?"수정 완료":"문서 내용 수정"}
        </button>
        <span className="outgrp" role="group" aria-label="출력">
          <span className="og-l">인쇄</span>
          <button type="button" onClick={()=>printAs(true)}>교사용</button>
          <button type="button" onClick={()=>printAs(false)}>학생용</button>
          <span className="og-l">Word</span>
          <button type="button" onClick={()=>onDownloadDoc(true)}>교사용</button>
          <button type="button" onClick={()=>onDownloadDoc(false)}>학생용</button>
        </span>
        <button className="btn sec" onClick={copyMd} title="Markdown 형식으로 복사합니다.">{copied?"복사했습니다":"HWP·Word용 복사"}</button>
      </div>
      {editing &&
        <div className="note info noprint">점선으로 표시된 문구를 선택해 수정할 수 있습니다. 수정 내용은 인쇄본과 Word 파일에도 적용됩니다.</div>}
      {docErr && <div className="err noprint">⚠ {docErr}</div>}

      {showTeacher && audit.length>0 &&
        <div className="note noprint" style={{maxWidth:840,margin:"0 auto 12px"}}>
          <b>기본 점검 결과 · 확인할 항목 {audit.length}건</b> 배점, 채점 단계와 지시어를 확인한 결과입니다. 인쇄 전에 내용을 직접 검토하세요.
          <ul style={{margin:"6px 0 0",paddingLeft:18}}>{audit.map((x,i)=><li key={i}>{x}</li>)}</ul>
        </div>}
      {r.standardNote && <div className="note noprint">⚠ {r.standardNote}</div>}
      {r.hierarchyBlock && <div className="note info noprint">위계 점검: {r.hierarchyBlock}</div>}

      {/* 내용요소·평가요소 — 화면 전용 참고 카드 */}
      {showTeacher && ((ce.knowledge||[]).length || (ce.process||[]).length || (ce.value||[]).length) > 0 &&
        <div className="card noprint">
          <h2>내용요소와 평가요소 <span className="optional-badge">화면에서만 표시</span></h2>
          <div className="elems">
            <div className="e"><b>지식·이해</b><ul>{(ce.knowledge||[]).map((x,i)=><li key={i}>{x}</li>)}</ul></div>
            <div className="e"><b>과정·기능</b><ul>{(ce.process||[]).map((x,i)=><li key={i}>{x}</li>)}</ul></div>
            <div className="e"><b>가치·태도</b><ul>{(ce.value||[]).map((x,i)=><li key={i}>{x}</li>)}</ul></div>
          </div>
          {(r.evaluationElements||[]).length>0 &&
            <div style={{marginTop:12}}>
              <b className="evaluation-label">평가요소</b>
              <div className="tags" style={{marginTop:6}}>
                {(r.evaluationElements||[]).map((x,i)=><span key={i} className="tag fmt">{x}</span>)}
              </div>
            </div>}
        </div>}

      {/* ───────── KICE 평가도구 자료 문서 ───────── */}
      <div className={"kdoc"+(editing?" editing":"")} id="printArea">
        <div className="spine" aria-hidden="true">{showTeacher ? "교사용" : "학생 배부본"}</div>
        <div className="keyebrow">
          서·논술형 평가도구 자료
          <span className="chip">과학과</span>
          {info.subject && <span className="chip" style={{background:"#fff",color:"var(--kred-dk)",border:"1px solid var(--kred)"}}>{info.subject}</span>}
        </div>
        <div className="khead"><Ed v={info.toolName || "서·논술형 평가 문항"} editing={editing} onC={nv=>{ r.info=r.info||{}; r.info.toolName=nv; onUpdate&&onUpdate(r); }}/></div>
        {!showTeacher &&
          <div style={{display:"flex",justifyContent:"flex-end",gap:20,margin:"12px 2px 2px",fontSize:13.5}}>
            <span>(&nbsp;&nbsp;&nbsp;)학년 (&nbsp;&nbsp;&nbsp;)반 (&nbsp;&nbsp;&nbsp;)번</span>
            <span>이름: ________________</span>
          </div>}

        {/* 1. 평가 도구 정보표 */}
        {showTeacher && <React.Fragment>
          <div className="kban">1. 평가 도구 정보표</div>
          <table className="ktbl">
            <tbody>
              <tr>
                <th style={{width:100}}>학교급</th><td>{info.schoolLevel||""}</td>
                <th style={{width:100}}>과목</th><td>{info.subject||""}</td>
              </tr>
              <tr>
                <th>학년</th><td>{info.grade||""}</td>
                <th>영역(단원)</th><td>{info.domain||""}</td>
              </tr>
              <tr>
                <th>평가 도구명</th><td colSpan={3}><b>{info.toolName||""}</b></td>
              </tr>
              {(r.standardText || (info.achievementLevels||[]).length>0) &&
                <tr>
                  <th>성취기준 및<br/>성취수준</th>
                  <td colSpan={3}>
                    {r.standardText &&
                      <div style={{marginBottom:(info.achievementLevels||[]).length?8:0}}>
                        {r.standardCode?`[${r.standardCode}] `:""}{r.standardText}
                      </div>}
                    {(info.achievementLevels||[]).length>0 &&
                      <table className="ktbl" style={{margin:0,borderTop:"1px solid var(--kline)"}}>
                        <tbody>
                          {(info.achievementLevels||[]).map((a,i)=>(
                            <tr key={i}>
                              <th style={{width:48}}>{a.band}</th>
                              <td>{a.text}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>}
                  </td>
                </tr>}
              {info.purpose &&
                <tr>
                  <th>평가 도구<br/>개발 취지</th>
                  <td colSpan={3}>{info.purpose}</td>
                </tr>}
            </tbody>
          </table>

          {(info.itemSummary||[]).length>0 &&
            <table className="ktbl">
              <thead>
                <tr><th style={{width:90}}>문항 번호</th><th style={{width:90}}>문항 유형</th><th>성취기준 기반 평가 요소</th></tr>
              </thead>
              <tbody>
                {(info.itemSummary||[]).map((s,i)=>(
                  <tr key={i}>
                    <td className="c">{s.item}</td>
                    <td className="c">{s.type}</td>
                    <td><ul className="kul" style={{margin:0}}>{(s.elements||[]).map((e,j)=><li key={j}>{e}</li>)}</ul></td>
                  </tr>
                ))}
              </tbody>
            </table>}
        </React.Fragment>}

        {/* 2. 평가 문항 */}
        <div className="kban">{showTeacher?"2. 평가 문항":"평가 문항"}</div>
        {items.map((it,i)=><ItemBlock key={i} it={it} showTeacher={showTeacher} editing={editing} onEdited={()=>onUpdate && onUpdate(r)}/>)}

        {showTeacher && <React.Fragment>
          {/* 예시 답안 */}
          <div className="khd">예시 답안</div>
          <table className="ktbl">
            <thead><tr><th style={{width:70}}>문항</th><th>예시 답안</th></tr></thead>
            <tbody>
              {items.map(it=>normQuestions(it).map((q,qi)=>(
                <tr key={it.number+"-"+qi}>
                  <td className="c">{it.number}{q.label?`-${q.label}`:""}</td>
                  <td style={{whiteSpace:"pre-wrap"}}><Ed v={q.modelAnswer||""} editing={editing} onC={nv=>{ q.modelAnswer=nv; onUpdate&&onUpdate(r); }}/></td>
                </tr>
              )))}
            </tbody>
          </table>

          {/* 채점 기준 */}
          {items.some(it=>(it.scoring||[]).length>0) && <React.Fragment>
            <div className="khd">채점 기준</div>
            <ScoringTable items={items} editing={editing} onEdited={()=>onUpdate&&onUpdate(r)}/>
          </React.Fragment>}

          {/* 성취수준별 학생 수행 특성 */}
          {(r.levelCharacteristics||[]).length>0 && <React.Fragment>
            <div className="khd">성취수준별 학생 수행 특성</div>
            <table className="ktbl">
              <tbody>
                {(r.levelCharacteristics||[]).map((b,i)=>(
                  <tr key={i}>
                    <th style={{width:52}}>{b.band}</th>
                    <td className="c" style={{width:86}}>{b.scoreRange||""}</td>
                    <td>{b.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </React.Fragment>}

          <KCallout label="채점 시 유의점" items={r.scoringNotes}/>

          {/* 채점 및 피드백 사례 */}
          {(r.feedbackCases||[]).length>0 && <React.Fragment>
            <div className="khd">채점 및 피드백 사례</div>
            {(r.feedbackCases||[]).map((cs,i)=>{
              const it = caseItem(cs.itemNumber);
              return (
                <div key={i}>
                  <div className="kpillrow">
                    <span className="kpill">{cs.title||`사례 ${i+1}`}</span>
                    <span className="kline"></span>
                  </div>
                  {cs.studentAnswer && <React.Fragment>
                    <div className="ksq">학생 답안 예시</div>
                    <div className="kstu" style={{whiteSpace:"pre-wrap"}}>{cs.studentAnswer}</div>
                  </React.Fragment>}
                  {it && (it.scoring||[]).length>0 && (cs.awarded||[]).length>0 && <React.Fragment>
                    <div className="ksq">채점 결과 예시</div>
                    <ScoringTable items={items} forItem={it} awarded={cs.awarded||[]}/>
                    <div className="ktotal">
                      부여 점수 합계: {(cs.awarded||[]).reduce((n,a)=>n+(Number(a.points)||0),0)}점
                      {it.points?` / ${it.points}점`:""}
                    </div>
                  </React.Fragment>}
                  {cs.feedback && <React.Fragment>
                    <div className="ksq">학생 개별 피드백 예시</div>
                    <div className="kfbbox"><Ed v={cs.feedback} editing={editing} onC={nv=>{ cs.feedback=nv; onUpdate&&onUpdate(r); }}/></div>
                  </React.Fragment>}
                </div>
              );
            })}
          </React.Fragment>}

          <KCallout label="피드백 제공 시 유의점" items={r.feedbackNotes}/>

          {/* 수행평가 적용을 위한 Tip */}
          {ap && <React.Fragment>
            <div className="khd">수행평가 적용을 위한 Tip</div>
            {(ap.planIntro||[]).length>0 && <React.Fragment>
              <div className="ksq">교수·학습 및 평가 계획</div>
              <ul className="kul">{(ap.planIntro||[]).map((x,i)=><li key={i}>{x}</li>)}</ul>
            </React.Fragment>}
            {ap.lessonPlan && (ap.lessonPlan.sessions||[]).length>0 &&
              <table className="ktbl">
                <thead>
                  <tr><th style={{width:64}}>차시</th><th>교수·학습 활동</th><th style={{width:110}}>평가 계획</th></tr>
                </thead>
                <tbody>
                  {ap.lessonPlan.relatedItem &&
                    <tr><th>관련 문항</th><td colSpan={2}>{ap.lessonPlan.relatedItem}</td></tr>}
                  {(ap.lessonPlan.sessions||[]).map((s,i)=>(
                    <tr key={i}>
                      <td className="c">{s.session}</td>
                      <td>
                        <b>{s.topic||""}</b>
                        {(s.details||[]).length>0 &&
                          <ul className="kul" style={{marginTop:4}}>{(s.details||[]).map((d,j)=><li key={j}>{d}</li>)}</ul>}
                      </td>
                      <td className="c" style={{whiteSpace:"normal"}}>{s.assessment||""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>}
            {(ap.variation||[]).length>0 && <React.Fragment>
              <div className="ksq">문항 변형 방향</div>
              <ul className="kul">{(ap.variation||[]).map((x,i)=><li key={i}>{x}</li>)}</ul>
            </React.Fragment>}
            {(ap.rubricVariation||[]).length>0 && <React.Fragment>
              <div className="ksq">채점기준표 변형 방향</div>
              <ul className="kul">{(ap.rubricVariation||[]).map((x,i)=><li key={i}>{x}</li>)}</ul>
            </React.Fragment>}
          </React.Fragment>}
        </React.Fragment>}
      </div>
    </div>
  );
}, (p, n) => p.r === n.r && p.showTeacher === n.showTeacher && p.copied === n.copied);

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
