// Checks for the finance extras (ticket tiers, festival bars, contingency reserve, secure vs planned
// artist fees, profit matrix), see feature-plans/finance-pro.md.
// Run with:  uvx --from nodejs-wheel node --test
// The expected numbers were worked out by hand from the default assumptions:
// tiers 30 % early bird at −20 %, 10 % box office at +15 %; bars €12 per visitor per day at 50 % margin;
// contingency 10 % of the fixed costs.

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_FINANCE, parseFinance, financeProblem, ticketTiers, averagePriceFactor, financeModel, profitMatrix, artistSpending
} = require('../rules/finance-rules.js');
const { capacityNeeds } = require('../rules/capacity-rules.js');

// The same festival as in finance-rules.test.js: 5,000 visitors, 2 days, 2 stages, €9,000 artists, €2,400 pitch fees.
const input = {
  settings: { ...DEFAULT_FINANCE }, visitors: 5000, days: 2, stages: 2,
  needs: capacityNeeds(5000), artistFees: 9000, pitchIncome: 2400
};

test('ticket tiers: 1,200 early bird at €28, 2,400 regular at €35, 400 box office at €40.25', () => {
  const tiers = ticketTiers(DEFAULT_FINANCE, 4000);
  assert.deepEqual(tiers.map((t) => [t.id, t.tickets, t.price, t.revenue]), [
    ['early', 1200, 28, 33600],
    ['regular', 2400, 35, 84000],
    ['door', 400, 40.25, 16100]
  ]);
  assert.equal(averagePriceFactor(DEFAULT_FINANCE), 0.955);
});

test('the tiers always add up to exactly the tickets sold, also when rounding', () => {
  [0, 1, 7, 333, 4001].forEach((sold) => {
    assert.equal(ticketTiers(DEFAULT_FINANCE, sold).reduce((sum, t) => sum + t.tickets, 0), sold, `${sold}`);
  });
  const allEarly = ticketTiers({ ...DEFAULT_FINANCE, earlyBirdShare: 100, doorShare: 0 }, 10);
  assert.deepEqual(allEarly.map((t) => t.tickets), [10, 0, 0]);
});

test('bars, reserve and ticketing fees appear as their own lines', () => {
  const m = financeModel(input);
  const revenue = (id) => m.revenue.find((r) => r.id === id).amount;
  const cost = (id) => m.costs.find((c) => c.id === id).amount;
  assert.equal(revenue('tickets'), 133700);
  assert.equal(revenue('bar'), 96000);         // 4,000 visitors × 2 days × €12
  assert.equal(cost('barStock'), 48000);       // the 50 % that is not margin
  assert.equal(m.fixedCosts, 73700);
  assert.equal(cost('contingency'), 7370);     // 10 % of the fixed costs
  assert.equal(cost('ticketing'), 6685);       // 5 % of €133,700
});

test('totals, profit, margin and per-visitor figures with all extras', () => {
  const m = financeModel(input);
  assert.equal(m.totalRevenue, 242100);
  assert.equal(m.totalCosts, 135755);
  assert.equal(m.profit, 106345);
  assert.equal(m.margin, 44);
  assert.equal(m.averageTicketPrice, 33.43);
  assert.equal(m.revenuePerVisitor, 61);       // 242,100 / 4,000
  assert.equal(m.costPerVisitor, 34);          // 135,755 / 4,000
  assert.equal(m.profitPerVisitor, 27);        // 106,345 / 4,000
});

test('break-even with bars: 1,570 tickets, regular price €6, safety margin 61 %', () => {
  const m = financeModel(input);
  assert.equal(m.breakEvenTickets, 1570);
  assert.equal(m.breakEvenPrice, 6);
  assert.equal(m.safetyMargin, 61);            // (4,000 − 1,570) / 4,000
  // Check it the other way round: with 1,570 tickets sold there is a profit, with 1,569 a loss.
  const sold = (tickets) => financeModel({ ...input, visitors: tickets, settings: { ...input.settings, sellThrough: 100 } }).profit;
  assert.ok(sold(1570) >= 0);
  assert.ok(sold(1569) < 0);
});

test('when the bars alone cover the gap, the break-even ticket price is €0', () => {
  const m = financeModel({ ...input, settings: { ...input.settings, barSpend: 40 } });
  assert.equal(m.breakEvenPrice, 0);
  assert.ok(m.breakEvenTickets > 0);
});

test('early bird and box office together cannot be more than 100 %', () => {
  assert.equal(financeProblem(DEFAULT_FINANCE), '');
  assert.match(financeProblem({ ...DEFAULT_FINANCE, earlyBirdShare: 60, doorShare: 50 }), /100 %/);
  const repaired = parseFinance(JSON.stringify({ earlyBirdShare: 70, doorShare: 40, ticketPrice: 50 }));
  assert.deepEqual([repaired.earlyBirdShare, repaired.doorShare, repaired.ticketPrice], [30, 10, 50]);
});

test('profit matrix: every cell is the model for that price and share of tickets sold', () => {
  const matrix = profitMatrix(input, [25, 35], [50, 80, 100]);
  assert.equal(matrix.length, 2);
  assert.equal(matrix[1].cells[1].profit, 106345); // €35 and 80 % = the plan
  matrix.forEach((row) => row.cells.forEach((cell) => {
    const direct = financeModel({ ...input, settings: { ...input.settings, ticketPrice: row.price, sellThrough: cell.sellThrough } }).profit;
    assert.equal(cell.profit, direct);
  }));
  // More tickets sold at the same price never lowers the profit here.
  matrix.forEach((row) => assert.ok(row.cells[0].profit <= row.cells[2].profit));
});

test('secure vs planned artist fees: confirmed bookings are secure, the rest is tentative', () => {
  const a = artistSpending({
    budget: 10000,
    artists: [{ id: 'a', name: 'Naya', fee: 1800, duration: 60 }, { id: 'b', name: 'Satori', fee: 2200, duration: 75 }],
    bookings: [
      { artistId: 'a', stage: 'A', date: '2026-12-30', status: 'confirmed' },
      { artistId: 'b', stage: 'B', date: '2026-12-30', status: 'tentative' },
      { artistId: 'b', stage: 'A', date: '2026-12-31' }
    ]
  });
  assert.equal(a.confirmedFees, 1800);
  assert.equal(a.tentativeFees, 4400); // a booking without status counts as tentative
  assert.equal(a.confirmedFees + a.tentativeFees, a.total);
});
