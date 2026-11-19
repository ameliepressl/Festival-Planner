// Overview and navigation between the planner's sections.
const sectionViews = {
  Overview: $('#overview-view'),
  'Lineup planner': $('#lineup-view'),
  'Final checklist': $('#checklist-view'),
  'Task board': $('#task-board-view'),
  'Site map': $('#site-map-view'),
  Vendors: $('#vendors-view'),
  Finances: $('#finance-view')
};

function renderOverview() {
  const event = state.event;
  const checklist = progress(parseChecked(localStorage.getItem(CHECKLIST_STORAGE_KEY)));
  $('#overview-title').textContent = event.name || 'Overview';
  $('#overview-tagline').textContent = event.name ? festivalTagline(event) : '';
  $('#overview-venue').textContent = event.venue || '';
  $('#overview-venue-fact').hidden = !event.venue;
  const firstDay = `${dateText(event.startDate)} ${event.startDate.slice(0, 4)}`;
  const lastDay = `${dateText(event.endDate)} ${event.endDate.slice(0, 4)}`;
  $('#overview-dates').textContent = firstDay === lastDay ? firstDay : `${firstDay} – ${lastDay}`;
  const hasCustomHours = Object.keys(event.dayHours || {}).length > 0;
  $('#overview-hours').textContent = `${timeText(event.startMinutes)}–${timeText(event.endMinutes)}${hasCustomHours ? ' (default)' : ''}`;
  const canEditOverview = canFestival('overview');
  $('#overview-setup').hidden = !canEditOverview || Boolean(event.name) || state.final;
  $('#overview-menu').hidden = !canEditOverview || !event.name || state.final;
  $('#overview-menu').open = false;
  $('#overview-final').hidden = !canEditOverview || !state.final;
  const bookings = performances();
  const confirmed = bookings.filter(booking => booking.status === 'confirmed').length;
  $('#overview-performances').textContent = bookings.length;
  $('#overview-booking-status').textContent = `${confirmed} confirmed · ${bookings.length - confirmed} tentative`;
  $('#overview-budget').textContent = euros(state.settings.budget - total());
  $('#overview-budget-total').textContent = `of ${euros(state.settings.budget)}`;
  $('#overview-checklist').textContent = `${checklist.percent}%`;
  $('#overview-checklist-count').textContent = `${checklist.done} of ${checklist.total} checks`;
  renderOverviewFinance();
  renderOverviewTasks();
}

function renderOverviewFinance() {
  const finance = window.getOverviewFinance?.();
  if (!finance) return;
  $('#overview-revenue').textContent = euros(finance.totalRevenue);
  $('#overview-costs').textContent = euros(finance.totalCosts);
  const loss = finance.profit < 0;
  $('#overview-profit-label').textContent = loss ? 'Projected loss' : 'Projected profit';
  $('#overview-profit').textContent = euros(finance.profit);
  $('#overview-profit').classList.toggle('is-loss', loss);
}

// The orange second line of the headline: how long until the festival (Lisbon date).
function festivalTagline(event) {
  if (typeof festivalCountdown !== 'function') return '';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  try {
    const { days, status } = festivalCountdown(today, event.startDate, event.endDate);
    if (status === 'today') return 'Gates open today.';
    if (status === 'ongoing') return 'Happening right now.';
    if (status === 'ended') return 'That’s a wrap.';
    return days === 1 ? '1 day to go.' : `${days} days to go.`;
  } catch {
    return '';
  }
}

function renderOverviewTaskProgress() {
  const tasks = window.getOverviewTaskProgress?.();
  if (!tasks) return;
  $('#overview-tasks-done').textContent = tasks.total ? `${Math.round((tasks.done / tasks.total) * 100)}%` : '–';
  $('#overview-tasks-count').textContent = `${tasks.done} of ${tasks.total} tasks`;
}

