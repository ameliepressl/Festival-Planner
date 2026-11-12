// Original single-day baseline exports are kept for compatibility and their existing tests.
(function legacyBaseline() {
// Festival Architect — the rules (business logic).
// No screen code lives here, so the rules can be tested on their own (tests/) and used by app.js.
// Every rule comment names its ID from product-brief/festival-architect-brief.html.

const ARTISTS = [
  { id: 'naya', name: 'Naya Bloom', genre: 'Dream pop', fee: 1800, duration: 60, colour: '#f5c8be' },
  { id: 'nightbus', name: 'Night Bus', genre: 'Indie dance', fee: 1400, duration: 45, colour: '#f9dc88' },
  { id: 'satori', name: 'Satori Club', genre: 'Electronic', fee: 2200, duration: 75, colour: '#b7e4dc' },
  { id: 'mila', name: 'Mila & The Sun', genre: 'Soul / R&B', fee: 1200, duration: 45, colour: '#d8c7ed' },
  { id: 'tomas', name: 'Tomás Vale', genre: 'Alt folk', fee: 900, duration: 40, colour: '#e7d5ae' },
  { id: 'redwood', name: 'Redwood Hearts', genre: 'Rock', fee: 2000, duration: 60, colour: '#ffd0a2' },
  { id: 'luna', name: 'Luna Lune', genre: 'Ambient pop', fee: 1100, duration: 50, colour: '#c7d9f4' },
  { id: 'riko', name: 'Riko Reyes', genre: 'Global beats', fee: 1500, duration: 60, colour: '#d4e8b7' }
];
const BUDGET = 10000, START = 14 * 60, END = 23 * 60;
const MIN_ARTISTS_TO_FINALISE = 4;
const STORAGE_KEY = 'festival-architect-v2';

// Times are minutes after midnight (16:30 = 990), so they can be added and compared.
const timeText = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

// The plan that is saved: every booking (id, artistId, stage, start) and whether the plan is final.
function emptyState() { return { bookings: [], final: false }; }

// Read a saved plan back. Anything broken or missing gives an empty plan instead of crashing.
function parseState(text) {
  try { return JSON.parse(text) || emptyState(); } catch { return emptyState(); }
}

function artist(id) { return ARTISTS.find((a) => a.id === id); }

// The sum of the fees of all booked artists. Calculated every time, never saved.
function total(state) { return state.bookings.reduce((sum, b) => sum + artist(b.artistId).fee, 0); }

// FA R2: two performances clash when they overlap on the same stage. Starting exactly at the other's end is fine.
// ignoreId is the booking being edited, so it does not clash with its own old slot (FA R5).
function conflict(state, stage, start, duration, ignoreId) {
  const end = start + duration;
  return state.bookings.some((b) => b.id !== ignoreId && b.stage === stage && start < b.start + artist(b.artistId).duration && end > b.start);
}

// Return why a booking is not allowed, or '' when it is. An edit passes the id of the booking it replaces (FA R5).
function validation(state, booking, ignoreId = null) {
  const a = artist(booking.artistId), end = booking.start + a.duration;
  if (state.final) return 'This lineup is final. Reopen it to make changes.'; // FA R5
  if (booking.start < START || end > END) return `This ${a.duration}-minute set must run between 14:00 and 23:00.`; // FA R2
  if (conflict(state, booking.stage, booking.start, a.duration, ignoreId)) return `That slot overlaps another performance on Stage ${booking.stage}.`; // FA R2
  const existing = state.bookings.find((b) => b.artistId === booking.artistId && b.id !== ignoreId);
  if (existing) return `${a.name} is already in the lineup.`; // FA R1
  const replacedFee = ignoreId ? artist(state.bookings.find((b) => b.id === ignoreId).artistId).fee : 0;
  if (total(state) - replacedFee + a.fee > BUDGET) return `Adding ${a.name} would exceed the €10,000 artist budget.`; // FA R4
  return '';
}

// FA05: a plan can only be finalised with at least four artists and when every booking passes all rules.
// Returns every problem; an empty list means the plan may be finalised.
function finaliseProblems(state) {
  const problems = [];
  if (state.bookings.length < MIN_ARTISTS_TO_FINALISE) problems.push('Book at least four artists before finalising.');
  const draft = { ...state, final: false };
  state.bookings.forEach((b) => {
    const problem = validation(draft, b, b.id);
    if (problem) problems.push(`${artist(b.artistId).name}: ${problem}`);
  });
  return problems;
}

// In the browser these are plain globals for app.js; in the tests (Node) they are exported.
if (typeof module !== 'undefined') {
  module.exports = {
    ARTISTS, BUDGET, START, END, MIN_ARTISTS_TO_FINALISE, STORAGE_KEY,
    timeText, emptyState, parseState, artist, total, conflict, validation, finaliseProblems
  };
}

})();

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
const DEFAULT_EVENT = { startDate: '2026-10-15', endDate: '2026-10-16', startMinutes: 840, endMinutes: 1380 };
const timeText = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
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
function entryDuration(b, plan = state) { return b.duration ?? plan.artists.find(a => a.id === b.artistId)?.duration; }
function entryName(b, plan = state) { return isPerformance(b) ? plan.artists.find(a => a.id === b.artistId)?.name || 'Unknown artist' : b.title; }
function entryFee(b, plan = state) { return isPerformance(b) ? b.fee ?? plan.artists.find(a => a.id === b.artistId)?.fee : 0; }
const performances = () => state.bookings.filter(isPerformance);
const artistCount = () => new Set(performances().map(b => b.artistId)).size;
const total = () => state.bookings.reduce((sum, b) => sum + entryFee(b), 0);
function inputMinutes(value) {
  if (!/^\d{2}:\d{2}$/.test(value)) return NaN;
  const [h, m] = value.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59 ? h * 60 + m : NaN;
}
// Existing performances receive snapshots once: later catalogue edits only change defaults for future bookings.
function normalizePlan(saved) {
  const source = saved && typeof saved === 'object' && !Array.isArray(saved) ? clonePlanValue(saved) : {};
  const result = {
    ...source,
    final: source.final === true,
    artists: catalogueForSavedPlan(source),
    settings: { stages: 2, budget: 10000, ...source.settings },
    event: { ...DEFAULT_EVENT, ...source.event }
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
function bookingProblem(b, ignoreId, plan, skipLinkedId = null) {
  if (!b || !Number.isInteger(b.start) || b.start < 0 || b.start > 1439 || !Number.isInteger(entryDuration(b, plan)) || entryDuration(b, plan) < 1 || entryDuration(b, plan) > 1440) return 'Enter a valid start time and duration.';
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
function validHours(hours) { return isObject(hours) && Number.isInteger(hours.start) && Number.isInteger(hours.end) && hours.start >= 0 && hours.start < hours.end && hours.end <= 1440; }
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
    return 'Enter valid opening and closing times. Closing time must be later than opening time.';
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
    if (!dates.includes(b.date) || !stageIds.includes(b.stage) || !Number.isInteger(b.start) || b.start < 0 || b.start > 1439 || !Number.isInteger(b.duration) || b.duration < 1 || b.duration > 1440 || !validText(b.notes, 2000, true)) problems.push('An appointment has invalid dates, times or notes.');
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


// A task group finishes when its last scheduled subtask finishes.
function upcomingMilestones(project, today) {
  const milestones = [];
  for (const area of project) {
    for (const task of area.tasks) {
      const date = task.subtasks.reduce((latest, step) => step.end > latest ? step.end : latest, '');
      if (date >= today) milestones.push({ id: task.id, title: task.title, date });
    }
  }
  return milestones.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
}
