// Checks that the demo festival (rules/demo-festival.js) follows the real rules of every section,
// see feature-plans/ci-and-demo-festival.md.
// Run with:  uvx --from nodejs-wheel node --test

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { demoFestival, DEMO_FESTIVAL_NAME } = require('../rules/demo-festival.js');
const { capacityNeeds, validVisitors } = require('../rules/capacity-rules.js');
const { confirmVendor, pitchIncome, coverage } = require('../rules/vendor-rules.js');
const { layoutItems, demoSite, checkLayout, layoutScore } = require('../rules/site-map-rules.js');
const { parseFinance, artistSpending, financeModel } = require('../rules/finance-rules.js');

// The lineup rules are written for the browser, so they run in a small sandbox (as in lineup-enhancements.test.js).
function lineupRules(plan) {
  const context = vm.createContext({ console, Date, Intl, Set, Number, String, Array, JSON, Math, seedPlan: JSON.parse(JSON.stringify(plan)) });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'rules/festival-rules.js'), 'utf8'), context);
  vm.runInContext('let state = normalizePlan(seedPlan)', context);
  return (code) => JSON.parse(vm.runInContext(`JSON.stringify(${code})`, context));
}

test('every demo booking passes the lineup rules (opening hours, stages, no overlaps)', () => {
  const { plan } = demoFestival();
  const run = lineupRules(plan);
  assert.equal(run('state.bookings.length'), 10);
  plan.bookings.forEach((b) => assert.equal(run(`bookingProblem(state.bookings.find(x => x.id === '${b.id}'), '${b.id}', state)`), '', b.id));
});

test('each artist is booked once and the fees stay within the artist budget', () => {
  const { plan } = demoFestival();
  const ids = plan.bookings.map((b) => b.artistId);
  assert.equal(new Set(ids).size, ids.length);
  const spending = artistSpending({ bookings: plan.bookings, artists: plan.artists, budget: plan.settings.budget });
  assert.equal(spending.total, 15500);
  assert.ok(spending.total <= plan.settings.budget);
});

test('the festival has a name and venue, so the Overview does not ask to set it up', () => {
  const { plan } = demoFestival();
  assert.equal(plan.event.name, DEMO_FESTIVAL_NAME);
  assert.ok(plan.event.venue);
});

test('all 11 demo vendors fit on the pitches of a 5,000-visitor festival and cover the visitor needs', () => {
  const { ground, vendors } = demoFestival();
  assert.ok(validVisitors(ground.visitors));
  const pitches = capacityNeeds(ground.visitors).pitches; // 13
  const placements = vendors.reduce((p, id) => {
    const result = confirmVendor(p, id, pitches);
    assert.equal(result.problem, null, id);
    return result.placements;
  }, {});
  assert.equal(Object.keys(placements).length, 11);
  assert.deepEqual(coverage(placements).missing, []);
  assert.ok(pitchIncome(placements) > 0);
});

test('the demo site map is planned at 100 % for the demo festival size', () => {
  const items = layoutItems(capacityNeeds(demoFestival().ground.visitors));
  const site = demoSite(items);
  assert.equal(layoutScore(checkLayout(site, site.placements, items)), 100);
});

test('the demo finance assumptions are valid and the festival makes a profit', () => {
  const demo = demoFestival();
  const settings = parseFinance(JSON.stringify(demo.finance));
  assert.equal(settings.ticketPrice, 39);
  assert.equal(settings.sponsorship, 15000);
  const placements = demo.vendors.reduce((p, id) => confirmVendor(p, id, 13).placements, {});
  const model = financeModel({
    settings, visitors: 5000, days: 2, stages: 2, needs: capacityNeeds(5000),
    artistFees: 15500, pitchIncome: pitchIncome(placements)
  });
  assert.ok(model.profit > 0);
});

test('every call gives a fresh copy, so changing one demo never changes the next', () => {
  const first = demoFestival();
  first.plan.bookings.pop();
  first.plan.artists[0].fee = 1;
  const second = demoFestival();
  assert.equal(second.plan.bookings.length, 10);
  assert.equal(second.plan.artists[0].fee, 1800);
});
