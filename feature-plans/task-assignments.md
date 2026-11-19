# Task assignments and team progress

Owner: Amelie · Branch: `feature-task-assignments` (after the Overview design)

## Why

Several people now plan one festival, but every task belongs to nobody: the Gantt's Owner
column is empty and the board cannot show "my tasks". The festival creator cannot see who is
behind, and teammates cannot see what is expected of them.

## What

- [x] **Assign per task group, change single subtasks.** Owner and Admins pick a person for a
      task group (e.g. "1.1 Define the festival") in the Gantt's Owner column. Every subtask of
      the group goes to that person. On the Task board an Admin can give one subtask to someone
      else, or to nobody. Choosing the group's person again removes the exception.
- [x] **Who may do what.** Only Owner and Admins assign. Everyone from Editor up changes a
      status (as before). Viewers only look. The database enforces it: Editors cannot change the
      assignments, just like the finances (`migrations/004_task_assignments.sql`).
- [x] **Who finished it.** When a subtask is set to Done, the board stores who did it and when,
      and the Done card shows "Done by Kira".
- [x] **Task board filter "Assigned to":** everyone, my tasks, nobody, or one person. Each card
      shows its person.
- [x] **Overview → Team progress:** one row per person with assigned subtasks, done (in %),
      overdue and the next deadline; the own row is marked "you". A click opens the Task board
      filtered to that person. The card also counts subtasks nobody is assigned to.
- [x] The rules (who a subtask belongs to, the filter, the progress numbers) live in
      `rules/task-rules.js` with tests in `tests/task-rules.test.js`.

Saved data: `festival-task-assignments-v1` = `{ "groups": { taskId: userId },
"steps": { subtaskId: userId or "" } }`. A subtask in `steps` has its own person (`""` =
nobody); otherwise it belongs to its group's person. Someone who left the team counts as
nobody. Done statuses in `festival-work-board-status-v1` gain `completedBy` (the user id).

## Out of scope

Notifications or emails, workload limits, assigning to people without an account, assigning
whole work areas, changing who may change a status.

## Done when

All tests pass; migration 004 is tested in a local Postgres (PGlite) and applied in Supabase
with Amelie's OK; in the browser an Admin assigns a group and overrides one subtask, an Editor
sees them but cannot assign, the filter and the Team progress numbers match, and everything
is still there after a reload and on a second account.
