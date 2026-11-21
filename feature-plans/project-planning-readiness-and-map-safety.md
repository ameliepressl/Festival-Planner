# Fresh projects, editable tasks and deliberate map changes

Owner: Kira · Branch: `codex/project-planning-readiness-and-map-safety` · Approved: 21 November 2026

Status: implemented; 197 automated tests pass and isolated browser flows pass.
Commit and branch publication approved by Kira on 21 November 2026. Team review
and merge are pending. See PROJECT_PROGRESS.md for verification.

## Why

New festivals must not inherit old dates or completed work. Organisers need to remove
irrelevant suggested tasks, understand task groups, and experiment with the site map
without immediately replacing the saved layout. Problems across the pages should be
visible together and actionable.

## What

- Start a genuinely new festival's date picker at today's Lisbon calendar date;
  preserve the chosen dates of existing and imported festivals.
- Initialise a fresh, editable task schedule relative to festival opening and closing.
  Suggest preparation roughly 100–1 days before opening, compressing the template when
  planning starts late. Persist the planning start so reloads do not move deadlines.
  Keep existing schedules, progress and assignments when reopening an existing plan.
- Allow deletion of suggested and custom tasks, with confirmation and consistent
  board/timeline counts. Keep the task-group field and clarify work area → task group.
- Keep site-map edits as an in-memory draft. Add Save changes, Undo change and Discard
  changes, including visitor counts and map settings. Protect navigation/reload from
  silently losing drafts; view-only changes do not count as edits.
- Add an Overview readiness percentage with an explicit breakdown of applicable
  setup, lineup, map and finance checks. Each failing check appears once as a linked
  task; source checks, not task checkmarks, determine whether problems are resolved.
- Add per-map audience density and evacuation planning estimates using entered
  usable audience areas, crowd numbers, clear exit widths and visible assumptions.
  Unreachable routes are reported rather than replaced with straight-line estimates.

## Storage and permissions

Use separate existing `festival-` keys where possible, so account synchronisation
continues to send changed sections. New setup metadata also uses that prefix. Map
drafts stay in memory until Save changes. Safety inputs belong to each saved map.
Database access remains enforced by existing Supabase policies; Viewer cannot edit
and Editor cannot change protected assignment or finance keys. No SQL migration,
live database deletion or merge is included in this work. Commit and branch
publication were subsequently approved; a teammate must review before merging.

## Calculation references

- HSE, venue and site design:
  https://www.hse.gov.uk/event-safety/venue-site-design.htm
- Home Office, Fire safety risk assessment: open-air events and venues:
  https://www.gov.uk/government/publications/fire-safety-risk-assessment-open-air-events-and-venues
- SGSA, Vehicle Security Barriers at Event Venues, flow-rate discussion:
  https://sgsa.org.uk/wp-content/uploads/2025/09/Vehicle-Security-Barriers-at-Event-Venues.pdf

These inform visible, editable planning assumptions. Results are estimates, not a
determination of legal capacity or a professional evacuation assessment. Missing
measurements never produce a passing safety result.

## Out of scope

2FA, account-system replacement, real-time editing of the same saved section,
certified crowd simulation, legal approval of a venue, and changing existing booking
rules or deleting existing festival data.

## Done when

- Fresh dates, near/far-future schedules and clean progress work without changing
  existing projects; saved changes survive reload.
- Task groups can be selected/created and tasks can be deleted/cancelled in both views.
- Map changes remain unsaved until requested; undo/discard, navigation, permissions
  and storage errors behave honestly.
- Density and exit estimates reject invalid/missing inputs and blocked routes.
- Readiness and issue tasks agree, update after saved source changes and do not duplicate.
- Existing tests plus meaningful regression scenarios pass without weakening tests.
- Changed flows are checked in a browser through a local server, including reloads;
  remaining limits and final test output are recorded in PROJECT_PROGRESS.md.
