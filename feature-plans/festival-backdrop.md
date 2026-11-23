# Feature — Festival backdrop on the Overview

Owner: Amelie · Branch: `feature-festival-backdrop` · Builds on: Overview, artist library genres

## Why

The Overview opens with plain text. A picture that fits the festival makes the app feel alive in
the live demo and shows at a glance what kind of festival it is.

## What

- [x] A banner above the Overview with a generated "festival poster": sky, landscape, a stage
      with swaying light beams and a crowd, plus a short caption (venue · mood).
- [x] **Rules in `rules/backdrop-rules.js`:**
      - **Mood from the lineup.** The most common genre among the booked performances (or, with nothing booked, the artists in the catalogue) chooses the colours:
        - electronic → neon
        - rock and metal → ember
        - jazz, blues, soul → gold
        - hip-hop, Latin, Afrobeats → heat
        - folk, country, fado → dusk
        - pop → candy
        - otherwise the app's sunset colours
      - **Landscape from the venue:**
        - coast places (Lisbon, Porto, beaches, …) → sea
        - Alpine places (Munich, Zurich, …) → mountains
        - parks and fields → hills
        - everything else → skyline
      - The same festival always gets the same picture (seeded by name and venue).
- [x] **Screen:** Overview, for every role (it only shows what is already visible). Drawn in code
      as SVG: no photos, no outside service, nothing saved or sent. User text never goes into the
      SVG; the caption uses `textContent`. Decorative (`aria-hidden`); the beams stand still with
      "reduce motion".

## Out of scope

- A theme field, uploaded or real photos, backdrops on other pages.

## Done when

- [ ] The banner fits the Lisbon demo (coast, its genres) and the Munich demo (mountains)
- [x] Tests in `tests/festival-backdrop.test.js` cover the rules and the Overview flow
- [ ] All tests pass; tried in the browser including a reload and a narrow window
- [x] `README.md` / `AGENTS.md` updated if users or agents would notice the change (README: one line)

## Tests

- `tests/festival-backdrop.test.js` (10 tests): every library genre's mood; mood from bookings,
  catalogue and fallback; landscape from the venue (incl. both demos); same festival → same
  picture; every mood × landscape draws a complete SVG without user text; the Overview banner
  (caption, redraw only on change, plain-text venue, hidden when rules are missing or fail).
- All 28 mood × landscape pictures were rendered to PNG (rsvg) and looked at.
- Not yet: the banner inside the real page in a browser.
