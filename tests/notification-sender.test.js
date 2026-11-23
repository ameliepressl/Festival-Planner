// Who handed out a task, and how notifications name that person
// (rules/task-rules.js → withAssigners, assignerOf; rules/notification-rules.js).
// See feature-plans/notifications.md → "Who assigned the task".
// Run with:  uvx --from nodejs-wheel node --test

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  emptyAssignments, parseAssignments, assignablePeople, withGroupAssignee, withStepAssignee, withAssigners, assignerOf
} = require('../rules/task-rules.js');
const { notificationsFor, notificationText, notificationSource } = require('../rules/notification-rules.js');
const { screen } = require('./helpers/screen-harness.cjs');

const AMELIE = '11111111-1111-4111-8111-111111111111';
const KIRA = '22222222-2222-4222-8222-222222222222';
const VICKY = '33333333-3333-4333-8333-333333333333';
const LEFT = '44444444-4444-4444-8444-444444444444';

const people = assignablePeople({
  owner: { userId: AMELIE, username: 'Amelie' },
  me: { userId: KIRA, username: 'Kira' },
  members: [{ userId: KIRA, username: 'Kira', role: 'Editor' }, { userId: VICKY, username: 'Vicky', role: 'Admin' }]
});
const step = (id, taskId, end = '2027-04-30') => ({ id, taskId, title: `Task ${id}`, end, status: 'planned' });

test('a new assignment is recorded as given by the person who saves it', () => {
  const next = withGroupAssignee(emptyAssignments(), '1.1', KIRA);
  const saved = withAssigners(emptyAssignments(), next, AMELIE);
  assert.deepEqual(saved, { groups: { '1.1': KIRA }, steps: {}, assignedBy: { groups: { '1.1': AMELIE }, steps: {} } });
  assert.equal(assignerOf(step('1.1.1', '1.1'), saved), AMELIE);
});

test('an unchanged assignment keeps who gave it, even when someone else saves later', () => {
  const first = withAssigners(emptyAssignments(), withGroupAssignee(emptyAssignments(), '1.1', KIRA), AMELIE);
  const second = withAssigners(first, withGroupAssignee(first, '2.1', KIRA), VICKY);
  assert.deepEqual(second.assignedBy, { groups: { '1.1': AMELIE, '2.1': VICKY }, steps: {} });
});

test('a reassigned task records the new giver; a task taken away has no record', () => {
  const first = withAssigners(emptyAssignments(), withGroupAssignee(emptyAssignments(), '1.1', KIRA), AMELIE);
  const moved = withAssigners(first, withGroupAssignee(first, '1.1', VICKY), VICKY);
  assert.deepEqual(moved.assignedBy.groups, { '1.1': VICKY });
  const removed = withAssigners(moved, withGroupAssignee(moved, '1.1', ''), AMELIE);
  assert.equal(removed.assignedBy, undefined);
});

test('a subtask of its own names its own giver; "nobody" is never recorded', () => {
  const group = withAssigners(emptyAssignments(), withGroupAssignee(emptyAssignments(), '1.1', AMELIE), AMELIE);
  const own = withAssigners(group, withStepAssignee(group, step('1.1.2', '1.1'), KIRA, people), VICKY);
  assert.equal(assignerOf(step('1.1.2', '1.1'), own), VICKY);
  assert.equal(assignerOf(step('1.1.1', '1.1'), own), AMELIE);
  const nobody = withAssigners(own, withStepAssignee(own, step('1.1.3', '1.1'), '', people), VICKY);
  assert.equal(nobody.steps['1.1.3'], '');
  assert.equal(nobody.assignedBy.steps['1.1.3'], undefined);
});

test('without a known person (no account) nothing is recorded', () => {
  const saved = withAssigners(emptyAssignments(), withGroupAssignee(emptyAssignments(), '1.1', KIRA), undefined);
  assert.deepEqual(saved, { groups: { '1.1': KIRA }, steps: {} });
});

