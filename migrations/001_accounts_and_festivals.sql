-- 001 — Accounts and one festival plan per account
-- See feature-plans/login.md.
--
-- How to run it (once, by the person who owns the Supabase project):
--   Supabase dashboard → SQL Editor → New query → paste this whole file → Run.
--
-- What it creates
--   profiles   the username of every account (replaces data/users.sqlite3 and server.py)
--   festivals  one festival plan per account; the plan is one JSON object
--
-- Row Level Security (RLS) is switched on for both tables. That means the database
-- itself checks every request: even someone who calls Supabase directly from the
-- browser console only ever sees and changes their own festival.

-- 1. Profiles -------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9._-]{3,32}$'),
  -- lower-case copy, so "Vicky" and "vicky" are the same username
  username_key text generated always as (lower(username)) stored,
  created_at timestamptz not null default now(),
  constraint profiles_username_unique unique (username_key)
);

-- A profile is created automatically when somebody signs up. The app sends the
-- username along with the sign-up; if it is missing, invalid or taken, the sign-up fails.
create function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');
  return new;
end;
$$;

create trigger create_profile_after_sign_up
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

alter table public.profiles enable row level security;

-- Signed-in users may look up usernames (Team form on the Overview).
-- Nobody may change profiles through the app: only the sign-up trigger writes them.
create policy "Signed-in users can look up usernames"
  on public.profiles for select
  to authenticated
  using (true);

grant select on public.profiles to authenticated;

-- 2. Festivals ------------------------------------------------------------------

create table public.festivals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now(),
  constraint festivals_one_per_account unique (owner_id)
);

-- updated_at changes on every save; the app uses it to notice a newer plan from
-- another device.
create function public.touch_festival_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger touch_festival_updated_at
  before update on public.festivals
  for each row execute function public.touch_festival_updated_at();

alter table public.festivals enable row level security;

-- Only the owner may read, create, change or delete a festival.
create policy "Owners read their festival"
  on public.festivals for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Owners create their own festival"
  on public.festivals for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Owners change their festival"
  on public.festivals for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Owners delete their festival"
  on public.festivals for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

grant select, insert, update, delete on public.festivals to authenticated;
