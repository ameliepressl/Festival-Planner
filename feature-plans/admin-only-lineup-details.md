# Admin-only festival details and artist budget, enforced by the database

Owner: Amelie · Branch: `feature-admin-only-lineup-details`

## Why

The technical audit found a gap. The screens only let the festival creator and Admins change
the festival details and the overall artist budget, but both live inside the lineup section
`festival-architect-v2`, which Editors are allowed to save. An Editor who sends a request
directly (browser console, own script) could therefore still change them. Hiding buttons is
not enough (AGENTS.md).

## What

- [x] **Database rule** (`migrations/006_admin_only_lineup_details.sql`): an Editor's save is
      refused when it changes `event` (name, venue, dates, opening hours, custom hours) or
      `settings.budget`. Owner and Admins can still change both.
- [x] **Editors keep their planning rights:** artists, bookings and their fees, moving
      performances, stages and stage names, finalising and reopening.
- [x] **Compared by meaning, not text:** a missing `event` field or budget counts as the app's
      default (`DEFAULT_EVENT`, budget 10000), so saving the defaults the screen already shows
      is not a change. Writing an unreadable lineup or removing the section counts as a change.
- [x] **No refused saves from the planner:** for Editors, `app.js` no longer runs the
      one-time opening-hours and demo-date migrations (they change `event`; the creator or an
      Admin applies them), and an Editor cannot create the lineup before the festival details
      exist ("The festival creator or an Admin needs to set up the festival details first.").
- [x] Tests: `tests/admin-only-lineup-details.test.js`.

## Out of scope

Live editing, a different message for a refused save (it still says the role changed), and
changing what Editors may do in other sections.

## Done when

- The tests pass.
- 006 has been run in the Supabase SQL Editor (Amelie) and the security advisor reports
  nothing new.
- Checked with two accounts: as Editor, a booking saves; changing the budget through a direct
  request is refused; as Admin, changing the details and the budget still saves.
