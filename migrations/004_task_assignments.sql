-- 004 — Only the festival creator and Admins hand out tasks (feature-plans/task-assignments.md).
--
-- The assignments are one section of the plan: festival-task-assignments-v1. Editors may still
-- change everything else they could before, including the task statuses
-- (festival-work-board-status-v1). The browser already leaves the assignments out of an
-- Editor's save (rules/account-rules.js → sectionsToSave); this rule makes sure the database
-- refuses it too, whatever a browser sends.
--
-- Run once in Supabase → SQL Editor, after 001–003. Running it again is harmless.

create or replace function private.guard_festival_update()
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
  if private.festival_role(old.id) = 'Editor'
     and (new.data -> 'festival-task-assignments-v1') is distinct from (old.data -> 'festival-task-assignments-v1') then
    raise exception 'Only the festival creator and Admins can assign tasks.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function private.guard_festival_update() from public, anon, authenticated;
