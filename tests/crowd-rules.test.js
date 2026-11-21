const test = require('node:test');
const assert = require('node:assert/strict');
const { emptyGrid, parseSiteMaps } = require('../rules/site-map-rules.js');
const { normalizeCrowdSafety, strictEvacuationRoute, estimateEvacuation, crowdSafetyChecks } = require('../rules/crowd-rules.js');

function field() {
  return { id: 'test', name: 'Test field', image: null, width: 120, height: 80, widthMetres: 120,
    boundary: [[0, 0], [120, 0], [120, 80], [0, 80]], entrance: [60, 80], grid: emptyGrid(120, 80),
    placements: { 'stage-a': [20, 20], 'stage-b': [100, 20], 'exit-1': [0, 40], 'exit-2': [120, 40], P1: [60, 50] } };
}
function measured() {
  const safety = normalizeCrowdSafety();
  safety.stages = { 'stage-a': { area: 100, audience: 200 }, 'stage-b': { area: 150, audience: 200 } };
  safety.exits = { 'exit-1': { open: true, width: 2 }, 'exit-2': { open: true, width: 2 } };
  return safety;
}

test('density uses entered usable area, includes exact limit, and never passes missing or zero measurements', () => {
  const site = field(); site.crowdSafety = measured();
  let result = crowdSafetyChecks(site, 500);
  assert.equal(result.checks[0].density, 2); assert.equal(result.checks[0].ok, true);
  site.crowdSafety.stages['stage-a'].audience = 201;
  assert.equal(crowdSafetyChecks(site, 500).checks[0].ok, false);
  site.crowdSafety.stages['stage-a'].area = 0;
  assert.equal(crowdSafetyChecks(site, 500).checks[0].ok, false);
  delete site.crowdSafety;
  result = crowdSafetyChecks(site, 500);
  assert.ok(result.checks.every(check => !check.ok));
  assert.ok(result.checks.every(check => check.unknown));
});

test('evacuation allocates every visitor and exposes travel, width-based queue and response delay', () => {
  const site = field(), safety = measured();
  const estimate = estimateEvacuation(site, 500, safety);
  assert.equal(estimate.valid, true);
  assert.equal(estimate.exits.reduce((sum, exit) => sum + exit.people, 0), 500);
  estimate.exits.forEach(exit => assert.equal(exit.queueMinutes, exit.people / (2 * 82)));
  assert.equal(estimate.minutes, 2 + Math.max(...estimate.exits.map(exit => exit.travelMinutes + exit.queueMinutes)));
  const slower = estimateEvacuation(site, 500, { ...safety, flowRate: 41 });
  assert.ok(slower.minutes > estimate.minutes);
  const scaled = { ...site, widthMetres: 240 };
  assert.ok(estimateEvacuation(scaled, 500, safety).minutes > estimate.minutes);
});

test('missing widths, invalid assumptions, excessive audiences and no open exits cannot produce a passing estimate', () => {
  const site = field(), safety = measured();
  for (const patch of [ { flowRate: 0 }, { walkingSpeed: -1 }, { targetMinutes: null }, { preMovementMinutes: -1 } ]) {
    assert.equal(estimateEvacuation(site, 500, { ...safety, ...patch }).valid, false);
  }
  safety.exits['exit-1'].width = null;
  assert.equal(estimateEvacuation(site, 500, safety).valid, false);
  safety.exits['exit-1'].open = false; safety.exits['exit-2'].open = false;
  assert.equal(estimateEvacuation(site, 500, safety).valid, false);
  safety.exits = measured().exits; safety.stages['stage-a'].audience = 400;
  assert.equal(estimateEvacuation(site, 500, safety).valid, false);
});

test('closed-exit scenarios remain calculable but readiness requires both mapped, open, measured exits', () => {
  const site = field(); site.crowdSafety = measured();
  const availability = () => crowdSafetyChecks(site, 500).checks.find(check => check.id === 'emergency-exits-available');
  assert.equal(availability().ok, true);
  site.crowdSafety.exits['exit-1'].open = false;
  assert.equal(estimateEvacuation(site, 500).valid, true);
  assert.equal(availability().ok, false);
  assert.equal(availability().unknown, false);
  site.crowdSafety.exits['exit-1'].open = true;
  site.crowdSafety.exits['exit-1'].width = null;
  assert.equal(availability().ok, false);
  site.crowdSafety.exits['exit-1'].width = 2;
  delete site.placements['exit-1'];
  assert.equal(availability().ok, false);
});

test('blocked routes do not become straight lines and diagonal gaps cannot cut corners', () => {
  const site = field();
  site.width = 2; site.height = 2; site.widthMetres = 2;
  site.boundary = [[0, 0], [2, 0], [2, 2], [0, 2]];
  site.grid = { cols: 2, rows: 2, cells: '0110' };
  assert.equal(strictEvacuationRoute(site, [.5, .5], [1.5, 1.5]).reachable, false);
  site.grid.cells = '0000';
  assert.equal(strictEvacuationRoute(site, [.5, .5], [1.5, 1.5]).reachable, true);
  site.grid.cells = '1000';
  assert.equal(strictEvacuationRoute(site, [.5, .5], [1.5, 1.5]).reachable, false);
});

