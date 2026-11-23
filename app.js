// Planner screen: controls and rendering. Scheduling and backup rules live in rules/festival-rules.js.
const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const euros = value => new Intl.NumberFormat('en-IE', {style:'currency',currency:'EUR',maximumFractionDigits:0}).format(value);
const STORAGE_KEY = 'festival-architect-v2';
let lineupLoadProblem = '', originalLineupText = null, lineupRecoveryNotice = null;
window.getLineupDataProblem = () => lineupLoadProblem;

function savedLineupStructureProblem(source) {
  if (!isObject(source)) return 'The saved lineup is not a plan object.';
  for (const key of ['artists', 'bookings']) {
    if (source[key] !== undefined && !Array.isArray(source[key])) return `The saved ${key} list is invalid.`;
  }
  if ((source.artists?.length || 0) > 1000 || (source.bookings?.length || 0) > 10000) return 'The saved lineup contains too many artists or appointments.';
  if (source.final !== undefined && typeof source.final !== 'boolean') return 'The saved final-plan setting is invalid.';
  if (source.artists?.some(artist => !isObject(artist)) || source.bookings?.some(booking => !isObject(booking))) return 'The saved artist or appointment list contains an invalid entry.';
  if ((source.settings !== undefined && !isObject(source.settings)) || (source.event !== undefined && !isObject(source.event))) return 'The saved festival details or planning settings are invalid.';
  const artists = catalogueForSavedPlan(source);
  const ids = new Set(artists.map(artist => artist.id));
  if (source.bookings?.some(booking => booking.type !== 'block' && !ids.has(booking.artistId))) return 'A saved performance refers to an artist missing from its catalogue.';
  return '';
}

