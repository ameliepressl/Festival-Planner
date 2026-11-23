// Site map: "Clear all pins" and placing them again (rules/map-pin-rules.js).
// See feature-plans/clear-site-map-pins.md.
// Run with:  uvx --from nodejs-wheel node --test

const test = require('node:test');
const assert = require('node:assert/strict');
const map = require('../rules/site-map-rules.js');
const capacity = require('../rules/capacity-rules.js');
const draftRules = require('../rules/map-draft-rules.js');
const {
  clearedPlacements, withoutPin, pinCounts, pinsToPlace, pinChoices, nextPinToPlace, pinSpot, fillMissingPins
} = require('../rules/map-pin-rules.js');

const items = map.layoutItems({ ...capacity.capacityNeeds(5000), stages: 2 });
const item = (id) => map.findItem(id, items);
const demo = () => map.demoSite(items);   // a full, valid layout on the demo ground with a lake and a forest

test('clearing removes every pin; keeping the gate keeps only the main entrance', () => {
  const site = demo();
  assert.deepEqual(clearedPlacements(site.placements), {});
  assert.deepEqual(clearedPlacements(site.placements, { keepGate: true }), { entrance: site.placements.entrance });
  assert.deepEqual(clearedPlacements({ 'stage-a': [1, 2] }, { keepGate: true }), {}, 'no gate on the map: nothing to keep');
});

test('clearing never changes the saved placements object it was given', () => {
  const site = demo();
  const before = JSON.stringify(site.placements);
  const kept = clearedPlacements(site.placements, { keepGate: true });
  kept.entrance[0] = -1;
  assert.equal(JSON.stringify(site.placements), before);
});

test('the counts say how many pins are placed and how many Clear removes', () => {
  const site = demo();
  assert.deepEqual(pinCounts(items, site.placements), { total: items.length, placed: items.length, toRemove: items.length });
  assert.deepEqual(pinCounts(items, site.placements, { keepGate: true }), { total: items.length, placed: items.length, toRemove: items.length - 1 });
  assert.deepEqual(pinCounts(items, {}, { keepGate: true }), { total: items.length, placed: 0, toRemove: 0 });
});

test('pins to place are grouped by map category in the map order, empty groups left out', () => {
  const groups = pinsToPlace(items, { 'stage-a': [1, 1], 'stage-b': [2, 2] });
  assert.deepEqual(groups.map((group) => group.category), ['food', 'facilities', 'safety', 'services']);
  const all = groups.flatMap((group) => group.items.map((entry) => entry.id));
  assert.equal(all.length, items.length - 2);
  assert.ok(!all.includes('stage-a'));
  assert.equal(groups[0].colour, map.MAP_CATEGORIES.find((category) => category.id === 'food').colour);
  assert.deepEqual(pinsToPlace(items, demo().placements), [], 'a full layout has nothing left to place');
});

test('after placing a pin, the next one of the same kind is ready, then the rest', () => {
  assert.equal(nextPinToPlace(items, {}).id, items[0].id);
  assert.equal(nextPinToPlace(items, { 'stage-a': [1, 1] }, 'stage-a').id, 'stage-b');
  const allStages = { 'stage-a': [1, 1], 'stage-b': [2, 2] };
  assert.notEqual(nextPinToPlace(items, allStages, 'stage-b').category, 'stages');
  assert.equal(nextPinToPlace(items, demo().placements, 'stage-a'), null, 'nothing left: placing ends');
});

test('Skip moves on to another pin and never returns the one being skipped', () => {
  const placements = { 'stage-a': [1, 1] };
  assert.notEqual(nextPinToPlace(items, placements, 'stage-b')?.id, 'stage-b');
});

test('a pin lands where it is clicked on usable ground', () => {
  const site = demo();
  assert.deepEqual(pinSpot(site, item('stage-a'), [600.4, 400.6]), { ok: true, at: [600, 401] });
});

test('a pin cannot be placed in the lake, in the forest or outside the fence', () => {
  const site = demo();
  const lake = map.DEMO_SCENE.lake[0];
  const forest = map.DEMO_SCENE.forest[0];
  const inLake = lake.map((_, k) => map.DEMO_SCENE.lake.reduce((sum, p) => sum + p[k], 0) / map.DEMO_SCENE.lake.length);
  const inForest = forest.map((_, k) => map.DEMO_SCENE.forest.reduce((sum, p) => sum + p[k], 0) / map.DEMO_SCENE.forest.length);
  for (const spot of [inLake, inForest, [2, 2]]) {
    const result = pinSpot(site, item('toilets-a'), spot);
    assert.equal(result.ok, false, `refused at ${spot}`);
    assert.match(result.problem, /Toilets/);
    assert.match(result.problem, /outside the fence or on a no-go area/);
  }
});

test('gate and emergency exits snap onto the fence', () => {
  const site = demo();
  for (const id of ['entrance', 'exit-1']) {
    const result = pinSpot(site, item(id), [600, 400]);   // clicked in the middle of the ground
    assert.equal(result.ok, true);
    assert.ok(map.isOnFence(site, result.at), `${id} ends up on the fence`);
    assert.ok(map.checkLayout(site, { ...site.placements, [id]: result.at }, items)
      .find((rule) => rule.id === 'usable').ok, 'the layout check agrees');
  }
});

