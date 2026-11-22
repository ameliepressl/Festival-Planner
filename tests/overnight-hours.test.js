const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function run(code) {
  const context = vm.createContext({console, Date, Intl});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../rules/festival-rules.js'), 'utf8'), context);
  return vm.runInContext(code, context);
}
test('overnight closing and booking times stay on the selected festival day', () => {
  assert.equal(run("closingMinutes('03:00', 1080)"), 1620);
  assert.equal(run("festivalDayMinutes('01:30', {start:1080,end:1620})"), 1530);
  assert.equal(run("validHours({start:1080,end:1620})"), true);
  assert.equal(run("timeText(1620)"), '03:00');
  assert.equal(run("Number.isNaN(closingMinutes('03:99',1080))"), true);
  assert.equal(run("validHours({start:1080,end:1080})"), false);
});
test('overnight performance fits, conflicts and survives backup validation', () => {
  assert.equal(run(`
    let state = normalizePlan(null);
    state.event = {...state.event, startMinutes:1080, endMinutes:1620};
    const b = {id:'night', artistId:state.artists[0].id, date:state.event.startDate,
      stage:'A', start:1530, duration:60, fee:0, status:'tentative', changeover:0, notes:''};
    const valid = bookingProblem(b, null, state);
    if (valid) throw new Error(valid);
    state.bookings.push(b);
    if (planProblems(state).length) throw new Error(planProblems(state).join(';'));
    const restored = parsePlanBackup(JSON.stringify(makePlanBackup(state)));
    if (restored.bookings[0].date !== state.event.startDate || restored.bookings[0].start !== 1530) throw new Error('Lost overnight booking');
    bookingProblem({...b,id:'clash'}, null, state) ? '' : 'Missing conflict';
  `), '');
});
