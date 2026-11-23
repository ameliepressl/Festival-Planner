-- 007 — A save never silently overwrites a teammate's newer version of a section
-- See feature-plans/section-conflicts.md. Run after 001–006.
--
-- The plan is saved in sections (one browser key each, e.g. the finances or the lineup). Until now
-- the last save of a section simply won: if two people changed the finances at the same time, the
-- slower save replaced the other one's change without anyone noticing.
--
-- From now on every section has a version number. A save says which version of each section it
-- started from. If the section has been saved by someone else since, the database refuses that
-- section (and only that one), tells the browser, and the browser keeps the person's edit and asks
-- what to do. Sections that did not clash are saved as before.
--
-- Safe to run before the new page code is online: pages that do not send a version are saved
-- exactly as before. Running it again is harmless.

-- 1. A version number per section -------------------------------------------------------
alter table public.festivals
  add column if not exists section_versions jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'festivals_section_versions_is_object') then
    alter table public.festivals
      add constraint festivals_section_versions_is_object check (jsonb_typeof(section_versions) = 'object');
  end if;
end;
$$;

-- 2. Every change of a section raises its version -----------------------------------------
-- A trigger, so that every way of changing the plan counts, not only the save function below.
-- The name starts with "zz" so that it runs after the checks that may refuse the change.
create or replace function private.bump_section_versions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.data is distinct from old.data then
    new.section_versions := coalesce(old.section_versions, '{}'::jsonb) || coalesce((
      select jsonb_object_agg(k.key, coalesce((old.section_versions ->> k.key)::integer, 0) + 1)
        from (select jsonb_object_keys(old.data) as key union select jsonb_object_keys(new.data)) as k
       where (old.data -> k.key) is distinct from (new.data -> k.key)
    ), '{}'::jsonb);
  else
    new.section_versions := old.section_versions;
  end if;
  return new;
end;
$$;

revoke execute on function private.bump_section_versions() from public, anon, authenticated;

drop trigger if exists zz_bump_section_versions on public.festivals;
create trigger zz_bump_section_versions
  before update on public.festivals
  for each row execute function private.bump_section_versions();

-- 3. Saving: refuse the sections that someone else changed in the meantime ------------------
-- expected = { "<section key>": <version this browser started from> } (a missing key means
-- version 0, the section did not exist). null = no check, as before.
-- Returns when the plan was saved and when it had been saved before (as before), the current
-- versions of all sections, and the sections that were refused (conflicts).
drop function if exists public.save_festival_changes(uuid, jsonb, text[]);

create or replace function public.save_festival_changes(
  festival uuid, changes jsonb, removed text[] default '{}', expected jsonb default null)
returns table (saved_at timestamptz, previous_saved_at timestamptz, versions jsonb, conflicts text[])
language plpgsql
security invoker
set search_path = ''
as $$
declare
  before_save timestamptz;
  stored jsonb;
  clash text[] := '{}';
  accepted jsonb := changes;
  accepted_removed text[] := coalesce(removed, '{}'::text[]);
begin
  if changes is null or jsonb_typeof(changes) <> 'object' then
    raise exception 'changes must be a JSON object' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_each(changes) c
             where c.key not like 'festival-%' or jsonb_typeof(c.value) <> 'string') then
    raise exception 'only festival-… sections with text values can be saved' using errcode = '22023';
  end if;
  if expected is not null and jsonb_typeof(expected) <> 'object' then
    raise exception 'expected must be a JSON object' using errcode = '22023';
  end if;

  select f.updated_at, f.section_versions into before_save, stored
    from public.festivals f where f.id = festival for update;
  if not found then
    raise exception 'This festival does not exist or your role cannot change it.' using errcode = '42501';
  end if;

  if expected is not null then
    select coalesce(array_agg(s.key order by s.key), '{}'::text[]) into clash
      from (select c.key from jsonb_each(changes) c union select r from unnest(accepted_removed) as r) as s(key)
     where coalesce((stored ->> s.key)::integer, 0) <> coalesce((expected ->> s.key)::integer, 0);
    accepted := changes - clash;
    accepted_removed := array(select r from unnest(accepted_removed) as r where not (r = any (clash)));
  end if;

  if accepted = '{}'::jsonb and cardinality(accepted_removed) = 0 then
    saved_at := before_save;        -- nothing to write: every section clashed (or there was nothing)
  else
    update public.festivals f
       set data = (f.data - accepted_removed) || accepted
     where f.id = festival
    returning f.updated_at, f.section_versions into saved_at, stored;
    if saved_at is null then
      raise exception 'Your role cannot change this festival.' using errcode = '42501';
    end if;
  end if;

  previous_saved_at := before_save;
  versions := stored;
  conflicts := clash;
  return next;
end;
$$;

revoke execute on function public.save_festival_changes(uuid, jsonb, text[], jsonb) from public, anon;
grant execute on function public.save_festival_changes(uuid, jsonb, text[], jsonb) to authenticated;
