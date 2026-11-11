# Repair lineup startup

Why: main contains an unfinished legacy single-day script prepended to the current multi-day screen, preventing the entire file from parsing.

What: remove only that obsolete, incomplete prefix so the current screen can initialise its default artists, stages and calendar.

Out of scope: new planner features and data resets.

Done when: all existing tests pass and the browser displays eight default artists, two stages and the timetable after reload; Task board and Final checklist still open.
