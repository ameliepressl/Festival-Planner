-- 006 — Festival details and the overall artist budget are Admin-only in the database too
-- See feature-plans/admin-only-lineup-details.md. Run after 001–005.
--
-- The lineup section festival-architect-v2 holds three kinds of data:
--   * the festival details  -> "event"           (name, venue, dates, opening hours, custom hours)
--   * the artist budget     -> "settings.budget" (the overall budget for all artists)
--   * the planning itself   -> artists, bookings with their fees, stages, stage names, final, ...
-- The screens already let only the festival creator and Admins change the first two. Until now
-- the database still accepted them from an Editor who sends the request directly (browser
-- console, own script). This rule closes that gap: an Editor's save is refused when it changes
-- "event" or "settings.budget". Everything else Editors could do stays allowed — booking
-- artists and setting their fees, moving performances, adding stages, finalising.
--
-- Run once in Supabase → SQL Editor. Running it again is harmless.

-- 1. The Admin-only part of a saved plan -----------------------------------------------
-- Returns the festival details and the artist budget as the app reads them, so that two
-- saves are compared by what they mean, not by how the text happens to be written:
--   * a missing "event" or missing fields count as the app's defaults (normalizePlan in
--     rules/festival-rules.js), so storing those defaults is not a change;
--   * a missing "settings.budget" counts as 10000, the app's default;
--   * no lineup section at all → null; a lineup section the app cannot read → {"unreadable": true}.
-- Keep the defaults in step with DEFAULT_EVENT and normalizePlan in rules/festival-rules.js.

create or replace function private.lineup_admin_fields(plan jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  section jsonb := plan -> 'festival-architect-v2';
  lineup jsonb;
  unreadable constant jsonb := '{"unreadable": true}';
begin
  if section is null then
    return null;
  end if;
  if jsonb_typeof(section) <> 'string' then
    return unreadable;
  end if;
  lineup := (section #>> '{}')::jsonb;
  if jsonb_typeof(lineup) <> 'object'
     or (lineup ? 'event' and jsonb_typeof(lineup -> 'event') <> 'object')
     or (lineup ? 'settings' and jsonb_typeof(lineup -> 'settings') <> 'object') then
    return unreadable;
  end if;
  return jsonb_build_object(
    'event', '{"startDate": "2027-03-20", "endDate": "2027-03-21", "startMinutes": 840, "endMinutes": 1380}'::jsonb
             || coalesce(lineup -> 'event', '{}'::jsonb),
    'budget', case when coalesce(lineup -> 'settings', '{}'::jsonb) ? 'budget'
                   then lineup -> 'settings' -> 'budget' else '10000'::jsonb end
  );
exception when others then
  -- The text is not valid JSON.
  return unreadable;
end;
$$;

-- The save rule runs with the rights of the person saving, so signed-in accounts need to be
-- able to run it. The schema "private" is not reachable through the API.
revoke execute on function private.lineup_admin_fields(jsonb) from public, anon;
grant execute on function private.lineup_admin_fields(jsonb) to authenticated;

-- 2. The save rule, now with the lineup details ------------------------------------------
-- Same as in 004, plus the last check.

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
  if private.festival_role(old.id) = 'Editor'
     and private.lineup_admin_fields(new.data) is distinct from private.lineup_admin_fields(old.data) then
    raise exception 'Only the festival creator and Admins can change the festival details and the artist budget.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function private.guard_festival_update() from public, anon, authenticated;
