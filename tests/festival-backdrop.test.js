// Festival backdrop on the Overview: an animated live stage (feature-plans/festival-backdrop.md).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { BACKDROP_MOODS, BACKDROP_LANDMARKS, backdropMoodForGenre, festivalMood, festivalScene, festivalLandmark, festivalBackdrop } = require('../rules/backdrop-rules.js');

const ROOT = path.join(__dirname, '..');
const artists = genres => genres.map((genre, i) => ({ id: `a${i}`, name: `Artist ${i}`, genre }));

// --- Rules ----------------------------------------------------------------------------------

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
  for (const nothing of ['Indie', '', undefined]) assert.equal(backdropMoodForGenre(nothing), '');
});

test('the mood comes from the booked performances, else from the catalogue, else sunset', () => {
  const list = artists(['Techno', 'Techno', 'Rock']);
  assert.equal(festivalMood(list, []), 'neon', 'nothing booked: the catalogue decides');
  assert.equal(festivalMood(list, [{ artistId: 'a2' }, { artistId: 'a2' }, { artistId: 'a0' }]), 'ember');
  assert.equal(festivalMood(list, [{ id: 'block', title: 'Soundcheck' }]), 'neon', 'calendar blocks are not performances');
  assert.equal(festivalMood([], []), 'sunset');
  assert.equal(festivalMood(undefined, undefined), 'sunset');
});

test('the landscape comes from the venue', () => {
  const expected = {
    'Parque Tejo, Lisbon': 'coast', 'Open-air festival site, Munich': 'mountains', 'Praia da Rocha, Algarve': 'coast',
    'Hallenstadion Zürich': 'mountains', 'Englischer Garten park': 'field', 'Tempelhofer Feld, Berlin': 'city',
    'Nova SBE, Carcavelos': 'city', Seattle: 'city', '': 'city'
  };
  for (const [venue, scene] of Object.entries(expected)) assert.equal(festivalScene(venue), scene, venue);
  assert.equal(festivalScene(undefined), 'city');
});

test('well-known cities get their landmark; other places get none', () => {
  const expected = {
    'Champ de Mars, Paris': 'eiffel', 'Hyde Park, London': 'bigben', 'Parque Tejo, Lisbon': 'bridge',
    'Open-air festival site, Munich': 'frauenkirche', 'Olympiapark München': 'frauenkirche', 'Tempelhof, Berlin': 'fernsehturm',
    'Circo Massimo, Roma': 'colosseum', 'Parc del Fòrum, Barcelona': 'sagrada', 'Randalls Island, New York': 'empire',
    'Sydney Harbour': 'opera', 'Donauinsel, Wien': 'riesenrad', 'NDSM Amsterdam': 'canals', 'Dubai Media City': 'burj',
    'Nova SBE, Carcavelos': '', 'Parisian Café, Porto': '', 'Jerome Park': '', '': ''
  };
  for (const [venue, landmark] of Object.entries(expected)) assert.equal(festivalLandmark(venue), landmark, venue);
  assert.equal(festivalScene('Sydney Harbour'), 'coast');
  assert.equal(festivalBackdrop({ venue: 'Paris' }).landmark, 'eiffel');
  assert.notEqual(festivalBackdrop({ venue: 'Paris' }).key, festivalBackdrop({ venue: 'Lyon' }).key);
});

test('every mood has two laser colours and a sensible tempo; one festival always gets the same stage', () => {
  for (const [mood, colours] of Object.entries(BACKDROP_MOODS)) {
    assert.equal(colours.lasers.length, 2, mood);
    assert.ok(colours.bpm >= 70 && colours.bpm <= 150, mood);
  }
  const input = { name: 'Lisbon Sound Festival', venue: 'Parque Tejo, Lisbon', artists: artists(['Techno']), bookings: [] };
  const a = festivalBackdrop(input);
  assert.deepEqual([a.mood, a.scene, a.label, a.bpm], ['neon', 'coast', 'Neon nights', 128]);
  assert.equal(festivalBackdrop(input).key, a.key);
  assert.notEqual(festivalBackdrop({ ...input, name: 'Other' }).key, a.key);
});

// --- Drawing (with a stand-in canvas that records every call) --------------------------------

