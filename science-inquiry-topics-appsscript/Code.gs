/**
 * 칼럼을 통해 탐구활동 주제 찾기 — Google Apps Script 서버
 *
 * 구조: 외부에서 모은 칼럼(기사) 목록을 구글 시트에 쌓아두고,
 *   기사마다 핵심주제·핵심키워드·분야별 탐구 질문을 붙여 웹앱으로 브라우징.
 *   (검색/학과·기간 필터/보기 수 → 통계 카드 + 기사 카드 + 질문 복사)
 *
 * 앱과 데이터가 같은 출처(Apps Script) → CORS/CSP 없음.
 * 자료 수집(자동 업데이트)은 별도 스크립트/시트로 채우고, 이 앱은 조회·질문 제공만 담당.
 *
 * 사용법:
 *   1) 스프레드시트 → 확장 프로그램 → Apps Script 에 이 코드 붙여넣기
 *   2) HTML 파일 'Index' 생성 후 Index.html 붙여넣기
 *   3) 함수 setupSheets 실행(Articles 탭·샘플 생성)
 *   4) 배포 → 웹 앱 → URL 공유
 */

var ARTICLES_SHEET = 'Articles';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('칼럼을 통해 탐구활동 주제 찾기')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function readTable_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) return [];
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (row.every(function (c) { return c === '' || c === null; })) continue;
    var obj = {};
    for (var j = 0; j < headers.length; j++) if (headers[j]) obj[headers[j]] = row[j];
    rows.push(obj);
  }
  return rows;
}

function splitList_(v, sep) {
  return String(v == null ? '' : v)
    .split(sep)
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s; });
}

function toDateStr_(v) {
  if (v instanceof Date) {
    var y = v.getFullYear(), m = ('0' + (v.getMonth() + 1)).slice(-2), d = ('0' + v.getDate()).slice(-2);
    return y + '-' + m + '-' + d;
  }
  return String(v == null ? '' : v).trim();
}

/**
 * 기사(칼럼) 목록 + 필터 옵션·통계 반환.
 * 한 행 = (기사 × 분야). 같은 기사가 여러 분야에 걸리면 여러 행으로 둔다.
 */
function getArticles() {
  var raw = readTable_(ARTICLES_SHEET);
  var items = raw.map(function (r, i) {
    return {
      id: String(r.id || ('a' + i)),
      date: toDateStr_(r.date),
      source: String(r.source || ''),   // 매체(프레시안 등)
      via: String(r.via || ''),         // 플랫폼(네이버 등)
      title: String(r.title || ''),
      coreTheme: String(r.coreTheme || ''),
      keywords: splitList_(r.keywords, ','),
      department: String(r.department || ''),      // 분야/학과
      fieldKeywords: String(r.fieldKeywords || ''),
      questions: splitList_(r.questions, '\n')
    };
  }).filter(function (a) { return a.title; });

  var deptSet = {}, dateSet = {}, titleSet = {};
  items.forEach(function (a) {
    if (a.department) deptSet[a.department] = true;
    if (a.date) dateSet[a.date] = true;
    if (a.title) titleSet[a.title] = true;
  });
  var departments = Object.keys(deptSet).sort();
  var dates = Object.keys(dateSet).sort().reverse();

  return {
    items: items,
    departments: departments,
    dates: dates,
    totalRows: items.length,
    distinctArticles: Object.keys(titleSet).length,
    distinctDepartments: departments.length,
    latestDate: dates.length ? dates[0] : ''
  };
}

/* ============================================================
   초기 설정 — Articles 탭 + 과학 독서 샘플(칼럼→탐구질문)
   ============================================================ */
