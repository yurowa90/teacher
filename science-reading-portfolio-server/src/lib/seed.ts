// 샘플 모듈 템플릿 — 교사가 '샘플 불러오기'로 한 번에 채워볼 수 있는 예시.
// 실제 제품에서는 교사가 임의의 책·성취기준·활동·루브릭·오개념을 저작합니다.
// (이 생물학/진화 세트는 예시일 뿐 고정 내용이 아닙니다.)

export interface SampleActivity {
  code: string;
  level: string;
  type: string;
  title: string;
  prompt: string;
  resource?: unknown;
}

export interface SampleModule {
  title: string;
  subject: string;
  standardCode: string;
  bookTitle: string;
  intro: string;
  activities: SampleActivity[];
  rubric: { label: string; description: string }[];
  misconceptions: { label: string; feedback: string }[];
}

export const SAMPLE_MODULE: SampleModule = {
  title: "생명체의 구조는 '필요해서 생긴 것'인가, '선택되어 남은 것'인가?",
  subject: '통합과학2',
  standardCode: '[10통과2-01-02]',
  bookTitle: '이것이 생물학이다 (예시)',
  intro: '변이·자연선택·진화·생물다양성을 다루는 예시 단원입니다. 교사가 실제 도서·성취기준에 맞게 수정하세요.',
  activities: [
    { code: 'A1', level: 'A형 비계', type: 'keyword', title: '핵심어 이해',
      prompt: '변이, 자연선택, 진화, 개체군, 생물다양성, 목적론을 자신의 말로 정리하시오.' },
    { code: 'A2', level: 'A형 비계', type: 'sentence', title: '긴 문장 쪼개기',
      prompt: '자연선택 과정을 원인-과정-결과로 나누어 설명하시오.' },
    { code: 'B1', level: 'B형 표준', type: 'data', title: '자료 해석',
      prompt: '형질 빈도 변화 자료를 해석하고 자연선택 개념과 연결하시오. 자료만으로 알 수 없는 한계도 함께 쓰시오.',
      resource: {
        type: 'table',
        caption: '세대별 몸색 형질 빈도 변화 (일부 정보는 의도적으로 제시되지 않음)',
        headers: ['세대', '밝은 몸색 개체 비율', '어두운 몸색 개체 비율', '환경 배경', '표본 수', '제시되지 않은 정보'],
        rows: [
          ['1세대', '80%', '20%', '밝음', '200', '생존율, 번식률'],
          ['5세대', '65%', '35%', '점차 어두워짐', '160', '포식률'],
          ['10세대', '40%', '60%', '어두움', '120', '형질 유전 여부'],
          ['15세대', '25%', '75%', '어두움', '90', '다른 환경 요인']
        ]
      } },
    { code: 'B2', level: 'B형 표준', type: 'essay', title: '논술형 답안 초안',
      prompt: '환경 변화가 개체군의 형질 빈도 변화에 미치는 영향을 자연선택 개념으로 설명하시오. 변이, 자연선택, 진화 중 2개 이상을 사용하고, 개체가 스스로 변한 것이 아니라 개체군의 형질 빈도가 변했음을 포함하시오.' },
    { code: 'B3', level: 'B형 표준', type: 'revision', title: '논술형 답안 수정본',
      prompt: '교사 피드백을 반영하여 B2 답안을 수정하시오. 수정한 부분이 무엇인지 마지막 문장에 쓰시오.' },
    { code: 'C1', level: 'C형 심화', type: 'inquiry', title: '탐구 질문 고도화',
      prompt: '넓은 질문을 대상·변인·조건이 포함된 탐구 가능 질문으로 바꾸시오. 독립변인, 종속변인, 필요한 자료도 함께 쓰시오.' },
    { code: 'D1', level: 'C형 심화', type: 'aiCritique', title: 'AI·빅데이터 비판',
      prompt: 'AI가 생물 사진을 분류할 때 특정 지역이나 특정 생물군 자료가 부족하면 생물다양성 이해에 어떤 왜곡이 생길 수 있는지 설명하시오.' },
    { code: 'E1', level: '포트폴리오', type: 'reflection', title: '성찰 기록',
      prompt: '읽기 전후 생각 변화, 수정한 오개념, 다음에 탐구하고 싶은 질문을 기록하시오.' }
  ],
  rubric: [
    { label: '개념 정확성', description: '핵심 개념을 정확히 구분하고 연결하는가' },
    { label: '자료 해석', description: '자료의 수치 변화와 한계를 해석하고 개념과 연결하는가' },
    { label: '논증 구조', description: '주장-근거-결론 구조가 명확한가' },
    { label: '개념 전이', description: '새로운 사례나 탐구 질문에 개념을 적용하는가' },
    { label: '비판적 검증', description: '자료·AI 활용의 유용성, 편향, 검증 필요성을 균형 있게 설명하는가' },
    { label: '성찰', description: '읽기 전후 생각 변화와 수정한 오개념을 구체적으로 기록하는가' }
  ],
  misconceptions: [
    { label: '목적론: 필요해서 생겼다', feedback: '필요해서 직접 생긴 것이 아니라, 유리한 형질을 가진 개체가 더 많이 남은 과정으로 설명하십시오.' },
    { label: '개체 변화: 개체가 스스로 변했다', feedback: '한 개체가 바뀐 것이 아니라, 세대를 거치며 개체군 안의 형질 비율이 달라진 것입니다.' },
    { label: '환경 결정론', feedback: '환경 변화만으로는 부족합니다. 변이와 생존·번식 차이를 함께 설명해야 합니다.' },
    { label: '변이 누락', feedback: '자연선택이 작동하려면 개체군 안에 변이가 먼저 존재해야 합니다.' },
    { label: '자료 수치 근거 부족', feedback: '몇 세대에서 몇 %로 바뀌었는지 수치를 근거로 사용하십시오.' },
    { label: 'AI 비판 피상적', feedback: '어떤 데이터가 부족하거나 편향될 때 어떤 오류가 생기는지 구체적으로 쓰십시오.' }
  ]
};
