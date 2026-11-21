-- 005 — Several festivals per account (feature-plans/several-festivals.md)
--
-- Until now every account had exactly one festival (constraint festivals_one_per_account
-- in 001). Now an account can own up to 20 festivals, for example its real festival and a
-- demo. Everything else stays as it was:
--   * only the owner creates and deletes a festival (policies from 001),
--   * members, roles and saving work per festival (003, 004),
--   * deleting a festival also removes its team (festival_members ... on delete cascade).
--
-- Run once in Supabase → SQL Editor, after 001–004. Running it again is harmless.

-- 1. Allow more than one festival per owner -------------------------------------------

alter table public.festivals drop constraint if exists festivals_one_per_account;

-- The unique constraint was also the index for "festivals of this owner". Keep such an index,
-- because every policy and my_festivals() looks festivals up by owner.
create index if not exists festivals_owner_id on public.festivals (owner_id);

-- 2. At most 20 festivals per account ---------------------------------------------------
-- So nobody can fill the database by accident (or on purpose) with endless new festivals.
-- SECURITY DEFINER so the count sees every festival of that owner; it only counts, it
-- never returns data. The advisory lock makes two inserts at the same moment wait for each
-- other, so they cannot both slip under the limit.

create or replace function private.limit_festivals_per_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('festivals-of-' || new.owner_id::text, 0));
  if (select count(*) from public.festivals f where f.owner_id = new.owner_id) >= 20 then
    raise exception 'An account can have at most 20 festivals. Delete one you no longer need first.'
      using errcode = '54000';
  end if;
  return new;
end;
$$;

revoke execute on function private.limit_festivals_per_owner() from public, anon, authenticated;

drop trigger if exists limit_festivals_per_owner on public.festivals;
create trigger limit_festivals_per_owner
  before insert on public.festivals
  for each row execute function private.limit_festivals_per_owner();
