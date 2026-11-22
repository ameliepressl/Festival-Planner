const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('Node retains the original lineup regression export object after extraction', () => {
  const publicExports = require('../rules/festival-rules.js');
  const compatibility = require('../rules/legacy-lineup-compatibility.js');
  assert.equal(publicExports, compatibility);
  assert.equal(publicExports.validation(publicExports.emptyState(), {
    id: 'test', artistId: 'naya', stage: 'A', start: 960
  }), '');
});

test('the browser loads modern lineup rules without requiring the archived contract', () => {
  let requested = false;
  const context = vm.createContext({ require() { requested = true; throw new Error('Browser must not load Node compatibility'); } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../rules/festival-rules.js'), 'utf8'), context);
  assert.equal(requested, false);
  const plan = vm.runInContext('normalizePlan(null)', context);
  assert.equal(plan.settings.stages, 2);
  assert.equal(plan.bookings.length, 0);
  assert.equal(plan.artists[0].id, 'example');
  assert.equal(vm.runInContext('typeof bookingProblem', context), 'function');
});
