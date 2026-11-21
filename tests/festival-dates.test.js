// Review follow-up for PR #24: only a brand-new plan starts from today's date.
// A saved plan without dates (older plans, backups) keeps the fixed default dates, so its dates
// do not move every day and its bookings stay on their days.
// Run with:  uvx --from nodejs-wheel node --test

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({ Date, Intl, console });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../rules/festival-rules.js'), 'utf8'), context);
const run = (code) => JSON.parse(vm.runInContext(`JSON.stringify(${code})`, context));

test('a saved plan without dates keeps the fixed default dates and its bookings', () => {
  const output = run(`normalizePlan({ bookings: [{ artistId: 'naya', stage: 'A', date: '2027-03-21', start: 900 }] })`);
  const defaults = run('DEFAULT_EVENT');
  assert.equal(output.event.startDate, defaults.startDate);
  assert.equal(output.event.endDate, defaults.endDate);
  assert.equal(output.bookings.length, 1);
  assert.equal(output.bookings[0].date, '2027-03-21');
});

test('a brand-new plan (nothing saved) starts today and ends tomorrow', () => {
  const fresh = run('normalizePlan(null).event');
  const today = run('freshFestivalEvent()');
  assert.equal(fresh.startDate, today.startDate);
  assert.equal(fresh.endDate, today.endDate);
});