// Overview → Team progress (feature-plans/task-assignments.md).
const progressDate = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
function renderOverviewProgress() {
  const progress = window.getOverviewTeamProgress?.();
  $('#overview-progress').hidden = !progress;
  if (!progress) return;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  $('#overview-progress-rows').innerHTML = progress.people.map(person => {
    const name = escapeHtml(person.username) + (person.isMe ? ' <small>(you)</small>' : '');
    const next = person.next
      ? `<span class="${person.next.end < today ? 'is-overdue' : ''}">${escapeHtml(person.next.title)}<small>${escapeHtml(progressDate.format(new Date(person.next.end + 'T12:00:00Z')))}</small></span>`
      : '<span class="overview-muted">—</span>';
    return `
    <tr>
      <th scope="row"><button type="button" data-progress-assignee="${person.isMe ? 'me' : escapeHtml(person.userId)}" aria-label="Show the subtasks of ${escapeHtml(person.username)} on the Task board">${name}</button></th>
      <td>${person.assigned}</td>
      <td><span class="overview-progress-bar" aria-hidden="true"><span style="width:${person.percent}%"></span></span>${person.done} · ${person.percent}%</td>
      <td class="${person.overdue ? 'is-overdue' : ''}">${person.overdue}</td>
      <td>${next}</td>
    </tr>`;
  }).join('');
  const unassigned = $('#overview-unassigned');
  unassigned.hidden = progress.unassigned === 0;
  unassigned.innerHTML = `${progress.unassigned} ${progress.unassigned === 1 ? 'subtask' : 'subtasks'} without a person<span aria-hidden="true">↗</span>`;
  const nothingAssigned = progress.people.every(person => person.assigned === 0);
  $('#overview-progress-help').textContent = !window.taskAssignments?.canAssign()
    ? 'The festival creator and Admins assign the tasks.'
    : nothingAssigned
      ? 'No tasks are assigned yet. Choose an owner per task in Project tasks → Gantt chart (Owner column).'
      : 'Choose an owner per task in the Gantt chart’s Owner column; change single subtasks on the Task board.';
}
document.querySelector('#overview-progress').addEventListener('click', ({ target }) => {
  const person = target.closest('[data-progress-assignee]');
  if (person) window.openTaskBoard?.({ assignee: person.dataset.progressAssignee });
  else if (target.closest('#overview-unassigned')) window.openTaskBoard?.({ assignee: 'none' });
});

function renderOverviewTasks() {
  renderOverviewTaskProgress();
  renderOverviewProgress();
  const tasks = window.getOverviewUrgentTasks?.();
  if (!tasks) return;
  $('#overview-task-list').innerHTML = tasks.map(({ id, title, area, end, deadline }) => `
    <li>
      <button type="button" data-overview-task="${escapeHtml(id)}">
        <span>${escapeHtml(title)}<small>${escapeHtml(area)}</small></span>
        <time datetime="${escapeHtml(end)}">${escapeHtml(deadline)}</time>
      </button>
    </li>`).join('');
  $('#overview-task-empty').hidden = tasks.length > 0;
}

function openFestivalDetails() {
  if (!writable('overview')) return;
  const event = state.event;
  $('#overview-menu').open = false;
  $('#overview-dialog-title').textContent = event.name ? 'Edit festival details' : 'Set up festival';
  $('#festival-name').value = event.name || '';
  $('#festival-venue').value = event.venue || '';
  $('#festival-start-date').value = event.startDate;
  $('#festival-end-date').value = event.endDate;
  $('#festival-open').value = timeText(event.startMinutes);
  $('#festival-close').value = timeText(event.endMinutes);
  $('#overview-custom-hours').hidden = !Object.keys(event.dayHours || {}).length;
  $('#overview-error').textContent = '';
  $('#overview-status').textContent = '';
  $('#overview-dialog').showModal();
}

