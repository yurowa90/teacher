# 과학 독서·논술 포트폴리오 — Stage 3 서버형 MVP

Next.js(App Router) + Supabase 기반 서버형 MVP입니다. Stage 1·2 정적 MVP를
교사/학생 역할 분리, DB 저장, RLS(행 수준 보안)로 확장했습니다.

- 교사: 이메일 계정으로 로그인 → 반 생성(모듈·활동 자동 시드) → 학생 진행 확인 → 루브릭·오개념·피드백 저장
- 학생: **익명 로그인** + 반 초대 코드 + 익명 라벨로 참여 → 활동 작성(자동 저장)
- 실명·학번·민감정보 미수집 · AI 자동채점/세특 자동 확정 없음 · 교사가 최종 판단자

## 화면 구조

| 경로 | 역할 | 설명 |
|------|------|------|
| `/` | 공통 | 교사/학생 진입 선택 |
| `/teacher` | 교사 | 이메일 로그인·가입 |
| `/teacher/dashboard` | 교사 | 반·초대코드, 학생별 진행 표, 답안 검토(루브릭·오개념·피드백) |
| `/student` | 학생 | 초대 코드 + 익명 라벨로 참여(익명 로그인) |
| `/student/work` | 학생 | 활동 카드 작성 + 자동 저장, B1 자료 표 |

## 데이터 모델 (DB 스키마)

`supabase/migrations/0001_init.sql` 참고. 주요 테이블:

```
profiles(id→auth.users, role)                         -- 역할(teacher/student)
classes(id, teacher_id→auth.users, name, invite_code) -- 교사 소유 반
modules(id, class_id, subject, standard_code, title)  -- 반에 배정된 성취기준 모듈
activities(id, module_id, code, level, type, title, prompt, sort_order)
students(id, class_id, auth_user_id→auth.users, anon_label, segment)  -- 익명 학생
artifacts(id, student_id, activity_id, content, stage, updated_at)    -- 산출물(활동별 1개)
reviews(id, student_id, activity_id, teacher_id, scores jsonb,
        misconception_ids text[], feedback, updated_at)               -- 교사 리뷰
```

**개인정보**: 실명·학번 컬럼 없음. 학생 식별은 `auth.users`의 익명 uid + 익명 라벨.

## RLS 정책 요약

- **학생**: 본인 `students`/`artifacts`만 읽기·쓰기, 본인에 대한 `reviews`만 읽기(쓰기 불가)
- **교사**: 자기 반(`classes.teacher_id = auth.uid()`)에 속한 학생·산출물·리뷰만 접근
- 최초 반 합류는 `join_class(코드, 라벨)` `security definer` RPC로 처리
  (코드를 모르는 반 정보는 볼 수 없도록 함)

> 이 정책들은 로컬 PostgreSQL 16에서 다중 사용자 시나리오로 검증했습니다:
> 학생 간 격리, 교사 간 격리, 학생의 타인 답안 수정 차단, 리뷰 위조 차단,
> 잘못된 초대 코드 거부·중복 합류 멱등성. (`supabase/migrations/0001_init.sql`)

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
2. 학생이 `/student`에서 초대 코드 + 익명 라벨(S-001 등)로 참여.
3. 학생이 `/student/work`에서 활동 작성(자동 저장).
4. 교사가 대시보드 진행 표에서 셀을 눌러 답안 검토 → 루브릭·오개념·피드백 저장.

## 제약 (Stage 3 유지 원칙)

- 실명·학번·민감정보 수집 없음
- AI 자동채점·세특 자동 확정 없음 — 교사가 최종 판단자
- `service_role` 키는 클라이언트에 넣지 않음 (anon 키 + RLS로만 접근 제어)

## 남은 확장 (Stage 3+)

- 여러 반 선택 UI, 오개념 빈도·평균 루브릭 점수 차트, CSV 서버 내보내기
- 포트폴리오 증거(E) 묶음 뷰, 성장 타임라인
- 교사 계정 조직/학교 단위 관리
