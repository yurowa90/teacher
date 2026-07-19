/**
 * 과학 독서·논술 포트폴리오 — Google Apps Script 서버
 *
 * 구조: 구글 시트(자료 + 질문) → Apps Script가 웹앱까지 같은 출처에서 서빙.
 *   - CORS/CSP 문제 없음(HtmlService + google.script.run)
 *   - 교사는 구글 시트만 편집하면 자료·활동·루브릭·오개념이 앱에 반영됨
 *   - 학생 답안·교사 리뷰는 다시 시트에 저장(포트폴리오 기록 누적)
 *
 * 사용법:
 *   1) 스프레드시트에서 확장 프로그램 → Apps Script 로 이 코드를 붙여넣기
 *   2) 함수 setupSheets 를 한 번 실행(탭·샘플 데이터 생성)
 *   3) 배포 → 새 배포 → 웹 앱 → 실행: 나 / 액세스: (원하는 범위) → 배포
 *
 * 금지 원칙 유지: 로그인 강제·외부 API·AI 자동채점 없음. 교사가 최종 평가자.
 * 개인정보 최소화: 익명 학생 라벨만 사용(실명·학번 저장 금지).
 */

var SHEETS = {
  MODULE: 'Module',
  ACTIVITIES: 'Activities',
  RUBRIC: 'Rubric',
  MISCONCEPTIONS: 'Misconceptions',
  STUDENTS: 'Students',
  RESPONSES: 'Responses',
  REVIEWS: 'Reviews'
};

/** 웹앱 진입점 — Index.html 서빙 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('과학 독서·논술 포트폴리오')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ============================================================
   읽기 (클라이언트 → google.script.run.getModule 등)
   ============================================================ */

function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('시트 탭이 없습니다: ' + name + ' — setupSheets 를 먼저 실행하세요.');
  return sh;
}

// 헤더가 있는 표를 객체 배열로 반환
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
    for (var j = 0; j < headers.length; j++) {
      if (headers[j]) obj[headers[j]] = row[j];
    }
    rows.push(obj);
  }
  return rows;
}

// 활동의 resource 셀 파싱: {"type":"table",...} JSON 또는 일반 텍스트
function parseResource_(cell) {
  var s = String(cell == null ? '' : cell).trim();
  if (!s) return null;
  if (s.charAt(0) === '{') {
    try {
      var obj = JSON.parse(s);
      if (obj && obj.type) return obj;
    } catch (err) { /* JSON 아니면 텍스트로 처리 */ }
  }
  return { type: 'text', body: s };
}

/** 모듈 전체(자료·활동·루브릭·오개념·학생)를 반환 */
function getModule() {
  var moduleRows = readTable_(SHEETS.MODULE); // key, value 컬럼
  var module = { title: '', book: '', subject: '', standard: '', intro: '' };
  moduleRows.forEach(function (r) {
    var k = String(r.key || r.Key || '').trim();
    if (k && module.hasOwnProperty(k)) module[k] = String(r.value || r.Value || '');
  });

  var activities = readTable_(SHEETS.ACTIVITIES).map(function (r, i) {
    return {
      code: String(r.code || ('Q' + (i + 1))).trim(),
      level: String(r.level || ''),
      type: String(r.type || 'essay'),
      title: String(r.title || ''),
      prompt: String(r.prompt || ''),
      resource: parseResource_(r.resource)
    };
  }).filter(function (a) { return a.code; });

  var rubric = readTable_(SHEETS.RUBRIC).map(function (r) {
    return { label: String(r.label || ''), description: String(r.description || '') };
  }).filter(function (c) { return c.label; });

  var misconceptions = readTable_(SHEETS.MISCONCEPTIONS).map(function (r) {
    return { label: String(r.label || ''), feedback: String(r.feedback || '') };
  }).filter(function (m) { return m.label; });

  var students = readTable_(SHEETS.STUDENTS).map(function (r) {
    return { studentId: String(r.studentId || '').trim(), segment: String(r.segment || 'standard') };
  }).filter(function (s) { return s.studentId; });
  if (!students.length) {
    students = [
      { studentId: 'S-001', segment: 'standard' }, { studentId: 'S-002', segment: 'standard' },
      { studentId: 'S-003', segment: 'scaffold' }, { studentId: 'S-004', segment: 'advanced' },
      { studentId: 'S-005', segment: 'standard' }
    ];
  }

  return { module: module, activities: activities, rubric: rubric, misconceptions: misconceptions, students: students };
}

/** 학생 응답 전체(교사 대시보드/특정 학생 화면용) */
function getResponses() {
  return readTable_(SHEETS.RESPONSES).map(function (r) {
    return {
      studentId: String(r.studentId || ''), code: String(r.code || ''),
      content: String(r.content || ''), updatedAt: String(r.updatedAt || '')
    };
  }).filter(function (r) { return r.studentId && r.code; });
}

