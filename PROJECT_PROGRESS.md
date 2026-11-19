# Festival Architect — collaboration log

Use this file together with GitHub branches and pull requests so the team can see what changed, who owns it, and whether it is ready to merge.

## Working agreement

1. Start every feature from the latest `main` branch.
2. Create one branch per small feature, for example `feature/site-map`.
3. One person owns the implementation; another collaborator reviews the pull request.
4. Keep each pull request focused and describe the user-visible change, files changed, and how it was tested.
5. Merge only after the team agrees that the preview works.

## Current progress

| Branch | Scope | Status | Reviewers | Date |
| --- | --- | --- | --- | --- |
| `homepage` | Overview opens first with festival details, projected finances, urgent tasks and local team roles. | Local review | — | 12 November 2026 |
| `codex/left-navigation` | Add a visual left navigation bar to the original lineup planner. No new feature pages yet. | Ready for team preview — not committed | Kira, Vicky, Fredderik | 28 October 2026 |

| `codex/festival-planner-edits` | Editable artist catalogue, planning settings and vertical multi-day lineup calendar for 15–16 October 2026. | Local preview — ready for review | — | 28 October 2026 |

## Team ownership

Agree an owner before starting each row. Update this table in the same pull request as the work.

| Area | Owner | Branch | Status | Notes |
| --- | --- | --- | --- | --- |
| Left navigation | Amelie | `codex/left-navigation` | In review | First small shared feature |
| Lineup planner | Unassigned | — | Existing baseline | Keep working while other features are added |
| Task board | Unassigned | — | Not started | Add only after navigation is approved |
| Site map | Unassigned | — | Not started | Add in its own feature branch |
| Food & vendors | Unassigned | — | Not started | Add in its own feature branch |

## Pull request checklist

- [ ] I worked only on my own feature branch.
- [ ] The app still loads and the existing lineup flow works.
- [ ] I described what changed and how I tested it.
- [ ] At least one teammate reviewed the pull request.
- [ ] The table above reflects the current status.

## Crew checklist — 6 November 2026

Branch: `feature-crew-checklist`. Revised all 56 checkpoints to describe event-day readiness and clarified the checklist instructions. Advance booking, ordering and scheduling belong in the future task board, which is not implemented here. Task IDs and saved ticks are preserved; users are asked to review earlier ticks against the revised checks. Status: local changes for review.

Renamed the navigation and page label to “Final checklist”. Validation: all 26 tests passed; browser tick/untick and reload persistence verified for the event-day wording.
## Lineup planner integration notes

- Event dates and daily opening hours live in the persisted `state.event` object in `app.js`. A future event settings page should update this object; no new page has been added here.
- Default event: 15–16 October 2026, 14:00–23:00 daily. Existing bookings without dates migrate to the first day.
- Required artists counts distinct artists across the event. Each daily booking incurs the artist's performance fee.
- Artist edits update existing bookings. Duration and price changes are rejected if they cause schedule conflicts, run past closing, or exceed the budget. Deleting an artist requires an in-app confirmation and removes their bookings.
- Reducing stages requires moving or removing affected bookings first. Final plans remain read-only until reopened.
- Validation: JavaScript syntax check; isolated logic checks for overlap, adjacent sets, independent dates, duplicate daily bookings, closing time, budget, editing existing bookings and fee propagation; browser inspection of the calendar and booking dialog.

### Planner layout refinement

Calendar precedes the unnumbered artist catalogue. Planning settings open in a save/cancel dialog. Summary order is artists, stages, then a combined total/used/remaining budget with usage bar. Removed the draft badge. Performance details appear in a small grey tooltip on hover or keyboard focus; Escape dismisses it.

### Final plan export and flexible budget

- Finalisation has no minimum artist requirement. Required artists remains a planning target.
- Final plans expose Print / Save PDF with both daily calendars, dated performance details (artist, genre, fee, duration, stage and times), counts and budget summary. Uses the browser/system print dialog and its Save as PDF destination.
- Added total performance count and individual dated bookings in each catalogue entry.
- Budget increases beyond the available amount require explicit in-app confirmation. This also applies to fee increases and budget reductions that increase the shortfall. Existing over-budget plans can still be edited without repeating the warning when overspend does not increase.
- Remaining budget becomes negative and red when overspent; the budget panel and usage bar show a warning colour.
- Slot conflicts list occupied ranges and the last conflicting end time.
- Verified JavaScript syntax, whitespace, isolated confirmation/validation/print-content checks and browser display. Native print preview could not be inspected through the in-app browser automation.

