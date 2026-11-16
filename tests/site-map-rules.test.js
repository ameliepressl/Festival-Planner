// Checks for the site map and the layout planner (rules/site-map-rules.js), see feature-plans/site-map.md.
// Run with:  uvx --from nodejs-wheel node --test

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  LAYOUT_ITEMS, LAYOUT_RULE_COUNT, MAP_CATEGORIES, pointInPolygon, buildGrid, emptyGrid, isBlocked, isUsable,
  isOnFence, metresBetweenPoints, walkingMinutesBetween, suggestLayout, checkLayout, layoutScore, demoSite,
  parseSiteMaps, nearestOfKind, walkwayRoute, layoutItems, isKnownItemId
} = require('../rules/site-map-rules.js');
const { capacityNeeds } = require('../rules/capacity-rules.js');

// A plain rectangular field: width × height map units, widthMetres wide in reality, optional no-go polygons.
function field(width, height, widthMetres, nogo = []) {
  return {
    id: 'test', name: 'Test field', image: null, width, height, widthMetres,
    boundary: [[0, 0], [width, 0], [width, height], [0, height]],
    entrance: [width / 2, height], grid: nogo.length ? buildGrid(width, height, nogo) : emptyGrid(width, height), placements: {}
  };
}

test('every facility has a unique id and a known category; there are 21 including 6 pitches', () => {
  const ids = LAYOUT_ITEMS.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 21);
  assert.equal(LAYOUT_ITEMS.filter((i) => i.kind === 'pitch').length, 6);
  const categories = MAP_CATEGORIES.map((c) => c.id);
  LAYOUT_ITEMS.forEach((i) => assert.ok(categories.includes(i.category), i.id));
});

test('inside / outside the fence and no-go areas are recognised', () => {
  const square = [[0, 0], [100, 0], [100, 100], [0, 100]];
  assert.ok(pointInPolygon([50, 50], square));
  assert.ok(!pointInPolygon([150, 50], square));
  const lake = [[0, 0], [300, 0], [300, 300], [0, 300]];
  const site = field(1200, 800, 600, [lake]);
  assert.ok(isBlocked(site, [100, 100]));
  assert.ok(!isUsable(site, [100, 100]));
  assert.ok(isUsable(site, [800, 500]));
  assert.ok(isOnFence(site, [600, 799]));
  assert.ok(!isOnFence(site, [600, 400]));
});

test('distances and walking times use the real scale of the map', () => {
  const site = field(1000, 500, 500); // 1 map unit = 0.5 m
  assert.equal(metresBetweenPoints(site, [0, 0], [200, 0]), 100);
  assert.equal(walkingMinutesBetween(site, [0, 0], [200, 0]), 2); // 100 m at 80 m per minute, rounded up
  site.widthMetres = 1000; // the same map, but twice as large in reality
  assert.equal(metresBetweenPoints(site, [0, 0], [200, 0]), 200);
});

test('on the demo ground the suggested layout meets all 10 rules', () => {
  const site = demoSite();
  const rules = checkLayout(site, site.placements);
  assert.equal(rules.length, LAYOUT_RULE_COUNT);
  rules.forEach((rule) => assert.ok(rule.ok, `${rule.label}: ${rule.detail}`));
  assert.equal(layoutScore(rules), 100);
});

test('the planner places every facility on usable ground and never on the lake or in the forest', () => {
  const site = demoSite();
  LAYOUT_ITEMS.forEach((item) => {
    const at = site.placements[item.id];
    assert.ok(at, item.id);
    assert.ok(item.onFence ? isOnFence(site, at) : isUsable(site, at), item.id);
  });
});

test('the planner works on any uploaded map and avoids its no-go areas', () => {
  const river = [[0, 300], [1600, 300], [1600, 420], [0, 420]];
  const site = field(1600, 900, 800, [river]);
  site.entrance = [800, 0];
  const { placements, problem } = suggestLayout(site);
  assert.equal(problem, null);
  LAYOUT_ITEMS.forEach((item) => assert.ok(!isBlocked(site, placements[item.id]), `${item.id} is in the river`));
  assert.equal(layoutScore(checkLayout(site, placements)), 100);
});

test('the gate goes where the organiser puts it', () => {
  const site = field(1200, 800, 600);
  site.entrance = [0, 400];
  const { placements } = suggestLayout(site);
  assert.deepEqual(placements.entrance, [0, 400]);
});

