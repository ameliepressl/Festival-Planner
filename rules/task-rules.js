// Who a subtask belongs to, the "Assigned to" filter and the team progress numbers.
// See feature-plans/task-assignments.md. No screen code here.
//
// Saved as festival-task-assignments-v1:
//   { groups: { taskId: userId }, steps: { subtaskId: userId or '' } }
// A subtask listed in `steps` has its own person ('' = nobody); every other subtask belongs to
// the person of its task group. Someone who is no longer on the team counts as nobody.

const TASK_ASSIGNMENTS_KEY = 'festival-task-assignments-v1';
const TASK_USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TASK_ID_MAX = 100;

function emptyAssignments() {
  return { groups: {}, steps: {} };
}

function validTaskId(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= TASK_ID_MAX;
}

// Reads the saved text; anything broken or unknown is dropped instead of trusted.
function parseAssignments(text) {
  const result = emptyAssignments();
  let saved;
  try { saved = JSON.parse(text); } catch { return result; }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return result;
  for (const [part, allowNobody] of [['groups', false], ['steps', true]]) {
    const entries = saved[part];
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) continue;
    for (const [id, userId] of Object.entries(entries)) {
      if (!validTaskId(id) || typeof userId !== 'string') continue;
      if (TASK_USER_ID.test(userId) || (allowNobody && userId === '')) result[part][id] = userId;
    }
  }
  return result;
}

// Everyone who can be given tasks: the festival creator first, then the team, each once.
//   owner / me: { userId, username }; members: [{ userId, username, role }] from the Team table.
function assignablePeople({ owner, me, members = [] } = {}) {
  const people = [];
  const add = (person, role, isOwner) => {
    if (!person || !TASK_USER_ID.test(person.userId || '') || people.some((p) => p.userId === person.userId)) return;
    people.push({
      userId: person.userId,
      username: typeof person.username === 'string' && person.username ? person.username : 'Teammate',
      role, isOwner, isMe: Boolean(me && me.userId === person.userId)
    });
  };
  add(owner, 'Admin', true);
  (Array.isArray(members) ? members : []).forEach((member) => add(member, member?.role || 'Viewer', false));
  return people;
}

// The group's person and the subtask's own person (if it has one).
//   step: { id, taskId }. Returns { userId or null, inherited }.
function assigneeOf(step, assignments, people) {
  const onTeam = (userId) => (people ? people.some((p) => p.userId === userId) : Boolean(userId));
  const own = Object.prototype.hasOwnProperty.call(assignments.steps, step.id);
  const userId = own ? assignments.steps[step.id] : assignments.groups[step.taskId];
  return { userId: userId && onTeam(userId) ? userId : null, inherited: !own };
}

function groupAssignee(taskId, assignments, people) {
  const userId = assignments.groups[taskId];
  return userId && (!people || people.some((p) => p.userId === userId)) ? userId : null;
}

// A new assignments object where the task group belongs to userId ('' or null = nobody).
function withGroupAssignee(assignments, taskId, userId) {
  if (!validTaskId(taskId)) throw new Error('Unknown task group.');
  const next = { groups: { ...assignments.groups }, steps: { ...assignments.steps } };
  if (userId) {
    if (!TASK_USER_ID.test(userId)) throw new Error('Unknown person.');
    next.groups[taskId] = userId;
  } else {
    delete next.groups[taskId];
  }
  return next;
}

// A new assignments object where one subtask belongs to userId ('' or null = nobody).
// Picking the group's person again removes the exception, so the subtask follows its group.
function withStepAssignee(assignments, step, userId, people) {
  if (!validTaskId(step?.id)) throw new Error('Unknown subtask.');
  const wanted = userId || '';
  if (wanted && !TASK_USER_ID.test(wanted)) throw new Error('Unknown person.');
  const next = { groups: { ...assignments.groups }, steps: { ...assignments.steps } };
  if (wanted === (groupAssignee(step.taskId, assignments, people) || '')) delete next.steps[step.id];
  else next.steps[step.id] = wanted;
  return next;
}

// The board's "Assigned to" filter: '' = everyone, 'me', 'none', or a user id.
function matchesAssignee(step, filter, assignments, people, myUserId) {
  if (!filter) return true;
  const { userId } = assigneeOf(step, assignments, people);
  if (filter === 'none') return userId === null;
  if (filter === 'me') return Boolean(myUserId) && userId === myUserId;
  return userId === filter;
}

// One line per person for the Overview's Team progress, plus how many subtasks nobody has.
//   steps: [{ id, taskId, title, end, status }] with status planned / progress / overdue / done.
function teamProgress({ steps, assignments, people }) {
  const rows = people.map((person) => ({ ...person, assigned: 0, done: 0, overdue: 0, percent: 0, next: null }));
  let unassigned = 0;
  for (const step of steps) {
    const { userId } = assigneeOf(step, assignments, people);
    const row = rows.find((entry) => entry.userId === userId);
    if (!row) { unassigned++; continue; }
    row.assigned++;
    if (step.status === 'done') { row.done++; continue; }
    if (step.status === 'overdue') row.overdue++;
    if (!row.next || step.end < row.next.end) row.next = { id: step.id, title: step.title, end: step.end };
  }
  rows.forEach((row) => { row.percent = row.assigned ? Math.round((row.done / row.assigned) * 100) : 0; });
  return { people: rows, unassigned };
}

// Only the festival creator and Admins hand out tasks (the database enforces it, migrations/004).
function canAssignTasks(role) {
  return role === 'Admin';
}

if (typeof module !== 'undefined') {
  module.exports = {
    TASK_ASSIGNMENTS_KEY, emptyAssignments, parseAssignments, assignablePeople, assigneeOf, groupAssignee,
    withGroupAssignee, withStepAssignee, matchesAssignee, teamProgress, canAssignTasks
  };
}
