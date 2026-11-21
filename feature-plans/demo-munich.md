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

Found, not fixed (bigger changes, for the team to decide):
- The site map, crowd checks and final checklist always assume **two stages** (A and B), while the
  lineup can have up to 12. The Munich demo's Rising Stage is not on the map.
- The project tasks (Gantt) are not touched by the demo loader (team decision), so they stay at 0 % done.
- The "Edit plan" button of the timeline is cut off on narrow windows.

## Tests

`tests/demo-munich.test.js` (dates, stages, real library artists, all lineup rules, budget,
the 80 % open points, vendors, site map, crowd densities, finance values and profit, fresh copies)
and `tests/bug-hunt-fixes.test.js` (artist edit keeps the library link; fails without the fix).
No existing test was changed.