function loadStage() {
  const ctx = vm.createContext({ console, Math });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'rules/backdrop-rules.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'overview-backdrop.js'), 'utf8'), ctx);
  return ctx;
}
function recordingCanvas() {
  const calls = [];
  const gradient = () => ({ addColorStop: (...args) => calls.push(['addColorStop', ...args]) });
  return new Proxy({ calls }, {
    get(target, key) {
      if (key === 'calls') return calls;
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return (...args) => { calls.push([key, ...args]); return gradient(); };
      return (...args) => calls.push([key, ...args]);
    },
    set(target, key, value) { calls.push(['set ' + String(key), typeof value === 'object' ? 'gradient' : value]); return true; }
  });
}
const stage = loadStage();
const sceneFor = (mood, place, W = 1100, H = 300) => {
  stage.args = { mood, place, W, H };
  return vm.runInContext(`(() => { const b = festivalBackdrop({ name: 'Test', venue: args.place, artists: [{ id: 'a', genre: args.mood }], bookings: [] }); return buildStageScene(b, args.W, args.H); })()`, stage);
};
const genres = { neon: 'Techno', ember: 'Rock', gold: 'Jazz', heat: 'Hip-hop', dusk: 'Folk', candy: 'Pop', sunset: '' };
const places = { coast: 'Lisbon', mountains: 'Munich', field: 'Garden park', city: 'Berlin' };

test('every mood and landscape draws whole frames at any time, with only real numbers', () => {
  for (const genre of Object.values(genres)) for (const place of Object.values(places)) for (const t of [0, 0.37, 3.1, 7.9, 33.3, 600]) {
    const canvas = recordingCanvas();
    stage.drawStageFrame(canvas, sceneFor(genre, place), t);
    const numbers = canvas.calls.flat().filter(value => typeof value === 'number');
    assert.ok(canvas.calls.length > 300, `${genre}/${place}/${t}`);
    assert.ok(numbers.every(Number.isFinite), `${genre}/${place}/${t}: no NaN or Infinity`);
  }
});

test('every landmark draws whole frames, also in a small window', () => {
  const cities = { eiffel: 'Paris', bigben: 'London', bridge: 'Lisbon', frauenkirche: 'Munich', fernsehturm: 'Berlin', colosseum: 'Rome',
    sagrada: 'Barcelona', empire: 'New York', opera: 'Sydney', riesenrad: 'Wien', canals: 'Amsterdam', burj: 'Dubai' };
  assert.deepEqual(Object.keys(cities).sort(), BACKDROP_LANDMARKS.map(([kind]) => kind).sort(), 'every landmark is tested');
  for (const [kind, city] of Object.entries(cities)) for (const [W, H] of [[1100, 300], [320, 160]]) for (const t of [0, 2.7, 61]) {
    const scene = sceneFor('Pop', city, W, H);
    assert.equal(scene.landmark.kind, kind);
    const canvas = recordingCanvas();
    stage.drawStageFrame(canvas, scene, t);
    assert.ok(canvas.calls.flat().filter(v => typeof v === 'number').every(Number.isFinite), `${kind} ${W}x${H} t=${t}`);
  }
});

test('a frame depends only on the time: same time, same picture; later, a different one', () => {
  const scene = sceneFor('Techno', 'Munich');
  const at = t => { const c = recordingCanvas(); stage.drawStageFrame(c, scene, t); return JSON.stringify(c.calls); };
  assert.equal(at(4.2), at(4.2));
  assert.notEqual(at(4.2), at(4.25), 'the lights and the crowd move');
});

test('confetti bursts at the start of every 8 beats and is gone before the next burst', () => {
  const scene = sceneFor('Techno', 'Munich'); // 128 BPM: 8 beats = 3.75 s
  const fillRects = t => { const c = recordingCanvas(); stage.drawStageFrame(c, scene, t); return c.calls.filter(call => call[0] === 'fillRect').length; };
  assert.ok(fillRects(3.75 + 0.3) > fillRects(3.75 + 3.4), 'confetti at the burst, none 3.4 s later');
});

test('a small window still gets a stage, a crowd and lasers', () => {
  const scene = sceneFor('Pop', 'Lisbon', 320, 160);
  assert.ok(scene.crowd.length > 20);
  assert.ok(scene.stage.w > 80 && scene.stage.x > 0 && scene.stage.x + scene.stage.w < 320);
});

// --- The Overview banner ---------------------------------------------------------------------