function setupSheets() {
  var ss = ss_();
  if (ss.getSheetByName(ARTICLES_SHEET)) {
    SpreadsheetApp.getActive().toast('Articles 탭이 이미 있습니다.', '건너뜀', 4);
    return;
  }
  var sh = ss.insertSheet(ARTICLES_SHEET);
  var headers = ['id', 'date', 'source', 'via', 'title', 'coreTheme', 'keywords', 'department', 'fieldKeywords', 'questions'];
  var rows = [
    ['c1', '2026-07-05', '한겨레', '네이버', '유전자 가위 시대, 우리는 어디까지 편집해도 되는가',
      '크리스퍼 유전자 편집 기술의 발전과 배아 편집 논쟁을 다루며, 과학기술의 가능성과 생명윤리의 경계 사이에서 사회가 합의해야 할 지점을 탐색한다.',
      '유전자 편집, 크리스퍼, 생명윤리, 배아, 규제, 사회적 합의', '생명과학 분야', '유전자 편집, 생명윤리, 규제',
      '기사에서 언급된 배아 유전자 편집이 허용될 경우, 질병 치료와 형질 개량의 경계를 어떻게 구분할 수 있을까?\n크리스퍼 기술의 오프타깃 문제를 줄이기 위한 최근 연구 동향을 조사하고, 안전성 검증 절차를 설계해 보자.\n유전자 편집 규제를 둘러싼 국가별 입장 차이를 비교하고, 사회적 합의를 이끄는 방안을 논술해 보자.'],
    ['c2', '2026-07-05', '한겨레', '네이버', '유전자 가위 시대, 우리는 어디까지 편집해도 되는가',
      '크리스퍼 유전자 편집 기술의 발전과 배아 편집 논쟁을 다루며, 과학기술의 가능성과 생명윤리의 경계 사이에서 사회가 합의해야 할 지점을 탐색한다.',
      '유전자 편집, 크리스퍼, 생명윤리, 배아, 규제, 사회적 합의', '윤리 분야', '생명윤리, 사회적 합의, 규제',
      '유전자 편집 기술을 "필요하니 허용한다"는 목적론적 논리의 문제점은 무엇이며, 대안적 판단 기준은 무엇일까?\n미래 세대의 동의를 구할 수 없는 배아 편집의 윤리적 책임은 누구에게 있는지 논증해 보자.'],
    ['c3', '2026-07-05', '경향신문', '네이버', '기후 데이터는 어떻게 조작되고, 어떻게 검증되는가',
      '기후 위기 관련 데이터의 수집·해석 과정에서 발생하는 편향과, AI 기반 분석이 특정 지역 자료 부족으로 왜곡될 수 있음을 짚으며 비판적 데이터 문해력을 강조한다.',
      '기후 데이터, 데이터 편향, AI 분석, 검증, 표본, 문해력', '지구환경 분야', '데이터 편향, 검증, 표본',
      '기사에서 지적한 "특정 지역 자료 부족"이 기후 예측 모델을 어떻게 왜곡하는지 구체적 사례로 설명해 보자.\n동일한 기후 데이터가 상반된 결론에 쓰인 사례를 찾고, 해석의 한계를 비판적으로 검토해 보자.\n신뢰할 수 있는 기후 자료의 조건(표본 수, 기간, 출처)을 정리하고 검증 체크리스트를 만들어 보자.'],
    ['c4', '2026-07-05', '경향신문', '네이버', '기후 데이터는 어떻게 조작되고, 어떻게 검증되는가',
      '기후 위기 관련 데이터의 수집·해석 과정에서 발생하는 편향과, AI 기반 분석이 특정 지역 자료 부족으로 왜곡될 수 있음을 짚으며 비판적 데이터 문해력을 강조한다.',
      '기후 데이터, 데이터 편향, AI 분석, 검증, 표본, 문해력', 'AI·데이터 분야', 'AI 분석, 데이터 편향, 검증',
      'AI가 생물·기후 이미지를 분류할 때 학습 데이터의 지역 편향이 만드는 오류를 조사해 보자.\n"AI가 틀릴 수 있다"는 막연한 비판을 넘어, 어떤 데이터가 부족할 때 어떤 오류가 생기는지 구조적으로 설명해 보자.'],
    ['c5', '2026-06-28', '동아사이언스', '네이버', '멸종은 실패가 아니다: 생물다양성으로 다시 읽는 진화',
      '생물다양성의 형성 과정을 변이와 자연선택의 관점에서 설명하며, 멸종과 적응을 목적이 아닌 선택의 결과로 이해하도록 돕는다.',
      '생물다양성, 변이, 자연선택, 진화, 멸종, 적응', '생명과학 분야', '변이, 자연선택, 생물다양성',
      '"생물이 필요해서 진화했다"는 서술의 오개념을 지적하고, 개체군의 형질 빈도 변화로 다시 설명해 보자.\n특정 환경 변화가 개체군의 형질 빈도에 미치는 영향을 자료를 근거로 설명하는 탐구를 설계해 보자.\n생물다양성 감소가 생태계 회복력에 미치는 영향을 조사하고 보전 방안을 제안해 보자.']
  ];
  var table = [headers].concat(rows);
  sh.getRange(1, 1, table.length, headers.length).setValues(table);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sh.setColumnWidth(6, 320); sh.setColumnWidth(10, 420);
  SpreadsheetApp.getActive().toast('Articles 탭 생성 완료. 웹 앱을 배포하세요.', '완료', 5);
}
