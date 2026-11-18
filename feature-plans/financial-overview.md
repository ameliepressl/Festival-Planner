# Feature — Financial overview

## Why

As a festival organiser, I want to see whether the festival makes or loses money,
where the money goes and comes from, how many tickets I must sell to break even, and
what happens if fewer tickets sell or I change the price — all calculated from the
lineup, the vendors and the festival size I have already planned.

## What

- [ ] "Finances" in the left navigation opens the page; the other items still work.
- [ ] It only reads the other pages' data (lineup, vendors, festival size), never changes it,
      and shows where the numbers come from (with links to those pages).
- [ ] Headline numbers: profit or loss with margin, revenue (tickets sold × price),
      costs (with cost per visitor), break-even (tickets needed and break-even price,
      or "more than the expected visitors").
- [ ] Analyses:
  - Where the money goes / comes from: bars, largest first, with amount and share
  - Profit by ticket price: line from €0 to €100 with break-even price and your price,
    hover shows the profit at each price
  - Scenarios: bad weather (50 % sold), your plan, sold out — bars up for profit, down for loss
  - Artist spending: budget used, performances, average fee, cost per stage hour,
    share of all costs, spending per stage and per day, the five most expensive shows
  - Profit & loss statement as a table
- [ ] Assumptions (ticket price, % sold, sponsorship, cost rates) can be changed and are
      checked; everything updates at once. "Reset" restores the example values.
      Saved in the browser.
- [ ] Calculations in rules/finance-rules.js; the page in finance/.

## The model

Revenue = tickets sold × price + sponsorship + vendor pitch fees.
Costs = artist fees + stages × days × stage cost + venue/permits/insurance + marketing
+ (security, toilet cabins, first aiders, water points from the festival size) × days × rate
+ ticketing fee (% of ticket sales).
Break-even tickets = (costs without ticketing fees − sponsorship − pitch fees) ÷ (price × (1 − fee %)).

## Out of scope

- VAT and taxes, cash flow over time, multiple ticket types
- Sharing assumptions between computers (saved locally in the browser)

## Done when

1. `uvx --from nodejs-wheel node --test` passes all tests.
2. With the example assumptions, 5,000 visitors, 2 days, 2 stages, €9,000 artists and
   €2,400 pitch fees: revenue €152,400, costs €80,700, profit €71,700 (47 %),
   break-even 1,844 tickets or €17.
3. Scenarios for that case: €21,825 (50 %), €71,700 (plan), €104,950 (sold out).
4. A ticket price of €12 shows a loss, red scenario bars going down and a break-even
   above the expected visitors.
5. An invalid entry (e.g. 150 % sold) is refused with a message and the old value stays.
6. Hovering the price chart shows the profit at that price.
7. After reloading the page the assumptions are still there.
