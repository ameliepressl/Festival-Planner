// Festival Architect — the crew checklist page draws the checklist and saves ticks in the browser.
// The list itself and the progress calculation live in rules/checklist-rules.js.

(function () {
  const view = document.querySelector('#checklist-view');
  let checked = parseChecked(localStorage.getItem(CHECKLIST_STORAGE_KEY));

  function save() { localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(checked)); }

  function render() {
    const canEditChecklist = canFestival('checklist');
    view.innerHTML = `
      <section class="checklist-hero">
        <h1>Final checklist</h1>
        <p class="hero-copy">Tick each check on the event day, once it is confirmed on site. Preparation before the event belongs in Project tasks.</p>
      </section>
      <section class="checklist-progress" aria-label="Final checklist progress">
        <div class="checklist-progress-top"><span>Progress</span><strong id="checklist-percent"></strong></div>
        <div class="checklist-bar" id="checklist-bar" role="progressbar" aria-label="Final checklist progress" aria-valuemin="0" aria-valuemax="100"><div></div></div>
        <small id="checklist-summary"></small>
      </section>
      <div class="checklist-grid">
        ${CHECKLIST.map((group) => `
          <article class="checklist-card" data-group="${group.id}">
            <header>
              <h2>${group.title}</h2>
              <span class="checklist-count"></span>
            </header>
            <ul>
              ${group.tasks.map((task) => `
                <li><label><input type="checkbox" data-task="${task.id}" ${checked.includes(task.id) ? 'checked' : ''} ${canEditChecklist ? '' : 'disabled'} /><span>${task.text}</span></label></li>
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
    if (!canFestival('checklist')) {
      event.target.checked = checked.includes(taskId);
      return;
    }
    checked = toggleTask(checked, taskId);
    save();
    updateProgress();
  });

  render();
})();
