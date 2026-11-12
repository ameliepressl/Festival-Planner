// Overview and navigation between the planner's sections.
const sectionViews = {
  Overview: $('#overview-view'),
  'Lineup planner': $('#lineup-view'),
  Checklist: $('#checklist-view'),
  'Task board': $('#task-board-view'),
  Gantt: $('#gantt-view')
};

function renderOverview() {
  const event = state.event;
  const checklist = progress(parseChecked(localStorage.getItem(CHECKLIST_STORAGE_KEY)));
  $('#overview-title').textContent = event.name || 'Overview';
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
  $('#overview-checklist').textContent = `${checklist.percent}%`;
  renderOverviewMilestones();
}

const milestoneDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit'
});

function renderOverviewMilestones() {
  const project = window.getGanttProject?.();
  $('#overview-milestones').hidden = !project;
  if (!project) return;
  const { year, month, day } = Object.fromEntries(
    milestoneDayFormatter.formatToParts(new Date()).map(part => [part.type, part.value])
  );
  const milestones = upcomingMilestones(project, `${year}-${month}-${day}`);
  $('#overview-milestone-list').innerHTML = milestones.map(({ id, title, date }) => `
    <li>
      <button type="button" data-milestone="${escapeHtml(id)}">
        <span>${escapeHtml(title)}</span>
        <time datetime="${date}">${dateText(date)} ${date.slice(0, 4)}</time>
      </button>
    </li>`).join('');
  $('#overview-milestone-empty').hidden = milestones.length > 0;
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
  const sidebarSection = section === 'Gantt' ? 'Task board' : section;
  document.querySelectorAll('.sidebar-item').forEach(button => {
    const selected = button.dataset.section === sidebarSection;
    button.classList.toggle('active', selected);
    if (selected) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  $('.plan-actions').classList.toggle('hidden', section !== 'Lineup planner');
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
    showSection(control.dataset.openSection);
    const heading = sectionViews[control.dataset.openSection].querySelector('h1');
    heading.setAttribute('tabindex', '-1');
    heading.focus();
  });
});

$('#overview-setup').onclick = openFestivalDetails;
$('#overview-edit').onclick = openFestivalDetails;
$('#overview-cancel').onclick = () => $('#overview-dialog').close();
$('#overview-dialog').addEventListener('close', () => {
  if (state.event.name) $('#overview-menu summary').focus();
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
  if (window.location.protocol === 'file:') {
    errorMessage.textContent = 'Start the local planner with python3 server.py and open http://127.0.0.1:8000/ to look up teammates.';
    return;
  }

  addButton.disabled = true;
  usernameInput.readOnly = true;
  roleInput.disabled = true;
  status.textContent = 'Checking username…';
  let user;
  try {
    const query = new URLSearchParams({ username });
    const response = await fetch(`/api/users?${query}`);
    if (response.status === 404) {
      errorMessage.textContent = 'Username not found. Check the spelling and try again.';
      return;
    }
    if (response.status === 400) {
      errorMessage.textContent = 'Enter a valid username.';
      return;
    }
    if (!response.ok) throw new Error('User directory unavailable');
    user = await response.json();
    if (!validText(user?.username, 64) || !Number.isSafeInteger(user.id) || user.id < 1) {
      throw new Error('Invalid user directory response');
    }
  } catch {
    errorMessage.textContent = 'Could not reach the user directory. Check that the local planner server is running and try again.';
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

$('#overview-milestone-list').addEventListener('click', ({ target }) => {
  const button = target.closest('[data-milestone]');
  if (button) window.openGanttMilestone?.(button.dataset.milestone);
});
window.addEventListener('gantt-project-changed', renderOverviewMilestones);

renderTeam();
renderOverview();
if (canFestival('overview') && !state.event.name && !state.final) openFestivalDetails();
