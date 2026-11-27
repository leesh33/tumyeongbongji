-- 투명봉지: 소셜 로그인(카카오·구글·애플) 프로필 + 기명 댓글 RLS
-- 2026-11-27 Supabase SQL Editor에서 실행 (프로젝트 nhdzexqkibotubfovbpa)
-- 꼬리핀과 같은 프로젝트를 쓰므로 tumyeongbongji_* 테이블/정책만 건드린다.

-- 1) 프로필(닉네임) 테이블
create table if not exists public.tumyeongbongji_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(btrim(nickname)) between 1 and 20),
  provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.tumyeongbongji_profiles enable row level security;

-- 2) 댓글: 작성자 계정 연결
alter table public.tumyeongbongji_comments add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.tumyeongbongji_comments enable row level security;

-- 3) 권한(GRANT) — 댓글 작성·삭제는 로그인 사용자만, 익명은 읽기만
revoke all on public.tumyeongbongji_profiles from anon;
revoke all on public.tumyeongbongji_profiles from public;
revoke insert, update, delete on public.tumyeongbongji_comments from anon;
revoke insert, update, delete on public.tumyeongbongji_comments from public;

grant select on public.tumyeongbongji_profiles to anon, authenticated;
grant insert, update on public.tumyeongbongji_profiles to authenticated;
grant select on public.tumyeongbongji_comments to anon, authenticated;
grant insert, delete on public.tumyeongbongji_comments to authenticated;

-- 4) 정책(RLS) — 본인 행만 쓰고 지운다, UPDATE는 계속 차단
drop policy if exists tb_comments_insert_anon on public.tumyeongbongji_comments;
drop policy if exists tb_profiles_select_all on public.tumyeongbongji_profiles;
drop policy if exists tb_profiles_insert_own on public.tumyeongbongji_profiles;
drop policy if exists tb_profiles_update_own on public.tumyeongbongji_profiles;
drop policy if exists tb_comments_insert_own on public.tumyeongbongji_comments;
drop policy if exists tb_comments_delete_own on public.tumyeongbongji_comments;

create policy tb_profiles_select_all on public.tumyeongbongji_profiles
  for select to anon, authenticated using (true);
create policy tb_profiles_insert_own on public.tumyeongbongji_profiles
  for insert to authenticated with check (auth.uid() = user_id);
create policy tb_profiles_update_own on public.tumyeongbongji_profiles
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy tb_comments_insert_own on public.tumyeongbongji_comments
  for insert to authenticated with check (auth.uid() = user_id);
create policy tb_comments_delete_own on public.tumyeongbongji_comments
  for delete to authenticated using (auth.uid() = user_id);

-- 참고: tumyeongbongji_feedback(제안·제보)는 예전처럼 익명 INSERT·SELECT 그대로 둔다.
