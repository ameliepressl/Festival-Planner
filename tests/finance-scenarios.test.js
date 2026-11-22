// Ticket sales per scenario, additional assumptions and your own cost/income lines
// (feature-plans/finance-scenarios.md). Run with:  uvx --from nodejs-wheel node --test
// Base: 5,000 visitors, 80 % → 4,000 tickets at €35, 2 days, 2 stages, €9,000 artists, €2,400 pitch fees,
// without early bird, box office, bars and reserve (as in finance-rules.test.js), so the numbers are easy.

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_FINANCE, parseFinance, financeProblem, ticketTiers, averagePriceFactor, financeModel, scenarios, cashFlow,
  financeExtraProblem, parseFinanceExtras, extraTotal, MAX_FINANCE_EXTRAS
} = require('../rules/finance-rules.js');
const { capacityNeeds } = require('../rules/capacity-rules.js');

const BASE = { earlyBirdShare: 0, doorShare: 0, barSpend: 0, contingency: 0 };
const input = (changes = {}) => ({
  settings: { ...DEFAULT_FINANCE, ...BASE, ...changes }, visitors: 5000, days: 2, stages: 2,
  needs: capacityNeeds(5000), artistFees: 9000, pitchIncome: 2400
});
const base = financeModel(input());
const line = (model, id) => [...model.revenue, ...model.costs].find((l) => l.id === id);
const extra = (changes = {}) => ({ id: 'xa1', kind: 'cost', label: 'Fencing', amount: 4000, basis: 'total', timing: 'before', ...changes });

test('new assumptions start at 0: the model, tiers and lines stay exactly as before', () => {
  assert.equal(base.ticketsSold, 4000);
  assert.equal(base.totalRevenue, 140000 + 10000 + 2400);
  assert.deepEqual(base.revenue.map((r) => r.id), ['tickets', 'bar', 'sponsorship', 'pitches']);
  assert.equal(base.tiers.length, 3);
  assert.deepEqual(DEFAULT_FINANCE.extras, []);
});

// ---------- scenarios ----------

test('the organiser sets how many tickets sell in the bad and best case', () => {
  const [bad, plan, good] = scenarios(input({ badSellThrough: 30, goodSellThrough: 90 }));
  assert.deepEqual([bad.ticketsSold, plan.ticketsSold, good.ticketsSold], [1500, 4000, 4500]);
  assert.deepEqual([bad.label, plan.label, good.label], ['Bad case', 'Your plan', 'Best case']);
  assert.deepEqual([bad.field, plan.field, good.field], ['badSellThrough', 'sellThrough', 'goodSellThrough']);
  assert.equal(plan.profit, base.profit);
  assert.equal(scenarios(input())[2].label, 'Sold out', 'the default best case is a sell-out');
  // a share from a typed ticket number (e.g. 4,321 tickets = 86.4 %) is allowed
  assert.equal(scenarios(input({ goodSellThrough: 86.4 }))[2].ticketsSold, 4320);
});

test('the bad case cannot sell more than the best case; broken saved values are repaired', () => {
  assert.match(financeProblem({ ...DEFAULT_FINANCE, badSellThrough: 95, goodSellThrough: 90 }), /bad case/);
  assert.equal(financeProblem({ ...DEFAULT_FINANCE, badSellThrough: 90, goodSellThrough: 90 }), '');
  const repaired = parseFinance(JSON.stringify({ badSellThrough: 95, goodSellThrough: 90, ticketPrice: 40 }));
  assert.deepEqual([repaired.badSellThrough, repaired.goodSellThrough, repaired.ticketPrice], [50, 100, 40]);
  assert.equal(parseFinance(JSON.stringify({ badSellThrough: 120 })).badSellThrough, 50);
  assert.equal(parseFinance(JSON.stringify({ goodSellThrough: -1 })).goodSellThrough, 100);
});

// ---------- more ticket assumptions ----------

test('VIP and guest-list tickets: 400 VIP at €70, 200 free, 3,400 regular', () => {
  const s = { ...DEFAULT_FINANCE, ...BASE, vipShare: 10, vipSurcharge: 100, guestShare: 5 };
  const tiers = ticketTiers(s, 4000);
  assert.deepEqual(tiers.map((t) => [t.id, t.tickets, t.price, t.revenue]), [
    ['early', 0, 28, 0], ['regular', 3400, 35, 119000], ['door', 0, 40.25, 0], ['vip', 400, 70, 28000], ['guest', 200, 0, 0]
  ]);
  assert.equal(averagePriceFactor(s), 1.05);
  const m = financeModel(input({ vipShare: 10, vipSurcharge: 100, guestShare: 5 }));
  assert.equal(line(m, 'tickets').amount, 147000);
  assert.equal(m.averageTicketPrice, 36.75);
});

