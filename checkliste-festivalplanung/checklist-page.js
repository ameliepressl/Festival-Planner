// Festival Architect — the Final checklist page: draws the checklist, saves ticks in the browser and
// switches between the lineup planner and the checklist when the left navigation is clicked.
// The list itself and the progress calculation live in rules/checklist-rules.js.

(function () {
  const view = document.querySelector('#checklist-view');
  const lineup = document.querySelector('main');
  let checked = parseChecked(localStorage.getItem(CHECKLIST_STORAGE_KEY));

  function save() { localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(checked)); }

  function render() {
    view.innerHTML = `
      <section class="checklist-hero">
        <p class="eyebrow">EVENT-DAY CHECKS</p>
        <h1>Final checklist</h1>
        <p class="hero-copy">On the event day, confirm each checkpoint on site before ticking it off. Advance preparation belongs in the task board. Review any previously saved ticks against these checks. Your progress saves automatically in this browser.</p>
      </section>
      <section class="checklist-progress" aria-label="Final checklist progress">
        <div class="checklist-progress-top"><span>FINAL CHECKLIST PROGRESS</span><strong id="checklist-percent"></strong></div>
        <div class="checklist-bar" id="checklist-bar" role="progressbar" aria-label="Final checklist progress" aria-valuemin="0" aria-valuemax="100"><div></div></div>
        <small id="checklist-summary"></small>
      </section>
      <div class="checklist-grid">
        ${CHECKLIST.map((group) => `
          <article class="checklist-card" data-group="${group.id}">
            <header>
              <span class="checklist-icon" aria-hidden="true">${group.icon}</span>
              <h2>${group.title}</h2>
              <span class="checklist-count"></span>
            </header>
            <ul>
              ${group.tasks.map((task) => `
                <li><label><input type="checkbox" data-task="${task.id}" ${checked.includes(task.id) ? 'checked' : ''} /><span>${task.text}</span></label></li>
              `).join('')}
            </ul>
          </article>`).join('')}
      </div>`;
    updateProgress();
  }

  // Only the numbers and the bar change when a box is ticked, so the page does not jump.
  function updateProgress() {
    const overall = progress(checked);
    view.querySelector('#checklist-percent').textContent = `${overall.percent}%`;
    view.querySelector('#checklist-bar').setAttribute('aria-valuenow', overall.percent);
    view.querySelector('#checklist-bar div').style.width = `${overall.percent}%`;
    view.querySelector('#checklist-summary').textContent =
      `${overall.done} of ${overall.total} tasks done${overall.percent === 100 ? ' · all listed checks confirmed' : ''}`;
    view.querySelectorAll('.checklist-card').forEach((card) => {
      const team = progressOf(card.dataset.group, checked);
      card.querySelector('.checklist-count').textContent = `${team.done}/${team.total}`;
      card.classList.toggle('complete', team.done === team.total);
    });
  }

  view.addEventListener('change', (event) => {
    const taskId = event.target.dataset.task;
    if (!taskId) return;
    checked = toggleTask(checked, taskId);
    save();
    updateProgress();
  });

  // Left navigation: "Final checklist" shows this page, "Lineup planner" shows the planner again.
  function show(section) {
    const onChecklist = section === 'Final checklist';
    view.classList.toggle('hidden', !onChecklist);
    lineup.classList.toggle('hidden', section !== 'Lineup planner');
    document.querySelector('#task-board-view').classList.toggle('hidden', section !== 'Task board');
    document.querySelectorAll('.sidebar-item').forEach(button => button.classList.toggle('active', button.dataset.section === section));
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('.sidebar-item').forEach((button) => button.addEventListener('click', () => {
    if (['Lineup planner', 'Final checklist', 'Task board', 'Site map', 'Vendors', 'Finances'].includes(button.dataset.section)) show(button.dataset.section);
  }));

  render();
})();
