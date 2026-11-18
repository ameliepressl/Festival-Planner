// Checks for the financial overview (rules/finance-rules.js), see feature-plans/financial-overview.md.
// Run with:  uvx --from nodejs-wheel node --test
// The expected numbers were worked out by hand from the default assumptions.

const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_FINANCE, validFinanceValue, parseFinance, artistSpending, financeModel, scenarios, priceCurve } = require('../rules/finance-rules.js');
const { capacityNeeds } = require('../rules/capacity-rules.js');

// A 2-day festival with 2 stages for 5,000 visitors, €9,000 of artists and €2,400 of pitch fees.
const input = {
  settings: { ...DEFAULT_FINANCE }, visitors: 5000, days: 2, stages: 2,
  needs: capacityNeeds(5000), artistFees: 9000, pitchIncome: 2400
};

test('revenue: 4,000 tickets at €35, sponsorship and pitch fees', () => {
  const m = financeModel(input);
  assert.equal(m.ticketsSold, 4000); // 80 % of 5,000
  assert.equal(m.revenue.find((r) => r.id === 'tickets').amount, 140000);
  assert.equal(m.totalRevenue, 140000 + 10000 + 2400);
});

test('costs: every line follows the festival size, the days and the stages', () => {
  const m = financeModel(input);
  const cost = (id) => m.costs.find((c) => c.id === id).amount;
  assert.equal(cost('artists'), 9000);
  assert.equal(cost('stages'), 2 * 2 * 6000);
  assert.equal(cost('security'), 20 * 2 * 160);
  assert.equal(cost('toilets'), 50 * 2 * 90);
  assert.equal(cost('firstAid'), 10 * 2 * 140);
  assert.equal(cost('water'), 5 * 2 * 250);
  assert.equal(cost('ticketing'), 7000); // 5 % of €140,000
  assert.equal(m.totalCosts, 80700);
});

test('profit, margin and cost per visitor', () => {
  const m = financeModel(input);
  assert.equal(m.profit, 152400 - 80700);
  assert.equal(m.margin, 47);         // 71,700 / 152,400
  assert.equal(m.costPerVisitor, 20); // 80,700 / 4,000
});

test('break-even: 1,844 tickets or a ticket price of €17', () => {
  const m = financeModel(input);
  assert.equal(m.breakEvenTickets, 1844);
  assert.equal(m.breakEvenReachable, true);
  assert.equal(m.breakEvenPrice, 17);
  // Check it the other way round: at €17 the festival makes a profit, at €16 it does not.
  const curve = priceCurve(input, 16, 17, 1);
  assert.ok(curve[0].profit < 0);
  assert.ok(curve[1].profit >= 0);
});

test('break-even is reported as out of reach when even a sell-out would not cover the costs', () => {
  const m = financeModel({ ...input, settings: { ...input.settings, ticketPrice: 5, sponsorship: 0 } });
  assert.ok(m.breakEvenTickets > 5000);
  assert.equal(m.breakEvenReachable, false);
  assert.ok(m.profit < 0);
});

test('free tickets: no break-even ticket number, no division by zero', () => {
  const m = financeModel({ ...input, settings: { ...input.settings, ticketPrice: 0 } });
  assert.equal(m.breakEvenTickets, null);
  assert.equal(m.breakEvenReachable, false);
});

test('scenarios: bad weather (50 %), the plan and a sell-out', () => {
  const [bad, plan, good] = scenarios(input);
  assert.deepEqual([bad.ticketsSold, plan.ticketsSold, good.ticketsSold], [2500, 4000, 5000]);
  assert.equal(bad.profit, 21825);
  assert.equal(plan.profit, 71700);
  assert.equal(good.profit, 104950);
});

test('a higher ticket price never lowers the profit', () => {
  const curve = priceCurve(input, 0, 100, 5);
  assert.equal(curve.length, 21);
  curve.slice(1).forEach((point, i) => assert.ok(point.profit >= curve[i].profit, `€${point.price}`));
});

test('artist spending: totals, budget use, per stage, per day and the most expensive shows', () => {
  const lineup = {
    budget: 10000,
    artists: [{ id: 'a', name: 'Naya', fee: 1800, duration: 60 }, { id: 'b', name: 'Satori', fee: 2200, duration: 75 }],
    bookings: [
      { artistId: 'a', stage: 'A', date: '2026-12-30' },
      { artistId: 'b', stage: 'B', date: '2026-12-30' },
      { artistId: 'a', stage: 'B', date: '2026-12-31' },
      { type: 'block', title: 'Changeover', stage: 'A', date: '2026-12-30', duration: 30 }
    ]
  };
  const a = artistSpending(lineup);
  assert.equal(a.total, 5800);
  assert.equal(a.performances, 3);       // the calendar block is not a performance
  assert.equal(a.budgetUsed, 58);
  assert.equal(a.averageFee, 1933);
  assert.equal(a.costPerHour, 1785);     // 5,800 for 195 minutes
  assert.deepEqual(a.byStage, { A: 1800, B: 4000 });
  assert.deepEqual(a.byDay, { '2026-12-30': 4000, '2026-12-31': 1800 });
  assert.equal(a.top[0].name, 'Satori');
});

test('an empty lineup gives zeros, not errors', () => {
  const a = artistSpending({ budget: 10000, artists: [], bookings: [] });
  assert.deepEqual([a.total, a.performances, a.averageFee, a.costPerHour, a.budgetUsed], [0, 0, 0, 0, 0]);
});

test('artist spending uses the agreed booking fee and duration when present', () => {
  const lineup = {
    budget: 1000,
    artists: [{ id: 'a', name: 'Naya', fee: 300, duration: 60 }],
    bookings: [
      { artistId: 'a', stage: 'A', date: '2026-12-30', fee: 100, duration: 30 },
      { artistId: 'a', stage: 'A', date: '2026-12-30', fee: 0, duration: 30 },
      { artistId: 'a', stage: 'B', date: '2026-12-31' },
      { type: 'block', linkedTo: 'a', stage: 'A', date: '2026-12-30', duration: 90 }
    ]
  };
  const spending = artistSpending(lineup);
  assert.equal(spending.total, 400);
  assert.equal(spending.costPerHour, 200);
  assert.deepEqual(spending.byStage, { A: 100, B: 300 });
});

test('assumptions are checked and survive reopening the page; broken data gives the defaults', () => {
  assert.ok(validFinanceValue('ticketPrice', 40));
  assert.ok(!validFinanceValue('ticketPrice', -1));
  assert.ok(!validFinanceValue('sellThrough', 120));
  assert.ok(!validFinanceValue('ticketPrice', ''));
  assert.ok(!validFinanceValue('unknown', 1));
  assert.equal(parseFinance(JSON.stringify({ ticketPrice: 42 })).ticketPrice, 42);
  assert.deepEqual(parseFinance('not json'), DEFAULT_FINANCE);
  assert.equal(parseFinance(JSON.stringify({ ticketPrice: 'free' })).ticketPrice, DEFAULT_FINANCE.ticketPrice);
});
