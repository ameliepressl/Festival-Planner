# Fix — Final check before submission

Owner: Frederik · Branch: `final-check-fixes` · Builds on: [festival backdrop](festival-backdrop.md),
[lineup planner improvement](lineup-planner-improvement.md), [audit bug fixes](audit-bugfixes.md)

## Why

A last full check of `main` after pull requests #52–#56 (every page at 1280 px and 375 px with both demos,
invalid input in the lineup dialog, dragging sets, one headliner per day, "+ Add pin", all scripts and
references, the save-conflict code and its migration) found these problems. Nothing else changes.

1. **Venues with a hyphen got no landmark.** "Berlin-Mitte", "München-Riem", "Paris-Nord" or "Köln-Deutz"
   showed no landmark, because the hyphen counted as part of the word ("berlin-mitte" is not "berlin").
2. **Most library styles had no mood.** Library artists keep their style as the genre ("Grime", "Salsa",
   "Trip hop" …); 29 styles matched no mood, so festivals with them fell back to "sunset".
3. **Everyday words made a coast.** "nice" and "see" are coast words, so "A nice place" or
   "See you there" got waves and a beach.
4. **The backdrop plan said the festival name glows in the banner,** but that text is hidden on purpose (commit 81e0fbf).
5. **A gap in the tests.** With one headliner per day (#55), an existing test now checks "a suggestion keeps
   a confirmed performance and its notes" on one day only. The two-day case had no test any more.
6. **Old numbers in the docs.** The README said 530 tests; `docs/ai-workflow.md` still had the numbers of 49 pull requests.
7. **Keep mine / Use theirs disappeared** (found by walking through Amelie's two-browser test for #56, at the
   same time as the live retest). While the finances waited for a decision, a save of another section
   replaced the conflict notice and hid both buttons. Amelie fixed this in #57; this branch adds one test
   that plays the whole two-browser test (steps 1–11) end to end, so it stays fixed.

## What

- [x] `rules/backdrop-rules.js` · `venueMatch`: a hyphen separates words. No scene or landmark word contains one.
- [x] `rules/backdrop-rules.js` · `BACKDROP_GENRE_MOODS`: the 29 library styles added to the fitting mood
      (heat, dusk or neon). The order of the moods is unchanged, so "Pop rock" stays rock and "Indie dance"
      stays electronic. Plain "Indie" keeps no mood, as the existing test expects.
- [x] `rules/backdrop-rules.js` · coast words: `nice` and `see` removed.
- [x] `feature-plans/festival-backdrop.md`: notes that the poster text is hidden for now.
- [x] `index.html`: cache version of `rules/backdrop-rules.js` raised.
- [x] New test for the two-day case (5 below). No existing test changed.
- [x] New end-to-end test of the two-browser test (7 above), against the fix from #57. No app code changed for it.
- [x] `README.md` and `docs/ai-workflow.md`: current numbers (582 tests in 52 files, 57 pull requests, 58 plans,
      22 rule modules, 7 migrations).

## Out of scope

- Drawing, animation, colours or any other content of the backdrop; any other app behaviour.
- Accepted look-alikes: "Sydney Road, Melbourne" → opera, "Rio Grande" → rio, "Paris, Texas" → eiffel.
  The city Nice (France) is now a city scene instead of a coast.
- Dragging sets on a touch screen (drag and drop needs a mouse; on phones a set is still moved in its dialog).
- Running `migrations/007_section_conflicts.sql` in Supabase: the database owner does that (done, see #57).
  Without it the app saves exactly as before (tested in `tests/section-conflicts.test.js`).

## Done when

- [x] Hyphenated venues find their landmark; "Parisian Hall" still finds none.
- [x] Every genre and style in the artist library except plain "Indie" gets a mood.
- [x] "A nice place" and "See you there" are a city; Lisbon and Praia da Rocha stay a coast.
- [x] On a two-day festival a suggestion leaves a confirmed performance and its notes unchanged.
- [x] Amelie's two-browser test (steps 1–11) passes against the fake database of migration 007, including
      "Use theirs" after a vendor change and "Keep mine" after a reload.
- [x] All tests pass; no existing test changed; checked in the browser.

## Tests

`tests/final-check-fixes.test.js` (6 tests). The four backdrop tests fail on the code before this fix and
pass after it; the two-browser test fails on the code before #57 and passes on it; the fifth covers the
two-day case. The two-browser test uses `tests/helpers/account-screen.cjs`, a copy of the fake database and
page from `tests/section-conflicts.test.js` (that test file is unchanged). Full suite: 582 tests, 582 pass, 0 fail.
