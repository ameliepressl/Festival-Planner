// Festival backdrop on the Overview (feature-plans/festival-backdrop.md).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
  BACKDROP_MOODS, backdropMoodForGenre, festivalMood, festivalScene, festivalBackdrop, backdropSvg
} = require('../rules/backdrop-rules.js');

const ROOT = path.join(__dirname, '..');
const artists = genres => genres.map((genre, i) => ({ id: `a${i}`, name: `Artist ${i}`, genre }));

test('each genre of the artist library gets a fitting mood', () => {
  const expected = {
    Electronic: 'neon', Techno: 'neon', 'Indie dance': 'neon', Electronica: 'neon',
    Rock: 'ember', 'Metal & Punk': 'ember', 'Pop rock': 'ember', 'Indie rock': 'ember',
    'Jazz & Blues': 'gold', 'R&B & Soul': 'gold', 'Soul / R&B': 'gold',
    'Hip-hop': 'heat', Latin: 'heat', Afrobeats: 'heat', Reggaeton: 'heat', 'Global beats': 'heat',
    'Folk & Country': 'dusk', Fado: 'dusk', 'Alt folk': 'dusk',
    Pop: 'candy', 'K-pop': 'candy', 'Dance pop': 'candy', 'Dream pop': 'candy'
  };
  for (const [genre, mood] of Object.entries(expected)) assert.equal(backdropMoodForGenre(genre), mood, genre);
  assert.equal(backdropMoodForGenre('Indie'), '');
  assert.equal(backdropMoodForGenre(''), '');
  assert.equal(backdropMoodForGenre(undefined), '');
});

test('the mood comes from the booked performances, else from the catalogue, else sunset', () => {
  const list = artists(['Techno', 'Techno', 'Rock']);
  assert.equal(festivalMood(list, []), 'neon', 'nothing booked: the catalogue decides');
  assert.equal(festivalMood(list, [{ artistId: 'a2' }, { artistId: 'a2' }, { artistId: 'a0' }]), 'ember', 'two rock sets beat one techno set');
  assert.equal(festivalMood(list, [{ id: 'block', title: 'Soundcheck' }]), 'neon', 'calendar blocks are not performances');
  assert.equal(festivalMood([], []), 'sunset');
  assert.equal(festivalMood(artists(['Indie']), []), 'sunset');
  assert.equal(festivalMood(undefined, undefined), 'sunset');
});

test('the landscape comes from the venue', () => {
  assert.equal(festivalScene('Parque Tejo, Lisbon'), 'coast', 'Lisbon demo');
  assert.equal(festivalScene('Open-air festival site, Munich'), 'mountains', 'Munich demo');
  assert.equal(festivalScene('Praia da Rocha, Algarve'), 'coast');
  assert.equal(festivalScene('Hallenstadion Zürich'), 'mountains');
  assert.equal(festivalScene('Englischer Garten park'), 'field');
  assert.equal(festivalScene('Tempelhofer Feld, Berlin'), 'city');
  assert.equal(festivalScene('Nova SBE, Carcavelos'), 'city');
  assert.equal(festivalScene(''), 'city');
  assert.equal(festivalScene(undefined), 'city');
  assert.equal(festivalScene('Seattle'), 'city', 'words inside other words do not count');
});

test('one festival always gets the same picture; another festival a different one', () => {
  const input = { name: 'Lisbon Sound Festival', venue: 'Parque Tejo, Lisbon', artists: artists(['Pop']), bookings: [] };
  const a = festivalBackdrop(input), b = festivalBackdrop(input);
  assert.equal(a.svg, b.svg);
  assert.equal(a.key, b.key);
  assert.deepEqual([a.mood, a.scene, a.label], ['candy', 'coast', 'Pop dream']);
  assert.notEqual(festivalBackdrop({ ...input, name: 'Other festival' }).svg, a.svg);
});