function showSection(section) {
  for (const [name, view] of Object.entries(sectionViews)) {
    view.classList.toggle('hidden', name !== section);
  }
  $('#board-page').classList.add('hidden');
  $('#gantt-view').classList.add('hidden');
  document.querySelectorAll('.sidebar-item').forEach(button => {
    const selected = button.dataset.section === section;
    button.classList.toggle('active', selected);
    if (selected) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  $('.lineup-actions').classList.toggle('hidden', section !== 'Lineup planner');
  $('.festival-meta').classList.toggle('hidden', section === 'Overview');
  if (section === 'Overview') renderOverview();
  window.scrollTo(0, 0);
}

document.querySelectorAll('.sidebar-item').forEach(button => {
  button.addEventListener('click', () => {
    const section = button.dataset.section;
    if (Object.hasOwn(sectionViews, section)) showSection(section);
    else toast(`${section} will be added in a later feature branch.`);
  });
});
document.querySelectorAll('[data-open-section]').forEach(control => {
  control.addEventListener('click', event => {
    event.preventDefault();
    const section = control.dataset.openSection;
    document.querySelector(`.sidebar-item[data-section="${section}"]`).click();
    const heading = sectionViews[section].querySelector('h1');
    heading?.setAttribute('tabindex', '-1');
    heading?.focus();
  });
});

$('#overview-setup').onclick = openFestivalDetails;
$('#overview-edit').onclick = openFestivalDetails;
$('#overview-cancel').onclick = () => $('#overview-dialog').close();
$('#overview-dialog').addEventListener('close', () => {
  if (state.event.name) $('#overview-edit').focus();
  else $('#overview-setup').focus();
});
$('#overview-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!writable('overview')) return;

  const closingTime = $('#festival-close').value.trim();
  const details = {
    name: $('#festival-name').value.trim(),
    venue: $('#festival-venue').value.trim(),
    startDate: $('#festival-start-date').value,
    endDate: $('#festival-end-date').value,
    startMinutes: inputMinutes($('#festival-open').value),
    endMinutes: closingTime === '24:00' ? 1440 : inputMinutes(closingTime)
  };
  $('#overview-status').textContent = '';
  const updatedEvent = updatedFestivalEvent(details, state.event);
  const problem = eventChangeProblem(updatedEvent, state);
  $('#overview-error').textContent = problem;
  if (problem) return;

  const nextPlan = { ...state, event: updatedEvent };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPlan));
  } catch {
    $('#overview-error').textContent = 'Could not save festival details in this browser.';
    return;
  }
  state = nextPlan;
  window.refreshGanttFestivalDates?.();
  render();
  $('#overview-dialog').close();
  renderOverview();
  $('#overview-status').textContent = 'Festival details saved.';
});

const TEAM_STORAGE_KEY = 'festival-architect-team-v1';
function loadTeam() {
  try {
    const saved = JSON.parse(localStorage.getItem(TEAM_STORAGE_KEY));
    if (Array.isArray(saved)) {
      return saved.filter(member => validText(member?.username, 64) && Object.hasOwn(TEAM_PERMISSIONS, member.role));
    }
  } catch {}
  return [];
}

let team = loadTeam();
let teammateToRemove = null;

function renderTeam() {
  const canManageTeam = canFestival('team');
  $('#team-form').classList.toggle('hidden', !canManageTeam);
  $('#team-rows').innerHTML = [FESTIVAL_CREATOR, ...team].map(({ username, role }, rowIndex) => {
    const index = rowIndex - 1;
    const canChangeMember = canManageTeam && rowIndex > 0;
    const name = escapeHtml(username);
    return `
      <tr>
        <th scope="row">${name}</th>
        <td>${canChangeMember ? `<select data-team-index="${index}" aria-label="Role for ${name}">
          ${Object.keys(TEAM_PERMISSIONS).map(option => `<option${option === role ? ' selected' : ''}>${option}</option>`).join('')}
        </select>` : role}</td>
        <td>${TEAM_PERMISSIONS[role].description}</td>
        <td>${canChangeMember ? `<button type="button" class="button quiet" data-remove-member="${index}" aria-label="Remove ${name}">Remove</button>` : ''}</td>
      </tr>`;
  }).join('');
}

function saveTeam(nextTeam, message) {
  if (!canFestival('team')) return false;
  $('#team-error').textContent = '';
  $('#team-status').textContent = '';
  try {
    localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(nextTeam));
  } catch {
    $('#team-error').textContent = 'Could not save the team in this browser.';
    return false;
  }
  team = nextTeam;
  renderTeam();
  $('#team-status').textContent = message;
  return true;
}

