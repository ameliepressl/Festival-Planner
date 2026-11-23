// Notifications: which of my tasks are new, due soon or overdue, and what I have already read.
// See feature-plans/notifications.md. No screen code here.
//
// Builds on rules/task-rules.js (assigneeOf): a subtask is "mine" when it, or its task group,
// is assigned to me and I am still on the festival's team.
//
// Read state, kept in this browser only (never in the shared plan):
//   { assigned: [subtaskId, …], readOn: 'YYYY-MM-DD' or null }
//   assigned = my subtasks at the last "Mark all as read"; readOn = the day of that click.

// Must not start with "festival-": every festival- key is saved into the shared plan
// (rules/account-rules.js → isSyncedKey), and one person's read state is not team data.
const NOTIFICATION_SEEN_PREFIX = 'fa-notifications-seen-v1';
const NOTIFICATION_DUE_SOON_DAYS = 7;
const NOTIFICATION_DATE = /^\d{4}-\d{2}-\d{2}$/;
const NOTIFICATION_ID_MAX = 100;
const NOTIFICATION_SEEN_MAX = 2000;
const NOTIFICATION_ORDER = { overdue: 0, dueSoon: 1, new: 2 };
// In the browser task-rules.js is loaded first; the tests load it with require.
const notificationTasks = typeof module !== 'undefined' && typeof require === 'function'
  ? require('./task-rules.js') : { assigneeOf, assignerOf };

function notificationSeenKey(festivalId, userId) {
  const valid = (value) => typeof value === 'string' && value.length > 0 && value.length <= NOTIFICATION_ID_MAX && !value.includes(':');
  return valid(festivalId) && valid(userId) ? `${NOTIFICATION_SEEN_PREFIX}:${festivalId}:${userId}` : null;
}

function emptySeen() {
  return { assigned: [], readOn: null };
}

// Not called validDate: in the browser every rule file shares one global scope, and a second
// validDate would replace the strict one in festival-rules.js (it accepts 30 February).
function validNoticeDate(value) {
  return typeof value === 'string' && NOTIFICATION_DATE.test(value) && !Number.isNaN(Date.parse(value));
}

// Reads the saved text; anything broken is dropped instead of trusted.
function parseSeen(text) {
  let saved;
  try { saved = JSON.parse(text); } catch { return emptySeen(); }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return emptySeen();
  const ids = Array.isArray(saved.assigned) ? saved.assigned : [];
  const assigned = [...new Set(ids.filter((id) => typeof id === 'string' && id.length > 0 && id.length <= NOTIFICATION_ID_MAX))]
    .slice(0, NOTIFICATION_SEEN_MAX);
  return { assigned, readOn: validNoticeDate(saved.readOn) ? saved.readOn : null };
}

// Whole days from `today` to `end` (negative = overdue), or null without a valid due date.
function daysUntilDue(end, today) {
  if (!validNoticeDate(end) || !validNoticeDate(today)) return null;
  return Math.round((Date.parse(end) - Date.parse(today)) / 86400000);
}

// My subtasks: assigned to me, and I am still on the team. Nobody else's, never anyone's who left.
//   steps: [{ id, taskId, title, end, status }] with status planned / progress / overdue / done.
function myAssignedSteps({ steps = [], assignments, people = [], myUserId }) {
  if (!myUserId || !assignments || !people.some((person) => person.userId === myUserId)) return [];
  return steps.filter((step) => step && step.id && notificationTasks.assigneeOf(step, assignments, people).userId === myUserId);
}

// One notification per subtask of mine, the most urgent reason first:
//   overdue (not done, due date passed) → due soon (not done, due within 7 days) → new (not seen yet).
// Returns { items: [{ kind, stepId, title, end, days, unread, isNew, from }], unread }.
//   from = who gave me the task: { name, isMe }, or null when unknown (older assignments,
//   or that person has left the team).
//   likelyFrom = only when `from` is unknown: who can have given it (see likelyAssigner).
function notificationsFor({ steps, assignments, people, myUserId, seen = emptySeen(), today }) {
  const likely = likelyAssigner(people, myUserId);
  const known = new Set(seen.assigned);
  const deadlinesRead = seen.readOn === today;
  const items = [];
  for (const step of myAssignedSteps({ steps, assignments, people, myUserId })) {
    const isNew = !known.has(step.id);
    const days = step.status === 'done' ? null : daysUntilDue(step.end, today);
    let kind = null;
    if (days !== null && days < 0) kind = 'overdue';
    else if (days !== null && days <= NOTIFICATION_DUE_SOON_DAYS) kind = 'dueSoon';
    else if (isNew && step.status !== 'done') kind = 'new';
    if (!kind) continue;
    const unread = isNew || (kind !== 'new' && !deadlinesRead);
    items.push({ kind, stepId: step.id, title: String(step.title || 'Untitled task'), end: step.end, days, unread, isNew,
      from: assignedFrom(step, assignments, people, myUserId) });
    const item = items[items.length - 1];
    item.likelyFrom = item.from ? null : likely;
  }
  items.sort((a, b) => NOTIFICATION_ORDER[a.kind] - NOTIFICATION_ORDER[b.kind]
    || (a.days ?? 0) - (b.days ?? 0) || a.title.localeCompare(b.title));
  return { items, unread: items.filter((item) => item.unread).length };
}

