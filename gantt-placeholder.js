// Navigation only: the preliminary Gantt chart shows the approved preparation task breakdown.
window.initialiseGanttOutline = function () {
  const chart = document.querySelector('#gantt-view');
  const board = document.querySelector('#task-board-view');

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

  function openChart() {
    board.classList.add('hidden');
    chart.classList.remove('hidden');
    window.scrollTo(0, 0);
    document.querySelector('#back-task-board').focus();
  }
  function closeChart() {
    chart.classList.add('hidden');
    board.classList.remove('hidden');
    window.scrollTo(0, 0);
    document.querySelector('#open-gantt').focus();
  }
  document.querySelector('#open-gantt').onclick=openChart;
  document.querySelector('#back-task-board').onclick=closeChart;
  document.querySelectorAll('.sidebar-item').forEach(button => button.addEventListener('click', () => {
    if (['Lineup planner', 'Final checklist', 'Task board', 'Site map', 'Vendors'].includes(button.dataset.section)) chart.classList.add('hidden');
  }));
  window.ganttNavBound=true;
};
window.initialiseGanttOutline();
