// Audit regressions: active lineup stages and untrusted saved map data.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const map = require('../rules/site-map-rules.js');
const capacity = require('../rules/capacity-rules.js');
const crowd = require('../rules/crowd-rules.js');

function field() {
  return { id: 'test', name: 'Test field', image: null, width: 120, height: 80, widthMetres: 120,
    boundary: [[0, 0], [120, 0], [120, 80], [0, 80]], entrance: [60, 80], grid: map.emptyGrid(120, 80),
    placements: { 'stage-a': [20, 20], 'stage-b': [100, 20], 'exit-1': [0, 40], 'exit-2': [120, 40], P1: [60, 50] } };
}
function safety() {
  return crowd.normalizeCrowdSafety({ stages: { 'stage-a': { area: 100, audience: 200 }, 'stage-b': { area: 150, audience: 200 } },
    exits: { 'exit-1': { width: 2 }, 'exit-2': { width: 2 } } });
}
function drawing() {
  const context = vm.createContext({ ...map });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../site-map/map-drawing.js'), 'utf8') + '\nglobalThis.drawing = MapDrawing;', context);
  return context.drawing;
}

test('an explicit one-stage lineup has one map stage, valid supporting facilities and walkways', () => {
  assert.equal(map.mapStageCount(1), 2, 'legacy helper contract stays unchanged');
  assert.equal(map.mapStageCount(1, { allowSingle: true }), 1);
  assert.equal(map.mapStageCount(undefined, { allowSingle: true }), 2);
  assert.equal(map.mapStageCount(null, { allowSingle: true }), 2);
  assert.equal(map.mapStageCount('', { allowSingle: true }), 2);
  const items = map.layoutItems({ ...capacity.capacityNeeds(5000), stages: 1 });
  assert.deepEqual(items.filter(item => item.kind === 'stage').map(item => item.id), ['stage-a']);
  assert.ok(items.some(item => item.id === 'toilets-b' && item.name === 'Toilets 2'));
  assert.ok(items.some(item => item.id === 'water-b' && item.name === 'Free water 2'));
  assert.equal(items.filter(item => item.kind === 'toilets').length, capacity.capacityNeeds(5000).toiletBlocks);
  assert.equal(items.filter(item => item.kind === 'water').length, capacity.capacityNeeds(5000).waterPoints);
  assert.ok(items.every(item => map.isKnownItemId(item.id)));
  const site = map.demoSite(items);
  assert.equal(site.placements['stage-b'], undefined);
  assert.ok(map.checkLayout(site, site.placements, items).every(rule => rule.ok));
  assert.ok(drawing().walkways(site, site.placements).includes('<path'));
  assert.deepEqual(map.parseSiteMaps(JSON.stringify([site]))[0].placements, site.placements);
});

test('active stage ids exclude retired measurements from density and evacuation population', () => {
  const site = field(); site.crowdSafety = safety();
  site.crowdSafety.stages['stage-c'] = { area: 100, audience: 2000 };
  const active = ['stage-a', 'stage-b'];
  const result = crowd.crowdSafetyChecks(site, 500, active);
  assert.deepEqual(Object.keys(result.safety.stages), active);
  assert.equal(result.checks.some(check => check.id === 'density-stage-c'), false);
  assert.equal(result.evacuation.valid, true);
  assert.equal(result.evacuation.originAssignments.reduce((sum, origin) => sum + origin.people, 0), 500);
  assert.equal(result.evacuation.originAssignments.some(origin => origin.originId === 'stage-c'), false);
  assert.equal(site.crowdSafety.stages['stage-c'].audience, 2000, 'reading does not destroy legacy measurements');
});

