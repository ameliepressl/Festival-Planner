// Who a subtask belongs to, the "Assigned to" filter and the team progress numbers.
// See feature-plans/task-assignments.md. No screen code here.
//
// Saved as festival-task-assignments-v1:
//   { groups: { taskId: userId }, steps: { subtaskId: userId or '' } }
// A subtask listed in `steps` has its own person ('' = nobody); every other subtask belongs to
// the person of its task group. Someone who is no longer on the team counts as nobody.
//
// Optional, for notifications ("Amelie assigned you …", feature-plans/notifications.md):
//   assignedBy: { groups: { taskId: userId }, steps: { subtaskId: userId } }
// It is part of the same saved key, so only Owner and Admins can write it (migrations/004).

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
  const by = parseAssigners(saved.assignedBy, result);
  if (by) result.assignedBy = by;
  return result;
}

// The last bulk deletion shares the protected assignment section and survives owner edits.
function readProjectDeletion(text) {
  try { return JSON.parse(text)?.lastProjectDeletion ?? null; } catch { return null; }
}

function encodeAssignments(assignments, deletion) {
  return JSON.stringify(deletion ? { ...assignments, lastProjectDeletion: deletion } : assignments);
}

// Who handed out each assignment; only for assignments that exist and name a person.
function parseAssigners(saved, assignments) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return null;
  const by = { groups: {}, steps: {} };
  let found = false;
  for (const part of ['groups', 'steps']) {
    const entries = saved[part];
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) continue;
    for (const [id, userId] of Object.entries(entries)) {
      if (!assignments[part][id] || typeof userId !== 'string' || !TASK_USER_ID.test(userId)) continue;
      by[part][id] = userId;
      found = true;
    }
  }
  return found ? by : null;
}

// Before saving: remembers who handed out each assignment. A new or changed assignment is
// recorded as given by `byUserId`; an unchanged one keeps who gave it before; nobody = no record.
function withAssigners(previous, next, byUserId) {
  const result = { groups: { ...next.groups }, steps: { ...next.steps } };
  const before = previous?.assignedBy || emptyAssignments();
  const by = { groups: {}, steps: {} };
  let found = false;
  for (const part of ['groups', 'steps']) {
    for (const [id, userId] of Object.entries(result[part])) {
      if (!userId) continue;
      const unchanged = previous?.[part]?.[id] === userId;
      const giver = unchanged ? before[part]?.[id] : byUserId;
      if (typeof giver === 'string' && TASK_USER_ID.test(giver)) { by[part][id] = giver; found = true; }
    }
  }
  if (found) result.assignedBy = by;
  return result;
}

// Store an explicit owner for each deleted subtask, including older inherited assignments.
function deletedSubtaskOwners(areas, assignments) {
  const owners = emptyAssignments();
  const steps = {};
  for (const area of areas) for (const group of area.tasks) for (const step of group.subtasks) {
    const entry = { id: String(step.id), taskId: String(group.id) };
    owners.steps[entry.id] = assigneeOf(entry, assignments).userId || '';
    const giver = assignerOf(entry, assignments);
    if (giver) steps[entry.id] = giver;
  }
  if (Object.keys(steps).length) owners.assignedBy = { groups: {}, steps };
  return owners;
}

// Who gave a subtask to its person: the subtask's own record, otherwise its group's. null = unknown.
function assignerOf(step, assignments) {
  const by = assignments?.assignedBy;
  if (!by) return null;
  const own = Object.prototype.hasOwnProperty.call(assignments.steps, step.id);
  return (own ? by.steps[step.id] : by.groups[step.taskId]) || null;
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
    withGroupAssignee, withStepAssignee, matchesAssignee, teamProgress, canAssignTasks,
    withAssigners, assignerOf
  };
}
