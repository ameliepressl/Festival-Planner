(function () {
  const key = 'festival-work-board-status-v1';
  const statuses = [
    ['planned', 'Planned'],
    ['progress', 'In progress'],
    ['overdue', 'Overdue'],
    ['done', 'Done']
  ];
  const columns = document.querySelector('#work-board-columns');
  const areaSelect = document.querySelector('#work-board-area');
  const dueSoon = document.querySelector('#work-board-due-soon');
  const search = document.querySelector('#work-board-search');
  const assigneeSelect = document.querySelector('#work-board-assignee');
  const assignments = window.taskAssignments;
  const summary = document.querySelector('#work-board-summary');
  const format = new Intl.DateTimeFormat('en-GB', { weekday:'short', day:'numeric', month:'short', timeZone:'UTC' });
  const localDate = new Intl.DateTimeFormat('en-CA', {year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Europe/Lisbon'});
  function today() {
    const {year,month,day} = Object.fromEntries(localDate.formatToParts(new Date()).map(({type,value}) => [type,value]));
    return year + '-' + month + '-' + day;
  }
  let renderedDate;
  let summaryDate = today();
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(key)) || {}; } catch {}
  let dragged = null;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  const stats = document.querySelector('#open-board-page');
  const percent = new Intl.NumberFormat(undefined, {style:'percent', maximumFractionDigits:1});

  function statusOf(card, date) {
    const stored = saved[card.id]?.status ?? saved[card.id];
    if (stored === 'done') return 'done';
    if (card.end < date) return 'overdue';
    return ['progress','review'].includes(stored) ? 'progress' : 'planned';
  }

  const statValues = statuses.map(([id, label]) => {
    const button = element('button', 'work-board-stat');
    button.type = 'button';
    button.dataset.status = id;
    const value = element('span', 'work-board-stat-value');
    button.append(element('span', 'work-board-stat-label', label), value);
    stats.querySelector('.work-board-stats').append(button);
    return [id, value];
  });

  let statusFilter = 'all';
  function daysUntil(end, date) {
    return (Date.parse(end) - Date.parse(date)) / 86400000;
  }

  function deadlineText(end, date, done = false) {
    const days = daysUntil(end, date);
    const absolute = format.format(new Date(end + 'T12:00:00Z'));
    if (done) return 'Due ' + absolute;
    if (days < 0) return -days + (days === -1 ? ' day overdue' : ' days overdue') + ' · ' + absolute;
    if (days === 0) return 'Due today · ' + absolute;
    if (days === 1) return 'Due tomorrow · ' + absolute;
    return 'Due in ' + days + ' days · ' + absolute;
  }

  function projectSteps(plan = window.getSavedGanttPlan()) {
    return plan.flatMap((area, ai) => area.tasks.flatMap((task, ti) =>
      task.subtasks.map((step, si) => ({
        ...step, area: area.title, areaStyle: area.style, areaId: String(area.id), task: task.title, taskId: String(task.id),
        number: [ai + 1, ti + 1, si + 1].join('.')
      }))
    ));
  }

  function urgentSteps(steps, date) {
    return steps.filter(step => daysUntil(step.end, date) <= 7 && statusOf(step, date) !== 'done')
      .sort((a, b) => a.end.localeCompare(b.end));
  }

  function publishBoardUpdate() {
    window.dispatchEvent(new Event('work-board-updated'));
  }

  // Overview → "Project tasks done": finished subtasks of the whole plan.
  window.getOverviewTaskProgress = () => {
    const date = today();
    const steps = projectSteps();
    return { done: steps.filter(step => statusOf(step, date) === 'done').length, total: steps.length };
  };

  // Overview → "Team progress": assigned, done, overdue and the next deadline per person.
  window.getOverviewTeamProgress = () => {
    const date = today();
    const team = assignments.people();
    if (!team.length) return null;
    const steps = projectSteps().map(step => ({ ...step, status: statusOf(step, date) }));
    return teamProgress({ steps, assignments: assignments.read(), people: team });
  };

  // Notifications (notifications.js): every subtask with its current status, and today's date.
  window.getProjectTaskSnapshot = () => {
    const date = today();
    return { today: date, steps: projectSteps().map(step => ({ ...step, status: statusOf(step, date) })) };
  };

  window.getOverviewUrgentTasks = () => {
    const date = today();
    return urgentSteps(projectSteps(), date).slice(0, 5).map(({ id, title, area, end }) => ({
      id, title, area, end, deadline: deadlineText(end, date)
    }));
  };

  function renderStats() {
    const date = today();
    const steps = projectSteps();
    document.querySelector('#task-overview-total').textContent = steps.length + (steps.length === 1 ? ' subtask total' : ' subtasks total');
    document.querySelector('#board-all-count').textContent = steps.length;
    const counts = {planned:0, progress:0, overdue:0, done:0};
    steps.forEach(step => counts[statusOf(step, date)]++);
    statValues.forEach(([id, value]) => {
      value.textContent = counts[id] + ' · ' + percent.format(steps.length ? counts[id] / steps.length : 0);
    });
  }

  function render() {
    renderedDate = today();
    const previousArea = areaSelect.value;
    document.querySelector('#board-my-tasks').setAttribute('aria-pressed', String(assigneeSelect.value === 'me'));
    const query = search.value.trim().toLowerCase();
    const plan = window.getSavedGanttPlan();
    const projectProblem = window.getProjectDataProblem?.() || '';
    const canEditTasks = canFestival('lineup') && !projectProblem;
    const team = assignments.people();
    const assigned = assignments.read();
    const myId = assignments.myUserId();
    const assigneeFilter = assigneeSelect.value;
    assigneeSelect.replaceChildren(new Option('Everyone', ''));
    if (myId) assigneeSelect.add(new Option('My tasks', 'me'));
    assigneeSelect.add(new Option('Nobody assigned', 'none'));
    team.forEach(person => assigneeSelect.add(new Option(assignments.nameOf(person.userId, team), person.userId)));
    assigneeSelect.value = assigneeFilter;
    if (assigneeSelect.value !== assigneeFilter) assigneeSelect.value = '';
    assigneeSelect.closest('label').hidden = !team.length;
    areaSelect.replaceChildren(new Option('All areas', ''));
    plan.forEach(area => areaSelect.add(new Option(area.title, String(area.id))));
    const cards = projectSteps(plan);
    areaSelect.value = plan.some(area => String(area.id) === previousArea) ? previousArea : '';
    const selection = areaSelect.value;
    const visible = cards.filter(card => {
      const days = daysUntil(card.end, renderedDate);
      return (statusFilter === 'all' || statusOf(card, renderedDate) === statusFilter) &&
        (!selection || card.areaId === selection) &&
        matchesAssignee(card, assigneeSelect.value, assigned, team, myId) &&
        (!dueSoon.checked || (days >= 0 && days <= 7 && statusOf(card, renderedDate) !== 'done')) &&
        [card.title, card.area, card.task, card.number, assignments.nameOf(assigneeOf(card, assigned, team).userId, team) || '']
          .join(' ').toLowerCase().includes(query);
    });

    // Keep the current owner visible on the card.
    function assigneeLine(card) {
      if (!team.length) return document.createTextNode('');
      const { userId } = assigneeOf(card, assigned, team);
      const label = userId ? 'Assigned to ' + assignments.nameOf(userId, team) : 'Nobody assigned';
      return element('div', 'work-board-assignee', label);
    }

    function move(id, status, focus = false) {
      if (!canFestival('lineup')) return false;
      const card = cards.find(card => card.id === id);
      if (card?.end < renderedDate && (saved[id]?.status ?? saved[id]) !== 'done' && status !== 'done') {
        summary.textContent = 'An overdue subtask stays overdue until it is done or its due date changes.';
        return false;
      }
      const previous = saved[id];
      const finishedBefore = previous?.status === 'done';
      const next = {...saved, [id]:status === 'done' ? {
        status, completedAt: finishedBefore ? previous.completedAt : Date.now(),
        ...((finishedBefore ? previous.completedBy : myId) ? { completedBy: finishedBefore ? previous.completedBy : myId } : {})
      } : status};
      try { localStorage.setItem(key, JSON.stringify(next)); }
      catch { summary.textContent = 'Could not save the status in this browser.'; return false; }
      saved = next;
      render();
      publishBoardUpdate();
      if (focus) Array.from(columns.querySelectorAll('select')).find(control => control.dataset.cardId === id)?.focus();
      return true;
    }

    summary.textContent = projectProblem || (visible.length === cards.length ? cards.length + ' subtasks' : visible.length + ' of ' + cards.length + ' subtasks');
    renderStats();
    columns.replaceChildren();
    statuses.forEach(([id, label]) => {
      const lane = element('section', 'work-board-lane');
      lane.dataset.status = id;
      const items = visible.filter(card => statusOf(card, renderedDate) === id);
      if (id === 'planned' || id === 'progress') items.sort((a, b) => a.end.localeCompare(b.end));
      if (id === 'done') items.sort((a, b) => (saved[b.id]?.completedAt ?? 0) - (saved[a.id]?.completedAt ?? 0));
      const heading = element('h2', 'work-board-lane-title', label);
      heading.append(element('span', 'work-board-count', String(items.length)));
      lane.append(heading);
      if (id === 'overdue') lane.append(element('p', 'work-board-empty', 'Past the due date and unfinished.'));
      if (!items.length) lane.append(element('p', 'work-board-empty', 'No subtasks'));
      lane.ondragover = event => {
        if (!dragged || id === 'overdue') return;
        event.preventDefault(); event.dataTransfer.dropEffect = 'move';
        lane.classList.add('work-board-drop');
      };
      lane.ondragleave = event => { if (!lane.contains(event.relatedTarget)) lane.classList.remove('work-board-drop'); };
      lane.ondrop = event => {
        event.preventDefault(); lane.classList.remove('work-board-drop');
        if (dragged && id !== 'overdue') move(dragged, id);
        dragged = null;
      };
      items.forEach(card => {
        const item = element('article', 'work-board-card');
        item.draggable = canEditTasks;
        item.dataset.cardId = card.id;
        item.tabIndex = -1;
        item.ondragstart = event => {
          dragged = card.id; event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', card.id);
        };
        item.ondragend = () => {
          dragged = null;
          columns.querySelectorAll('.work-board-drop').forEach(node => node.classList.remove('work-board-drop'));
        };
        const control = element('select', 'work-board-status');
        control.dataset.cardId = card.id;
        control.disabled = !canEditTasks;
        control.setAttribute('aria-label', 'Status for ' + card.number + ' ' + card.title);
        if (id === 'overdue') {
          const automatic = new Option('Overdue (automatic)', 'overdue');
          automatic.disabled = true;
          control.add(automatic);
        }
        statuses.filter(([key]) => key !== 'overdue' && (id !== 'overdue' || key === 'done'))
          .forEach(([key, title]) => control.add(new Option(title, key)));
        control.value = id;
        control.onchange = () => { if (!move(card.id, control.value, true)) control.value = id; };
        const due = element('time','work-board-due',deadlineText(card.end, renderedDate, id === 'done'));
        due.dateTime = card.end;
        const meta = element('div', 'work-board-card-meta');
        meta.append(element('span','work-board-number',card.number), due);
        item.append(meta, element('h3',null,card.title),
          element('p','work-board-context',card.area + ' · ' + card.task), assigneeLine(card), control);
        if (canEditTasks) {
          const edit = element('button', 'button quiet', 'Edit task');
          edit.type = 'button';
          edit.setAttribute('aria-label', 'Edit task ' + card.title);
          edit.onclick = () => openTaskDialog(card.id);
          item.append(edit);
        }
        const doneBy = id === 'done' && assignments.nameOf(saved[card.id]?.completedBy, team);
        if (doneBy) item.append(element('p', 'work-board-done-by', 'Done by ' + doneBy));
        lane.append(item);
      });
      columns.append(lane);
    });
  }
  const overview = document.querySelector('#task-board-view');
  const projectTasksButton = document.querySelector('[data-section="Task board"]');
  const board = document.querySelector('#board-page');
  let boardTrigger;
  function openBoard(trigger, assignee = '') {
    statusFilter = 'all';
    boardTrigger = trigger;
    window.showProjectTaskView('board');
    window.scrollTo(0, 0);
    document.querySelector('#board-page-title').focus();
    search.value = '';
    areaSelect.value = '';
    dueSoon.checked = false;
    assigneeSelect.replaceChildren(new Option('', assignee));
    assigneeSelect.value = assignee;
    render();
  }
  // Overview → Team progress: the board with one person's subtasks ('me', 'none' or a user id).
  window.openTaskBoard = ({ assignee = '' } = {}) => {
    projectTasksButton.click();
    openBoard(overview.querySelector('.work-board-open'), assignee);
  };
  overview.addEventListener('click', event => {
    const trigger = event.target.closest('.work-board-stat, .work-board-open');
    if (!trigger) return;
    if (trigger.classList.contains('work-board-stat')) {
      statusFilter = trigger.dataset.status;
      window.showProjectTaskView('board');
      stats.querySelectorAll('.work-board-stat').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.status === statusFilter)));
      render();
      return;
    }
    openBoard(trigger);
  });

  window.openOverviewTask = id => {
    statusFilter = 'all';
    window.openTaskBoard();
    const card = Array.from(columns.querySelectorAll('.work-board-card')).find(item => item.dataset.cardId === String(id));
    card?.focus();
    card?.scrollIntoView({block:'center',inline:'nearest'});
  };
  projectTasksButton.addEventListener('click', renderStats);
  document.querySelector('#back-board-overview').addEventListener('click', () => {
    projectTasksButton.click();
    (boardTrigger ?? overview.querySelector('.work-board-open'))?.focus();
  });
  document.querySelector('#back-task-board').addEventListener('click', renderStats);
  window.addEventListener('gantt-project-changed', () => {
    if (!board.classList.contains('hidden')) render();
    else if (!overview.classList.contains('hidden')) renderStats();
    publishBoardUpdate();
  });
  window.addEventListener('project-task-tracking-changed', () => {
    try { saved = JSON.parse(localStorage.getItem(key)) || {}; } catch { saved = {}; }
  });
  setInterval(() => {
    if (!overview.classList.contains('hidden')) renderStats();
    const date = today();
    if (date !== summaryDate) {
      summaryDate = date;
      publishBoardUpdate();
    }
  }, 60000);
  const chart = document.querySelector('#gantt-view');
  overview.append(board, chart);
  stats.after(document.querySelector('.project-view-controls'));
  const manageAreasButton = document.querySelector('#manage-project-areas');
  const restoreButton = document.querySelector('#project-area-restore');
  manageAreasButton.hidden = !canFestival('team');
  function updateAreaTools() {
    const problem = window.getProjectDataProblem?.() || '';
    manageAreasButton.disabled = Boolean(problem);
    manageAreasButton.title = problem;
    const deletion = window.getProjectDeletionSummary();
    restoreButton.hidden = !deletion;
    restoreButton.disabled = Boolean(deletion?.draft);
    restoreButton.title = deletion?.draft ? 'Save or cancel the timeline draft to restore a saved deletion.' : '';
  }
  updateAreaTools();
  window.addEventListener('gantt-project-changed', updateAreaTools);
  window.addEventListener('gantt-edit-mode-changed', updateAreaTools);

  window.showProjectTaskView = mode => {
    overview.classList.remove('hidden');
    board.classList.toggle('hidden', mode !== 'board');
    chart.classList.toggle('hidden', mode !== 'timeline');
    document.querySelector('#project-board-view').setAttribute('aria-pressed', String(mode === 'board'));
    document.querySelector('#project-timeline-view').setAttribute('aria-pressed', String(mode === 'timeline'));
    stats.hidden = false;
    if (mode === 'board') { renderStats(); render(); }
  };
  document.querySelector('#project-board-view').onclick = () => window.showProjectTaskView('board');
  document.querySelector('#project-timeline-view').onclick = () => window.showProjectTaskView('timeline');
  projectTasksButton.addEventListener('click', () => window.showProjectTaskView('board'));
  document.querySelector('#board-my-tasks').onclick = () => {
    assigneeSelect.value = assigneeSelect.value === 'me' ? '' : 'me';
    render();
  };
  stats.querySelector('[data-status="all"]').setAttribute('aria-pressed', 'true');
  renderStats();
  setInterval(() => { if (!document.querySelector('#board-page').classList.contains('hidden') && today() !== renderedDate) render(); }, 60000);
  const areaDialog = document.querySelector('#project-areas-dialog');
  const areaForm = areaDialog.querySelector('form');
  const areaFields = areaForm.elements;
  const areaError = areaForm.querySelector('[role="alert"]');
  const areaStatus = areaForm.querySelector('[role="status"]');
  const areaHelp = document.querySelector('#project-areas-help');
  const deleteHelp = document.querySelector('#project-area-delete-help');
  const deleteAreaButton = document.querySelector('#project-area-delete');
  const renameAreaButton = document.querySelector('#project-area-rename');
  const confirmAreaButton = document.querySelector('#project-area-confirm');
  const closeAreasButton = document.querySelector('#project-areas-close');
  let reviewedArea = null;

  function renderAreaDialog(preferredId = '') {
    const { areas, draft } = window.getProjectAreasForManagement();
    areaHelp.textContent = draft ? 'Choose Save changes on the timeline to keep edits made here.'
      : 'Changes apply to both the task board and timeline.';
    areaFields.area.replaceChildren(...areas.map(area => new Option(area.title, area.id)));
    areaFields.area.value = areas.some(area => area.id === preferredId) ? preferredId : (areas[0]?.id || '');
    document.querySelector('#project-areas-empty').hidden = areas.length > 0;
    document.querySelector('#project-area-fields').hidden = areas.length === 0;
    deleteAreaButton.hidden = renameAreaButton.hidden = areas.length === 0;
    showAreaName(areas.find(area => area.id === areaFields.area.value));
  }

  function showAreaName(area) {
    reviewedArea = null;
    areaError.textContent = '';
    areaFields.area.disabled = false;
    areaFields.areaName.value = area?.title || '';
    areaFields.areaName.disabled = !area;
    document.querySelector('#project-area-name').hidden = false;
    areaFields.destination.disabled = true;
    document.querySelector('#project-area-destination').hidden = true;
    deleteHelp.hidden = confirmAreaButton.hidden = confirmAreaButton.disabled = true;
    renameAreaButton.disabled = !area;
    closeAreasButton.textContent = 'Close';
  }

  manageAreasButton.onclick = () => {
    if (!canFestival('team') || window.getProjectDataProblem?.()) return;
    areaStatus.textContent = '';
    renderAreaDialog();
    areaDialog.showModal();
  };
  areaFields.area.onchange = () => {
    areaStatus.textContent = '';
    const { areas } = window.getProjectAreasForManagement();
    showAreaName(areas.find(area => area.id === areaFields.area.value));
  };
  deleteAreaButton.onclick = () => {
    const { areas } = window.getProjectAreasForManagement();
    const area = areas.find(item => item.id === areaFields.area.value);
    if (!area) return;
    reviewedArea = area;
    areaStatus.textContent = areaError.textContent = '';
    areaFields.area.disabled = areaFields.areaName.disabled = true;
    document.querySelector('#project-area-name').hidden = true;
    areaFields.destination.replaceChildren(new Option('Choose what happens to the tasks', ''));
    for (const other of areas.filter(item => item.id !== area.id)) {
      areaFields.destination.add(new Option('Move to ' + other.title, 'move:' + other.id));
    }
    areaFields.destination.add(new Option('Delete the tasks and their progress', 'delete'));
    areaFields.destination.required = area.groups > 0;
    areaFields.destination.disabled = !area.groups;
    document.querySelector('#project-area-destination').hidden = !area.groups;
    const groupCount = area.groups + (area.groups === 1 ? ' task group' : ' task groups');
    const stepCount = area.subtasks + (area.subtasks === 1 ? ' subtask' : ' subtasks');
    deleteHelp.textContent = area.groups ? `“${area.title}” contains ${groupCount} and ${stepCount}. Move them to another area or delete them with this area.`
      : `Delete the empty work area “${area.title}”?`;
    deleteHelp.hidden = false;
    deleteAreaButton.hidden = renameAreaButton.hidden = renameAreaButton.disabled = true;
    confirmAreaButton.hidden = confirmAreaButton.disabled = false;
    closeAreasButton.textContent = 'Back';
    (area.groups ? areaFields.destination : closeAreasButton).focus();
  };
  closeAreasButton.onclick = () => {
    if (reviewedArea) {
      renderAreaDialog(reviewedArea.id);
      areaFields.area.focus();
    } else areaDialog.close();
  };

  const restoreDialog = document.querySelector('#project-restore-dialog');
  const restoreForm = restoreDialog.querySelector('form');
  const restoreError = restoreForm.querySelector('[role="alert"]');
  restoreButton.onclick = () => {
    const deletion = window.getProjectDeletionSummary();
    if (!deletion || deletion.draft) return;
    const count = deletion.subtasks;
    document.querySelector('#project-area-recovery-help').textContent = count
      ? `Restore the last deletion? This brings back ${count} ${count === 1 ? 'subtask' : 'subtasks'} with saved progress and assignments. Newer work stays in the project.`
      : 'Bring back the last deleted work area? Tasks that were moved stay in their current area.';
    restoreError.textContent = '';
    restoreDialog.showModal();
  };
  restoreForm.querySelector('[data-cancel]').onclick = () => restoreDialog.close();
  restoreForm.onsubmit = event => {
    event.preventDefault();
    try { window.restoreLastProjectDeletion(); }
    catch (failure) { restoreError.textContent = failure.message; return; }
    restoreDialog.close();
    manageAreasButton.focus();
    toast('Last deletion restored on the board and timeline.');
  };
  areaForm.onsubmit = event => {
    event.preventDefault();
    const areaId = areaFields.area.value;
    const choice = areaFields.destination.value;
    const deleting = Boolean(reviewedArea);
    const changes = deleting
      ? { destinationId: choice.startsWith('move:') ? choice.slice(5) : '', deleteTasks: choice === 'delete' }
      : { title: areaFields.areaName.value };
    try { window.manageProjectArea(areaId, changes); }
    catch (failure) { areaError.textContent = failure.message; return; }
    const { draft } = window.getProjectAreasForManagement();
    renderAreaDialog(deleting ? changes.destinationId : areaId);
    areaStatus.textContent = (deleting ? 'Work area removed' : 'Work area renamed') + (draft ? ' in the timeline draft.' : '.');
    (areaFields.area.disabled || !areaFields.area.value ? closeAreasButton : areaFields.area).focus();
  };

  const dialog = document.querySelector('#board-create-dialog');
  const form = document.querySelector('#board-create-form');
  const fields = form.elements;
  const error = document.querySelector('#board-create-error');
  const addTaskButton = document.querySelector('#board-add-task');
  const saveTaskButton = document.querySelector('#board-create-save');
  const deleteTaskButton = document.querySelector('#board-edit-delete');
  const newAreaOption = '+new-area';
  let editingStepId = null;
  let addingTimelineArea = false;
  let initialOwner = '';
  addTaskButton.hidden = !canFestival('lineup');
  addTaskButton.disabled = Boolean(window.getProjectDataProblem?.());
  if (addTaskButton.disabled) addTaskButton.title = window.getProjectDataProblem();
  const dialogHelp = form.querySelector('.hero-copy');
  const groupHelp = element('p', 'field-help', 'Task groups belong to the selected work area. Choose an existing group or “Create a task group”.');
  groupHelp.id = 'board-group-help';
  fields.parent.setAttribute('aria-describedby', groupHelp.id);
  form.querySelector('.form-grid').after(groupHelp);

  function updateParentName() {
    const creating = fields.parent.value === 'new';
    document.querySelector('#board-parent-name').hidden = !creating;
    fields.parentName.disabled = !creating;
    fields.parentName.required = creating;
  }
  function updateParents() {
    const area = window.getSavedGanttPlan().find(item => String(item.id) === fields.area.value);
    const creatingArea = fields.area.value === newAreaOption;
    const areaNameField = document.querySelector('#board-area-name');
    areaNameField.hidden = !creatingArea;
    fields.areaName.disabled = !creatingArea;
    fields.areaName.required = creatingArea;
    fields.parent.replaceChildren(new Option('Choose a task group', ''));
    if (area) {
      area.tasks.forEach(task => fields.parent.add(new Option(task.title, String(task.id))));
      fields.parent.add(new Option('+ Create a task group', 'new'));
    }
    if (creatingArea) {
      fields.parent.replaceChildren(new Option('Create a task group', 'new'));
      fields.parent.value = 'new';
    }
    fields.parent.disabled = addingTimelineArea || (!area && !creatingArea);
    groupHelp.textContent = creatingArea ? 'Give the new work area its first task group.' : area ? `Showing task groups in ${area.title}. You can also create a new group.` : 'Choose a work area first to see its task groups.';
    updateParentName();
  }
  function openTaskDialog(stepId = null, fromTimeline = false) {
    if (!canFestival('lineup')) return;
    if (window.getProjectDataProblem?.()) { summary.textContent = window.getProjectDataProblem(); return; }
    const card = stepId === null ? null : projectSteps().find(item => String(item.id) === String(stepId));
    if (stepId !== null && !card) {
      summary.textContent = 'This task no longer exists. Reload the project and try again.';
      return;
    }
    editingStepId = card ? String(card.id) : null;
    addingTimelineArea = fromTimeline;
    form.reset();
    error.textContent = '';
    document.querySelector('#board-create-title').textContent = fromTimeline ? 'Add work area' : card ? 'Edit task' : 'Add new task';
    saveTaskButton.textContent = fromTimeline ? 'Add area to draft' : card ? 'Save changes' : 'Create task';
    dialogHelp.textContent = fromTimeline
      ? 'Create the first task group and subtask for this area. Choose Save changes on the timeline to keep it.'
      : 'Choose a work area and task group, then set the subtask’s dates. Changes appear on the board and timeline.';
    fields.area.closest('label').hidden = fromTimeline;
    fields.parent.closest('label').hidden = fromTimeline;
    fields.area.disabled = fromTimeline;
    groupHelp.hidden = fromTimeline;
    deleteTaskButton.hidden = !card;
    const canEditOwner = Boolean(card && assignments.canAssign());
    document.querySelector('#board-edit-owner').hidden = !canEditOwner;
    fields.owner.disabled = !canEditOwner;
    fields.owner.replaceChildren(new Option('Nobody', ''));
    initialOwner = '';
    if (canEditOwner) {
      const team = assignments.people();
      team.forEach(person => fields.owner.add(new Option(assignments.nameOf(person.userId, team), person.userId)));
      initialOwner = assignments.assigneeOf(card, team).userId || '';
    }
    fields.owner.value = initialOwner;
    fields.area.replaceChildren(new Option('Choose an area', ''));
    window.getSavedGanttPlan().forEach(area => fields.area.add(new Option(area.title, String(area.id))));
    if (!card) fields.area.add(new Option('+ Create a work area', newAreaOption));
    fields.area.value = fromTimeline ? newAreaOption : (card?.areaId || areaSelect.value || String(window.getSavedGanttPlan()[0]?.id || ''));
    fields.title.value = card?.title || '';
    fields.start.value = card?.start || projectToday();
    fields.end.value = card?.end || projectToday();
    updateParents();
    if (card) fields.parent.value = card.taskId;
    updateParentName();
    dialog.showModal();
  }
  addTaskButton.onclick = () => openTaskDialog();
  window.openTimelineAreaDialog = () => openTaskDialog(null, true);
  fields.area.onchange = updateParents;
  fields.parent.onchange = updateParentName;
  document.querySelector('#board-create-cancel').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { editingStepId = null; addingTimelineArea = false; });
  deleteTaskButton.onclick = () => {
    if (!canFestival('lineup') || editingStepId === null) return;
    const card = projectSteps().find(item => String(item.id) === editingStepId);
    if (!card) { error.textContent = 'This task no longer exists. Reload the project and try again.'; return; }
    if (!window.confirm(`Delete task “${card.title}”? This removes it from the board and timeline without completing it.`)) return;
    try { window.deleteBoardSubtask(editingStepId); }
    catch (failure) { error.textContent = failure.message; return; }
    dialog.close();
    render();
    publishBoardUpdate();
    summary.textContent = 'Task deleted. ' + summary.textContent;
  };
  form.onsubmit = event => {
    event.preventDefault();
    if (!canFestival('lineup')) return;
    const updating = editingStepId !== null;
    const creatingArea = !updating && fields.area.value === newAreaOption;
    try {
      const details = {
        areaId:fields.area.value, taskId:fields.parent.value === 'new' ? '' : fields.parent.value,
        parentName:fields.parentName.value, title:fields.title.value,
        start:fields.start.value, end:fields.end.value
      };
      if (addingTimelineArea) {
        window.addTimelineWorkArea({ ...details, newAreaName: fields.areaName.value });
        dialog.close();
        return;
      }
      if (updating) {
        const ownerId = !fields.owner.disabled && fields.owner.value !== initialOwner ? fields.owner.value : undefined;
        window.updateBoardSubtask({ ...details, stepId: editingStepId, ownerId });
      }
      else window.addBoardSubtask({ ...details, newAreaName: creatingArea ? fields.areaName.value : undefined });
    } catch (failure) {
      error.textContent = failure.message;
      return;
    }
    dialog.close();
    search.value = '';
    areaSelect.value = creatingArea ? String(window.getSavedGanttPlan().at(-1).id) : fields.area.value;
    render();
    summary.textContent = (updating ? 'Task updated on the board and project timeline. ' : 'Task added to the board and project timeline. ') + summary.textContent;
  };
  window.addEventListener('task-assignments-changed', () => {
    if (!board.classList.contains('hidden')) render();
    publishBoardUpdate();
  });
  assigneeSelect.addEventListener('change', render);
  dueSoon.addEventListener('change', render);
  search.addEventListener('input', render);
  areaSelect.addEventListener('change', render);
})();
