// Fresh-project dates and suggested schedules. Pure rules shared by the screen and tests.
const PROJECT_SETUP_KEY = 'festival-project-setup-v1';
const PROJECT_STATUS_KEY = 'festival-work-board-status-v1';
const PROJECT_DAY = 86400000;
const PROJECT_TIMELINE_DAYS = 26 * 7;

function projectToday(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function validProjectDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value))
    && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
}

function shiftProjectDay(value, offset) {
  return new Date(Date.parse(value + 'T12:00:00Z') + offset * PROJECT_DAY).toISOString().slice(0, 10);
}

// Keep the existing ordering, with a 100-day preparation window. A late start
// compresses preparation into the available days; saved dates never drift on reload.
function suggestedProject(template, event, planningStart) {
  if (!validProjectDate(event?.startDate) || !validProjectDate(event?.endDate)
      || event.startDate > event.endDate || !validProjectDate(planningStart)) {
    throw new Error('Choose valid festival dates before creating the project timeline.');
  }
  const available = Math.max(0, Math.round((Date.parse(event.startDate) - Date.parse(planningStart)) / PROJECT_DAY));
  const windowDays = Math.min(100, available);
  const plan = JSON.parse(JSON.stringify(template));
  for (const area of plan) {
    const after = String(area.id) === '13';
    const anchor = after ? shiftProjectDay(event.endDate, 1) : event.startDate;
    function offset(value) {
      if (after || value >= 0) return value;
      if (!windowDays) return 0;
      return -Math.min(windowDays, Math.max(1, Math.round(-value / 84 * windowDays)));
    }
    for (const group of area.tasks) for (const step of group.subtasks) {
      const start = offset(step.start), end = Math.max(start, offset(step.end));
      step.start = shiftProjectDay(anchor, start);
      step.end = shiftProjectDay(anchor, end);
    }
  }
  return plan;
}

function removeProjectEntry(plan, { stepId, taskId }) {
  const next = JSON.parse(JSON.stringify(plan));
  let found = false;
  for (const area of next) {
    area.tasks = area.tasks.filter(group => {
      if (taskId && String(group.id) === String(taskId)) { found = true; return false; }
      if (stepId) group.subtasks = group.subtasks.filter(step => {
        if (String(step.id) !== String(stepId)) return true;
        found = true;
        return false;
      });
      return group.subtasks.length > 0;
    });
  }
  if (!found) throw new Error('This task no longer exists. Reload the project and try again.');
  return next;
}

// Editing keeps the subtask's identity, so progress and completion history stay
// attached even when it moves to a different task group or work area.
function editProjectEntry(plan, { stepId, areaId, taskId, parentName, title, start, end, newTaskId }) {
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 160
      || !validProjectDate(start) || !validProjectDate(end) || start > end) {
    throw new Error('Enter a task name and valid dates. The end date must be on or after the start date.');
  }
  const next = JSON.parse(JSON.stringify(plan));
  let sourceArea, sourceTask, step;
  for (const area of next) for (const group of area.tasks) {
    const found = group.subtasks.find(item => String(item.id) === String(stepId));
    if (found) { sourceArea = area; sourceTask = group; step = found; }
  }
  if (!step) throw new Error('This task no longer exists. Reload the project and try again.');
  const targetArea = next.find(area => String(area.id) === String(areaId));
  if (!targetArea) throw new Error('Choose a work area.');
  let targetTask = targetArea.tasks.find(group => String(group.id) === String(taskId));
  if (!taskId) {
    if (typeof parentName !== 'string' || !parentName.trim() || parentName.trim().length > 160) {
      throw new Error('Enter a name for the new task group.');
    }
    if (!newTaskId || next.some(area => area.tasks.some(group => String(group.id) === String(newTaskId)))) {
      throw new Error('Could not create the task group. Please try again.');
    }
    targetTask = { id: newTaskId, title: parentName.trim(), subtasks: [] };
    targetArea.tasks.push(targetTask);
  }
  if (!targetTask) throw new Error('Choose a task group in the selected work area.');
  step.title = title.trim();
  step.start = start;
  step.end = end;
  const moved = sourceTask !== targetTask;
  if (moved) {
    sourceTask.subtasks = sourceTask.subtasks.filter(item => item !== step);
    targetTask.subtasks.push(step);
    if (!sourceTask.subtasks.length) sourceArea.tasks = sourceArea.tasks.filter(group => group !== sourceTask);
  }
  return { plan: next, sourceTaskId: String(sourceTask.id), targetTaskId: String(targetTask.id), targetAreaId: String(targetArea.id), moved };
}

