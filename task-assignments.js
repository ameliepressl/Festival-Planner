// Who does which task, shared by the Gantt (Owner column), the Task board and the Overview.
// The rules are in rules/task-rules.js; this file only reads and saves them in the browser.
// account/account.js copies the saved key to the account like every other festival- key.
(function () {
  const key = TASK_ASSIGNMENTS_KEY;

  function read() {
    try { return parseAssignments(localStorage.getItem(key)); } catch { return emptyAssignments(); }
  }
  function people() {
    return assignablePeople(window.festivalPeople?.() || {});
  }
  function myUserId() {
    return window.festivalPeople?.()?.me?.userId || null;
  }
  function canAssign() {
    return canAssignTasks(window.festivalAccess?.role || 'Admin') && people().length > 0;
  }
  function changed() {
    window.dispatchEvent(new Event('task-assignments-changed'));
  }
  function save(next) {
    if (!canAssign()) throw new Error('Only the festival creator and Admins can assign tasks.');
    try { localStorage.setItem(key, JSON.stringify(next)); }
    catch { throw new Error('Could not save the assignment in this browser.'); }
    changed();
  }
  function nameOf(userId, team = people()) {
    const person = team.find((entry) => entry.userId === userId);
    if (!person) return null;
    return person.isMe ? `${person.username} (you)` : person.username;
  }

  window.taskAssignments = {
    read, people, myUserId, canAssign, nameOf,
    saveSubtaskOwners: next => save(parseAssignments(JSON.stringify(next))),
    assigneeOf: (step, team = people()) => assigneeOf(step, read(), team),
    groupAssignee: (taskId, team = people()) => groupAssignee(taskId, read(), team),
    setGroup: (taskId, userId) => save(withGroupAssignee(read(), taskId, userId)),
    setStep: (step, userId) => save(withStepAssignee(read(), step, userId, people()))
  };

  // A teammate joined or left, or the account finished loading: everyone redraws.
  window.addEventListener('festival-people-changed', changed);
})();
