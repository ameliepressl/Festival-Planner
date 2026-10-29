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