// Group ownership is inherited by older tasks. Regrouping must not silently
// reassign them, and Editors must never write the protected assignments section.
function assignmentsAfterProjectMove(assignments, { stepId, sourceTaskId, targetTaskId, mayAssign }) {
  const next = JSON.parse(JSON.stringify(assignments));
  if (sourceTaskId === targetTaskId || Object.hasOwn(next.steps, String(stepId))) return next;
  const before = next.groups[sourceTaskId] || '';
  const after = next.groups[targetTaskId] || '';
  if (!mayAssign && before !== after) {
    throw new Error('Only an Admin can move this task to a group with a different owner. Choose a group with the same owner, or ask an Admin.');
  }
  if (mayAssign) next.steps[String(stepId)] = before;
  return next;
}

function projectTaskIds(plan) {
  return { groups: new Set(plan.flatMap(area => area.tasks.map(group => String(group.id)))),
    steps: new Set(plan.flatMap(area => area.tasks.flatMap(group => group.subtasks.map(step => String(step.id))))) };
}

function cleanProjectTracking(plan, statuses = {}, assignments = { groups: {}, steps: {} }) {
  const ids = projectTaskIds(plan);
  const keep = (values, allowed) => Object.fromEntries(Object.entries(values || {}).filter(([id]) => allowed.has(id)));
  return { statuses: keep(statuses, ids.steps),
    assignments: { groups: keep(assignments.groups, ids.groups), steps: keep(assignments.steps, ids.steps) } };
}

// Render one manageable window, rather than building a cell for every day between
// an accidentally mistyped task year and the festival. All task dates stay saved.
function projectTimelineWindow({ openingDate, closingDate, ranges = [], requestedStart }) {
  if (!validProjectDate(openingDate) || !validProjectDate(closingDate) || closingDate < openingDate || openingDate < '0001-01-01') {
    throw new Error('Choose valid festival dates in Settings to see the project timeline.');
  }
  const opening = Date.parse(openingDate + 'T12:00:00Z');
  const dayOffset = date => Math.round((Date.parse(date + 'T12:00:00Z') - opening) / PROJECT_DAY);
  const earliest = dayOffset('0001-01-01'), latest = dayOffset('9999-12-31');
  const valid = ranges.filter(range => Number.isInteger(range?.start) && Number.isInteger(range?.end) && range.start <= range.end);
  let fullStart = -84;
  let fullEnd = Math.max(13, dayOffset(closingDate) + 12);
  for (const range of valid) {
    fullStart = Math.min(fullStart, range.start);
    fullEnd = Math.max(fullEnd, range.end);
  }
  fullStart = Math.max(earliest, Math.floor(fullStart / 7) * 7);
  fullEnd = Math.min(latest, fullEnd);
  const limited = fullEnd - fullStart + 1 > PROJECT_TIMELINE_DAYS;
  const lastStart = Math.max(fullStart, fullEnd - PROJECT_TIMELINE_DAYS + 1);
  const preferred = Number.isFinite(requestedStart) ? Math.floor(requestedStart) : Math.max(fullStart, -105);
  const start = limited ? Math.max(fullStart, Math.min(lastStart, preferred)) : fullStart;
  const end = Math.min(fullEnd, start + PROJECT_TIMELINE_DAYS - 1);
  return { start, end, fullStart, fullEnd, limited,
    previous: start > fullStart ? Math.max(fullStart, start - PROJECT_TIMELINE_DAYS) : null,
    next: end < fullEnd ? Math.min(lastStart, start + PROJECT_TIMELINE_DAYS) : null,
    outside: valid.filter(range => range.start < start || range.end > end).length };
}

if (typeof module !== 'undefined') module.exports = {
  PROJECT_SETUP_KEY, PROJECT_STATUS_KEY, projectToday, validProjectDate,
  shiftProjectDay, suggestedProject, removeProjectEntry, editProjectEntry,
  assignmentsAfterProjectMove, cleanProjectTracking, projectTaskIds,
  PROJECT_TIMELINE_DAYS, projectTimelineWindow
};
