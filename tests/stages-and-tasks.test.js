// Follow-ups from the Munich bug hunt (feature-plans/demo-munich.md):
// the site map, crowd checks and checklist know every lineup stage, and the Munich demo
// marks every project task done except the fun ones (artists, lineup, food stands, tickets).
// Run with:  uvx --from nodejs-wheel node --test

const test = require('node:test');
const assert = require('node:assert/strict');
const { capacityNeeds } = require('../rules/capacity-rules.js');
const { layoutItems, LAYOUT_ITEMS, demoSite, checkLayout, layoutScore, LAYOUT_RULE_COUNT, isKnownItemId, mapStageCount, parseSiteMaps } = require('../rules/site-map-rules.js');
const { normalizeCrowdSafety, crowdSafetyChecks, estimateEvacuation, crowdStageIds } = require('../rules/crowd-rules.js');
const { munichDemoFestival, munichTaskStatuses, MUNICH_OPEN_TASK_GROUPS } = require('../rules/demo-festival.js');
const { CHECKLIST } = require('../rules/checklist-rules.js');

const ids = (items) => items.map((i) => i.id);

test('without a stage count the map keeps exactly the old two-stage layout', () => {
  assert.deepEqual(ids(layoutItems()), ids(LAYOUT_ITEMS));
  assert.deepEqual(ids(layoutItems({ ...capacityNeeds(5000), stages: 2 })), ids(layoutItems(capacityNeeds(5000))));
  assert.deepEqual(LAYOUT_ITEMS.filter((i) => i.kind === 'stage').map((i) => i.id), ['stage-a', 'stage-b']);
});

test('the stage count is a whole number from 2 to 12; anything else falls back to 2', () => {
  assert.equal(mapStageCount(3), 3);
  assert.equal(mapStageCount(12), 12);
  assert.equal(mapStageCount(13), 12);
  assert.equal(mapStageCount(1), 2);
  assert.equal(mapStageCount(undefined), 2);
  assert.equal(mapStageCount('x'), 2);
  assert.equal(mapStageCount(2.5), 2);
});

test('a third stage brings its own first aid, toilets and water point', () => {
  const items = layoutItems({ ...capacityNeeds(20000), stages: 3 });
  const list = ids(items);
  ['stage-c', 'first-aid-c', 'toilets-c', 'water-c'].forEach((id) => assert.ok(list.includes(id), id));
  assert.equal(new Set(list).size, list.length, 'every id is unique');
  // The total number of toilet rows and water points still follows the festival size.
  assert.equal(items.filter((i) => i.kind === 'toilets').length, capacityNeeds(20000).toiletBlocks);
  assert.equal(items.filter((i) => i.kind === 'water').length, capacityNeeds(20000).waterPoints);
  ['stage-c', 'first-aid-c', 'toilets-c', 'water-c', 'stage-l', 'first-aid-l'].forEach((id) => assert.ok(isKnownItemId(id), id));
  ['stage-m', 'first-aid-m', 'stage-1'].forEach((id) => assert.ok(!isKnownItemId(id), id));
});

test('the suggested layout puts three and four stages on the demo ground and meets every rule', () => {
  for (const stages of [3, 4]) {
    const items = layoutItems({ ...capacityNeeds(20000), stages });
    const site = demoSite(items);
    items.forEach((item) => assert.ok(site.placements[item.id], `${item.id} is placed`));
    const rules = checkLayout(site, site.placements, items);
    assert.equal(rules.length, LAYOUT_RULE_COUNT);
    assert.equal(layoutScore(rules), 100, rules.filter((r) => !r.ok).map((r) => r.detail).join(' | '));
    assert.match(rules.find((r) => r.id === 'water').detail, /Stage C: \d+ m/);
  }
});

test('a third stage too close to another one, or without first aid, fails the layout check', () => {
  const items = layoutItems({ ...capacityNeeds(20000), stages: 3 });
  const site = demoSite(items);
  const tooClose = { ...site.placements, 'stage-c': [site.placements['stage-a'][0] + 20, site.placements['stage-a'][1]] };
  const distance = checkLayout(site, tooClose, items).find((r) => r.id === 'stage-distance');
  assert.equal(distance.ok, false);
  assert.match(distance.detail, /Stage A and Stage C/);
  const { 'first-aid-c': gone, ...withoutAid } = site.placements;
  assert.ok(gone);
  assert.equal(checkLayout(site, withoutAid, items).find((r) => r.id === 'first-aid').ok, false);
});