test('a ground that is too small is reported honestly', () => {
  const site = field(1200, 800, 100); // only 100 m wide: the stages cannot be 150 m apart
  const rules = checkLayout(site, suggestLayout(site).placements);
  const stages = rules.find((r) => r.id === 'stage-distance');
  assert.equal(stages.ok, false);
  assert.match(stages.detail, /at least 150 m/);
  assert.ok(layoutScore(rules) < 100);
});

test('a ground with no usable space gets a clear message instead of a layout', () => {
  const site = field(600, 400, 300, [[[-10, -10], [610, -10], [610, 410], [-10, 410]]]);
  const result = suggestLayout(site);
  assert.deepEqual(result.placements, {});
  assert.match(result.problem, /no usable ground/);
});

test('moving a facility into the lake or onto another one breaks the right rules', () => {
  const site = demoSite();
  const inLake = { ...site.placements, 'toilets-a': [930, 540] };
  const usable = checkLayout(site, inLake).find((r) => r.id === 'usable');
  assert.equal(usable.ok, false);
  assert.ok(usable.items.includes('toilets-a'));
  const onTop = { ...site.placements, info: site.placements.security };
  assert.equal(checkLayout(site, onTop).find((r) => r.id === 'spacing').ok, false);
});

test('a missing facility is named', () => {
  const site = demoSite();
  const placements = { ...site.placements };
  delete placements['first-aid-b'];
  const rules = checkLayout(site, placements);
  assert.match(rules[0].detail, /First aid · Stage B/);
  assert.equal(rules.find((r) => r.id === 'first-aid').ok, false);
});

test('walkways go around no-go areas instead of through them', () => {
  // A wall across the middle of the field with a gap only at the bottom.
  const wall = [[580, 0], [620, 0], [620, 640], [580, 640]];
  const site = field(1200, 800, 600, [wall]);
  const route = walkwayRoute(site, [200, 200], [1000, 200]);
  assert.deepEqual(route[0], [200, 200]);
  assert.deepEqual(route[route.length - 1], [1000, 200]);
  assert.ok(route.length > 2, 'the route needs corners to get around the wall');
  assert.ok(route.some((p) => p[1] > 640), 'the route passes through the gap at the bottom');
  route.slice(1, -1).forEach((p) => assert.ok(!isBlocked(site, p), `${p} is inside the wall`));
});

test('the map gets as many toilet rows, water points and pitches as the festival size needs', () => {
  const items = layoutItems(capacityNeeds(5000)); // 7 toilet rows, 5 water points, 13 pitches
  assert.equal(items.filter((i) => i.kind === 'toilets').length, 7);
  assert.equal(items.filter((i) => i.kind === 'water').length, 5);
  assert.equal(items.filter((i) => i.kind === 'pitch').length, 13);
  assert.equal(new Set(items.map((i) => i.id)).size, items.length);
  items.forEach((i) => assert.ok(isKnownItemId(i.id), i.id));
  assert.ok(!isKnownItemId('ghost'));
});

test('even for 20,000 visitors the planner meets all 10 rules on the demo ground', () => {
  [5000, 20000].forEach((visitors) => {
    const items = layoutItems(capacityNeeds(visitors));
    const site = demoSite(items);
    const rules = checkLayout(site, site.placements, items);
    rules.forEach((rule) => assert.ok(rule.ok, `${visitors} visitors · ${rule.label}: ${rule.detail}`));
  });
});

test('after the festival grows, the new facilities are reported as missing until the layout is suggested again', () => {
  const site = demoSite(); // planned for the smallest layout
  const bigger = layoutItems(capacityNeeds(5000));
  const first = checkLayout(site, site.placements, bigger)[0];
  assert.equal(first.ok, false);
  assert.match(first.detail, /Toilets 3/);
  assert.match(first.detail, /P13/);
});

test('the nearest toilets are found for the details panel', () => {
  const site = demoSite();
  const nearest = nearestOfKind(site, site.placements, site.placements['stage-a'], 'toilets');
  assert.equal(nearest.item.id, 'toilets-a');
});

test('saved maps survive reopening the page; broken data is dropped', () => {
  const site = demoSite();
  const reopened = parseSiteMaps(JSON.stringify([site]));
  assert.deepEqual(reopened, [site]);
  assert.deepEqual(parseSiteMaps(null), []);
  assert.deepEqual(parseSiteMaps('not json'), []);
  assert.deepEqual(parseSiteMaps('[{"id":"x"}]'), []);
  const withJunk = { ...site, placements: { ...site.placements, ghost: [1, 2], 'stage-a': 'here' } };
  const cleaned = parseSiteMaps(JSON.stringify([withJunk]))[0].placements;
  assert.equal(cleaned.ghost, undefined);
  assert.equal(cleaned['stage-a'], undefined);
});