test('a zone separated from every exit and an exit off the fence prevent an evacuation result', () => {
  const site = field(), safety = measured();
  site.placements['exit-1'] = [60, 40];
  assert.equal(estimateEvacuation(site, 500, safety).valid, false);
  site.placements['exit-1'] = [0, 40];
  const { cols, rows } = site.grid;
  site.grid.cells = Array.from({ length: cols * rows }, (_, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    return c === 20 || c === 40 || r === 20 ? '1' : '0';
  }).join('');
  assert.equal(estimateEvacuation(site, 500, safety).valid, false);
});

test('optional crowd measurements survive map parsing; older maps remain unmeasured', () => {
  const site = field();
  assert.equal(parseSiteMaps(JSON.stringify([site]))[0].crowdSafety, undefined);
  site.crowdSafety = measured();
  const reopened = parseSiteMaps(JSON.stringify([site]))[0];
  assert.deepEqual(reopened.crowdSafety, site.crowdSafety);
  assert.equal(crowdSafetyChecks(reopened, 500).checks[0].ok, true);
  site.crowdSafety = { stages: { 'stage-a': { area: 'bad', audience: 100 } } };
  assert.equal(parseSiteMaps(JSON.stringify([site]))[0].crowdSafety.stages['stage-a'].area, null);
});

test('evacuation route labels identify each audience origin and match the computed exit totals', () => {
  const site = field(), safety = measured();
  site.placements.P1 = [75, 50]; // Other visitors have an unambiguous nearer exit.
  const estimate = estimateEvacuation(site, 500, safety);
  assert.equal(estimate.valid, true);
  const assignments = Object.fromEntries(estimate.originAssignments.map(entry => [entry.originId, entry]));
  assert.equal(assignments['stage-a'].exitId, 'exit-1');
  assert.equal(assignments['stage-b'].exitId, 'exit-2');
  assert.equal(assignments['other-visitors'].exitId, 'exit-2');
  assert.equal(assignments['stage-a'].people, 200);
  assert.equal(assignments['stage-b'].people, 200);
  assert.equal(assignments['other-visitors'].people, 100);
  assert.equal(estimate.originAssignments.length, 3);
  for (const exit of estimate.exits) {
    const routed = estimate.originAssignments.filter(entry => entry.exitId === exit.id);
    assert.equal(routed.reduce((sum, entry) => sum + entry.people, 0), exit.people);
    assert.equal(Math.max(0, ...routed.map(entry => entry.metres)), exit.longestMetres);
  }
  for (const entry of estimate.originAssignments) {
    const origin = entry.originId === 'other-visitors' ? site.placements.P1 : site.placements[entry.originId];
    assert.equal(entry.metres, strictEvacuationRoute(site, origin, site.placements[entry.exitId]).metres);
  }
});

test('closing an exit reroutes the origin labels along with the evacuation audience allocation', () => {
  const site = field(), safety = measured();
  const original = estimateEvacuation(site, 500, safety);
  safety.exits['exit-1'].open = false;
  const rerouted = estimateEvacuation(site, 500, safety);
  assert.equal(rerouted.valid, true);
  assert.equal(rerouted.originAssignments.length, 3);
  assert.ok(rerouted.originAssignments.every(entry => entry.exitId === 'exit-2'));
  assert.equal(rerouted.originAssignments.reduce((sum, entry) => sum + entry.people, 0), 500);
  assert.equal(rerouted.exits[0].people, 500);
  assert.ok(rerouted.originAssignments.find(entry => entry.originId === 'stage-a').metres
    > original.originAssignments.find(entry => entry.originId === 'stage-a').metres);
});

test('zero-audience zones do not receive fabricated evacuation route labels', () => {
  const site = field(), safety = measured();
  safety.stages['stage-a'].audience = 0;
  safety.stages['stage-b'].audience = 500;
  const estimate = estimateEvacuation(site, 500, safety);
  assert.equal(estimate.valid, true);
  assert.equal(estimate.originAssignments.length, 1);
  assert.equal(estimate.originAssignments[0].originId, 'stage-b');
  assert.equal(estimate.originAssignments[0].exitId, 'exit-2');
  assert.equal(estimate.originAssignments[0].people, 500);
});

test('invalid or partly unreachable evacuation scenarios expose no misleading partial route labels', () => {
  const site = field(), safety = measured();
  const invalid = estimateEvacuation(site, 0, safety);
  assert.equal(invalid.valid, false);
  assert.deepEqual(invalid.originAssignments, []);
  const noWidths = measured(); noWidths.exits['exit-1'].width = null;
  assert.deepEqual(estimateEvacuation(site, 500, noWidths).originAssignments, []);
  // Stage A can be allocated first, but Stage B has no usable origin cell.
  // The failed estimate must not retain Stage A's partial assignment.
  const c = Math.floor(site.placements['stage-b'][0] / site.width * site.grid.cols);
  const r = Math.floor(site.placements['stage-b'][1] / site.height * site.grid.rows);
  const cells = site.grid.cells.split(''); cells[r * site.grid.cols + c] = '1';
  site.grid.cells = cells.join('');
  const blocked = estimateEvacuation(site, 500, safety);
  assert.equal(blocked.valid, false);
  assert.deepEqual(blocked.originAssignments, []);
});
