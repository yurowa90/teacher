/* ============================================================
   과학 독서·논술 포트폴리오 — Stage 1.1 Static Bundled MVP
   데이터 · localStorage 저장 · 지표 계산 · UI 렌더링 · 내보내기를
   모두 포함한 단일 번들 파일입니다. (Stage 2에서 모듈로 분리 예정)
   저장소: localStorage 만 사용
   금지: 로그인 / 서버 DB / 외부 API / AI 자동채점 / 실명·학번 저장
   교사가 최종 평가자입니다.
   ============================================================ */

'use strict';

/* ------------------------------------------------------------
   1) 기본 데이터
   ------------------------------------------------------------ */

const students = [
  { studentId: 'S-001', segment: 'standard' },
  { studentId: 'S-002', segment: 'standard' },
  { studentId: 'S-003', segment: 'scaffold' },
  { studentId: 'S-004', segment: 'advanced' },
  { studentId: 'S-005', segment: 'standard' }
];

const activities = [
  { id: 'A1', level: 'A형 비계', type: 'keyword', title: '핵심어 이해',
    prompt: '변이, 자연선택, 진화, 개체군, 생물다양성, 목적론을 자신의 말로 정리하시오.' },
  { id: 'A2', level: 'A형 비계', type: 'sentence', title: '긴 문장 쪼개기',
    prompt: '자연선택 과정을 원인-과정-결과로 나누어 설명하시오.' },
  { id: 'B1', level: 'B형 표준', type: 'data', title: '자료 해석',
    prompt: '형질 빈도 변화 자료를 해석하고 자연선택 개념과 연결하시오. 자료만으로 알 수 없는 한계도 함께 쓰시오.' },
  { id: 'B2', level: 'B형 표준', type: 'essay', title: '논술형 답안 초안',
    prompt: '환경 변화가 개체군의 형질 빈도 변화에 미치는 영향을 자연선택 개념으로 설명하시오. 변이, 자연선택, 진화 중 2개 이상을 사용하고, 개체가 스스로 변한 것이 아니라 개체군의 형질 빈도가 변했음을 포함하시오.' },
  { id: 'B3', level: 'B형 표준', type: 'revision', title: '논술형 답안 수정본',
    prompt: '교사 피드백을 반영하여 B2 답안을 수정하시오. 수정한 부분이 무엇인지 마지막 문장에 쓰시오.' },
  { id: 'C1', level: 'C형 심화', type: 'inquiry', title: '탐구 질문 고도화',
    prompt: '넓은 질문을 대상·변인·조건이 포함된 탐구 가능 질문으로 바꾸시오. 독립변인, 종속변인, 필요한 자료도 함께 쓰시오.' },
  { id: 'D1', level: 'C형 심화', type: 'aiCritique', title: 'AI·빅데이터 비판',
    prompt: 'AI가 생물 사진을 분류할 때 특정 지역이나 특정 생물군 자료가 부족하면 생물다양성 이해에 어떤 왜곡이 생길 수 있는지 설명하시오.' },
  { id: 'E1', level: '포트폴리오', type: 'reflection', title: '성찰 기록',
    prompt: '읽기 전후 생각 변화, 수정한 오개념, 다음에 탐구하고 싶은 질문을 기록하시오.' }
];

// 학생 화면 상단 "오늘의 핵심 개념" 선행 조직자
const conceptGlossary = [
  { term: '변이', desc: '같은 종 안에서 나타나는 형질 차이' },
  { term: '자연선택', desc: '환경에 유리한 형질을 가진 개체가 더 많이 생존·번식하여 그 형질이 더 많이 남는 과정' },
  { term: '진화', desc: '개체군의 형질 빈도가 세대를 거쳐 변화하는 과정' },
  { term: '개체군', desc: '같은 지역에 사는 같은 종의 무리' },
  { term: '생물다양성', desc: '유전적 다양성, 종 다양성, 생태계 다양성을 포함하는 생물의 다양성' },
  { term: '목적론', desc: '"필요해서 생겼다"처럼 어떤 구조가 목적을 위해 직접 생겼다고 보는 (경계해야 할) 설명' }
];

