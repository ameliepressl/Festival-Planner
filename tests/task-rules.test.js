// Checks for task assignments and team progress (rules/task-rules.js),
// see feature-plans/task-assignments.md.
// Run with:  uvx --from nodejs-wheel node --test

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TASK_ASSIGNMENTS_KEY, emptyAssignments, parseAssignments, assignablePeople, assigneeOf, groupAssignee,
  withGroupAssignee, withStepAssignee, matchesAssignee, teamProgress, canAssignTasks
} = require('../rules/task-rules.js');

const AMELIE = '11111111-1111-4111-8111-111111111111';
const KIRA = '22222222-2222-4222-8222-222222222222';
const VICKY = '33333333-3333-4333-8333-333333333333';
const LEFT = '44444444-4444-4444-8444-444444444444';

const people = assignablePeople({
  owner: { userId: AMELIE, username: 'Amelie' },
  me: { userId: KIRA, username: 'Kira' },
  members: [{ userId: KIRA, username: 'Kira', role: 'Editor' }, { userId: VICKY, username: 'Vicky', role: 'Viewer' }]
});

test('the assignments are saved with the plan (the key starts with festival-)', () => {
  assert.equal(TASK_ASSIGNMENTS_KEY.startsWith('festival-'), true);
});

test('saved assignments are read back, and broken or unknown entries are dropped', () => {
  const text = JSON.stringify({
    groups: { '1.1': AMELIE, '1.2': 'not-a-user', '1.3': '' },
    steps: { '1.1.2': KIRA, '1.1.3': '', '1.1.4': 7 },
    extra: { anything: true }
  });
  assert.deepEqual(parseAssignments(text), { groups: { '1.1': AMELIE }, steps: { '1.1.2': KIRA, '1.1.3': '' } });
  assert.deepEqual(parseAssignments('not json'), emptyAssignments());
  assert.deepEqual(parseAssignments(null), emptyAssignments());
  assert.deepEqual(parseAssignments('[1,2]'), emptyAssignments());
  assert.deepEqual(parseAssignments(JSON.stringify({ groups: [AMELIE], steps: 'x' })), emptyAssignments());
});

test('everyone on the team can be given tasks: the creator first, each person once', () => {
  assert.deepEqual(people.map((p) => [p.username, p.role, p.isOwner, p.isMe]), [
    ['Amelie', 'Admin', true, false],
    ['Kira', 'Editor', false, true],
    ['Vicky', 'Viewer', false, false]
  ]);
  assert.deepEqual(assignablePeople({ owner: { userId: AMELIE, username: 'Amelie' }, members: [{ userId: AMELIE, username: 'Amelie', role: 'Admin' }] })
    .map((p) => p.username), ['Amelie'], 'the creator is not listed twice');
  assert.deepEqual(assignablePeople({ owner: { userId: 'nobody', username: 'x' } }), [], 'only real accounts');
  assert.deepEqual(assignablePeople(), []);
});

test('a subtask belongs to its group\'s person unless it has its own', () => {
  const assignments = { groups: { '1.1': AMELIE }, steps: { '1.1.2': KIRA, '1.1.3': '' } };
  assert.deepEqual(assigneeOf({ id: '1.1.1', taskId: '1.1' }, assignments, people), { userId: AMELIE, inherited: true });
  assert.deepEqual(assigneeOf({ id: '1.1.2', taskId: '1.1' }, assignments, people), { userId: KIRA, inherited: false });
  assert.deepEqual(assigneeOf({ id: '1.1.3', taskId: '1.1' }, assignments, people), { userId: null, inherited: false }, 'nobody on purpose');
  assert.deepEqual(assigneeOf({ id: '2.1.1', taskId: '2.1' }, assignments, people), { userId: null, inherited: true });
});

test('someone who left the team counts as nobody', () => {
  const assignments = { groups: { '1.1': LEFT }, steps: { '2.1.1': LEFT } };
  assert.equal(assigneeOf({ id: '1.1.1', taskId: '1.1' }, assignments, people).userId, null);
  assert.equal(assigneeOf({ id: '2.1.1', taskId: '2.1' }, assignments, people).userId, null);
  assert.equal(groupAssignee('1.1', assignments, people), null);
});