function loadedLineupProblem(plan) {
  // Check safe data structure without rejecting repairable scheduling conflicts.
  // Missing colours and an unnamed older project remain readable.
  const event = { ...plan.event };
  if (event.name === '') delete event.name;
  const structural = planProblems({ ...plan, event, bookings: [],
    artists: plan.artists.map(artist => ({ ...artist, colour: safeArtistColour(artist.colour) })) });
  if (structural.length) return structural[0];
  const dates = eventDays(plan.event), stageIds = planStages(plan), ids = new Set();
  for (const booking of plan.bookings) {
    if (!(validId(booking.id) || (booking.type === 'block' && validId(booking.linkedTo) && booking.id === `changeover-${booking.linkedTo}`)) || ids.has(booking.id)) return 'A saved appointment identifier is invalid or duplicated.';
    ids.add(booking.id);
    if (!dates.includes(booking.date) || !stageIds.includes(booking.stage) || !Number.isInteger(booking.start) || booking.start < 0 || booking.start >= 2880 || !Number.isInteger(booking.duration) || booking.duration < 1 || booking.duration > 1440 || !validText(booking.notes, 2000, true)) return 'A saved appointment has invalid dates, stage, time or notes.';
    if (booking.type === 'block') {
      if (!validText(booking.title, booking.linkedTo ? 120 : 100)) return 'A saved calendar block has an invalid title.';
      if (booking.linkedTo !== undefined && (!validId(booking.linkedTo) || !plan.bookings.some(parent => parent.id === booking.linkedTo && isPerformance(parent)))) return 'A saved changeover refers to a missing performance.';
    } else if ((booking.type !== undefined && booking.type !== 'performance') || !Number.isFinite(booking.fee) || booking.fee < 0 || !['tentative', 'confirmed'].includes(booking.status) || !Number.isInteger(booking.changeover) || booking.changeover < 0 || booking.changeover > 1440) return 'A saved performance has invalid fee, status or changeover details.';
  }
  if (!Number.isFinite(plan.bookings.reduce((sum, booking) => sum + entryFee(booking, plan), 0))) return 'The combined saved performance fees are too large.';
  return '';
}
function loadState() {
  lineupLoadProblem = '';
  try {
    originalLineupText = localStorage.getItem(STORAGE_KEY);
    let saved = null;
    if (originalLineupText !== null) {
      if (originalLineupText.length > 5 * 1024 * 1024) throw new Error('The saved lineup is larger than the supported 5 MB.');
      try { saved = JSON.parse(originalLineupText); } catch { throw new Error('The saved lineup is not valid JSON.'); }
      const problem = savedLineupStructureProblem(saved);
      if (problem) throw new Error(problem);
    }
    const plan = normalizePlan(saved);
  // The one-time migrations below change the festival details. Only the festival creator and
  // Admins may change those (the database refuses it for Editors, migrations/006), so an
  // Editor shows the details exactly as saved and leaves the migration to them.
  const mayChangeDetails = canFestival('overview') && canFestival('budget');
  // One-time migrations from the removed availability editor; backups retain their saved hours.
  if (mayChangeDetails && !plan.dailyHoursResetV1) {
    plan.event.startMinutes = DEFAULT_EVENT.startMinutes;
    plan.event.endMinutes = DEFAULT_EVENT.endMinutes;
    delete plan.event.dayHours;
    plan.dailyHoursResetV1 = true;
  }
  if (mayChangeDetails && !plan.stageHoursResetV1) {
    for (const hours of Object.values(plan.event.dayHours || {})) delete hours.stages;
    plan.stageHoursResetV1 = true;
  }
  // Move the existing example festival with the revised demo dates.
  if (mayChangeDetails && plan.event.name === 'Lisbon Sound Festival' && plan.event.startDate === '2026-12-30' && plan.event.endDate === '2026-12-31') {
    const shift = date => new Date(Date.parse(date + 'T12:00:00Z') + 80 * 86400000).toISOString().slice(0, 10);
    plan.event.startDate = shift(plan.event.startDate);
    plan.event.endDate = shift(plan.event.endDate);
    plan.bookings.forEach(booking => { booking.date = shift(booking.date); });
    if (plan.event.dayHours) plan.event.dayHours = Object.fromEntries(Object.entries(plan.event.dayHours).map(([date, hours]) => [shift(date), hours]));
  }
    const problem = loadedLineupProblem(plan);
    if (problem) throw new Error(problem);
    return plan;
  } catch (error) {
    lineupLoadProblem = error.message || 'The saved lineup could not be read safely.';
    const placeholder = normalizePlan(null);
    placeholder.artists = [];
    return placeholder;
  }
}
let state = loadState();
let currentDay = state.event.startDate;
let lineupView = "festival";
let selectedArtistId = null, editingId = null, editingArtistId = null, editingBlockId = null;
let pendingBudgetChange = null, pendingRestore = null, suggestedStart = null, selectedSlot = null;
// Commit first; a rejected write must not leave a different live plan on screen.
function save(next = state) {
  if (lineupLoadProblem) { toast('The saved lineup needs recovery. Its original data has been kept unchanged.'); return false; }
  // Without a saved lineup, the first save would also create the festival details, which only
  // the festival creator and Admins may do (the database refuses it, migrations/006).
  if (originalLineupText === null && !(canFestival('overview') && canFestival('budget'))) {
    toast('The festival creator or an Admin needs to set up the festival details first.'); return false;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    state = next;
    return true;
  } catch {
    toast('The change could not be saved in this browser. Your previous plan is kept.');
    return false;
  }
}
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  setTimeout(() => $('#toast').classList.remove('visible'), 4000);
}
function downloadOriginalLineup() {
  if (typeof originalLineupText !== 'string') { toast('The original saved data is not available in this browser.'); return; }
  try {
    const blob = new Blob([originalLineupText], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'festival-lineup-original.json';
    document.body?.appendChild?.(link); link.click(); link.remove?.();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('#backup-message').textContent = 'Original saved data downloaded unchanged. This copy may need repair before it can be restored.';
  } catch { toast('The original saved data could not be downloaded. It has not been changed.'); }
}
function retryLineupLoading() {
  if (typeof window.isFestivalContextCurrent === 'function' && !window.isFestivalContextCurrent()) {
    toast('A different festival is open in another tab. Reload this page before recovering the lineup.'); return;
  }
  state = loadState(); currentDay = state.event.startDate;
  if (!lineupLoadProblem) window.refreshGanttFestivalDates?.();
  render();
  if (typeof renderOverview === 'function') renderOverview();
}
function renderLineupRecovery() {
  if (!lineupLoadProblem && !lineupRecoveryNotice) return;
  if (!lineupRecoveryNotice) {
    const notice = document.createElement('section'); notice.id = 'lineup-recovery-notice'; notice.className = 'overview-card';
    notice.setAttribute('role', 'alert');
    const heading = document.createElement('h2'); heading.textContent = 'Saved lineup needs recovery';
    const message = document.createElement('p'); message.id = 'lineup-recovery-message';
    const actions = document.createElement('div'); actions.className = 'overview-dialog-actions';
    for (const [id, label, handler] of [
      ['download', 'Download original saved data', downloadOriginalLineup],
      ['retry', 'Retry loading', retryLineupLoading],
      ['restore', 'Restore lineup backup', () => $('#restore-plan').onclick()]
    ]) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'button secondary';
      button.id = 'lineup-recovery-' + id; button.textContent = label; button.onclick = handler; actions.append(button);
    }
    notice.append(heading, message, actions);
    $('.topbar').after(notice); lineupRecoveryNotice = notice;
  }
  lineupRecoveryNotice.hidden = !lineupLoadProblem;
  lineupRecoveryNotice.classList.toggle('hidden', !lineupLoadProblem);
  $('#lineup-recovery-message').textContent = `${lineupLoadProblem} The original saved data has not been changed. Lineup-dependent figures on other pages are unavailable until recovery. Download the original data, retry, or ask an Admin to restore a valid lineup backup.`;
  $('#lineup-recovery-download').disabled = typeof originalLineupText !== 'string';
  $('#lineup-recovery-restore').disabled = !canRestorePlan();
}
function writable(action = 'lineup') {
  if (lineupLoadProblem) { toast('The saved lineup needs recovery before it can be edited. Its original data is unchanged.'); return false; }
  if (!canFestival(action)) { toast('Your role cannot make this change.'); return false; }
  if (state.final) { toast('Reopen the final plan before editing.'); return false; }
  return true;
}
function canRestorePlan() {
  return canFestival('lineup') && canFestival('overview') && canFestival('budget');
}
function closedMarkup(start, end, axisStart) {
  if (end <= start) return '';
  return `<div class="closed-time" style="--minute-offset:${start-axisStart};--set-duration:${end-start};top:${start-axisStart}px;height:${end-start}px"><span>Closed</span></div>`;
}
function calendarMarkup(day, publicOnly = false) {
  const bounds = calendarBounds(), height = bounds.end - bounds.start;
  const entries = state.bookings.filter(b => b.date === day && (!publicOnly || (isPerformance(b) && b.status === 'confirmed')));
  const scale = 324 / height;
  const canBook = canFestival('lineup') && !state.final && !lineupLoadProblem;
  return `<div class="calendar-grid" data-calendar-day="${day}" style="--calendar-minutes:${height};--print-stages:${stages().length};--print-scale:${scale};grid-template-columns:56px repeat(${stages().length},minmax(145px,1fr))">
    <div class="calendar-corner">TIME</div>
    ${stages().map(s => `<div class="calendar-stage"><strong>${escapeHtml(stageName(s))}</strong></div>`).join('')}
    <div class="vertical-times" style="height:${height}px">${Array.from({length:Math.floor(height/60)+1}, (_,i) => `<span style="--minute-offset:${i*60};top:${i*60}px">${timeText(bounds.start+i*60)}</span>`).join('')}</div>
    ${stages().map((s,i) => {
      const h = stageHours(day,s);
      return `<div class="vertical-track" data-stage="${s}" style="height:${height}px" aria-label="${escapeHtml(stageName(s))}, available ${timeText(h.start)}–${timeText(h.end)}">
        ${closedMarkup(bounds.start,h.start,bounds.start)}${closedMarkup(h.end,bounds.end,bounds.start)}
        ${entries.filter(b => b.stage === s).map(b => {
          const duration = Number(entryDuration(b)), name = entryName(b), performance = isPerformance(b);
          if (!Number.isFinite(b.start) || !Number.isFinite(duration) || duration <= 0) return '';
          return `<button class="vertical-performance ${performance?(bookingStatus(b)):'calendar-block'} ${duration<40?'compact-appointment':''}" data-booking="${escapeHtml(b.id)}"${!publicOnly && canBook && performance && bookingStatus(b) === 'tentative' ? ' draggable="true"' : ''} style="--minute-offset:${b.start-bounds.start};--set-duration:${duration};top:${b.start-bounds.start}px;height:${duration}px;background:${!performance?'#dfe2df':i%2?'#b7e4dc':'#f5c8be'}" aria-label="${escapeHtml(name)} · ${timeText(b.start)}–${timeText(b.start+duration)}${!publicOnly&&performance?' · '+(bookingStatus(b)):''}"><strong>${escapeHtml(name)}</strong><span>${timeText(b.start)}–${timeText(b.start+duration)}</span></button>`;
        }).join('')}
      </div>`;
    }).join('')}
  </div>`;
}
function render() {
  renderLineupRecovery();
  if (lineupLoadProblem) {
    hidePerformanceDetails();
    $('#event-summary').textContent = 'Saved lineup unavailable — recovery required';
    $('#calendar').innerHTML = '<p>The saved timetable is unavailable. Recover the lineup using the notice above.</p>';
    $('#artist-list').innerHTML = '<p>The saved artist catalogue is unavailable.</p>';
    for (const id of ['performance-count', 'stage-count', 'committed', 'remaining', 'budget-total']) $('#' + id).textContent = 'Unavailable';
    for (const id of ['edit-settings', 'add-artist', 'add-block', 'finalise-btn', 'auto-plan-lineup', 'previous-day', 'next-day']) $('#' + id).disabled = true;
    $('#restore-plan').disabled = !canRestorePlan();
    $('#print-plan').classList.add('hidden');
    return;
  }
  window.updateFestivalCountdown?.();
  hidePerformanceDetails();
  const dates = days();
  if (!dates.includes(currentDay)) currentDay = dates[0];
  const index = dates.indexOf(currentDay), committed = total();
  const canEditLineup = canFestival('lineup');
  const lineupLocked = state.final || !canEditLineup;
  $('#event-summary').textContent = `${state.event.name ? state.event.name + ' · ' : ''}${dates.length} ${dates.length===1?'day':'days'} · ${dateText(dates[0])}${dates.length>1?' – '+dateText(dates.at(-1)):''}`;
  $('#performance-count').textContent = performances().length;
  $('#committed').textContent = euros(committed);
  $('#remaining').textContent = euros(state.settings.budget-committed);
  $('#stage-count').textContent = state.settings.stages;
  $('.budget-metric').classList.toggle('over-budget', committed>state.settings.budget);
  $('#print-plan').classList.toggle('hidden', !state.final);
  $('#finalise-btn').textContent = state.final?'Reopen as draft':'Finalise plan';
  $('#finalise-btn').disabled = !canEditLineup;
  $('#restore-plan').disabled = !canRestorePlan();
  $('#budget-total').textContent = euros(state.settings.budget);
  $('#budget-progress').value = state.settings.budget ? committed/state.settings.budget*100 : committed ? 100 : 0;
  $('#edit-settings').disabled = lineupLocked;
  $('#settings-form').querySelectorAll('input,button').forEach(e => e.disabled=lineupLocked);
  $('#budget-input').disabled = lineupLocked || !canFestival('budget');
  $('#add-artist').disabled = lineupLocked;
  $('#add-block').disabled = lineupLocked;
  $('#auto-plan-lineup').disabled = lineupLocked;
  // Artists taken from the artist library get their Wikipedia photo (artist-library/artist-photos.js).
  const photoAttributes = a => {
    const lib = a.libraryId && typeof ARTIST_LIBRARY !== 'undefined' ? ARTIST_LIBRARY.find(l => l.id === a.libraryId) : null;
    return lib ? ` data-wiki="${escapeHtml(lib.wiki)}" data-name="${escapeHtml(a.name)}" data-photo-link="off"` : '';
  };
  $('#artist-list').innerHTML = state.artists.map(a => {
    const booked = performances().filter(b => b.artistId===a.id).sort((x,y) => x.date.localeCompare(y.date)||x.start-y.start);
    return `<article class="artist-card"><div class="avatar" style="background:${safeArtistColour(a.colour)}"${photoAttributes(a)}>${escapeHtml(a.name.slice(0,2).toUpperCase())}</div><div><div class="artist-name">${escapeHtml(a.name)}</div><div class="artist-meta">${escapeHtml(a.genre)} · default ${escapeHtml(a.duration)} min</div><div class="artist-meta">${euros(a.fee)} default fee</div>${booked.length?`<div class="booked-label">${booked.length} scheduled performance${booked.length===1?'':'s'}</div><ul class="artist-bookings">${booked.map(b => `<li><span class="booking-status ${bookingStatus(b)}">${b.status==='confirmed'?'Confirmed':'Tentative'}</span> · ${dateText(b.date)} · ${escapeHtml(stageName(b.stage))}<br>${timeText(b.start)}–${timeText(b.start+entryDuration(b))} · ${euros(entryFee(b))}</li>`).join('')}</ul>`:'<div class="artist-meta">Not planned yet</div>'}</div><div class="artist-actions"><button class="button secondary" data-edit-artist="${escapeHtml(a.id)}" ${lineupLocked?'disabled':''}>Edit</button><button class="button secondary" data-artist="${escapeHtml(a.id)}" ${lineupLocked?'disabled':''}>Book</button></div></article>`;
  }).join('') || '<p>No artists yet. Add your first artist above.</p>';
  $('#current-day').innerHTML = `<strong>${dateText(currentDay)}</strong><small>Day ${index+1} of ${dates.length}</small>`;
  $('#previous-day').disabled = index===0;
  $('#next-day').disabled = index===dates.length-1;
  const festivalView = lineupView === 'festival';
  $('#lineup-daily').ariaPressed = String(!festivalView);
  $('#lineup-festival').ariaPressed = String(festivalView);
  $('.day-navigation').classList.toggle('hidden', festivalView);
  $('#calendar').classList.toggle('festival-calendar', festivalView);
  $('#calendar').innerHTML = festivalView
    ? dates.map(day => '<section class="festival-day" style="--festival-day-width:' + (56 + stages().length * 145) + 'px"><h3>' + dateText(day) + '</h3>' + calendarMarkup(day) + '</section>').join('')
    : calendarMarkup(currentDay);
  $('#schedule-empty').textContent = lineupLocked ? 'Nothing is scheduled for this day.' : 'Click a free calendar slot, book an artist, or add a calendar block.';
  $('#schedule-empty').classList.toggle('hidden',state.bookings.some(b => lineupView === 'festival' || b.date===currentDay));
  document.querySelectorAll('[data-artist]').forEach(e => e.onclick=() => openBooking(e.dataset.artist));
  document.querySelectorAll('[data-edit-artist]').forEach(e => e.onclick=() => openArtist(e.dataset.editArtist));
  document.querySelectorAll('[data-booking]').forEach(e => {
    e.onclick = () => {
      if (!canFestival('lineup')) { showPerformanceDetails(e); return; }
      hidePerformanceDetails();
      const b = state.bookings.find(b => b.id===e.dataset.booking);
      if (b.linkedTo) openBooking(null,b.linkedTo);
      else if (isPerformance(b)) openBooking(null,b.id);
      else openBlock(b.id);
    };
    e.onmouseenter=e.onfocus=() => showPerformanceDetails(e);
    e.onmouseleave=e.onblur=hidePerformanceDetails;
    e.onkeydown=event => { if(event.key==='Escape') hidePerformanceDetails(); };
  });
  if (typeof window.dispatchEvent === 'function' && typeof window.Event === 'function') {
    window.dispatchEvent(new window.Event('festival-plan-updated'));
  }
}
const lineupCalendar = $('#calendar');
let draggedPerformance = null;
function clearPerformanceDrag() {
  draggedPerformance = null;
  lineupCalendar.querySelectorAll('.lineup-drop-target').forEach(track => track.classList.remove('lineup-drop-target'));
}
lineupCalendar.ondragstart = event => {
  const card = event.target.closest('button[data-booking][draggable="true"]');
  if (!card || !writable()) { event.preventDefault(); return; }
  const booking = state.bookings.find(b => b.id === card.dataset.booking);
  if (!booking || !isPerformance(booking) || bookingStatus(booking) !== 'tentative') { event.preventDefault(); return; }
  const rect = card.getBoundingClientRect();
  draggedPerformance = { booking, offset: (event.clientY - rect.top) / rect.height * entryDuration(booking) };
  event.dataTransfer.setData('text/plain', booking.id);
  event.dataTransfer.effectAllowed = 'move';
  hidePerformanceDetails();
};
lineupCalendar.ondragover = event => {
  const track = event.target.closest('.vertical-track');
  if (!draggedPerformance || !track) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  lineupCalendar.querySelectorAll('.lineup-drop-target').forEach(target => target.classList.toggle('lineup-drop-target', target === track));
  track.classList.add('lineup-drop-target');
};
lineupCalendar.ondragleave = event => {
  const track = event.target.closest('.vertical-track');
  if (track && !track.contains(event.relatedTarget)) track.classList.remove('lineup-drop-target');
};
lineupCalendar.ondragend = clearPerformanceDrag;
lineupCalendar.ondrop = event => {
  const track = event.target.closest('.vertical-track');
  const drag = draggedPerformance;
  clearPerformanceDrag();
  if (!drag || !track) return;
  event.preventDefault();
  if (!writable() || !state.bookings.includes(drag.booking)) return;
  if (typeof window.isFestivalContextCurrent === 'function' && !window.isFestivalContextCurrent()) {
    toast('Reload the current festival before moving a performance.');
    return;
  }
  const bounds = calendarBounds(), rect = track.getBoundingClientRect();
  const minute = bounds.start + (event.clientY - rect.top) / rect.height * (bounds.end - bounds.start) - drag.offset;
  const start = Math.round(minute / 5) * 5;
  const date = track.closest('[data-calendar-day]').dataset.calendarDay;
  try {
    const next = moveTentativePerformance(state, drag.booking.id, { date, stage: track.dataset.stage, start });
    if (next === state || !save(next)) return;
    currentDay = date;
    render();
    toast('Tentative performance moved to ' + timeText(start) + '.');
  } catch (error) { toast(error.message); }
};