/** 교사 리뷰 전체 */
function getReviews() {
  return readTable_(SHEETS.REVIEWS).map(function (r) {
    var scores = {}; var misc = [];
    try { scores = r.scores ? JSON.parse(r.scores) : {}; } catch (e) { scores = {}; }
    try { misc = r.misconceptions ? JSON.parse(r.misconceptions) : []; } catch (e) { misc = []; }
    return {
      studentId: String(r.studentId || ''), code: String(r.code || ''),
      scores: scores, misconceptions: misc,
      feedback: String(r.feedback || ''), updatedAt: String(r.updatedAt || '')
    };
  }).filter(function (r) { return r.studentId && r.code; });
}

/** 초기 로드 한 번에 (왕복 최소화) */
function getBootstrap() {
  return { data: getModule(), responses: getResponses(), reviews: getReviews() };
}

/* ============================================================
   쓰기 (upsert) — 동시 쓰기 보호를 위해 LockService 사용
   ============================================================ */

// (studentId, code)로 기존 행을 찾아 갱신, 없으면 추가
function upsertRow_(sheetName, headers, keyCols, values) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_(sheetName);
    var range = sh.getDataRange();
    var data = range.getValues();
    var head = data.length ? data[0].map(function (h) { return String(h).trim(); }) : headers;
    var idx = {};
    head.forEach(function (h, i) { idx[h] = i; });

    var foundRow = -1;
    for (var i = 1; i < data.length; i++) {
      var match = keyCols.every(function (k) { return String(data[i][idx[k]]) === String(values[k]); });
      if (match) { foundRow = i; break; }
    }
    var rowArr = head.map(function (h) { return values.hasOwnProperty(h) ? values[h] : ''; });
    if (foundRow >= 0) {
      sh.getRange(foundRow + 1, 1, 1, rowArr.length).setValues([rowArr]);
    } else {
      sh.appendRow(rowArr);
    }
    return true;
  } finally {
    lock.releaseLock();
  }
}

/** 학생 답안 저장(upsert) */
function saveResponse(studentId, code, content) {
  studentId = String(studentId || '').trim();
  code = String(code || '').trim();
  if (!studentId || !code) throw new Error('studentId, code 가 필요합니다.');
  var updatedAt = new Date().toISOString();
  upsertRow_(SHEETS.RESPONSES, ['studentId', 'code', 'content', 'updatedAt'],
    ['studentId', 'code'],
    { studentId: studentId, code: code, content: String(content || ''), updatedAt: updatedAt });
  return { ok: true, updatedAt: updatedAt };
}

/** 교사 리뷰 저장(upsert). 교사가 최종 판단자. */
function saveReview(studentId, code, scores, misconceptions, feedback) {
  studentId = String(studentId || '').trim();
  code = String(code || '').trim();
  if (!studentId || !code) throw new Error('studentId, code 가 필요합니다.');
  var updatedAt = new Date().toISOString();
  upsertRow_(SHEETS.REVIEWS, ['studentId', 'code', 'scores', 'misconceptions', 'feedback', 'updatedAt'],
    ['studentId', 'code'],
    {
      studentId: studentId, code: code,
      scores: JSON.stringify(scores || {}),
      misconceptions: JSON.stringify(misconceptions || []),
      feedback: String(feedback || ''), updatedAt: updatedAt
    });
  return { ok: true, updatedAt: updatedAt };
}

/* ============================================================
   초기 설정 — 탭/헤더/샘플 데이터 생성 (한 번 실행)
   기존 탭이 있으면 건너뜀. 샘플(생물학/진화)은 예시일 뿐 교사가 자유롭게 교체.
   ============================================================ */

