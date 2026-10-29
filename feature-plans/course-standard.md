# Baseline — bring the shared project up to the course standard

## Why

As a team, we can only add new features safely if the existing lineup planner
is checked automatically. Then every pull request shows straight away whether
it broke a rule from the brief.

## What

- [ ] The rules move from app.js into rules/festival-rules.js (no screen code),
      so they can be tested on their own. app.js only draws the page and calls
      the rules. The behaviour on screen stays the same.
- [ ] Tests in tests/ cover scenarios A1–A6 of the brief and run with
      `uvx --from nodejs-wheel node --test` (no extra install, only uv).
- [ ] Finalising re-checks every booking against all rules, not only the number
      of artists (FA05). Every problem is shown.
- [ ] The brief is in product-brief/, feature plans live in feature-plans/, and
      AGENTS.md tells people and AI agents how to run, test and contribute.
- [ ] The existing files and folders stay where they are; everything new goes
      into its own clearly named folder.

## Out of scope

- New features (task board, site map, vendors)
- Changes to the look
- The open branch lineup-planner-update-1 (multi-day); it is reviewed separately
- PROJECT_PROGRESS.md (owned by Amelie)

## Done when

1. `uvx --from nodejs-wheel node --test` passes all tests.
2. A1: Naya Bloom on Stage A 16:00 → Night Bus on Stage A at 16:30 is rejected,
   at 17:00 accepted.
3. A3: a 60-minute set at 13:59 or 22:01 is rejected, at 22:00 accepted.
4. A4: with €8,900 committed, Luna Lune (€1,100) is accepted (exactly €10,000),
   Mila & The Sun (€1,200) is rejected; booking Naya Bloom twice is rejected.
5. A6: finalising with 3 artists is rejected, with 4 valid bookings accepted; a
   plan with two overlapping sets cannot be finalised and names the artists.
6. A6: after reloading the page, the lineup, totals and final status are the same.
7. Opening index.html still shows the same lineup planner, and booking, editing,
   removing and finalising work as before.
