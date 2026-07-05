-- ============================================================
-- 과학 독서·논술 포트폴리오 — Stage 3 서버형 MVP 스키마 + RLS
-- 대상: Supabase (PostgreSQL) — auth.users, auth.uid() 사용
--
-- 역할 모델
--   교사: Supabase Auth (이메일) 계정. profiles.role = 'teacher'
--   학생: Supabase 익명 로그인(anonymous sign-in)으로 auth.uid() 확보 후
--         반 초대 코드로 등록. 실명·학번 없이 익명 라벨(S-001 등)만 저장.
--
-- 개인정보 원칙
--   실명·학번·민감정보 컬럼 없음. 학생 식별은 auth uid + 익명 라벨.
--
-- RLS 원칙
--   학생: 자신의 산출물만 읽기·쓰기, 자신에 대한 리뷰만 읽기(쓰기 불가)
--   교사: 자기 반(class)에 속한 학생·산출물·리뷰만 접근
-- ============================================================

-- ---------- 확장 ----------
create extension if not exists pgcrypto;   -- gen_random_uuid, gen_random_bytes

-- ============================================================
-- profiles : auth.users 1:1 확장 (역할 저장)
-- ============================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'teacher' check (role in ('teacher','student')),
  created_at  timestamptz not null default now()
);

-- ============================================================
-- classes : 교사가 소유하는 반. 초대 코드로 학생이 합류.
-- ============================================================
create table if not exists public.classes (
  id           uuid primary key default gen_random_uuid(),
  teacher_id   uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  invite_code  text not null unique default upper(substr(encode(gen_random_bytes(6),'hex'),1,8)),
  created_at   timestamptz not null default now()
);
create index if not exists idx_classes_teacher on public.classes(teacher_id);

-- ============================================================
-- modules : 반에 배정된 성취기준 모듈
-- ============================================================
create table if not exists public.modules (
  id             uuid primary key default gen_random_uuid(),
  class_id       uuid not null references public.classes(id) on delete cascade,
  subject        text not null,
  standard_code  text not null,
  title          text not null,
  created_at     timestamptz not null default now()
);
create index if not exists idx_modules_class on public.modules(class_id);

-- ============================================================
-- activities : 모듈의 활동(A1..E1). 교사가 관리.
-- ============================================================
create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  module_id   uuid not null references public.modules(id) on delete cascade,
  code        text not null,            -- 'A1','B2'...
  level       text not null,
  type        text not null,
  title       text not null,
  prompt      text not null,
  sort_order  int  not null default 0,
  unique (module_id, code)
);
create index if not exists idx_activities_module on public.activities(module_id);

-- ============================================================
-- students : 반에 속한 익명 학생. auth uid ↔ 익명 라벨 매핑.
--   실명·학번 없음. anon_label 예: 'S-001'
-- ============================================================
create table if not exists public.students (
  id            uuid primary key default gen_random_uuid(),
  class_id      uuid not null references public.classes(id) on delete cascade,
  auth_user_id  uuid not null references auth.users(id) on delete cascade,
  anon_label    text not null,
  segment       text not null default 'standard',
  created_at    timestamptz not null default now(),
  unique (class_id, auth_user_id),
  unique (class_id, anon_label)
);
create index if not exists idx_students_class on public.students(class_id);
create index if not exists idx_students_auth on public.students(auth_user_id);

-- ============================================================
-- artifacts : 학생 산출물 (활동별 1개, 최신본)
-- ============================================================
create table if not exists public.artifacts (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students(id) on delete cascade,
  activity_id  uuid not null references public.activities(id) on delete cascade,
  content      text not null default '',
  stage        text not null default 'initial' check (stage in ('initial','revised','final')),
  updated_at   timestamptz not null default now(),
  unique (student_id, activity_id)
);
create index if not exists idx_artifacts_student on public.artifacts(student_id);

-- ============================================================
-- reviews : 교사 리뷰 (루브릭 점수 / 오개념 / 피드백)
--   scores: {"conceptAccuracy":4, ...}
--   AI 자동채점·세특 자동 확정 없음 — 교사가 최종 판단자.
-- ============================================================
create table if not exists public.reviews (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references public.students(id) on delete cascade,
  activity_id        uuid not null references public.activities(id) on delete cascade,
  teacher_id         uuid not null references auth.users(id) on delete cascade,
  scores             jsonb not null default '{}'::jsonb,
  misconception_ids  text[] not null default '{}',
  feedback           text not null default '',
  updated_at         timestamptz not null default now(),
  unique (student_id, activity_id)
);
create index if not exists idx_reviews_student on public.reviews(student_id);

-- ============================================================
-- 헬퍼 함수 (RLS에서 재사용)
-- ============================================================

-- 현재 사용자가 소유한 반인가?
create or replace function public.is_class_teacher(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.classes c where c.id = cid and c.teacher_id = auth.uid());
$$;

-- 주어진 student 행이 현재 교사의 반에 속하는가?
create or replace function public.teacher_owns_student(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.students s
    join public.classes c on c.id = s.class_id
    where s.id = sid and c.teacher_id = auth.uid()
  );
