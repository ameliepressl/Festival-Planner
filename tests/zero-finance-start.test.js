// Fresh festivals start with no financial assumptions; saved projects and demos keep theirs.
// The screen checks run the actual page handlers against local storage doubles, never Supabase.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  FINANCE_STORAGE_KEY, FINANCE_FIELDS, DEFAULT_FINANCE, emptyFinance, withStartingFinance,
  hasFinanceValues, validFinanceValue, financeProblem, parseFinance, financeModel, cashFlow,
  scenarios, artistSpending
} = require('../rules/finance-rules.js');
const { capacityNeeds } = require('../rules/capacity-rules.js');
const { demoFestival, munichDemoFestival } = require('../rules/demo-festival.js');
const { confirmVendor, pitchIncome } = require('../rules/vendor-rules.js');
const { isSyncedKey } = require('../rules/account-rules.js');
const { screen } = require('./helpers/screen-harness.cjs');

const plain = value => JSON.parse(JSON.stringify(value));
const plan = () => ({ final: false, settings: { stages: 2, budget: 10000 }, artists: [], bookings: [],
  event: { name: 'Fresh finances', venue: 'Test venue', startDate: '2030-06-01', endDate: '2030-06-02',
    startMinutes: 840, endMinutes: 1380 } });
function input(settings = emptyFinance(), overrides = {}) {
  return { settings, visitors: 5000, days: 2, stages: 2, needs: capacityNeeds(5000),
    artistFees: 0, pitchIncome: 0, ...overrides };
}
function financeScreen(sections = withStartingFinance({}), festivalPlan = plan()) {
  const ui = screen('Admin', sections);
  for (const file of ['rules/festival-rules.js', 'rules/capacity-rules.js', 'rules/vendor-rules.js', 'rules/finance-rules.js']) ui.load(file);
  ui.run(`let state = normalizePlan(${JSON.stringify(festivalPlan)})`);
  ui.load('finance/finance-page.js');
  ui.nav.find(item => item.dataset.section === 'Finances').click();
  return ui;
}
const overview = ui => plain(ui.run('window.getOverviewFinance()'));
function edit(ui, id, value) {
  ui.node('#finance-view').fire('change', { target: { dataset: { field: id }, value: String(value), type: 'number' } });
}

test('fresh finance assumptions are valid zeros, separate from examples and from another festival', () => {
  const first = emptyFinance(), second = emptyFinance();
  for (const field of FINANCE_FIELDS) {
    assert.equal(first[field.id], 0, field.label);
    assert.ok(validFinanceValue(field.id, first[field.id]), field.label);
  }
  assert.equal(financeProblem(first), '');
  assert.deepEqual(first.extras, []);
  first.ticketPrice = 42;
  first.extras.push({ id: 'xnew', label: 'My cost', amount: 20 });
  assert.equal(second.ticketPrice, 0);
  assert.deepEqual(second.extras, []);
  assert.equal(DEFAULT_FINANCE.ticketPrice, 35, 'example assumptions remain available to demos and older saves');
  assert.deepEqual(DEFAULT_FINANCE.extras, []);
});

test('starting finance is a synced section and never overwrites supplied finance or other sections', () => {
  const original = { 'festival-architect-v2': '{"event":{"name":"Fresh"}}' };
  const created = withStartingFinance(original);
  assert.deepEqual(original, { 'festival-architect-v2': '{"event":{"name":"Fresh"}}' }, 'initialization does not alter its input');
  assert.equal(created['festival-architect-v2'], original['festival-architect-v2']);
  assert.ok(isSyncedKey(FINANCE_STORAGE_KEY));
  assert.deepEqual(parseFinance(created[FINANCE_STORAGE_KEY]), emptyFinance());
  const saved = '{ "ticketPrice": 47, "sponsorship": 12345, "extras": [] }';
  const reopened = withStartingFinance({ ...original, [FINANCE_STORAGE_KEY]: saved });
  assert.equal(reopened[FINANCE_STORAGE_KEY], saved, 'saved sections are kept exactly, without reparsing or resetting');
});

