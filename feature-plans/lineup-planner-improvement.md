# Feature — Lineup planner improvements

Owner: Vicky · Branch: `feature-lineup-planner-improvement` · Builds on: [automatic lineup suggestions](automatic-lineup-fillup.md)

## Why

Move tentative bookings directly in the timetable and plan a closing headliner for every festival day.

## What

- Drag tentative performances between visible days and stages. Validate the full appointment and move its linked changeover.
- Choose a headliner per day in Suggest lineup. Keep confirmed bookings fixed and explain any day that cannot fit a closing headliner.

## Out of scope

- Moving confirmed sets by drag and drop or changing lineup permissions.

## Done when

- Valid drops save and invalid drops leave the timetable intact.
- Suggestions place and highlight a closing headliner on each day, including overnight schedules.
- Run the full test suite and check the updated controls in a browser.

## Tests

All 515 tests passed. Disposable browser checks covered daily headliners, a valid stage and time drop, reload, and the confirmed drag restriction.