function setupSheets() {
  var ss = ss_();

  function ensure(name, headers, rows) {
    var sh = ss.getSheetByName(name);
    if (sh) return sh; // 이미 있으면 유지
    sh = ss.insertSheet(name);
    var table = [headers].concat(rows || []);
    sh.getRange(1, 1, table.length, headers.length).setValues(table);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    return sh;
  }

  ensure(SHEETS.MODULE, ['key', 'value'], [
    ['title', "생명체의 구조는 '필요해서 생긴 것'인가, '선택되어 남은 것'인가?"],
    ['book', '이것이 생물학이다 (예시)'],
    ['subject', '통합과학2'],
    ['standard', '[10통과2-01-02]'],
    ['intro', '변이·자연선택·진화·생물다양성을 다루는 예시 단원입니다. 시트를 편집해 실제 도서·성취기준으로 바꾸세요.']
  ]);

  ensure(SHEETS.ACTIVITIES, ['code', 'level', 'type', 'title', 'prompt', 'resource'], [
    ['A1', 'A형 비계', 'keyword', '핵심어 이해', '변이, 자연선택, 진화, 개체군, 생물다양성, 목적론을 자신의 말로 정리하시오.', ''],
    ['A2', 'A형 비계', 'sentence', '긴 문장 쪼개기', '자연선택 과정을 원인-과정-결과로 나누어 설명하시오.', ''],
    ['B1', 'B형 표준', 'data', '자료 해석', '형질 빈도 변화 자료를 해석하고 자연선택 개념과 연결하시오. 자료만으로 알 수 없는 한계도 함께 쓰시오.',
      JSON.stringify({ type: 'table', caption: '세대별 몸색 형질 빈도 변화 (일부 정보는 의도적으로 제시되지 않음)',
        headers: ['세대', '밝은 몸색 비율', '어두운 몸색 비율', '환경 배경', '표본 수', '제시되지 않은 정보'],
        rows: [['1세대', '80%', '20%', '밝음', '200', '생존율, 번식률'], ['5세대', '65%', '35%', '점차 어두워짐', '160', '포식률'],
          ['10세대', '40%', '60%', '어두움', '120', '형질 유전 여부'], ['15세대', '25%', '75%', '어두움', '90', '다른 환경 요인']] })],
    ['B2', 'B형 표준', 'essay', '논술형 답안 초안', '환경 변화가 개체군의 형질 빈도 변화에 미치는 영향을 자연선택 개념으로 설명하시오. 변이, 자연선택, 진화 중 2개 이상을 사용하고, 개체가 스스로 변한 것이 아니라 개체군의 형질 빈도가 변했음을 포함하시오.', ''],
    ['B3', 'B형 표준', 'revision', '논술형 답안 수정본', '교사 피드백을 반영하여 B2 답안을 수정하시오. 수정한 부분이 무엇인지 마지막 문장에 쓰시오.', ''],
    ['C1', 'C형 심화', 'inquiry', '탐구 질문 고도화', '넓은 질문을 대상·변인·조건이 포함된 탐구 가능 질문으로 바꾸시오. 독립변인, 종속변인, 필요한 자료도 함께 쓰시오.', ''],
    ['D1', 'C형 심화', 'aiCritique', 'AI·빅데이터 비판', 'AI가 생물 사진을 분류할 때 특정 지역이나 특정 생물군 자료가 부족하면 생물다양성 이해에 어떤 왜곡이 생길 수 있는지 설명하시오.', ''],
    ['E1', '포트폴리오', 'reflection', '성찰 기록', '읽기 전후 생각 변화, 수정한 오개념, 다음에 탐구하고 싶은 질문을 기록하시오.', '']
  ]);

  ensure(SHEETS.RUBRIC, ['label', 'description'], [
    ['개념 정확성', '핵심 개념을 정확히 구분하고 연결하는가'],
    ['자료 해석', '자료의 수치 변화와 한계를 해석하고 개념과 연결하는가'],
    ['논증 구조', '주장-근거-결론 구조가 명확한가'],
    ['개념 전이', '새로운 사례나 탐구 질문에 개념을 적용하는가'],
    ['비판적 검증', '자료·AI 활용의 유용성, 편향, 검증 필요성을 균형 있게 설명하는가'],
    ['성찰', '읽기 전후 생각 변화와 수정한 오개념을 구체적으로 기록하는가']
  ]);

  ensure(SHEETS.MISCONCEPTIONS, ['label', 'feedback'], [
    ['목적론: 필요해서 생겼다', '필요해서 직접 생긴 것이 아니라, 유리한 형질을 가진 개체가 더 많이 남은 과정으로 설명하십시오.'],
    ['개체 변화: 개체가 스스로 변했다', '한 개체가 바뀐 것이 아니라, 세대를 거치며 개체군 안의 형질 비율이 달라진 것입니다.'],
    ['환경 결정론', '환경 변화만으로는 부족합니다. 변이와 생존·번식 차이를 함께 설명해야 합니다.'],
    ['변이 누락', '자연선택이 작동하려면 개체군 안에 변이가 먼저 존재해야 합니다.'],
    ['자료 수치 근거 부족', '몇 세대에서 몇 %로 바뀌었는지 수치를 근거로 사용하십시오.'],
    ['AI 비판 피상적', '어떤 데이터가 부족하거나 편향될 때 어떤 오류가 생기는지 구체적으로 쓰십시오.']
  ]);

  ensure(SHEETS.STUDENTS, ['studentId', 'segment'], [
    ['S-001', 'standard'], ['S-002', 'standard'], ['S-003', 'scaffold'], ['S-004', 'advanced'], ['S-005', 'standard']
  ]);

  ensure(SHEETS.RESPONSES, ['studentId', 'code', 'content', 'updatedAt'], []);
  ensure(SHEETS.REVIEWS, ['studentId', 'code', 'scores', 'misconceptions', 'feedback', 'updatedAt'], []);

  SpreadsheetApp.getUi && SpreadsheetApp.getActive().toast('시트 설정 완료. 웹 앱을 배포하세요.', '완료', 5);
}

/** HTML include 헬퍼(필요 시) */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
