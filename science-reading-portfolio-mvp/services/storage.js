/* 서비스: localStorage 저장·불러오기
   구조: { currentStudentId, artifacts:{}, reviews:{} }
   키:  artifactKey = `${studentId}::${activityId}`
        reviewKey   = `review::${studentId}::${activityId}`
   (Stage 3 Supabase 이전을 고려한 스키마 유지)
   ------------------------------------------------------------ */
(function (SRP) {
  'use strict';

  const STORAGE_KEY = 'srp-mvp-v1';

  const artifactKey = (studentId, activityId) => `${studentId}::${activityId}`;
  const reviewKey = (studentId, activityId) => `review::${studentId}::${activityId}`;
  const nowIso = () => new Date().toISOString();
  const defaultStudentId = () => (SRP.students[0] ? SRP.students[0].studentId : 'S-001');

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { currentStudentId: defaultStudentId(), artifacts: {}, reviews: {} };
      const parsed = JSON.parse(raw);
      return {
        currentStudentId: parsed.currentStudentId || defaultStudentId(),
        artifacts: parsed.artifacts || {},
        reviews: parsed.reviews || {}
      };
    } catch (e) {
      console.warn('저장소를 읽지 못해 초기화합니다.', e);
      return { currentStudentId: defaultStudentId(), artifacts: {}, reviews: {} };
    }
  }

  const store = loadStore();

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  // ---- 현재 학생 ----
  function getCurrentStudentId() { return store.currentStudentId; }
  function setCurrentStudentId(studentId) { store.currentStudentId = studentId; persist(); }

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

  // ---- 원시 데이터 접근 (지표·내보내기용) ----
  function getArtifacts() { return store.artifacts; }
  function getReviews() { return store.reviews; }

  SRP.storage = {
    STORAGE_KEY,
    artifactKey,
    reviewKey,
    nowIso,
    getCurrentStudentId,
    setCurrentStudentId,
    getArtifact,
    saveArtifact,
    getReview,
    saveReview,
    getArtifacts,
    getReviews
  };
})(window.SRP = window.SRP || {});
