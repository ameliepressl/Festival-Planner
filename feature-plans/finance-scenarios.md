# Feature — Ticket sales per scenario, more assumptions and your own costs/income

## Why

The Scenarios card used fixed sell-throughs (50 % / plan / 100 %). Organisers want to set how many
tickets sell in each case. And real festival budgets have more lines than the app knew (VAT, music
licence, VIP tickets, merch, power, crew, cleaning, ...) plus lines nobody can foresee.

## What

- [x] **Tickets per scenario**: under the Scenarios chart every case has a slider (%) and a ticket box.
      Drag the slider or type a ticket number (it is turned into a share). "Your plan" is the normal
      sell-through. The bad case cannot sell more than the best case (checked in `rules/finance-rules.js`).
- [x] **Additional assumptions** (4th block under "Financial assumptions"), all 0 by default so existing
      plans and numbers stay exactly the same:
  - More ticket assumptions: VIP share and surcharge, free guest-list tickets, VAT in the ticket price,
    music licence (e.g. GEMA). All ticket shares together are at most 100 %.
  - Other income: merch spend per visitor and margin, public funding/grants.
  - Other costs: power per day, crew per day, cleaning per visitor per day, artist hospitality (% of fees).
- [x] **Your own costs and income**: "+ Add cost" / "+ Add income" rows with name, amount, basis
      (in total, per day, per visitor, per visitor per day) and when it is paid (before, at, after the
      festival). Up to 30 lines. They appear in P&L ("(own)"), break-even, scenarios and the cash-flow plan.
- [x] Only admins (budget permission) can change them; they are saved inside the admin-only finance key,
      so the database rules from migrations 003/004 protect them too. Broken or tampered saved lines are dropped.

## Tests

`tests/finance-scenarios.test.js` (13 tests): defaults unchanged, scenario tickets and labels, bad > best
rejected and repaired, VIP/guest tiers, the 100 % rule, VAT and licence, merch/grants/power/crew/cleaning/
hospitality, reserve on new fixed costs, own lines per basis, break-even with everything, cash flow ends at
the profit with lines in the right months, validation of own lines, parsing of broken saved data.
No existing test was changed.

Checked in the browser: slider and ticket box save, bad > best shows the error and resets, own lines
change the profit by the expected amount, survive a reload, and remove works. Medium-width windows no
longer scroll sideways (own-line rows wrap).
