/* 데이터: 학생 (익명 ID만 사용 — 실명·학번 없음) */
(function (SRP) {
  'use strict';

  SRP.students = [
    { studentId: 'S-001', segment: 'standard' },
    { studentId: 'S-002', segment: 'standard' },
    { studentId: 'S-003', segment: 'scaffold' },
    { studentId: 'S-004', segment: 'advanced' },
    { studentId: 'S-005', segment: 'standard' }
  ];
})(window.SRP = window.SRP || {});
