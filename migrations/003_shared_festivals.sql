-- 003 — Shared festivals: several accounts plan one festival, with roles
-- See feature-plans/shared-festivals.md. Run after 001 and 002.
--
-- Roles (as in rules/access-rules.js)
--   Owner   the account that created the festival (one per account, see 001)
--   Admin   everything, including the team
--   Editor  may save the festival, but not the finances and not the team
--   Viewer  may only read
--
-- Everything below is checked by the database itself (Row Level Security and a trigger),
-- so it also holds for someone who calls Supabase directly from the browser console.

-- 1. Helpers in a private schema ---------------------------------------------------
-- The schema "private" is not reachable through the API; policies use these helpers.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- 2. Members ------------------------------------------------------------------------

create table public.festival_members (
  festival_id uuid not null references public.festivals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('Admin', 'Editor', 'Viewer')),
  added_by uuid default auth.uid() references auth.users (id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (festival_id, user_id)
);

create index festival_members_user_id on public.festival_members (user_id);
create index festival_members_added_by on public.festival_members (added_by);

-- The signed-in account's role in a festival: 'Owner', 'Admin', 'Editor', 'Viewer' or null.
-- SECURITY DEFINER so policies can ask without running into each other's rules; it only
-- ever answers about the account that is asking.
create function private.festival_role(target uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.festivals f where f.id = target and f.owner_id = (select auth.uid()))
      then 'Owner'
    else (select m.role from public.festival_members m
          where m.festival_id = target and m.user_id = (select auth.uid()))
  end
$$;

create function private.festival_owner(target uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select f.owner_id from public.festivals f where f.id = target
$$;

revoke execute on function private.festival_role(uuid), private.festival_owner(uuid) from public, anon;
grant execute on function private.festival_role(uuid), private.festival_owner(uuid) to authenticated;

alter table public.festival_members enable row level security;

create policy "Members see who is on their festival"
  on public.festival_members for select
  to authenticated
  using (private.festival_role(festival_id) is not null);

create policy "Owners and admins add members"
  on public.festival_members for insert
  to authenticated
  with check (
    private.festival_role(festival_id) in ('Owner', 'Admin')
    and user_id <> private.festival_owner(festival_id)
  );

create policy "Owners and admins change roles"
  on public.festival_members for update
  to authenticated
  using (private.festival_role(festival_id) in ('Owner', 'Admin'))
  with check (private.festival_role(festival_id) in ('Owner', 'Admin'));

create policy "Owners and admins remove members"
  on public.festival_members for delete
  to authenticated
  using (private.festival_role(festival_id) in ('Owner', 'Admin'));

-- Only the role may be changed on an existing member (also enforced by a trigger, in case
-- broader table rights are ever granted).
grant select, insert, delete on public.festival_members to authenticated;
grant update (role) on public.festival_members to authenticated;

create function private.guard_member_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.festival_id is distinct from old.festival_id or new.user_id is distinct from old.user_id then
    raise exception 'Only the role of a team member can be changed.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function private.guard_member_update() from public, anon, authenticated;

create trigger guard_member_update
  before update on public.festival_members
  for each row execute function private.guard_member_update();

-- 3. Festivals: members may read, Owner/Admin/Editor may save ------------------------

drop policy "Owners read their festival" on public.festivals;
drop policy "Owners change their festival" on public.festivals;

-- The owner check comes first and looks at the row itself: while a festival is being
-- created, the helper cannot see the new row yet.
create policy "Owners and members read a festival"
  on public.festivals for select
  to authenticated
  using ((select auth.uid()) = owner_id or private.festival_role(id) is not null);

create policy "Owners, admins and editors save a festival"
  on public.festivals for update
  to authenticated
  using ((select auth.uid()) = owner_id or private.festival_role(id) in ('Admin', 'Editor'))
  with check ((select auth.uid()) = owner_id or private.festival_role(id) in ('Admin', 'Editor'));

-- Creating and deleting stay owner-only (policies from 001).

-- Nobody can hand a festival over to another account, and Editors cannot change the
-- finances (Kira's "budget" right is for Admins only).
create function private.guard_festival_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id or new.id is distinct from old.id then
    raise exception 'The owner of a festival cannot be changed.' using errcode = '42501';
  end if;
  if private.festival_role(old.id) = 'Editor'
     and (new.data -> 'festival-architect-finance') is distinct from (old.data -> 'festival-architect-finance') then
    raise exception 'Editors cannot change the finances.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function private.guard_festival_update() from public, anon, authenticated;

create trigger guard_festival_update
  before update on public.festivals
  for each row execute function private.guard_festival_update();

-- 4. Saving only the sections that changed --------------------------------------------
-- Two people can work at the same time: each save merges its sections into the plan
-- instead of replacing the whole plan. Runs with the caller's rights (SECURITY INVOKER),
-- so all rules above apply. Returns when the plan was saved, and when it had been saved
-- before — if that is not the version the browser had, a teammate saved in between.

create function public.save_festival_changes(festival uuid, changes jsonb, removed text[] default '{}')
returns table (saved_at timestamptz, previous_saved_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  before_save timestamptz;
begin
  if changes is null or jsonb_typeof(changes) <> 'object' then
    raise exception 'changes must be a JSON object' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_each(changes) c
             where c.key not like 'festival-%' or jsonb_typeof(c.value) <> 'string') then
    raise exception 'only festival-… sections with text values can be saved' using errcode = '22023';
  end if;

  select f.updated_at into before_save from public.festivals f where f.id = festival for update;
  if not found then
    raise exception 'This festival does not exist or your role cannot change it.' using errcode = '42501';
  end if;

  update public.festivals f
     set data = (f.data - coalesce(removed, '{}'::text[])) || changes
   where f.id = festival
  returning f.updated_at into saved_at;
  if saved_at is null then
    raise exception 'Your role cannot change this festival.' using errcode = '42501';
  end if;

  previous_saved_at := before_save;
  return next;
end;
$$;

revoke execute on function public.save_festival_changes(uuid, jsonb, text[]) from public, anon;
grant execute on function public.save_festival_changes(uuid, jsonb, text[]) to authenticated;

-- 5. Lists for the app ----------------------------------------------------------------

-- The festival's name, read from the lineup section; null if it cannot be read.
create function private.festival_name(plan jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  return nullif(trim((plan ->> 'festival-architect-v2')::jsonb -> 'event' ->> 'name'), '');
exception when others then
  return null;
end;
$$;

revoke execute on function private.festival_name(jsonb) from public, anon;
grant execute on function private.festival_name(jsonb) to authenticated;

-- Every festival the signed-in account may open: its own first, then shared ones.
create function public.my_festivals()
returns table (festival_id uuid, festival_name text, owner_id uuid, owner_username text, my_role text, updated_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select f.id, private.festival_name(f.data), f.owner_id, p.username, private.festival_role(f.id), f.updated_at
    from public.festivals f
    left join public.profiles p on p.id = f.owner_id
   order by (f.owner_id = (select auth.uid())) desc, f.updated_at desc
$$;

-- The team of one festival (without the owner), for the Overview's Team table.
create function public.festival_team(festival uuid)
returns table (user_id uuid, username text, role text)
language sql
stable
security invoker
set search_path = ''
as $$
  select m.user_id, p.username, m.role
    from public.festival_members m
    join public.profiles p on p.id = m.user_id
   where m.festival_id = festival
   order by m.added_at, p.username
$$;

revoke execute on function public.my_festivals(), public.festival_team(uuid) from public, anon;
grant execute on function public.my_festivals(), public.festival_team(uuid) to authenticated;