// Who gave me this subtask, as far as the team still knows them.
function assignedFrom(step, assignments, people, myUserId) {
  const giver = notificationTasks.assignerOf(step, assignments);
  const person = giver ? people.find((entry) => entry.userId === giver) : null;
  if (!person) return null;
  return { name: String(person.username || 'Teammate'), isMe: giver === myUserId };
}

// For tasks without a saved giver (assigned before givers were recorded, or from a browser that
// still had the old page): only Owner and Admins can assign tasks (migrations/004), so when the
// team has exactly one of them, that person gave it. Otherwise { name: null } = "Owner or an Admin".
function likelyAssigner(people = [], myUserId) {
  const assigners = people.filter((person) => person.role === 'Admin');
  if (assigners.length !== 1) return { name: null, isMe: false };
  return { name: String(assigners[0].username || 'Teammate'), isMe: assigners[0].userId === myUserId };
}

// "Mark all as read": remember my current subtasks and today. Deadlines come back tomorrow.
function markAllRead({ steps, assignments, people, myUserId, today }) {
  const assigned = myAssignedSteps({ steps, assignments, people, myUserId }).map((step) => step.id).slice(0, NOTIFICATION_SEEN_MAX);
  return { assigned, readOn: validNoticeDate(today) ? today : null };
}

// The counter on the bell: nothing at 0, at most "9+".
function notificationBadge(unread) {
  if (!Number.isInteger(unread) || unread <= 0) return '';
  return unread > 9 ? '9+' : String(unread);
}

// The sentence for one notification. The screen shows it as text, never as HTML.
function notificationText(item) {
  const title = `“${item.title}”`;
  if (item.kind === 'overdue') {
    const late = -item.days;
    return `${title} is ${late} ${late === 1 ? 'day' : 'days'} overdue`;
  }
  if (item.kind === 'dueSoon') {
    if (item.days === 0) return `${title} is due today`;
    if (item.days === 1) return `${title} is due tomorrow`;
    return `${title} is due in ${item.days} days`;
  }
  if (item.from?.isMe) return `You assigned yourself ${title}`;
  if (item.from) return `${item.from.name} assigned you ${title}`;
  return `You were assigned ${title}`;
}

// Who a task came from, under a deadline notification ("From Amelie"); '' when unknown.
// New-task sentences already name the person.
function notificationSource(item) {
  if (item.from) {
    if (item.kind === 'new') return '';
    return item.from.isMe ? 'Assigned by you' : `From ${item.from.name}`;
  }
  // No saved giver: the only person who can assign, or "the Owner or an Admin".
  const likely = item.likelyFrom;
  if (!likely) return '';
  if (likely.isMe) return 'Assigned by you';
  return likely.name ? `From ${likely.name}` : 'From the Owner or an Admin';
}

// The text of an empty list. Owner and Admins also learn where tasks are assigned,
// because the Owner choice only appears for the selected subtask in the Timeline.
function notificationEmptyText(canAssign) {
  const base = "You're all caught up. Tasks assigned to you and their deadlines appear here.";
  return canAssign
    ? `${base} To assign tasks: Project tasks → Timeline → Edit plan → Subtasks, then click a subtask and choose its Owner.`
    : `${base} The festival's Owner and Admins assign tasks.`;
}

if (typeof module !== 'undefined') {
  module.exports = {
    NOTIFICATION_SEEN_PREFIX, NOTIFICATION_DUE_SOON_DAYS, notificationSeenKey, emptySeen, parseSeen, daysUntilDue,
    myAssignedSteps, notificationsFor, markAllRead, notificationBadge, notificationText,
    notificationEmptyText, notificationSource
  };
}