// B2 논술 제출 전 체크리스트
const b2Checklist = [
  '변이를 설명했다.',
  '자연선택을 설명했다.',
  '개체가 스스로 변한 것이 아니라고 썼다.',
  '개체군의 형질 빈도 변화라고 썼다.',
  '자료 또는 발췌문 근거를 사용했다.'
];

// B1 자료 해석용 표 (제시되지 않은 정보 컬럼 포함)
const dataTable = {
  headers: ['세대', '밝은 몸색 개체 비율', '어두운 몸색 개체 비율', '환경 배경', '표본 수', '제시되지 않은 정보'],
  rows: [
    ['1세대', '80%', '20%', '밝음', '200', '생존율, 번식률'],
    ['5세대', '65%', '35%', '점차 어두워짐', '160', '포식률'],
    ['10세대', '40%', '60%', '어두움', '120', '형질 유전 여부'],
    ['15세대', '25%', '75%', '어두움', '90', '다른 환경 요인']
  ]
};

const rubricCriteria = [
  { id: 'conceptAccuracy', label: '개념 정확성', description: '변이, 자연선택, 진화, 생물다양성을 정확히 구분하고 연결하는가' },
  { id: 'dataInterpretation', label: '자료 해석', description: '자료의 수치 변화와 한계를 해석하고 자연선택 개념과 연결하는가' },
  { id: 'argumentStructure', label: '논증 구조', description: '주장-근거-결론 구조가 명확한가' },
  { id: 'conceptTransfer', label: '개념 전이', description: '새로운 생명체 구조나 탐구 질문에 개념을 적용하는가' },
  { id: 'criticalVerification', label: '비판적 검증', description: 'AI·데이터 활용의 유용성, 편향, 검증 필요성을 균형 있게 설명하는가' },
  { id: 'reflection', label: '성찰', description: '읽기 전후 생각 변화와 수정한 오개념을 구체적으로 기록하는가' }
];

const misconceptions = [
  { id: 'teleology', label: '목적론: 필요해서 생겼다',
    feedback: '필요해서 직접 생긴 것이 아니라, 유리한 형질을 가진 개체가 더 많이 남은 과정으로 설명하십시오.' },
  { id: 'individualChange', label: '개체 변화: 개체가 스스로 변했다',
    feedback: '한 개체가 바뀐 것이 아니라, 세대를 거치며 개체군 안의 형질 비율이 달라진 것입니다.' },
  { id: 'environmentDeterminism', label: '환경 결정론: 환경 변화만으로 설명했다',
    feedback: '환경 변화만으로는 부족합니다. 변이와 생존·번식 차이를 함께 설명해야 합니다.' },
  { id: 'missingVariation', label: '변이 누락',
    feedback: '자연선택이 작동하려면 개체군 안에 변이가 먼저 존재해야 합니다.' },
  { id: 'noDataEvidence', label: '자료 수치 근거 부족',
    feedback: '몇 세대에서 몇 %로 바뀌었는지 수치를 근거로 사용하십시오.' },
  { id: 'shallowAICritique', label: 'AI 비판 피상적',
    feedback: '어떤 데이터가 부족하거나 편향될 때 어떤 오류가 생기는지 구체적으로 쓰십시오.' }
];

/* ------------------------------------------------------------
   2) 저장소 (localStorage)
   구조: { currentStudentId, artifacts:{}, reviews:{} }
   키:  artifactKey = `${studentId}::${activityId}`
        reviewKey   = `review::${studentId}::${activityId}`
   ------------------------------------------------------------ */

const STORAGE_KEY = 'srp-mvp-v1';

