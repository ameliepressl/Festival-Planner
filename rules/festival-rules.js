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
// Shared event configuration: a future event page can update this persisted object.
const DEFAULT_EVENT = { startDate: '2026-12-30', endDate: '2026-12-31', startMinutes: 840, endMinutes: 1380 };
const timeText = n => `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
function days() { const dates=[]; const d=new Date(state.event.startDate+'T12:00:00Z'); const end=new Date(state.event.endDate+'T12:00:00Z'); while(d<=end){dates.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+1);} return dates; }
const dateText = date => new Date(date+'T12:00:00Z').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'long',timeZone:'UTC'});
const stages = () => Array.from({length:state.settings.stages},(_,i)=>String.fromCharCode(65+i));
const artist = id => state.artists.find(a=>a.id===id);
const isPerformance = b => b.type!=='block';
const entryDuration = b => isPerformance(b)?artist(b.artistId).duration:b.duration;
const entryName = b => isPerformance(b)?artist(b.artistId).name:b.title;
const entryFee = b => isPerformance(b)?artist(b.artistId).fee:0;
const performances = () => state.bookings.filter(isPerformance);
const artistCount = () => new Set(performances().map(b=>b.artistId)).size;
const total = () => state.bookings.reduce((sum,b)=>sum+entryFee(b),0);
function inputMinutes(value){if(!/^\d{2}:\d{2}$/.test(value))return NaN;const [h,m]=value.split(':').map(Number);return h*60+m;}
// Future event settings can set event.dayHours[date] with start/end and optional stage overrides.
function dayHours(date,event=state.event){const h=event.dayHours?.[date];return {start:h?.start??event.startMinutes,end:h?.end??event.endMinutes};}
function stageHours(date,stage,event=state.event){const day=dayHours(date,event),custom=event.dayHours?.[date]?.stages?.[stage];return custom?{start:Math.max(day.start,custom.start),end:Math.min(day.end,custom.end)}:day;}
function calendarBounds(){const hours=days().map(d=>dayHours(d));return {start:Math.floor(Math.min(...hours.map(h=>h.start))/60)*60,end:Math.ceil(Math.max(...hours.map(h=>h.end))/60)*60};}
function availabilityProblem(b,event=state.event){const h=stageHours(b.date,b.stage,event);return b.start<h.start||b.start+entryDuration(b)>h.end?`Stage ${b.stage} is available ${timeText(h.start)}–${timeText(h.end)} on ${dateText(b.date)}. The entire appointment must fit inside these hours.`:'';}
function validation(b, ignoreId=null){
 const duration=entryDuration(b),end=b.start+duration;
 if(!Number.isInteger(b.start)||!Number.isInteger(duration)||duration<1)return 'Enter a valid start time and duration.';
 if(!days().includes(b.date)||!stages().includes(b.stage))return 'Choose a valid festival day and stage.';
 const unavailable=availabilityProblem(b);if(unavailable)return unavailable;
 const clashes=state.bookings.filter(x=>x.id!==ignoreId&&x.date===b.date&&x.stage===b.stage&&b.start<x.start+entryDuration(x)&&end>x.start).sort((x,y)=>x.start-y.start);
 if(clashes.length)return `Stage ${b.stage} is booked: ${clashes.map(x=>`${entryName(x)} (${timeText(x.start)}–${timeText(x.start+entryDuration(x))})`).join(', ')}. The conflicting bookings end at ${timeText(Math.max(...clashes.map(x=>x.start+entryDuration(x))))}. Choose a free slot that fits the whole set.`;
 if(isPerformance(b)&&state.bookings.some(x=>isPerformance(x)&&x.id!==ignoreId&&x.date===b.date&&x.artistId===b.artistId))return 'This artist is already booked on this day. Choose another day or edit their performance.';
 return '';
}
