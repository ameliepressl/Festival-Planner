// Checks for the festival size (rules/capacity-rules.js), see feature-plans/festival-size.md.
// Run with:  uvx --from nodejs-wheel node --test

const test = require('node:test');
const assert = require('node:assert/strict');
const { capacityNeeds, validVisitors, parseGround, DEFAULT_VISITORS } = require('../rules/capacity-rules.js');

test('5,000 visitors need 50 toilets in 7 rows, 5 water points and 13 food pitches', () => {
  const needs = capacityNeeds(5000);
  assert.equal(needs.toiletCabins, 50);
  assert.equal(needs.toiletBlocks, 7); // 50 cabins / 8 per row, rounded up
  assert.equal(needs.waterPoints, 5);
  assert.equal(needs.pitches, 13);     // 5,000 / 400 = 12.5, rounded up
  assert.equal(needs.firstAiders, 10);
  assert.equal(needs.securityStaff, 20);
});

test('a small festival still gets at least two toilet rows, two water points and four pitches', () => {
  const needs = capacityNeeds(500);
  assert.equal(needs.toiletBlocks, 2);
  assert.equal(needs.waterPoints, 2);
  assert.equal(needs.pitches, 4);
  assert.equal(needs.firstAiders, 4);
  assert.equal(needs.securityStaff, 10);
});

test('a large festival is capped at 20 food pitches', () => {
  assert.equal(capacityNeeds(20000).pitches, 20);
});

test('more visitors never mean fewer facilities', () => {
  let previous = capacityNeeds(500);
  for (let visitors = 600; visitors <= 20000; visitors += 100) {
    const next = capacityNeeds(visitors);
    ['toiletBlocks', 'waterPoints', 'pitches', 'firstAiders', 'securityStaff'].forEach((key) => assert.ok(next[key] >= previous[key], `${key} at ${visitors}`));
    previous = next;
  }
});

test('only whole numbers from 500 to 20,000 visitors are accepted', () => {
  assert.ok(validVisitors(500));
  assert.ok(validVisitors(20000));
  assert.ok(!validVisitors(499));
  assert.ok(!validVisitors(20001));
  assert.ok(!validVisitors(1234.5));
  assert.ok(!validVisitors('lots'));
});

test('the festival size survives reopening the page; broken data gives the default', () => {
  assert.deepEqual(parseGround(JSON.stringify({ visitors: 8000 })), { visitors: 8000 });
  assert.deepEqual(parseGround(null), { visitors: DEFAULT_VISITORS });
  assert.deepEqual(parseGround('not json'), { visitors: DEFAULT_VISITORS });
  assert.deepEqual(parseGround('{"visitors":3}'), { visitors: DEFAULT_VISITORS });
});
