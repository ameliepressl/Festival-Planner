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

Branch: `feature-task-board` (owner: Vicky). Related plan: `feature-plans/task-board-entry.md`.

Task board: live 13-area timeline preview replaces open button. Hover highlights; click or keyboard activation opens chart.

Festival countdown: upper-right calendar-day and Monday–Friday workday totals, anchored to configured event start and Europe/Lisbon date. Includes today, excludes opening day; holidays not deducted. Handles opening/ongoing/ended states.

Default festival now 30–31 December 2026. Empty October-default plans migrate; Gantt preparation dates follow the shifted anchor. Booked custom events are preserved.

Validation: the 35-test JavaScript suite passed during this work. Browser checks were recorded for individual flows; this entry does not establish complete end-to-end coverage.

## Timeline scrolling and Today marker — logged 16 November 2026

Branch: `feature-task-board` (owner: Vicky). Related plan: `feature-plans/task-board-entry.md`.

Added bottom clearance inside the Gantt scroll viewport so overlay horizontal scrollbars do not cover the final task row.

Fixed sideways-scroll gap: frozen task header now shrinks together with task labels, with divider at their actual boundary.

Timeline overview and preview show a Lisbon-local Today marker; preview columns carry compact project-week numbers.

Validation: the 35-test JavaScript suite passed during this work. Browser checks were recorded for individual flows; this entry does not establish complete end-to-end coverage.

## Task Board and status tracking — logged 16 November 2026

Branch: `feature-task-board` (owner: Vicky). Related plan: `feature-plans/task-board-entry.md`.

Added the Task board entry button below the timeline preview and a placeholder destination. Board implementation is deferred.

Built the task board with five status columns, Gantt-backed subtask cards, search and work-area filtering. Status changes save separately in this browser.

Task board uses Planned, In progress, Needs attention, Overdue and Done. Overdue follows Gantt dates automatically; older statuses have fallback mappings.

Removed Needs attention from the task board. The four columns are Planned, In progress, Overdue and Done.

Task card due dates now share a compact top row with the task number, aligned right.

Task board sorts active lanes by deadline and Done by recorded completion time, preserving older saved statuses.

Validation: the 35-test JavaScript suite passed during this work. Browser checks were recorded for individual flows; this entry does not establish complete end-to-end coverage.

## Task creation from the timeline and Task Board — logged 16 November 2026

Branch: `feature-task-board` (owner: Vicky). Related plan: `feature-plans/task-board-entry.md`.

Gantt edit mode supports adding numbered tasks directly to each area. Their saved subtasks use the existing Task board connection.

New Gantt tasks require a named first subtask with valid dates before saving.

Added Task board creation for dated subtasks under existing or new parent tasks, using the shared Gantt plan.

Validation: the 35-test JavaScript suite passed during this work. Browser checks were recorded for individual flows; this entry does not establish complete end-to-end coverage.

## Task creation form refinements — 16 November 2026

Branch: `feature-task-board` (owner: Vicky). Related plan: `feature-plans/task-board-entry.md`.

Added space between field labels and focus outlines. The new parent name field appears only when creating a parent task.

Validation: the 35-test JavaScript suite passed during this work. Browser checks were recorded for individual flows; this entry does not establish complete end-to-end coverage.

## Today marker during horizontal scrolling — 16 November 2026

Branch: `feature-task-board` (owner: Vicky). Related plan: `feature-plans/task-board-entry.md`.

Adjusted the Today marker so it stays behind the frozen Task column when the timeline scrolls sideways.

Validation: the 35-test JavaScript suite passed during this work. Browser checks were recorded for individual flows; this entry does not establish complete end-to-end coverage.

## Project tasks overview — 16 November 2026

Branch: `feature-task-board` (owner: Vicky). Related plan: `feature-plans/task-board-entry.md`.

Added a Task overview panel beneath Project timeline. It shows the total number of subtasks and the count and percentage for Planned, In progress, Overdue, and Done. Each status and the Open Task Board shortcut open the full board. The panel uses the Project timeline typography and orange hover frame, with a distinct colour for each status.

Renamed the sidebar entry and the label above the overview title to Project tasks.

Validation: the 35-test JavaScript suite passed during this work. Browser checks were recorded for individual flows; this entry does not establish complete end-to-end coverage.

## Needs attention — 16 November 2026

Branch: `feature-task-board` (owner: Vicky). Related plan: `feature-plans/needs-attention.md`.

Replaced the urgent to-dos placeholder with unfinished subtasks that are overdue or due within seven calendar days, using Lisbon dates. Entries show the work area and deadline, with overdue items first. Selecting an entry opens the Task Board and focuses its card.

Verified after reloading the browser by opening Attend XYC Conference from the list and returning to Project tasks. All 35 automated tests passed.

Validation: the 35-test JavaScript suite passed during this work. Browser checks were recorded for individual flows; this entry does not establish complete end-to-end coverage.

## Upcoming tasks overview styling — 16 November 2026