test('a saved map with a third stage keeps it when the maps are read back', () => {
  const items = layoutItems({ ...capacityNeeds(20000), stages: 3 });
  const site = demoSite(items);
  const reopened = parseSiteMaps(JSON.stringify([site]))[0];
  assert.deepEqual(reopened.placements['stage-c'], site.placements['stage-c']);
  assert.deepEqual(reopened.placements['first-aid-c'], site.placements['first-aid-c']);
});

test('crowd checks measure every stage on the map, and a missing third-stage audience blocks the estimate', () => {
  const items = layoutItems({ ...capacityNeeds(20000), stages: 3 });
  const site = demoSite(items);
  assert.deepEqual(crowdStageIds(undefined, site.placements), ['stage-a', 'stage-b', 'stage-c']);
  site.crowdSafety = normalizeCrowdSafety({ stages: { 'stage-a': { area: 9000, audience: 12000 }, 'stage-b': { area: 5000, audience: 5000 } },
    exits: { 'exit-1': { width: 20 }, 'exit-2': { width: 20 } } });
  let result = crowdSafetyChecks(site, 20000);
  const stageC = result.checks.find((c) => c.id === 'density-stage-c');
  assert.ok(stageC, 'Stage C has its own density check');
  assert.equal(stageC.ok, false);
  assert.equal(stageC.unknown, true);
  assert.equal(result.evacuation.valid, false);
  site.crowdSafety.stages['stage-c'] = { area: 2000, audience: 3000 };
  result = crowdSafetyChecks(site, 20000);
  assert.equal(result.checks.find((c) => c.id === 'density-stage-c').ok, true);
  assert.equal(result.evacuation.valid, true);
  assert.ok(result.evacuation.originAssignments.some((a) => a.originId === 'stage-c'));
  // Audiences of all three stages together may not exceed the visitors.
  site.crowdSafety.stages['stage-c'].audience = 3001;
  assert.equal(estimateEvacuation(site, 20000).valid, false);
});

test('two-stage crowd data stays exactly as before (no third stage appears)', () => {
  const safety = normalizeCrowdSafety({ stages: { 'stage-a': { area: 100, audience: 50 } } });
  assert.deepEqual(Object.keys(safety.stages), ['stage-a', 'stage-b']);
});

test('the Munich demo map shows all three lineup stages with measured audiences', () => {
  const demo = munichDemoFestival();
  const items = layoutItems({ ...capacityNeeds(demo.ground.visitors), stages: demo.plan.settings.stages });
  const site = demoSite(items);
  assert.ok(site.placements['stage-c'], 'the Rising Stage is on the map');
  assert.equal(layoutScore(checkLayout(site, site.placements, items)), 100);
  site.crowdSafety = normalizeCrowdSafety(demo.crowdSafety);
  const checks = crowdSafetyChecks(site, demo.ground.visitors).checks;
  ['density-stage-a', 'density-stage-b', 'density-stage-c'].forEach((id) => assert.equal(checks.find((c) => c.id === id).ok, true, id));
  const audience = Object.values(demo.crowdSafety.stages).reduce((sum, s) => sum + s.audience, 0);
  assert.ok(audience <= demo.ground.visitors);
  // The boring safety parts are done: exits measured, evacuation estimate within the target.
  checks.forEach((c) => assert.equal(c.ok, true, c.id));
});

test('the checklist no longer speaks of exactly two stages', () => {
  const texts = CHECKLIST.flatMap((team) => team.tasks.map((t) => t.text)).join(' ');
  assert.doesNotMatch(texts, /both stages/i);
});

test('Munich task statuses: everything done except the fun task groups (artists, lineup, food, tickets)', () => {
  const plan = [
    { id: 1, tasks: [{ id: '1.1', title: 'Define the festival', subtasks: [{ id: 'a' }, { id: 'b' }] }] },
    { id: 5, tasks: [{ id: '5.1', title: 'Book artists', subtasks: [{ id: 'c' }, { id: 'd' }, { id: 'e' }] }] },
    { id: 10, tasks: [{ id: '10.1', title: ' prepare ticket sales ', subtasks: [{ id: 'f' }, { id: 'g' }] }] }
  ];
  const done = { status: 'done', completedAt: 123 };
  assert.deepEqual(munichTaskStatuses(plan, 123), { a: done, b: done, c: done, d: 'progress', f: done, g: 'progress' });
  assert.deepEqual(munichTaskStatuses([]), {});
  assert.deepEqual(munichTaskStatuses(null), {});
  assert.deepEqual(MUNICH_OPEN_TASK_GROUPS, ['Book artists', 'Announce the lineup', 'Select food and beverage vendors', 'Prepare ticket sales']);
});