const artifactKey = (studentId, activityId) => `${studentId}::${activityId}`;
const reviewKey = (studentId, activityId) => `review::${studentId}::${activityId}`;

function nowIso() { return new Date().toISOString(); }
function nowTime() { return new Date().toLocaleTimeString('ko-KR'); }

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { currentStudentId: students[0].studentId, artifacts: {}, reviews: {} };
    const parsed = JSON.parse(raw);
    return {
      currentStudentId: parsed.currentStudentId || students[0].studentId,
      artifacts: parsed.artifacts || {},
      reviews: parsed.reviews || {}
    };
  } catch (e) {
    console.warn('저장소를 읽지 못해 초기화합니다.', e);
    return { currentStudentId: students[0].studentId, artifacts: {}, reviews: {} };
  }
}

let store = loadStore();

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

// ---- Artifact ----
function getArtifact(studentId, activityId) {
  return store.artifacts[artifactKey(studentId, activityId)] || null;
}

function saveArtifact(studentId, activityId, content) {
  const key = artifactKey(studentId, activityId);
  const existing = store.artifacts[key];
  store.artifacts[key] = {
    artifactId: existing ? existing.artifactId : key,
    studentId,
    activityId,
    content,
    stage: activityId === 'B3' ? 'revised' : 'initial',
    updatedAt: nowIso()
  };
  persist();
}

// ---- Review ----
function getReview(studentId, activityId) {
  return store.reviews[reviewKey(studentId, activityId)] || null;
}

function saveReview(studentId, activityId, scores, misconceptionIds, feedback) {
  const key = reviewKey(studentId, activityId);
  const existing = store.reviews[key];
  store.reviews[key] = {
    reviewId: existing ? existing.reviewId : key,
    studentId,
    activityId,
    scores,
    misconceptionIds,
    feedback,
    updatedAt: nowIso()
  };
  persist();
}

/* ------------------------------------------------------------
   3) 지표 계산
   ------------------------------------------------------------ */

function isSubmitted(studentId, activityId) {
  const a = getArtifact(studentId, activityId);
  return !!(a && a.content && a.content.trim().length > 0);
}

function studentProgress(studentId) {
  const done = activities.filter(a => isSubmitted(studentId, a.id)).length;
  return { done, total: activities.length, ratio: activities.length ? done / activities.length : 0 };
}

function activitySubmissionRate(activityId) {
  const done = students.filter(s => isSubmitted(s.studentId, activityId)).length;
  return { done, total: students.length, ratio: students.length ? done / students.length : 0 };
}

function computeMetrics() {
  const totalCells = students.length * activities.length;
  let filled = 0;
  students.forEach(s => activities.forEach(a => { if (isSubmitted(s.studentId, a.id)) filled++; }));

  const essayRate = activitySubmissionRate('B2');
  const revisionRate = activitySubmissionRate('B3');

  const miscFreq = {};
  misconceptions.forEach(m => { miscFreq[m.id] = 0; });
  Object.values(store.reviews).forEach(r => {
    (r.misconceptionIds || []).forEach(id => { if (miscFreq[id] !== undefined) miscFreq[id] += 1; });
  });

  const scoreSum = {}; const scoreCount = {};
  rubricCriteria.forEach(c => { scoreSum[c.id] = 0; scoreCount[c.id] = 0; });
  Object.values(store.reviews).forEach(r => {
    Object.entries(r.scores || {}).forEach(([cid, val]) => {
      if (scoreSum[cid] !== undefined && typeof val === 'number') { scoreSum[cid] += val; scoreCount[cid] += 1; }
    });
  });
  const avgScores = {};
  rubricCriteria.forEach(c => { avgScores[c.id] = scoreCount[c.id] ? scoreSum[c.id] / scoreCount[c.id] : null; });

  const reviewList = Object.values(store.reviews);
  const withFeedback = reviewList.filter(r => r.feedback && r.feedback.trim().length > 0).length;
  const feedbackRate = reviewList.length ? withFeedback / reviewList.length : 0;

  return {
    totalCells, filled,
    emptyRatio: totalCells ? (totalCells - filled) / totalCells : 0,
    essayRate, revisionRate, miscFreq, avgScores, feedbackRate,
    reviewCount: reviewList.length
  };
}

