// Checks for the cash-flow plan (cashFlow in rules/finance-rules.js), see feature-plans/finance-pro.md.
// Run with:  uvx --from nodejs-wheel node --test
// The expected balances were worked out by hand from the default assumptions and the timing in CASH_TIMING:
//   −6: early bird 11,200 − fee 560 − venue 12,000                                  = −1,360
//   −5: early bird 11,200 − fee 560 + sponsor 5,000 − marketing 1,600              → 12,680
//   −4: early bird 11,200 − fee 560 − artist deposit 4,500 − marketing 1,600       → 17,220
//   −3: regular 28,000 − fee 1,400 − marketing 1,600                               → 42,220
//   −2: regular 28,000 − fee 1,400 + pitches 2,400 − stage deposit 7,200 − mkt 1,600 → 62,420
//   −1: regular 28,000 − fee 1,400 − marketing 1,600                               → 87,420
//   festival: box office 16,100 + bars 96,000 + sponsor 5,000 − fee 805 − artists 4,500 − stages 16,800
//             − security 6,400 − first aid 2,800 − reserve 7,370 − bar stock 48,000 → 117,845
//   after: toilets 9,000 + water 2,500                                             → 106,345 (= the profit)

const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_FINANCE, financeModel, cashFlow, splitByWeight, CASH_MONTHS } = require('../rules/finance-rules.js');
const { capacityNeeds } = require('../rules/capacity-rules.js');

// The same festival as in the other finance tests: 5,000 visitors, 2 days, 2 stages, €9,000 artists, €2,400 pitch fees.
const input = {
  settings: { ...DEFAULT_FINANCE }, visitors: 5000, days: 2, stages: 2,
  needs: capacityNeeds(5000), artistFees: 9000, pitchIncome: 2400
};
const plan = (settings) => {
  const s = { ...input.settings, ...settings };
  return cashFlow(financeModel({ ...input, settings: s }), s.ticketingFee);
};

test('cash flow: the account balance month by month, from 6 months before to the month after', () => {
  const c = plan({});
  assert.equal(c.months.length, CASH_MONTHS.length);
  assert.deepEqual(c.months.map((m) => m.balance), [-1360, 12680, 17220, 42220, 62420, 87420, 117845, 106345]);
  assert.deepEqual(c.months[6].inflow, 117100);
  assert.deepEqual(c.months[6].outflow, 86675);
});

test('the venue is due before the ticket money: €1,360 starting money needed 6 months before', () => {
  const c = plan({});
  assert.equal(c.lowestBalance, -1360);
  assert.equal(c.lowestMonth, '6 months before');
  assert.equal(c.cashNeeded, 1360);
  assert.equal(c.highestBalance, 117845);
  assert.equal(c.highestMonth, 'Festival month');
});

test('no starting money needed when the account never goes below zero', () => {
  const c = plan({ venue: 0 });
  assert.ok(c.months.every((m) => m.balance >= 0));
  assert.equal(c.cashNeeded, 0);
});

test('the final balance always equals the profit, also with a loss', () => {
  [{}, { ticketPrice: 12, barSpend: 2 }, { earlyBirdShare: 0, doorShare: 0 }, { sellThrough: 0 }, { ticketingFee: 7.5 }].forEach((settings) => {
    const s = { ...input.settings, ...settings };
    const model = financeModel({ ...input, settings: s });
    assert.equal(cashFlow(model, s.ticketingFee).finalBalance, model.profit, JSON.stringify(settings));
  });
});

test('every line of the profit and loss model is paid in full, spread over its months', () => {
  const model = financeModel(input);
  const c = cashFlow(model, input.settings.ticketingFee);
  const total = (id) => c.rows.find((r) => r.id === id).amounts.reduce((sum, v) => sum + v, 0);
  [...model.revenue.filter((r) => r.id !== 'tickets'), ...model.costs].forEach((line) => assert.equal(total(line.id), line.amount, line.id));
  model.tiers.forEach((t) => assert.equal(total(`tickets-${t.id}`), t.revenue, t.id));
  assert.deepEqual(c.rows.find((r) => r.id === 'ticketing').amounts, [560, 560, 560, 1400, 1400, 1400, 805, 0]);
});

test('a loss-making plan needs much more starting money', () => {
  const c = plan({ ticketPrice: 12, barSpend: 2 });
  assert.ok(c.finalBalance < 0);
  assert.ok(c.cashNeeded > 1360);
  assert.equal(c.cashNeeded, -c.lowestBalance);
});

test('splitting by weight uses whole euros and always adds up exactly', () => {
  assert.deepEqual(splitByWeight(8001, [[-5, 1], [-4, 1], [-3, 1], [-2, 1], [-1, 1]]).map(([, v]) => v), [1600, 1600, 1600, 1600, 1601]);
  assert.deepEqual(splitByWeight(24000, [[-2, 3], [0, 7]]), [[-2, 7200], [0, 16800]]);
  assert.deepEqual(splitByWeight(100, [[-6, 1], [-5, 1], [-4, 1]]).map(([, v]) => v), [33, 33, 34]);
});
