// Bugs found in the final audit (feature-plans/audit-bugfixes.md).
// Run with:  uvx --from nodejs-wheel node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { DEFAULT_FINANCE, FINANCE_STORAGE_KEY, financeModel } = require('../rules/finance-rules.js');
const { capacityNeeds } = require('../rules/capacity-rules.js');
const { screen } = require('./helpers/screen-harness.cjs');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

// The scripts of index.html, in the order the browser runs them (local files only).
function browserScripts() {
  return [...read('index.html').matchAll(/<script[^>]*\ssrc="([^"]+)"/g)]
    .map((match) => match[1].split('?')[0])
    .filter((file) => !/^https?:/.test(file));
}

test('no two browser scripts declare the same global name', () => {
  // Classic scripts share one global scope: a second `function x` silently replaces the first,
  // and a second `const x` stops the whole later script.
  const owners = new Map();
  for (const file of browserScripts()) {
    for (const match of read(file).matchAll(/^(?:async\s+)?(?:function\*?|const|let|class|var)\s+([A-Za-z_$][\w$]*)/gm)) {
      const name = match[1];
      if (!owners.has(name)) owners.set(name, []);
      owners.get(name).push(file);
    }
  }
  const clashes = [...owners].filter(([, files]) => files.length > 1).map(([name, files]) => `${name}: ${files.join(', ')}`);
  assert.deepEqual(clashes, []);
});

test('in the browser order, festival dates still refuse 30 February and 31 April', () => {
  const context = vm.createContext({ console, Date, Number, String, Array, Object, JSON, Math, Map, Set, RegExp, Intl });
  for (const file of ['rules/festival-rules.js', 'rules/task-rules.js', 'rules/notification-rules.js']) vm.runInContext(read(file), context, { filename: file });
  assert.equal(vm.runInContext("validDate('2027-07-09')", context), true);
  assert.equal(vm.runInContext("validDate('2028-02-29')", context), true, 'a real leap day');
  for (const impossible of ['2027-02-30', '2027-04-31', '2027-02-29', '2027-13-01']) {
    assert.equal(vm.runInContext(`validDate('${impossible}')`, context), false, impossible);
  }
});

test('notifications still read their saved dates after the rename', () => {
  const { parseSeen, daysUntilDue } = require('../rules/notification-rules.js');
  assert.equal(parseSeen(JSON.stringify({ assigned: [], readOn: '2027-03-10' })).readOn, '2027-03-10');
  assert.equal(parseSeen(JSON.stringify({ assigned: [], readOn: 'not a date' })).readOn, null);
  assert.equal(daysUntilDue('2027-03-12', '2027-03-10'), 2);
  assert.equal(daysUntilDue('bad', '2027-03-10'), null);
});

test('with no tickets on sale the break-even text never shows "€null"', () => {
  const settings = { ...DEFAULT_FINANCE, sellThrough: 0 };
  const model = financeModel({ settings, visitors: 5000, days: 2, stages: 2, needs: capacityNeeds(5000), artistFees: 0, pitchIncome: 0 });
  assert.equal(model.ticketsSold, 0);
  assert.equal(model.breakEvenPrice, null, 'no break-even price without tickets sold');
  assert.equal(model.breakEvenReachable, true, 'this is the case the text has to handle');

  const plan = { final: false, settings: { stages: 2, budget: 10000 }, artists: [], bookings: [],
    event: { name: 'No tickets', venue: 'Test', startDate: '2030-06-01', endDate: '2030-06-02', startMinutes: 840, endMinutes: 1380 } };
  const ui = screen('Admin', { [FINANCE_STORAGE_KEY]: JSON.stringify(settings) });
  for (const file of ['rules/festival-rules.js', 'rules/capacity-rules.js', 'rules/vendor-rules.js', 'rules/finance-rules.js']) ui.load(file);
  ui.run(`let state = normalizePlan(${JSON.stringify(plan)})`);
  ui.load('finance/finance-page.js');
  ui.nav.find((item) => item.dataset.section === 'Finances').click();
  const html = ui.node('#finance-view').innerHTML;
  assert.match(html, /of 5,000 visitors|visitors/);
  assert.doesNotMatch(html, /€null|\bNaN\b|undefined/);
});
