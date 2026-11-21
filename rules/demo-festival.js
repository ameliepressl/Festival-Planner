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
  const days = ['2027-03-20', '2027-03-21'];
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

// ——— Second demo: a big hip-hop weekend in Munich ———
// Inspired by the kind of large hip-hop festival that came to Munich in July 2023 (three days,
// several stages, US and European rap). The name, plan and numbers are made up for this app; the
// artists are real entries from the artist library (rules/artist-library.js) with its fictional fees.
// It is planned to about 80 %: some bookings are still tentative, the Rising Stage has no acts on
// Sunday yet, a few food court pitches are still free, the emergency exit widths are not measured
// yet and the cash flow before ticket sales still needs funding.
const MUNICH_DEMO_NAME = 'Munich Loud Weekend';
const MUNICH_VISITORS = 20000; // the largest festival this app plans for (MAX_VISITORS)

// The artist library: a global in the browser, required in the tests (Node).
const munichDemoLibrary = typeof ARTIST_LIBRARY !== 'undefined'
  ? { ARTIST_LIBRARY, libraryArtistToCatalogue }
  : (typeof module !== 'undefined' && typeof require === 'function' ? require('./artist-library.js') : null);

// [artist name, day (0 = Fri, 1 = Sat, 2 = Sun), stage, start "HH:MM", status, notes]
const MUNICH_SLOTS = [
  ['Ice Spice', 0, 'A', '15:00', 'confirmed', 'Opening the main stage.'],
  ['Doechii', 0, 'A', '16:15', 'confirmed', ''],
  ['Central Cee', 0, 'A', '18:00', 'confirmed', ''],
  ['21 Savage', 0, 'A', '19:45', 'confirmed', ''],
  ['Travis Scott', 0, 'A', '21:30', 'confirmed', 'Headliner Friday. Pyro show: fire safety permit still needed.'],
  ['ProfJam', 0, 'B', '14:30', 'confirmed', 'Guest from Lisbon.'],
  ['JID', 0, 'B', '16:00', 'confirmed', ''],
  ['Skepta', 0, 'B', '17:30', 'confirmed', ''],
  ['Little Simz', 0, 'B', '19:15', 'confirmed', 'Live band, extra stage time for line check.'],
  ['Metro Boomin', 0, 'B', '21:00', 'confirmed', ''],
  ['Overmono', 0, 'C', '17:00', 'confirmed', ''],
  ['Kaytranada', 0, 'C', '19:00', 'tentative', 'Offer sent, waiting for the agent.'],
  ['Denzel Curry', 1, 'A', '15:00', 'confirmed', ''],
  ['Megan Thee Stallion', 1, 'A', '16:15', 'confirmed', ''],
  ['Apache 207', 1, 'A', '18:00', 'confirmed', 'Biggest German act of the weekend.'],
  ['ASAP Rocky', 1, 'A', '19:45', 'confirmed', ''],
  ['Future', 1, 'A', '21:30', 'confirmed', 'Headliner Saturday.'],
  ['Kano', 1, 'B', '14:30', 'confirmed', ''],
  ['Asake', 1, 'B', '16:00', 'confirmed', ''],
  ['Rema', 1, 'B', '17:45', 'confirmed', ''],
  ['Dave', 1, 'B', '19:30', 'confirmed', ''],
  ['Booba', 1, 'B', '21:15', 'confirmed', ''],
  ['Uncle Waffles', 1, 'C', '17:00', 'confirmed', ''],
  ['Peggy Gou', 1, 'C', '19:00', 'tentative', 'Contract in review.'],
  ['Loyle Carner', 2, 'A', '15:00', 'confirmed', ''],
  ['Cardi B', 2, 'A', '16:15', 'tentative', 'Waiting for the signed contract.'],
  ['PNL', 2, 'A', '18:00', 'confirmed', ''],
  ['Stormzy', 2, 'A', '19:45', 'confirmed', ''],
  ['Nicki Minaj', 2, 'A', '21:30', 'confirmed', 'Headliner Sunday, closing the festival.'],
  ['Victoria Monét', 2, 'B', '14:30', 'confirmed', ''],
  ['Tems', 2, 'B', '16:00', 'confirmed', ''],
  ['Steve Lacy', 2, 'B', '17:45', 'confirmed', ''],
  ['Brent Faiyaz', 2, 'B', '19:30', 'tentative', 'Routing depends on his Paris show.'],
  ['Wu-Tang Clan', 2, 'B', '21:15', 'tentative', 'Anniversary show, rider still open.']
];

// 16 of the 20 pitches: the 24 original vendors plus stands from the vendor library.
const MUNICH_VENDORS = ['tacos', 'burgers', 'falafel', 'bowls', 'icecream', 'beer', 'cocktails', 'coffee',
  'lemonade', 'kombucha', 'merch', 'v-top-dog', 'v-cluck-norris', 'v-kebab-kingdom', 'v-bao-wow', 'v-hop-culture'];

function munichDemoFestival() {
  const days = ['2027-07-09', '2027-07-10', '2027-07-11'];
  const byName = new Map(munichDemoLibrary.ARTIST_LIBRARY.map((a) => [a.name, a]));
  const artists = [...new Set(MUNICH_SLOTS.map(([name]) => name))].map((name) => munichDemoLibrary.libraryArtistToCatalogue(byName.get(name)));
  const plan = {
    artists,
    bookings: MUNICH_SLOTS.map(([name, day, stage, start, status, notes], i) => ({
      id: `munich-${i + 1}`, artistId: byName.get(name).id, date: days[day], stage, start: minutesOf(start), status, notes, changeover: 0
    })),
    final: false,
    settings: { stages: 3, budget: 2000000, stageNames: { A: 'Main Stage', B: 'Loud Stage', C: 'Rising Stage' } },
    event: { name: MUNICH_DEMO_NAME, venue: 'Open-air festival site, Munich', startDate: days[0], endDate: days[2], startMinutes: 780, endMinutes: 1380 },
    dailyHoursResetV1: true,
    stageHoursResetV1: true
  };
  return {
    plan,
    ground: { visitors: MUNICH_VISITORS },
    vendors: MUNICH_VENDORS,
    // Measured audience areas for the site map's crowd check. The exit widths are still open (part of the missing 20 %).
    crowdSafety: { stages: { 'stage-a': { area: 9000, audience: 14000 }, 'stage-b': { area: 5000, audience: 6000 } } },
    finance: {
      ticketPrice: 169, sellThrough: 90, earlyBirdShare: 30, earlyBirdDiscount: 25, doorShare: 5, doorSurcharge: 20,
      barSpend: 35, barMargin: 55, sponsorship: 650000, stagePerDay: 45000, toiletPerDay: 95, waterPerDay: 300,
      securityPerDay: 220, firstAidPerDay: 180, venue: 450000, marketing: 350000, ticketingFee: 6, contingency: 10
    }
  };
}

// In the browser these are plain globals; in the tests (Node) they are exported.
if (typeof module !== 'undefined') {
  module.exports = {
    DEMO_FESTIVAL_NAME, DEMO_ARTISTS, DEMO_SLOTS, DEMO_VENDORS, demoFestival,
    MUNICH_DEMO_NAME, MUNICH_VISITORS, MUNICH_SLOTS, MUNICH_VENDORS, munichDemoFestival
  };
}