test('all ticket shares together cannot be more than 100 %', () => {
  assert.match(financeProblem({ ...DEFAULT_FINANCE, earlyBirdShare: 60, doorShare: 20, vipShare: 15, guestShare: 10 }), /100 %/);
  const repaired = parseFinance(JSON.stringify({ earlyBirdShare: 60, doorShare: 20, vipShare: 15, guestShare: 10 }));
  assert.deepEqual([repaired.earlyBirdShare, repaired.doorShare, repaired.vipShare, repaired.guestShare], [30, 10, 0, 0]);
});

test('VAT is taken out of the ticket price, the music licence is paid on the net sales', () => {
  const m = financeModel(input({ ticketVat: 7, musicLicence: 5 }));
  assert.equal(line(m, 'ticketVat').amount, 9159);   // 140,000 − 140,000 / 1.07
  assert.equal(line(m, 'licence').amount, 6542);     // 5 % of 130,841
  assert.equal(m.profit, base.profit - 9159 - 6542);
});

// ---------- other income and costs ----------

test('merch, grants, power, crew, cleaning and artist hospitality', () => {
  const m = financeModel(input({ merchSpend: 10, merchMargin: 40, grants: 5000, powerPerDay: 1000, crewPerDay: 3000, cleaningPerVisitor: 0.5, hospitality: 10 }));
  assert.equal(line(m, 'merch').amount, 40000);
  assert.equal(line(m, 'merchStock').amount, 24000);
  assert.equal(line(m, 'grants').amount, 5000);
  assert.equal(line(m, 'power').amount, 2000);
  assert.equal(line(m, 'crew').amount, 6000);
  assert.equal(line(m, 'cleaning').amount, 4000);    // €0.50 × 4,000 visitors × 2 days
  assert.equal(line(m, 'hospitality').amount, 900);  // 10 % of €9,000 artist fees
  assert.equal(m.profit, base.profit + 40000 - 24000 + 5000 - 2000 - 6000 - 4000 - 900);
  ['power', 'crew', 'hospitality'].forEach((id) => assert.equal(line(m, id).fixed, true, id));
});

test('the contingency reserve also covers the new fixed costs', () => {
  const m = financeModel(input({ contingency: 10, powerPerDay: 1000 }));
  const without = financeModel(input({ contingency: 10 }));
  assert.equal(line(m, 'contingency').amount - line(without, 'contingency').amount, 200);
});

// ---------- your own lines ----------

test('own lines: in total, per day, per visitor and per visitor per day', () => {
  assert.equal(extraTotal(extra({ basis: 'total', amount: 4000 }), 2, 4000), 4000);
  assert.equal(extraTotal(extra({ basis: 'perDay', amount: 500 }), 2, 4000), 1000);
  assert.equal(extraTotal(extra({ basis: 'perVisitor', amount: 0.4 }), 2, 4000), 1600);
  assert.equal(extraTotal(extra({ basis: 'perVisitorDay', amount: 1.25 }), 2, 4000), 10000);
  const extras = [extra(), extra({ id: 'xa2', kind: 'revenue', label: 'Camping', amount: 15, basis: 'perVisitor', timing: 'festival' }),
    extra({ id: 'xa3', label: 'Wristbands', amount: 0.4, basis: 'perVisitor' })];
  const m = financeModel(input({ extras }));
  assert.deepEqual([line(m, 'extra-xa1').amount, line(m, 'extra-xa2').amount, line(m, 'extra-xa3').amount], [4000, 60000, 1600]);
  assert.equal(line(m, 'extra-xa1').fixed, true);
  assert.equal(line(m, 'extra-xa3').fixed, false);
  assert.equal(line(m, 'extra-xa2').own, true);
  assert.equal(m.profit, base.profit - 4000 + 60000 - 1600);
});

