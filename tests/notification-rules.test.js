// Checks for notifications (rules/notification-rules.js), see feature-plans/notifications.md.
// Run with:  uvx --from nodejs-wheel node --test

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  NOTIFICATION_SEEN_PREFIX, notificationSeenKey, emptySeen, parseSeen, daysUntilDue, myAssignedSteps,
  notificationsFor, markAllRead, notificationBadge, notificationText
} = require('../rules/notification-rules.js');
const { assignablePeople, isSyncedKey } = {
  ...require('../rules/task-rules.js'),
  ...require('../rules/account-rules.js')
};

const AMELIE = '11111111-1111-4111-8111-111111111111';
const KIRA = '22222222-2222-4222-8222-222222222222';
const VICKY = '33333333-3333-4333-8333-333333333333';
const LEFT = '44444444-4444-4444-8444-444444444444';
const FESTIVAL = '55555555-5555-4555-8555-555555555555';
const TODAY = '2027-03-10';

const people = assignablePeople({
  owner: { userId: AMELIE, username: 'Amelie' },
  me: { userId: KIRA, username: 'Kira' },
  members: [{ userId: KIRA, username: 'Kira', role: 'Editor' }, { userId: VICKY, username: 'Vicky', role: 'Viewer' }]
});

const step = (id, end, status = 'planned', taskId = '1.1') => ({ id, taskId, title: `Task ${id}`, end, status });
const steps = [
  step('1.1.1', '2027-04-30'),               // mine through the group, later than 7 days
  step('1.1.2', '2027-03-12'),               // mine, due in 2 days
  step('1.1.3', '2027-03-08', 'overdue'),    // mine, 2 days overdue
  step('1.1.4', '2027-03-11', 'done'),       // mine, already done
  step('2.1.1', '2027-03-11', 'planned', '2.1'), // Vicky's
  step('2.1.2', '2027-03-11', 'planned', '2.1')  // nobody's
];
const assignments = { groups: { '1.1': KIRA, '2.1': VICKY }, steps: { '2.1.2': '' } };
const base = { steps, assignments, people, myUserId: KIRA, today: TODAY };
const kinds = (result) => result.items.map((item) => [item.stepId, item.kind, item.unread]);

test('the read state stays in this browser: its key is never saved into the shared festival', () => {
  const key = notificationSeenKey(FESTIVAL, KIRA);
  assert.equal(key, `${NOTIFICATION_SEEN_PREFIX}:${FESTIVAL}:${KIRA}`);
  assert.equal(key.startsWith('festival-'), false);
  assert.equal(isSyncedKey(key), false);
});

test('no read-state key without a festival and a person', () => {
  assert.equal(notificationSeenKey(null, KIRA), null);
  assert.equal(notificationSeenKey(FESTIVAL, ''), null);
  assert.equal(notificationSeenKey('a:b', KIRA), null);
  assert.equal(notificationSeenKey(FESTIVAL, 'x'.repeat(101)), null);
});

test('saved read state is read back, and broken entries are dropped', () => {
  assert.deepEqual(parseSeen(JSON.stringify({ assigned: ['1.1.1', '1.1.1', 7, '', 'x'.repeat(101)], readOn: TODAY })),
    { assigned: ['1.1.1'], readOn: TODAY });
  assert.deepEqual(parseSeen(JSON.stringify({ assigned: 'x', readOn: 'yesterday' })), emptySeen());
  assert.deepEqual(parseSeen('not json'), emptySeen());
  assert.deepEqual(parseSeen(null), emptySeen());
  assert.deepEqual(parseSeen('[1]'), emptySeen());
});

test('days until a due date; no due date means no deadline', () => {
  assert.equal(daysUntilDue('2027-03-12', TODAY), 2);
  assert.equal(daysUntilDue('2027-03-10', TODAY), 0);
  assert.equal(daysUntilDue('2027-03-08', TODAY), -2);
  assert.equal(daysUntilDue('', TODAY), null);
  assert.equal(daysUntilDue(undefined, TODAY), null);
  assert.equal(daysUntilDue('12.03.2027', TODAY), null);
});

test('only my subtasks count, through the group or the subtask itself', () => {
  assert.deepEqual(myAssignedSteps(base).map((s) => s.id), ['1.1.1', '1.1.2', '1.1.3', '1.1.4']);
  const ownStep = { ...assignments, steps: { '2.1.1': KIRA, '1.1.4': VICKY } };
  assert.deepEqual(myAssignedSteps({ ...base, assignments: ownStep }).map((s) => s.id), ['1.1.1', '1.1.2', '1.1.3', '2.1.1']);
});