test('giving a task group to a person, and to nobody again', () => {
  const start = emptyAssignments();
  const given = withGroupAssignee(start, '1.1', KIRA);
  assert.deepEqual(given.groups, { '1.1': KIRA });
  assert.deepEqual(start, emptyAssignments(), 'the old object is not changed');
  assert.deepEqual(withGroupAssignee(given, '1.1', '').groups, {});
  assert.throws(() => withGroupAssignee(start, '1.1', 'Kira'), /Unknown person/);
  assert.throws(() => withGroupAssignee(start, '', KIRA), /Unknown task group/);
});

test('one subtask can go to someone else; picking the group\'s person again removes the exception', () => {
  const group = withGroupAssignee(emptyAssignments(), '1.1', AMELIE);
  const step = { id: '1.1.2', taskId: '1.1' };
  const other = withStepAssignee(group, step, KIRA, people);
  assert.deepEqual(other.steps, { '1.1.2': KIRA });
  const nobody = withStepAssignee(other, step, '', people);
  assert.deepEqual(nobody.steps, { '1.1.2': '' }, 'nobody, although the group has a person');
  assert.deepEqual(withStepAssignee(nobody, step, AMELIE, people).steps, {}, 'follows the group again');
  assert.deepEqual(withStepAssignee(emptyAssignments(), step, '', people).steps, {}, 'group has nobody either: no exception needed');
  assert.throws(() => withStepAssignee(group, step, 'Kira', people), /Unknown person/);
});

test('the "Assigned to" filter on the board', () => {
  const assignments = { groups: { '1.1': AMELIE }, steps: { '1.1.2': KIRA } };
  const steps = [{ id: '1.1.1', taskId: '1.1' }, { id: '1.1.2', taskId: '1.1' }, { id: '2.1.1', taskId: '2.1' }];
  const shown = (filter, me = KIRA) => steps.filter((s) => matchesAssignee(s, filter, assignments, people, me)).map((s) => s.id);
  assert.deepEqual(shown(''), ['1.1.1', '1.1.2', '2.1.1']);
  assert.deepEqual(shown('me'), ['1.1.2']);
  assert.deepEqual(shown('me', null), [], 'not signed in: no "my tasks"');
  assert.deepEqual(shown('none'), ['2.1.1']);
  assert.deepEqual(shown(AMELIE), ['1.1.1']);
});

test('team progress: assigned, done in %, overdue and the next deadline per person', () => {
  const assignments = { groups: { '1.1': AMELIE, '1.2': KIRA }, steps: { '1.1.3': KIRA, '1.2.2': LEFT } };
  const steps = [
    { id: '1.1.1', taskId: '1.1', title: 'Agree concept', end: '2026-10-08', status: 'done' },
    { id: '1.1.2', taskId: '1.1', title: 'Confirm dates', end: '2026-10-10', status: 'overdue' },
    { id: '1.1.3', taskId: '1.1', title: 'Define scope', end: '2026-12-01', status: 'progress' },
    { id: '1.2.1', taskId: '1.2', title: 'Assign team', end: '2026-11-25', status: 'planned' },
    { id: '1.2.2', taskId: '1.2', title: 'Milestones', end: '2026-11-20', status: 'planned' },
    { id: '2.1.1', taskId: '2.1', title: 'Estimate income', end: '2026-11-21', status: 'done' }
  ];
  const { people: rows, unassigned } = teamProgress({ steps, assignments, people });
  const amelie = rows.find((r) => r.username === 'Amelie');
  const kira = rows.find((r) => r.username === 'Kira');
  const vicky = rows.find((r) => r.username === 'Vicky');
  assert.deepEqual([amelie.assigned, amelie.done, amelie.percent, amelie.overdue, amelie.next.title], [2, 1, 50, 1, 'Confirm dates']);
  assert.deepEqual([kira.assigned, kira.done, kira.percent, kira.overdue, kira.next.end], [2, 0, 0, 0, '2026-11-25']);
  assert.deepEqual([vicky.assigned, vicky.percent, vicky.next], [0, 0, null]);
  assert.equal(unassigned, 2, 'the subtask of someone who left and the unassigned group');
  assert.equal(kira.isMe, true);
});

test('only the festival creator and Admins hand out tasks', () => {
  assert.equal(canAssignTasks('Admin'), true);
  assert.equal(canAssignTasks('Editor'), false);
  assert.equal(canAssignTasks('Viewer'), false);
  assert.equal(canAssignTasks(undefined), false);
});
