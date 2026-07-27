-- =============================================================
-- schema.sql — 전체 스키마 한 번에 적용 (0001~0008 통합)
-- Supabase SQL Editor에 붙여넣고 Run 하면 됩니다.
-- 자동 생성 파일: 개별 마이그레이션(supabase/migrations/*)이 원본입니다.
-- =============================================================


-- ========== 0001_init.sql ==========
-- ============================================================================
-- 0001_init.sql
-- Phase 1 스키마: enum, 테이블, 제약조건, 인덱스
-- 시간 열은 모두 timestamptz. 공통 열(id/created_at/updated_at)을 일관 적용.
-- ============================================================================

-- 사용자 역할 enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('student', 'teacher', 'admin');
  end if;
end
$$;

-- ----------------------------------------------------------------------------
-- profiles: auth.users 와 1:1. 개인정보는 최소한만 저장(전화/주소/학번 없음).
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text        not null check (char_length(display_name) between 1 and 20),
  role         public.user_role not null default 'student',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- classes: 학급. teacher_id 는 담당 교사. join_code 는 추측 어려운 임의 코드.
-- ----------------------------------------------------------------------------
create table if not exists public.classes (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null check (char_length(name) between 2 and 40),
  teacher_id  uuid        not null references public.profiles (id) on delete cascade,
  join_code   text        not null unique,
  description text        null check (description is null or char_length(description) <= 300),
  archived_at timestamptz null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists classes_teacher_id_idx on public.classes (teacher_id);

-- ----------------------------------------------------------------------------
-- class_members: 학급 구성원. (class_id, user_id) 복합 PK 로 중복 가입 차단.
-- ----------------------------------------------------------------------------
create table if not exists public.class_members (
  class_id    uuid        not null references public.classes (id) on delete cascade,
  user_id     uuid        not null references public.profiles (id) on delete cascade,
  member_role public.user_role not null default 'student',
  status      text        not null default 'active'
                          check (status in ('active', 'pending', 'removed')),
  joined_at   timestamptz not null default now(),
  primary key (class_id, user_id)
);

create index if not exists class_members_user_id_idx on public.class_members (user_id);

-- ----------------------------------------------------------------------------
-- books: 학급별 도서.
-- ----------------------------------------------------------------------------
create table if not exists public.books (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid        not null references public.classes (id) on delete cascade,
  title       text        not null check (char_length(title) between 1 and 200),
  author      text        null check (author is null or char_length(author) <= 100),
  publisher   text        null check (publisher is null or char_length(publisher) <= 100),
  isbn        text        null check (isbn is null or char_length(isbn) <= 20),
  cover_url   text        null check (cover_url is null or char_length(cover_url) <= 500),
  description text        null check (description is null or char_length(description) <= 1000),
  created_by  uuid        not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists books_class_id_idx on public.books (class_id);

-- ----------------------------------------------------------------------------
-- sentence_cards: 문장 수집 카드. quote/reason/interpretation 필수.
-- page_reference 는 종이책 쪽수와 전자책 위치를 모두 담기 위해 text.
-- ----------------------------------------------------------------------------
create table if not exists public.sentence_cards (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid        not null references public.profiles (id) on delete cascade,
  class_id       uuid        not null references public.classes (id) on delete cascade,
  book_id        uuid        not null references public.books (id) on delete cascade,
  quote          text        not null check (char_length(quote) between 1 and 1000),
  page_reference text        null check (page_reference is null or char_length(page_reference) <= 50),
  reason         text        not null check (char_length(reason) between 1 and 1000),
  interpretation text        not null check (char_length(interpretation) between 1 and 2000),
  question       text        null check (question is null or char_length(question) <= 500),
  tags           text[]      not null default '{}' check (array_length(tags, 1) is null or array_length(tags, 1) <= 8),
  visibility     text        not null default 'private' check (visibility in ('private', 'class')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists sentence_cards_user_id_idx on public.sentence_cards (user_id);
create index if not exists sentence_cards_class_book_idx on public.sentence_cards (class_id, book_id);

-- ========== 0002_functions.sql ==========
-- ============================================================================
-- 0002_functions.sql
-- 트리거 함수, 권한 보조 함수(SECURITY DEFINER), 학급 참여 RPC
--
-- 보안 원칙:
--  * 모든 SECURITY DEFINER 함수는 search_path 를 명시적으로 ''(비움) 으로 고정하고
--    모든 객체를 스키마로 정규화한다.
--  * 권한 보조 함수는 항상 auth.uid() 만 사용한다. 임의 user_id 를 인자로 받지 않아
--    호출자가 다른 사용자를 사칭할 수 없다.
--  * 보조 함수는 SECURITY DEFINER 로 RLS 를 우회하므로 RLS 정책에서 사용해도
--    무한 재귀가 발생하지 않는다.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- updated_at 자동 갱신
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.classes;
create trigger set_updated_at before update on public.classes
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.books;
create trigger set_updated_at before update on public.books
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.sentence_cards;
create trigger set_updated_at before update on public.sentence_cards
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 회원가입 시 profile 자동 생성. role 은 항상 'student' 로 강제한다.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), '학생'), 20),
    'student'  -- 신규 사용자는 무조건 학생. 클라이언트 입력을 신뢰하지 않는다.
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 참여 코드 생성: 혼동 문자(0,O,1,I,L) 제외한 대문자+숫자 8자리.
-- classes INSERT 시 join_code 가 비어 있으면 유일한 코드를 생성한다.
-- ----------------------------------------------------------------------------
create or replace function public.generate_join_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
begin
  loop
    candidate := '';
    for i in 1..8 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.classes where join_code = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public.set_class_join_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.join_code is null or char_length(trim(new.join_code)) = 0 then
    new.join_code := public.generate_join_code();
  end if;
  return new;
end;
$$;

drop trigger if exists set_join_code on public.classes;
create trigger set_join_code before insert on public.classes
  for each row execute function public.set_class_join_code();

-- ----------------------------------------------------------------------------
-- 학급 생성 시 담당 교사를 구성원(member_role='teacher')으로 자동 추가.
-- ----------------------------------------------------------------------------
create or replace function public.add_teacher_as_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.class_members (class_id, user_id, member_role, status)
  values (new.id, new.teacher_id, 'teacher', 'active')
  on conflict (class_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_class_created on public.classes;
create trigger on_class_created
  after insert on public.classes
  for each row execute function public.add_teacher_as_member();

-- ----------------------------------------------------------------------------
-- 권한 보조 함수 (RLS 정책에서 사용, 재귀 방지용 SECURITY DEFINER)
-- ----------------------------------------------------------------------------

-- 현재 로그인 사용자의 역할
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- 현재 사용자가 해당 학급의 활성 구성원인가
create or replace function public.is_class_member(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.class_members
    where class_id = p_class_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

-- 현재 사용자가 해당 학급의 담당 교사인가
create or replace function public.is_class_teacher(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.classes
    where id = p_class_id
      and teacher_id = auth.uid()
  );
$$;

-- 현재 사용자가 대상 사용자와 같은 학급(활성)을 공유하는가 (profiles 조회용)
create or replace function public.shares_class_with(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.class_members m_self
    join public.class_members m_other
      on m_self.class_id = m_other.class_id
    where m_self.user_id = auth.uid()
      and m_self.status = 'active'
      and m_other.user_id = p_other
      and m_other.status = 'active'
  );
$$;

-- ----------------------------------------------------------------------------
-- 학급 참여 RPC
-- 클라이언트가 classes 를 직접 검색하지 못하게 하고, 코드 검증/가입을 서버에서 처리.
-- 반환: json { status: 'joined' | 'already_member' | 'invalid', class_id, class_name }
-- 잘못된 코드에서는 학급 존재 여부/교사 정보를 노출하지 않는다.
-- ----------------------------------------------------------------------------
create or replace function public.join_class_with_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_class public.classes%rowtype;
  v_norm  text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
begin
  if v_uid is null then
    return jsonb_build_object('status', 'unauthenticated');
  end if;

  select * into v_class
  from public.classes
  where join_code = v_norm and archived_at is null;

  if not found then
    -- 학급 존재 여부를 드러내지 않기 위해 동일한 invalid 응답만 반환한다.
    return jsonb_build_object('status', 'invalid');
  end if;

  if exists (
    select 1 from public.class_members
    where class_id = v_class.id and user_id = v_uid and status = 'active'
  ) then
    return jsonb_build_object(
      'status', 'already_member',
      'class_id', v_class.id,
      'class_name', v_class.name
    );
  end if;

  insert into public.class_members (class_id, user_id, member_role, status)
  values (v_class.id, v_uid, 'student', 'active')
  on conflict (class_id, user_id)
  do update set status = 'active';

  return jsonb_build_object(
    'status', 'joined',
    'class_id', v_class.id,
    'class_name', v_class.name
  );
end;
$$;

-- RPC 는 로그인 사용자만 실행 가능
revoke all on function public.join_class_with_code(text) from public, anon;
grant execute on function public.join_class_with_code(text) to authenticated;

-- ========== 0003_rls.sql ==========
-- ============================================================================
-- 0003_rls.sql
-- 모든 public 테이블에 RLS 활성화 + 정책 정의.
-- 원칙: 화면이 아니라 DB 정책으로 권한을 통제한다.
-- ============================================================================

alter table public.profiles       enable row level security;
alter table public.classes        enable row level security;
alter table public.class_members  enable row level security;
alter table public.books          enable row level security;
alter table public.sentence_cards enable row level security;

-- 역할 변경 방어: authenticated 는 profiles 의 특정 열만 UPDATE 가능(role 제외).
-- 교사 권한 부여는 Supabase 관리 화면/서버 스크립트(service_role)에서만 수행한다.
revoke update on public.profiles from authenticated;
grant update (display_name, updated_at) on public.profiles to authenticated;

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_class_with(id));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
-- INSERT 는 handle_new_user 트리거(SECURITY DEFINER)만 수행. authenticated 정책 없음.
-- DELETE 는 auth.users 삭제 시 cascade. authenticated 정책 없음.

-- ----------------------------------------------------------------------------
-- classes
-- ----------------------------------------------------------------------------
drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes
  for select to authenticated
  using (teacher_id = auth.uid() or public.is_class_member(id));

drop policy if exists classes_insert_teacher on public.classes;
create policy classes_insert_teacher on public.classes
  for insert to authenticated
  with check (
    teacher_id = auth.uid()
    and public.current_user_role() in ('teacher', 'admin')
  );

drop policy if exists classes_update_owner on public.classes;
create policy classes_update_owner on public.classes
  for update to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

drop policy if exists classes_delete_owner on public.classes;
create policy classes_delete_owner on public.classes
  for delete to authenticated
  using (teacher_id = auth.uid());

-- ----------------------------------------------------------------------------
-- class_members
-- INSERT 는 join_class_with_code RPC 와 add_teacher_as_member 트리거(둘 다
-- SECURITY DEFINER)만 수행한다. authenticated INSERT 정책을 두지 않아
-- 학생이 다른 사용자를 임의로 학급에 추가할 수 없다.
-- ----------------------------------------------------------------------------
drop policy if exists class_members_select on public.class_members;
create policy class_members_select on public.class_members
  for select to authenticated
  using (public.is_class_member(class_id) or public.is_class_teacher(class_id));

drop policy if exists class_members_update_teacher on public.class_members;
create policy class_members_update_teacher on public.class_members
  for update to authenticated
  using (public.is_class_teacher(class_id))
  with check (public.is_class_teacher(class_id));

drop policy if exists class_members_delete_teacher on public.class_members;
create policy class_members_delete_teacher on public.class_members
  for delete to authenticated
  using (public.is_class_teacher(class_id));

-- ----------------------------------------------------------------------------
-- books
-- ----------------------------------------------------------------------------
drop policy if exists books_select_member on public.books;
create policy books_select_member on public.books
  for select to authenticated
  using (public.is_class_member(class_id) or public.is_class_teacher(class_id));

drop policy if exists books_insert_teacher on public.books;
create policy books_insert_teacher on public.books
  for insert to authenticated
  with check (public.is_class_teacher(class_id) and created_by = auth.uid());

drop policy if exists books_update_teacher on public.books;
create policy books_update_teacher on public.books
  for update to authenticated
  using (public.is_class_teacher(class_id))
  with check (public.is_class_teacher(class_id));

drop policy if exists books_delete_teacher on public.books;
create policy books_delete_teacher on public.books
  for delete to authenticated
  using (public.is_class_teacher(class_id));

-- ----------------------------------------------------------------------------
-- sentence_cards
-- 학생: 본인 카드 CRUD. 교사: 담당 학급 카드 SELECT 만(수정 불가).
-- ----------------------------------------------------------------------------
drop policy if exists sentence_cards_select on public.sentence_cards;
create policy sentence_cards_select on public.sentence_cards
  for select to authenticated
  using (user_id = auth.uid() or public.is_class_teacher(class_id));

drop policy if exists sentence_cards_insert_own on public.sentence_cards;
create policy sentence_cards_insert_own on public.sentence_cards
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_class_member(class_id));

drop policy if exists sentence_cards_update_own on public.sentence_cards;
create policy sentence_cards_update_own on public.sentence_cards
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists sentence_cards_delete_own on public.sentence_cards;
create policy sentence_cards_delete_own on public.sentence_cards
  for delete to authenticated
  using (user_id = auth.uid());

-- ========== 0004_works.sql ==========
-- ============================================================================
-- 0004_works.sql  (Phase 2)
-- 서평·북포스터(works) + 상태 워크플로 + RLS
--
-- 상태 워크플로:
--   draft ─(학생 제출)→ submitted ─(교사)→ published(게시)  or  rejected(반려)
--   rejected ─(학생 수정 후 재제출)→ submitted
--   published ─(교사)→ hidden(내림)
--   'approved' 값은 향후 "승인 후 별도 게시" 2단계 흐름을 위해 예약(현재 미사용).
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'work_kind') then
    create type public.work_kind as enum ('review', 'poster');
  end if;
  if not exists (select 1 from pg_type where typname = 'work_mode') then
    create type public.work_mode as enum ('structured', 'free');
  end if;
  if not exists (select 1 from pg_type where typname = 'work_status') then
    create type public.work_status as enum
      ('draft', 'submitted', 'approved', 'published', 'rejected', 'hidden');
  end if;
end
$$;

create table if not exists public.works (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  class_id          uuid not null references public.classes (id) on delete cascade,
  book_id           uuid not null references public.books (id) on delete cascade,
  kind              public.work_kind not null,
  -- 서평 전용: 작성 모드. 포스터는 null.
  mode              public.work_mode null,
  title             text null check (title is null or char_length(title) <= 200),
  -- 자유 모드 본문
  body              text null check (body is null or char_length(body) <= 20000),
  -- 구조화 모드 7개 섹션(jsonb). 키: one_line, key_problem, impressive_sentence,
  -- author_judgment, disagreement, connection, final_evaluation
  sections          jsonb null,
  -- 포스터 전용: private bucket 내 경로(개인정보 미포함)
  poster_path       text null check (poster_path is null or char_length(poster_path) <= 400),
  poster_thumb_path text null check (poster_thumb_path is null or char_length(poster_thumb_path) <= 400),
  status            public.work_status not null default 'draft',
  review_note       text null check (review_note is null or char_length(review_note) <= 1000),
  reviewed_by       uuid null references public.profiles (id) on delete set null,
  submitted_at      timestamptz null,
  published_at      timestamptz null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- kind 별 필수/불가 열 정합성
  constraint works_kind_mode_ck check (
    (kind = 'review' and mode is not null)
    or (kind = 'poster' and mode is null)
  )
);

create index if not exists works_class_status_idx on public.works (class_id, status);
create index if not exists works_user_idx on public.works (user_id);
create index if not exists works_book_idx on public.works (book_id);

drop trigger if exists set_updated_at on public.works;
create trigger set_updated_at before update on public.works
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.works enable row level security;

-- 조회: 본인(모든 상태) / 담당 교사(모든 상태) / 같은 학급 구성원(게시된 것만)
drop policy if exists works_select on public.works;
create policy works_select on public.works
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_class_teacher(class_id)
    or (public.is_class_member(class_id) and status = 'published')
  );

-- 생성: 본인 소유 + 학급 구성원 + draft 로만 시작
drop policy if exists works_insert_own on public.works;
create policy works_insert_own on public.works
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_class_member(class_id)
    and status = 'draft'
  );

-- 수정(작성자): draft/rejected 상태에서만 편집, 상태는 draft/submitted/rejected 로만.
-- (교사 승인/게시/숨김 상태로 스스로 올릴 수 없다)
drop policy if exists works_update_owner on public.works;
create policy works_update_owner on public.works
  for update to authenticated
  using (user_id = auth.uid() and status in ('draft', 'rejected'))
  with check (user_id = auth.uid() and status in ('draft', 'submitted', 'rejected'));

-- 수정(담당 교사): 상태 전이(승인/반려/숨김) 담당. 내용 열은 서버 액션에서만 변경.
drop policy if exists works_update_teacher on public.works;
create policy works_update_teacher on public.works
  for update to authenticated
  using (public.is_class_teacher(class_id))
  with check (public.is_class_teacher(class_id));

-- 삭제(작성자): draft/rejected 에서만
drop policy if exists works_delete_owner on public.works;
create policy works_delete_owner on public.works
  for delete to authenticated
  using (user_id = auth.uid() and status in ('draft', 'rejected'));

-- ========== 0005_storage.sql ==========
-- ============================================================================
-- 0005_storage.sql  (Phase 2)
-- 북포스터용 private Storage 버킷 + RLS 정책
--
-- 주의:
--  * 이 마이그레이션은 storage 스키마 소유 권한이 필요하다(Supabase SQL Editor 의
--    postgres 역할 또는 db push 로 실행). 로컬/클라우드에서 실행/검증한다.
--  * 버킷은 private. 조회는 서버가 생성한 서명 URL 로만 노출한다.
--  * 파일 경로는 `{class_id}/{work_id}.webp` 형식으로, 학생 이름/학번/이메일을 포함하지 않는다.
--  * 클라이언트가 canvas 재인코딩으로 EXIF(위치정보 포함)를 제거한 webp 만 업로드한다.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'posters',
  'posters',
  false,
  10485760, -- 10MB
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 첫 폴더명(class_id)을 안전하게 uuid 로 변환. 형식이 아니면 null 반환.
create or replace function public.storage_first_folder_uuid(object_name text)
returns uuid
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_first text := (storage.foldername(object_name))[1];
begin
  return v_first::uuid;
exception
  when others then
    return null;
end;
$$;

-- 업로드: 인증 사용자가 자신이 속한 학급 폴더에만 업로드
drop policy if exists posters_insert on storage.objects;
create policy posters_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'posters'
    and public.is_class_member(public.storage_first_folder_uuid(name))
  );

-- 조회: 해당 파일을 참조하는 works 의 가시성 규칙을 그대로 따른다
--   (본인 / 담당 교사 / 게시된 작품을 보는 같은 학급 구성원)
drop policy if exists posters_select on storage.objects;
create policy posters_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'posters'
    and exists (
      select 1 from public.works w
      where (w.poster_path = storage.objects.name or w.poster_thumb_path = storage.objects.name)
        and (
          w.user_id = auth.uid()
          or public.is_class_teacher(w.class_id)
          or (public.is_class_member(w.class_id) and w.status = 'published')
        )
    )
  );

-- 수정: 업로더 본인만(재업로드)
drop policy if exists posters_update on storage.objects;
create policy posters_update on storage.objects
  for update to authenticated
  using (bucket_id = 'posters' and owner = auth.uid())
  with check (bucket_id = 'posters' and owner = auth.uid());

-- 삭제: 업로더 본인 또는 담당 교사(부적절 이미지 내림)
drop policy if exists posters_delete on storage.objects;
create policy posters_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'posters'
    and (
      owner = auth.uid()
      or public.is_class_teacher(public.storage_first_folder_uuid(name))
    )
  );

-- ========== 0006_engagement.sql ==========
-- ============================================================================
-- 0006_engagement.sql  (Phase 3)
-- 댓글 · 답글 · 신고 · 좋아요 · 별점 · 상호평가 기간(voting_rounds)
--
-- 공정성 원칙:
--  * 자기 작품에는 좋아요/별점을 줄 수 없다(헬퍼 함수로 차단).
--  * 중복 좋아요/별점은 복합 PK로 차단.
--  * 평가 기간(open) 동안에는 타인의 좋아요/별점 집계를 볼 수 없다(RLS로 차단).
--  * 좋아요/별점은 "게시된(published)" 작품에만, "평가 기간이 열린" 동안만 가능.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 상호평가 기간
-- ----------------------------------------------------------------------------
create table if not exists public.voting_rounds (
  id                      uuid primary key default gen_random_uuid(),
  class_id                uuid not null references public.classes (id) on delete cascade,
  label                   text null check (label is null or char_length(label) <= 60),
  opens_at                timestamptz not null,
  closes_at               timestamptz not null,
  min_reviews_per_student int not null default 0 check (min_reviews_per_student >= 0),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint voting_rounds_period_ck check (closes_at > opens_at)
);
create index if not exists voting_rounds_class_idx on public.voting_rounds (class_id);

-- ----------------------------------------------------------------------------
-- 댓글 / 답글
-- ----------------------------------------------------------------------------
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  work_id    uuid not null references public.works (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  parent_id  uuid null references public.comments (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  hidden_at  timestamptz null,
  hidden_by  uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists comments_work_idx on public.comments (work_id, created_at);
create index if not exists comments_parent_idx on public.comments (parent_id);
create index if not exists comments_user_recent_idx on public.comments (user_id, created_at);

-- ----------------------------------------------------------------------------
-- 좋아요 (한 작품당 한 번)
-- ----------------------------------------------------------------------------
create table if not exists public.likes (
  work_id    uuid not null references public.works (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (work_id, user_id)
);
create index if not exists likes_work_idx on public.likes (work_id);

-- ----------------------------------------------------------------------------
-- 별점 (1~5, 한 작품당 한 번, 수정 가능)
-- ----------------------------------------------------------------------------
create table if not exists public.ratings (
  work_id    uuid not null references public.works (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  score      smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (work_id, user_id)
);
create index if not exists ratings_work_idx on public.ratings (work_id);

-- ----------------------------------------------------------------------------
-- 신고 (부적절 댓글)
-- ----------------------------------------------------------------------------
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  comment_id  uuid not null references public.comments (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason      text null check (reason is null or char_length(reason) <= 500),
  status      text not null default 'open' check (status in ('open', 'resolved')),
  created_at  timestamptz not null default now(),
  unique (comment_id, reporter_id)
);
create index if not exists reports_comment_idx on public.reports (comment_id);

-- updated_at 트리거
drop trigger if exists set_updated_at on public.voting_rounds;
create trigger set_updated_at before update on public.voting_rounds
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.comments;
create trigger set_updated_at before update on public.comments
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.ratings;
create trigger set_updated_at before update on public.ratings
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 권한/공정성 보조 함수 (SECURITY DEFINER, search_path 고정)
-- ----------------------------------------------------------------------------

-- 작품의 학급 id
create or replace function public.work_class_id(p_work uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select class_id from public.works where id = p_work;
$$;

-- 작품의 담당 교사인가
create or replace function public.is_work_class_teacher(p_work uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_class_teacher(public.work_class_id(p_work));
$$;

-- 해당 학급에 지금 열린 평가 기간이 있는가
create or replace function public.is_voting_open(p_class uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.voting_rounds
    where class_id = p_class and now() >= opens_at and now() < closes_at
  );
$$;

-- 결과(집계)를 공개해도 되는가: 열린 평가 기간이 없으면 공개
create or replace function public.results_revealed(p_work uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select not public.is_voting_open(public.work_class_id(p_work));
$$;

-- 게시된 작품 + 같은 학급 구성원(댓글 열람/작성 기준)
create or replace function public.can_engage_published(p_work uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.works w
    where w.id = p_work and w.status = 'published'
      and public.is_class_member(w.class_id)
  );
$$;

-- 평가(좋아요/별점) 가능: 게시됨 + 구성원 + 자기 작품 아님 + 평가 기간 열림
create or replace function public.can_rate_work(p_work uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.works w
    where w.id = p_work and w.status = 'published'
      and w.user_id <> auth.uid()
      and public.is_class_member(w.class_id)
      and public.is_voting_open(w.class_id)
  );
$$;

-- 신고 가능: 댓글이 속한 게시 작품을 볼 수 있는 구성원
create or replace function public.can_report_comment(p_comment uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.comments c
    where c.id = p_comment and public.can_engage_published(c.work_id)
  );
$$;

-- 댓글이 속한 학급의 담당 교사인가
create or replace function public.is_comment_class_teacher(p_comment uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.comments c
    where c.id = p_comment and public.is_work_class_teacher(c.work_id)
  );
$$;

-- 연속 등록 제한(같은 사용자 5초 내 재작성 차단)
create or replace function public.enforce_comment_rate_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.comments
    where user_id = new.user_id and created_at > now() - interval '5 seconds'
  ) then
    raise exception 'comment_rate_limit' using message = '잠시 후 다시 시도하세요.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_rate_limit on public.comments;
create trigger enforce_rate_limit before insert on public.comments
  for each row execute function public.enforce_comment_rate_limit();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.voting_rounds enable row level security;
alter table public.comments      enable row level security;
alter table public.likes         enable row level security;
alter table public.ratings       enable row level security;
alter table public.reports       enable row level security;

-- voting_rounds: 구성원 조회, 담당 교사 관리
drop policy if exists voting_rounds_select on public.voting_rounds;
create policy voting_rounds_select on public.voting_rounds
  for select to authenticated
  using (public.is_class_member(class_id) or public.is_class_teacher(class_id));
drop policy if exists voting_rounds_write on public.voting_rounds;
create policy voting_rounds_write on public.voting_rounds
  for all to authenticated
  using (public.is_class_teacher(class_id))
  with check (public.is_class_teacher(class_id));

-- comments: 게시 작품을 보는 구성원 조회(숨김 댓글은 교사/작성자만)
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
  for select to authenticated
  using (
    public.can_engage_published(work_id)
    and (hidden_at is null or user_id = auth.uid() or public.is_work_class_teacher(work_id))
  );
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_engage_published(work_id));
-- 작성자 본인 수정(내용). 상태(hidden)는 교사 정책에서.
drop policy if exists comments_update_author on public.comments;
create policy comments_update_author on public.comments
  for update to authenticated
  using (user_id = auth.uid() and hidden_at is null)
  with check (user_id = auth.uid());
drop policy if exists comments_update_teacher on public.comments;
create policy comments_update_teacher on public.comments
  for update to authenticated
  using (public.is_work_class_teacher(work_id))
  with check (public.is_work_class_teacher(work_id));
drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments
  for delete to authenticated
  using (user_id = auth.uid() or public.is_work_class_teacher(work_id));

-- likes: 본인 행/교사는 항상, 타인 행은 결과 공개 시에만(평가 기간 중 집계 숨김)
drop policy if exists likes_select on public.likes;
create policy likes_select on public.likes
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_work_class_teacher(work_id)
    or (public.can_engage_published(work_id) and public.results_revealed(work_id))
  );
drop policy if exists likes_insert on public.likes;
create policy likes_insert on public.likes
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_rate_work(work_id));
drop policy if exists likes_delete on public.likes;
create policy likes_delete on public.likes
  for delete to authenticated
  using (user_id = auth.uid());

-- ratings: likes 와 동일한 가시성. 삽입 시 자기 작품 금지/평가 기간 검사.
drop policy if exists ratings_select on public.ratings;
create policy ratings_select on public.ratings
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_work_class_teacher(work_id)
    or (public.can_engage_published(work_id) and public.results_revealed(work_id))
  );
drop policy if exists ratings_insert on public.ratings;
create policy ratings_insert on public.ratings
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_rate_work(work_id));
drop policy if exists ratings_update on public.ratings;
create policy ratings_update on public.ratings
  for update to authenticated
  using (user_id = auth.uid() and public.can_rate_work(work_id))
  with check (user_id = auth.uid() and public.can_rate_work(work_id));
drop policy if exists ratings_delete on public.ratings;
create policy ratings_delete on public.ratings
  for delete to authenticated
  using (user_id = auth.uid());

-- reports: 신고자 본인 또는 담당 교사 조회. 삽입은 볼 수 있는 댓글에만. 처리는 교사.
drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports
  for select to authenticated
  using (reporter_id = auth.uid() or public.is_comment_class_teacher(comment_id));
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports
  for insert to authenticated
  with check (reporter_id = auth.uid() and public.can_report_comment(comment_id));
drop policy if exists reports_update_teacher on public.reports;
create policy reports_update_teacher on public.reports
  for update to authenticated
  using (public.is_comment_class_teacher(comment_id))
  with check (public.is_comment_class_teacher(comment_id));

-- ========== 0007_rubric.sql ==========
-- ============================================================================
-- 0007_rubric.sql  (Phase 4)
-- 교사 루브릭 평가 + 최종 우수작 선정
--
-- 우수작 후보는 동료평가(좋아요/별점) 기반 점수로 "추천"만 한다(자동 확정 아님).
-- 교사가 루브릭으로 평가하고 최종 우수작을 확정한다.
-- ============================================================================

-- 최종 우수작 선정 표시(담당 교사만 설정). works 갱신은 기존 교사 정책이 허용.
alter table public.works
  add column if not exists featured_at timestamptz null,
  add column if not exists featured_by uuid null references public.profiles (id) on delete set null;

create index if not exists works_featured_idx on public.works (class_id, featured_at);

-- ----------------------------------------------------------------------------
-- 교사 루브릭 점수
-- criteria: jsonb (예: {"understanding":4,"evidence":5,"expression":3})
-- total: 합계(앱에서 계산해 저장)
-- ----------------------------------------------------------------------------
create table if not exists public.teacher_rubric_scores (
  id         uuid primary key default gen_random_uuid(),
  work_id    uuid not null references public.works (id) on delete cascade,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  criteria   jsonb not null default '{}'::jsonb,
  total      int not null default 0 check (total >= 0 and total <= 100),
  comment    text null check (comment is null or char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (work_id, teacher_id)
);
create index if not exists rubric_work_idx on public.teacher_rubric_scores (work_id);

drop trigger if exists set_updated_at on public.teacher_rubric_scores;
create trigger set_updated_at before update on public.teacher_rubric_scores
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS: 담당 교사만. (학생에게는 루브릭 점수를 노출하지 않는다)
-- ----------------------------------------------------------------------------
alter table public.teacher_rubric_scores enable row level security;

drop policy if exists rubric_select_teacher on public.teacher_rubric_scores;
create policy rubric_select_teacher on public.teacher_rubric_scores
  for select to authenticated
  using (public.is_work_class_teacher(work_id));

drop policy if exists rubric_insert_teacher on public.teacher_rubric_scores;
create policy rubric_insert_teacher on public.teacher_rubric_scores
  for insert to authenticated
  with check (public.is_work_class_teacher(work_id) and teacher_id = auth.uid());

drop policy if exists rubric_update_teacher on public.teacher_rubric_scores;
create policy rubric_update_teacher on public.teacher_rubric_scores
  for update to authenticated
  using (public.is_work_class_teacher(work_id) and teacher_id = auth.uid())
  with check (public.is_work_class_teacher(work_id) and teacher_id = auth.uid());

drop policy if exists rubric_delete_teacher on public.teacher_rubric_scores;
create policy rubric_delete_teacher on public.teacher_rubric_scores
  for delete to authenticated
  using (public.is_work_class_teacher(work_id) and teacher_id = auth.uid());

-- ========== 0008_chat.sql ==========
-- ============================================================================
-- 0008_chat.sql  (Phase 5)
-- 독서 산파법 챗봇: 대화 세션 · 메시지
--
-- 원칙:
--  * AI는 서평을 대필하지 않는다. 한 번에 질문 하나만 기록한다.
--  * 학생 답변은 세션에 기록되며, 본인만 CRUD. 담당 교사는 열람(오남용 점검)만.
--  * 학생 식별정보(이름/이메일/학번)는 저장/전송하지 않는다.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'socratic_stage') then
    create type public.socratic_stage as enum (
      'OBSERVE', 'INTERPRET', 'EVIDENCE', 'COUNTERARGUMENT',
      'CONNECT', 'ORGANIZE', 'COMPLETE'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'chat_role') then
    create type public.chat_role as enum ('assistant', 'user');
  end if;
end
$$;

create table if not exists public.chat_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  class_id   uuid not null references public.classes (id) on delete cascade,
  book_id    uuid not null references public.books (id) on delete cascade,
  stage      public.socratic_stage not null default 'OBSERVE',
  status     text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chat_sessions_user_idx on public.chat_sessions (user_id, updated_at);

create table if not exists public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions (id) on delete cascade,
  role       public.chat_role not null,
  stage      public.socratic_stage not null,
  content    text not null check (char_length(content) between 1 and 4000),
  -- assistant 메시지의 구조화 응답(stage/question/hint/nextStage)
  structured jsonb null,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_session_idx on public.chat_messages (session_id, created_at);

drop trigger if exists set_updated_at on public.chat_sessions;
create trigger set_updated_at before update on public.chat_sessions
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 보조 함수
-- ----------------------------------------------------------------------------
create or replace function public.is_my_chat_session(p_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.chat_sessions where id = p_session and user_id = auth.uid()
  );
$$;

create or replace function public.chat_session_class(p_session uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select class_id from public.chat_sessions where id = p_session;
$$;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

-- 세션: 본인 CRUD, 담당 교사 열람(점검용)
drop policy if exists chat_sessions_select on public.chat_sessions;
create policy chat_sessions_select on public.chat_sessions
  for select to authenticated
  using (user_id = auth.uid() or public.is_class_teacher(class_id));
drop policy if exists chat_sessions_insert on public.chat_sessions;
create policy chat_sessions_insert on public.chat_sessions
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_class_member(class_id));
drop policy if exists chat_sessions_update on public.chat_sessions;
create policy chat_sessions_update on public.chat_sessions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
drop policy if exists chat_sessions_delete on public.chat_sessions;
create policy chat_sessions_delete on public.chat_sessions
  for delete to authenticated
  using (user_id = auth.uid());

-- 메시지: 내 세션(본인) 조회/작성, 담당 교사 열람
drop policy if exists chat_messages_select on public.chat_messages;
create policy chat_messages_select on public.chat_messages
  for select to authenticated
  using (
    public.is_my_chat_session(session_id)
    or public.is_class_teacher(public.chat_session_class(session_id))
  );
drop policy if exists chat_messages_insert on public.chat_messages;
create policy chat_messages_insert on public.chat_messages
  for insert to authenticated
  with check (public.is_my_chat_session(session_id));
