/**
 * 책갈피 — 독서교육 웹앱 (Google Apps Script 간소화 버전)
 *
 * 데이터: 구글 시트(자동 생성) / 로그인: 구글 계정
 * 포함: 학급 만들기·참여, 도서 등록·삭제, 문장 수집, 교사의 학생 문장 열람, 산파법 챗봇(Gemini)
 *
 * 배포 방법은 apps-script/README.md 참고.
 * AI 키는 프로젝트 설정 → 스크립트 속성에 AI_API_KEY 로 저장(코드에 넣지 말 것).
 */

var SHEETS = {
  Classes: ['id', 'name', 'teacherEmail', 'joinCode', 'createdAt'],
  Members: ['classId', 'email', 'displayName', 'role', 'joinedAt'],
  Books: ['id', 'classId', 'title', 'author', 'createdAt'],
  Sentences: ['id', 'classId', 'bookId', 'quote', 'page', 'reason', 'interpretation', 'question', 'tags', 'email', 'displayName', 'createdAt'],
};

var STAGE_ORDER = ['OBSERVE', 'INTERPRET', 'EVIDENCE', 'COUNTERARGUMENT', 'CONNECT', 'ORGANIZE', 'COMPLETE'];

// ─────────────────────────────────────────────────────────────
// 웹앱 진입점
// ─────────────────────────────────────────────────────────────
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('책갈피 · 독서교육')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ─────────────────────────────────────────────────────────────
// 시트(DB) 헬퍼
// ─────────────────────────────────────────────────────────────
function getDb_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SHEET_ID');
  var ss;
  if (id) {
    try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create('책갈피 데이터 (독서교육 앱)');
    props.setProperty('SHEET_ID', ss.getId());
  }
  return ss;
}

function getSheet_(name) {
  var ss = getDb_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(SHEETS[name]);
  } else if (sh.getLastRow() === 0) {
    sh.appendRow(SHEETS[name]);
  }
  return sh;
}

function rows_(name) {
  var sh = getSheet_(name);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var header = values[0];
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var obj = { _row: i + 1 };
    for (var j = 0; j < header.length; j++) obj[header[j]] = values[i][j];
    out.push(obj);
  }
  return out;
}

function append_(name, obj) {
  var sh = getSheet_(name);
  var header = SHEETS[name];
  var row = header.map(function (h) { return obj[h] != null ? obj[h] : ''; });
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { sh.appendRow(row); } finally { lock.releaseLock(); }
}

function deleteRows_(name, predicate) {
  var sh = getSheet_(name);
  var data = rows_(name);
  var toDelete = data.filter(predicate).map(function (r) { return r._row; });
  // 뒤에서부터 삭제(행 번호 밀림 방지)
  toDelete.sort(function (a, b) { return b - a; });
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { toDelete.forEach(function (r) { sh.deleteRow(r); }); } finally { lock.releaseLock(); }
  return toDelete.length;
}

// ─────────────────────────────────────────────────────────────
// 사용자/권한
// ─────────────────────────────────────────────────────────────
function me_() {
  var email = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || '';
  return email;
}

function getMe() {
  var email = me_();
  return { email: email, identified: !!email };
}

function requireEmail_() {
  var email = me_();
  if (!email) throw new Error('구글 계정 정보를 읽지 못했습니다. 학교 구글 계정으로 로그인했는지 확인하세요.');
  return email;
}

function classById_(classId) {
  var list = rows_('Classes').filter(function (c) { return String(c.id) === String(classId); });
  return list[0] || null;
}

function isMember_(classId, email) {
  return rows_('Members').some(function (m) {
    return String(m.classId) === String(classId) && m.email === email;
  });
}

function isTeacher_(classId, email) {
  var c = classById_(classId);
  return !!c && c.teacherEmail === email;
}

function randomCode_() {
  var abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  var s = '';
  for (var i = 0; i < 6; i++) s += abc.charAt(Math.floor(Math.random() * abc.length));
  // 중복 방지
  var exists = rows_('Classes').some(function (c) { return c.joinCode === s; });
  return exists ? randomCode_() : s;
}

