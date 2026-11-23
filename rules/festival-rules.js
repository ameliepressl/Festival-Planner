// Keep the original Node regression-test API without allocating its old rules in
// the browser. The active app uses the multi-day rules below.
if (typeof module !== 'undefined' && typeof require === 'function') {
  module.exports = require('./legacy-lineup-compatibility.js');
}

// Current multi-day lineup business rules. UI state is owned by app.js.
// Retained only for loading older saved plans that did not store their catalogue.
const LEGACY_ARTISTS = [
  { id: 'naya', name: 'Naya Bloom', genre: 'Dream pop', fee: 1800, duration: 60, colour: '#f5c8be' },
  { id: 'nightbus', name: 'Night Bus', genre: 'Indie dance', fee: 1400, duration: 45, colour: '#f9dc88' },
  { id: 'satori', name: 'Satori Club', genre: 'Electronic', fee: 2200, duration: 75, colour: '#b7e4dc' },
  { id: 'mila', name: 'Mila & The Sun', genre: 'Soul / R&B', fee: 1200, duration: 45, colour: '#d8c7ed' },
  { id: 'tomas', name: 'Tomás Vale', genre: 'Alt folk', fee: 900, duration: 40, colour: '#e7d5ae' },
  { id: 'redwood', name: 'Redwood Hearts', genre: 'Rock', fee: 2000, duration: 60, colour: '#ffd0a2' },
  { id: 'luna', name: 'Luna Lune', genre: 'Ambient pop', fee: 1100, duration: 50, colour: '#c7d9f4' },
  { id: 'riko', name: 'Riko Reyes', genre: 'Global beats', fee: 1500, duration: 60, colour: '#d4e8b7' }
];
// New plans use one editable example; saved catalogues take precedence.
const ARTISTS = [
  { id: 'example', name: 'Example Artist', genre: 'Example genre', fee: 0, duration: 60, colour: '#b7e4dc' }
];
function clonePlanValue(value) {
  return JSON.parse(JSON.stringify(value));
}
function catalogueForSavedPlan(saved) {
  if (Array.isArray(saved?.artists)) return clonePlanValue(saved.artists);
  const hasLegacyBooking = Array.isArray(saved?.bookings) && saved.bookings.some(b => LEGACY_ARTISTS.some(a => a.id === b.artistId));
  return (hasLegacyBooking ? LEGACY_ARTISTS : ARTISTS).map(a => ({ ...a }));
}
// Shared event configuration for the overview and lineup.
const DEFAULT_EVENT = { startDate: '2027-03-20', endDate: '2027-03-21', startMinutes: 840, endMinutes: 1380 };
function freshFestivalEvent(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now).map(({ type, value }) => [type, value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const tomorrow = new Date(Date.parse(today + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
  return { ...DEFAULT_EVENT, startDate: today, endDate: tomorrow };
}
const timeText = n => `${String(Math.floor((n === 1440 ? n : n % 1440) / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
function eventDays(event) {
  const dates = [], d = new Date(event.startDate + 'T12:00:00Z'), end = new Date(event.endDate + 'T12:00:00Z');
  while (d <= end && dates.length < 366) {
    dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}
function days() { return eventDays(state.event); }
const dateText = date => new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' });
const planStages = plan => Array.from({ length: plan.settings.stages }, (_, i) => String.fromCharCode(65 + i));
const stages = () => planStages(state);
function stageName(id, plan = state) { return plan.settings.stageNames?.[id] || `Stage ${id}`; }
const artist = id => state.artists.find(a => a.id === id);
const isPerformance = b => b.type !== 'block';
// Shared saved data must never supply CSS or arbitrary status classes to the screen.
const safeArtistColour = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#b7e4dc';
const bookingStatus = booking => booking.status === 'confirmed' ? 'confirmed' : 'tentative';
function entryDuration(b, plan = state) { return b.duration ?? plan.artists.find(a => a.id === b.artistId)?.duration; }
function entryName(b, plan = state) { return isPerformance(b) ? plan.artists.find(a => a.id === b.artistId)?.name || 'Unknown artist' : b.title; }
function entryFee(b, plan = state) { return isPerformance(b) ? b.fee ?? plan.artists.find(a => a.id === b.artistId)?.fee : 0; }
const performances = () => state.bookings.filter(isPerformance);
const artistCount = () => new Set(performances().map(b => b.artistId)).size;
const total = () => state.bookings.reduce((sum, b) => sum + entryFee(b), 0);
// Brief, "Flexible budget": going over the artist budget is allowed, but a change that creates
// or increases the overrun needs the organiser's confirmation first.
function budgetOverrunGrows(before, after) {
  const overrun = plan => Math.max(0, plan.bookings.reduce((sum, b) => sum + entryFee(b, plan), 0) - plan.settings.budget);
  return overrun(after) > overrun(before);
}
function inputMinutes(value) {
  if (!/^\d{2}:\d{2}$/.test(value)) return NaN;
  const [h, m] = value.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59 ? h * 60 + m : NaN;
}
// Store after-midnight times beyond 1440 so they remain on the selected festival day.
function festivalDayMinutes(value, hours) {
  const minutes = inputMinutes(value);
  return Number.isFinite(minutes) && hours.end > 1440 && minutes < hours.start ? minutes + 1440 : minutes;
}
function closingMinutes(value, start) {
  const minutes = value === '24:00' ? 1440 : inputMinutes(value);
  return Number.isFinite(minutes) && minutes < start ? minutes + 1440 : minutes;
}
// Existing performances receive snapshots once: later catalogue edits only change defaults for future bookings.
function normalizePlan(saved) {
  const isSaved = Boolean(saved) && typeof saved === 'object' && !Array.isArray(saved);
  const source = isSaved ? clonePlanValue(saved) : {};
  // Only a brand-new plan starts from today. A saved plan without dates (older plans, backups) keeps
  // the fixed default dates, so they do not move every day and its bookings stay on their days.
  const defaultEvent = isSaved ? DEFAULT_EVENT : freshFestivalEvent();
  const result = {
    ...source,
    final: source.final === true,
    artists: catalogueForSavedPlan(source),
    settings: { stages: 2, budget: 10000, ...source.settings },
    event: { ...defaultEvent, ...source.event }
  };
  delete result.settings.required;
  result.settings.stageNames = { ...result.settings.stageNames };
  result.bookings = (Array.isArray(source.bookings) ? source.bookings : []).filter(b => b && (b.type === 'block' || result.artists.some(a => a.id === b.artistId))).map(b => {
    const base = { ...b, date: b.date || result.event.startDate, notes: b.notes || '' };
    if (!isPerformance(b)) return { ...base, type: 'block' };
    const a = result.artists.find(a => a.id === b.artistId);
    return { ...base, duration: b.duration ?? a.duration, fee: b.fee ?? a.fee, status: b.status || 'tentative', changeover: b.changeover ?? 0 };
  });
  return result;
}
// Imported plans can include opening hours for individual days and stages.
function dayHours(date, event = state.event) {
  const h = event.dayHours?.[date];
  return { start: h?.start ?? event.startMinutes, end: h?.end ?? event.endMinutes };
}
function stageHours(date, stage, event = state.event) {
  const day = dayHours(date, event), custom = event.dayHours?.[date]?.stages?.[stage];
  return custom ? { start: Math.max(day.start, custom.start), end: Math.min(day.end, custom.end) } : day;
}
function calendarBounds() {
  const hours = days().map(d => dayHours(d));
  return { start: Math.floor(Math.min(...hours.map(h => h.start)) / 60) * 60, end: Math.ceil(Math.max(...hours.map(h => h.end)) / 60) * 60 };
}
function availabilityProblem(b, event = state.event, plan = state) {
  const h = stageHours(b.date, b.stage, event), end = b.start + entryDuration(b, plan) + (isPerformance(b) ? b.changeover || 0 : 0);
  return b.start < h.start || end > h.end ? `${stageName(b.stage, plan)} is available ${timeText(h.start)}–${timeText(h.end)} on ${dateText(b.date)}. The appointment and changeover must fit inside these hours.` : '';
}
function performanceEntriesForPlan(b, plan) {
  const a = plan.artists.find(a => a.id === b.artistId);
  const performance = { ...b, duration: b.duration ?? a?.duration, fee: b.fee ?? a?.fee, status: b.status || 'tentative', changeover: b.changeover ?? 0, notes: b.notes || '' };
  const entries = [performance];
  if (performance.changeover > 0) entries.push({
    id: `changeover-${b.id}`, type: 'block', linkedTo: b.id,
    title: `Changeover · ${a?.name || 'Artist'}`, date: b.date, stage: b.stage,
    start: b.start + performance.duration, duration: performance.changeover, notes: ''
  });
  return entries;
}
function buildPerformanceEntries(b) { return performanceEntriesForPlan(b, state); }

function moveTentativePerformance(plan, id, { date, stage, start }) {
  const original = plan.bookings.find(booking => booking.id === id);
  if (plan.final || !original || !isPerformance(original) || bookingStatus(original) !== 'tentative') {
    throw new Error('Only tentative performances in an editable lineup can be dragged.');
  }
  if (original.date === date && original.stage === stage && original.start === start) return plan;
  const moved = { ...original, date, stage, start };
  const problem = bookingProblem(moved, id, plan);
  if (problem) throw new Error(problem);
  return { ...plan, bookings: plan.bookings.filter(b => b.id !== id && b.linkedTo !== id)
    .concat(performanceEntriesForPlan(moved, plan)) };
}
function bookingProblem(b, ignoreId, plan, skipLinkedId = null) {
  if (!b || !Number.isInteger(b.start) || b.start < 0 || b.start >= 2880 || !Number.isInteger(entryDuration(b, plan)) || entryDuration(b, plan) < 1 || entryDuration(b, plan) > 1440) return 'Enter a valid start time and duration.';
  if (!eventDays(plan.event).includes(b.date) || !planStages(plan).includes(b.stage)) return 'Choose a valid festival day and stage.';
  if (isPerformance(b)) {
    if (!plan.artists.some(a => a.id === b.artistId)) return 'Choose an artist from the catalogue.';
    if (!Number.isFinite(entryFee(b, plan)) || entryFee(b, plan) < 0) return 'Enter a valid performance fee.';
    if (b.status !== undefined && !['tentative', 'confirmed'].includes(b.status)) return 'Choose Tentative or Confirmed.';
    if (!Number.isInteger(b.changeover ?? 0) || (b.changeover ?? 0) < 0 || (b.changeover ?? 0) > 1440) return 'Enter a valid changeover duration.';
  }
  const unavailable = availabilityProblem(b, plan.event, plan);
  if (unavailable) return unavailable;
  const end = b.start + entryDuration(b, plan) + (isPerformance(b) ? b.changeover || 0 : 0);
  const clashes = plan.bookings.filter(x => x.id !== ignoreId && x.linkedTo !== ignoreId && x.id !== skipLinkedId && x.date === b.date && x.stage === b.stage && b.start < x.start + entryDuration(x, plan) && end > x.start).sort((x, y) => x.start - y.start);
  if (clashes.length) return `${stageName(b.stage, plan)} is booked: ${clashes.map(x => `${entryName(x, plan)} (${timeText(x.start)}–${timeText(x.start + entryDuration(x, plan))})`).join(', ')}. The conflicting bookings end at ${timeText(Math.max(...clashes.map(x => x.start + entryDuration(x, plan))))}. Choose a slot that fits the entire appointment and changeover.`;
  if (isPerformance(b)) {
    const artistClash = plan.bookings.find(x => isPerformance(x) && x.id !== ignoreId && x.date === b.date && x.artistId === b.artistId && b.start < x.start + entryDuration(x, plan) && b.start + entryDuration(b, plan) > x.start);
    if (artistClash) return `${entryName(b, plan)} is already performing on ${stageName(artistClash.stage, plan)} from ${timeText(artistClash.start)}–${timeText(artistClash.start + entryDuration(artistClash, plan))}. Choose a time after that performance ends or before it starts.`;
  }
  return '';
}
// Booking the same artist more than once is allowed (e.g. two days), but the organiser gets a
// warning first. Returns '' when the artist has no other performance, otherwise the warning text.
// ignoreId = the booking being edited; it never counts as "another" performance.
function doubleBookingWarning(b, ignoreId, plan) {
  if (!b || !isPerformance(b)) return '';
  const others = plan.bookings.filter(x => isPerformance(x) && x.id !== ignoreId && x.artistId === b.artistId)
    .sort((x, y) => x.date.localeCompare(y.date) || x.start - y.start);
  if (!others.length) return '';
  const list = others.map(x => `${dateText(x.date)} · ${stageName(x.stage, plan)} ${timeText(x.start)}–${timeText(x.start + entryDuration(x, plan))}`).join('; ');
  return `${entryName(b, plan)} is already booked ${others.length === 1 ? 'once' : others.length + ' times'}: ${list}. Book them again?`;
}
function validation(b, ignoreId = null) {
  if (state.final) return 'This lineup is final. Reopen it to make changes.';
  if (ignoreId && state.bookings.some(x => x.id === ignoreId && x.linkedTo)) return 'Edit the linked performance to change its automatic changeover.';
  return bookingProblem(b, ignoreId, state);
}
function nextFreeSlot(b, ignoreId = null) {
  const h = stageHours(b.date, b.stage), length = entryDuration(b) + (isPerformance(b) ? b.changeover || 0 : 0);
  if (!Number.isInteger(length) || length < 1 || !Number.isFinite(b.start)) return null;
  for (let minute = Math.max(h.start, Math.ceil(b.start)); minute + length <= h.end; minute++) {
    if (!bookingProblem({ ...b, start: minute }, ignoreId, state)) return minute;
  }
  return null;
}
const BACKUP_FORMAT = 'festival-architect-lineup';
const BACKUP_VERSION = 1;
function makePlanBackup(plan = state) {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), plan: normalizePlan(plan) };
}
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function validId(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(value); }
function validText(value, max, empty = false) { return typeof value === 'string' && value.length <= max && (empty || value.trim().length > 0); }
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
function validHours(hours) { return isObject(hours) && Number.isInteger(hours.start) && Number.isInteger(hours.end) && hours.start >= 0 && hours.start < 1440 && hours.start < hours.end && hours.end - hours.start <= 1440 && hours.end < 2880; }
function updatedFestivalEvent(details, previousEvent) {
  const event = { ...previousEvent, ...details };
  if (event.dayHours) {
    event.dayHours = Object.fromEntries(Object.entries(event.dayHours)
      .filter(([date]) => date >= event.startDate && date <= event.endDate));
  }
  return event;
}

function eventChangeProblem(event, plan) {
  if (!validText(event.name, 100)) return 'Enter a festival name of 1–100 characters.';
  if (!validText(event.venue, 120, true)) return 'Enter a venue or city of up to 120 characters.';
  if (!validDate(event.startDate) || !validDate(event.endDate) || event.endDate < event.startDate) {
    return 'Choose valid festival dates with the last day on or after the first day.';
  }
  if (eventDays(event).at(-1) !== event.endDate) return 'The festival cannot be longer than 366 days.';
  if (!validHours({ start: event.startMinutes, end: event.endMinutes })) {
    return 'Enter valid opening and closing times. Use HH:MM; a closing time earlier than opening is on the next morning.';
  }
  for (const booking of plan.bookings) {
    const name = entryName(booking, plan);
    if (booking.date < event.startDate || booking.date > event.endDate) {
      return `${name} on ${dateText(booking.date)} is outside the new festival dates. Move or remove it in the Lineup Planner first.`;
    }
    const problem = availabilityProblem(booking, event, plan);
    if (problem) return `${name}: ${problem} Move or remove the appointment in the Lineup Planner first.`;
  }
  return '';
}

function planProblems(plan) {
  const problems = [];
  if (!isObject(plan) || !Array.isArray(plan.artists) || !Array.isArray(plan.bookings) || !isObject(plan.settings) || !isObject(plan.event)) return ['The backup is missing its artists, bookings, settings or event.'];
  if (plan.artists.length > 1000 || plan.bookings.length > 10000) return ['The backup contains too many artists or appointments.'];
  if (typeof plan.final !== 'boolean') problems.push('The final-plan setting must be true or false.');
  if (!Number.isInteger(plan.settings.stages) || plan.settings.stages < 1 || plan.settings.stages > 12 || !Number.isFinite(plan.settings.budget) || plan.settings.budget < 0) return ['Stage count or budget is invalid.'];
  const e = plan.event;
  if ((e.name !== undefined && !validText(e.name, 100)) || (e.venue !== undefined && !validText(e.venue, 120, true))) return ['The festival name or venue is invalid.'];
  if (!validDate(e.startDate) || !validDate(e.endDate) || e.endDate < e.startDate || !validHours({ start: e.startMinutes, end: e.endMinutes })) return ['The event dates or opening hours are invalid.'];
  if ((new Date(e.endDate + 'T12:00:00Z') - new Date(e.startDate + 'T12:00:00Z')) / 86400000 >= 366) return ['The event cannot be longer than 366 days.'];
  const dates = eventDays(e), stageIds = planStages(plan);
  if (plan.settings.stageNames !== undefined && !isObject(plan.settings.stageNames)) problems.push('Stage names must be a list of stage identifiers and names.');
  else for (const [id, name] of Object.entries(plan.settings.stageNames || {})) {
    if (!/^[A-L]$/.test(id) || !validText(name, 60)) problems.push('A stage name is invalid.');
  }
  if (e.dayHours !== undefined && !isObject(e.dayHours)) problems.push('Daily opening hours are invalid.');
  else for (const [date, hours] of Object.entries(e.dayHours || {})) {
    if (!dates.includes(date) || !validHours(hours) || (hours.stages !== undefined && !isObject(hours.stages))) { problems.push('Daily opening hours are invalid.'); continue; }
    for (const [stage, opening] of Object.entries(hours.stages || {})) if (!stageIds.includes(stage) || !validHours(opening) || opening.start < hours.start || opening.end > hours.end) problems.push('A stage’s opening hours are invalid.');
  }
  const artistIds = new Set(), bookingIds = new Set();
  for (const a of plan.artists) {
    if (!isObject(a) || !validId(a.id) || artistIds.has(a.id) || !validText(a.name, 100) || !validText(a.genre, 80) || !Number.isFinite(a.fee) || a.fee < 0 || !Number.isInteger(a.duration) || a.duration < 1 || a.duration > 1440 || !/^#[0-9a-f]{6}$/i.test(a.colour || '')) { problems.push('An artist has invalid details or a duplicate identifier.'); continue; }
    artistIds.add(a.id);
  }
  for (const b of plan.bookings) {
    if (!isObject(b) || !(validId(b.id) || (b.type === 'block' && validId(b.linkedTo) && b.id === `changeover-${b.linkedTo}`)) || bookingIds.has(b.id)) { problems.push('An appointment has an invalid or duplicate identifier.'); continue; }
    bookingIds.add(b.id);
    if (!dates.includes(b.date) || !stageIds.includes(b.stage) || !Number.isInteger(b.start) || b.start < 0 || b.start >= 2880 || !Number.isInteger(b.duration) || b.duration < 1 || b.duration > 1440 || !validText(b.notes, 2000, true)) problems.push('An appointment has invalid dates, times or notes.');
    if (b.type === 'block') {
      if (!validText(b.title, b.linkedTo ? 120 : 100) || (b.linkedTo !== undefined && !validId(b.linkedTo))) problems.push('A calendar block has invalid details.');
    } else if ((b.type !== undefined && b.type !== 'performance') || !artistIds.has(b.artistId) || !Number.isFinite(b.fee) || b.fee < 0 || !['tentative', 'confirmed'].includes(b.status) || !Number.isInteger(b.changeover) || b.changeover < 0 || b.changeover > 1440) problems.push('A performance has invalid artist, fee, status or changeover details.');
  }
  if (problems.length) return problems;
  if (!Number.isFinite(plan.bookings.reduce((sum, b) => sum + entryFee(b, plan), 0))) return ['The combined performance fees are too large.'];
  for (const b of plan.bookings) {
    if (!isPerformance(b) && b.linkedTo) {
      const parent = plan.bookings.find(x => x.id === b.linkedTo && isPerformance(x));
      if (!parent || parent.changeover <= 0 || b.id !== `changeover-${parent.id}` || b.date !== parent.date || b.stage !== parent.stage || b.start !== parent.start + parent.duration || b.duration !== parent.changeover) problems.push('An automatic changeover does not match its performance.');
    }
    if (isPerformance(b) && b.changeover > 0 && !plan.bookings.some(x => x.id === `changeover-${b.id}` && x.linkedTo === b.id && x.type === 'block')) problems.push('A performance is missing its linked changeover.');
    const problem = bookingProblem(b, b.id, plan);
    if (problem) problems.push(problem);
  }
  return problems;
}
function parsePlanBackup(text) {
  if (typeof text !== 'string' || text.length > 5 * 1024 * 1024) throw new Error('Choose a lineup backup smaller than 5 MB.');
  let backup;
  try { backup = JSON.parse(text); } catch { throw new Error('This file is not valid JSON. Choose a downloaded lineup backup.'); }
  if (!isObject(backup) || backup.format !== BACKUP_FORMAT || backup.version !== BACKUP_VERSION || !isObject(backup.plan)) throw new Error('This is not a supported Festival Architect lineup backup.');
  // Validate before normalising: an import must never silently discard broken entries.
  const problems = planProblems(backup.plan);
  if (problems.length) throw new Error(problems[0]);
  const result = normalizePlan(backup.plan);
  result.dailyHoursResetV1 = true;
  result.stageHoursResetV1 = true;
  return result;
}

// Pure automatic planner: work on a copy; applying the result belongs to the screen.
function automaticLineup(plan, { changeover = 15, realistic = false, headlinerId, headliners } = {}) {
  if (realistic) return realisticLineup(plan, {changeover,headlinerId,headliners});
  const result = { bookings: [], skipped: [], problem: '' };
  const fail = message => ({ ...result, problem: message });
  if (plan.final) return fail('Reopen the final plan before automatically planning.');
  const problems = planProblems(plan);
  if (problems.length) return fail(problems[0]);
  if (!Number.isInteger(changeover) || changeover < 15 || changeover > 1440) return fail('Enter a whole changeover time from 15 to 1440 minutes.');
  const trial = clonePlanValue(plan), dates = eventDays(plan.event), stageIds = planStages(plan);
  const legacyId = headlinerId ?? [...plan.artists].sort((a,b) => b.fee-a.fee || a.id.localeCompare(b.id))[0]?.id;
  const selections = headliners ? dates.map(date => [date, headliners[date]]) : [[dates.at(-1), legacyId]];
  const dailyHeadliners = selections.map(([date, id]) => [date, plan.artists.find(artist => artist.id === id)]);
  if (dailyHeadliners.some(([, artist]) => !artist)) return fail(headliners ? 'Choose a headliner for each festival day from This festival.' : 'Choose a headliner from This festival.');
  const headlineArtists = new Set(selections.map(([, id]) => id));
  if (headlineArtists.size !== selections.length) return fail('Choose a different headliner for each festival day.');
  const booked = new Set(plan.bookings.filter(isPerformance).map(b => b.artistId));
  // The artist budget is not a hard limit here either (brief: "Flexible budget"): the screen
  // shows the total and asks before a suggestion creates or increases an overrun.
  const genre = b => (plan.artists.find(a => a.id === b.artistId)?.genre || '').trim().toLowerCase();
  function genreFits(b) {
    const sequence = trial.bookings.filter(x => isPerformance(x) && x.date === b.date && x.stage === b.stage).concat(b).sort((a,b) => a.start-b.start);
    return !sequence.some((x,i) => i >= 2 && genre(x) === genre(sequence[i-1]) && genre(x) === genre(sequence[i-2]));
  }
  function fits(b) {
    if (bookingProblem(b,null,trial) || !genreFits(b)) return false;
    return !trial.bookings.some(x => isPerformance(x) && x.date === b.date && x.stage === b.stage &&
      b.start < x.start+x.duration+Math.max(changeover,x.changeover || 0) &&
      b.start+b.duration+Math.max(changeover,b.changeover || 0) > x.start);
  }
  let serial = 1;
  function make(a, date, stage, start) {
    let id;
    do { id = 'auto-' + serial++; } while (trial.bookings.some(b => b.id === id));
    return { id, artistId:a.id, date, stage, start, duration:a.duration, fee:a.fee, changeover, status:'tentative', notes:'' };
  }
  const closing = new Map();
  for (const [date, headliner] of dailyHeadliners) {
    let headline;
    if (booked.has(headliner.id)) {
      headline = plan.bookings.filter(b => isPerformance(b) && b.artistId === headliner.id && b.date === date)
        .sort((a,b) => b.start + b.duration - a.start - a.duration)[0];
      if (!headline || plan.bookings.some(b => isPerformance(b) && b.date === date && b.start+b.duration > headline.start+headline.duration)) return fail(`The existing headliner is not the closing performance on ${dateText(date)}. Choose another artist or adjust the timetable.`);
    } else {
      const candidates = stageIds.map(stage => {
        const h = stageHours(date, stage, plan.event);
        return {...make(headliner, date, stage, h.end - headliner.duration), changeover:0};
      }).sort((a,b) => (b.start+b.duration)-(a.start+a.duration));
      headline = candidates.find(b => fits(b) && !plan.bookings.some(x => isPerformance(x) && x.date === date && x.start+x.duration > b.start+b.duration));
      if (!headline) return fail(`No closing slot fits the headliner and changeover on ${dateText(date)}. Free a closing slot or choose another artist.`);
      const entries = performanceEntriesForPlan(headline, trial);
      trial.bookings.push(...entries); result.bookings.push(...entries);
    }
    closing.set(date, headline);
  }
  result.headlinerBookings = Object.fromEntries([...closing].map(([date, booking]) => [date, booking.id]));
  // Try different genres first when a run blocks placement; repeat until no artist can be added.
  let pending = plan.artists.filter(a => !headlineArtists.has(a.id) && !booked.has(a.id)).sort((a,b) => a.fee-b.fee || a.id.localeCompare(b.id));
  while (pending.length) {
    let progress = false;
    for (const a of [...pending]) {
      const slots = [];
      for (const date of dates) for (const stage of stageIds) {
        const h = stageHours(date, stage, plan.event);
        const entries = trial.bookings.filter(b => b.date === date && b.stage === stage);
        const starts = [...new Set([h.start, ...entries.map(b => b.start + entryDuration(b,trial) + (isPerformance(b) ? Math.max(changeover,b.changeover || 0) : 0))])].sort((a,b)=>a-b);
        for (const start of starts) {
          const b = make(a,date,stage,start);
          const headline = closing.get(date);
          if (headline && start+a.duration > headline.start+headline.duration) continue;
          if (fits(b)) {
            slots.push({ b, dayLoad:trial.bookings.filter(x => isPerformance(x) && x.date === date).length,
              stageLoad:entries.filter(isPerformance).length });
            break;
          }
        }
      }
      slots.sort((a,b) => a.dayLoad-b.dayLoad || a.stageLoad-b.stageLoad || a.b.date.localeCompare(b.b.date) || a.b.start-b.b.start || a.b.stage.localeCompare(b.b.stage));
      if (!slots.length) continue;
      const entries = performanceEntriesForPlan(slots[0].b,trial);
      trial.bookings.push(...entries); result.bookings.push(...entries);
      pending = pending.filter(x => x.id !== a.id); progress = true;
    }
    if (!progress) break;
  }
  // Spread each new stage/day sequence over its available window instead of packing
  // it at opening. Existing appointments are fixed anchors; genre order stays intact.
  for (const date of dates) for (const stage of stageIds) {
    const hours = stageHours(date,stage,plan.event);
    const headline = closing.get(date);
    const end = headline ? Math.min(hours.end, headline.start+headline.duration) : hours.end;
    const fixed = plan.bookings.filter(b => b.date===date && b.stage===stage)
      .map(b => ({start:b.start,end:b.start+entryDuration(b,plan)+(isPerformance(b)?Math.max(changeover,b.changeover||0):0)}))
      .sort((a,b)=>a.start-b.start);
    const windows = [];
    let cursor = hours.start;
    for (const block of fixed) {
      if (block.start>cursor) windows.push({start:cursor,end:Math.min(block.start,end)});
      cursor=Math.max(cursor,block.end);
    }
    if (cursor<end) windows.push({start:cursor,end});
    for (const window of windows) {
      const sequence = result.bookings.filter(b => isPerformance(b) && b.date===date && b.stage===stage && b.start>=window.start && b.start+b.duration+(b.changeover||0)<=window.end)
        .sort((a,b)=>a.start-b.start);
      if (!sequence.length) continue;
      const last = sequence.at(-1);
      // There is no changeover after the final performance of a stage/day.
      const finalWindow = window.end===end;
      const reserved = sequence.reduce((sum,b)=>sum+b.duration+(b===last&&finalWindow?0:b.changeover),0);
      const slack = window.end-window.start-reserved;
      if (slack<0) continue;
      let position=window.start;
      sequence.forEach((b,i)=>{
        b.start=sequence.length===1 ? (b.id===headline?.id ? window.end-b.duration : Math.round(window.start+slack/2)) : Math.round(position);
        if(b===last&&finalWindow)b.changeover=0;
        position+=b.duration+b.changeover+(sequence.length>1?slack/(sequence.length-1):0);
        // The linked block moves together with its performance.
        const linked=result.bookings.find(x=>x.linkedTo===b.id);
        if(linked){linked.start=b.start+b.duration;linked.duration=b.changeover;}
      });
    }
  }
  result.bookings=result.bookings.filter(b=>isPerformance(b)||!b.linkedTo||b.duration>0);
  result.skipped = pending.map(a => ({ artistId:a.id, reason:'No slot found within the hours, changeover and genre rules.' }));
  return result;
}

// Use a padded music window and, when capacity permits, one shared running order
// across stages. The compact allocator remains the capacity/genre assignment step.
function realisticLineup(plan, {changeover=15,headlinerId,headliners}={}) {
  const padded=clonePlanValue(plan);
  padded.event.dayHours={...padded.event.dayHours};
  let usePadding=true;
  for(const date of eventDays(plan.event)) {
    const h=dayHours(date,plan.event), start=h.start+30, end=h.end-15;
    if(end<=start){usePadding=false;break;}
    padded.event.dayHours[date]={start,end,stages:{}};
    for(const stage of planStages(plan)) {
      const hours=stageHours(date,stage,plan.event);
      const bounds={start:Math.max(start,hours.start),end:Math.min(end,hours.end)};
      if(!validHours(bounds)){usePadding=false;break;}
      padded.event.dayHours[date].stages[stage]=bounds;
    }
  }
  // Fixed existing appointments can occupy the arrival/exit window; never move them.
  if(usePadding&&planProblems(padded).length)usePadding=false;
  let result=automaticLineup(usePadding?padded:plan,{changeover,headlinerId,headliners});
  // If the padded window loses artists, first try the full window so availability
  // wins over a preference. Explain the reduced arrival/exit buffer in the review.
  if(usePadding&&(result.problem||result.skipped.length)) {
    const full=automaticLineup(plan,{changeover,headlinerId,headliners});
    if(!full.problem&&(result.problem||full.skipped.length<result.skipped.length)){result=full;usePadding=false;}
  }
  if(result.problem)return result;
  const event=usePadding?padded.event:plan.event;
  for(const date of eventDays(plan.event)) {
    const headlineId = result.headlinerBookings[date];
    const generated=result.bookings.filter(isPerformance).filter(b=>b.date===date);
    if(!generated.length)continue;
    // Merge each stage's genre-safe order, preferring a different stage each time.
    const queues=planStages(plan).map(stage=>generated.filter(b=>b.stage===stage).sort((a,b)=>a.start-b.start));
    const order=[];let previous='';
    while(queues.some(q=>q.length)) {
      const available=queues.filter(q=>q.length&&!(q[0].id===headlineId&&queues.some(other=>other.some(b=>b.id!==headlineId))));
      const queue=available.sort((a,b)=>(a[0].stage===previous)-(b[0].stage===previous)||b.length-a.length||a[0].stage.localeCompare(b[0].stage))[0];
      if(!queue)break;
      const b=queue.shift();order.push(b);previous=b.stage;
    }
    if(order.length!==generated.length)continue;
    const h=dayHours(date,event), duration=order.reduce((sum,b)=>sum+b.duration,0);
    const spare=h.end-h.start-duration-changeover*(order.length-1);
    if(spare<0)continue; // Stage parallelism is needed; keep the valid allocation.
    const gap=changeover+(order.length>1?spare/(order.length-1):0);
    let cursor=order.length===1?(order[0].id===headlineId?h.end-order[0].duration:h.start+spare/2):h.start;
    const replacements=order.map((b,i)=>{
      const start=i===order.length-1 ? h.end-b.duration : Math.max(h.start,Math.round(cursor/5)*5);cursor+=b.duration+gap;
      return {...b,start,changeover:i===order.length-1?0:changeover};
    });
    const ids=new Set(generated.map(b=>b.id));
    const retained=plan.bookings.concat(result.bookings).filter(b=>!ids.has(b.id)&&!ids.has(b.linkedTo));
    const trial={...plan,bookings:retained.concat(replacements.flatMap(b=>performanceEntriesForPlan(b,plan)))};
    const performances=trial.bookings.filter(b=>isPerformance(b)&&b.date===date).sort((a,b)=>a.start-b.start);
    const fitsHours=replacements.every(b=>!availabilityProblem(b,event,trial));
    const noOverlap=performances.every((b,i)=>!i||b.start>=performances[i-1].start+performances[i-1].duration+changeover);
    // Shifting a day's order must also respect other days, blocks and saved data rules.
    const closingSet=trial.bookings.find(b=>b.id===headlineId);
    const headlineLast=!closingSet||date!==closingSet.date||performances.every(b=>b.start+b.duration<=closingSet.start+closingSet.duration);
    if(fitsHours&&noOverlap&&headlineLast&&!planProblems(trial).length) {
      result.bookings=result.bookings.filter(b=>!ids.has(b.id)&&!ids.has(b.linkedTo)).concat(replacements.flatMap(b=>performanceEntriesForPlan(b,plan)));
    }
  }
  const sets=plan.bookings.concat(result.bookings).filter(isPerformance);
  result.overlaps=sets.reduce((sum,b,i)=>sum+sets.slice(i+1).filter(x=>x.date===b.date&&x.stage!==b.stage&&b.start<x.start+x.duration&&x.start<b.start+b.duration).length,0);
  result.notice=[usePadding?'Music starts at least 30 minutes after doors open and finishes at least 15 minutes before closing.':'The schedule uses the full opening hours to retain existing bookings or fit more artists.', result.overlaps?'Some performances overlap across stages in this suggestion. More time or fewer sets may help.':'No performances overlap across stages.'].join(' ');
  return result;
}