test('zero assumptions produce zero forecasts and cash flow at small and large festival sizes', () => {
  for (const visitors of [500, 5000, 20000]) {
    const source = input(emptyFinance(), { visitors, needs: capacityNeeds(visitors), stages: 3, days: 3 });
    const model = financeModel(source), cash = cashFlow(model, source.settings.ticketingFee);
    assert.equal(hasFinanceValues(source), false);
    assert.deepEqual([model.ticketsSold, model.totalRevenue, model.totalCosts, model.profit, cash.cashNeeded, cash.finalBalance], [0, 0, 0, 0, 0, 0]);
    assert.ok([...model.revenue, ...model.costs].every(line => line.amount === 0));
    assert.ok(cash.months.every(month => month.inflow === 0 && month.outflow === 0 && month.balance === 0));
    assert.ok(scenarios(source).every(row => row.ticketsSold === 0 && row.revenue === 0 && row.costs === 0 && row.profit === 0));
    assert.equal(model.revenuePerVisitor, null, 'no division by zero when no tickets are planned');
    assert.equal(model.costPerVisitor, null);
    assert.doesNotMatch(JSON.stringify({ model, cash }), /NaN|Infinity/);
  }
});

test('actual artist fees, vendor income and custom lines still affect otherwise zero finances', () => {
  const source = input(emptyFinance(), { artistFees: 600, pitchIncome: 900 });
  assert.equal(hasFinanceValues(source), true);
  const model = financeModel(source);
  assert.deepEqual([model.totalRevenue, model.totalCosts, model.profit], [900, 600, 300]);
  assert.equal(cashFlow(model, 0).finalBalance, 300);
  for (const changed of [
    input({ ...emptyFinance(), sponsorship: 10 }),
    input({ ...emptyFinance(), sellThrough: 20, goodSellThrough: 20 }),
    input({ ...emptyFinance(), extras: [{ id: 'xpermit', kind: 'cost', label: 'Permit', amount: 75, basis: 'total', timing: 'before' }] }),
    input(emptyFinance(), { artistFees: 10 }),
    input(emptyFinance(), { pitchIncome: 10 })
  ]) assert.equal(hasFinanceValues(changed), true);
});

test('both demo finance sections retain their assumptions and forecasts when creating a festival', () => {
  for (const demo of [demoFestival(), munichDemoFestival()]) {
    const saved = JSON.stringify({ ...DEFAULT_FINANCE, ...demo.finance });
    const created = withStartingFinance({ [FINANCE_STORAGE_KEY]: saved });
    assert.equal(created[FINANCE_STORAGE_KEY], saved);
    const settings = parseFinance(created[FINANCE_STORAGE_KEY]);
    const placements = demo.vendors.reduce((p, id) => confirmVendor(p, id, capacityNeeds(demo.ground.visitors).pitches).placements, {});
    const artistFees = artistSpending({ ...demo.plan, budget: demo.plan.settings.budget }).total;
    const model = financeModel(input(settings, { visitors: demo.ground.visitors, needs: capacityNeeds(demo.ground.visitors),
      stages: demo.plan.settings.stages, days: demo.plan.settings.stages === 3 ? 3 : 2, artistFees, pitchIncome: pitchIncome(placements) }));
    assert.equal(hasFinanceValues(input(settings)), true);
    assert.equal(settings.ticketPrice, demo.finance.ticketPrice);
    assert.equal(settings.sponsorship, demo.finance.sponsorship);
    assert.ok(model.totalCosts > 0);
    assert.ok(model.totalRevenue > 0);
    if (demo.plan.settings.stages === 2) assert.ok(model.profit > 0, 'Lisbon remains the profitable example');
    else assert.ok(model.profit < 0, 'Munich retains its deliberate ticket-price problem');
  }
});

