# Feature — Second demo festival "Munich Loud Weekend" + bug hunt

Builds on `ci-and-demo-festival.md`, `artist-library.md` and `vendor-catalogue.md`
(merge those first; this branch is stacked on them).

## Why

For the presentation we want a big, realistic festival with real artists that is clearly
"in progress": about 80 % planned, with open points that the app shows. It is modelled on the kind
of large hip-hop festival that came to Munich in July 2023 (three days, several stages,
US and European rap). The name and all numbers are made up.

## What

- [x] **"Load demo festival" now offers two demos**: Lisbon Sound Festival (small, unchanged, still
      checked by `tests/demo-festival.test.js`) and **Munich Loud Weekend** (big).
- [x] **Munich Loud Weekend**: Fri 9 – Sun 11 July 2027, 13:00–23:00, 3 stages (Main, Loud, Rising),
      34 shows by real artists from the artist library (headliners Travis Scott, Future, Nicki Minaj),
      library fees (fictional), artist budget €2,000,000, 20,000 visitors (the app's maximum),
      16 of 20 food court pitches (originals plus library stands), festival finances with a profit,
      and measured audience areas for both mapped stages.
- [x] **About 80 % planned** (Overview readiness 82 %, 18 of 22 checks). Still open on purpose:
      5 tentative bookings, nothing booked on the Rising Stage on Sunday, 4 free pitches,
      exit widths not measured, and cash needed before ticket money arrives.

## Bug hunt (clicked through every page with the Munich demo)

Fixed:
- Editing an artist from the library dropped its library link, so its photo disappeared (`app.js`).
- The "Profit by regular ticket price" chart stopped at €100, so a €169 ticket was drawn at €100.
  The axis now grows with the price and break-even, up to €500 (`finance/finance-page.js`).
- Large budgets (€2,000,000) ran into each other in the lineup budget strip on smaller screens (`compact.css`).
- A photo that fails to load left an empty circle; the initials now come back (`artist-library/artist-photos.js`).
- An old error message in "Edit stage planning settings" stayed after correcting the field (`app.js`).

Also fixed (found in the bug hunt, fixed on request):
- **The site map knows every lineup stage** (2 to 12; read from the lineup's stage settings). Each extra
  stage (C, D, ...) gets its own pin, first aid tent, toilet row and water point; the layout planner
  places it far from the other stages; the layout check, the walkways and the crowd checks (audience
  area, density, evacuation) include it. Without a stage count everything stays exactly as before
  (two stages), so saved maps and the Lisbon demo are unchanged (`rules/site-map-rules.js`,
  `rules/crowd-rules.js`, `site-map/*`). The Munich map now shows the Rising Stage.
- The final checklist says "every stage" instead of "both stages" (`rules/checklist-rules.js`).
- **Project tasks for the Munich demo**: the team rule was "the demo loader does not touch tasks".
  On request, the *Munich* demo now marks the earliest 80 % of the Gantt subtasks done and the next one
  in progress (167 of 209 done with the default plan). The Lisbon demo still leaves tasks alone, and the
  demo dialog says so (`demoTaskStatuses` in `rules/demo-festival.js`, `demo/demo-loader.js`).
- The "Edit plan" button of the timeline is no longer cut off on narrow windows: the toolbar wraps onto
  a second row instead of scrolling (`compact.css`). On wide screens it stays one row.

Readiness of the Munich demo is now 83 % (19 of 23 checks: Stage C's crowd density was added).

## Tests

`tests/demo-munich.test.js` (dates, stages, real library artists, all lineup rules, budget,
the 80 % open points, vendors, site map, crowd densities, finance values and profit, fresh copies),
`tests/bug-hunt-fixes.test.js` (artist edit keeps the library link; fails without the fix) and
`tests/stages-and-tasks.test.js` (two-stage layout unchanged, 3 and 4 stages planned at 100 %,
stage-distance and first-aid failures for Stage C, saved maps keep Stage C, crowd checks for Stage C,
Munich map with three stages, checklist wording, demo task statuses).
No existing test was changed.
