# 과학 독서·논술 포트폴리오 — Stage 3 서버형 MVP

Next.js(App Router) + Supabase 기반 서버형 MVP입니다. Stage 1·2 정적 MVP를
교사/학생 역할 분리, DB 저장, RLS(행 수준 보안)로 확장했습니다.

**교사가 임의의 책·성취기준으로 단원을 저작**합니다. 활동·루브릭·오개념을
직접 추가/수정하며, 생물학/진화 세트는 '샘플 불러오기' 예시일 뿐 고정 내용이 아닙니다.

- 교사: 로그인 → 반 생성 → 단원 저작(책·활동·루브릭·오개념 CRUD, 또는 샘플 불러오기) → 학생 진행 확인 → 루브릭·오개념·피드백 저장
- 학생: **익명 로그인** + 반 초대 코드 + 익명 라벨로 참여 → 단원별 활동 작성(자동 저장)
- 실명·학번·민감정보 미수집 · AI 자동채점/세특 자동 확정 없음 · 교사가 최종 판단자

## 화면 구조

| 경로 | 역할 | 설명 |
|------|------|------|
| `/` | 공통 | 교사/학생 진입 선택 |
| `/teacher` | 교사 | 이메일 로그인·가입 |
| `/teacher/dashboard` | 교사 | 반 선택·생성, 초대 코드, 단원 목록(빈 단원/샘플 불러오기) |
| `/teacher/modules/[id]` | 교사 | 단원 저작(책·활동·루브릭·오개념 CRUD) + 학생 진행표 + 답안 검토 |
| `/student` | 학생 | 초대 코드 + 익명 라벨로 참여(익명 로그인) |
| `/student/work` | 학생 | 단원별 활동 카드 작성 + 자동 저장, 보조 자료(표/텍스트) |

## 데이터 모델 (DB 스키마)

`supabase/migrations/0001_init.sql` 참고. 주요 테이블:

```
profiles(id→auth.users, role)                         -- 역할(teacher/student)
classes(id, teacher_id→auth.users, name, invite_code) -- 교사 소유 반
modules(id, class_id, title, subject, standard_code, book_title, intro)  -- 교사 저작 단원(임의 책)
activities(id, module_id, code, level, type, title, prompt, resource jsonb, sort_order)
rubric_criteria(id, module_id, label, description, sort_order)  -- 모듈별 루브릭(교사 저작)
misconceptions(id, module_id, label, feedback, sort_order)      -- 모듈별 오개념(교사 저작)
students(id, class_id, auth_user_id→auth.users, anon_label, segment)  -- 익명 학생
artifacts(id, student_id, activity_id, content, stage, updated_at)    -- 산출물(활동별 1개)
reviews(id, student_id, activity_id, teacher_id, scores jsonb,
        misconception_ids text[], feedback, updated_at)               -- 교사 리뷰
```

- `reviews.scores` 는 `rubric_criteria.id`(uuid)를 키로, `reviews.misconception_ids` 는
  `misconceptions.id` 배열을 담습니다(모듈별 루브릭/오개념과 연결).
- `activities.resource` 는 선택 보조 자료: `{"type":"table",...}` 또는 `{"type":"text",...}`.
- **개인정보**: 실명·학번 컬럼 없음. 학생 식별은 `auth.users`의 익명 uid + 익명 라벨.

## RLS 정책 요약

- **학생**: 본인 `students`/`artifacts`만 읽기·쓰기, 본인에 대한 `reviews`만 읽기(쓰기 불가),
  자기 반 단원의 `activities`/`rubric_criteria`/`misconceptions` 읽기 전용
- **교사**: 자기 반(`classes.teacher_id = auth.uid()`)에 속한 단원·활동·루브릭·오개념·학생·산출물·리뷰 관리
- 반 합류는 **오직** `join_class(코드, 라벨)` `security definer` RPC로만 수행합니다.
  `students` 테이블에 학생 insert 정책을 두지 않아, 초대 코드 없이 임의 반 자가등록이 불가능합니다.

> 이 정책들은 로컬 PostgreSQL 16에서 다중 사용자 시나리오로 검증했습니다:
> 학생 간 격리, 교사 간 격리, 학생의 타인 답안 수정 차단, 리뷰 위조 차단,
> 잘못된 초대 코드 거부·중복 합류 멱등성, 교사별 단원 저작 격리,
> 학생의 직접 자가등록 차단. (`supabase/migrations/0001_init.sql`)

## 설정 및 실행

1. **Supabase 프로젝트 생성** → Project Settings → API 에서 URL·anon key 복사.
2. **익명 로그인 활성화**: Authentication → Providers → *Anonymous sign-ins* 켜기.
   (선택) 교사 가입을 바로 쓰려면 Authentication → Email → *Confirm email* 을 꺼도 됩니다.
3. **마이그레이션 실행**: Supabase 대시보드 SQL Editor에 `supabase/migrations/0001_init.sql`
   내용을 붙여넣고 실행. (또는 Supabase CLI: `supabase db push`)
4. **환경 변수**:
   ```bash
   cp .env.local.example .env.local
   # .env.local 에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY 채우기
   ```
5. **의존성 설치·실행**:
   ```bash
   npm install
   npm run dev        # http://localhost:3000
   ```

## 사용 흐름

1. 교사가 `/teacher`에서 가입·로그인 → `/teacher/dashboard`에서 반 생성 → 초대 코드 확인.
2. 교사가 단원을 만든다: **빈 단원**을 만들어 책·성취기준·활동·루브릭·오개념을 직접 저작하거나,
   **샘플(예시) 단원 불러오기**로 예시 세트를 채운 뒤 수정한다.
3. 학생이 `/student`에서 초대 코드 + 익명 라벨(S-001 등)로 참여.
4. 학생이 `/student/work`에서 단원별 활동 작성(자동 저장).
5. 교사가 단원 페이지의 진행 표에서 셀을 눌러 답안 검토 → 루브릭·오개념·피드백 저장.

## 제약 (Stage 3 유지 원칙)

- 실명·학번·민감정보 수집 없음
- AI 자동채점·세특 자동 확정 없음 — 교사가 최종 판단자
- `service_role` 키는 클라이언트에 넣지 않음 (anon 키 + RLS로만 접근 제어)

## 남은 확장 (Stage 3+)

- 여러 반 선택 UI, 오개념 빈도·평균 루브릭 점수 차트, CSV 서버 내보내기
- 포트폴리오 증거(E) 묶음 뷰, 성장 타임라인
- 교사 계정 조직/학교 단위 관리
