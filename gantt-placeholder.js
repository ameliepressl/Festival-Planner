// Gantt hierarchy, chart navigation and milestone links.
window.initialiseGanttOutline = function () {
  const chart = document.querySelector('#gantt-view');

  // Build hierarchy from the numbered rows; only parents with children get a toggle.
  const rows = Array.from(chart.querySelectorAll('tbody tr'));
  const parents = [];
  rows.forEach((row, index) => {
    const level = row.classList.contains('gantt-category') ? 1 : row.classList.contains('gantt-workstream') ? 2 : 3;
    row.dataset.level = level;
    row.id = `gantt-row-${index}`;
  });
  rows.forEach((row, index) => {
    const level = Number(row.dataset.level);
    const children = [];
    for (let i = index + 1; i < rows.length && Number(rows[i].dataset.level) > level; i++) children.push(rows[i]);
    if (!children.length) return;
    const heading = row.querySelector('th');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gantt-toggle';
    button.setAttribute('aria-expanded', String(window.ganttOutlineState?.[row.dataset.key] ?? (level === 1)));
    button.setAttribute('aria-controls', children.map(child => child.id).join(' '));
    const label = heading.textContent.trim().split('Final checklist:')[0].trim();
    function updateLabel() {
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.innerHTML = '<span class="gantt-chevron" aria-hidden="true">›</span>';
      button.title = `${expanded ? 'Collapse' : 'Expand'} ${label}`;
      button.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} ${label}`);
    }
    heading.prepend(button);
    parents.push({ row, button, children, updateLabel });
    button.addEventListener('click', () => {
      button.setAttribute('aria-expanded', String(button.getAttribute('aria-expanded') !== 'true'));
      updateLabel();
      updateVisibility();
    });
    updateLabel();
  });

  function updateVisibility() {
    rows.forEach(row => {
      row.hidden = parents.some(parent => parent.children.includes(row) && parent.button.getAttribute('aria-expanded') === 'false');
    });
    window.ganttOutlineState=Object.fromEntries(parents.map(p=>[p.row.dataset.key,p.button.getAttribute('aria-expanded')==='true']));
    updateOutlineState();
  }
  function updateOutlineState() {
    const areas=parents.filter(p=>p.row.dataset.level==='1');
    const tasks=parents.filter(p=>p.row.dataset.level==='2');
    const open=p=>p.button.getAttribute('aria-expanded')==='true';
    let mode='custom';
    if(areas.every(p=>!open(p)))mode='areas';
    else if(areas.every(open)&&tasks.every(p=>!open(p)))mode='tasks';
    else if(parents.every(open))mode='subtasks';
    chart.querySelectorAll('[data-outline]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.outline===mode)));
    chart.querySelector('#outline-state').textContent=mode==='custom'?'Custom':'';
  }
  chart.querySelectorAll('[data-outline]').forEach(button=>button.onclick=()=>{
    const mode=button.dataset.outline;
    parents.forEach(parent=>{
      const expanded=mode==='subtasks'||(mode==='tasks'&&parent.row.dataset.level==='1');
      parent.button.setAttribute('aria-expanded',String(expanded));
      parent.updateLabel();
    });
    updateVisibility();
  });
  updateVisibility();

  window.openGanttMilestone = function (taskId) {
    showSection('Gantt');
    const row = rows.find(item => item.dataset.key === 'task-' + taskId);
    if (!row) {
      document.querySelector('#back-task-board').focus();
      return;
    }
    const area = parents.find(parent => parent.row.dataset.level === '1' && parent.children.includes(row));
    if (area?.button.getAttribute('aria-expanded') === 'false') {
      area.button.setAttribute('aria-expanded', 'true');
      area.updateLabel();
      updateVisibility();
    }
    const heading = row.querySelector('th');
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: 'center', inline: 'nearest' });
  };
};
window.initialiseGanttOutline();

document.querySelector('#open-gantt').onclick = () => {
  showSection('Gantt');
  document.querySelector('#back-task-board').focus();
};
document.querySelector('#back-task-board').onclick = () => {
  showSection('Task board');
  document.querySelector('#open-gantt').focus();
};