test('editing an active crowd field and saving preserves inactive-stage measurements in the component', () => {
  const site = field(); site.crowdSafety = safety();
  site.crowdSafety.stages['stage-c'] = { area: 500, audience: 100 };
  const values = new Map([
    ['festival-architect-v2', JSON.stringify({ settings: { stages: 2 } })],
    ['festival-architect-ground', JSON.stringify({ visitors: 5000 })],
    ['festival-architect-site-maps', JSON.stringify([site])], ['festival-architect-site-map-selected', 'test']
  ]);
  const handlers = {};
  const panels = new Map([['#sm-crowd', { innerHTML: '', querySelector: () => null }]]);
  const view = { addEventListener(name, handler) { handlers[name] = handler; },
    querySelector: selector => panels.get(selector) || null };
  const context = vm.createContext({ ...map, ...capacity, ...crowd, canFestival: () => true,
    window: { addEventListener() {}, dispatchEvent() {} }, Event: class {},
    document: { querySelector: () => view, querySelectorAll: () => [], addEventListener() {} },
    localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) }, toast() {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../rules/crowd-rules.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../rules/map-draft-rules.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../site-map/site-map-page.js'), 'utf8'), context);
  handlers.change({ target: { id: '', type: 'number', value: '125', dataset: { crowdField: 'stages.stage-a.area' },
    matches: selector => selector === '[data-crowd-field]' } });
  handlers.click({ target: { closest: selector => selector === '#sm-save' ? {} : null } });
  const saved = JSON.parse(values.get('festival-architect-site-maps')).find(entry => entry.id === 'test');
  assert.equal(saved.crowdSafety.stages['stage-a'].area, 125);
  assert.deepEqual(saved.crowdSafety.stages['stage-c'], site.crowdSafety.stages['stage-c']);
  assert.equal(context.window.getSavedMapReadiness().some(check => check.id.includes('density-stage-c')), false);
});

test('a newly active but unmeasured stage cannot disappear from the crowd checks', () => {
  const site = field(); site.crowdSafety = safety();
  const result = crowd.crowdSafetyChecks(site, 500, ['stage-a', 'stage-b', 'stage-c']);
  assert.equal(result.checks.find(check => check.id === 'density-stage-c').unknown, true);
  assert.equal(result.evacuation.valid, false);
});

test('one-stage evacuation needs only its actual audience and never assigns a phantom Stage B', () => {
  const site = field(); delete site.placements['stage-b'];
  site.crowdSafety = safety(); site.crowdSafety.stages['stage-a'].audience = 500;
  delete site.crowdSafety.stages['stage-b'];
  const result = crowd.crowdSafetyChecks(site, 500, ['stage-a']);
  assert.deepEqual(Object.keys(result.safety.stages), ['stage-a']);
  assert.equal(result.evacuation.valid, true);
  assert.deepEqual(result.evacuation.originAssignments.map(origin => origin.originId), ['stage-a']);
});

test('readiness cache changes with the saved lineup stage count without revisiting Site map', () => {
  const site = map.demoSite(map.layoutItems({ ...capacity.capacityNeeds(5000), stages: 2 }));
  const values = new Map([
    ['festival-architect-v2', JSON.stringify({ settings: { stages: 2 } })],
    ['festival-architect-ground', JSON.stringify({ visitors: 5000 })],
    ['festival-architect-site-maps', JSON.stringify([site])], ['festival-architect-site-map-selected', 'demo']
  ]);
  const view = { addEventListener() {} };
  const context = vm.createContext({ ...map, ...capacity, ...crowd, canFestival: () => true,
    window: { addEventListener() {} },
    document: { querySelector: () => view, querySelectorAll: () => [], addEventListener() {} },
    localStorage: { getItem: key => values.get(key) ?? null }, toast() {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../rules/map-draft-rules.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../site-map/site-map-page.js'), 'utf8'), context);
  const allPlaced = () => context.window.getSavedMapReadiness().find(check => check.id.endsWith(':all-placed'));
  assert.equal(allPlaced().ok, true);
  values.set('festival-architect-v2', JSON.stringify({ settings: { stages: 3 } }));
  assert.equal(allPlaced().ok, false);
  assert.match(allPlaced().detail, /Stage C/);
  values.set('festival-architect-v2', JSON.stringify({ settings: { stages: 1 } }));
  assert.equal(allPlaced().ok, true);
  assert.equal(context.window.getSavedMapReadiness().some(check => check.id.includes('density-stage-b')), false);
});

test('unreadable lineup data blocks actual map mutators and replaces cached assessment with unknown context', () => {
  const site = field();
  const values = new Map([
    ['festival-architect-v2', JSON.stringify({ settings: { stages: 2 } })],
    ['festival-architect-ground', JSON.stringify({ visitors: 5000 })],
    ['festival-architect-site-maps', JSON.stringify([site])], ['festival-architect-site-map-selected', 'test']
  ]);
  const handlers = {};
  const view = { addEventListener(name, handler) { handlers[name] = handler; }, querySelector: () => null };
  const context = vm.createContext({ ...map, ...capacity, ...crowd, canFestival: () => true,
    window: { addEventListener() {}, dispatchEvent() {}, getLineupDataProblem: () => '' }, Event: class {},
    document: { querySelector: () => view, querySelectorAll: () => [], addEventListener() {} },
    localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) }, toast() {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../rules/map-draft-rules.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../site-map/site-map-page.js'), 'utf8'), context);
  assert.ok(context.window.getSavedMapReadiness().length > 1, 'populate the ordinary assessment cache first');
  context.window.getLineupDataProblem = () => 'The saved lineup is invalid JSON.';
  values.set('festival-architect-v2', '{broken');
  const before = JSON.stringify([...values]);
  handlers.change({ target: { id: 'sm-visitors', value: '6000', matches: () => false } });
  handlers.click({ target: { closest: selector => selector === '#sm-save' ? {} : null } });
  assert.equal(JSON.stringify([...values]), before);
  assert.equal(context.window.hasUnsavedMapChanges(), false);
  const checks = context.window.getSavedMapReadiness();
  assert.equal(checks.length, 1);
  assert.equal(checks[0].id, 'map:stage-context');
  assert.equal(checks[0].unknown, true);
  assert.equal(checks[0].ok, false);
});

test('zero, fractional, oversized and non-binary grids are rejected before routing', () => {
  const site = field();
  const invalid = [ { cols: 0, rows: 0, cells: '' }, { cols: -1, rows: -1, cells: '0' },
    { cols: .5, rows: 2, cells: '0' }, { cols: 1, rows: 1, cells: 'x' },
    { cols: 1, rows: map.MAX_MAP_GRID_CELLS + 1, cells: '0'.repeat(map.MAX_MAP_GRID_CELLS + 1) } ];
  for (const grid of invalid) {
    const malformed = { ...site, grid };
    assert.equal(map.validMapGrid(grid), false);
    assert.deepEqual(map.parseSiteMaps(JSON.stringify([malformed])), []);
    assert.equal(crowd.strictEvacuationRoute(malformed, [20, 20], [0, 40]).reachable, false);
    assert.equal(map.gridSearch(malformed, [20, 20], [0, 40], () => true), null);
  }
});

test('saved map parsing bounds dimensions, scale and safe identifiers without dropping ordinary maps', () => {
  const site = field();
  assert.equal(map.parseSiteMaps(JSON.stringify([site])).length, 1);
  for (const patch of [{ width: '120' }, { width: .01 }, { width: 20000 }, { height: 0 }, { widthMetres: 1 }, { widthMetres: 20001 },
    { id: 'test" data-map-audit="proof' }, { id: '' }, { id: 'x'.repeat(101) }]) {
    assert.deepEqual(map.parseSiteMaps(JSON.stringify([{ ...site, ...patch }])), []);
  }
});

test('narrow map geometry cannot create an unbounded layout candidate raster', () => {
  const site = { ...field(), width: 1, height: 16384,
    boundary: [[0, 0], [1, 0], [1, 16384], [0, 16384]] };
  const candidates = map.candidatePoints(site);
  assert.ok(candidates.length > 0);
  assert.ok(candidates.length <= 80 * 160);
});

test('map images accept bounded raster base64 and reject attribute or SVG markup', () => {
  const site = field();
  const raster = 'data:image/jpeg;base64,' + 'A'.repeat(3 * 1024 * 1024);
  assert.equal(map.safeMapImage(raster), true, 'ordinary large raster uploads remain supported');
  assert.equal(map.parseSiteMaps(JSON.stringify([{ ...site, image: raster }])).length, 1);
  for (const image of ['data:image/png;base64,AAAA" data-map-audit="proof', 'data:image/svg+xml,<svg/>',
    'https://example.invalid/map.png', 'data:image/png;base64,' + 'A'.repeat(9 * 1024 * 1024)]) {
    assert.equal(map.safeMapImage(image), false);
    assert.deepEqual(map.parseSiteMaps(JSON.stringify([{ ...site, image }])), []);
  }
});

test('SVG image attributes are escaped even when a caller bypasses saved-map validation', () => {
  const site = { ...field(), image: 'data:image/png;base64,AAAA" data-map-audit="proof' };
  const markup = drawing().scene(site);
  assert.doesNotMatch(markup, /" data-map-audit="proof/);
  assert.match(markup, /AAAA&amp;quot;|AAAA&quot;/);
});