test('every mood and landscape draws a complete SVG without user text', () => {
  for (const mood of Object.keys(BACKDROP_MOODS)) for (const scene of ['coast', 'mountains', 'field', 'city']) {
    const svg = backdropSvg({ mood, scene, seed: 12345 });
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 1200 300"/, `${mood}/${scene}`);
    assert.ok(svg.endsWith('</svg>'));
    assert.doesNotMatch(svg, /NaN|undefined|Infinity/, `${mood}/${scene}`);
    assert.equal((svg.match(/<g[ >]/g) || []).length, (svg.match(/<\/g>/g) || []).length, 'groups are closed');
    assert.equal((svg.match(/class="bd-beam /g) || []).length, 5, 'five light beams');
  }
  const svg = festivalBackdrop({ name: '<script>alert(1)</script>', venue: '"><img src=x onerror=alert(1)> Lisbon' }).svg;
  assert.doesNotMatch(svg, /script|onerror|img/);
});

// The Overview banner (overview-backdrop.js) with small stand-ins for the page.
function overview(stateValue, { rules = true } = {}) {
  const nodes = new Map();
  let artWrites = 0;
  const node = selector => {
    if (!nodes.has(selector)) {
      const el = { hidden: true, textContent: '', dataset: {} };
      let html = '';
      Object.defineProperty(el, 'innerHTML', { get: () => html, set: value => { html = value; artWrites++; } });
      nodes.set(selector, el);
    }
    return nodes.get(selector);
  };
  const ctx = vm.createContext({ document: { querySelector: node }, console });
  if (rules) vm.runInContext(fs.readFileSync(path.join(ROOT, 'rules/backdrop-rules.js'), 'utf8'), ctx);
  vm.runInContext(`var state = ${JSON.stringify(stateValue)};`, ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'overview-backdrop.js'), 'utf8'), ctx);
  return { node, run: code => vm.runInContext(code, ctx), artWrites: () => artWrites };
}
const lisbon = { event: { name: 'Lisbon Sound Festival', venue: 'Parque Tejo, Lisbon' }, artists: artists(['Pop', 'Techno']), bookings: [{ artistId: 'a0' }] };

test('the Overview shows the banner with a caption from the venue and the mood', () => {
  const ui = overview(lisbon);
  ui.run('renderOverviewBackdrop()');
  assert.equal(ui.node('#overview-backdrop').hidden, false);
  assert.match(ui.node('#overview-backdrop-art').innerHTML, /^<svg /);
  assert.equal(ui.node('#overview-backdrop-caption').textContent, 'Parque Tejo, Lisbon · Pop dream');
  assert.equal(ui.node('#overview-backdrop').dataset.mood, 'candy');
  assert.equal(ui.node('#overview-backdrop').dataset.scene, 'coast');
});

test('the picture is redrawn only when the festival changes, so the lights keep moving', () => {
  const ui = overview(lisbon);
  ui.run('renderOverviewBackdrop(); renderOverviewBackdrop(); renderOverviewBackdrop();');
  assert.equal(ui.artWrites(), 1);
  ui.run(`state.bookings = [{ artistId: 'a1' }, { artistId: 'a1' }]; renderOverviewBackdrop();`);
  assert.equal(ui.artWrites(), 2);
  assert.equal(ui.node('#overview-backdrop').dataset.mood, 'neon');
});

test('the venue appears only as plain text in the caption', () => {
  const ui = overview({ ...lisbon, event: { name: 'X', venue: '<b>Lisbon</b>' } });
  ui.run('renderOverviewBackdrop()');
  assert.equal(ui.node('#overview-backdrop-caption').textContent, '<b>Lisbon</b> · Pop dream');
  assert.doesNotMatch(ui.node('#overview-backdrop-art').innerHTML, /<b>/);
});

test('without the rules or with broken data the banner stays hidden and nothing breaks', () => {
  const missing = overview(lisbon, { rules: false });
  assert.doesNotThrow(() => missing.run('renderOverviewBackdrop()'));
  assert.equal(missing.node('#overview-backdrop').hidden, true);
  const broken = overview(lisbon);
  broken.run('festivalBackdrop = () => { throw new Error("broken"); }; renderOverviewBackdrop();');
  assert.equal(broken.node('#overview-backdrop').hidden, true);
  const empty = overview({ event: { name: '', venue: '' }, artists: [], bookings: [] });
  empty.run('renderOverviewBackdrop()');
  assert.equal(empty.node('#overview-backdrop').hidden, false, 'a new festival still gets a picture');
  assert.equal(empty.node('#overview-backdrop-caption').textContent, 'Festival sunset');
});

test('the page loads the banner, its rules and its styles before the Overview', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const at = s => html.indexOf(s);
  assert.ok(at('id="overview-backdrop"') > -1 && at('id="overview-backdrop"') < at('class="checklist-hero overview-hero"'));
  assert.ok(at('rules/backdrop-rules.js') > -1 && at('rules/backdrop-rules.js') < at('overview-backdrop.js?'));
  assert.ok(at('overview-backdrop.js?') < at('overview.js?'));
  assert.ok(at('overview-backdrop.css') > -1);
  assert.match(html, /<figure class="overview-backdrop" id="overview-backdrop" aria-hidden="true" hidden>/);
});