test('nonsense spots and a missing pin are refused with a message', () => {
  const site = demo();
  assert.equal(pinSpot(site, null, [1, 1]).ok, false);
  for (const spot of [null, [1], [NaN, 2], ['1', 2], [Infinity, 3]]) {
    assert.equal(pinSpot(site, item('stage-a'), spot).ok, false);
  }
});

test('"Fill the rest" keeps every pin placed by hand and only adds the missing ones', () => {
  const site = demo();
  const byHand = { 'stage-a': [300, 300], entrance: site.placements.entrance };
  const suggested = map.suggestLayout({ ...site, placements: byHand }, items).placements;
  const filled = fillMissingPins(byHand, suggested);
  assert.deepEqual(filled['stage-a'], [300, 300]);
  assert.equal(pinsToPlace(items, filled).length, 0, 'nothing is missing afterwards');
  assert.deepEqual(fillMissingPins({}, {}), {});
});

test('clearing is a normal draft change: Undo brings the pins back, Save is still needed', () => {
  const site = demo();
  const snapshot = (placements) => ({ sites: [{ ...site, placements }], ground: { visitors: 5000 }, currentId: 'demo', pendingFence: null });
  const draft = draftRules.createMapDraft(snapshot(site.placements));
  draftRules.changeMapDraft(draft, snapshot(clearedPlacements(site.placements)));
  assert.equal(draftRules.mapDraftDirty(draft), true);
  assert.deepEqual(draft.present.sites[0].placements, {});
  assert.equal(draftRules.undoMapDraft(draft), true);
  assert.deepEqual(draft.present.sites[0].placements, site.placements);
  assert.equal(draftRules.mapDraftDirty(draft), false);
});

test('a cleared map still parses and keeps its fence, gate position and no-go areas', () => {
  const site = demo();
  const cleared = { ...site, placements: clearedPlacements(site.placements) };
  const parsed = map.parseSiteMaps(JSON.stringify([cleared]))[0];
  assert.deepEqual(parsed.placements, {});
  assert.deepEqual(parsed.boundary, site.boundary);
  assert.deepEqual(parsed.entrance, site.entrance);
  assert.equal(parsed.grid.cells, site.grid.cells);
  const rules = map.checkLayout(parsed, parsed.placements, items);
  assert.equal(rules.find((rule) => rule.id === 'all-placed').ok, false);
});

test('many pins of one kind share one button; the stage toilets come first', () => {
  const big = map.layoutItems({ ...capacity.capacityNeeds(20000), stages: 3 });
  const groups = pinChoices(big, {});
  const facilities = groups.find((group) => group.category === 'facilities');
  const toilets = facilities.choices.find((choice) => choice.label === 'Toilets');
  assert.equal(toilets.count, big.filter((entry) => entry.kind === 'toilets').length);
  assert.equal(toilets.id, 'toilets-a', 'the button places the toilets next to Stage A first');
  assert.equal(facilities.count, big.filter((entry) => entry.category === 'facilities').length);
  const stages = groups.find((group) => group.category === 'stages');
  assert.deepEqual(stages.choices.map((choice) => [choice.id, choice.label, choice.count]),
    big.filter((entry) => entry.kind === 'stage').map((entry) => [entry.id, entry.name, 1]), 'stages keep their own buttons');
  const afterOne = pinChoices(big, { 'toilets-a': [1, 1] });
  assert.equal(afterOne.find((group) => group.category === 'facilities').choices.find((choice) => choice.label === 'Toilets').id, 'toilets-b');
});

test('a few pins of a kind keep their own buttons with their full names', () => {
  const big = map.layoutItems({ ...capacity.capacityNeeds(20000), stages: 3 });
  const water = big.filter((entry) => entry.kind === 'water');
  const placed = Object.fromEntries(water.slice(0, -3).map((entry) => [entry.id, [1, 1]]));   // 3 left
  const choices = pinChoices(big, placed).find((group) => group.category === 'facilities').choices;
  for (const entry of water.slice(-3)) {
    assert.ok(choices.some((choice) => choice.id === entry.id && choice.label === entry.name && choice.count === 1), entry.name);
  }
  assert.equal(choices.some((choice) => choice.label === 'Free water'), false);
});

test('removing one pin takes only that pin off the map; it then waits under "Pins to place"', () => {
  const site = demo();
  const rest = withoutPin(site.placements, 'toilets-a');
  assert.equal(rest['toilets-a'], undefined);
  assert.equal(Object.keys(rest).length, Object.keys(site.placements).length - 1);
  assert.ok(site.placements['toilets-a'], 'the saved placements object is not changed');
  const waiting = pinsToPlace(items, rest).flatMap((group) => group.items.map((entry) => entry.id));
  assert.deepEqual(waiting, ['toilets-a']);
  assert.deepEqual(withoutPin(rest, 'toilets-a'), rest, 'removing a pin that is not on the map changes nothing');
});

test('a removed pin can be placed again on its own, and the layout check counts it again', () => {
  const site = demo();
  const rest = withoutPin(site.placements, 'stage-b');
  assert.equal(map.checkLayout(site, rest, items).find((rule) => rule.id === 'all-placed').ok, false);
  const spot = pinSpot(site, item('stage-b'), site.placements['stage-b']);
  assert.equal(spot.ok, true);
  const back = { ...rest, 'stage-b': spot.at };
  assert.equal(map.checkLayout(site, back, items).find((rule) => rule.id === 'all-placed').ok, true);
  assert.equal(nextPinToPlace(items, back, 'stage-b'), null);
});
