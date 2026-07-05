/* 유틸: 지표 계산 (교사 대시보드용) */
(function (SRP) {
  'use strict';

  const S = SRP.storage;

  function isSubmitted(studentId, activityId) {
    const a = S.getArtifact(studentId, activityId);
    return !!(a && a.content && a.content.trim().length > 0);
  }

  function studentProgress(studentId) {
    const total = SRP.activities.length;
    const done = SRP.activities.filter(a => isSubmitted(studentId, a.id)).length;
    return { done, total, ratio: total ? done / total : 0 };
  }

  function activitySubmissionRate(activityId) {
    const total = SRP.students.length;
    const done = SRP.students.filter(s => isSubmitted(s.studentId, activityId)).length;
    return { done, total, ratio: total ? done / total : 0 };
  }

  function computeMetrics() {
    const totalCells = SRP.students.length * SRP.activities.length;
    let filled = 0;
    SRP.students.forEach(s => SRP.activities.forEach(a => { if (isSubmitted(s.studentId, a.id)) filled++; }));

    const essayRate = activitySubmissionRate('B2');
    const revisionRate = activitySubmissionRate('B3');

    // 오개념 빈도
    const miscFreq = {};
    SRP.misconceptions.forEach(m => { miscFreq[m.id] = 0; });
    Object.values(S.getReviews()).forEach(r => {
      (r.misconceptionIds || []).forEach(id => {
        if (miscFreq[id] !== undefined) miscFreq[id] += 1;
      });
    });

    // 평균 루브릭 점수 (기준별)
    const scoreSum = {}; const scoreCount = {};
    SRP.rubricCriteria.forEach(c => { scoreSum[c.id] = 0; scoreCount[c.id] = 0; });
    Object.values(S.getReviews()).forEach(r => {
      Object.entries(r.scores || {}).forEach(([cid, val]) => {
        if (scoreSum[cid] !== undefined && typeof val === 'number') {
          scoreSum[cid] += val; scoreCount[cid] += 1;
        }
      });
    });
    const avgScores = {};
    SRP.rubricCriteria.forEach(c => {
      avgScores[c.id] = scoreCount[c.id] ? scoreSum[c.id] / scoreCount[c.id] : null;
    });

    // 피드백 입력률
    const reviewList = Object.values(S.getReviews());
    const withFeedback = reviewList.filter(r => r.feedback && r.feedback.trim().length > 0).length;
    const feedbackRate = reviewList.length ? withFeedback / reviewList.length : 0;

    return {
      totalCells,
      filled,
      emptyRatio: totalCells ? (totalCells - filled) / totalCells : 0,
      essayRate,
      revisionRate,
      miscFreq,
      avgScores,
      feedbackRate,
      reviewCount: reviewList.length
    };
  }

  const pct = ratio => Math.round(ratio * 100) + '%';

  SRP.metrics = {
    isSubmitted,
    studentProgress,
    activitySubmissionRate,
    computeMetrics,
    pct
  };
})(window.SRP = window.SRP || {});
