// Fixes and checks from the final review before submission (feature-plans/final-check-fixes.md).
// Run with:  uvx --from nodejs-wheel node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { backdropMoodForGenre, festivalScene, festivalLandmark } = require('../rules/backdrop-rules.js');
const { ARTIST_LIBRARY } = require('../rules/artist-library.js');

// --- Festival backdrop ---------------------------------------------------------------------

test('a venue with a hyphen still finds its landmark', () => {
  const expected = {
    'Berlin-Mitte': 'fernsehturm', 'München-Riem': 'frauenkirche', 'Paris-Nord': 'eiffel',
    'Wien-Donauinsel': 'riesenrad', 'Köln-Deutz': 'cologne', 'Parisian Hall': ''
  };
  for (const [venue, landmark] of Object.entries(expected)) assert.equal(festivalLandmark(venue), landmark, venue);
  assert.equal(festivalScene('München-Riem'), 'mountains');
});

test('everyday words do not turn a venue into a coast', () => {
  assert.equal(festivalScene('A nice place'), 'city');
  assert.equal(festivalScene('See you there'), 'city');
  assert.equal(festivalScene('Praia da Rocha'), 'coast');
  assert.equal(festivalScene('Lisbon'), 'coast');
});

test('library styles get a fitting mood instead of the sunset fallback', () => {
  const expected = { Grime: 'heat', 'UK drill': 'heat', Amapiano: 'heat', Salsa: 'heat', 'Samba / MPB': 'heat',
    'Trip hop': 'neon', 'Future bass': 'neon', Electro: 'neon', MPB: 'dusk', Kora: 'dusk', 'Urban flamenco': 'dusk',
    'Pop rock': 'ember', 'Indie dance': 'neon', Indie: '' };
  for (const [genre, mood] of Object.entries(expected)) assert.equal(backdropMoodForGenre(genre), mood, genre);
});

test('every genre and style in the artist library has a mood (plain "Indie" stays neutral on purpose)', () => {
  const values = [...new Set(ARTIST_LIBRARY.flatMap((artist) => [artist.genre, artist.style]))].filter((v) => v && v !== 'Indie');
  assert.deepEqual(values.filter((value) => !backdropMoodForGenre(value)), []);
});

// --- Suggest lineup on a two-day festival ------------------------------------------------------
// With one headliner per day, an existing test now checks this case on one day only. This keeps
// the two-day case covered: the confirmed performance and its details stay exactly as they were.

test('on a two-day festival a suggestion never changes a confirmed performance or its notes', () => {
  const context = vm.createContext({ console, Date, Intl });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../rules/festival-rules.js'), 'utf8'), context);
  const run = (code) => vm.runInContext(code, context);
  run(`var plan = normalizePlan(null);
    plan.event = { name: 'Test', venue: '', startDate: '2027-03-20', endDate: '2027-03-21', startMinutes: 840, endMinutes: 1380 };
    plan.settings.budget = 10000;
    plan.artists = Array.from({ length: 4 }, (_, i) => ({ id: 'a' + i, name: 'Artist ' + i, genre: i % 2 ? 'Rock' : 'Pop', fee: 100 + i, duration: 60, colour: '#b7e4dc' }));
    var kept = { id: 'confirmed-head', artistId: 'a0', date: '2027-03-21', stage: 'A', start: 1305, duration: 60, fee: 0, status: 'confirmed', changeover: 0, notes: 'Keep this' };
    plan.bookings = [kept];`);
  for (const realistic of [true, false]) {
    const result = run(`(() => {
      const output = automaticLineup(plan, { realistic: ${realistic}, headliners: { '2027-03-20': 'a1', '2027-03-21': 'a0' } });
      const all = plan.bookings.concat(output.bookings);
      return { problem: output.problem,
        touched: output.bookings.some((b) => b.id === 'confirmed-head' || b.linkedTo === 'confirmed-head'),
        kept: JSON.stringify(all.find((b) => b.id === 'confirmed-head')) === JSON.stringify(kept),
        problems: planProblems({ ...plan, bookings: all }).length,
        closesDayTwo: output.headlinerBookings['2027-03-21'] === 'confirmed-head',
        dayOneHeadliner: all.find((b) => b.id === output.headlinerBookings['2027-03-20'])?.artistId };
    })()`);
    assert.deepEqual({ ...result }, { problem: '', touched: false, kept: true, problems: 0, closesDayTwo: true, dayOneHeadliner: 'a1' }, `realistic: ${realistic}`);
  }
});