// Empty-stage clicks map one CSS pixel to one minute. Header + buttons provide a keyboard alternative.
$('#calendar').onclick = event => {
  if (event.target.closest('button') || state.final || !canFestival('lineup')) return;
  const track = event.target.closest('.vertical-track');
  if (!track) return;
  const rect = track.getBoundingClientRect(), bounds=calendarBounds();
  const start = bounds.start + Math.floor((event.clientY-rect.top)/rect.height*(bounds.end-bounds.start));
  const clickedDay = track.closest('[data-calendar-day]').dataset.calendarDay;
  const h=stageHours(clickedDay,track.dataset.stage);
  if (start<h.start || start>=h.end) { toast('This stage is closed at that time.'); return; }
  currentDay = clickedDay;
  openSlot(track.dataset.stage,start);
};
function openSlot(stage,start) {
  if (!writable()) return;
  selectedSlot={date:currentDay,stage,start};
  $('#slot-summary').textContent=`${dateText(currentDay)} · ${stageName(stage)} · ${timeText(start)}`;
  $('#slot-book').disabled=state.artists.length===0;
  $('#slot-dialog').showModal();
}
$('#slot-cancel').onclick=() => $('#slot-dialog').close();
$('#slot-book').onclick=() => { $('#slot-dialog').close(); openBooking(state.artists[0]?.id,null,selectedSlot); };
$('#slot-block').onclick=() => { $('#slot-dialog').close(); openBlock(null,selectedSlot); };
function populateBookingLocations(date,stage) {
  $('#day-input').innerHTML=days().map(d => `<option value="${d}">${dateText(d)}</option>`).join('');
  $('#day-input').value=date;
  $('#stage-input').innerHTML=stages().map(s => `<option value="${s}">${escapeHtml(stageName(s))}</option>`).join('');
  $('#stage-input').value=stage;
}
function openBooking(id,bookingId=null,slot=null) {
  if (!writable()) return;
  editingId=bookingId;
  const b=state.bookings.find(x => x.id===bookingId);
  selectedArtistId=b?b.artistId:id;
  const a=artist(selectedArtistId);
  if (!a) { toast('Add an artist to the catalogue first.'); return; }
  $('#dialog-title').textContent=b?'Edit performance':'Book artist';
  $('#booking-artist').innerHTML=state.artists.map(a => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)}</option>`).join('');
  $('#booking-artist').value=selectedArtistId;
  $('#artist-preview').textContent=`${a.name} · ${a.genre}`;
  populateBookingLocations(b?.date||slot?.date||currentDay,b?.stage||slot?.stage||'A');
  $('#time-input').value=timeText((b?.start??slot?.start??stageHours(currentDay,'A').start)%1440);
  $('#booking-duration').value=b?entryDuration(b):a.duration;
  $('#booking-fee').value=b?entryFee(b):a.fee;
  $('#booking-status').value=b?.status||'tentative';
  $('#booking-changeover').value=b?.changeover||0;
  $('#booking-notes').value=b?.notes||'';
  $('#remove-btn').classList.toggle('hidden',!b);
  $('#save-btn').textContent=b?'Save changes':'Add to lineup';
  clearBookingIssue();
  updateEndPreview();
  $('#booking-dialog').showModal();
}
function clearBookingIssue() {
  $('#form-message').textContent='';
  $('#suggest-slot').classList.add('hidden');
  $('#suggestion-message').textContent='';
  suggestedStart=null;
}
function bookingFromForm() {
  return {id:editingId||crypto.randomUUID(),artistId:selectedArtistId,date:$('#day-input').value,stage:$('#stage-input').value,
    start:festivalDayMinutes($('#time-input').value, stageHours($('#day-input').value, $('#stage-input').value)),duration:Number($('#booking-duration').value),fee:Number($('#booking-fee').value),
    status:$('#booking-status').value,changeover:Number($('#booking-changeover').value),notes:$('#booking-notes').value.trim()};
}
function updateEndPreview() {
  const start=festivalDayMinutes($('#time-input').value, stageHours($('#day-input').value, $('#stage-input').value)),duration=Number($('#booking-duration').value);
  $('#duration-preview').textContent=`${duration} minutes`;
  $('#end-preview').textContent=Number.isFinite(start)?timeText(start+duration):'—';
}
function showBookingIssue(b,problem) {
  $('#form-message').textContent=problem;
  suggestedStart=nextFreeSlot(b,editingId);
  const available=suggestedStart!==null && suggestedStart!==b.start;
  $('#suggest-slot').classList.toggle('hidden',!available);
  $('#suggest-slot').textContent=available?`Use next free slot · ${timeText(suggestedStart)}`:'Find next free slot';
  $('#suggestion-message').textContent=available?'Includes the performance and its changeover.':suggestedStart===null?'No fitting slot later on this day and stage.':'';
}
$('#suggest-slot').onclick=() => {
  if (suggestedStart===null) return;
  $('#time-input').value=timeText(suggestedStart%1440);
  updateEndPreview();
  clearBookingIssue();
};
$('#booking-artist').onchange=() => {
  selectedArtistId=$('#booking-artist').value;
  const a=artist(selectedArtistId);
  $('#artist-preview').textContent=`${a.name} · ${a.genre}`;
  $('#booking-duration').value=a.duration;
  $('#booking-fee').value=a.fee;
  updateEndPreview();clearBookingIssue();
};
for (const id of ['#time-input','#booking-duration','#booking-changeover','#day-input','#stage-input']) {
  $(id).addEventListener('input',() => { updateEndPreview();clearBookingIssue(); });
}
$('#time-input').oninput=updateEndPreview;
$('#close-dialog').onclick=$('#cancel-btn').onclick=() => $('#booking-dialog').close();
function confirmBudget(projected,apply,budget=state.settings.budget) {
  const oldShortfall=Math.max(0,total()-state.settings.budget),newShortfall=Math.max(0,projected-budget);
  if (newShortfall>oldShortfall) {
    pendingBudgetChange=apply;
    $('#budget-warning').textContent=`This change brings the committed total to ${euros(projected)} against a ${euros(budget)} budget — ${euros(newShortfall)} over budget. Save it anyway?`;
    $('#budget-dialog').showModal();
  } else apply();
}
$('#confirm-budget').onclick=() => { const apply=pendingBudgetChange;pendingBudgetChange=null;if(apply)apply(); };
$('#budget-dialog').addEventListener('close',() => {pendingBudgetChange=null;});
function savePerformance(b) {
  if (!writable()) return false;
  const problem=validation(b,b.id);
  if (problem) { showBookingIssue(b,problem);return false; }
  const old=state.bookings.find(x => x.id===b.id);
  const projected=total()-(old?entryFee(old):0)+entryFee(b);
  // A second booking of the same artist is allowed, but only after a warning (new booking or new artist).
  const warning=old?.artistId===b.artistId ? '' : doubleBookingWarning(b,b.id,state);
  if (warning) {
    pendingDoubleBooking=() => savePerformanceAfterWarning(b,projected);
    $('#double-warning').textContent=warning;
    $('#double-dialog').showModal();
    return true;
  }
  savePerformanceAfterWarning(b,projected);
  return true;
}
let pendingDoubleBooking=null;
$('#confirm-double').onclick=() => { const apply=pendingDoubleBooking;pendingDoubleBooking=null;if(apply)apply(); };
$('#double-dialog').addEventListener('close',() => {pendingDoubleBooking=null;});
function savePerformanceAfterWarning(b,projected) {
  confirmBudget(projected,() => {
    if (!writable()) return;
    const issue=validation(b,b.id);
    if (issue) {showBookingIssue(b,issue);return;}
    const replacements=buildPerformanceEntries(b);
    if (!save({ ...state, bookings: state.bookings.filter(x => x.id!==b.id&&x.linkedTo!==b.id).concat(replacements) })) return;
    currentDay=b.date;
    $('#booking-dialog').close();render();toast('Performance saved.');
  });
  return true;
}
$('#booking-form').onsubmit=event => { event.preventDefault();savePerformance(bookingFromForm()); };
function removePerformance(id) {
  if (!writable()) return;
  if (!save({ ...state, bookings: state.bookings.filter(b => b.id!==id&&b.linkedTo!==id) })) return;
  $('#booking-dialog').close();render();toast('Performance and linked changeover removed.');
}
$('#remove-btn').onclick=() => removePerformance(editingId);
function openBlock(id=null,slot=null) {
  if (!writable()) return;
  editingBlockId=id;
  const b=state.bookings.find(b => b.id===id);
  if (b?.linkedTo) { openBooking(null,b.linkedTo);return; }
  $('#block-dialog-title').textContent=b?'Edit calendar block':'Add calendar block';
  $('#block-title').value=b?.title||'';
  $('#block-day').innerHTML=days().map(d => `<option value="${d}">${dateText(d)}</option>`).join('');
  $('#block-day').value=b?.date||slot?.date||currentDay;
  $('#block-stage').innerHTML=stages().map(s => `<option value="${s}">${escapeHtml(stageName(s))}</option>`).join('');
  $('#block-stage').value=b?.stage||slot?.stage||'A';
  $('#block-time').value=timeText((b?.start??slot?.start??stageHours(currentDay,'A').start)%1440);
  $('#block-duration').value=b?.duration??30;
  $('#block-notes').value=b?.notes||'';
  $('#block-message').textContent='';
  $('#remove-block').classList.toggle('hidden',!b);
  $('#block-dialog').showModal();
}
$('#add-block').onclick=() => openBlock();
$('#cancel-block').onclick=() => $('#block-dialog').close();
$('#block-form').onsubmit=event => {
  event.preventDefault();if(!writable())return;
  const b={id:editingBlockId||crypto.randomUUID(),type:'block',title:$('#block-title').value.trim(),date:$('#block-day').value,
    stage:$('#block-stage').value,start:festivalDayMinutes($('#block-time').value, stageHours($('#block-day').value, $('#block-stage').value)),duration:Number($('#block-duration').value),notes:$('#block-notes').value.trim()};
  const problem=b.title?validation(b,editingBlockId):'Enter a title for this block.';
  if(problem){$('#block-message').textContent=problem;return;}
  if (!save({ ...state, bookings: state.bookings.filter(x => x.id!==b.id).concat(b) })) return;
  currentDay=b.date;$('#block-dialog').close();render();toast('Calendar block saved.');
};
$('#remove-block').onclick=() => {
  if(!writable())return;
  if (!save({ ...state, bookings: state.bookings.filter(b => b.id!==editingBlockId) })) return;
  $('#block-dialog').close();render();toast('Calendar block removed.');
};
function openArtist(id=null) {
  if(!writable())return;
  editingArtistId=id;const a=artist(id);
  $('#artist-dialog-title').textContent=a?'Edit artist':'Add artist';
  $('#name-input').value=a?.name||'';$('#genre-input').value=a?.genre||'';
  $('#fee-input').value=a?.fee??0;$('#duration-input').value=a?.duration??60;
  $('#delete-artist').classList.toggle('hidden',!a);$('#artist-message').textContent='';
  $('#artist-dialog').showModal();
}
$('#add-artist').onclick=() => openArtist();
$('#cancel-artist').onclick=() => $('#artist-dialog').close();
$('#artist-form').onsubmit=event => {
  event.preventDefault();if(!writable())return;
  const old=artist(editingArtistId);
  // Keep any other saved details of the artist (e.g. libraryId, which gives the photo from the artist library).
  const a={...(old||{}),id:editingArtistId||crypto.randomUUID(),name:$('#name-input').value.trim(),genre:$('#genre-input').value.trim(),
    fee:Number($('#fee-input').value),duration:Number($('#duration-input').value),colour:safeArtistColour(old?.colour)};
  if(!a.name||!a.genre||!Number.isFinite(a.fee)||a.fee<0||!Number.isInteger(a.duration)||a.duration<1||a.duration>1440){$('#artist-message').textContent='Enter a name, genre, non-negative price and valid duration.';return;}
  // Existing performances keep their agreed duration and fee when catalogue defaults change.
  if (!save({ ...state, artists: old?state.artists.map(x => x.id===a.id?a:x):[...state.artists,a] })) return;
  $('#artist-dialog').close();render();toast('Artist defaults saved. Existing performances keep their agreed details.');
};
$('#delete-artist').onclick=() => {
  if(!writable())return;
  const count=performances().filter(b => b.artistId===editingArtistId).length;
  $('#delete-description').textContent=`Remove ${artist(editingArtistId).name} from this festival? ${count?`Their ${count} performance(s) and linked changeovers will also be removed.`:'They have no performances.'}`;
  $('#delete-dialog').showModal();
};
$('#confirm-delete').onclick=() => {
  if(!writable())return;
  const ids=new Set(performances().filter(b => b.artistId===editingArtistId).map(b => b.id));
  if (!save({ ...state, artists: state.artists.filter(a => a.id!==editingArtistId),
    bookings: state.bookings.filter(b => !ids.has(b.id)&&!ids.has(b.linkedTo)) })) return;
  $('#artist-dialog').close();render();toast('Artist removed from festival.');
};
function hidePerformanceDetails() {
  $('#performance-tooltip').hidden=true;
  document.querySelectorAll('[data-booking]').forEach(e => e.removeAttribute('aria-describedby'));
}
function showPerformanceDetails(element) {
  const b=state.bookings.find(b => b.id===element.dataset.booking),tip=$('#performance-tooltip');
  if(!b)return;
  tip.innerHTML=`<strong>${escapeHtml(entryName(b))}</strong><span>${isPerformance(b)?escapeHtml(artist(b.artistId).genre)+' · '+euros(entryFee(b))+' · '+(b.status==='confirmed'?'Confirmed':'Tentative'):b.linkedTo?'Linked changeover · edit the performance to move it':'Calendar block'}</span><span>${entryDuration(b)} minutes · ${escapeHtml(stageName(b.stage))}</span><span>${dateText(b.date)} · ${timeText(b.start)}–${timeText(b.start+entryDuration(b))}</span>${b.notes?`<span class="tooltip-notes">${escapeHtml(b.notes)}</span>`:''}`;
  tip.hidden=false;element.setAttribute('aria-describedby','performance-tooltip');
  const rect=element.getBoundingClientRect(),box=tip.getBoundingClientRect();
  tip.style.left=`${Math.max(8,Math.min(rect.left,window.innerWidth-box.width-8))}px`;
  tip.style.top=`${rect.bottom+box.height+16<window.innerHeight?rect.bottom+8:Math.max(8,rect.top-box.height-8)}px`;
}
window.addEventListener('scroll',hidePerformanceDetails,true);
window.addEventListener('resize',hidePerformanceDetails);
function populateStageNames() {
  const count=Number($('#stages-input').value);
  if(!Number.isInteger(count)||count<1||count>12)return;
  const draft={...state.settings.stageNames};
  document.querySelectorAll('[data-stage-name]').forEach(input => {draft[input.dataset.stageName]=input.value;});
  $('#stage-names-fields').innerHTML=Array.from({length:count},(_,i) => {
    const id=String.fromCharCode(65+i);
    return `<label>Stage ${id}<input data-stage-name="${id}" maxlength="60" value="${escapeHtml(draft[id]||`Stage ${id}`)}" required></label>`;
  }).join('');
}
$('#stages-input').oninput=populateStageNames;
$('#edit-settings').onclick=() => {
  if(!writable())return;
  $('#stages-input').value=state.settings.stages;$('#budget-input').value=state.settings.budget;
  $('#budget-input').disabled=!canFestival('budget');
  $('#stage-names-fields').innerHTML='';populateStageNames();
  $('#settings-message').textContent='';$('#settings-dialog').showModal();
};
$('#cancel-settings').onclick=() => $('#settings-dialog').close();
// An old error message disappears as soon as the user changes a field.
$('#settings-form').addEventListener('input',() => { $('#settings-message').textContent=''; });
$('#settings-form').onsubmit=event => {
  event.preventDefault();if(!writable())return;
  const budget=canFestival('budget') ? Number($('#budget-input').value) : state.settings.budget;
  const settings={...state.settings,stages:Number($('#stages-input').value),budget,stageNames:{...state.settings.stageNames}};
  if(!Number.isInteger(settings.stages)||settings.stages<1||settings.stages>12||!Number.isFinite(settings.budget)||settings.budget<0){$('#settings-message').textContent='Enter 1–12 stages and a non-negative budget.';return;}
  if(state.bookings.some(b => b.stage.charCodeAt(0)-65>=settings.stages)){$('#settings-message').textContent='Move or remove bookings on those stages first.';return;}
  let invalidName=false;
  document.querySelectorAll('[data-stage-name]').forEach(input => {const name=input.value.trim();if(!name||name.length>60)invalidName=true;settings.stageNames[input.dataset.stageName]=name;});
  if(invalidName){$('#settings-message').textContent='Give each stage a name of 1–60 characters.';return;}
  confirmBudget(total(),() => {
    if (!writable()) return;
    if (settings.budget !== state.settings.budget && !canFestival('budget')) {
      $('#settings-message').textContent='Only admins can change the artist budget.';
      return;
    }
    if (!save({ ...state, settings })) return;
    render();$('#settings-dialog').close();toast('Planning settings saved.');
  },settings.budget);
};
function downloadBackup() {
  if (lineupLoadProblem) { downloadOriginalLineup(); return; }
  try {
    const backup=makePlanBackup(state),problems=planProblems(backup.plan);
    if(problems.length)throw Error(problems[0]);
    const data=JSON.stringify(backup,null,2),blob=new Blob([data],{type:'application/json'});
    if(blob.size>5*1024*1024)throw Error('This plan is larger than the 5 MB restore limit.');
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`festival-lineup-${state.event.startDate}.json`;
    document.body.appendChild(a);a.click();a.remove();setTimeout(() => URL.revokeObjectURL(url),1000);
    $('#backup-message').textContent='Backup downloaded. Keep this file to restore or share the editable lineup.';
  } catch(error) {$('#backup-message').textContent=`Backup not downloaded: ${error.message}`;}
}
$('#backup-plan').onclick=downloadBackup;
$('#backup-before-restore').onclick=downloadBackup;
$('#restore-plan').onclick=() => {
  if (!canRestorePlan()) return;
  $('#backup-file').value='';$('#backup-file').click();
};
$('#backup-file').onchange=async event => {
  const file=event.target.files?.[0];if(!file || !canRestorePlan())return;
  pendingRestore=null;
  try {
    if(file.size>5*1024*1024)throw Error('Choose a lineup backup smaller than 5 MB.');
    const backupText=await file.text();
    if (!canRestorePlan()) return;
    pendingRestore=parsePlanBackup(backupText);
    const p=pendingRestore,sets=p.bookings.filter(isPerformance),amount=sets.reduce((sum,b) => sum+b.fee,0);
    $('#restore-summary').textContent=`${p.artists.length} artists · ${sets.length} performances · ${p.settings.stages} stages · ${p.event.startDate} to ${p.event.endDate}. Used: ${euros(amount)} of ${euros(p.settings.budget)}.${amount>p.settings.budget?' This plan is over budget.':''} ${p.final?'This backup is finalised.':''}`;
    $('#restore-dialog').showModal();
  } catch(error) {$('#backup-message').textContent=`Backup not restored: ${error.message}`;}
};
$('#cancel-restore').onclick=() => {pendingRestore=null;$('#restore-dialog').close();};
$('#restore-dialog').addEventListener('cancel',() => {pendingRestore=null;});
$('#confirm-restore').onclick=() => {
  if(!pendingRestore || !canRestorePlan())return;
  try {
    // Persist before replacing the in-memory plan: a storage error leaves the current plan intact.
    localStorage.setItem(STORAGE_KEY,JSON.stringify(pendingRestore));
    state=pendingRestore;pendingRestore=null;currentDay=state.event.startDate;
    lineupLoadProblem=''; originalLineupText=JSON.stringify(state);
    window.refreshGanttFestivalDates?.();
    $('#print-plan-content').innerHTML='';$('#restore-dialog').close();render();
    if (typeof renderOverview === 'function') renderOverview();
    $('#backup-message').textContent='Backup restored. The final checklist has not changed.';
  } catch(error) {$('#backup-message').textContent=`Could not restore: ${error.message}`;}
};
function createPrintMarkup(mode='internal') {
  const publicOnly=mode==='public';
  const entries=state.bookings.filter(b => !publicOnly||(isPerformance(b)&&b.status==='confirmed'));
  const sets=entries.filter(isPerformance),unique=new Set(sets.map(b => b.artistId)).size;
  return `<header><h1>Festival Architect — ${publicOnly?'Public timetable':'Internal lineup'}</h1><p>${dateText(state.event.startDate)} – ${dateText(state.event.endDate)} ${state.event.startDate.slice(0,4)}</p><p>${unique} artists · ${sets.length} ${publicOnly?'confirmed ':''}performances · ${state.settings.stages} stages</p>${!publicOnly?`<p>Budget: ${euros(state.settings.budget)} · Used: ${euros(total())} · Remaining: ${euros(state.settings.budget-total())}${total()>state.settings.budget?' — OVER BUDGET':''}</p>`:''}</header>${days().map(day => {
    const bookings=entries.filter(b => b.date===day).sort((a,b) => a.start-b.start||a.stage.localeCompare(b.stage));
    return `<section class="print-day"><h2>${dateText(day)} · ${timeText(dayHours(day).start)}–${timeText(dayHours(day).end)}</h2><div class="print-calendar">${calendarMarkup(day,publicOnly)}</div><h3>${publicOnly?'Confirmed performances':'Appointments and notes'}</h3>${bookings.length?`<table><thead><tr><th>Time</th><th>Stage</th><th>${publicOnly?'Artist':'Appointment'}</th><th>Duration</th>${!publicOnly?'<th>Status</th><th>Fee</th><th>Private notes</th>':''}</tr></thead><tbody>${bookings.map(b => `<tr><td>${timeText(b.start)}–${timeText(b.start+entryDuration(b))}</td><td>${escapeHtml(stageName(b.stage))}</td><td>${escapeHtml(entryName(b))}</td><td>${entryDuration(b)} min</td>${!publicOnly?`<td>${isPerformance(b)?(bookingStatus(b)):'Operational block'}</td><td>${isPerformance(b)?euros(entryFee(b)):'—'}</td><td class="printed-notes">${escapeHtml(b.notes||'—')}</td>`:''}</tr>`).join('')}</tbody></table>`:`<p>${publicOnly?'No confirmed performances':'No performances planned'} for this day.</p>`}</section>`;
  }).join('')}`;
}
function printPlan(mode='internal') {
  if(!state.final)return;
  $('#print-plan-content').innerHTML=createPrintMarkup(mode);
  hidePerformanceDetails();window.print();
}
$('#print-plan').onclick=() => {if(!state.final)return;$('#print-mode').value='public';$('#print-dialog').showModal();};
$('#cancel-print').onclick=() => $('#print-dialog').close();
$('#print-form').onsubmit=event => {event.preventDefault();$('#print-dialog').close();printPlan($('#print-mode').value);};
$('#previous-day').onclick=() => {currentDay=days()[days().indexOf(currentDay)-1];render();};
$('#next-day').onclick=() => {currentDay=days()[days().indexOf(currentDay)+1];render();};
$('#finalise-btn').onclick=() => {
  if (!canFestival('lineup')) return;
  if(state.final){if(save({ ...state, final:false }))render();return;}
  const problems=planProblems(state);
  if(problems.length){toast(problems[0]);return;}
  $('#finalise-dialog').showModal();
};
$('#confirm-finalise').onclick=() => {
  if (!canFestival('lineup')) return;
  const problems=planProblems(state);
  if(problems.length){toast(problems[0]);return;}
  if(!save({ ...state, final:true }))return;
  render();toast('Lineup finalised. Choose public or internal PDF using Print / Save PDF.');
};
render();


$('#lineup-daily').onclick = () => { lineupView = 'daily'; render(); };
$('#lineup-festival').onclick = () => { lineupView = 'festival'; render(); };
