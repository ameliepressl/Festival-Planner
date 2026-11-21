// The second demo festival, "Munich Loud Weekend" (rules/demo-festival.js, feature-plans/demo-munich.md):
// a big hip-hop weekend with real artists from the artist library, planned to about 80 %.
// Run with:  uvx --from nodejs-wheel node --test

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { munichDemoFestival, MUNICH_DEMO_NAME, MUNICH_VISITORS, demoFestival } = require('../rules/demo-festival.js');
const { ARTIST_LIBRARY } = require('../rules/artist-library.js');
const { capacityNeeds, validVisitors } = require('../rules/capacity-rules.js');
const { confirmVendor, pitchIncome, coverage } = require('../rules/vendor-rules.js');
const { layoutItems, demoSite, checkLayout, layoutScore } = require('../rules/site-map-rules.js');
const { normalizeCrowdSafety, crowdSafetyChecks } = require('../rules/crowd-rules.js');
const { parseFinance, artistSpending, financeModel, cashFlow } = require('../rules/finance-rules.js');

function lineupRules(plan) {
  const context = vm.createContext({ console, Date, Intl, Set, Number, String, Array, JSON, Math, seedPlan: JSON.parse(JSON.stringify(plan)) });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'rules/festival-rules.js'), 'utf8'), context);
  vm.runInContext('let state = normalizePlan(seedPlan)', context);
  return (code) => JSON.parse(vm.runInContext(`JSON.stringify(${code})`, context));
}

test('the Munich demo is a three-day, three-stage festival with a name and venue', () => {
  const { plan } = munichDemoFestival();
  assert.equal(plan.event.name, MUNICH_DEMO_NAME);
  assert.ok(plan.event.venue.includes('Munich'));
  assert.equal(plan.event.startDate, '2027-07-09');
  assert.equal(plan.event.endDate, '2027-07-11');
  assert.equal(plan.settings.stages, 3);
});

test('every artist is a real artist from the library, booked once', () => {
  const { plan } = munichDemoFestival();
  const library = new Map(ARTIST_LIBRARY.map((a) => [a.id, a]));
  plan.artists.forEach((a) => {
    assert.ok(library.has(a.libraryId), a.name);
    assert.equal(a.name, library.get(a.libraryId).name);
    assert.equal(a.fee, library.get(a.libraryId).fee);
  });
  const ids = plan.bookings.map((b) => b.artistId);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(plan.bookings.length, 34);
});

test('the whole plan and every booking pass the lineup rules, within the artist budget', () => {
  const { plan } = munichDemoFestival();
  const run = lineupRules(plan);
  assert.deepEqual(run('planProblems(state)'), []);
  plan.bookings.forEach((b) => assert.equal(run(`bookingProblem(state.bookings.find(x => x.id === '${b.id}'), '${b.id}', state)`), '', b.id));
  const spending = artistSpending({ bookings: plan.bookings, artists: plan.artists, budget: plan.settings.budget });
  assert.ok(spending.total <= plan.settings.budget);
});

test('about 80 % planned: some bookings tentative, Sunday on the Rising Stage still empty, free pitches left', () => {
  const { plan, ground, vendors } = munichDemoFestival();
  const tentative = plan.bookings.filter((b) => b.status === 'tentative').length;
  assert.ok(tentative >= 3 && tentative <= 8, `${tentative} tentative`);
  assert.equal(plan.bookings.filter((b) => b.stage === 'C' && b.date === '2027-07-11').length, 0);
  const pitches = capacityNeeds(ground.visitors).pitches;
  assert.ok(vendors.length < pitches, 'some pitches stay free');
});

test('the vendors fit on the pitches of 20,000 visitors and cover the visitor needs', () => {
  const { ground, vendors } = munichDemoFestival();
  assert.equal(ground.visitors, MUNICH_VISITORS);
  assert.ok(validVisitors(ground.visitors));
  const pitches = capacityNeeds(ground.visitors).pitches;
  const placements = vendors.reduce((p, id) => {
    const result = confirmVendor(p, id, pitches);
    assert.equal(result.problem, null, id);
    return result.placements;
  }, {});
  assert.equal(Object.keys(placements).length, vendors.length);
  assert.deepEqual(coverage(placements).missing, []);
});

test('the site map can be planned for this size, the finance values are all valid and show a profit', () => {
  const demo = munichDemoFestival();
  const items = layoutItems(capacityNeeds(demo.ground.visitors));
  const site = demoSite(items);
  assert.equal(layoutScore(checkLayout(site, site.placements, items)), 100);
  const settings = parseFinance(JSON.stringify(demo.finance));
  Object.entries(demo.finance).forEach(([key, value]) => assert.equal(settings[key], value, key));
  const placements = demo.vendors.reduce((p, id) => confirmVendor(p, id, 20).placements, {});
  const fees = artistSpending({ bookings: demo.plan.bookings, artists: demo.plan.artists, budget: demo.plan.settings.budget }).total;
  const model = financeModel({ settings, visitors: demo.ground.visitors, days: 3, stages: 3, needs: capacityNeeds(demo.ground.visitors), artistFees: fees, pitchIncome: pitchIncome(placements) });
  assert.ok(model.profit > 0);
  // Still open for the team: the cash before ticket money arrives.
  assert.ok(cashFlow(model, settings.ticketingFee).cashNeeded > 0);
});

test('the stage crowd densities are measured and within the limit; the exit widths are still open', () => {
  const demo = munichDemoFestival();
  const site = demoSite(layoutItems(capacityNeeds(demo.ground.visitors)));
  site.crowdSafety = normalizeCrowdSafety(demo.crowdSafety);
  const checks = crowdSafetyChecks(site, demo.ground.visitors).checks;
  ['density-stage-a', 'density-stage-b'].forEach((id) => assert.equal(checks.find((c) => c.id === id).ok, true, id));
  assert.equal(checks.find((c) => c.id === 'emergency-exits-available').ok, false);
});

test('every call gives a fresh copy, and the Lisbon demo is unchanged', () => {
  const first = munichDemoFestival();
  first.plan.bookings.pop();
  assert.equal(munichDemoFestival().plan.bookings.length, 34);
  assert.equal(demoFestival().plan.event.name, 'Lisbon Sound Festival');
});
