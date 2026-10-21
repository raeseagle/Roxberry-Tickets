-- =====================================================================
-- Username + password sign-in for administrators.
-- Run once in the Supabase SQL Editor, after 0001 and 0002.
-- Passwords are stored only as bcrypt hashes (never in plain text).
-- =====================================================================

create extension if not exists pgcrypto;

alter table public.admins add column if not exists username text;
alter table public.admins add column if not exists password_hash text;
alter table public.admins add column if not exists must_change_password boolean not null default false;
alter table public.admins add column if not exists last_login_at timestamptz;
alter table public.admins alter column email drop not null;
alter table public.admins alter column auth_provider set default 'password';

-- Usernames for the two existing administrators.
update public.admins set username = 'rae'  where email = 'rseagle@millyresearch.com' and username is null;
update public.admins set username = 'chad' where email = 'chad.pehrson@gmail.com'    and username is null;
update public.admins set username = split_part(email, '@', 1) where username is null;
update public.admins set auth_provider = 'password';

alter table public.admins alter column username set not null;
do $$ begin
  alter table public.admins add constraint admins_username_format
    check (username ~ '^[a-z0-9._-]{3,40}$');
exception when duplicate_object then null; end $$;
create unique index if not exists admins_username_key on public.admins (username);

-- Login sessions (only a SHA-256 hash of each session token is stored).
create table if not exists public.admin_sessions (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid not null references public.admins (id) on delete cascade,
  token_hash   text not null unique,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null
);
create index if not exists admin_sessions_admin_idx on public.admin_sessions (admin_id);
alter table public.admin_sessions enable row level security;
revoke all on public.admin_sessions from anon, authenticated;
grant all on public.admin_sessions to service_role;

-- Set (or reset) a password. p_must_change = true forces a change at next sign-in.
create or replace function public.admin_set_password(p_username text, p_password text, p_must_change boolean default false)
returns boolean language plpgsql set search_path = public, extensions, pg_temp as $$
begin
  if p_password is null or length(p_password) < 10 then
    raise exception 'Password must be at least 10 characters.';
  end if;
  update public.admins
     set password_hash = crypt(p_password, gen_salt('bf', 10)),
         must_change_password = p_must_change
   where username = lower(btrim(p_username));
  if not found then raise exception 'No administrator with that username.'; end if;
  -- Changing a password signs that person out everywhere else.
  delete from public.admin_sessions s using public.admins a
   where s.admin_id = a.id and a.username = lower(btrim(p_username));
  return true;
end $$;

-- Check a username/password. Returns the admin id, or null.
create or replace function public.admin_check_password(p_username text, p_password text)
returns uuid language plpgsql set search_path = public, extensions, pg_temp as $$
declare v_id uuid; v_hash text;
begin
  select id, password_hash into v_id, v_hash from public.admins
   where username = lower(btrim(p_username)) and is_active;
  if v_id is null or v_hash is null then
    -- Spend similar time even when the user doesn't exist.
    perform crypt(coalesce(p_password, ''), gen_salt('bf', 10));
    return null;
  end if;
  if crypt(coalesce(p_password, ''), v_hash) = v_hash then
    update public.admins set last_login_at = now() where id = v_id;
    return v_id;
  end if;
  return null;
end $$;

revoke execute on function public.admin_set_password(text, text, boolean) from public, anon, authenticated;
revoke execute on function public.admin_check_password(text, text) from public, anon, authenticated;
grant execute on function public.admin_set_password(text, text, boolean) to service_role;
grant execute on function public.admin_check_password(text, text) to service_role;

-- ---------------------------------------------------------------------
-- STARTING PASSWORDS
-- After running everything above, run these two lines SEPARATELY in a
-- new query, replacing the placeholder text with real passwords
-- (10+ characters). Do not save real passwords into this file.
-- The `true` means each person must pick their own password at first sign-in.
--
--   select public.admin_set_password('rae',  'TEMPORARY-PASSWORD-1', true);
--   select public.admin_set_password('chad', 'TEMPORARY-PASSWORD-2', true);
-- ---------------------------------------------------------------------
