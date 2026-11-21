// Vendor library (feature-plans/vendor-catalogue.md): many more food and drink stands, each with a
// menu, search and filters, and the original vendor rules working for every stand.
// Run with:  uvx --from nodejs-wheel node --test

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  VENDORS, allVendors, findVendor, filterVendors, vendorCuisines, menuFrom,
  confirmVendor, parsePlacements, pitchIncome, coverage
} = require('../rules/vendor-rules.js');
const { VENDOR_LIBRARY, VENDOR_TYPES, tagsFromMenu } = require('../rules/vendor-library.js');

test('the library adds well over 100 food and drink stands, every id is unique', () => {
  const food = VENDOR_LIBRARY.filter((v) => v.category === 'Food').length;
  const drinks = VENDOR_LIBRARY.filter((v) => v.category === 'Drinks').length;
  assert.ok(food >= 100, `only ${food} food stands`);
  assert.ok(drinks >= 50, `only ${drinks} drink stands`);
  const all = allVendors();
  assert.equal(all.length, VENDORS.length + VENDOR_LIBRARY.length);
  assert.equal(new Set(all.map((v) => v.id)).size, all.length);
  assert.equal(new Set(all.map((v) => v.name.toLowerCase())).size, all.length);
});

test('the 24 original vendors come first and keep their ids', () => {
  assert.deepEqual(allVendors().slice(0, VENDORS.length).map((v) => v.id), VENDORS.map((v) => v.id));
  assert.deepEqual(filterVendors(allVendors(), {}).slice(0, 24).map((v) => v.id), VENDORS.map((v) => v.id));
});

test('every stand has a menu with prices, and a dish photo title for food and drinks', () => {
  for (const v of allVendors()) {
    assert.ok(Array.isArray(v.menu) && v.menu.length >= 3, `${v.name}: menu too short`);
    for (const m of v.menu) {
      assert.ok(m.item && Number.isFinite(m.price) && m.price > 0 && m.price < 100, `${v.name}: ${m.item}`);
      assert.ok(m.tags.every((t) => ['vegan', 'vegetarian', 'gluten-free', 'alcohol', 'alcohol-free'].includes(t)));
    }
    if (v.category !== 'Merch') assert.ok(v.photo, `${v.name}: no photo title`);
    assert.ok(Number.isFinite(v.fee) && v.fee > 0);
  }
});

test('a stand never claims a diet tag that its menu does not offer, and the other way round', () => {
  for (const v of VENDOR_LIBRARY) assert.deepEqual(v.tags, tagsFromMenu(v.menu, v.category), v.name);
  // The original vendors: menu items never claim more than the stand's own tags (vegan counts as vegetarian).
  for (const v of VENDORS) {
    const allowed = new Set(v.tags);
    if (allowed.has('vegan')) allowed.add('vegetarian');
    for (const m of v.menu) assert.ok(m.tags.every((t) => allowed.has(t)), `${v.name}: ${m.item}`);
  }
});

test('menuFrom reads the menu shorthand', () => {
  assert.deepEqual(menuFrom(['Falafel wrap|8.5|vg,v', 'Lager|4.5|a', 'Water|2|af', 'Bifana|6|']), [
    { item: 'Falafel wrap', price: 8.5, tags: ['vegan', 'vegetarian'] },
    { item: 'Lager', price: 4.5, tags: ['alcohol'] },
    { item: 'Water', price: 2, tags: ['alcohol-free'] },
    { item: 'Bifana', price: 6, tags: [] }
  ]);
});

test('filters: category, kind of stand, diet, maximum fee and search through the menus', () => {
  const all = allVendors();
  const drinks = filterVendors(all, { category: 'Drinks' });
  assert.ok(drinks.length > 50 && drinks.every((v) => v.category === 'Drinks'));
  const beer = filterVendors(all, { cuisine: 'Craft beer' });
  assert.ok(beer.length >= 4 && beer.every((v) => v.cuisine === 'Craft beer'));
  const vegan = filterVendors(all, { diet: 'vegan' });
  assert.ok(vegan.length > 0 && vegan.every((v) => v.tags.includes('vegan')));
  const vegetarian = filterVendors(all, { diet: 'vegetarian' }).map((v) => v.id);
  assert.ok(vegan.every((v) => vegetarian.includes(v.id)), 'vegan stands also count as vegetarian');
  assert.ok(filterVendors(all, { maxFee: '700' }).every((v) => v.fee <= 700));
  const pastel = filterVendors(all, { query: 'pastel de nata' });
  assert.ok(pastel.length > 0 && pastel.every((v) => v.menu.some((m) => /pastel de nata/i.test(m.item))));
  assert.ok(filterVendors(all, { query: 'CREPE' }).some((v) => v.name === 'Crêpe Corner'), 'search ignores accents');
  assert.equal(filterVendors(all, { query: 'no-such-stand-xyz' }).length, 0);
});

test('sorting by name and by pitch fee', () => {
  const byName = filterVendors(allVendors(), { sort: 'name' }).map((v) => v.name);
  assert.deepEqual(byName, [...byName].sort((a, b) => a.localeCompare(b, 'en')));
  const low = filterVendors(allVendors(), { sort: 'fee-low' }).map((v) => v.fee);
  assert.ok(low.every((fee, i) => i === 0 || low[i - 1] <= fee));
  const high = filterVendors(allVendors(), { sort: 'fee-high' }).map((v) => v.fee);
  assert.ok(high.every((fee, i) => i === 0 || high[i - 1] >= fee));
});

test('the kinds of stand per category for the filter', () => {
  const drinkKinds = vendorCuisines(allVendors(), 'Drinks');
  assert.ok(drinkKinds.includes('Craft beer') && drinkKinds.includes('Coffee'));
  assert.ok(!drinkKinds.includes('Tacos'));
  assert.deepEqual(drinkKinds, [...drinkKinds].sort((a, b) => a.localeCompare(b, 'en')));
  assert.equal(new Set(VENDOR_TYPES.map((t) => t.cuisine)).size, VENDOR_TYPES.length);
});

test('library stands can be confirmed, saved, reloaded, counted as income and as visitor needs', () => {
  const tacos = VENDOR_LIBRARY.find((v) => v.cuisine === 'Tacos');
  const kombucha = VENDOR_LIBRARY.find((v) => v.cuisine === 'Kombucha');
  let placements = confirmVendor({}, tacos.id).placements;
  placements = confirmVendor(placements, kombucha.id).placements;
  assert.deepEqual(placements, { [tacos.id]: 'P1', [kombucha.id]: 'P2' });
  assert.deepEqual(parsePlacements(JSON.stringify(placements)), placements);
  assert.equal(pitchIncome(placements), tacos.fee + kombucha.fee);
  assert.deepEqual(coverage(placements).missing, []);
  assert.equal(findVendor(tacos.id).name, tacos.name);
});