function pct(ratio) { return Math.round(ratio * 100) + '%'; }

/* ------------------------------------------------------------
   4) DOM 참조 & 유틸
   ------------------------------------------------------------ */

const el = {
  btnStudent: document.getElementById('btn-student'),
  btnTeacher: document.getElementById('btn-teacher'),
  studentView: document.getElementById('student-view'),
  teacherView: document.getElementById('teacher-view'),
  studentSelect: document.getElementById('student-select'),
  studentProgress: document.getElementById('student-progress'),
  conceptCard: document.getElementById('concept-card'),
  activityList: document.getElementById('activity-list'),
  metricCards: document.getElementById('metric-cards'),
  progressTable: document.getElementById('progress-table'),
  activityRateTable: document.getElementById('activity-rate-table'),
  miscFreq: document.getElementById('misconception-freq'),
  reviewStudent: document.getElementById('review-student'),
  reviewActivity: document.getElementById('review-activity'),
  btnLoadReview: document.getElementById('btn-load-review'),
  reviewPanel: document.getElementById('review-panel'),
  btnExportJson: document.getElementById('btn-export-json'),
  btnExportCsv: document.getElementById('btn-export-csv'),
  btnResetData: document.getElementById('btn-reset-data')
};

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fillStudentOptions(selectEl) {
  selectEl.innerHTML = students
    .map(s => `<option value="${s.studentId}">${s.studentId} · ${s.segment}</option>`)
    .join('');
}

/* ------------------------------------------------------------
   5) 학생 화면
   ------------------------------------------------------------ */

function renderConceptCard() {
  const items = conceptGlossary
    .map(c => `<li><span class="concept__term">${esc(c.term)}</span><span class="concept__desc">${esc(c.desc)}</span></li>`)
    .join('');
  el.conceptCard.innerHTML = `
    <div class="concept">
      <div class="concept__head">오늘의 핵심 개념</div>
      <ul class="concept__list">${items}</ul>
    </div>`;
}