test('a fresh finance page shows zero totals and explains that its forecast has not been configured', () => {
  const ui = financeScreen(), html = ui.node('#finance-view').innerHTML;
  assert.deepEqual(overview(ui), { totalRevenue: 0, totalCosts: 0, profit: 0 });
  assert.deepEqual(plain(ui.run('window.getReadinessFinance()')), { profit: 0, cashNeeded: 0 });
  for (const label of ['Profit', 'Revenue', 'Costs']) assert.match(html, new RegExp(`<span>${label}</span><strong[^>]*>€0</strong>`));
  assert.match(html, /No financial assumptions entered yet/);
  assert.doesNotMatch(html, /class="fin-matrix"|sponsors and vendors cover all fixed costs|Ticket and sponsor money always arrives/);
  assert.doesNotMatch(html, /NaN|Infinity/);
  assert.equal(ui.writes.length, 0, 'viewing finances does not save or change the new festival');
  const reopened = financeScreen(Object.fromEntries(ui.values));
  assert.deepEqual(overview(reopened), { totalRevenue: 0, totalCosts: 0, profit: 0 });
  assert.equal(reopened.values.get(FINANCE_STORAGE_KEY), ui.values.get(FINANCE_STORAGE_KEY));
});

test('example finance values are loaded only when the organiser explicitly requests them', () => {
  const ui = financeScreen();
  assert.match(ui.node('#finance-view').innerHTML, />Load example values<\/button>/);
  assert.deepEqual(JSON.parse(ui.values.get(FINANCE_STORAGE_KEY)), emptyFinance());
  ui.node('#finance-view').fire('click', { target: { closest: selector => selector === '[data-reset]' ? {} : null } });
  assert.deepEqual(JSON.parse(ui.values.get(FINANCE_STORAGE_KEY)), DEFAULT_FINANCE);
  assert.ok(overview(ui).totalRevenue > 0);
  assert.match(ui.node('#finance-view').innerHTML, /class="fin-matrix"/);
});

test('editing zero assumptions and custom costs survives a page reload with the same totals', () => {
  const ui = financeScreen();
  edit(ui, 'ticketPrice', 42);
  edit(ui, 'sellThrough', 75);
  edit(ui, 'sponsorship', 1200);
  ui.node('#finance-view').fire('click', { target: { closest: selector => selector === '[data-extra-add]' ? { dataset: { extraAdd: 'cost' } } : null } });
  const own = JSON.parse(ui.values.get(FINANCE_STORAGE_KEY)).extras[0];
  for (const [key, value] of [['label', 'Permit'], ['amount', '200']]) {
    ui.node('#finance-view').fire('change', { target: { dataset: { extra: own.id, key }, value } });
  }
  const saved = ui.values.get(FINANCE_STORAGE_KEY), expected = overview(ui);
  assert.deepEqual(expected, { totalRevenue: 158700, totalCosts: 200, profit: 158500 });
  const reopened = financeScreen(Object.fromEntries(ui.values));
  assert.equal(reopened.values.get(FINANCE_STORAGE_KEY), saved);
  assert.deepEqual(overview(reopened), expected);
  assert.deepEqual(plain(reopened.run('window.getReadinessFinance()')), plain(ui.run('window.getReadinessFinance()')));
  assert.match(reopened.node('#finance-view').innerHTML, /class="fin-matrix"/);
  const next = financeScreen();
  assert.deepEqual(overview(next), { totalRevenue: 0, totalCosts: 0, profit: 0 });
  assert.equal(ui.values.get(FINANCE_STORAGE_KEY), saved, 'the next festival leaves the previous one intact');
});

test('previously saved partial assumptions keep their older defaults and saved custom values', () => {
  const old = '{"ticketPrice":44,"sponsorship":7654}';
  const ui = financeScreen({ [FINANCE_STORAGE_KEY]: old });
  assert.equal(ui.values.get(FINANCE_STORAGE_KEY), old);
  const expected = financeModel(input(parseFinance(old)));
  assert.deepEqual(overview(ui), { totalRevenue: expected.totalRevenue, totalCosts: expected.totalCosts, profit: expected.profit });
  assert.match(ui.node('#finance-view').innerHTML, /data-field="ticketPrice" value="44"/);
  assert.match(ui.node('#finance-view').innerHTML, /data-field="sponsorship" value="7654"/);
});
