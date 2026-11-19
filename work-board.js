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

  const attention = document.querySelector('#needs-attention-list');
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
        ...step, area: area.title, areaStyle: area.style, areaId: String(area.id), task: task.title,
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

  window.getOverviewUrgentTasks = () => {
    const date = today();
    return urgentSteps(projectSteps(), date).slice(0, 3).map(({ id, title, area, end }) => ({
      id, title, area, end, deadline: deadlineText(end, date)
    }));
  };

  function renderAttention(steps, date) {
    const urgent = urgentSteps(steps, date);
    const previous = document.activeElement.closest('.work-board-urgent')?.dataset.cardId;
    const groups = [
      ['Overdue', urgent.filter(step => step.end < date)],
      ['Due today', urgent.filter(step => step.end === date)],
      ['Next 7 days', urgent.filter(step => step.end > date)]
    ];
    attention.replaceChildren();
    groups.forEach(([label, entries]) => {
      if (!entries.length) return;
      const group = element('section', 'work-board-urgent-group');
      const list = element('ul', 'work-board-urgent-list');
      entries.forEach(step => {
        const overdue = step.end < date;
        const button = element('button', 'work-board-urgent');
        button.type = 'button';
        button.dataset.cardId = step.id;
        button.style.cssText = step.areaStyle || '';
        const title = element('span', 'work-board-urgent-title', step.title);
        title.append(element('small', null, step.area));
        const deadline = element('time', overdue ? 'work-board-urgent-overdue' : null,
          deadlineText(step.end, date));
        deadline.dateTime = step.end;
        if (overdue) {
          const icon = element('span', 'work-board-urgent-icon', '⚠');
          icon.setAttribute('aria-hidden', 'true');
          deadline.prepend(icon);
        }
        button.append(title, deadline);
        const item = element('li');
        item.append(button);
        list.append(item);
      });
      group.append(element('h3', null, label), list);
      attention.append(group);
    });
    if (!urgent.length) attention.append(element('p', 'work-board-empty', 'No overdue subtasks or subtasks due in the next seven days.'));
    if (previous) Array.from(attention.querySelectorAll('button')).find(button => button.dataset.cardId === previous)?.focus();
  }

  function renderStats() {
    const date = today();
    const steps = projectSteps();
    renderAttention(steps, date);
    document.querySelector('#task-overview-total').textContent = steps.length + (steps.length === 1 ? ' subtask total' : ' subtasks total');
    const counts = {planned:0, progress:0, overdue:0, done:0};
    steps.forEach(step => counts[statusOf(step, date)]++);
    statValues.forEach(([id, value]) => {
      value.textContent = counts[id] + ' · ' + percent.format(steps.length ? counts[id] / steps.length : 0);
    });
  }

  function render() {
    renderedDate = today();
    const selection = areaSelect.value;
    const query = search.value.trim().toLowerCase();
    const plan = window.getSavedGanttPlan();
    const canEditTasks = canFestival('lineup');
    areaSelect.replaceChildren(new Option('All areas', ''));
    plan.forEach(area => areaSelect.add(new Option(area.title, String(area.id))));
    const cards = projectSteps(plan);
    areaSelect.value = selection;
    const visible = cards.filter(card => {
      const days = daysUntil(card.end, renderedDate);
      return (!selection || card.areaId === selection) &&
        (!dueSoon.checked || (days >= 0 && days <= 7 && statusOf(card, renderedDate) !== 'done')) &&
        [card.title, card.area, card.task, card.number].join(' ').toLowerCase().includes(query);
    });

    function move(id, status, focus = false) {
      if (!canFestival('lineup')) return false;
      const card = cards.find(card => card.id === id);
      if (card?.end < renderedDate && (saved[id]?.status ?? saved[id]) !== 'done' && status !== 'done') {
        summary.textContent = 'An overdue subtask stays overdue until it is done or its due date changes.';
        return false;
      }
      const previous = saved[id];
      const next = {...saved, [id]:status === 'done' ? {
        status, completedAt: previous?.status === 'done' ? previous.completedAt : Date.now()
      } : status};
      try { localStorage.setItem(key, JSON.stringify(next)); }
      catch { summary.textContent = 'Could not save the status in this browser.'; return false; }
      saved = next;
      render();
      publishBoardUpdate();
      if (focus) Array.from(columns.querySelectorAll('select')).find(control => control.dataset.cardId === id)?.focus();
      return true;
    }

    summary.textContent = visible.length === cards.length ? cards.length + ' subtasks' : visible.length + ' of ' + cards.length + ' subtasks';
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
          element('p','work-board-context',card.area + ' · ' + card.task),control);
        lane.append(item);
      });
      columns.append(lane);
    });
  }
  const overview = document.querySelector('#task-board-view');
  const board = document.querySelector('#board-page');
  let boardTrigger;
  overview.addEventListener('click', event => {
    const trigger = event.target.closest('.work-board-stat, .work-board-open, .work-board-urgent');
    if (!trigger) return;
    boardTrigger = trigger;
    overview.classList.add('hidden');
    board.classList.remove('hidden');
    window.scrollTo(0, 0);
    document.querySelector('#board-page-title').focus();
    search.value = '';
    areaSelect.value = '';
    dueSoon.checked = false;
    render();
    if (trigger.dataset.cardId) {
      const card = Array.from(columns.querySelectorAll('.work-board-card'))
        .find(item => item.dataset.cardId === trigger.dataset.cardId);
      card?.focus();
      card?.scrollIntoView({block:'center', inline:'nearest'});
    }
  });
  const projectTasksButton = document.querySelector('[data-section="Task board"]');
  window.openOverviewTask = id => {
    projectTasksButton.click();
    Array.from(attention.querySelectorAll('.work-board-urgent'))
      .find(button => button.dataset.cardId === String(id))?.click();
  };
  projectTasksButton.addEventListener('click', renderStats);
  document.querySelector('#back-board-overview').addEventListener('click', () => {
    projectTasksButton.click();
    const trigger = boardTrigger?.dataset.cardId
      ? Array.from(attention.querySelectorAll('.work-board-urgent'))
        .find(button => button.dataset.cardId === boardTrigger.dataset.cardId)
      : boardTrigger;
    (trigger ?? overview.querySelector('.work-board-open')).focus();
  });
  document.querySelector('#back-task-board').addEventListener('click', renderStats);
  window.addEventListener('gantt-project-changed', () => {
    if (!overview.classList.contains('hidden')) renderStats();
    publishBoardUpdate();
  });
  setInterval(() => {
    if (!overview.classList.contains('hidden')) renderStats();
    const date = today();
    if (date !== summaryDate) {
      summaryDate = date;
      publishBoardUpdate();
    }
  }, 60000);
  renderStats();
  setInterval(() => { if (!document.querySelector('#board-page').classList.contains('hidden') && today() !== renderedDate) render(); }, 60000);
  const dialog = document.querySelector('#board-create-dialog');
  const form = document.querySelector('#board-create-form');
  const fields = form.elements;
  const error = document.querySelector('#board-create-error');
  const addTaskButton = document.querySelector('#board-add-task');
  addTaskButton.hidden = !canFestival('lineup');

  function updateParentName() {
    const creating = fields.parent.value === 'new';
    document.querySelector('#board-parent-name').hidden = !creating;
    fields.parentName.disabled = !creating;
    fields.parentName.required = creating;
  }
  function updateParents() {
    const area = window.getSavedGanttPlan().find(item => String(item.id) === fields.area.value);
    fields.parent.replaceChildren(new Option('Choose a parent task', ''));
    if (area) {
      area.tasks.forEach(task => fields.parent.add(new Option(task.title, String(task.id))));
      fields.parent.add(new Option('+ Create a parent task', 'new'));
    }
    fields.parent.disabled = !area;
    updateParentName();
  }
  addTaskButton.onclick = () => {
    if (!canFestival('lineup')) return;
    form.reset();
    error.textContent = '';
    fields.area.replaceChildren(new Option('Choose an area', ''));
    window.getSavedGanttPlan().forEach(area => fields.area.add(new Option(area.title, String(area.id))));
    fields.area.value = areaSelect.value;
    updateParents();
    dialog.showModal();
  };
  fields.area.onchange = updateParents;
  fields.parent.onchange = updateParentName;
  document.querySelector('#board-create-cancel').onclick = () => dialog.close();
  form.onsubmit = event => {
    event.preventDefault();
    if (!canFestival('lineup')) return;
    try {
      window.addBoardSubtask({
        areaId:fields.area.value, taskId:fields.parent.value === 'new' ? '' : fields.parent.value,
        parentName:fields.parentName.value, title:fields.title.value,
        start:fields.start.value, end:fields.end.value
      });
    } catch (failure) {
      error.textContent = failure.message;
      return;
    }
    dialog.close();
    search.value = '';
    areaSelect.value = fields.area.value;
    render();
    summary.textContent = 'Task added to the board and project timeline. ' + summary.textContent;
  };
  dueSoon.addEventListener('change', render);
  search.addEventListener('input', render);
  areaSelect.addEventListener('change', render);
})();
