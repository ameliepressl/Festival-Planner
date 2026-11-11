# Repair lineup loading

Why: main’s app.js contains an incomplete old single-day implementation before the current planner. The syntax error prevents all planner controls and rendering from starting.

What: remove the obsolete prefix, retain the current multi-day implementation, keep the renamed Final checklist label with a stable internal navigation identifier, and verify minute-precision time parsing.

Out of scope: new planner features, changes to checklist content, committing or pushing without further user approval.

Done when: syntax and unchanged existing tests pass, settings and bookings work, and both pages navigate correctly after reload.
