# Task board entry

Add an Open task board button below the project timeline preview. It opens a placeholder with a return button. Board columns, cards and interactions are out of scope.

## Status board

Show Gantt subtasks as cards across five status columns. Share saved names and dates with the Gantt chart; store statuses separately using stable subtask IDs. Offer search, area filter, drag and drop, and keyboard-accessible status selection. No duplicate task creation or inferred time tracking.

Replace Needs input and Needs review with Overdue and Done. Overdue is derived from the Lisbon date and the Gantt due date; Done takes precedence. Prior Needs input maps to Needs attention and Needs review to In progress.

Remove Needs attention. Existing Needs attention and Needs input cards fall back to Planned unless overdue.

Show each subtask due date at the top right of its card, beside the task number.

Sort Planned and In progress by earliest due date and Done by newest recorded completion. Keep older Done cards without timestamps in their existing relative order after dated completions.

## Create from the board

Add a modal beside search to create a scheduled subtask under an existing or new parent. Save using the shared Gantt plan; require names and ordered dates. Protect outstanding Gantt drafts.