// ─────────────────────────────────────────────────────────────
// 학급
// ─────────────────────────────────────────────────────────────
function createClass(name) {
  var email = requireEmail_();
  name = String(name || '').trim();
  if (name.length < 2) throw new Error('학급명을 2자 이상 입력하세요.');
  var id = Utilities.getUuid();
  var code = randomCode_();
  var now = new Date().toISOString();
  append_('Classes', { id: id, name: name, teacherEmail: email, joinCode: code, createdAt: now });
  append_('Members', { classId: id, email: email, displayName: emailName_(email), role: 'teacher', joinedAt: now });
  return { id: id, name: name, joinCode: code, role: 'teacher' };
}

function joinClass(code, displayName) {
  var email = requireEmail_();
  code = String(code || '').trim().toUpperCase();
  var c = rows_('Classes').filter(function (x) { return x.joinCode === code; })[0];
  if (!c) return { status: 'invalid' };
  if (isMember_(c.id, email)) return { status: 'already', classId: c.id, name: c.name };
  var name = String(displayName || '').trim() || emailName_(email);
  append_('Members', { classId: c.id, email: email, displayName: name, role: 'student', joinedAt: new Date().toISOString() });
  return { status: 'joined', classId: c.id, name: c.name };
}

function emailName_(email) {
  return String(email || '').split('@')[0] || '학생';
}

function getMyClasses() {
  var email = requireEmail_();
  var mine = rows_('Members').filter(function (m) { return m.email === email; });
  return mine.map(function (m) {
    var c = classById_(m.classId);
    return c ? { id: c.id, name: c.name, role: m.role, joinCode: c.teacherEmail === email ? c.joinCode : '' } : null;
  }).filter(Boolean);
}

function getClassInfo(classId) {
  var email = requireEmail_();
  if (!isMember_(classId, email)) throw new Error('학급 구성원이 아닙니다.');
  var c = classById_(classId);
  var isT = c.teacherEmail === email;
  var members = isT ? rows_('Members').filter(function (m) { return String(m.classId) === String(classId); })
    .map(function (m) { return { displayName: m.displayName, role: m.role }; }) : [];
  return {
    id: c.id, name: c.name, isTeacher: isT,
    joinCode: isT ? c.joinCode : '',
    members: members,
  };
}

// ─────────────────────────────────────────────────────────────
// 도서
// ─────────────────────────────────────────────────────────────
function getBooks(classId) {
  var email = requireEmail_();
  if (!isMember_(classId, email)) throw new Error('권한이 없습니다.');
  return rows_('Books').filter(function (b) { return String(b.classId) === String(classId); })
    .map(function (b) { return { id: b.id, title: b.title, author: b.author }; });
}

function addBook(classId, title, author) {
  var email = requireEmail_();
  if (!isTeacher_(classId, email)) throw new Error('도서 등록은 담당 교사만 가능합니다.');
  title = String(title || '').trim();
  if (!title) throw new Error('제목을 입력하세요.');
  var id = Utilities.getUuid();
  append_('Books', { id: id, classId: classId, title: title, author: String(author || '').trim(), createdAt: new Date().toISOString() });
  return { id: id };
}

