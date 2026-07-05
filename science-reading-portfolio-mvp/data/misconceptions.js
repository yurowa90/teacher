/* 데이터: 오개념 태그 + 참고 피드백 문구 (교사 판단 보조용, 자동 확정 아님) */
(function (SRP) {
  'use strict';

  SRP.misconceptions = [
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
})(window.SRP = window.SRP || {});
