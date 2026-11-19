# Feature — Automatic tests on GitHub (CI) + "Load demo festival"

Roadmap top pick 1.

## Why

- **CI:** every pull request should show a green or red check, so nobody has to remember to
  run the tests and a broken change cannot slip into `main` unnoticed.
- **Demo festival:** for presentations and for trying the app, one click should fill every
  section with a realistic festival instead of empty pages.

## What

- [ ] `.github/workflows/tests.yml` runs on every pull request and every push to `main`:
      the JavaScript tests (`node --test`) and the Python tests (`unittest`).
- [ ] A "Load demo festival" button in the left sidebar.
- [ ] It asks first, because it replaces the lineup, vendors, festival size and finance
      assumptions in this browser (with the hint to download a backup first).
- [ ] The demo: "Lisbon Sound Festival", 30–31 December 2026, 2 stages, 10 artists booked
      once each within the opening hours (no overlaps), €18,000 artist budget,
      5,000 visitors, 11 vendors, ticket price €39, €15,000 sponsorship.
- [ ] The demo site map is re-planned for the demo festival size; uploaded maps, the Gantt,
      the task board and the checklist are not touched.
- [ ] The demo data lives in `rules/demo-festival.js` (no screen code) and is tested against
      the real lineup, vendor and capacity rules; the button code is in `demo/`.

## Out of scope

- Demo data for the Gantt, the task board and the checklist (they have their own defaults)
- Deploying the app from GitHub

## Done when

1. Both test suites pass locally and in the GitHub check of the pull request.
2. Every demo booking passes the lineup rules (`bookingProblem`), each artist appears once,
   and the artist fees stay within the demo budget.
3. Clicking the button and confirming shows the demo on every page after the reload:
   Overview with the festival name, 10 performances in the lineup, 11 vendors, 5,000 visitors,
   a site map at 100 %, and a profit on the Finances page.
4. Cancelling the question changes nothing.
