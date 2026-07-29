/**
 * 책갈피 — 독서교육 웹앱 (Google Apps Script 간소화 버전)
 *
 * 데이터: 구글 시트(자동 생성) / 로그인: 구글 계정
 * 포함: 학급 만들기·참여, 도서 등록·삭제, 문장 수집(교사·학생), 질문 게시판(질문+댓글 토론),
 *       교사의 학생 기록 열람, 데이터 자동 저장(구글 시트)
 *
 * 배포 방법은 apps-script/README.md 참고.
 */

var SHEETS = {
  Classes: ['id', 'name', 'teacherEmail', 'joinCode', 'createdAt'],
  Members: ['classId', 'email', 'displayName', 'role', 'joinedAt'],
  Books: ['id', 'classId', 'title', 'author', 'createdAt'],
  Sentences: ['createdAt', 'className', 'bookTitle', 'displayName', 'quote', 'page', 'reason', 'interpretation', 'question', 'tags', 'email', 'id', 'classId', 'bookId'],
  Questions: ['createdAt', 'className', 'bookTitle', 'displayName', 'question', 'email', 'id', 'classId', 'bookId'],
  Comments: ['createdAt', 'displayName', 'body', 'email', 'id', 'questionId', 'classId'],
};

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

function nowStr_() {
  var tz = Session.getScriptTimeZone() || 'Asia/Seoul';
  return Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm');
}

/** 교사용: 데이터 스프레드시트 URL(담당 교사만). */
function getSheetUrl(classId) {
  var email = requireEmail_();
  if (!isTeacher_(classId, email)) throw new Error('담당 교사만 열 수 있습니다.');
  return getDb_().getUrl();
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
  var cls = classById_(classId);
  var book = rows_('Books').filter(function (b) { return String(b.id) === String(data.bookId); })[0];
  append_('Sentences', {
    id: Utilities.getUuid(), classId: classId, bookId: data.bookId || '',
    className: cls ? cls.name : '', bookTitle: book ? book.title : '',
    quote: String(data.quote).trim(), page: String(data.page || '').trim(),
    reason: String(data.reason).trim(), interpretation: String(data.interpretation).trim(),
    question: String(data.question || '').trim(), tags: String(data.tags || '').trim(),
    email: email, displayName: member ? member.displayName : emailName_(email),
    createdAt: nowStr_(),
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
        bookTitle: s.bookTitle || books[s.bookId] || '',
        author: s.displayName || '',
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
// 질문 게시판 (학생·교사가 질문을 만들고, 서로 댓글로 토론)
// ─────────────────────────────────────────────────────────────
function addQuestion(classId, data) {
  var email = requireEmail_();
  if (!isMember_(classId, email)) throw new Error('학급 구성원이 아닙니다.');
  var q = String((data && data.question) || '').trim();
  if (!q) throw new Error('질문 내용을 입력하세요.');
  var cls = classById_(classId);
  var book = rows_('Books').filter(function (b) { return String(b.id) === String(data.bookId); })[0];
  var member = rows_('Members').filter(function (m) { return String(m.classId) === String(classId) && m.email === email; })[0];
  append_('Questions', {
    id: Utilities.getUuid(), classId: classId, bookId: (data && data.bookId) || '',
    className: cls ? cls.name : '', bookTitle: book ? book.title : '',
    question: q, email: email, displayName: member ? member.displayName : emailName_(email),
    createdAt: nowStr_(),
  });
  return { ok: true };
}

function getQuestions(classId) {
  var email = requireEmail_();
  if (!isMember_(classId, email)) throw new Error('권한이 없습니다.');
  var counts = {};
  rows_('Comments').forEach(function (c) {
    if (String(c.classId) === String(classId)) counts[c.questionId] = (counts[c.questionId] || 0) + 1;
  });
  return rows_('Questions')
    .filter(function (q) { return String(q.classId) === String(classId); })
    .map(function (q) {
      return {
        id: q.id, question: q.question, bookTitle: q.bookTitle || '',
        author: q.displayName || '', mine: q.email === email,
        commentCount: counts[q.id] || 0, createdAt: q.createdAt,
      };
    })
    .reverse();
}

function deleteQuestion(classId, questionId) {
  var email = requireEmail_();
  var q = rows_('Questions').filter(function (x) { return String(x.id) === String(questionId); })[0];
  if (!q) throw new Error('질문을 찾을 수 없습니다.');
  if (q.email !== email && !isTeacher_(classId, email)) throw new Error('본인 또는 담당 교사만 삭제할 수 있습니다.');
  deleteRows_('Questions', function (x) { return String(x.id) === String(questionId); });
  deleteRows_('Comments', function (x) { return String(x.questionId) === String(questionId); });
  return { ok: true };
}

function getComments(classId, questionId) {
  var email = requireEmail_();
  if (!isMember_(classId, email)) throw new Error('권한이 없습니다.');
  return rows_('Comments')
    .filter(function (c) { return String(c.questionId) === String(questionId); })
    .map(function (c) {
      return { id: c.id, body: c.body, author: c.displayName || '', mine: c.email === email, createdAt: c.createdAt };
    });
}

function addComment(classId, questionId, body) {
  var email = requireEmail_();
  if (!isMember_(classId, email)) throw new Error('학급 구성원이 아닙니다.');
  body = String(body || '').trim();
  if (!body) throw new Error('댓글 내용을 입력하세요.');
  var member = rows_('Members').filter(function (m) { return String(m.classId) === String(classId) && m.email === email; })[0];
  append_('Comments', {
    id: Utilities.getUuid(), questionId: questionId, classId: classId, body: body,
    email: email, displayName: member ? member.displayName : emailName_(email), createdAt: nowStr_(),
  });
  return { ok: true };
}

function deleteComment(classId, commentId) {
  var email = requireEmail_();
  var c = rows_('Comments').filter(function (x) { return String(x.id) === String(commentId); })[0];
  if (!c) throw new Error('댓글을 찾을 수 없습니다.');
  if (c.email !== email && !isTeacher_(classId, email)) throw new Error('본인 또는 담당 교사만 삭제할 수 있습니다.');
  deleteRows_('Comments', function (x) { return String(x.id) === String(commentId); });
  return { ok: true };
}
