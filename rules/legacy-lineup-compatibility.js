// Archived single-day rule contract for the original regression tests only.
// Node loads this through festival-rules.js; index.html never loads it in the browser.
// Current app behaviour is documented in the active product brief and implemented
// by the multi-day rules in festival-rules.js. These exports are not current instructions.

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
const timeText = minutes => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
function emptyState() { return { bookings: [], final: false }; }
function parseState(text) {
  try { return JSON.parse(text) || emptyState(); } catch { return emptyState(); }
}
function artist(id) { return ARTISTS.find(a => a.id === id); }
function total(state) { return state.bookings.reduce((sum, b) => sum + artist(b.artistId).fee, 0); }
function conflict(state, stage, start, duration, ignoreId) {
  const end = start + duration;
  return state.bookings.some(b => b.id !== ignoreId && b.stage === stage && start < b.start + artist(b.artistId).duration && end > b.start);
}
function validation(state, booking, ignoreId = null) {
  const a = artist(booking.artistId), end = booking.start + a.duration;
  if (state.final) return 'This lineup is final. Reopen it to make changes.';
  if (booking.start < START || end > END) return `This ${a.duration}-minute set must run between 14:00 and 23:00.`;
  if (conflict(state, booking.stage, booking.start, a.duration, ignoreId)) return `That slot overlaps another performance on Stage ${booking.stage}.`;
  const existing = state.bookings.find(b => b.artistId === booking.artistId && b.id !== ignoreId);
  if (existing) return `${a.name} is already in the lineup.`;
  const replacedFee = ignoreId ? artist(state.bookings.find(b => b.id === ignoreId).artistId).fee : 0;
  if (total(state) - replacedFee + a.fee > BUDGET) return `Adding ${a.name} would exceed the €10,000 artist budget.`;
  return '';
}
function finaliseProblems(state) {
  const problems = [];
  if (state.bookings.length < MIN_ARTISTS_TO_FINALISE) problems.push('Book at least four artists before finalising.');
  const draft = { ...state, final: false };
  state.bookings.forEach(b => {
    const problem = validation(draft, b, b.id);
    if (problem) problems.push(`${artist(b.artistId).name}: ${problem}`);
  });
  return problems;
}
module.exports = { ARTISTS, BUDGET, START, END, MIN_ARTISTS_TO_FINALISE, STORAGE_KEY,
  timeText, emptyState, parseState, artist, total, conflict, validation, finaliseProblems };