$('#team-form').addEventListener('submit', async event => {
  event.preventDefault();
  const addButton = $('#team-add');
  if (!canFestival('team') || addButton.disabled) return;
  const usernameInput = $('#team-username');
  const roleInput = $('#team-role');
  const username = usernameInput.value.trim();
  const role = roleInput.value;
  const errorMessage = $('#team-error');
  const status = $('#team-status');
  status.textContent = '';
  errorMessage.textContent = '';

  if (!validText(username, 64)) {
    errorMessage.textContent = 'Enter a username of 1–64 characters.';
    return;
  }
  if (!Object.hasOwn(TEAM_PERMISSIONS, role)) return;

  addButton.disabled = true;
  usernameInput.readOnly = true;
  roleInput.disabled = true;
  status.textContent = 'Checking username…';
  let user;
  try {
    // The user directory is the list of accounts in Supabase (account/account.js).
    if (typeof window.lookupTeammate !== 'function') throw new Error('User directory unavailable');
    const result = await window.lookupTeammate(username);
    if (result?.status === 'not-found') {
      errorMessage.textContent = 'Username not found. Check the spelling and try again.';
      return;
    }
    if (result?.status === 'invalid') {
      errorMessage.textContent = 'Enter a valid username.';
      return;
    }
    if (result?.status !== 'found') throw new Error('User directory unavailable');
    user = result.user;
    if (!validText(user?.username, 64) || typeof user.id !== 'string' || !user.id) {
      throw new Error('Invalid user directory response');
    }
  } catch {
    errorMessage.textContent = 'Could not reach the user directory. Check your internet connection and try again.';
    return;
  } finally {
    addButton.disabled = false;
    usernameInput.readOnly = false;
    roleInput.disabled = false;
    status.textContent = '';
  }

  if (team.some(member => member.userId === user.id || member.username.toLowerCase() === user.username.toLowerCase())) {
    errorMessage.textContent = 'This username is already on the team.';
    return;
  }
  if (saveTeam([...team, { userId: user.id, username: user.username, role }], 'Teammate added.')) {
    usernameInput.value = '';
    usernameInput.focus();
  }
});

$('#team-rows').addEventListener('change', ({ target }) => {
  if (!canFestival('team') || target.dataset.teamIndex === undefined) return;
  const index = Number(target.dataset.teamIndex);
  const role = target.value;
  if (!team[index] || !Object.hasOwn(TEAM_PERMISSIONS, role)) return;
  const nextTeam = team.map((member, i) => i === index ? { ...member, role } : member);
  if (saveTeam(nextTeam, 'Role updated.')) {
    $(`[data-team-index="${index}"]`).focus();
  } else {
    target.value = team[index].role;
  }
});

const removeTeammateDialog = $('#remove-teammate-dialog');
$('#team-rows').addEventListener('click', ({ target }) => {
  if (!canFestival('team') || target.dataset.removeMember === undefined) return;
  const member = team[Number(target.dataset.removeMember)];
  if (!member) return;
  teammateToRemove = member;
  $('#remove-teammate-description').textContent = `Are you sure you want to remove ${member.username} from this festival team?`;
  removeTeammateDialog.showModal();
});

$('#cancel-remove-teammate').onclick = () => removeTeammateDialog.close();
removeTeammateDialog.addEventListener('close', () => { teammateToRemove = null; });
$('#remove-teammate-form').addEventListener('submit', event => {
  event.preventDefault();
  const member = teammateToRemove;
  teammateToRemove = null;
  removeTeammateDialog.close();
  if (!canFestival('team') || !team.includes(member)) return;
  if (saveTeam(team.filter(teammate => teammate !== member), 'Teammate removed.')) {
    $('#team-username').focus();
  }
});

$('#overview-task-list').addEventListener('click', ({ target }) => {
  const button = target.closest('[data-overview-task]');
  if (button) window.openOverviewTask?.(button.dataset.overviewTask);
});
window.addEventListener('work-board-updated', renderOverviewTasks);

renderTeam();
renderOverview();
// First-time setup: wait until the signed-in account's plan is shown (account/account.js).
const openFirstSetup = () => {
  if (canFestival('overview') && !state.event.name && !state.final) openFestivalDetails();
};
if (typeof window.whenAccountReady === 'function') window.whenAccountReady(openFirstSetup);
else openFirstSetup();
