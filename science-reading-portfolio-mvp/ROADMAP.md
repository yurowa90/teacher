# ROADMAP — 과학 독서·논술 포트폴리오 웹앱

단계적 개발 로드맵입니다. 작동하는 MVP를 먼저 만들고 단계별로 확장·안정화합니다.

## Stage 1.1 Static Bundled MVP ✅ (현재)

- 현재 버전
- 파일: `index.html`, `styles.css`, `app.js`, `README.md`
- 모든 데이터·저장·지표·UI 로직이 `app.js` 한 파일에 번들
- 학생 활동 작성 + 자동 저장, 교사 대시보드, 루브릭·오개념·피드백, JSON/CSV 내보내기

## Stage 1.2 UX Stabilization ✅ (본 버전에 반영)

- 핵심 개념 카드(학생 선행 조직자)
- B2 논술 체크리스트
- 오개념 피드백 문구 삽입 버튼
- 데이터 초기화 버튼
- 활동별 제출률 표
- 자동 저장 시각 즉시 표시

## Stage 2 Modular Refactor

`app.js`를 역할별 모듈로 분리한다. (현재 폴더에는 아직 없음 — 예정 구조)

```
science-reading-portfolio-mvp/
├─ index.html
├─ styles.css
├─ app.js
├─ data/
│  ├─ students.js
│  ├─ activities.js
│  ├─ rubric.js
│  └─ misconceptions.js
├─ services/
│  └─ storage.js
├─ utils/
│  └─ metrics.js
├─ README.md
├─ ROADMAP.md
├─ TEST_CHECKLIST.md
├─ SAMPLE_DATA.md
└─ CHANGELOG.md
```

- 데이터·저장·지표·렌더링 분리
- `localStorage` 구조(`srp-mvp-v1`)와 키 형식 유지
- 분리 후 `TEST_CHECKLIST.md`로 기능 유지 확인

## Stage 3 Server-backed MVP

- Next.js + Supabase
- 교사/학생 역할 분리, 학생은 익명 로그인 + 초대 코드 접근
- 응답·리뷰·루브릭·오개념·피드백을 DB에 저장
- RLS 정책(학생은 자기 응답만, 교사는 자기 반만)
- CSV export
- (유지 제한: 실명·학번·민감정보 미수집, AI 자동채점·세특 자동 확정 없음, 교사 최종 판단)

## Stage 4 Portfolio Expansion

- 학생 성장 타임라인(student timeline)
- 초안-수정본-최종본 비교(draft-revision-final comparison)
- 포트폴리오 증거 코드(evidence code)
- 교사 관찰 기록(teacher observation notes)

## Stage 5 School Pilot

- 개인정보 검토(privacy review)
- 교실 현장 테스트(classroom test)
- QC 데이터 수집(QC data collection)
- 수정 로그(revision log)