### Calendar blocks, notes and minute-level times

- Added grey, editable non-artist calendar blocks with title, day, stage, start, duration and optional notes. Blocks reserve stage time and participate in collision checks, but never count toward artist/performance totals or fees.
- Added optional editable notes to artist bookings. Both kinds of appointment show notes in tooltips and printable details.
- Start times use minute-precision time inputs, including times such as 15:11.
- Thin grey borders separate adjacent appointments.
- Removed the required-artist target from settings, summary and print export. Artist and performance counts share equal formatting, with a conditional repeat-booking note.
- Validation: syntax and whitespace checks; isolated checks for arbitrary-minute booking, block conflict end times, adjacent blocks, closing boundaries, cost/count exclusion and exported notes; browser verification of the summary and block control.

### Availability and visual alignment

- Matched planned/booked catalogue status font sizes. Aligned summary number baselines. Calendar appointments fill stage columns, retain their dark left edge, and use a single flat grid-coloured separator without shadows.
- Added Day & stage hours dialog: select a day, edit festival hours, and expand individual stages to override their hours. Stage overrides must fit within their day. Existing appointments must be moved before reducing availability around them.
- Shared calendar axis spans the earliest opening and latest closing across all days. Closed periods appear grey per stage, including in the print layout. Booking and block validation enforce availability.
- Future event page integration: `state.event.dayHours[date] = {start, end, stages: {A: {start, end}}}`; times are minutes after midnight. Missing overrides inherit the daily or existing default hours.
- Checked differing daily hours (14–23 and 12–22), late stage opening at 16:00, shared axis bounds, closed shading and booking boundaries, plus existing booking checks and browser layout.

### Compact summary and short appointments

Summary stays in a single horizontal row with performances, stages and budget; artist count and repeat-booking note removed from the overview. Short appointments hide the entire time line rather than clipping it; full times remain in the accessible label and hover details. Very small entries hide the title too. Confirmed Stage C’s 30-minute “xx” entry now shows its title without clipped times. Syntax, existing logic and whitespace checks passed.

## Integration with main — 3 November 2026

Merged lineup-planner-update-1 with main while preserving the crew checklist and its rules/tests. Current lineup business rules live in rules/festival-rules.js alongside the isolated legacy baseline exports. Existing tests remain unchanged; current-lineup integration tests cover the new behavior. User explicitly requested publishing the merge to main.

Validation: all 30 tests passed (26 original and 4 integration tests). Browser checks passed for lineup rendering, checklist navigation, booking dialog and reload; no console errors.

## Local loading repair — 11 November 2026

Branch: codex/fix-lineup-loading. Removed the incomplete legacy single-day prefix from app.js, leaving the current planner as the single screen implementation. Verified that minute-precision time parsing in rules/festival-rules.js works; no rule-file change was needed. Retained the visible Final checklist label while using the stable Checklist navigation identifier consistently in HTML and the checklist screen.

Checks: JavaScript syntax passes; all 32 tests pass (30 existing unchanged plus booking-save/reload and settings-save regressions). Browser checks: summary and eight artist cards render after reload, settings dialog opens, 15:11 start previews 16:11 end, and Final checklist navigation works. No commit or push authorised yet.

## One example artist — 11 November 2026

On codex/fix-lineup-loading, new plans now start with one editable Example Artist (€0, 60 minutes). The default is in rules/festival-rules.js; app.js loads existing saved catalogues first and keeps legacy artists for older booked plans that did not store their own catalogue.

Tests: all 35 passed, including new defaults, editing/adding and persistence, empty saved catalogues, and legacy booking preservation. Existing booking scenarios use explicit artist fixtures so their assertions stay independent of starter content. Browser: fresh preview at localhost:8001 shows one example after reload; Add and Edit dialogs open; no console errors. localhost:8000 data is preserved. No commit or push.

## Lineup workflow enhancements — 11 November 2026

On `codex/fix-lineup-loading`, clicking an empty slot prefills the day, stage and start time. The planner suggests the next fitting time on that stage, including any changeover. Performances now keep their own status, duration and fee, and linked changeovers follow their performance when it moves or is removed. Stage names can change without changing booked stage IDs. Separate sets by one artist are allowed; simultaneous sets are rejected.

