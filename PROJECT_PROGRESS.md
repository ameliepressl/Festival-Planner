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
