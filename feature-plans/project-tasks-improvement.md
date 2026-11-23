# Feature — Project tasks improvements

Owner: Vicky · Branch: `feature-project-tasks-improvement` · Builds on: [task assignments](task-assignments.md) and the [project timeline](preliminary-gantt.md)

## Why

Organisers need to assign work from the board, organise it around their own work areas, and opt out of the starter tasks when starting fresh.

## What

- Assign or unassign a subtask through Edit task on the board using the existing assignment permission and eligible team list.
- Create a named work area from the Work area dropdown in Add new task or from the Add work area row below the timeline. Both flows require a first task group, subtask, and dates. The timeline adds all three to its draft.
- Let the festival owner and Admins manage areas from beside the shared view switch. Require a move or explicit deletion choice for populated areas.
- Let the festival owner and Admins confirm clearing all task groups and subtasks from the timeline draft. Keep the areas and remove old statuses and assignments when the draft is saved.
- Offer Restore last deletion beside the view switch and Manage work areas after a bulk deletion is saved. Recover the deleted rows, progress, and assignments while preserving newer edits. Store one recovery record per festival in the existing Admin-protected assignment section.

## Out of scope

- Changes to role permissions, team membership or database access rules.

## Done when

- Board assignments also appear in the timeline, and new work areas survive save and reload.
- Editors can create areas. Assignment, work-area management, and timeline clearing are restricted to the festival owner and Admins.
- Cancel preserves the current plan. Saving a cleared draft updates the board and overview.
- An Admin can restore the last saved bulk deletion after reloading. Newer work and assignments remain intact.
- Run all tests and verify the flows in a browser.

## Tests

All 491 tests passed. Browser checks with disposable data covered assignment, area creation and management, clearing tasks, reload, Editor and Viewer controls, the board dialog at 390 px, and recovery after saving an area deletion or clearing tasks.
