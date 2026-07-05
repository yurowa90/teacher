/* ============================================================
   과학 독서·논술 포트폴리오 — Stage 2 (UI / 이벤트 / 내보내기)
   데이터: data/*.js   저장: services/storage.js   지표: utils/metrics.js
   저장소: localStorage 만 사용
   금지: 로그인 / 서버 DB / 외부 API / AI 자동채점 / 실명·학번 저장
   교사가 최종 평가자입니다.
   ============================================================ */
(function (SRP) {
  'use strict';

  const { students, activities, dataTable, rubricCriteria, misconceptions, storage, metrics } = SRP;
  const { studentProgress, computeMetrics, isSubmitted, pct } = metrics;

  /* ---------- DOM 참조 ---------- */
  const el = {
    btnStudent: document.getElementById('btn-student'),
    btnTeacher: document.getElementById('btn-teacher'),
    studentView: document.getElementById('student-view'),
    teacherView: document.getElementById('teacher-view'),
    studentSelect: document.getElementById('student-select'),
    studentProgress: document.getElementById('student-progress'),
    activityList: document.getElementById('activity-list'),
    metricCards: document.getElementById('metric-cards'),
    progressTable: document.getElementById('progress-table'),
    miscFreq: document.getElementById('misconception-freq'),
    reviewStudent: document.getElementById('review-student'),
    reviewActivity: document.getElementById('review-activity'),
    btnLoadReview: document.getElementById('btn-load-review'),
    reviewPanel: document.getElementById('review-panel'),
    btnExportJson: document.getElementById('btn-export-json'),
    btnExportCsv: document.getElementById('btn-export-csv')
  };

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fillStudentOptions(selectEl) {
    selectEl.innerHTML = students
      .map(s => `<option value="${s.studentId}">${s.studentId} · ${s.segment}</option>`)
      .join('');
  }

  /* ------------------------------------------------------------
     학생 화면
     ------------------------------------------------------------ */

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

  function updateStudentProgressPill(studentId) {
    const p = studentProgress(studentId);
    el.studentProgress.textContent = `진행률 ${p.done}/${p.total} (${pct(p.ratio)})`;
  }

  function renderStudentView() {
    const studentId = storage.getCurrentStudentId();
    el.studentSelect.value = studentId;
    updateStudentProgressPill(studentId);

    el.activityList.innerHTML = activities.map(a => {
      const art = storage.getArtifact(studentId, a.id);
      const content = art ? art.content : '';
      const saved = content && content.trim().length > 0;
      const figure = a.type === 'data' ? renderDataFigure() : '';
      const savedAt = art ? `저장됨 · ${new Date(art.updatedAt).toLocaleString('ko-KR')}` : '아직 저장 안 됨';
      return `
        <article class="activity-card" data-activity="${a.id}">
          <div class="activity-card__head">
            <span class="activity-card__id">${a.id}</span>
            <span class="activity-card__level">${esc(a.level)}</span>
          </div>
          <div class="activity-card__title">${esc(a.title)}</div>
          <p class="activity-card__prompt">${esc(a.prompt)}</p>
          ${figure}
          <textarea data-activity="${a.id}" placeholder="여기에 작성하세요…">${esc(content)}</textarea>
          <div class="activity-card__foot">
            <span class="save-status ${saved ? 'is-saved' : ''}" data-status="${a.id}">
              ${saved ? '자동 저장됨' : '자동 저장 대기'}
            </span>
            <span class="save-status">${esc(savedAt)}</span>
          </div>
        </article>`;
    }).join('');

    el.activityList.querySelectorAll('textarea[data-activity]').forEach(ta => {
      ta.addEventListener('input', () => {
        const activityId = ta.getAttribute('data-activity');
        storage.saveArtifact(storage.getCurrentStudentId(), activityId, ta.value);
        const statusEl = el.activityList.querySelector(`[data-status="${activityId}"]`);
        if (statusEl) {
          const filled = ta.value.trim().length > 0;
          statusEl.textContent = filled ? '자동 저장됨' : '자동 저장 대기';
          statusEl.classList.toggle('is-saved', filled);
        }
        updateStudentProgressPill(storage.getCurrentStudentId());
      });
    });
  }

  /* ------------------------------------------------------------
     교사 대시보드
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
    renderMisconceptionFreq();
    renderReviewSelectors();
  }

  /* ------------------------------------------------------------
     리뷰 패널 (답안 검토 · 루브릭 · 오개념 · 피드백)
     ------------------------------------------------------------ */

  let reviewDraft = null;

  function suggestedFeedbackHtml() {
    const items = misconceptions
      .filter(mc => reviewDraft.misconceptionIds.includes(mc.id))
      .map(mc => `<li>${esc(mc.feedback)}</li>`).join('');
    return `선택한 오개념 참고 문구 (교사가 판단·수정하는 보조 자료입니다):
      <ul>${items || '<li>선택된 오개념이 없습니다.</li>'}</ul>`;
  }

  function openReviewPanel(studentId, activityId) {
    const activity = activities.find(a => a.id === activityId);
    const art = storage.getArtifact(studentId, activityId);
    const review = storage.getReview(studentId, activityId);

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
      </div>

      <div class="review-panel__actions">
        <button id="btn-save-review" class="btn btn--primary" type="button">리뷰 저장</button>
        <span class="review-save-status" id="review-save-status"></span>
      </div>
    `;

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

    el.reviewPanel.querySelector('#btn-save-review').addEventListener('click', () => {
      const feedback = el.reviewPanel.querySelector('#review-feedback').value;
      storage.saveReview(reviewDraft.studentId, reviewDraft.activityId,
        { ...reviewDraft.scores }, [...reviewDraft.misconceptionIds], feedback);
      el.reviewPanel.querySelector('#review-save-status').textContent =
        '저장되었습니다 · ' + new Date().toLocaleTimeString('ko-KR');
      renderMetricCards();
      renderMisconceptionFreq();
    });
  }

  /* ------------------------------------------------------------
     내보내기 (JSON / CSV)
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
      exportedAt: storage.nowIso(),
      module: { subject: '통합과학2', standard: '[10통과2-01-02]' },
      students,
      activities: activities.map(a => ({ id: a.id, title: a.title, level: a.level })),
      rubricCriteria,
      misconceptions,
      artifacts: storage.getArtifacts(),
      reviews: storage.getReviews(),
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
        const art = storage.getArtifact(s.studentId, a.id);
        const rev = storage.getReview(s.studentId, a.id);
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

    download('science-reading-portfolio.csv', '﻿' + rows.join('\n'), 'text/csv;charset=utf-8');
  }

  /* ------------------------------------------------------------
     화면 전환 & 초기화
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
      storage.setCurrentStudentId(el.studentSelect.value);
      renderStudentView();
    });

    el.btnStudent.addEventListener('click', () => switchTo('student'));
    el.btnTeacher.addEventListener('click', () => switchTo('teacher'));

    el.btnLoadReview.addEventListener('click', () => {
      openReviewPanel(el.reviewStudent.value, el.reviewActivity.value);
    });

    el.btnExportJson.addEventListener('click', exportJson);
    el.btnExportCsv.addEventListener('click', exportCsv);

    renderStudentView();
  }

  document.addEventListener('DOMContentLoaded', init);
})(window.SRP = window.SRP || {});