Lineup backups use versioned JSON. Restore validates the file and previews the replacement before saving; checklist data stays separate. The internal print layout includes all appointments, fees and notes. The public layout includes only confirmed performances and omits fees, private notes and operational blocks.

Verification: all 52 tests passed, including backup download payload and restore, invalid imports, conflict and changeover checks, saved-plan migration, and public output privacy. Browser checks covered empty-slot booking, precise times, suggestions, confirmed and tentative sets, and renaming stages without moving bookings. The preview loaded after restart without console errors. Native download and Save as PDF dialogs were not independently verified. No commit or push.
## Task board placeholder — 6 November 2026

Branch: `feature-task-board-placeholder`. Static placeholder only for future project progress and urgent to-dos. No dashboard or task functionality implemented. Status: local preview.

## Lineup startup repair — 6 November 2026

Removed an incomplete legacy single-day script prepended to the current multi-day screen. It caused a syntax error before any artists, stage totals or timetable could render. No saved data reset.

Naming review: navigation, page heading and progress labels consistently identify the feature as “Final checklist”; internal IDs and saved progress unchanged.

## Preliminary Gantt chart — 6 November 2026

Added a Task board button opening an empty eight-week Gantt layout with task, owner and status columns. Back and sidebar navigation included. No task editing, bars or sample data.

Gantt structure: added 13 numbered main categories in distinct muted colours, with sticky labels for horizontal scrolling. No subtasks or scheduled bars.

Cleaning crew example: added workstream 7.1 and six numbered sequential steps (7.1.1–7.1.6), with nested indentation and the infrastructure colour. Timeline and assignments remain empty.

Gantt usability: compact rows and independent expand/collapse controls for categories and workstreams with children. Collapsing a parent preserves its nested group state.

Approved preparation breakdown transferred: 13 categories, 52 task groups, 209 subtasks. Compact outline with independently collapsible levels and expand/collapse-all controls. Task groups start collapsed. Scheduling and assignment remain blank.

Gantt overview refinement: removed Status, reduced category rows to roughly 27px and task/subtask rows to roughly 25px, and added independent week/day toggles. Days are relative (1–56) until real dates are assigned. Hierarchy state is preserved while changing timeline detail.

Proposed daily schedule: all 209 subtasks assigned sequential day ranges over 12 preparation weeks; parallel teams, opening-day final checks, and post-event wrap-up. Uses configured event dates and coloured aggregate bars, daily view by default, independent week toggles and All weeks/All days shortcuts. Dates are a draft template rather than validated supplier lead times.

Gantt scrolling: sticky week/date header in a vertically scrollable chart; task column reduced to 270px with ellipsis. Sideways scrolling reduces frozen task labels to muted 160px previews; full labels remain in hover text.

Sideways scrolling now shortens label previews only; font weight, text colours and category styling remain unchanged.

Session handover: confirmed the current Gantt task hierarchy and daily schedule load as the default template on app opening. Future scope: project users, roles and permissions controlling task and timeline editing. All current work remains local on feature-task-board-placeholder, uncommitted and unpushed. Known validation issue: one existing integration assertion still expects the former Checklist navigation name.

## Gantt controls and inline editing — 10 November 2026

10 November: redesigned Gantt controls into Outline (Areas/Tasks/Subtasks) and Timeline (Weeks/Days) selectors, with selected/custom states and consistent individual chevrons. Timeline switches preserve the visible date. Local changes on feature-task-board; no commit.

Head-of-project editing: browser-local plan model with stable IDs, custom subtask dates/names, add/remove and ordering controls. Explicit save/cancel, date validation, auto timeline extension and parent aggregation. No authentication/role enforcement implemented.

Inline edit mode replaces modal: names, date ranges, add/remove and reorder actions now appear in Gantt rows, with live bar updates and explicit Save/Cancel. Existing persisted plans retained.

Inline reordering now uses drag handles and insertion markers, replacing up/down buttons. Tasks retain subtasks when moved; subtasks retain dates. Keyboard arrows on handles remain available. No commit requested.

Compact edit rows: drag handle at far left, inline name and +/× actions on the same line. × removal keeps two-click confirmation and accessible labels.

Column refinement: Owner visible in overview and edit mode; Subtask dates is a separate edit-only column. Timeline rebuilds preserve the two permanent columns.

Timeline page description moved beside title on wide screens to reduce header height; stacks responsively.

Validation: updated the navigation test to match the approved Final checklist label, with explicit user approval. Full test suite rerun before commit.

