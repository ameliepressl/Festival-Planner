# Integrate lineup update with main

Why: combine the user’s lineup planner branch with the shared app and crew checklist.

What: preserve multi-day scheduling, editable artists, minute-precision times, calendar blocks, notes, print export, adjustable stages and budget, confirmed budget overruns and removal of hours controls. Keep the crew checklist and its navigation from main. Move current business rules into rules/festival-rules.js; retain baseline exports and tests for compatibility.

Out of scope: redesigning the checklist or adding the event homepage.

Done when: original rule tests and current-lineup integration tests pass, both pages work after reload, and the authorised merge is published.
