// Checks for the vendors (rules/vendor-rules.js), see feature-plans/vendors.md.
// Run with:  uvx --from nodejs-wheel node --test

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  VENDORS, PITCHES, parsePlacements, confirmVendor, removeVendor,
  vendorOnPitch, pitchIncome, coverage, fitPlacements
} = require('../rules/vendor-rules.js');

// Confirm several vendors one after another, as the page does.
function confirmAll(ids) {
  return ids.reduce((placements, id) => confirmVendor(placements, id).placements, {});
}

test('the catalogue has 24 vendors with unique ids', () => {
  assert.equal(VENDORS.length, 24);
  assert.equal(new Set(VENDORS.map((v) => v.id)).size, 24);
});

test('nothing confirmed: no income and all three needs missing', () => {
  assert.equal(pitchIncome({}), 0);
  assert.deepEqual(coverage({}).missing, ['a vegan option', 'a drinks vendor', 'alcohol-free drinks']);
});

test('confirming gives the first free pitch, in order', () => {
  const placements = confirmAll(['tacos', 'beer', 'coffee']);
  assert.deepEqual(placements, { tacos: 'P1', beer: 'P2', coffee: 'P3' });
  assert.equal(vendorOnPitch(placements, 'P2').name, 'Lisbon Craft Beer');
  assert.equal(vendorOnPitch(placements, 'P4'), null);
});

test('a 7th vendor is refused when all 6 pitches are taken', () => {
  const full = confirmAll(['tacos', 'burgers', 'pizza', 'bowls', 'noodles', 'crepes']);
  assert.equal(Object.keys(full).length, PITCHES.length);
  const result = confirmVendor(full, 'beer');
  assert.equal(result.problem, 'All 6 pitches are taken. Remove a vendor first.');
  assert.deepEqual(result.placements, full);
});

test('the same vendor cannot be confirmed twice', () => {
  const once = confirmAll(['tacos']);
  assert.match(confirmVendor(once, 'tacos').problem, /already on pitch P1/);
});

test('removing a vendor frees its pitch for the next one', () => {
  const placements = confirmAll(['tacos', 'beer', 'coffee']);
  const afterRemove = removeVendor(placements, 'beer');
  assert.deepEqual(placements, { tacos: 'P1', beer: 'P2', coffee: 'P3' }); // the old object is unchanged
  assert.equal(confirmVendor(afterRemove, 'pizza').placements.pizza, 'P2');
});

test('income adds up the pitch fees of the confirmed vendors', () => {
  assert.equal(pitchIncome(confirmAll(['tacos', 'beer'])), 900 + 1500);
});

test('coverage names only what is still missing', () => {
  assert.deepEqual(coverage(confirmAll(['beer'])).missing, ['a vegan option', 'alcohol-free drinks']);
  assert.deepEqual(coverage(confirmAll(['bowls', 'lemonade'])).missing, []);
});

test('confirmed vendors survive reopening the page; broken data is ignored', () => {
  const placements = confirmAll(['tacos', 'coffee']);
  assert.deepEqual(parsePlacements(JSON.stringify(placements)), placements);
  assert.deepEqual(parsePlacements(null), {});
  assert.deepEqual(parsePlacements('not json'), {});
  assert.deepEqual(parsePlacements('["tacos"]'), {});
  assert.deepEqual(parsePlacements('{"ghost":"P1","tacos":"P21"}'), {}); // P21 does not exist (at most 20 pitches)
  assert.deepEqual(parsePlacements('{"tacos":"P1","beer":"P1"}'), { tacos: 'P1' });
});

test('a bigger food court has room for more vendors', () => {
  const ids = ['tacos', 'burgers', 'pizza', 'bowls', 'noodles', 'crepes', 'beer'];
  const placements = ids.reduce((p, id) => confirmVendor(p, id, 13).placements, {});
  assert.equal(placements.beer, 'P7');
  assert.equal(confirmVendor(placements, 'coffee', 7).problem, 'All 7 pitches are taken. Remove a vendor first.');
});

test('when the food court shrinks, vendors on pitches that no longer exist lose their pitch', () => {
  const placements = { tacos: 'P1', beer: 'P5', coffee: 'P9' };
  const result = fitPlacements(placements, 6);
  assert.deepEqual(result.placements, { tacos: 'P1', beer: 'P5' });
  assert.deepEqual(result.removed.map((v) => v.name), ['Bean There Coffee']);
  assert.deepEqual(parsePlacements(JSON.stringify({ coffee: 'P13' })), { coffee: 'P13' });
});
