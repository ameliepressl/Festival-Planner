// Festival Architect — the demo festival: a complete, realistic example for presentations and trying the app.
// Only data lives here (no screen code), so it can be tested against the real rules (tests/).
// demo/demo-loader.js writes it into the browser when "Load demo festival" is confirmed.

const DEMO_FESTIVAL_NAME = 'Lisbon Sound Festival';

const DEMO_ARTISTS = [
  { id: 'naya', name: 'Naya Bloom', genre: 'Dream pop', fee: 1800, duration: 60, colour: '#f5c8be' },
  { id: 'nightbus', name: 'Night Bus', genre: 'Indie dance', fee: 1400, duration: 45, colour: '#f9dc88' },
  { id: 'satori', name: 'Satori Club', genre: 'Electronic', fee: 2200, duration: 75, colour: '#b7e4dc' },
  { id: 'mila', name: 'Mila & The Sun', genre: 'Soul / R&B', fee: 1200, duration: 45, colour: '#d8c7ed' },
  { id: 'tomas', name: 'Tomás Vale', genre: 'Alt folk', fee: 900, duration: 40, colour: '#e7d5ae' },
  { id: 'redwood', name: 'Redwood Hearts', genre: 'Rock', fee: 2000, duration: 60, colour: '#ffd0a2' },
  { id: 'luna', name: 'Luna Lune', genre: 'Ambient pop', fee: 1100, duration: 50, colour: '#c7d9f4' },
  { id: 'riko', name: 'Riko Reyes', genre: 'Global beats', fee: 1500, duration: 60, colour: '#d4e8b7' },
  { id: 'aurora', name: 'Aurora Lights', genre: 'Electronic', fee: 2600, duration: 75, colour: '#b7e4dc' },
  { id: 'fado', name: 'Fado Nova', genre: 'Fado', fee: 800, duration: 45, colour: '#f5c8be' }
];

// [artist, day (0 or 1), stage, start "HH:MM", status, notes]
const DEMO_SLOTS = [
  ['tomas', 0, 'A', '16:00', 'confirmed', 'Opening act, acoustic set.'],
  ['fado', 0, 'B', '17:00', 'confirmed', 'Local guest, Portuguese guitar on stage.'],
  ['mila', 0, 'A', '18:00', 'confirmed', ''],
  ['luna', 0, 'B', '19:00', 'tentative', 'Waiting for the signed contract.'],
  ['redwood', 0, 'A', '20:00', 'confirmed', 'Full backline, drum riser needed.'],
  ['satori', 0, 'A', '21:45', 'confirmed', 'Headliner day 1.'],
  ['naya', 1, 'A', '18:00', 'confirmed', ''],
  ['riko', 1, 'A', '19:30', 'confirmed', ''],
  ['nightbus', 1, 'B', '20:00', 'tentative', ''],
  ['aurora', 1, 'A', '21:30', 'confirmed', 'Headliner New Year\'s Eve, countdown show after the set.']
];

const DEMO_VENDORS = ['tacos', 'bowls', 'pizza', 'bifanas', 'nata', 'falafel', 'beer', 'wine', 'coffee', 'lemonade', 'merch'];

const minutesOf = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

// Everything the demo writes, per section. "placements" are built with the vendor rules
// (confirmVendor), so they always follow the same rules as clicking "Confirm" on the page.
function demoFestival() {
  const days = ['2026-12-30', '2026-12-31'];
  const plan = {
    artists: DEMO_ARTISTS.map((a) => ({ ...a })),
    bookings: DEMO_SLOTS.map(([artistId, day, stage, start, status, notes], i) => ({
      id: `demo-${i + 1}`, artistId, date: days[day], stage, start: minutesOf(start), status, notes, changeover: 0
    })),
    final: false,
    settings: { stages: 2, budget: 18000, stageNames: { A: 'Main Stage', B: 'Warehouse' } },
    event: { name: DEMO_FESTIVAL_NAME, venue: 'Parque Tejo, Lisbon', startDate: days[0], endDate: days[1], startMinutes: 840, endMinutes: 1380 },
    dailyHoursResetV1: true,
    stageHoursResetV1: true
  };
  return {
    plan,
    ground: { visitors: 5000 },
    vendors: DEMO_VENDORS,
    finance: { ticketPrice: 39, sponsorship: 15000 }
  };
}

// In the browser these are plain globals; in the tests (Node) they are exported.
if (typeof module !== 'undefined') {
  module.exports = { DEMO_FESTIVAL_NAME, DEMO_ARTISTS, DEMO_SLOTS, DEMO_VENDORS, demoFestival };
}
