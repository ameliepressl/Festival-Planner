const test = require('node:test');
const assert = require('node:assert/strict');
const { buildReadiness, readinessIssueTasks } = require('../rules/readiness-rules.js');

function readyInput() {
  return {
    event: { name: 'Spring Festival', startDate: '2027-04-03', endDate: '2027-04-04' },
    lineup: { performances: 2, unconfirmed: 0, spent: 10000, budget: 10000, problems: [] },
    mapChecks: [
      { id: 'layout', label: 'Layout checked', ok: true, detail: 'Facilities placed.' },
      { id: 'density', label: 'Crowd measurements checked', ok: true, detail: 'Audience area entered.' },
      { id: 'exit', label: 'Exit measurements checked', ok: true, detail: 'Exit widths entered.' }
    ],
    finance: { profit: 0, cashNeeded: 0 }
  };
}

test('missing readiness inputs remain unresolved and cannot produce a passing score', () => {
  const result = buildReadiness();
  assert.equal(result.score, 0);
  assert.equal(result.passed, 0);
  assert.equal(result.issues.length, result.total);
  assert.equal(result.checks.every(check => check.unknown && !check.ok), true);
  assert.doesNotThrow(() => buildReadiness(null));
});

test('readiness reaches 100 only when all supplied checks pass, including exact budget and break-even', () => {
  const input = readyInput();
  const before = structuredClone(input);
  const result = buildReadiness(input);
  assert.equal(result.score, 100);
  assert.equal(result.passed, result.total);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(input, before, 'calculating readiness never changes the saved inputs');
});

test('budget overrun, booking confirmation and cash-flow problems remain separate source issues', () => {
  const input = readyInput();
  input.lineup.spent = 10001;
  input.lineup.unconfirmed = 1;
  input.finance.profit = -1;
  input.finance.cashNeeded = 2000;
  const result = buildReadiness(input);
  assert.deepEqual(result.issues.map(issue => issue.id), [
    'lineup-budget', 'lineup-confirmed', 'finance-profit', 'finance-cash'
  ]);
  assert.equal(result.score, Math.round(result.passed / result.total * 100));
  assert.equal(result.issues.every(issue => !issue.unknown), true);
});

test('invalid calendar dates and a closing date before opening do not pass setup', () => {
  for (const dates of [
    { startDate: '2027-02-30', endDate: '2027-03-03' },
    { startDate: '2027-04-04', endDate: '2027-04-03' },
    { startDate: '2027-4-3', endDate: '2027-04-04' }
  ]) {
    const input = readyInput();
    Object.assign(input.event, dates);
    assert.equal(buildReadiness(input).checks.find(check => check.id === 'event-dates').ok, false);
  }
  const leap = readyInput();
  leap.event.startDate = leap.event.endDate = '2028-02-29';
  assert.equal(buildReadiness(leap).checks.find(check => check.id === 'event-dates').ok, true);
});

test('an empty lineup does not pass scheduling or confirmation simply because there are no errors', () => {
  const input = readyInput();
  input.lineup.performances = 0;
  assert.deepEqual(buildReadiness(input).issues.map(issue => issue.id), [
    'lineup-performances', 'lineup-schedule', 'lineup-confirmed'
  ]);
});

test('invalid numbers and missing assessments never turn into passing checks', () => {
  const input = readyInput();
  input.lineup.budget = '10000';
  input.lineup.unconfirmed = -1;
  input.lineup.problems = null;
  input.finance.profit = NaN;
  input.finance.cashNeeded = Infinity;
  input.mapChecks = [];
  const result = buildReadiness(input);
  for (const id of ['lineup-budget', 'lineup-confirmed', 'lineup-schedule', 'finance-profit', 'finance-cash', 'map-assessment']) {
    const check = result.checks.find(check => check.id === id);
    assert.equal(check.ok, false, id);
    assert.equal(check.unknown, true, id);
  }
});

test('map measurements and duplicate source ids cannot hide an unresolved map issue', () => {
  const input = readyInput();
  input.mapChecks.push(
    { id: 'density', label: 'Density', ok: false, detail: 'Crowd area is missing.' },
    { id: 'unmeasured', label: 'Unmeasured exit', ok: true, unknown: true },
    { id: 'assessment', label: 'Layout assessment', ok: true },
    { label: 'A map rule without a source id', ok: true }
  );
  const result = buildReadiness(input);
  assert.equal(result.checks.filter(check => check.id === 'map-density').length, 1);
  assert.equal(result.issues.some(check => check.id === 'map-density'), true);
  assert.equal(result.issues.some(check => check.id === 'map-unmeasured' && check.unknown), true);
  assert.equal(result.issues.some(check => check.id === 'map-assessment'), true);
  assert.equal(result.checks.length, new Set(result.checks.map(check => check.id)).size);
});

test('source issue ids stay stable as details change and fixing a source removes its derived task', () => {
  const input = readyInput();
  input.lineup.problems = ['Stage A overlaps.'];
  const original = readinessIssueTasks(buildReadiness(input));
  input.lineup.problems = ['Stage B overlaps.', 'An entry ends after closing.'];
  const changed = readinessIssueTasks(buildReadiness(input));
  assert.equal(original.length, 1);
  assert.equal(changed.length, 1);
  assert.equal(original[0].id, changed[0].id);
  assert.equal(changed[0].sourceId, 'lineup-schedule');
  assert.equal(changed[0].section, 'Lineup planner');
  assert.equal(changed[0].generated, true);
  input.lineup.problems = [];
  assert.deepEqual(readinessIssueTasks(buildReadiness(input)), []);
  assert.equal(readinessIssueTasks({ issues: [...changed.map(task => ({ id: task.sourceId })), { id: 'lineup-schedule' }] }).length, 1);
});

test('a failed check prevents 100 percent even with enough passing map checks to round up', () => {
  const input = readyInput();
  input.lineup.unconfirmed = 1;
  input.mapChecks = Array.from({ length: 200 }, (_, i) => ({ id: String(i), ok: true }));
  const result = buildReadiness(input);
  assert.equal(result.score, 99);
  assert.equal(result.issues.length, 1);
});