Branch: `feature-task-board` (owner: Vicky). Related plan: `feature-plans/needs-attention.md`.

Matched the heading to Task overview, reused the Gantt work-area colours in the list, and added a warning icon to overdue entries.

Validation: the 35-test JavaScript suite passed during this work. Browser checks were recorded for individual flows; this entry does not establish complete end-to-end coverage.

## Task deadline filters and grouping — 16 November 2026

Branch: `feature-task-board` (owner: Vicky). Related plan: `feature-plans/needs-attention.md`.

Added a Due soon filter to the Task Board for unfinished subtasks due today through the following seven calendar days in Lisbon. Grouped the overview into Overdue, Due today, and Next 7 days, hiding empty groups. Unfinished cards and overview entries show relative deadlines alongside calendar dates.

Validation: the 35-test JavaScript suite passed during this work. Browser checks were recorded for individual flows; this entry does not establish complete end-to-end coverage.

## Section navigation after merging — 17 November 2026

Branch: `main` (owner: Vicky; direct bug-fix commit requested by the user).

Updated the navigation script URLs so browsers load the merged section-switching logic. This prevents the Project tasks overview or timeline from appearing below Site map, Vendors, or Finances.

Validation: all 80 JavaScript tests passed. Chrome checks confirmed Site map, Vendors and Finances each displayed on their own.

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

## Overview design — 19 November 2026

Branch: `feature-overview-design` (owner: Amelie). Plan: `feature-plans/overview-design.md`.

The Overview now has the same width, left-aligned header, tile row and square cards as the other sections (it was 880 px and centred). Headline: festival name plus an orange countdown line. "Edit festival details" is a visible button instead of the "⋯" menu. New tile "Project tasks done" (from the Task board, via `window.getOverviewTaskProgress` in `work-board.js`). "Tasks needing attention" and "Finances" sit side by side; one column on narrow screens. All element IDs stay the same, so no test changed.

Validation: all JavaScript tests pass; screenshots at 1440, 1100 and 390 px; login (35) and sharing (24) browser checks pass.

## Task assignments and team progress — 19 November 2026

Branch: `feature-task-assignments` (owner: Amelie). Plan: `feature-plans/task-assignments.md`.

Owner and Admins give each task group to a person in the Gantt's Owner column and can give single subtasks to someone else (or nobody) on the Task board. The board has an "Assigned to" filter (everyone, my tasks, nobody, one person), every card shows its person, and Done cards say who finished them. The Overview's new Team progress card shows per person: assigned, done in %, overdue and the next deadline, plus how many subtasks have nobody; a click opens the board filtered to that person. Saved as `festival-task-assignments-v1`; rules in `rules/task-rules.js`. Editors still change statuses but cannot assign: the browser does not send it and `migrations/004_task_assignments.sql` makes the database refuse it.

