// Fresh-project dates and suggested schedules. Pure rules shared by the screen and tests.
const PROJECT_SETUP_KEY = 'festival-project-setup-v1';
const PROJECT_STATUS_KEY = 'festival-work-board-status-v1';
const PROJECT_DAY = 86400000;

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

if (typeof module !== 'undefined') module.exports = {
  PROJECT_SETUP_KEY, PROJECT_STATUS_KEY, projectToday, validProjectDate,
  shiftProjectDay, suggestedProject, removeProjectEntry, cleanProjectTracking, projectTaskIds
};