## Timeline preview and festival countdown — logged 16 November 2026

Task board: live 13-area timeline preview replaces open button. Hover highlights; click or keyboard activation opens chart.

Festival countdown: upper-right calendar-day and Monday–Friday workday totals, anchored to configured event start and Europe/Lisbon date. Includes today, excludes opening day; holidays not deducted. Handles opening/ongoing/ended states.

Default festival now 30–31 December 2026. Empty October-default plans migrate; Gantt preparation dates follow the shifted anchor. Booked custom events are preserved.

## Timeline scrolling and Today marker — logged 16 November 2026

Added bottom clearance inside the Gantt scroll viewport so overlay horizontal scrollbars do not cover the final task row.

Fixed sideways-scroll gap: frozen task header now shrinks together with task labels, with divider at their actual boundary.

Timeline overview and preview show a Lisbon-local Today marker; preview columns carry compact project-week numbers.

## Task Board and status tracking — logged 16 November 2026

Added the Task board entry button below the timeline preview and a placeholder destination. Board implementation is deferred.

Built the task board with five status columns, Gantt-backed subtask cards, search and work-area filtering. Status changes save separately in this browser.

Task board uses Planned, In progress, Needs attention, Overdue and Done. Overdue follows Gantt dates automatically; older statuses have fallback mappings.

Removed Needs attention from the task board. The four columns are Planned, In progress, Overdue and Done.

Task card due dates now share a compact top row with the task number, aligned right.

Task board sorts active lanes by deadline and Done by recorded completion time, preserving older saved statuses.

## Task creation from the timeline and Task Board — logged 16 November 2026

Gantt edit mode supports adding numbered tasks directly to each area. Their saved subtasks use the existing Task board connection.

New Gantt tasks require a named first subtask with valid dates before saving.

Added Task board creation for dated subtasks under existing or new parent tasks, using the shared Gantt plan.

## Task creation form refinements — 16 November 2026

Added space between field labels and focus outlines. The new parent name field appears only when creating a parent task.

## Today marker during horizontal scrolling — 16 November 2026

Adjusted the Today marker so it stays behind the frozen Task column when the timeline scrolls sideways.

## Project tasks overview — 16 November 2026

Added a Task overview panel beneath Project timeline. It shows the total number of subtasks and the count and percentage for Planned, In progress, Overdue, and Done. Each status and the Open Task Board shortcut open the full board. The panel uses the Project timeline typography and orange hover frame, with a distinct colour for each status.

Renamed the sidebar entry and the label above the overview title to Project tasks.

## Needs attention — 16 November 2026

Replaced the urgent to-dos placeholder with unfinished subtasks that are overdue or due within seven calendar days, using Lisbon dates. Entries show the work area and deadline, with overdue items first. Selecting an entry opens the Task Board and focuses its card.

Verified after reloading the browser by opening Attend XYC Conference from the list and returning to Project tasks. All 35 automated tests passed.

## Upcoming tasks overview styling — 16 November 2026

Matched the heading to Task overview, reused the Gantt work-area colours in the list, and added a warning icon to overdue entries.

## Task deadline filters and grouping — 16 November 2026

Added a Due soon filter to the Task Board for unfinished subtasks due today through the following seven calendar days in Lisbon. Grouped the overview into Overdue, Due today, and Next 7 days, hiding empty groups. Unfinished cards and overview entries show relative deadlines alongside calendar dates.

## Section navigation after merging — 17 November 2026

Updated the navigation script URLs so browsers load the merged section-switching logic. This prevents the Project tasks overview or timeline from appearing below Site map, Vendors, or Finances.

## Login with Supabase accounts — 19 November 2026

Branch: `feature-login` (owner: Amelie). Plan: `feature-plans/login.md`.

- Sign-in screen first: create an account (username, email, password) or sign in. Inputs are checked in `rules/account-rules.js` before anything is sent; Supabase errors become clear messages.
- Each account has one festival plan in Supabase. The pages keep saving in the browser; `account/account.js` copies every `festival-…` key to the account a moment after each change. The sidebar shows who is signed in, the save status and Sign out. Signing out removes the plan from that browser.
- A plan from before accounts is not lost: the first sign-in asks whether to keep it or use the account's plan.
- Row Level Security (`migrations/001_accounts_and_festivals.sql`): an account can only read, create, change or delete its own festival; usernames are visible to signed-in users only and cannot be changed through the app.
- The Team form looks up usernames in Supabase. `server.py` and its SQLite Python tests are removed; the app is plain files again (deployable on GitHub Pages).
- Offline: the app keeps working in the browser, shows "Not saved yet" and saves when the connection is back.
- Supabase library pinned in `vendor/` (2.119.2, integrity hash; `npm audit`: 0 vulnerabilities). Only the publishable key is in the repository.

