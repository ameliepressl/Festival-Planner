# Fix — Two bugs from the final audit

Owner: Frederik · Branch: `audit-bugfixes` · Builds on: [data audit and clean-up](data-audit-and-cleanup.md)

## Why

A last check of the whole app before submission (every page, invalid input in every dialog, phone width,
and a scan of all browser scripts) found two bugs that the tests did not catch.

1. **Impossible dates were accepted in the browser.** `rules/festival-rules.js` and `rules/notification-rules.js`
   both declared a global `function validDate`. In the browser all scripts share one global scope, so the later,
   looser one replaced the strict one everywhere: festival dates and Gantt dates read from saved or synced data
   accepted 30 February and 31 April. The tests load each file on its own, so they never saw it.
   (The date fields themselves never allow such dates; the gap was in reading saved data.)
2. **"€null" on Finances.** With the expected ticket sales at 0 %, the break-even card said
   "… visitors · or regular price €null".

## What

- [x] `notification-rules.js`: its own date check is now called `validNoticeDate`, so the strict `validDate`
      applies everywhere again.
- [x] `finance/finance-page.js`: without a break-even price the card leaves out "or regular price".
- [x] Cache versions raised in `index.html` for both scripts.

## Out of scope

- Any other change to rules or screens.

## Done when

- [x] A new test fails if any two browser scripts declare the same global name.
- [x] Festival dates refuse 30 February in the browser load order; notifications still read their dates.
- [x] The Finances page never shows "€null" with 0 % ticket sales.
- [x] All tests pass; checked in the browser.

## Tests

`tests/audit-bugfixes.test.js` (4 tests). Three of them fail on the code before this fix and pass after it.
No existing test changed.

Audit, all without errors unless named above (Munich demo, test port, 1280 px and 375 px): all 8 pages load
without console errors and fit a phone screen; Lineup refuses an overlapping set, a time outside the opening
hours, 25:00, duration 0, negative fee and changeover; artist dialog refuses a blank name or genre; festival
details refuse end before start, a blank name and a negative budget; Add vendor refuses a blank or duplicate
name, a fee above €20,000 or with cents, a menu price of €0 and a blank item, and shows HTML in a name as text;
Add new task refuses a blank title and an end before the start; every Finances and Site map number field was
set to empty, −1, 0, 1e9 and "abc" without NaN, Infinity or undefined appearing (only the "€null" above).
