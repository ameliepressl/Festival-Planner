// Navigation only: the preliminary Gantt chart shows the approved preparation task breakdown.
(function () {
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
    button.setAttribute('aria-expanded', String(level === 1));
    button.setAttribute('aria-controls', children.map(child => child.id).join(' '));
    const label = heading.textContent.trim().split('Final checklist:')[0].trim();
    function updateLabel() {
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.textContent = expanded ? '▾' : '▸';
      button.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} ${label}`);
    }
    heading.prepend(button);
    parents.push({ row, button, children });
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
  }
  function setAll(expanded) {
    parents.forEach(({button}) => {
      if ((button.getAttribute('aria-expanded') === 'true') !== expanded) button.click();
    });
  }
  document.querySelector('#gantt-expand-all').addEventListener('click', () => setAll(true));
  document.querySelector('#gantt-collapse-all').addEventListener('click', () => setAll(false));
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
  document.querySelector('#open-gantt').addEventListener('click', openChart);
  document.querySelector('#back-task-board').addEventListener('click', closeChart);
  document.querySelectorAll('.sidebar-item').forEach(button => button.addEventListener('click', () => {
    if (['Lineup planner', 'Final checklist', 'Task board'].includes(button.dataset.section)) chart.classList.add('hidden');
  }));
})();