function overview(stateValue, { rules = true, reducedMotion = false } = {}) {
  const nodes = new Map(), frames = [], styles = {};
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { hidden: true, textContent: '', dataset: {}, clientWidth: 900, clientHeight: 280,
      width: 0, height: 0, style: { setProperty: (key, value) => { styles[key] = value; } },
      getContext: () => recordingCanvas() });
    return nodes.get(selector);
  };
  const ctx = vm.createContext({ console, Math, Date,
    document: { querySelector: node, hidden: false, addEventListener() {} },
    window: { devicePixelRatio: 2, matchMedia: () => ({ matches: reducedMotion }), addEventListener() {} },
    requestAnimationFrame: callback => { frames.push(callback); return frames.length; } });
  if (rules) vm.runInContext(fs.readFileSync(path.join(ROOT, 'rules/backdrop-rules.js'), 'utf8'), ctx);
  vm.runInContext(`var state = ${JSON.stringify(stateValue)};`, ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'overview-backdrop.js'), 'utf8'), ctx);
  return { node, frames, styles, run: code => vm.runInContext(code, ctx) };
}
const lisbon = { event: { name: 'Lisbon Sound Festival', venue: 'Parque Tejo, Lisbon' }, artists: artists(['Pop', 'Techno']), bookings: [{ artistId: 'a0' }] };

test('the Overview shows the stage with the festival name, venue, dates and mood', () => {
  const ui = overview(lisbon);
  ui.node('#overview-dates').textContent = '20 Mar – 21 Mar 2027';
  ui.run('renderOverviewBackdrop()');
  assert.equal(ui.node('#overview-backdrop').hidden, false);
  assert.equal(ui.node('#overview-backdrop-title').textContent, 'Lisbon Sound Festival');
  assert.equal(ui.node('#overview-backdrop-caption').textContent, 'Parque Tejo, Lisbon · 20 Mar – 21 Mar 2027 · Pop dream');
  assert.deepEqual([ui.node('#overview-backdrop').dataset.mood, ui.node('#overview-backdrop').dataset.scene], ['candy', 'coast']);
  assert.equal(ui.node('#overview-backdrop-canvas').width, 1800, 'sharp on retina: 900 px × 2');
  assert.equal(ui.styles['--bd-beat'], '0.500s', '120 BPM');
  assert.equal(ui.frames.length, 1, 'the animation is running');
});

test('rendering the Overview again does not start a second animation', () => {
  const ui = overview(lisbon);
  ui.run('renderOverviewBackdrop(); renderOverviewBackdrop(); renderOverviewBackdrop();');
  assert.equal(ui.frames.length, 1);
  ui.frames[0](1000);
  assert.equal(ui.frames.length, 2, 'each frame asks for the next one');
});

test('with "reduce motion" the stage is drawn once and stands still', () => {
  const ui = overview(lisbon, { reducedMotion: true });
  ui.run('renderOverviewBackdrop()');
  assert.equal(ui.node('#overview-backdrop').hidden, false);
  assert.equal(ui.frames.length, 0);
});

test('names and venues stay plain text', () => {
  const ui = overview({ ...lisbon, event: { name: '<img src=x onerror=alert(1)>', venue: '<b>Lisbon</b>' } });
  ui.run('renderOverviewBackdrop()');
  assert.equal(ui.node('#overview-backdrop-title').textContent, '<img src=x onerror=alert(1)>');
  assert.match(ui.node('#overview-backdrop-caption').textContent, /^<b>Lisbon<\/b> · /);
});

test('without the rules or with broken data the banner hides and nothing breaks', () => {
  const missing = overview(lisbon, { rules: false });
  assert.doesNotThrow(() => missing.run('renderOverviewBackdrop()'));
  assert.equal(missing.node('#overview-backdrop').hidden, true);
  const broken = overview(lisbon);
  broken.run('festivalBackdrop = () => { throw new Error("broken"); }; renderOverviewBackdrop();');
  assert.equal(broken.node('#overview-backdrop').hidden, true);
  const fresh = overview({ event: { name: '', venue: '' }, artists: [], bookings: [] });
  fresh.run('renderOverviewBackdrop()');
  assert.equal(fresh.node('#overview-backdrop-title').textContent, 'Your festival');
  assert.equal(fresh.node('#overview-backdrop-caption').textContent, 'Festival sunset');
});

test('the page loads the stage, its rules and its styles before the Overview', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const at = s => html.indexOf(s);
  assert.ok(at('id="overview-backdrop"') > -1 && at('id="overview-backdrop"') < at('class="checklist-hero overview-hero"'));
  assert.ok(at('<canvas id="overview-backdrop-canvas">') > -1);
  assert.ok(at('rules/backdrop-rules.js') > -1 && at('rules/backdrop-rules.js') < at('overview-backdrop.js?'));
  assert.ok(at('overview-backdrop.js?') < at('overview.js?'));
  assert.ok(at('overview-backdrop.css') > -1);
});