// --- Two accounts change the same section (Amelie's browser test, steps 1–11) ------------------
// The fake database behaves like migration 007 (see tests/section-conflicts.test.js).
const { fakeDatabase, accountScreen, settle } = require('./helpers/account-screen.cjs');
const FINANCE = 'festival-architect-finance';
const VENDORS = 'festival-architect-vendors';
// Reload a browser: a new page with the same storage. When the page finds newer data in the database
// it takes it and reloads itself once more, as in a real browser.
const reload = async (screen, database) => {
  let current = screen;
  for (let attempt = 0; attempt < 3; attempt++) {
    const again = accountScreen({ database, seed: Object.fromEntries(current.values) });
    again.api.resetForStartup(); await again.api.start(); await settle();
    if (!again.reloads()) return again;
    current = again;
  }
  throw new Error('the page kept reloading');
};

test('the browser test: while the finances wait for a decision, Keep mine and Use theirs stay offered', async () => {
  const database = fakeDatabase({ [FINANCE]: '{"sponsorship":1000,"barMargin":50}', [VENDORS]: '{"stalls":3}' });
  database.versions[FINANCE] = 1; database.versions[VENDORS] = 1;
  const a = accountScreen({ database }), b = accountScreen({ database });

  // Test 1: A changes the sponsorship; B, without reloading, changes the bar margin.
  a.storage.setItem(FINANCE, '{"sponsorship":2000,"barMargin":50}'); await a.api.saveNow();
  assert.equal(a.status(), 'saved');
  b.storage.setItem(FINANCE, '{"sponsorship":1000,"barMargin":65}'); await b.api.saveNow();
  assert.equal(database.data[FINANCE], '{"sponsorship":2000,"barMargin":50}', 'A\'s sponsorship was not overwritten');
  assert.match(b.notice().text, /Not saved: a teammate changed the finances/);
  assert.ok(b.notice().keep && b.notice().theirs);

  // Test 2: B changes the vendors. They are saved, and the open finance decision is still offered.
  b.storage.setItem(VENDORS, '{"stalls":4}'); await b.api.saveNow();
  assert.equal(database.data[VENDORS], '{"stalls":4}', 'the vendor change was saved');
  assert.match(b.notice().text, /Not saved: a teammate changed the finances/, 'the conflict notice is not replaced');
  assert.ok(b.notice().shown && b.notice().keep && b.notice().theirs, 'Keep mine and Use theirs are still there');
  assert.equal(b.status(), 'conflict', 'the finances are still not saved');
  assert.equal(b.storage.getItem(FINANCE), '{"sponsorship":1000,"barMargin":65}', 'B\'s bar margin is still in the field');

  // Test 3: B chooses Use theirs: A's sponsorship and B's vendor change, B's bar margin is gone.
  await b.api.useTheirVersion(); await settle();
  assert.equal(b.storage.getItem(FINANCE), '{"sponsorship":2000,"barMargin":50}');
  assert.equal(b.storage.getItem(VENDORS), '{"stalls":4}');
  const b2 = await reload(b, database);

  // Test 4: a new clash; B reloads in the middle of it: the edit stays and the question comes back.
  const a2 = await reload(a, database);
  a2.storage.setItem(FINANCE, '{"sponsorship":3000,"barMargin":50}'); await a2.api.saveNow();
  assert.equal(a2.status(), 'saved');
  b2.storage.setItem(FINANCE, '{"sponsorship":2000,"barMargin":70}'); await b2.api.saveNow();
  assert.ok(b2.notice().keep && b2.notice().theirs);
  const b3 = await reload(b2, database);
  assert.equal(b3.storage.getItem(FINANCE), '{"sponsorship":2000,"barMargin":70}', 'the bar margin survives the reload');
  assert.match(b3.notice().text, /Not saved: a teammate changed the finances/);
  assert.ok(b3.notice().keep && b3.notice().theirs, 'the question comes back after the reload');
  assert.equal(database.data[FINANCE], '{"sponsorship":3000,"barMargin":50}', 'still nothing overwritten');

  // Test 5: Keep mine: B's finances replace A's, and after reloading both browsers show the same values.
  await b3.api.keepMyVersion(); await b3.api.saveNow(); await settle();
  assert.equal(b3.status(), 'saved');
  assert.equal(database.data[FINANCE], '{"sponsorship":2000,"barMargin":70}');
  const a3 = await reload(a2, database), b4 = await reload(b3, database);
  for (const key of [FINANCE, VENDORS]) assert.equal(a3.storage.getItem(key), b4.storage.getItem(key), key);
  assert.equal(a3.storage.getItem(FINANCE), '{"sponsorship":2000,"barMargin":70}');
});
