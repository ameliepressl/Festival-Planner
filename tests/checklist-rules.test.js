// Checks for the crew checklist (rules/checklist-rules.js), see feature-plans/crew-checklist.md.
// Run with:  uvx --from nodejs-wheel node --test

const test = require('node:test');
const assert = require('node:assert/strict');
const { CHECKLIST, allTaskIds, parseChecked, toggleTask, progress, progressOf } = require('../rules/checklist-rules.js');

test('every team has at least one task, and every task id is unique', () => {
  CHECKLIST.forEach((group) => assert.ok(group.tasks.length > 0, group.title));
  const ids = allTaskIds();
  assert.equal(new Set(ids).size, ids.length);
});

test('the checklist covers the teams a festival needs', () => {
  const titles = CHECKLIST.map((group) => group.title);
  ['Security', 'Stage building', 'Sound', 'Lighting', 'Backstage & catering', 'First aid & safety']
    .forEach((title) => assert.ok(titles.includes(title), title));
});

test('nothing ticked means 0 %', () => {
  assert.deepEqual(progress([]), { done: 0, total: allTaskIds().length, percent: 0 });
});

test('everything ticked means 100 %', () => {
  assert.equal(progress(allTaskIds()).percent, 100);
});

test('the percentage follows the ticked tasks and is a whole number', () => {
  const ids = allTaskIds();
  const half = ids.slice(0, Math.floor(ids.length / 2));
  const result = progress(half);
  assert.equal(result.done, half.length);
  assert.equal(result.percent, Math.round((half.length / ids.length) * 100));
  assert.ok(Number.isInteger(result.percent));
});

test('ticking twice unticks the task again', () => {
  const once = toggleTask([], 'sound-pa');
  assert.deepEqual(once, ['sound-pa']);
  assert.deepEqual(toggleTask(once, 'sound-pa'), []);
});

test('progress per team counts only that team', () => {
  const checked = ['sound-pa', 'sound-checks', 'security-plan'];
  assert.deepEqual(progressOf('sound', checked), { done: 2, total: 6 });
  assert.deepEqual(progressOf('security', checked), { done: 1, total: 6 });
  assert.deepEqual(progressOf('lighting', checked), { done: 0, total: 5 });
});

test('ticked tasks survive reopening the page', () => {
  const checked = toggleTask(toggleTask([], 'medical-team'), 'permits-event');
  const reopened = parseChecked(JSON.stringify(checked)); // what the page saves and reads back
  assert.deepEqual(reopened, checked);
  assert.equal(progress(reopened).done, 2);
});

test('unknown or broken saved data is ignored', () => {
  assert.equal(progress(['not-a-task']).done, 0);
  assert.deepEqual(parseChecked(null), []);
  assert.deepEqual(parseChecked('not json'), []);
  assert.deepEqual(parseChecked('{"a":1}'), []);
});
