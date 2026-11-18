# Feature — Finances, professional level

Roadmap section 8 (finances) and top pick 4. Builds on `financial-overview.md`.

## Why

Real festivals do not sell every ticket at one price, earn much of their money at the
bars, keep a reserve for surprises, and know which costs are signed and which could still
change. The financial overview should show all of that, and make it easy to see where
profit turns into loss.

## What

- [ ] **Ticket tiers:** early bird (share + discount), regular, box office (share + surcharge);
      tickets per tier always add up to the tickets sold; average ticket price.
      Early bird + box office cannot be more than 100 % (checked on input and when loading).
- [ ] **Festival bars:** spend per visitor per day and the margin kept after stock and staff;
      bar sales as revenue, bar stock & staff as a cost that grows with sales.
- [ ] **Contingency reserve:** a % of the fixed costs.
- [ ] **Break-even with all of this**, plus a **safety margin**: how many planned tickets may
      fall away before a loss (or how many are still missing).
- [ ] **Per visitor:** revenue, costs, profit and bar spend per ticket sold.
- [ ] **Profit matrix:** regular price (±€10) × share of tickets sold, green for profit,
      red for loss, the current plan outlined, hover for details.
- [ ] **Secure vs planned artist fees:** confirmed bookings vs tentative ones (booking status
      from the lineup planner), solid vs hatched bar so it does not rely on colour alone.
- [ ] **Profit & loss statement** split into fixed costs and costs that grow with sales.
- [ ] Existing behaviour kept: edit rights for the assumptions (`canFestival('budget')`) and
      `window.getOverviewFinance()` for the Overview.
- [ ] Old saved assumptions still load; new fields get their default values.

## Out of scope

- Cash-flow over time, VAT, actual vs plan (later roadmap items)

## Done when

1. `uvx --from nodejs-wheel node --test` passes. The existing finance tests keep all their
   hand-calculated numbers by checking the base model (extras switched off); the extras have
   their own tests in `tests/finance-extras.test.js`.
2. With the default assumptions for 5,000 visitors, 2 days, 2 stages, €9,000 artists and
   €2,400 pitch fees: revenue €242,100, costs €135,755, profit €106,345 (44 %),
   break-even 1,570 tickets or a regular price of €6, safety margin 61 %.
3. Early bird 95 % with box office 10 % is refused with a message; the old value stays.
4. A regular price of €12 with €2 bar spend shows a loss, red cells in the matrix and a
   negative safety margin.
5. The Overview shows the same revenue, costs and profit as the Finances page.
6. No horizontal scrolling at phone width.
