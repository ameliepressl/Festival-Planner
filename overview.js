// Overview and navigation between the planner's sections.
const sectionViews = {
  Overview: $('#overview-view'),
  Settings: $('#settings-view'),
  'Lineup planner': $('#lineup-view'),
  'Final checklist': $('#checklist-view'),
  'Task board': $('#task-board-view'),
  'Site map': $('#site-map-view'),
  Vendors: $('#vendors-view'),
  Finances: $('#finance-view')
};

function renderProjectSettings() {
    $('#project-settings-summary').textContent = [state.event.name, state.event.venue, $('#overview-dates').textContent, $('#overview-hours').textContent].filter(Boolean).join(' · ');
    $('#settings-edit-festival').hidden = !canFestival('overview') || state.final;
    $('#project-settings-help').textContent = !canFestival('overview') ? 'The festival creator and Admins can edit festival details.' : state.final ? 'The plan is finalised. Reopen it before changing festival details.' : '';
}

function renderOverview() {
  const event = state.event;
  $('#overview-title').textContent = event.name || 'Untitled festival';
  $('#overview-venue').textContent = event.venue || '';
  $('#overview-venue-fact').hidden = !event.venue;
  const firstDay = `${dateText(event.startDate)} ${event.startDate.slice(0, 4)}`;
  const lastDay = `${dateText(event.endDate)} ${event.endDate.slice(0, 4)}`;
  $('#overview-dates').textContent = firstDay === lastDay ? firstDay : `${firstDay} – ${lastDay}`;
  const hasCustomHours = Object.keys(event.dayHours || {}).length > 0;
  $('#overview-hours').textContent = `${timeText(event.startMinutes)}–${timeText(event.endMinutes)}${event.endMinutes > 1440 ? ' (+1 day)' : ''}${hasCustomHours ? ' (default)' : ''}`;
  $('#overview-menu').hidden = true;
  const canEditOverview = canFestival('overview');
  $('#overview-setup').hidden = !canEditOverview || Boolean(event.name) || state.final;
  $('#overview-final').hidden = !canEditOverview || !state.final;
  const bookings = performances();
  const confirmed = bookings.filter(booking => booking.status === 'confirmed').length;
  $('#overview-performances').textContent = bookings.length;
  $('#overview-booking-status').textContent = `${confirmed} confirmed · ${bookings.length - confirmed} tentative`;
  $('#overview-budget').textContent = euros(state.settings.budget - total());
  $('#overview-budget-total').textContent = `of ${euros(state.settings.budget)}`;
  $('#lineup-venue').textContent = event.venue || 'Not set';
  $('#lineup-dates').textContent = $('#overview-dates').textContent;
  $('#lineup-hours').textContent = $('#overview-hours').textContent;
  renderProjectSettings();
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

function renderOverviewTaskProgress() {
  const tasks = window.getOverviewTaskProgress?.();
  if (!tasks) return;
  $('#overview-tasks-done').textContent = tasks.total ? `${Math.round((tasks.done / tasks.total) * 100)}%` : '–';
  $('#overview-tasks-count').textContent = `${tasks.done} of ${tasks.total} tasks`;
}

function renderOverviewTasks() {
  renderOverviewTaskProgress();
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
  $('#overview-dialog-title').textContent = event.name ? 'Edit festival details' : 'Set up festival';
  $('#festival-name').value = event.name || '';
  $('#festival-venue').value = event.venue || '';
  const fresh = !event.name && !state.bookings.length && !localStorage.getItem('festival-gantt-project-v1');
  const today = typeof projectToday === 'function' ? projectToday() : freshFestivalEvent().startDate;
  $('#festival-start-date').value = fresh ? today : event.startDate;
  $('#festival-end-date').value = fresh ? freshFestivalEvent().endDate : event.endDate;
  $('#festival-budget').value = state.settings.budget;
  $('#festival-budget').disabled = !canFestival('budget');
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
  if (section === 'Task board') window.showProjectTaskView?.('board');
  document.querySelectorAll('.sidebar-item').forEach(button => {
    const selected = button.dataset.section === section;
    button.classList.toggle('active', selected);
    if (selected) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  $('.lineup-actions').classList.toggle('hidden', section !== 'Lineup planner');
  $('.festival-meta').classList.toggle('hidden', section === 'Overview');
  if (section === 'Overview' || section === 'Settings' || section === 'Lineup planner') renderOverview();
  window.scrollTo(0, 0);
}

document.querySelectorAll('.sidebar-item').forEach(button => {
  button.addEventListener('click', () => {
    const section = button.dataset.section;
    if (!section) return; // Sign out has its own account handler, not a page destination.
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
$('#settings-edit-festival').onclick = openFestivalDetails;
$('#overview-cancel').onclick = () => $('#overview-dialog').close();
$('#festival-start-date').addEventListener('change', () => {
  const first = $('#festival-start-date').value;
  const last = $('#festival-end-date');
  if (first && (!last.value || last.value < first)) last.value = first;
});
$('#overview-dialog').addEventListener('close', () => {
  if (!$('#settings-view').classList.contains('hidden')) $('#settings-edit-festival').focus();
  else if (state.event.name) document.querySelector('[data-section="Settings"]').focus();
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
    endMinutes: closingMinutes(closingTime, inputMinutes($('#festival-open').value))
  };
  $('#overview-status').textContent = '';
  const updatedEvent = updatedFestivalEvent(details, state.event);
  const problem = eventChangeProblem(updatedEvent, state);
  $('#overview-error').textContent = problem;
  if (problem) return;

  // The artist budget is the organiser's own number (any amount from €0).
  const budget = canFestival('budget') ? Number($('#festival-budget').value) : state.settings.budget;
  if ($('#festival-budget').value === '' || !Number.isFinite(budget) || budget < 0) {
    $('#overview-error').textContent = 'Enter an artist booking budget of €0 or more.';
    return;
  }

  const previousPlan = state;
  let previousSavedPlan;
  const nextPlan = { ...state, event: updatedEvent, settings: { ...state.settings, budget } };
  try {
    previousSavedPlan = localStorage.getItem(STORAGE_KEY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPlan));
  } catch {
    $('#overview-error').textContent = 'Could not save festival details in this browser.';
    return;
  }
  state = nextPlan;
  if (window.refreshGanttFestivalDates?.() === false) {
    state = previousPlan;
    try {
      if (previousSavedPlan === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, previousSavedPlan);
    } catch {}
    $('#overview-error').textContent = 'Could not save the project timeline. Your previous festival details are kept; try again when browser storage is available.';
    return;
  }
  render();
  $('#overview-dialog').close();
  renderOverview();
  $('#overview-status').textContent = 'Festival details saved.';
  window.refreshFestivalName?.();
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
  $('#overview-team-title').textContent = canManageTeam ? 'Manage team' : 'View team';
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