**Tests changed with the team's approval (Amelie, 19 November):** three team-roster tests in `tests/lineup-enhancements.test.js` used the Python server (`fetch('/api/users')`, numeric ids, "python3 server.py" hint). They now give the same cases to the Supabase lookup — found, duplicate, unknown username, directory unavailable, roster kept, editors cannot look up — with UUID account ids. No case was removed. `tests/test_user_directory.py` was removed together with `server.py`; the same rules (case-insensitive unique usernames, invalid input, unknown user) are now checked by `tests/account-rules.test.js` and the database constraints.

Validation: all 150 JavaScript tests pass (after merging #13–#16). Browser check in Chrome against a simulated Supabase: 35 checks (locking, sign-up/sign-in errors, saving, reload, demo festival, second device, sign-out privacy, offline, old plan choice, no console errors). Database rules checked in a real Postgres (PGlite) with Supabase's default grants: 22 checks, including that another account cannot read, change, delete or take over a festival.

Merging `main` (#13–#16) into `feature-login`: the CI workflow no longer runs Python tests (there are none left; Python 3.12's `unittest` would fail with "no tests ran"). The README's quick start, tests, structure and privacy sections now describe the account setup instead of `server.py`. The demo festival button works with accounts: its data is saved to the account after the reload.

Supabase project `Festival-Architect` (eu-west-1): migrations 001 and 002 applied on 19 November through the Supabase connector, with Amelie's approval. 002 removes API access to `rls_auto_enable()`, a helper Supabase adds for "Enable RLS on new tables automatically", which its security check flagged. 001 also removes API access to the two trigger functions. Afterwards: both tables have RLS on (1 and 4 policies), signed-out visitors have no table access, and Supabase's security and performance checks report no issues.

## Shared festivals — 19 November 2026

Branch: `feature-shared-festivals` (owner: Amelie), on top of the merged login (#17). Plan: `feature-plans/shared-festivals.md`.

- Kira's Team form on the Overview now invites real accounts: adding, changing the role of or removing a teammate changes `festival_members` in Supabase. The roster in the browser is filled from the database and is no longer saved inside the plan.
- Roles as defined in `rules/access-rules.js`: Admin (everything), Editor (lineup, checklist, tasks, site map, vendors — not details, budget, finances or team), Viewer (look only). `rules/access-rules.js` now takes the signed-in account's role from `account/account.js`; without accounts (tests) it behaves exactly as before.
- Enforced in the database (`migrations/003_shared_festivals.sql`): members can read; Owner/Admin/Editor can save; Editors cannot change the finances; only Owner/Admin manage the team; the owner cannot be added as a member; nobody can take a festival over; only a member's role can be changed.
- Saving sends only the changed sections through `save_festival_changes()`, which merges them, so two people working at the same time keep both changes. A bar tells you when a teammate saved (also checked every 20 seconds) and offers Reload. Viewers see "View only".
- Festival switcher in the sidebar when an account can open more than one festival. A removed teammate is told and goes back to their own festival.
- Removed the hard-coded "COLLABORATORS" box (K · A · F · V) from the sidebar and its styles; the real team is on the Overview. Footer now says the plan saves to the account.

Changed in my own new tests from #17 (not team tests): `tests/account-rules.test.js` expects the extended sync information (festival, unsaved sections, role). No existing team test changed.

Validation: all JavaScript tests pass. Browser check in Chrome against a simulated Supabase: 24 sharing checks (invite, switcher, Editor rights, finances blocked, teammate bar, merge of simultaneous saves, Viewer, removal, no console errors) plus the 35 login checks. Database rules in a real Postgres (PGlite), with and without Supabase's default grants: 34 checks.

Supabase: migration 003 applied on 19 November through the connector, with Amelie's approval. All three tables have RLS on (festivals 4, festival_members 4, profiles 1 policies); signed-out visitors have no table access. Supabase's security check now only notes that "leaked password protection" is off — that feature needs the paid Pro plan. The performance check only notes that the two new indexes have not been used yet (there are no teams yet).
