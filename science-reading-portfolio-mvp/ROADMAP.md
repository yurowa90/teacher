# ROADMAP — 과학 독서·논술 포트폴리오 웹앱

단계적 개발 로드맵입니다. 원샷 완성이 아니라 작동하는 MVP를 먼저 만들고 확장합니다.

## Stage 1 — 정적 MVP ✅ (현재)

**기술**: HTML / CSS / Vanilla JS / localStorage

**구현 완료**
- 학생 익명 ID 선택 (S-001 ~ S-005)
- 활동 8종(A1·A2·B1·B2·B3·C1·D1·E1) 작성 + 자동 저장
- 학생별 응답 분리 (S-001과 S-002가 섞이지 않음)
- B1 자료 해석용 표 제시
- 교사 대시보드: 진행률·제출 여부·빈칸률·논술/수정본 제출률·피드백 입력률
- 오개념 빈도 집계
- 답안 검토 패널: 루브릭(1~4점) · 오개념 태그 · 교사 피드백
- JSON / CSV 내보내기

**한계**
- 데이터가 단일 브라우저의 localStorage에만 존재 (기기 간 공유 불가)
- 교사·학생 권한 분리 없음 (화면 전환만 제공)
- 모듈 1종만 지원

## Stage 2 — 코드 구조 리팩토링 ✅ (현재)

`app.js`가 커지지 않도록 데이터·저장·지표·렌더링을 파일로 분리했습니다.

```
science-reading-portfolio-mvp/
├─ index.html
├─ styles.css
├─ app.js            (UI·이벤트·내보내기)
├─ data/
│  ├─ students.js
│  ├─ activities.js  (+ B1 자료 표)
│  ├─ rubric.js
│  └─ misconceptions.js
├─ services/
│  └─ storage.js     (localStorage)
├─ utils/
│  └─ metrics.js     (지표 계산)
├─ README.md
└─ ROADMAP.md
```

- 전역 네임스페이스 `window.SRP` 하나로 모듈 결합 (빌드 도구·ES module 불필요)
- 스크립트 로드 순서: 데이터 → 저장 → 지표 → 앱 → `file://` 더블클릭 실행 유지
- 기존 기능·localStorage 구조(`srp-mvp-v1`) 그대로 유지 → Stage 1 데이터 호환
- 리팩토링 후 헤드리스 브라우저 수용 테스트 18/18 통과

## Stage 3 — 서버형 MVP (Next.js + Supabase) ✅ (구현됨)

→ 별도 프로젝트 `../science-reading-portfolio-server/` 참고.

- 교사/학생 역할 분리, 학생은 **익명 로그인** + 초대 코드로 접근
- 응답·리뷰·루브릭·오개념·피드백을 Supabase DB에 저장
- 교사 대시보드에서 진행률·제출 여부 확인, 답안 검토·채점
- **RLS 정책**: 학생은 자기 응답만, 교사는 자기 반 데이터만
  (로컬 PostgreSQL 16에서 격리·위조 차단 검증 완료)
- `join_class` security definer RPC로 초대 코드 합류 처리
- **유지 제한**: 실명·학번·민감정보 미수집 / AI 자동채점·세특 자동 확정 없음 / 교사 최종 판단

**남은 Stage 3+ 확장**: 여러 반 선택 UI, 오개념 빈도·평균 점수 차트,
CSV 서버 내보내기, 포트폴리오 증거(E) 묶음 뷰.

## 이후 확장 아이디어

- 통합과학1·2, 과학탐구실험1·2 전체 성취기준 모듈화
- 산출물 위계(A→B→C→D→E) 시각화 및 성장 타임라인
- 포트폴리오 증거 묶음(E) 자동 구성 및 내보내기
- 교사용 채점 보조(AI는 제안만, 확정은 교사)