test('break-even includes VAT, licences, merch, per-visitor costs and own lines', () => {
  const settings = { ticketVat: 7, musicLicence: 5, merchSpend: 8, cleaningPerVisitor: 0.5, powerPerDay: 2000,
    extras: [extra({ amount: 20000 }), extra({ id: 'xa2', kind: 'revenue', label: 'Camping', amount: 5, basis: 'perVisitor' }),
      extra({ id: 'xa3', label: 'Wristbands', amount: 0.4, basis: 'perVisitor' })] };
  const m = financeModel(input(settings));
  assert.ok(m.breakEvenTickets > 0 && m.breakEvenTickets < 4000, `${m.breakEvenTickets}`);
  const at = (tickets) => financeModel(input({ ...settings, sellThrough: (tickets / 5000) * 100 })).profit;
  assert.ok(at(m.breakEvenTickets) >= -5, `profit at break-even ${at(m.breakEvenTickets)}`);
  assert.ok(at(m.breakEvenTickets - 10) < 0);
  const price = financeModel(input({ ...settings, ticketPrice: m.breakEvenPrice })).profit;
  assert.ok(price >= -5, `profit at the break-even price ${price}`);
  assert.ok(financeModel(input({ ...settings, ticketPrice: m.breakEvenPrice - 1 })).profit < 0);
});

test('the cash-flow plan pays every new line in its month and still ends at the profit', () => {
  const settings = { vipShare: 10, guestShare: 5, ticketVat: 7, musicLicence: 5, merchSpend: 10, grants: 5000, powerPerDay: 1000,
    crewPerDay: 500, cleaningPerVisitor: 0.5, hospitality: 10,
    extras: [extra(), extra({ id: 'xa2', kind: 'revenue', label: 'Camping', amount: 15, basis: 'perVisitor', timing: 'festival' }),
      extra({ id: 'xa3', label: 'Clean-up crew', amount: 3000, basis: 'total', timing: 'after' })] };
  const m = financeModel({ ...input(settings), settings: { ...DEFAULT_FINANCE, ...settings } });
  const cf = cashFlow(m, DEFAULT_FINANCE.ticketingFee);
  const total = (id) => cf.rows.find((r) => r.id === id).amounts.reduce((a, b) => a + b, 0);
  [...m.revenue.filter((r) => r.id !== 'tickets'), ...m.costs].forEach((l) => assert.equal(total(l.id), l.amount, l.id));
  assert.equal(cf.finalBalance, m.profit);
  const months = (id) => cf.rows.find((r) => r.id === id).amounts.map((v, i) => (v ? i : null)).filter((i) => i !== null);
  assert.deepEqual(months('extra-xa1'), [3, 4, 5], 'before the festival = 3, 2 and 1 months before');
  assert.deepEqual(months('extra-xa3'), [7], 'after the festival');
});

test('own lines are checked: name, type, amount, basis and timing', () => {
  assert.equal(financeExtraProblem(extra()), '');
  assert.match(financeExtraProblem(extra({ label: 'X' })), /name/);
  assert.match(financeExtraProblem(extra({ label: 'x'.repeat(61) })), /name/);
  assert.match(financeExtraProblem(extra({ kind: 'gift' })), /cost or income/);
  assert.match(financeExtraProblem(extra({ amount: -1 })), /amount/);
  assert.match(financeExtraProblem(extra({ amount: '' })), /amount/);
  assert.match(financeExtraProblem(extra({ amount: 5000001 })), /amount/);
  assert.match(financeExtraProblem(extra({ amount: 1.234 })), /two decimals/);
  assert.match(financeExtraProblem(extra({ basis: 'perWeek' })), /per/);
  assert.match(financeExtraProblem(extra({ timing: 'never' })), /when/);
  assert.match(financeExtraProblem(null), /name/);
});

test('saved own lines are read back; broken, doubled, tampered or too many lines are dropped', () => {
  const good = extra();
  const saved = parseFinance(JSON.stringify({ extras: [good, good, extra({ id: 'xa2', amount: -5 }), extra({ id: '<b>', label: 'Bad id' }), null] }));
  assert.deepEqual(saved.extras, [good]);
  assert.deepEqual(parseFinance(JSON.stringify({ extras: 'nope' })).extras, []);
  const many = Array.from({ length: MAX_FINANCE_EXTRAS + 5 }, (_, i) => extra({ id: `x${i}`, label: `Line ${i}` }));
  assert.equal(parseFinanceExtras(many).length, MAX_FINANCE_EXTRAS);
  assert.deepEqual(parseFinance('[1,2]'), DEFAULT_FINANCE);
});