function renderDataFigure() {
  const head = dataTable.headers.map(h => `<th>${esc(h)}</th>`).join('');
  const body = dataTable.rows
    .map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`)
    .join('');
  return `
    <div class="data-figure">
      <table>
        <caption>제시 자료: 세대별 몸색 형질 빈도 변화 (일부 정보는 의도적으로 제시되지 않음)</caption>
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

function renderChecklist(activityId) {
  if (activityId !== 'B2') return '';
  const items = b2Checklist.map((t, i) =>
    `<li><label><input type="checkbox" data-check="${activityId}-${i}" /> ${esc(t)}</label></li>`
  ).join('');
  return `
    <div class="checklist">
      <div class="checklist__head">답안 제출 전 확인</div>
      <ul class="checklist__list">${items}</ul>
      <p class="checklist__note">확인용 도구입니다. 체크 상태는 저장되지 않으며 점수와 무관합니다.</p>
    </div>`;
}

function savedLabel(art) {
  return art ? `자동 저장됨 · ${new Date(art.updatedAt).toLocaleTimeString('ko-KR')}` : '자동 저장 대기';
}

function renderStudentView() {
  const studentId = store.currentStudentId;
  el.studentSelect.value = studentId;

  renderConceptCard();

  const prog = studentProgress(studentId);
  el.studentProgress.textContent = `진행률 ${prog.done}/${prog.total} (${pct(prog.ratio)})`;

  el.activityList.innerHTML = activities.map(a => {
    const art = getArtifact(studentId, a.id);
    const content = art ? art.content : '';
    const saved = content && content.trim().length > 0;
    const figure = a.type === 'data' ? renderDataFigure() : '';
    const checklist = renderChecklist(a.id);
    return `
      <article class="activity-card" data-activity="${a.id}">
        <div class="activity-card__head">
          <span class="activity-card__id">${a.id}</span>
          <span class="activity-card__level">${esc(a.level)}</span>
        </div>
        <div class="activity-card__title">${esc(a.title)}</div>
        <p class="activity-card__prompt">${esc(a.prompt)}</p>
        ${figure}
        ${checklist}
        <textarea data-activity="${a.id}" placeholder="여기에 작성하세요…">${esc(content)}</textarea>
        <div class="activity-card__foot">
          <span class="save-status ${saved ? 'is-saved' : ''}" data-status="${a.id}">
            ${saved ? savedLabel(art) : '자동 저장 대기'}
          </span>
        </div>
      </article>`;
  }).join('');

  el.activityList.querySelectorAll('textarea[data-activity]').forEach(ta => {
    ta.addEventListener('input', () => {
      const activityId = ta.getAttribute('data-activity');
      saveArtifact(store.currentStudentId, activityId, ta.value);
      const statusEl = el.activityList.querySelector(`[data-status="${activityId}"]`);
      if (statusEl) {
        const filled = ta.value.trim().length > 0;
        statusEl.textContent = filled ? `자동 저장됨 · ${nowTime()}` : '자동 저장 대기';
        statusEl.classList.toggle('is-saved', filled);
      }
      const p = studentProgress(store.currentStudentId);
      el.studentProgress.textContent = `진행률 ${p.done}/${p.total} (${pct(p.ratio)})`;
    });
  });
}

/* ------------------------------------------------------------
   6) 교사 대시보드
   ------------------------------------------------------------ */

function renderMetricCards() {
  const m = computeMetrics();
  const cards = [
    { label: '전체 응답 채움', value: pct(m.filled / m.totalCells), sub: `${m.filled}/${m.totalCells} 칸` },
    { label: '빈칸률', value: pct(m.emptyRatio), sub: `${m.totalCells - m.filled} 칸 비어 있음` },
    { label: '논술 제출률 (B2)', value: pct(m.essayRate.ratio), sub: `${m.essayRate.done}/${m.essayRate.total} 명` },
    { label: '수정본 제출률 (B3)', value: pct(m.revisionRate.ratio), sub: `${m.revisionRate.done}/${m.revisionRate.total} 명` },
    { label: '리뷰 수', value: String(m.reviewCount), sub: '저장된 교사 리뷰' },
    { label: '피드백 입력률', value: pct(m.feedbackRate), sub: '피드백 있는 리뷰 비율' }
  ];
  el.metricCards.innerHTML = cards.map(c => `
    <div class="metric-card">
      <div class="metric-card__label">${esc(c.label)}</div>
      <div class="metric-card__value">${esc(c.value)}</div>
      <div class="metric-card__sub">${esc(c.sub)}</div>
    </div>`).join('');
}

function renderProgressTable() {
  const thead = el.progressTable.querySelector('thead');
  const tbody = el.progressTable.querySelector('tbody');

  thead.innerHTML = `<tr>
    <th>학생</th>
    ${activities.map(a => `<th>${a.id}</th>`).join('')}
    <th>진행률</th>
  </tr>`;

  tbody.innerHTML = students.map(s => {
    const cells = activities.map(a => {
      const done = isSubmitted(s.studentId, a.id);
      return `<td class="${done ? 'cell-done' : 'cell-empty'}">${done ? '●' : '·'}</td>`;
    }).join('');
    const p = studentProgress(s.studentId);
    return `<tr>
      <td class="is-name">${s.studentId}<br><small>${esc(s.segment)}</small></td>
      ${cells}
      <td>${p.done}/${p.total}<br><small>${pct(p.ratio)}</small></td>
    </tr>`;
  }).join('');
}

function renderActivityRateTable() {
  const thead = el.activityRateTable.querySelector('thead');
  const tbody = el.activityRateTable.querySelector('tbody');

  thead.innerHTML = `<tr>
    <th>활동</th><th>제목</th><th>제출</th><th>제출률</th><th></th>
  </tr>`;

  tbody.innerHTML = activities.map(a => {
    const r = activitySubmissionRate(a.id);
    const barPct = Math.round(r.ratio * 100);
    return `<tr>
      <td class="is-name">${a.id}</td>
      <td class="is-name" style="font-weight:500">${esc(a.title)}</td>
      <td>${r.done}/${r.total}</td>
      <td>${pct(r.ratio)}</td>
      <td><div class="rate-bar"><span style="width:${barPct}%"></span></div></td>
    </tr>`;
  }).join('');
}

function renderMisconceptionFreq() {
  const m = computeMetrics();
  const max = Math.max(1, ...Object.values(m.miscFreq));
  el.miscFreq.innerHTML = misconceptions.map(mc => {
    const count = m.miscFreq[mc.id] || 0;
    const w = Math.round((count / max) * 100);
    return `<div class="freq-row">
      <div class="freq-row__label">${esc(mc.label)}</div>
      <div class="freq-row__bar"><div class="freq-row__fill" style="width:${w}%"></div></div>
      <div class="freq-row__count">${count}</div>
    </div>`;
  }).join('');
}

function renderReviewSelectors() {
  fillStudentOptions(el.reviewStudent);
  el.reviewActivity.innerHTML = activities
    .map(a => `<option value="${a.id}">${a.id} · ${esc(a.title)}</option>`)
    .join('');
}

function renderTeacherView() {
  renderMetricCards();
  renderProgressTable();
  renderActivityRateTable();
  renderMisconceptionFreq();
  renderReviewSelectors();
}

/* ------------------------------------------------------------
   7) 리뷰 패널
   ------------------------------------------------------------ */

let reviewDraft = null;

function suggestedFeedbackList() {
  return misconceptions.filter(mc => reviewDraft.misconceptionIds.includes(mc.id));
}

function suggestedFeedbackHtml() {
  const items = suggestedFeedbackList().map(mc => `<li>${esc(mc.feedback)}</li>`).join('');
  return `선택한 오개념 참고 문구 (교사가 판단·수정하는 보조 자료입니다):
    <ul>${items || '<li>선택된 오개념이 없습니다.</li>'}</ul>`;
}

function openReviewPanel(studentId, activityId) {
  const activity = activities.find(a => a.id === activityId);
  const art = getArtifact(studentId, activityId);
  const review = getReview(studentId, activityId);

  reviewDraft = {
    studentId,
    activityId,
    scores: review ? { ...review.scores } : {},
    misconceptionIds: review ? [...review.misconceptionIds] : []
  };

  const answer = art && art.content && art.content.trim().length > 0 ? esc(art.content) : '';

  const rubricHtml = rubricCriteria.map(c => {
    const current = reviewDraft.scores[c.id];
    const btns = [1, 2, 3, 4].map(n =>
      `<button type="button" class="score-btn ${current === n ? 'is-selected' : ''}"
        data-criterion="${c.id}" data-score="${n}">${n}</button>`
    ).join('');
    return `<div class="rubric-row">
      <div class="rubric-row__info"><strong>${esc(c.label)}</strong><span>${esc(c.description)}</span></div>
      <div class="score-picker">${btns}</div>
    </div>`;
  }).join('');

  const miscHtml = misconceptions.map(mc => {
    const on = reviewDraft.misconceptionIds.includes(mc.id);
    return `<label class="misc-tag ${on ? 'is-selected' : ''}" data-misc="${mc.id}">
      <input type="checkbox" data-misc-input="${mc.id}" ${on ? 'checked' : ''} />
      ${esc(mc.label)}
    </label>`;
  }).join('');

  el.reviewPanel.hidden = false;
  el.reviewPanel.innerHTML = `
    <div class="review-panel__meta">
      <strong>${studentId}</strong> · ${activityId} ${esc(activity.title)}
      ${review ? ` · 최근 리뷰 ${new Date(review.updatedAt).toLocaleString('ko-KR')}` : ' · 신규 리뷰'}
    </div>

    <div>
      <div class="field__label">학생 답안</div>
      <div class="answer-box ${answer ? '' : 'is-empty'}">${answer || '아직 제출된 답안이 없습니다.'}</div>
    </div>

    <div>
      <div class="field__label">루브릭 채점 (기준별 1~4점)</div>
      <div class="rubric-grid">${rubricHtml}</div>
    </div>

    <div>
      <div class="field__label">오개념 태그</div>
      <div class="misc-tags">${miscHtml}</div>
    </div>

    <div class="suggested-feedback" data-suggested>${suggestedFeedbackHtml()}</div>

    <div>
      <div class="field__label">교사 피드백</div>
      <textarea id="review-feedback" placeholder="학생에게 줄 피드백을 작성하세요…">${review ? esc(review.feedback) : ''}</textarea>
      <div class="review-panel__actions review-panel__actions--secondary">
        <button id="btn-insert-feedback" class="btn btn--ghost" type="button">선택한 오개념 피드백 문구를 피드백 입력란에 추가</button>
      </div>
    </div>

    <div class="review-panel__actions">
      <button id="btn-save-review" class="btn btn--primary" type="button">리뷰 저장</button>
      <span class="review-save-status" id="review-save-status"></span>
    </div>
  `;

  // 점수 버튼
  el.reviewPanel.querySelectorAll('.score-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cid = btn.getAttribute('data-criterion');
      const score = Number(btn.getAttribute('data-score'));
      reviewDraft.scores[cid] = score;
      el.reviewPanel.querySelectorAll(`.score-btn[data-criterion="${cid}"]`).forEach(b => {
        b.classList.toggle('is-selected', Number(b.getAttribute('data-score')) === score);
      });
    });
  });

  // 오개념 체크박스
  el.reviewPanel.querySelectorAll('[data-misc-input]').forEach(input => {
    input.addEventListener('change', () => {
      const id = input.getAttribute('data-misc-input');
      if (input.checked) {
        if (!reviewDraft.misconceptionIds.includes(id)) reviewDraft.misconceptionIds.push(id);
      } else {
        reviewDraft.misconceptionIds = reviewDraft.misconceptionIds.filter(x => x !== id);
      }
      input.closest('.misc-tag').classList.toggle('is-selected', input.checked);
      el.reviewPanel.querySelector('[data-suggested]').innerHTML = suggestedFeedbackHtml();
    });
  });

  // 오개념 피드백 문구 삽입 (교사 판단 보조 — 자동 확정 아님)
  el.reviewPanel.querySelector('#btn-insert-feedback').addEventListener('click', () => {
    const chosen = suggestedFeedbackList();
    const ta = el.reviewPanel.querySelector('#review-feedback');
    if (chosen.length === 0) {
      const status = el.reviewPanel.querySelector('#review-save-status');
      status.textContent = '먼저 오개념 태그를 선택하세요.';
      return;
    }
    const lines = chosen.map(mc => `· ${mc.feedback}`).join('\n');
    ta.value = ta.value.trim() ? ta.value.replace(/\s*$/, '') + '\n' + lines : lines;
    ta.focus();
  });

  // 저장
  el.reviewPanel.querySelector('#btn-save-review').addEventListener('click', () => {
    const feedback = el.reviewPanel.querySelector('#review-feedback').value;
    saveReview(reviewDraft.studentId, reviewDraft.activityId,
      { ...reviewDraft.scores }, [...reviewDraft.misconceptionIds], feedback);
    el.reviewPanel.querySelector('#review-save-status').textContent =
      '저장되었습니다 · ' + nowTime();
    renderMetricCards();
    renderMisconceptionFreq();
  });
}

