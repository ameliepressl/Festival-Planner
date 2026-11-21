# Feature — Review follow-ups and the product-brief decision

Follows the review of PR #24 and the team decision on the product-brief rules.

## Why

The festivals in the app are fictional, so the fixed rules from the brief (a €10,000 budget, no
artist twice, at least 4 artists to finalise) no longer fit. The review of PR #24 also left a few
smaller points open.

## What

- [ ] **Own budget:** the artist booking budget can be set directly in "Set up festival" /
      "Edit festival details" (any amount from €0). Admins only, like before in the lineup settings.
      Going over the budget still asks for confirmation.
- [ ] **Double bookings:** booking an artist who is already in the lineup is allowed, but first a
      warning lists their other performances ("Book again" / "Keep editing"). Two performances of the
      same artist at the same time stay impossible. The rule lives in `rules/festival-rules.js`
      (`doubleBookingWarning`).
- [ ] **Fewer than 4 artists:** a plan may be finalised with fewer than 4 artists (no change).
- [ ] **Evacuation start point:** other visitors start at the centre of the food court; if that centre
      is not walkable (e.g. pitches around a pond), they start at the pitch closest to it.
- [ ] **One route search:** walkways and the evacuation estimate share one A* search
      (`gridSearch` in `rules/site-map-rules.js`) with a binary heap instead of sorting the whole list
      every step. Same paths as before, about twice as fast.
- [ ] **Roadmap:** finished items marked as done, the "pending review" notes removed, the brief
      decision written down.

## Out of scope

- The "today in Lisbon" date helper stays in both `festival-rules.js` and `project-rules.js`: the tests
  load `festival-rules.js` on its own in a sandbox, so it cannot depend on another file.

## Done when

1. `uvx --from nodejs-wheel node --test` passes; no existing test is changed. New tests in
   `tests/review-followups.test.js`.
2. 2,000 random routes on the demo map are identical with the old and the new search.
3. Booking Naya Bloom a second time shows the warning with her first performance; "Book again" saves it.
4. The budget entered in "Set up festival" appears in the lineup planner and on the Overview.
5. With pitches around a pond, the evacuation estimate is valid and starts at the nearest pitch.
