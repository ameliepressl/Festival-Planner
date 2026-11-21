const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { applyFestivalData, collectFestivalData } = require('../rules/account-rules.js');
const {
  projectToday, suggestedProject, removeProjectEntry, cleanProjectTracking
} = require('../rules/project-rules.js');

const template = [
  { id: '1', title: 'Planning', tasks: [{ id: 'concept', title: 'Define festival', subtasks: [
    { id: 'early', title: 'Confirm venue', start: -84, end: -70 },
    { id: 'late', title: 'Final briefing', start: -7, end: -1 }
  ] }] },
  { id: '13', title: 'Wrap up', tasks: [{ id: 'cleanup', title: 'Clean the site', subtasks: [
    { id: 'clear', title: 'Clear site', start: 0, end: 2 }
  ] }] }
];

test('a new date picker starts on the current Lisbon date, including summer timezone boundaries', () => {
  assert.equal(projectToday(new Date('2027-04-03T12:00:00Z')), '2027-04-03');
  assert.equal(projectToday(new Date('2027-04-02T23:30:00Z')), '2027-04-03');
  assert.equal(projectToday(new Date('2028-02-29T00:30:00Z')), '2028-02-29');
});

test('a year-away festival gets future suggested deadlines and wrap-up follows its last day', () => {
  const original = JSON.stringify(template);
  const plan = suggestedProject(template, { startDate: '2028-04-03', endDate: '2028-04-06' }, '2027-04-03');
  assert.equal(plan[0].tasks[0].subtasks[0].start, '2027-12-25');
  assert.equal(plan[0].tasks[0].subtasks[1].end, '2028-04-02');
  assert.equal(plan[1].tasks[0].subtasks[0].start, '2028-04-07');
  assert.equal(plan[1].tasks[0].subtasks[0].end, '2028-04-09');
  assert.equal(JSON.stringify(template), original);
});

test('late planning compresses preparation without creating already-overdue deadlines or invalid ranges', () => {
  for (const opening of ['2027-04-03', '2027-04-04', '2027-04-10']) {
    const plan = suggestedProject(template, { startDate: opening, endDate: opening }, '2027-04-03');
    for (const step of plan[0].tasks[0].subtasks) {
      assert.ok(step.start >= '2027-04-03', step.title);
      assert.ok(step.end >= step.start);
      assert.ok(step.end <= opening);
    }
  }
});

test('persisted planning start makes a short schedule stable on subsequent reloads', () => {
  const setup = JSON.parse(JSON.stringify({ planningStart: '2027-04-03' }));
  const event = { startDate: '2027-04-13', endDate: '2027-04-14' };
  const first = suggestedProject(template, event, setup.planningStart);
  const reopened = suggestedProject(template, event, setup.planningStart);
  assert.deepEqual(reopened, first);
  assert.notDeepEqual(suggestedProject(template, event, '2027-04-08'), first);
});

test('removing a suggested or custom task preserves the others and deletes its last empty group', () => {
  const plan = suggestedProject(template, { startDate: '2028-04-03', endDate: '2028-04-06' }, '2027-04-03');
  plan[0].tasks.push({ id: 'custom-group', title: 'My group', subtasks: [{ id: 'custom-step', title: 'My task', start: '2028-04-01', end: '2028-04-02' }] });
  const first = removeProjectEntry(plan, { stepId: 'early' });
  assert.deepEqual(first[0].tasks[0].subtasks.map(step => step.id), ['late']);
  assert.equal(plan[0].tasks[0].subtasks.length, 2, 'saved input remains intact before commit');
  const second = removeProjectEntry(first, { stepId: 'late' });
  assert.deepEqual(second[0].tasks.map(group => group.id), ['custom-group']);
  const third = removeProjectEntry(second, { stepId: 'custom-step' });
  assert.deepEqual(third[0].tasks, []);
  assert.equal(third[1].tasks[0].id, 'cleanup');
  assert.throws(() => removeProjectEntry(third, { stepId: 'missing' }), /no longer exists/);
});

test('deleting a group removes its progress and owners without marking anything completed', () => {
  const plan = removeProjectEntry(template, { taskId: 'concept' });
  const tracked = cleanProjectTracking(plan,
    { early: 'progress', late: { status: 'done', completedBy: 'someone' }, clear: 'planned' },
    { groups: { concept: 'person', cleanup: 'other' }, steps: { early: 'person', clear: 'other' } });
  assert.deepEqual(tracked, { statuses: { clear: 'planned' }, assignments: { groups: { cleanup: 'other' }, steps: { clear: 'other' } } });
});

test('normalising a saved festival retains its chosen dates, artists and completed-plan status', () => {
  const context = vm.createContext({ Date, Intl, console });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../rules/festival-rules.js'), 'utf8'), context);
  const output = JSON.parse(vm.runInContext(`JSON.stringify(normalizePlan({
    event:{startDate:'2026-10-15',endDate:'2026-10-16'}, final:true,
    artists:[{id:'mine',name:'My Artist',genre:'Jazz',duration:60,fee:50}], bookings:[]
  }))`, context));
  assert.equal(output.event.startDate, '2026-10-15');
  assert.equal(output.event.endDate, '2026-10-16');
  assert.equal(output.final, true);
  assert.equal(output.artists[0].id, 'mine');
  const fresh = JSON.parse(vm.runInContext('JSON.stringify(normalizePlan(null))', context));
  assert.equal(fresh.event.startDate, projectToday());
  assert.equal(fresh.event.endDate, new Date(Date.parse(projectToday() + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10));
  assert.deepEqual(fresh.bookings, []);
});

test('starting with an explicitly empty account removes previous task dates, progress and owners; importing preserves them', () => {
  const old = {
    'festival-gantt-project-v1': JSON.stringify(template),
    'festival-gantt-date-anchor': '2026-10-15',
    'festival-gantt-end-date-anchor': '2026-10-16',
    'festival-project-setup-v1': '{"templateVersion":1,"planningStart":"2026-07-01"}',
    'festival-work-board-status-v1': '{"early":"done"}',
    'festival-task-assignments-v1': '{"groups":{"concept":"someone"},"steps":{}}',
    'unrelated-preference': 'keep me'
  };
  const values = new Map(Object.entries(old));
  const storage = {
    get length() { return values.size; }, key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
  applyFestivalData(storage, {});
  assert.deepEqual(collectFestivalData(storage), {});
  assert.equal(storage.getItem('unrelated-preference'), 'keep me');
  const imported = Object.fromEntries(Object.entries(old).filter(([key]) => key.startsWith('festival-')));
  applyFestivalData(storage, imported);
  assert.deepEqual(collectFestivalData(storage), imported);
});
