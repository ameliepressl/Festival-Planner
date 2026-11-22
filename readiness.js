// One shared view of saved planning checks. These cards are derived, never a second
// copy of project data: fixing the source automatically resolves the linked task.
(function () {
  const overview = document.querySelector('#readiness-overview');
  const board = document.querySelector('#board-page');
  if (!overview || !board) return;
  const issuesPanel = document.createElement('section');
  issuesPanel.id = 'readiness-tasks';
  issuesPanel.className = 'readiness-tasks';
  issuesPanel.setAttribute('aria-label', 'Linked planning issues');
  const columns = document.querySelector('#work-board-columns');
  columns.before(issuesPanel);
  let current;

  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function collect() {
    const problem = window.getLineupDataProblem?.() || (window.isFestivalContextCurrent?.() === false ? 'The festival is changing in this browser or another tab. Reload before reviewing planning checks.' : '');
    if (problem) {
      const issue = { id: 'lineup-recovery', label: 'Recover saved festival data', detail: problem, section: 'Lineup planner', ok: false, unknown: true };
      return { score: null, passed: 0, total: 1, checks: [issue], issues: [issue] };
    }
    const shows = performances();
    return buildReadiness({
      event: state.event,
      lineup: {
        performances: shows.length,
        unconfirmed: shows.filter(booking => booking.status !== 'confirmed').length,
        spent: total(), budget: state.settings.budget, problems: planProblems(state)
      },
      mapChecks: window.getSavedMapReadiness?.(),
      finance: window.getReadinessFinance?.()
    });
  }

  function openSection(section) {
    const button = document.querySelector(`.sidebar-item[data-section="${section}"]`);
    button?.click();
    return Boolean(button?.classList.contains('active'));
  }

  function openIssue(id) {
    const issue = current?.issues.find(entry => entry.id === id);
    if (!issue) return;
    if (!openSection(issue.section)) return;
    // Section listeners first render the target page, then focus its relevant panel.
    const crowdIssue = issue.section === 'Site map' && /:(density-|evacuation|emergency-exits-available)/.test(issue.id);
    if (crowdIssue) {
      const disclosure = document.querySelector('#sm-crowd')?.closest('details');
      if (disclosure) disclosure.open = true;
    }
    const target = issue.section === 'Site map' ? crowdIssue ? '#sm-crowd' : '#sm-score'
      : issue.section === 'Finances' ? '#finance-view'
      : issue.section === 'Settings' ? '#settings-edit-festival' : '#calendar';
    const element = document.querySelector(target);
    element?.scrollIntoView({ block: 'center' });
    if (element) { element.setAttribute('tabindex', '-1'); element.focus({ preventScroll: true }); }
    toast(issue.detail || issue.label);
  }
  window.openPlanningIssue = openIssue;
  window.getFestivalReadiness = () => collect();

  function renderOverview(result) {
    if (result.score === null) {
      overview.replaceChildren(node('h2', 'Festival readiness unavailable'), node('p', 'Recover the saved festival data using the notice above before reviewing planning checks.'));
      return;
    }
    const expanded = overview.querySelector('details')?.open || false;
    overview.replaceChildren();
    const heading = node('div', undefined, 'readiness-heading');
    const score = node('strong', `${result.score}%`, 'readiness-score');
    const title = node('div');
    title.append(node('h2', 'Festival readiness'), node('p', `${result.passed} of ${result.total} planning checks passed`));
    const button = node('button', result.issues.length ? `View ${result.issues.length} linked tasks` : 'View planning checks', 'button secondary');
    button.type = 'button';
    button.onclick = () => {
      if (result.issues.length) {
        if (!openSection('Task board')) return;
        issuesPanel.querySelector('details').open = true;
        issuesPanel.scrollIntoView({ block: 'start' });
        issuesPanel.querySelector('summary').focus();
      } else overview.querySelector('details').open = true;
    };
    heading.append(score, title, button);
    const explanation = node('p', 'Checks festival details, lineup, site map and finances; each check counts the same. It shows planning progress and is not a safety approval.', 'field-help');
    const details = node('details', undefined, 'readiness-breakdown');
    details.open = expanded;
    details.append(node('summary', 'Check breakdown'));
    const list = node('ul');
    result.checks.forEach(check => {
      const item = node('li', undefined, check.ok ? 'is-passed' : 'is-open');
      const text = node('span', `${check.ok ? '✓' : check.unknown ? '?' : '•'} ${check.label}`);
      text.append(node('small', check.detail));
      item.append(text);
      if (!check.ok) {
        const fix = node('button', 'Open', 'button quiet');
        fix.type = 'button'; fix.onclick = () => openIssue(check.id); item.append(fix);
      }
      list.append(item);
    });
    details.append(list);
    overview.append(heading, explanation, details);
  }

  function renderTasks(result) {
    const previous = issuesPanel.querySelector('details');
    const expanded = previous ? previous.open : true;
    issuesPanel.replaceChildren();
    const details = node('details'); details.open = expanded;
    details.append(node('summary', `Planning issues · ${result.issues.length}`));
    details.append(node('p', 'These come from your plan and clear themselves once you fix them on the page they link to.', 'field-help'));
    if (!result.issues.length) details.append(node('p', 'All assessed planning checks pass.'));
    const list = node('ul', undefined, 'readiness-issue-list');
    result.issues.forEach(issue => {
      const item = node('li');
      item.dataset.planningIssue = issue.id;
      const content = node('div');
      content.append(node('strong', issue.label), node('small', `${issue.section} · ${issue.detail}`));
      const button = node('button', 'Open to resolve', 'button secondary');
      button.type = 'button'; button.onclick = () => openIssue(issue.id);
      item.append(content, button); list.append(item);
    });
    details.append(list); issuesPanel.append(details);
  }

  function refresh() {
    current = collect();
    renderOverview(current);
    renderTasks(current);
  }
  ['festival-plan-updated', 'festival-map-saved', 'festival-finance-saved', 'work-board-updated', 'festival-people-changed']
    .forEach(name => window.addEventListener(name, refresh));
  document.querySelectorAll('.sidebar-item').forEach(button => button.addEventListener('click', refresh));
  refresh();
})();