/* ------------------------------------------------------------
   8) 내보내기 (JSON / CSV)
   ------------------------------------------------------------ */

function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportJson() {
  const payload = {
    exportedAt: nowIso(),
    module: { subject: '통합과학2', standard: '[10통과2-01-02]' },
    students,
    activities: activities.map(a => ({ id: a.id, title: a.title, level: a.level })),
    rubricCriteria,
    misconceptions,
    artifacts: store.artifacts,
    reviews: store.reviews,
    metrics: computeMetrics()
  };
  download('science-reading-portfolio.json', JSON.stringify(payload, null, 2), 'application/json');
}

function csvCell(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function exportCsv() {
  const rubricCols = rubricCriteria.map(c => `점수:${c.label}`);
  const headers = [
    '학생ID', '분류', '활동ID', '활동명', '수준', '제출여부', '답안',
    ...rubricCols, '오개념', '피드백', '최근수정'
  ];
  const rows = [headers.map(csvCell).join(',')];

  students.forEach(s => {
    activities.forEach(a => {
      const art = getArtifact(s.studentId, a.id);
      const rev = getReview(s.studentId, a.id);
      const submitted = isSubmitted(s.studentId, a.id) ? 'Y' : 'N';
      const scoreVals = rubricCriteria.map(c => (rev && rev.scores[c.id] != null) ? rev.scores[c.id] : '');
      const miscLabels = rev
        ? rev.misconceptionIds.map(id => (misconceptions.find(m => m.id === id) || {}).label || id).join(' / ')
        : '';
      const updated = art ? art.updatedAt : (rev ? rev.updatedAt : '');
      const row = [
        s.studentId, s.segment, a.id, a.title, a.level, submitted,
        art ? art.content : '',
        ...scoreVals, miscLabels, rev ? rev.feedback : '', updated
      ];
      rows.push(row.map(csvCell).join(','));
    });
  });

  // BOM 추가로 한글 엑셀 호환
  download('science-reading-portfolio.csv', '﻿' + rows.join('\n'), 'text/csv;charset=utf-8');
}

/* ------------------------------------------------------------
   9) 데이터 초기화 (JSON 백업 후)
   ------------------------------------------------------------ */

function resetData() {
  const msg = '현재 브라우저에 저장된 모든 학생 응답과 교사 리뷰가 삭제됩니다.\n' +
    '먼저 JSON 내보내기로 백업했는지 확인하십시오.\n정말 초기화하시겠습니까?';
  if (!confirm(msg)) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

/* ------------------------------------------------------------
   10) 화면 전환 & 초기화
   ------------------------------------------------------------ */

function switchTo(mode) {
  const isStudent = mode === 'student';
  el.studentView.classList.toggle('is-visible', isStudent);
  el.teacherView.classList.toggle('is-visible', !isStudent);
  el.btnStudent.classList.toggle('is-active', isStudent);
  el.btnTeacher.classList.toggle('is-active', !isStudent);
  if (isStudent) renderStudentView();
  else renderTeacherView();
}

function init() {
  fillStudentOptions(el.studentSelect);

  el.studentSelect.addEventListener('change', () => {
    store.currentStudentId = el.studentSelect.value;
    persist();
    renderStudentView();
  });

  el.btnStudent.addEventListener('click', () => switchTo('student'));
  el.btnTeacher.addEventListener('click', () => switchTo('teacher'));

  el.btnLoadReview.addEventListener('click', () => {
    openReviewPanel(el.reviewStudent.value, el.reviewActivity.value);
  });

  el.btnExportJson.addEventListener('click', exportJson);
  el.btnExportCsv.addEventListener('click', exportCsv);
  el.btnResetData.addEventListener('click', resetData);

  renderStudentView();
}

document.addEventListener('DOMContentLoaded', init);