test('the giver is saved and read back with the assignments; broken or stray records are dropped', () => {
  const saved = withAssigners(emptyAssignments(), withGroupAssignee(emptyAssignments(), '1.1', KIRA), AMELIE);
  assert.deepEqual(parseAssignments(JSON.stringify(saved)), saved);
  const text = JSON.stringify({
    groups: { '1.1': KIRA },
    steps: {},
    assignedBy: { groups: { '1.1': 'not-a-user', '9.9': AMELIE }, steps: [] }
  });
  assert.deepEqual(parseAssignments(text), { groups: { '1.1': KIRA }, steps: {} });
  assert.deepEqual(parseAssignments(JSON.stringify({ groups: {}, steps: {}, assignedBy: 'x' })), emptyAssignments());
});

test('older assignments without a giver still work', () => {
  const old = { groups: { '1.1': KIRA }, steps: {} };
  assert.equal(assignerOf(step('1.1.1', '1.1'), old), null);
});

test('notifications name who gave the task', () => {
  const assignments = withAssigners(emptyAssignments(), { groups: { '1.1': KIRA, '2.1': KIRA, '3.1': KIRA }, steps: {} }, AMELIE);
  assignments.assignedBy.groups['2.1'] = KIRA;     // Kira gave it to herself
  assignments.assignedBy.groups['3.1'] = LEFT;     // someone who has left the team
  const steps = [step('1.1.1', '1.1'), step('2.1.1', '2.1'), step('3.1.1', '3.1'), step('4.1.1', '1.1', '2027-03-12')];
  const { items } = notificationsFor({ steps, assignments, people, myUserId: KIRA, today: '2027-03-10' });
  const byId = Object.fromEntries(items.map((item) => [item.stepId, item]));
  assert.equal(notificationText(byId['1.1.1']), 'Amelie assigned you “Task 1.1.1”');
  assert.equal(notificationText(byId['2.1.1']), 'You assigned yourself “Task 2.1.1”');
  assert.equal(notificationText(byId['3.1.1']), 'You were assigned “Task 3.1.1”');
  assert.equal(notificationText(byId['4.1.1']), '“Task 4.1.1” is due in 2 days');
  assert.equal(notificationSource(byId['4.1.1']), 'From Amelie');
  assert.equal(notificationSource(byId['1.1.1']), '', 'the sentence already names the person');
  assert.equal(notificationSource({ kind: 'overdue', from: { name: 'Kira', isMe: true } }), 'Assigned by you');
  assert.equal(notificationSource({ kind: 'overdue', from: null }), '');
});

test('the page shows the giver as text', () => {
  const s = screen('Editor');
  const made = [];
  const createElement = s.context.document.createElement;
  s.context.document.createElement = (...args) => { const item = createElement(...args); made.push(item); return item; };
  s.context.document.addEventListener = () => {};
  Object.assign(s.context.window, {
    currentFestivalId: () => '55555555-5555-4555-8555-555555555555',
    whenAccountReady: (callback) => callback(),
    getProjectTaskSnapshot: () => ({ today: '2027-03-10', steps: [step('1.1.1', '1.1', '2027-03-12'), step('2.1.1', '2.1')] })
  });
  s.load('rules/task-rules.js');
  s.load('rules/notification-rules.js');
  s.run(`window.taskAssignments = {
    myUserId: () => '${KIRA}',
    people: () => assignablePeople({ owner: { userId: '${AMELIE}', username: 'Amelie' },
      members: [{ userId: '${KIRA}', username: 'Kira', role: 'Editor' }] }),
    read: () => ({ groups: { '1.1': '${KIRA}', '2.1': '${KIRA}' }, steps: {},
      assignedBy: { groups: { '1.1': '${AMELIE}', '2.1': '${AMELIE}' }, steps: {} } })
  };`);
  s.load('notifications.js');
  const texts = made.filter((item) => item.className === 'notification-text').map((item) => item.textContent);
  const metas = made.filter((item) => item.className === 'notification-meta').map((item) => item.textContent);
  assert.deepEqual(texts, ['“Task 1.1.1” is due in 2 days', 'Amelie assigned you “Task 2.1.1”']);
  assert.equal(metas[0], 'Due Fri 12 Mar · From Amelie');
  assert.equal(made.some((item) => item.innerHTML !== ''), false);
});
