// Review follow-ups for PR #24: the shared grid search (walkways + evacuation) and the food-court
// start point of the evacuation estimate. See feature-plans/review-followups.md.
// Run with:  uvx --from nodejs-wheel node --test

const test = require('node:test');
const assert = require('node:assert/strict');
const { emptyGrid, gridSearch, walkwayRoute } = require('../rules/site-map-rules.js');
const { normalizeCrowdSafety, estimateEvacuation, strictEvacuationRoute } = require('../rules/crowd-rules.js');

// A 120 × 80 m field (60 × 40 grid cells of 2 m) with a pond in the middle: x 50–70, y 40–60.
function fieldWithPond() {
  const grid = emptyGrid(120, 80);
  const cells = grid.cells.split('');
  for (let r = 20; r < 30; r++) for (let c = 25; c < 35; c++) cells[r * grid.cols + c] = '1';
  return {
    id: 'pond', name: 'Pond field', image: null, width: 120, height: 80, widthMetres: 120,
    boundary: [[0, 0], [120, 0], [120, 80], [0, 80]], entrance: [60, 80], grid: { ...grid, cells: cells.join('') },
    placements: { 'stage-a': [20, 20], 'stage-b': [100, 20], 'exit-1': [0, 40], 'exit-2': [120, 40], P1: [40, 50], P2: [80, 50] }
  };
}
function measured() {
  const safety = normalizeCrowdSafety();
  safety.stages = { 'stage-a': { area: 100, audience: 200 }, 'stage-b': { area: 150, audience: 200 } };
  safety.exits = { 'exit-1': { open: true, width: 2 }, 'exit-2': { open: true, width: 2 } };
  return safety;
}

test('other visitors start at the nearest pitch when the food-court centre lies in the pond', () => {
  const site = fieldWithPond();
  const estimate = estimateEvacuation(site, 500, measured());
  assert.equal(estimate.valid, true, estimate.detail);
  const other = estimate.originAssignments.find((route) => route.originId === 'other-visitors');
  assert.equal(other.people, 100);
  assert.equal(other.exitId, 'exit-1'); // P1 at [40, 50] is the closer pitch to the centre (tie → first) and nearest to exit 1
  assert.equal(estimate.exits.reduce((sum, exit) => sum + exit.people, 0), 500);
});

test('when the food-court centre is walkable it is still used as the start point', () => {
  const site = fieldWithPond();
  site.grid = emptyGrid(120, 80); // no pond
  const estimate = estimateEvacuation(site, 500, measured());
  const other = estimate.originAssignments.find((route) => route.originId === 'other-visitors');
  // The route length is exactly the route from the centre [60, 50] to the chosen exit.
  const fromCentre = strictEvacuationRoute(site, [60, 50], site.placements[other.exitId]);
  assert.equal(other.metres, fromCentre.metres);
});

test('the shared grid search goes around the pond and never through it', () => {
  const site = fieldWithPond();
  const cells = gridSearch(site, [40, 50], [80, 50], (c, r, end) => end || site.grid.cells[r * site.grid.cols + c] !== '1', true);
  assert.ok(cells.length > 20);
  assert.ok(cells.every(([c, r]) => site.grid.cells[r * site.grid.cols + c] !== '1'));
});

test('no path: the strict evacuation route reports unreachable, the walkway draws a straight line', () => {
  const site = fieldWithPond();
  const cells = site.grid.cells.split('');
  for (let r = 0; r < site.grid.rows; r++) cells[r * site.grid.cols + 30] = '1'; // a wall from top to bottom
  site.grid = { ...site.grid, cells: cells.join('') };
  assert.equal(strictEvacuationRoute(site, [20, 20], [100, 20]).reachable, false);
  assert.deepEqual(walkwayRoute(site, [20, 20], [100, 20]), [[20, 20], [100, 20]]);
});

// ---------- double bookings: allowed, but with a warning ----------
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const lineup = vm.createContext({ Date, Intl, console });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../rules/festival-rules.js'), 'utf8'), lineup);
const plan = (bookings) => vm.runInContext(`normalizePlan(${JSON.stringify({
  event: { startDate: '2027-03-20', endDate: '2027-03-21', startMinutes: 840, endMinutes: 1380 },
  artists: [{ id: 'naya', name: 'Naya Bloom', genre: 'Dream pop', fee: 1800, duration: 60 },
    { id: 'riko', name: 'Riko Reyes', genre: 'Global beats', fee: 1500, duration: 60 }],
  bookings
})})`, lineup);
const warn = (b, ignoreId, p) => vm.runInContext('doubleBookingWarning', lineup)(b, ignoreId, p);

test('booking an artist a second time gives a warning that lists the first performance', () => {
  const p = plan([{ id: 'one', artistId: 'naya', stage: 'A', date: '2027-03-20', start: 900 }]);
  const text = warn({ id: 'two', artistId: 'naya', stage: 'B', date: '2027-03-21', start: 1000 }, 'two', p);
  assert.match(text, /^Naya Bloom is already booked once: /);
  assert.match(text, /Stage A 15:00–16:00/);
  assert.match(text, /Book them again\?$/);
});

test('no warning for a different artist, for calendar blocks, or when editing the only booking', () => {
  const p = plan([{ id: 'one', artistId: 'naya', stage: 'A', date: '2027-03-20', start: 900 }]);
  assert.equal(warn({ id: 'two', artistId: 'riko', stage: 'B', date: '2027-03-20', start: 900 }, 'two', p), '');
  assert.equal(warn({ id: 'blk', type: 'block', title: 'Soundcheck', stage: 'B', date: '2027-03-20', start: 900, duration: 30 }, 'blk', p), '');
  assert.equal(warn({ id: 'one', artistId: 'naya', stage: 'A', date: '2027-03-20', start: 960 }, 'one', p), '');
});

test('the warning counts every other performance of the artist', () => {
  const p = plan([
    { id: 'one', artistId: 'naya', stage: 'A', date: '2027-03-20', start: 900 },
    { id: 'two', artistId: 'naya', stage: 'B', date: '2027-03-21', start: 1000 }
  ]);
  assert.match(warn({ id: 'three', artistId: 'naya', stage: 'A', date: '2027-03-21', start: 1200 }, 'three', p), /already booked 2 times/);
});