$$;

-- 주어진 student 행이 현재 학생(auth.uid()) 본인인가?
create or replace function public.is_self_student(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.students s where s.id = sid and s.auth_user_id = auth.uid());
$$;

-- 주어진 activity가 현재 교사의 반 모듈에 속하는가?
create or replace function public.teacher_owns_activity(aid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.activities a
    join public.modules m on m.id = a.module_id
    join public.classes c on c.id = m.class_id
    where a.id = aid and c.teacher_id = auth.uid()
  );
$$;

-- ============================================================
-- RLS 활성화
-- ============================================================
alter table public.profiles   enable row level security;
alter table public.classes    enable row level security;
alter table public.modules    enable row level security;
alter table public.activities enable row level security;
alter table public.students   enable row level security;
alter table public.artifacts  enable row level security;
alter table public.reviews    enable row level security;

-- ---------- profiles ----------
create policy profiles_self_select on public.profiles
  for select using (id = auth.uid());
create policy profiles_self_upsert on public.profiles
  for insert with check (id = auth.uid());
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------- classes ----------
-- 교사: 자기 반 전체 관리
create policy classes_teacher_all on public.classes
  for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
-- 학생: 자신이 속한 반은 읽기 가능(모듈/활동 표시용)
create policy classes_student_select on public.classes
  for select using (exists (
    select 1 from public.students s where s.class_id = classes.id and s.auth_user_id = auth.uid()
  ));

-- ---------- modules ----------
create policy modules_teacher_all on public.modules
  for all using (is_class_teacher(class_id)) with check (is_class_teacher(class_id));
create policy modules_student_select on public.modules
  for select using (exists (
    select 1 from public.students s where s.class_id = modules.class_id and s.auth_user_id = auth.uid()
  ));

-- ---------- activities ----------
create policy activities_teacher_all on public.activities
  for all using (teacher_owns_activity(id)) with check (teacher_owns_activity(id));
create policy activities_student_select on public.activities
  for select using (exists (
    select 1
    from public.modules m
    join public.students s on s.class_id = m.class_id
    where m.id = activities.module_id and s.auth_user_id = auth.uid()
  ));

-- ---------- students ----------
-- 교사: 자기 반 학생 전체
create policy students_teacher_all on public.students
  for all using (is_class_teacher(class_id)) with check (is_class_teacher(class_id));
-- 학생: 본인 행만 읽기
create policy students_self_select on public.students
  for select using (auth_user_id = auth.uid());
-- 학생: 초대 코드로 자기 자신 등록(반은 코드 소유 반이어야 함은 앱/RPC에서 보장)
create policy students_self_insert on public.students
  for insert with check (auth_user_id = auth.uid());

-- ---------- artifacts ----------
-- 학생: 자신의 산출물만 읽기·쓰기
create policy artifacts_student_select on public.artifacts
  for select using (is_self_student(student_id));
create policy artifacts_student_insert on public.artifacts
  for insert with check (is_self_student(student_id));
create policy artifacts_student_update on public.artifacts
  for update using (is_self_student(student_id)) with check (is_self_student(student_id));
-- 교사: 자기 반 학생 산출물 읽기(수정 불가)
create policy artifacts_teacher_select on public.artifacts
  for select using (teacher_owns_student(student_id));

-- ---------- reviews ----------
-- 교사: 자기 반 학생 리뷰 전체 관리
create policy reviews_teacher_all on public.reviews
  for all using (teacher_owns_student(student_id) and teacher_id = auth.uid())
  with check (teacher_owns_student(student_id) and teacher_id = auth.uid());
-- 학생: 자신에 대한 리뷰만 읽기(쓰기 불가)
create policy reviews_student_select on public.reviews
  for select using (is_self_student(student_id));

-- ============================================================
-- RPC: join_class — 학생이 초대 코드로 반에 합류(익명 로그인 상태)
--   classes select 정책은 "이미 소속된 학생"만 허용하므로,
--   최초 합류는 security definer 함수로 코드 조회 후 등록한다.
-- ============================================================
create or replace function public.join_class(p_code text, p_label text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_id uuid;
  v_student_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select id into v_class_id from public.classes where invite_code = upper(p_code);
  if v_class_id is null then
    raise exception '유효하지 않은 초대 코드입니다.';
  end if;

  -- 이미 합류한 학생이면 기존 행 반환
  select id into v_student_id
  from public.students
  where class_id = v_class_id and auth_user_id = auth.uid();

  if v_student_id is not null then
    return v_student_id;
  end if;

  insert into public.students (class_id, auth_user_id, anon_label)
  values (v_class_id, auth.uid(), p_label)
  returning id into v_student_id;

  -- 학생 역할 프로필 보장
  insert into public.profiles (id, role)
  values (auth.uid(), 'student')
  on conflict (id) do nothing;

  return v_student_id;
end;
$$;

revoke all on function public.join_class(text, text) from public;
grant execute on function public.join_class(text, text) to authenticated;