function deleteBook(classId, bookId) {
  var email = requireEmail_();
  if (!isTeacher_(classId, email)) throw new Error('삭제는 담당 교사만 가능합니다.');
  deleteRows_('Books', function (b) { return String(b.id) === String(bookId); });
  // 관련 문장도 함께 삭제
  deleteRows_('Sentences', function (s) { return String(s.bookId) === String(bookId); });
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// 문장 카드
// ─────────────────────────────────────────────────────────────
function addSentence(classId, data) {
  var email = requireEmail_();
  if (!isMember_(classId, email)) throw new Error('학급 구성원이 아닙니다.');
  if (!data || !String(data.quote || '').trim()) throw new Error('수집한 문장을 입력하세요.');
  if (!String(data.reason || '').trim()) throw new Error('선택한 이유를 입력하세요.');
  if (!String(data.interpretation || '').trim()) throw new Error('자신의 해석을 입력하세요.');
  var member = rows_('Members').filter(function (m) { return String(m.classId) === String(classId) && m.email === email; })[0];
  append_('Sentences', {
    id: Utilities.getUuid(), classId: classId, bookId: data.bookId || '',
    quote: String(data.quote).trim(), page: String(data.page || '').trim(),
    reason: String(data.reason).trim(), interpretation: String(data.interpretation).trim(),
    question: String(data.question || '').trim(), tags: String(data.tags || '').trim(),
    email: email, displayName: member ? member.displayName : emailName_(email),
    createdAt: new Date().toISOString(),
  });
  return { ok: true };
}

function getSentences(classId) {
  var email = requireEmail_();
  if (!isMember_(classId, email)) throw new Error('권한이 없습니다.');
  var isT = isTeacher_(classId, email);
  var books = {};
  getBooks(classId).forEach(function (b) { books[b.id] = b.title; });
  return rows_('Sentences')
    .filter(function (s) { return String(s.classId) === String(classId) && (isT || s.email === email); })
    .map(function (s) {
      return {
        id: s.id, quote: s.quote, page: s.page, reason: s.reason,
        interpretation: s.interpretation, question: s.question, tags: s.tags,
        bookTitle: books[s.bookId] || '', author: isT ? s.displayName : '',
        mine: s.email === email,
      };
    })
    .reverse();
}

function deleteSentence(classId, sentenceId) {
  var email = requireEmail_();
  var s = rows_('Sentences').filter(function (x) { return String(x.id) === String(sentenceId); })[0];
  if (!s) throw new Error('문장을 찾을 수 없습니다.');
  if (s.email !== email) throw new Error('본인 문장만 삭제할 수 있습니다.');
  deleteRows_('Sentences', function (x) { return String(x.id) === String(sentenceId); });
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// 산파법 챗봇 (Gemini). 상태는 클라이언트가 관리하고, 서버는 질문 하나만 생성.
// ─────────────────────────────────────────────────────────────
function nextStage_(stage) {
  var i = STAGE_ORDER.indexOf(stage);
  if (i < 0 || i >= STAGE_ORDER.length - 1) return 'COMPLETE';
  return STAGE_ORDER[i + 1];
}

var STAGE_GOAL_ = {
  OBSERVE: '인상 깊은 문장·장면, 반복되는 단어, 처음 느낀 감정을 확인한다.',
  INTERPRET: '학생의 해석과 근거를 확인하고 다른 해석 가능성을 탐색한다.',
  EVIDENCE: '해석을 뒷받침하는 책 속 근거(인물의 말·행동)를 찾게 한다.',
  COUNTERARGUMENT: '반대 관점, 저자의 한계, 다른 독자의 비판을 예상하게 한다.',
  CONNECT: '자신의 경험·다른 책·사회 문제와 연결하게 한다.',
  ORGANIZE: '중심 주장·핵심 근거·예상 반론·결론을 스스로 정리하게 한다.',
  COMPLETE: '지금까지의 생각을 학생이 직접 요약하도록 돕는다. 서평을 대신 쓰지 않는다.',
};

var CANNED_ = {
  OBSERVE: { q: '이 책에서 가장 인상 깊었던 문장이나 장면은 무엇이었나요? 그때 어떤 느낌이 들었는지도 적어 보세요.', h: '반복되는 단어나 마음이 멈칫한 부분을 떠올려 보세요.' },
  INTERPRET: { q: '방금 고른 부분을 당신은 어떻게 해석했나요? 그렇게 읽은 이유는 무엇인가요?', h: '정답보다, 왜 그렇게 느꼈는지 근거를 떠올려 보세요.' },
  EVIDENCE: { q: '그 해석을 뒷받침하는 책 속 장면이나 문장은 무엇인가요?', h: '인물의 말이나 행동을 찾아보세요.' },
  COUNTERARGUMENT: { q: '당신의 해석과 반대되는 관점, 또는 저자의 아쉬운 점은 무엇일까요?', h: '다른 독자라면 어떤 점을 비판할지 상상해 보세요.' },
  CONNECT: { q: '이 책의 문제의식은 당신의 경험이나 다른 책, 사회 문제와 어떻게 연결되나요?', h: '과학·윤리·정책 같은 영역과 이어 보아도 좋아요.' },
  ORGANIZE: { q: '서평으로 옮긴다면 중심 주장과 가장 중요한 근거는 무엇인가요?', h: '주장 → 근거 → 예상 반론 → 결론 순으로 정리해 보세요.' },
  COMPLETE: { q: '오늘 나눈 생각을 당신의 말로 한두 문장으로 요약해 볼까요? 이 요약이 서평의 출발점이 됩니다.', h: '요약은 스스로 씁니다. 이 도구는 대신 써 주지 않아요.' },
};

var SYSTEM_ = '당신은 한국 고등학생의 독서 사고를 돕는 독서 산파법 안내자입니다. 규칙: 1) 서평을 대신 써 주지 않는다(완성 글 금지). 2) 한 번에 질문 하나만. 3) 스스로 생각하게 하는 열린 질문. 4) 개인정보를 묻지 않는다. 5) 반드시 JSON {"question":"한 개의 질문","hint":"짧은 힌트"} 형식으로만, 한국어 존댓말 200자 이내로 응답한다.';

/**
 * @param payload {stage, bookTitle, bookAuthor, quotes:[], history:[{role,content}]}
 * @return {stage, question, hint, nextStage, source}
 */
function askSocratic(payload) {
  var stage = (payload && payload.stage) || 'OBSERVE';
  if (STAGE_ORDER.indexOf(stage) < 0) stage = 'OBSERVE';
  var key = PropertiesService.getScriptProperties().getProperty('AI_API_KEY');
  var next = nextStage_(stage);

  if (!key) {
    var c = CANNED_[stage];
    return { stage: stage, question: c.q, hint: c.h, nextStage: next, source: 'mock' };
  }

  try {
    var model = PropertiesService.getScriptProperties().getProperty('AI_MODEL') || 'gemini-flash-latest';
    var lines = [];
    lines.push('책 제목: ' + (payload.bookTitle || '책'));
    if (payload.bookAuthor) lines.push('저자: ' + payload.bookAuthor);
    lines.push('현재 단계: ' + stage + ' (' + STAGE_GOAL_[stage] + ')');
    if (payload.quotes && payload.quotes.length) {
      lines.push('학생이 수집한 문장:');
      payload.quotes.slice(0, 5).forEach(function (q) { lines.push('- "' + q + '"'); });
    }
    if (payload.history && payload.history.length) {
      lines.push('최근 대화:');
      payload.history.slice(-6).forEach(function (m) {
        lines.push((m.role === 'assistant' ? '안내자' : '학생') + ': ' + m.content);
      });
    }
    lines.push('현재 단계에 맞는 질문 하나만 JSON으로 제시하세요. 서평을 대신 쓰지 마세요.');

    var body = {
      systemInstruction: { parts: [{ text: SYSTEM_ }] },
      contents: [{ role: 'user', parts: [{ text: lines.join('\n') }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024, responseMimeType: 'application/json' },
    };
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(key);
    var res = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify(body), muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) throw new Error('AI ' + res.getResponseCode());
    var data = JSON.parse(res.getContentText());
    var text = data.candidates[0].content.parts[0].text;
    var obj = JSON.parse(text);
    var q = String(obj.question || '').trim();
    if (!q) throw new Error('빈 응답');
    return {
      stage: stage,
      question: q.slice(0, 500),
      hint: obj.hint ? String(obj.hint).slice(0, 300) : '',
      nextStage: next,
      source: 'gemini',
    };
  } catch (e) {
    var m = CANNED_[stage];
    return { stage: stage, question: m.q, hint: m.h, nextStage: next, source: 'mock' };
  }
}