Migration 004 applied in Supabase on 19 November 2026 (with Amelie's OK); the security advisor reports nothing new.

Validation: all JavaScript tests pass (10 new task tests, 1 new account test). Migration 004 tested in PGlite (42 database checks, also with Supabase's default grants). Browser check with two accounts (26 checks): assigning in the Gantt and on the board, filters, an Editor finishing a task, an Editor's assignment change not being sent, Team progress numbers, a teammate leaving.

## Interface cleanup and Settings — 20 November 2026

Branch: `interface-cleanup` (owner: Vicky). Plan: `feature-plans/interface-cleanup.md`. Merged through pull request #22.

The planning pages share compact spacing, left-aligned titles, Fraunces headings and DM Sans controls through `compact.css`. Removed the decorative Lineup graphic and shortened feature titles. Removed Team progress and the Final checklist percentage card from Overview. Settings sits above Sign out and contains festival details and team management. The details edit button is aligned right; saving refreshes the summary immediately. Creator/Admin edit restrictions and finalised-plan checks remain in place. Other roles see View team. The Overview urgent list shows up to five subtasks.

Validation: all 168 JavaScript tests passed during implementation. Chrome checks covered page navigation, matching Lineup/Project tasks title positions, Settings editing, team disclosure controls and the booking dialog. Separate manual sessions for each user role were not run.

## Lineup planner layout and timetable views — 20 November 2026

Branch: `interface-cleanup` (owner: Vicky). Plan: `feature-plans/interface-cleanup.md`.

Festival venue, dates and hours appear above the performance, stage and artist booking budget statistics. Edit stage planning settings sits beside those facts. The timetable has a compact toolbar with Book artist, Add calendar block, Download backup and Restore backup, including backup icons. Removed the stage-name plus buttons and the repeated opening-hours label. Festival view shows all days side by side; Daily view shows one day with day navigation. The time axis uses 45 pixels per hour and scales appointments and closed periods proportionally. Artist catalogue remains below the timetable.

Validation: all 168 JavaScript tests passed. Chrome checks covered both timetable views, the primary booking action, toolbar alignment and backup placement. No backup was restored during this layout review.

## Festival layout and map settings — 20 November 2026

Branch: `interface-cleanup` (owner: Vicky). Plan: `feature-plans/interface-cleanup.md`.

Festival size is a collapsible panel at the top with a visitor input and five aligned facility totals. Festival layout names the map section. The map tools, Suggest optimal layout and Map settings share a toolbar; category filters have matching control sizes. Pin details align with the map canvas and Layout check sits below the map. Map settings opens a dialog containing map selection, upload, name, real width and map actions. Feedback is shown inside the dialog, including upload guidance, water detection progress/errors, clearing no-go areas and changing the ground boundary. Opening settings preserves the map's document position. Earlier inline settings placements were replaced by this dialog.

Validation: all 168 JavaScript tests passed. Chrome checks covered Festival size collapse/expand, settings open/close, control alignment, matching map/details positions and stable map position through dialog use. Destructive map actions were not exercised on the saved map.

## Unified Project tasks workspace — 20 November 2026

Branch: `feature-project-task-improvement` (owner: Vicky). Related plans: `feature-plans/task-board-entry.md` and `feature-plans/task-assignments.md`.

Project tasks opens directly on the Task Board. A shared header, compact status strip and Task Board/Timeline switch replace the intermediate dashboard. The switch sits below the statistics and close to the content. Status totals filter the board; All tasks clears that status filter. My tasks is beside the assignment filter, with work-area, search and Due soon controls retained. Statistics remain project-wide after the requested reversal of personalised totals. Removed the visible timeline preview and repeated urgent list, while Overview links still open and focus the matching task card. Card status dropdowns are slimmer. Timeline Outline, week/day controls and Edit plan share one row; Edit plan stays right-aligned.

Validation: all 168 JavaScript tests passed. Chrome checks covered direct board entry, filtering 62 overdue cards, All tasks, My tasks, view switching and opening Agree concept and audience from Overview. The temporary scoped-statistics implementation was reverted.

## Timeline editing and subtask owners — 20 November 2026

Branch: `feature-project-task-improvement` (owner: Vicky). Related plan: `feature-plans/task-assignments.md`.

Only the selected row exposes name, date and add/remove controls in edit mode. Save changes, Cancel and the unsaved-change indicator share the sticky toolbar. Subtask bars support moving and resizing against the visible day/week columns; date fields remain available. Confirmation is outside the toolbar flow so Save/Cancel keep their positions, and appears only when a completed drag changes dates. Add task group is labelled; Add subtask uses a compact plus with tooltip and accessible label. New rows are selected with the name field focused. Owner assignment is available only on subtask rows in Timeline edit mode for authorised roles. Task Board and view mode display owner text. Owner drafts follow Save/Cancel, with effective legacy group assignments carried into subtask drafts.

Validation: all 168 JavaScript tests passed. Chrome checks covered selected-row fields, unsaved-change detection, cancelling a temporary name edit, resize-handle rendering, new-subtask focus and subtask-only owner controls. Save/Cancel positions were compared before and after an edit. Full drag/resize and persisted owner changes still need a dedicated end-to-end check.

## March 2027 demo dates and booking regression test — 20 November 2026

Branch: `feature-project-task-improvement` (owner: Vicky). Related plan: `feature-plans/ci-and-demo-festival.md`.

Default and demo festival dates are 20–21 March 2027. Existing Lisbon Sound Festival plans using 30–31 December 2026 shift their bookings and per-day hours forward by 80 days. The existing Gantt date-anchor logic moves the task schedule with the festival. With user approval, updated the minute-level booking regression test to use configured event dates, preserving its overlap, adjacent-booking and separate-day assertions.

Validation: the first run passed 167 of 168 tests because the booking test still used December dates. After the authorised fixture update, all 168 tests passed. Chrome showed 20–21 March 2027 and shifted task dates, including the first preparation subtask beginning 26 December 2026.

## Fresh projects, tasks, map drafts and readiness — 21 November 2026

Owner: Kira. Branch: `codex/project-planning-readiness-and-map-safety`
(initially `bug-fixes`), based on latest `main` (`5ab8315`).
Plan: [feature-plans/project-planning-readiness-and-map-safety.md](feature-plans/project-planning-readiness-and-map-safety.md).
Status: implemented; commit and branch publication approved by Kira on
21 November 2026. **Team review and merge are pending.**

### What changed and where

- Fresh festivals open their native date picker at today's Lisbon calendar date.
  Normal initial duration remains two days; saved/imported festival dates stay intact.
  `rules/festival-rules.js`, `overview.js` and `rules/project-rules.js` implement this.
- New task schedules use the existing suggested task order over a 100-day preparation
  window before the selected opening date. Short planning windows compress the
  suggestions into the time available. Wrap-up starts after the final festival day.
  The planning start is persisted, so reloading does not slide deadlines forward.
  Starting with an explicitly empty account clears old dates, progress and owners;
  importing an existing festival preserves them.
- Board and Timeline support named, confirmed deletion of suggested/custom tasks
  and task groups; removing a group's last subtask removes the empty group. Cancel
  retains the original. Counts and Overview update. The task-group field is retained:
  choose a work area, then an existing group or Create a task group. Changes live in
  `gantt-editor.js`, `work-board.js` and the project rules.
- The map now has Save changes, Undo change and Discard changes. Pin moves, strokes,
  visitor counts, settings and active-map selection remain drafts in memory until
  explicitly saved. Pan/zoom/filtering are view-only. Navigation/reload protects
  pending drafts. Failed multi-key saves restore prior values and retain the draft.
  `site-map/site-map-page.js` uses `rules/map-draft-rules.js` for this behaviour.
- A compact map section accepts usable audience areas, expected crowds and clear
  exit widths. `rules/crowd-rules.js` calculates density and an evacuation estimate
  using visible editable assumptions. Missing measurements, blocked routes and
  unavailable exits fail the appropriate planning checks. Routes never become a
  straight line when no walkable route exists. Both mapped emergency exits must be
  available for the readiness availability check, even when testing a one-exit
  scenario still gives an estimate.
- `readiness.js` and `rules/readiness-rules.js` show one Overview percentage with an
  explicit equal-weight check breakdown. Each failed source check appears once as a
  linked task on the task board. Fixing the source resolves it. Project-task completion
  does not falsely clear a planning issue. Readiness reads saved map data only; an
  unsaved suggested map is unassessed. UI styling is in `readiness.css`.

### Saved data and access

Existing separate keys remain in use: `festival-architect-v2`,
`festival-gantt-project-v1`, the Gantt date anchors,
`festival-work-board-status-v1`, `festival-task-assignments-v1`,
`festival-architect-site-maps`, `festival-architect-ground` and
`festival-architect-site-map-selected`. New `festival-project-setup-v1` stores the
planning start/template version. Optional crowd inputs belong to each map's
`crowdSafety` object. All saved keys use the `festival-` prefix and therefore enter
the existing account sync; unsaved map drafts do not. No database migration or live
database changes were made.

Viewers cannot edit. Editors can delete tasks but do not write the protected owner
assignments section; Admins clean deleted owners. Existing database access rules
remain in force. Account switching and sign-out check for pending map drafts first.

### Verification

No existing tests were changed or weakened. Added project, readiness, map-draft and
crowd regression tests. Ran the full Node test runner:

```text
tests 197
suites 0
pass 197
fail 0
cancelled 0
skipped 0
todo 0
```

`git diff --check` and changed JavaScript syntax checks pass. Browser checks used a
real local Python file server on port 8005 and separate Chromium contexts with
account requests mocked: no real account/festival was changed. Verified April 2027
initial dates, a year-ahead clean schedule, stable reloads, task-group creation,
suggested/custom/group deletion and cancellation, Timeline Save/Cancel, setup save
failure and retry, Admin/Editor/Viewer permissions, whole-drag Undo, saved-only
readiness, crowd inputs, Save/reload, cancelled navigation, retained drafts on active
map clicks, Discard, failed map saving and linked-task deduplication. No browser page
errors. Inspected Overview and map screenshots. Opened the real account-enabled
preview at `http://localhost:8005/?branch=bug-fixes` (sign-in required).

### Limits for review and the demonstration

The readiness percentage measures the displayed checks, not overall production
completion or safety approval. Crowd/evacuation numbers are planning estimates for
the map's existing two stage zones and two exits. Audiences use their nearest
reachable exit; remaining visitors start at the food-court centre. Shared-route
bottlenecks, crowd behaviour, accessibility needs and detailed simulation are not
modelled. Assumptions and primary references are visible in the panel and feature
plan. A real evacuation/risk assessment is still separate work.

Live multi-account sync was not exercised in this local change; the unchanged
Supabase policies and prefix-based sync remain responsible for cloud access/saving.
Before a PR, one teammate should review the branch and try it with a disposable
shared festival. Kira has approved committing and publishing this feature branch;
merging into `main` still requires the team's review.

## Task editing, map controls and button audit — 21 November 2026

Owner: Kira. Same branch: `codex/project-planning-readiness-and-map-safety`.
The original feature is published as commit `983c568` / draft PR #24. This
follow-up is ready for publication, authorised by Kira on 21 November 2026.
Its scope follows Kira's requests to continue, fix all six audited issues,
centre the ring and keep the entrance lanes.

- `work-board.js`, `gantt-editor.js`, `rules/project-rules.js` and the task dialog
  in `index.html` now provide Edit task instead of a direct Delete shortcut. The
  dialog retains existing area, group, name and dates; editing offers Save changes,
  Cancel and Delete task. New task creation retains Create task and no Delete.
  Renaming, rescheduling and regrouping preserve task identity, progress and
  completion history. Admins preserve inherited ownership when moving groups;
  Editors cannot silently change ownership through regrouping.
- `site-map/site-map-page.js` and CSS put map zoom/reset controls in a positioned
  viewport below the instruction bar, clear of Done/Cancel. Pending fences remain
  visible/resumable across tools. Their corners join one-step Undo but are never
  stored in the saved map. Done/Cancel remain available until the fence is resolved.
  Invalid map widths restore the last valid value with an explanation. Cancelling
  a map switch restores the actual selected map and avoids false success feedback.
- The selected-pin pulse now uses its own bounds as the animation origin
  (`transform-box: fill-box`), so it no longer travels across the map. The red
  entrance lanes are intentional drawing details and were left unchanged.
- Viewer vendor Confirm/Remove controls are disabled and mutation handlers enforce
  the role, including automatic pitch fitting. Load demo requires full Admin
  restore permissions before opening and applying. Sign out is ignored by the
  generic section-navigation handler and no longer displays an undefined-page toast.

Saved data continues to use the existing festival keys and database policies. No
SQL migration, account changes or real festival data edits were made for testing.

Validation: 17 additional regression scenarios (8 project editing, 3 map draft,
6 behavioural button-permission tests); existing assertions were not weakened.
Full output:

```text
tests 214
suites 0
pass 214
fail 0
cancelled 0
skipped 0
todo 0
```

`git diff --check` passes. Browser checks used a disposable local origin on port
8006 with mocked accounts/cloud access. Verified prefilled fields, Cancel, Save,
invalid date rejection, regrouping with a stable task id and In progress status,
reload persistence, cancelled and confirmed deletion, and unchanged creation flow.
Confirmed zero zoom/Done/Cancel intersection at 1440, 768 and 390px; fence drafts
survive tool changes and Cancel clears them. Checked invalid map width feedback,
cancelled map selection, correct pulse bounds, enabled Editor vendor actions,
disabled Viewer edits, disabled non-Admin demo replacement and Sign out navigation.
App confirmation choices were mocked in the disposable fixture because this
browser-control backend could not handle its native confirmation popup; no product
confirmation logic was bypassed in the real app. Viewer/Editor rights also have
direct behavioural tests. Live multi-account cloud saving remains a separate team
check. The real preview runs on port 8005; existing unsaved user drafts were not
reloaded or discarded.

## Evacuation stage-to-exit explanation — 21 November 2026

Approved by Kira; included in the authorised follow-up publication on the same
feature branch. The existing evacuation
calculation now exposes its chosen origin-to-exit assignments as derived output.
The map shows an 11px grey "Estimated routes" line under the existing exit/time
breakdown. Each stage identifies the exit actually used; zero-audience stages say
"no audience", and remaining visitors appear when applicable. Incomplete or
unreachable estimates do not show partial/stale routing. No formula or saved data
changed. Source: `rules/crowd-rules.js`, `site-map/site-map-page.js`; script versions
in `index.html` ensure the matching calculation and display are loaded together.

Four added regression tests cover stage assignments and exit totals, closed-exit
rerouting, zero audience and invalid/unreachable cases. Full suite: **218 passed,
0 failed, 0 skipped**; `git diff --check` passes. Browser verification on the real
read-only preview confirmed the exact assignments, grey 11px styling and correct
display after a reload. No saved festival inputs were edited during this check.
The preview remains open at `http://localhost:8005/?preview=stage-exit-summary`.
Kira approved committing and pushing all these follow-ups on 21 November 2026.
The cancelled request to move the evacuation section below the map is not included.

## Follow-up branch publication — 21 November 2026

Kira requested a commit and push to the existing
`codex/project-planning-readiness-and-map-safety` branch, explicitly excluding
`main`. Publication includes task editing, the six approved button fixes, map
control separation, the centred selection ring and the evacuation route labels.
No section-position change is included. The GitHub branch was checked before
publication and matches the original feature commit; draft PR #24 is open and
unmerged. All 218 tests pass, none fail or are skipped, `git diff --check` passes,
and the reviewed files contain no secret literals. The draft PR receives the new
commit and updated validation notes; team review is still required before merging.

## Several festivals per account — 21 November 2026

Branch: `feature-multiple-festivals` (owner: Amelie). Plan: `feature-plans/several-festivals.md`.
An account can now own up to 20 festivals. The sidebar always shows the FESTIVAL list with
"＋ New festival"; "Load demo festival" opens Lisbon or Munich as a new festival instead of
overwriting the open one, so you can switch back to your own festival at any time. Settings →
This festival → "Delete this festival" removes a festival you created (not your last one).
Database change: `migrations/005_several_festivals.sql` — **must be run once in the Supabase SQL
Editor before or right after merging**; until then "New festival" and the demo show a message
asking for it. Tested: 9 new tests (no existing test changed), migrations 001–005 in a local
Postgres, and the whole flow in Chrome against a stand-in for Supabase. Status: PR open, needs a
team review and a check with the real Supabase after running 005.

## Design polish — 21 November 2026

Branch: `feature-design-polish` (owner: Amelie, builds on PR #29). Plan: `feature-plans/design-polish.md`.
The app looked "AI-made". It keeps the cream paper and coral, but now has one system (`design.css`,
loaded last): Archivo Narrow for headings and big figures, Archivo for text (no serif, no
typewriter font); one button style (coral with dark text for the main action); line icons in
the sidebar; the logo once; labels in sentence case instead of tiny capitals; no repeated
labels above page titles; vendor initials instead of emojis; shorter, plainer texts (and no more
"saves in this browser"). No feature changed. Tests: 273 pass, none changed. Checked every page
in Chrome at laptop and phone width, no console errors. Status: PR open, needs a team review.


## Festival settings and timetable fixes — 22 November 2026

Branch: `fix-festival-settings` (owner: Vicky). Plan: `feature-plans/fix-festival-settings.md`.

Saving festival details immediately refreshes the festival name in the sidebar selector. Festival settings, artist bookings and calendar blocks use 24-hour HH:MM inputs. Overnight closing times (e.g. 18:00–03:00) and after-midnight bookings stay within the selected festival day, including timetable display, conflict checks and backups. Festival view gives each day enough width for all stages, preventing overlap with the next day. The Delete this festival button aligns to the right like Edit festival details. Newly opened demos include “(demo)” in their saved name to distinguish them from personal festivals.

Validation: all 275 tests pass (0 failed or skipped), including new overnight booking, conflict and backup checks. Chrome checks confirmed name display, overnight saving and reopening, the three-day/three-stage timetable spacing, settings button alignment and a newly opened demo's label. Original festival hours were restored after testing. Existing tests were not changed.
## 22 November 2026 — Technical audit fixes (Kira)

Branch: `codex/technical-audit-fixes`, based on main `92c6bd3`.
Approved reliability/security cleanup. Kira authorised committing and pushing this
branch for team review; no merge or database change.

Fixed per-section cloud save acknowledgements; queued team-save/retry handling;
project-draft checks before account/festival changes; cross-tab transition markers
and recovery; plan/roster/metadata rollback; and screen save-failure consistency.
Hardened shared markup and map input validation. Aligned single/active stages across
map, crowd and readiness, retaining inactive measurements. Bounded extreme task dates,
validated task identifiers, removed duplicate navigation bindings and unused preview
rendering. Damaged saved lineups/tasks remain unchanged behind explicit recovery
messages, with dependent figures unavailable until recovery.

Updated active brief, README and baseline/agent notes to the approved flexible rules.
Kept existing assertions intact; isolated the old Node-only regression contract from
browser code. Legacy saved-data compatibility remains intentionally supported.
Identified missing database protection for Admin-only festival details and the overall
artist budget. At Kira's request, removed the prepared SQL file; Amelie will implement
and test that fix separately. No live database changes were made.

Validation: **335/335 tests passed, 0 skipped** (273 existing + 62 new); syntax checks
passed for 28 changed/new JavaScript files and `git diff --check` was clean. Disposable
browser checks included precise-time booking, settings, map/task edits, permissions,
reload, extreme dates, failed writes, damaged data and confirmed backup restoration.
The actual async account script was tested with mock services. Live authentication,
multi-account devices and applied database permissions remain separate checks.
Public app URL responded HTTP 200; this only confirms reachability.

Teacher approval of the HTML/CSS/JavaScript stack is still unconfirmed. The team
must recheck these flows after the separate interface, finance and empty-new-festival
changes. Full Part 1 findings, storage review and verification limits:
[feature-plans/technical-audit-fixes.md](feature-plans/technical-audit-fixes.md).
Part 2 presentation notes/Word document remain deferred until Kira asks to start.

## Admin-only festival details and artist budget in the database

Branch: `feature-admin-only-lineup-details` (owner: Amelie). Plan:
[feature-plans/admin-only-lineup-details.md](feature-plans/admin-only-lineup-details.md).

Closes the gap found in the technical audit: an Editor could change the festival details
(`event`) and the overall artist budget (`settings.budget`) inside the lineup section by
sending a request directly. `migrations/006_admin_only_lineup_details.sql` makes the
database refuse that, while Editors keep booking artists, setting fees, moving performances,
changing stages and finalising. `app.js` no longer runs the one-time opening-hours
migrations for Editors and stops an Editor from creating the lineup before the details exist,
so the planner never sends a save the database would refuse.

Validation: **339/339 tests passed** (335 existing + 4 new in
`tests/admin-only-lineup-details.test.js`). Migrations 001 and 003–006 were also run against a
local Postgres (PGlite) with Owner, Admin, Editor and Viewer: 24/24 role cases behaved as
planned, including a direct table update and running 006 twice.

Supabase: **not applied yet.** Amelie runs 006 in the SQL Editor after review.

**Update 22 November:** PR #32 merged; Amelie applied 006 in the Supabase SQL Editor. Checked
through the connector: the save rule uses the new check, signed-in accounts can run it,
signed-out visitors cannot, and the security advisor reports nothing new. Still to try: the
flow with two real accounts.

## Forgot password

Branch: `feature-forgot-password` (owner: Amelie). Plan:
[feature-plans/forgot-password.md](feature-plans/forgot-password.md).

"Forgot your password?" on the sign-in screen sends a reset link (Supabase
`resetPasswordForEmail`); the link opens "Choose a new password" (`updateUser`), then the app
opens signed in. Expired or used links offer a new one. The rules are in
`rules/account-rules.js`; `account/account.js` and `index.html` show the two new forms.

Validation: **349/349 tests passed** (339 existing + 10 new in `tests/forgot-password.test.js`,
which run the real sign-in screen with a fake Supabase). Not yet tried in a browser.

Before it works for everyone (Amelie, in the Supabase dashboard): Redirect URLs and Site URL in
Authentication → URL Configuration, and custom SMTP — the built-in email service only sends to
members of the Supabase organization.

## Automatic lineup planning — 22 November 2026

Branch: `feature-automatic-lineup-fillup` (owner: Vicky). Plan: `feature-plans/automatic-lineup-fillup.md`.

Added Suggest lineup as the orange primary action in the festival timetable, replacing the redundant toolbar Book artist button. Individual booking remains available from the catalogue and free timetable slots. Opening it immediately shows a compact timetable grouped by day with a horizontal row per stage, and Cancel and Use this lineup actions. Time positions show gaps and overlaps; retained bookings and blocks are included, the headliner is outlined, and an immediate custom tooltip exposes each set’s full name/time on hover, keyboard focus or tap. The tooltip stays above the modal and outside the scrolling preview, and clears when the preview scrolls or regenerates. The preview scrolls for longer festivals or narrow screens. The suggestion uses only This festival artists, balances performance counts across days/stages and spreads entertainment across the day. It aims for 30 minutes after doors open and 15 minutes before closing, and tries an alternating stage order without overlapping performances when the available time allows it. Busy schedules retain stage parallelism; any remaining overlaps or reduced arrival/exit buffers are explained. The organiser chooses the final-day headliner in the suggestion popup, independently of artist fees; changing the selection immediately recalculates the timetable, and applying remembers the choice; changeovers are at least 15 minutes per stage and three consecutive performances of the same genre per stage/day are avoided. Artist budget, stage hours, overnight times and calendar blocks remain enforced.

Using a suggestion replaces tentative performances after a visible notice; confirmed bookings, their linked changeovers and standalone blocks stay in place. New performances are tentative. Cancel does not save; changed plans require another suggestion, and permissions and failed saves keep the original plan intact. Renamed Delete artist to Remove from festival throughout its editor, confirmation and success message.

Validation: all 403 tests pass (0 failed or skipped), with 23 new scheduling/interface checks and unchanged existing regression tests. Tests cover fees, hours, overnight bookings, headliners, genre runs, spacing, non-overlapping alternating stages, dense-schedule fallback, fixed blocks, confirmed performances, cancellation, stale suggestions, permissions and failed saves. In Chrome, opening Suggest lineup immediately showed 10 proposed sets with no checkbox or preview button. Cancel kept the prior schedule; Use this lineup saved five sets per day, alternating stages without overlaps, starting at 14:30 and ending at 22:45, with €2,500 remaining. The plan survived reload. Verified in Chrome that selecting Fado Nova in the headliner dropdown immediately puts that artist in the final slot, without applying the suggestion. The compact Chrome preview displays both festival days and all stage rows together; changing the headliner updates its outlined closing slot without saving, and cancellation keeps the existing timetable. Verified the custom tooltip in Chrome on a truncated Tomás Vale label; its full name and 14:30–15:10 times appear above the bar. Status: ready for team review.

**Update 22 November (forgot password):** custom SMTP with the team Gmail account
(festivalarchitect.team@gmail.com) and the Redirect URLs are set up in Supabase; Amelie reset her
password on the live app successfully. Fix on `fix-reset-wait-message`: asking for a second email
within a minute showed "Too many emails were sent in the last hour" — Supabase uses the same code
for its one-email-per-minute rule. It now says how many seconds to wait. 405/405 tests passed after merging main (with #38).

## Lineup suggestions: budget as in manual booking — 22 November 2026

Branch: `fix-lineup-suggestion-budget` (owner: Amelie). Plan: `feature-plans/automatic-lineup-fillup.md` (updated).

"Suggest lineup" treated the artist budget as a hard limit: it left artists out ("Not enough remaining
budget") and refused to plan when the lineup was already over budget. Manual booking and the brief
("Flexible budget") allow going over after confirmation. Now the suggestion plans every artist that fits
the hours; the preview shows the remaining amount or "€X over the €Y artist budget", and applying asks
with the same "Go over budget?" dialog when the overrun is created or increased. The rule is
`budgetOverrunGrows` in `rules/festival-rules.js`.

**Test changed with Amelie's approval (22 November):** in `tests/automatic-lineup.test.js`, "budget is
respected and missing artists are reported" checked the old hard limit. It is replaced by "budget is not
a hard limit and missing artists are reported" (all artists planned at €250 and €0 budget; artists left
out only for lack of time). Vicky, please review. New: `tests/lineup-suggestion-budget.test.js` (8 tests).
Validation: 413/413 tests passed.

## Animated visitor simulation — 22 November 2026

Branch: `feature-animated-visitor-simulation` (owner: Vicky). Plan: [feature-plans/animated-visitor-simulation.md](feature-plans/animated-visitor-simulation.md).

The Site map now has a read-only Visitor simulation for every festival role. Each dot represents one visitor. Visitors arrive in groups, follow the selected day's booked sets and move between stages and facilities. A switchable heatmap counts visitors in each map cell against the project's density limit. Organisers can choose a day, scrub the clock, pause, restart or play at 1×, 1.5× or 2×.

Evacuation starts with the people currently on the map. Walking routes use the site's fence and no-go areas. Open exit widths, response delay, walking speed and flow rate govern the animation. Visitors without a reachable exit stay visible. An exit without a measured width holds its queue. The existing peak-scenario estimate appears beside playback when its measurements are complete. Both modes model group behaviour for planning discussions.

Validation: all 389 tests passed, including nine new checks for individual dots, timetable changes, walkable ground, exit queues, overnight sets and read-only playback. In Chrome, reloaded the 20,000-visitor Munich demo, switched to Saturday at 1.5×, checked that all 20,000 exited, and returned to the original festival time.

## Evacuation slider endpoint — 23 November 2026

Branch: `feature-visitor-simulation-merge` (fix owner: Vicky). Plan: [feature-plans/animated-visitor-simulation.md](feature-plans/animated-visitor-simulation.md). Pull request: [#42](https://github.com/ameliepressl/Festival-Planner/pull/42).

Seeking to the end now uses exactly 100% of the simulated evacuation time. Chrome previously rounded the fractional time and could leave one visitor on site.

Validation: 422/422 tests passed, including the endpoint regression check. In Chrome, Munich showed 20,000 exited and zero on site. Lisbon showed 5,000 waiting at unmeasured exits.

## Reset links that mail scanners cannot use up — 23 November 2026

Branch: `fix-reset-link-scanners` (owner: Amelie). Plan: `feature-plans/forgot-password.md`.

Testing on the live app, reset links for @novasbe.pt addresses always said "expired". The Supabase
auth log showed why: Microsoft Safe Links opened each link about 15 seconds after it was sent
(GET /verify from Microsoft addresses), which used up the one-time token before the person clicked
("One-time token not found"). Now the email links to the app with `?token_hash=…&type=recovery`;
opening the page redeems nothing, and `verifyOtp` runs only when the person saves the new password.
Old `#access_token` links still work. The confirmation mentions the few-minute delay and the junk
folder. Validation: 429/429 tests passed (7 new in `tests/forgot-password.test.js`; the test helper
there can now also simulate an address with `?…` and `verifyOtp`; no existing check changed).

Supabase (Amelie, after merging): change the Reset password email template to the new link.

## New festivals start with zero finances — 23 November 2026

Owner: Kira · Branch: `codex/zero-finance-start` · Plan: [zero-finance-start.md](feature-plans/zero-finance-start.md).

Newly created festivals now store a complete set of zero finance assumptions and no custom cost/income lines. This applies to the first festival of an account and the New festival action. Existing saved finance sections, imported plans and both demos keep their supplied values. New-account startup loads the seeded values into the browser before showing the plan.

An untouched finance page shows zero totals and neutral guidance instead of claiming that sponsors cover costs or displaying hypothetical profit comparisons. The former Reset action is explicitly labelled Load example values; its existing optional example-loading behaviour is retained. Finances still include actual booked artists and confirmed vendor income. Data uses the existing synced `festival-architect-finance` key; no database migration is needed.

Validation: **470/470 tests pass**, including 16 new creation, persistence, finance and screen checks; existing assertions remain unchanged. Isolated browser checks covered new-account and later-festival creation, zero values after reload, entered values after reload, switching back to preserved custom values, both populated demos, and a 375px layout with no document overflow or console errors. The normal app's existing Lisbon festival still shows its saved figures.

Main integration: saved the finance work in local commit `836ceff` and merged `origin/main` at `03407d0` (notification sender feature) without conflicts. Combined validation: **479/479 tests pass**; browser reload shows the saved forecast and notifications without console errors. Status: committed locally for Kira's review and up to date with that main; not pushed.

Published `codex/zero-finance-start`, then brought in the next main update at `3048eb7` (sender fallback for older notifications), again without conflicts. **483/483 tests pass** after this update; the reloaded app retains the saved finance figures and has no console errors. The feature branch is for team review; it has not been merged into `main`.
