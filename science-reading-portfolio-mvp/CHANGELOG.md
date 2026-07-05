# CHANGELOG

## v0.1.1 — Stage 1.1 / 1.2 (UX Stabilization)

문서 정합성 + 수업용 UX 보강. 단일 번들(`app.js`) 구조로 정리.

- README와 실제 파일 구조 정합성 수정(Stage 1.1 Static Bundled MVP로 명시)
- `app.js`를 자체완결 단일 번들로 정리(모듈 분리는 Stage 2 예정으로 이관)
- 학생 화면 상단 **핵심 개념 카드**(선행 조직자) 추가
- **B2 논술 체크리스트** 추가
- 리뷰 패널에 **오개념 피드백 문구 삽입 버튼** 추가(교사 판단 보조)
- 교사 대시보드 하단 **데이터 초기화 버튼** 추가(confirm + JSON 백업 안내)
- 교사 대시보드에 **활동별 제출률 표** 추가
- 자동 저장 후 **저장 시각 즉시 표시** 개선
- 문서 추가: `ROADMAP.md`, `TEST_CHECKLIST.md`, `SAMPLE_DATA.md`, `CHANGELOG.md`, `WEBAPP_QC_AND_REVISION_PLAN.md`

## v0.1.0 — Stage 1.0

- 학생 활동 작성(A1~E1)
- localStorage 저장·복원, 학생별 응답 분리
- 교사 대시보드(진행률·제출 여부·오개념 빈도)
- 루브릭·오개념·피드백 저장
- JSON/CSV 내보내기
