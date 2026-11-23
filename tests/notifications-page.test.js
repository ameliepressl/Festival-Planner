// The notifications bell on the page (notifications.js), see feature-plans/notifications.md.
// Uses the small DOM doubles from tests/helpers/screen-harness.cjs; no browser or Supabase.
// Run with:  uvx --from nodejs-wheel node --test

const test = require('node:test');
const assert = require('node:assert/strict');
const { screen } = require('./helpers/screen-harness.cjs');

const ADMIN = '11111111-1111-4111-8111-111111111111';
const EDITOR = '22222222-2222-4222-8222-222222222222';
const FESTIVAL = '55555555-5555-4555-8555-555555555555';
const SNEAKY = '<img src=x onerror="alert(1)">Book security';

function page({ me = EDITOR, festivalId = FESTIVAL, onTeam = true, role = 'Editor' } = {}) {
  const s = screen(role);
  const made = [];
  const createElement = s.context.document.createElement;
  s.context.document.createElement = (...args) => { const item = createElement(...args); made.push(item); return item; };
  s.context.document.addEventListener = () => {};
  const opened = [];
  Object.assign(s.context.window, {
    currentFestivalId: () => festivalId,
    whenAccountReady: (callback) => callback(),
    openTaskBoard: (options) => opened.push(options),
    getProjectTaskSnapshot: () => ({
      today: '2027-03-10',
      steps: [
        { id: '1.1.1', taskId: '1.1', title: SNEAKY, end: '2027-03-12', status: 'planned' },
        { id: '1.1.2', taskId: '1.1', title: 'Order toilets', end: '2027-03-08', status: 'overdue' },
        { id: '1.1.3', taskId: '1.1', title: 'Print wristbands', end: '2027-05-01', status: 'planned' },
        { id: '1.1.4', taskId: '1.1', title: 'Done already', end: '2027-03-11', status: 'done' },
        { id: '2.1.1', taskId: '2.1', title: 'Somebody else', end: '2027-03-11', status: 'planned' }
      ]
    })
  });
  s.load('rules/task-rules.js');
  s.load('rules/notification-rules.js');
  s.run(`window.taskAssignments = {
    myUserId: () => ${JSON.stringify(me)},
    people: () => assignablePeople({ owner: { userId: '${ADMIN}', username: 'Amelie' },
      members: ${onTeam ? `[{ userId: '${EDITOR}', username: 'Kira', role: 'Editor' }]` : '[]'} }),
    read: () => ({ groups: { '1.1': '${EDITOR}', '2.1': '${ADMIN}' }, steps: {} })
  };`);
  s.load('notifications.js');
  const texts = () => made.filter((item) => item.className === 'notification-text').map((item) => item.textContent);
  return { ...s, made, opened, texts };
}

test('the bell stays hidden without an account or festival', () => {
  const { node } = page({ festivalId: null });
  assert.equal(node('#notifications').hidden, true);
});

test('the bell stays hidden for someone who is not on the festival team', () => {
  const { node } = page({ onTeam: false });
  assert.equal(node('#notifications').hidden, true);
});

test('an Editor with assigned tasks sees the counter; done and other people\'s tasks are left out', () => {
  const { node, texts } = page();
  assert.equal(node('#notifications').hidden, false);
  assert.equal(node('#notifications-count').textContent, '3');
  assert.equal(node('#notifications-count').hidden, false);
  assert.equal(node('#notifications-button').getAttribute('aria-label'), 'Notifications, 3 unread');
  assert.deepEqual(texts(), [
    '“Order toilets” is 2 days overdue',
    `“${SNEAKY}” is due in 2 days`,
    'You were assigned “Print wristbands”'
  ]);
});

test('task titles are shown as text, never as HTML', () => {
  const { made } = page();
  assert.equal(made.some((item) => item.innerHTML !== ''), false);
  assert.ok(made.some((item) => item.textContent.includes(SNEAKY)));
});

test('the bell opens and closes the list', () => {
  const { node } = page();
  node('#notifications-button').click();
  assert.equal(node('#notifications-panel').hidden, false);
  assert.equal(node('#notifications-button').getAttribute('aria-expanded'), 'true');
  node('#notifications-button').click();
  assert.equal(node('#notifications-panel').hidden, true);
  assert.equal(node('#notifications-button').getAttribute('aria-expanded'), 'false');
});

test('"Mark all as read" is saved only in this browser, never into the shared festival', () => {
  const { node, writes, values } = page();
  node('#notifications-read-all').click();
  assert.deepEqual(writes, [`fa-notifications-seen-v1:${FESTIVAL}:${EDITOR}`]);
  assert.equal(writes.some((key) => key.startsWith('festival-')), false);
  assert.deepEqual(JSON.parse(values.get(writes[0])), { assigned: ['1.1.1', '1.1.2', '1.1.3', '1.1.4'], readOn: '2027-03-10' });
  assert.equal(node('#notifications-count').hidden, true);
  assert.equal(node('#notifications-button').getAttribute('aria-label'), 'Notifications, none unread');
  assert.equal(node('#notifications-read-all').disabled, true);
});

test('a broken saved read state is ignored instead of breaking the page', () => {
  const s = page();
  s.values.set(`fa-notifications-seen-v1:${FESTIVAL}:${EDITOR}`, '{not json');
  s.context.window.dispatchEvent({ type: 'task-assignments-changed' });
  assert.equal(s.node('#notifications-count').textContent, '3');
});

test('clicking a notification opens Project tasks filtered to my tasks', () => {
  const { made, opened, node } = page();
  node('#notifications-button').click();
  const first = made.find((item) => item.className === 'notification-item');
  first.click();
  assert.deepEqual(JSON.parse(JSON.stringify(opened)), [{ assignee: 'me' }]);  // the object comes from the page's sandbox
  assert.equal(node('#notifications-panel').hidden, true);
});