test('nothing for someone who is no longer on the team, or without an account', () => {
  assert.deepEqual(myAssignedSteps({ ...base, myUserId: LEFT, assignments: { groups: { '1.1': LEFT }, steps: {} } }), []);
  assert.deepEqual(notificationsFor({ ...base, myUserId: null }), { items: [], unread: 0 });
  assert.deepEqual(notificationsFor({ ...base, people: [] }), { items: [], unread: 0 });
});

test('first visit: overdue first, then due soon, then new; done and other people\'s tasks never notify', () => {
  const result = notificationsFor(base);
  assert.deepEqual(kinds(result), [
    ['1.1.3', 'overdue', true],
    ['1.1.2', 'dueSoon', true],
    ['1.1.1', 'new', true]
  ]);
  assert.equal(result.unread, 3);
});

test('after "Mark all as read" nothing is unread, but deadlines stay listed', () => {
  const seen = markAllRead(base);
  assert.deepEqual(seen, { assigned: ['1.1.1', '1.1.2', '1.1.3', '1.1.4'], readOn: TODAY });
  const result = notificationsFor({ ...base, seen });
  assert.deepEqual(kinds(result), [['1.1.3', 'overdue', false], ['1.1.2', 'dueSoon', false]]);
  assert.equal(result.unread, 0);
});

test('deadlines come back as unread the next day, while seen assignments do not', () => {
  const seen = markAllRead(base);
  const result = notificationsFor({ ...base, seen, today: '2027-03-11' });
  assert.deepEqual(kinds(result), [['1.1.3', 'overdue', true], ['1.1.2', 'dueSoon', true]]);
});

test('a task assigned after reading shows up as new; one taken away disappears', () => {
  const seen = markAllRead(base);
  const later = { groups: { '1.1': KIRA, '2.1': VICKY }, steps: { '2.1.2': KIRA, '1.1.1': VICKY } };
  const result = notificationsFor({ ...base, seen, assignments: later });
  // 2.1.2 is due tomorrow, 1.1.2 the day after: the sooner deadline comes first.
  assert.deepEqual(kinds(result), [['1.1.3', 'overdue', false], ['2.1.2', 'dueSoon', true], ['1.1.2', 'dueSoon', false]]);
  assert.equal(result.unread, 1);
});

test('a task without a due date can be new, but is never due soon or overdue', () => {
  const undated = [step('3.1.1', '', 'planned', '3.1')];
  const own = { groups: { '3.1': KIRA }, steps: {} };
  const result = notificationsFor({ ...base, steps: undated, assignments: own });
  assert.deepEqual(kinds(result), [['3.1.1', 'new', true]]);
  assert.deepEqual(notificationsFor({ ...base, steps: undated, assignments: own, seen: markAllRead({ ...base, steps: undated, assignments: own }) }).items, []);
});

test('a task due in exactly 7 days is due soon; 8 days is not', () => {
  const two = [step('4.1.1', '2027-03-17', 'planned', '4.1'), step('4.1.2', '2027-03-18', 'planned', '4.1')];
  const own = { groups: { '4.1': KIRA }, steps: {} };
  const seen = { assigned: ['4.1.1', '4.1.2'], readOn: null };
  assert.deepEqual(kinds(notificationsFor({ ...base, steps: two, assignments: own, seen })), [['4.1.1', 'dueSoon', true]]);
});

test('the bell counter: hidden at 0, at most 9+', () => {
  assert.equal(notificationBadge(0), '');
  assert.equal(notificationBadge(-1), '');
  assert.equal(notificationBadge(NaN), '');
  assert.equal(notificationBadge(1), '1');
  assert.equal(notificationBadge(9), '9');
  assert.equal(notificationBadge(10), '9+');
});

test('notification sentences, including singular and plural', () => {
  const text = (kind, days) => notificationText({ kind, days, title: 'Book security' });
  assert.equal(text('overdue', -1), '“Book security” is 1 day overdue');
  assert.equal(text('overdue', -3), '“Book security” is 3 days overdue');
  assert.equal(text('dueSoon', 0), '“Book security” is due today');
  assert.equal(text('dueSoon', 1), '“Book security” is due tomorrow');
  assert.equal(text('dueSoon', 5), '“Book security” is due in 5 days');
  assert.equal(text('new', null), 'You were assigned “Book security”');
});
