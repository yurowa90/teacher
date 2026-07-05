/* 데이터: 루브릭 기준 (기준별 1~4점) */
(function (SRP) {
  'use strict';

  SRP.rubricCriteria = [
    { id: 'conceptAccuracy', label: '개념 정확성', description: '변이, 자연선택, 진화, 생물다양성을 정확히 구분하고 연결하는가' },
    { id: 'dataInterpretation', label: '자료 해석', description: '자료의 수치 변화와 한계를 해석하고 자연선택 개념과 연결하는가' },
    { id: 'argumentStructure', label: '논증 구조', description: '주장-근거-결론 구조가 명확한가' },
    { id: 'conceptTransfer', label: '개념 전이', description: '새로운 생명체 구조나 탐구 질문에 개념을 적용하는가' },
    { id: 'criticalVerification', label: '비판적 검증', description: 'AI·데이터 활용의 유용성, 편향, 검증 필요성을 균형 있게 설명하는가' },
    { id: 'reflection', label: '성찰', description: '읽기 전후 생각 변화와 수정한 오개념을 구체적으로 기록하는가' }
  ];
})(window.SRP = window.SRP || {});
