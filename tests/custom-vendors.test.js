// "Add vendor": your own stands with all their details (feature-plans/custom-vendors.md).
// Run with:  uvx --from nodejs-wheel node --test

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const rules = require('../rules/vendor-rules.js');
const {
  CUSTOM_VENDORS_KEY, VENDOR_STORAGE_KEY, MAX_CUSTOM_VENDORS, MAX_MENU_ITEMS, VENDORS,
  customVendorProblem, addCustomVendor, updateCustomVendor, deleteCustomVendor, parseCustomVendors
} = rules;
const root = path.join(__dirname, '..');

const stand = (changes = {}) => ({
  name: 'Döner Delight', category: 'Food', cuisine: 'Kebab', fee: 950, text: 'Kebab wraps and plates.', photo: 'Doner kebab',
  menu: [{ item: 'Döner wrap', price: 8.5, tags: [] }, { item: 'Falafel wrap', price: 7.5, tags: ['vegan'] }, { item: 'Fries', price: '4', tags: ['vegan', 'gluten-free'] }],
  ...changes
});

test('a complete stand is accepted with all its details, and its labels follow the menu', () => {
  const { list, vendor, problem } = addCustomVendor([], stand());
  assert.equal(problem, null);
  assert.equal(list.length, 1);
  assert.equal(vendor.id, 'c-doner-delight');
  assert.equal(vendor.name, 'Döner Delight');
  assert.equal(vendor.category, 'Food');
  assert.equal(vendor.cuisine, 'Kebab');
  assert.equal(vendor.fee, 950);
  assert.equal(vendor.text, 'Kebab wraps and plates.');
  assert.equal(vendor.photo, 'Doner kebab');
  assert.equal(vendor.custom, true);
  assert.deepEqual(vendor.menu.map((m) => m.price), [8.5, 7.5, 4]);
  // vegan dishes are vegetarian too; the stand claims only what its menu has
  assert.deepEqual(vendor.menu[1].tags, ['vegan', 'vegetarian']);
  assert.deepEqual(vendor.tags, ['vegan', 'vegetarian', 'gluten-free']);
});

test('names, kinds and descriptions are trimmed; an optional description and photo may be empty', () => {
  const { vendor, problem } = addCustomVendor([], stand({ name: '  Taco   Truck  ', cuisine: ' Tacos ', text: '', photo: '' }));
  assert.equal(problem, null);
  assert.equal(vendor.name, 'Taco Truck');
  assert.equal(vendor.cuisine, 'Tacos');
  assert.equal(vendor.text, '');
  assert.equal(vendor.photo, '');
});

test('a drinks stand can sell alcohol and alcohol-free drinks; a food stand cannot sell alcohol', () => {
  const bar = stand({ name: 'Hop Shop', category: 'Drinks', cuisine: 'Craft beer',
    menu: [{ item: 'IPA', price: 5.5, tags: ['alcohol'] }, { item: 'Alcohol-free beer', price: 4, tags: ['alcohol-free'] }] });
  const { vendor } = addCustomVendor([], bar);
  assert.deepEqual(vendor.tags, ['alcohol', 'alcohol-free']);
  assert.match(customVendorProblem({ ...bar, category: 'Food' }), /only drinks stands can sell alcohol/);
  assert.match(customVendorProblem({ ...bar, menu: [{ item: 'IPA', price: 5, tags: ['alcohol', 'alcohol-free'] }] }), /cannot contain alcohol and be alcohol-free/);
});

test('every wrong input is rejected with a sentence that says what to change, and nothing is added', () => {
  const cases = [
    [{ name: '' }, /stand name/], [{ name: 'X' }, /stand name/], [{ name: 'x'.repeat(61) }, /stand name/],
    [{ category: 'Toys' }, /Food, Drinks or Merch/],
    [{ cuisine: '' }, /kind of stand/], [{ cuisine: 'y'.repeat(41) }, /kind of stand/],
    [{ text: 'z'.repeat(201) }, /description/], [{ photo: 'p'.repeat(81) }, /photo/],
    [{ fee: '' }, /pitch fee/], [{ fee: -1 }, /pitch fee/], [{ fee: 9.5 }, /pitch fee/], [{ fee: 20001 }, /pitch fee/], [{ fee: 'abc' }, /pitch fee/], [{ fee: true }, /pitch fee/],
    [{ menu: [] }, /menu items/], [{ menu: undefined }, /menu items/],
    [{ menu: Array.from({ length: MAX_MENU_ITEMS + 1 }, (_, i) => ({ item: `Dish ${i}`, price: 5, tags: [] })) }, /menu items/],
    [{ menu: [{ item: '', price: 5, tags: [] }] }, /Menu item 1: enter a name/],
    [{ menu: [{ item: 'Soup', price: 0, tags: [] }] }, /price above €0/],
    [{ menu: [{ item: 'Soup', price: -2, tags: [] }] }, /price above €0/],
    [{ menu: [{ item: 'Soup', price: 501, tags: [] }] }, /at most €500/],
    [{ menu: [{ item: 'Soup', price: '', tags: [] }] }, /price above €0/],
    [{ menu: [{ item: 'Soup', price: 4.555, tags: [] }] }, /two decimals/],
    [{ menu: [{ item: 'Soup', price: 4, tags: ['spicy'] }] }, /unknown label/]
  ];
  for (const [changes, message] of cases) {
    const result = addCustomVendor([], stand(changes));
    assert.match(result.problem || '', message, JSON.stringify(changes));
    assert.deepEqual(result.list, []);
    assert.equal(result.vendor, null);
  }
});

test('a name that is already used (own stands or the catalogue) is rejected, ignoring upper/lower case', () => {
  const { list } = addCustomVendor([], stand());
  assert.match(addCustomVendor(list, stand({ name: 'döner DELIGHT' })).problem, /already a stand called/);
  assert.match(addCustomVendor([], stand({ name: VENDORS[0].name })).problem, /already a stand called/);
});

test('ids stay unique and readable; at most 50 own stands', () => {
  let list = [];
  ({ list } = addCustomVendor(list, stand({ name: 'Taco Tribe!' })));
  assert.equal(list[0].id, 'c-taco-tribe');
  ({ list } = addCustomVendor(list, stand({ name: 'Taco-Tribe' })));
  assert.equal(list[1].id, 'c-taco-tribe-2');
  const full = Array.from({ length: MAX_CUSTOM_VENDORS }, (_, i) => ({ ...list[0], id: `c-x-${i}`, name: `Stand ${i}` }));
  assert.match(addCustomVendor(full, stand({ name: 'One more' })).problem, /at most 50/);
});

test('editing keeps the id (so the pitch stays), checks the input again and may keep its own name', () => {
  const { list, vendor } = addCustomVendor([], stand());
  const edited = updateCustomVendor(list, vendor.id, stand({ fee: 1200, text: 'Now with lahmacun.' }));
  assert.equal(edited.problem, null);
  assert.equal(edited.vendor.id, vendor.id);
  assert.equal(edited.list[0].fee, 1200);
  const wrong = updateCustomVendor(edited.list, vendor.id, stand({ fee: -5 }));
  assert.match(wrong.problem, /pitch fee/);
  assert.equal(wrong.list, edited.list, 'a rejected edit changes nothing');
  assert.match(updateCustomVendor(list, 'c-ghost', stand()).problem, /no longer exists/);
});

test('deleting a stand removes it and frees its pitch, other vendors keep theirs', () => {
  const { list, vendor } = addCustomVendor([], stand());
  const placements = { [vendor.id]: 'P2', tacos: 'P1' };
  const result = deleteCustomVendor(list, placements, vendor.id);
  assert.deepEqual(result.list, []);
  assert.deepEqual(result.placements, { tacos: 'P1' });
  assert.deepEqual(placements, { [vendor.id]: 'P2', tacos: 'P1' }, 'the old object is not changed');
});

test('saved stands are read back; broken, doubled or tampered entries are dropped', () => {
  const { list } = addCustomVendor([], stand());
  assert.deepEqual(parseCustomVendors(JSON.stringify(list)), list);
  assert.deepEqual(parseCustomVendors('not json'), []);
  assert.deepEqual(parseCustomVendors('{"a":1}'), []);
  const tampered = [list[0], list[0], { ...list[0], id: 'tacos', name: 'Fake' }, { ...list[0], id: 'c-bad', name: 'Bad', fee: -1 },
    { ...list[0], id: 'c-x', name: 'X <img>', menu: [] }, null];
  assert.deepEqual(parseCustomVendors(JSON.stringify(tampered)).map((v) => v.id), ['c-doner-delight']);
  // Stored labels are recomputed from the menu, so a saved stand cannot claim more than it sells.
  const claims = [{ ...list[0], tags: ['vegan', 'alcohol'] , menu: [{ item: 'Döner wrap', price: 8.5, tags: [] }] }];
  assert.deepEqual(parseCustomVendors(JSON.stringify(claims))[0].tags, []);
});

// The rules read the own stands of the open festival from storage: pitches, pitch income and the
// visitor needs then include them, everywhere in the app (Vendors, Site map, Finances).
test('own stands from storage can be found, placed, paid for and count for the visitor needs', () => {
  const { list, vendor } = addCustomVendor([], stand({ name: 'Vegan Corner', menu: [{ item: 'Vegan bowl', price: 9, tags: ['vegan'] }], fee: 777 }));
  const storage = new Map([[CUSTOM_VENDORS_KEY, JSON.stringify(list)]]);
  const context = vm.createContext({ console, JSON, Math, Number, String, Array, Set, Object,
    localStorage: { getItem: (key) => storage.get(key) ?? null } });
  vm.runInContext(fs.readFileSync(path.join(root, 'rules/vendor-rules.js'), 'utf8'), context);
  const run = (code) => vm.runInContext(code, context);
  assert.equal(run(`findVendor('${vendor.id}').name`), 'Vegan Corner');
  assert.equal(run(`allVendors()[0].id`), vendor.id, 'own stands are listed first');
  run(`var placed = confirmVendor({}, '${vendor.id}', 6)`);
  assert.equal(run('placed.problem'), null);
  assert.equal(run(`placed.placements['${vendor.id}']`), 'P1');
  assert.equal(run('pitchIncome(placed.placements)'), 777);
  assert.equal(run('coverage(placed.placements).checks[0].ok'), true, 'a vegan option');
  assert.equal(run(`JSON.stringify(parsePlacements(JSON.stringify({ '${vendor.id}': 'P3' })))`), JSON.stringify({ [vendor.id]: 'P3' }));
  // Deleted from storage: the stand is gone and a saved pitch for it is dropped.
  storage.delete(CUSTOM_VENDORS_KEY);
  assert.equal(run(`findVendor('${vendor.id}')`), null);
  assert.equal(run(`JSON.stringify(parsePlacements(JSON.stringify({ '${vendor.id}': 'P3' })))`), '{}');
});

// ---------- the Vendors page with a tiny fake page ----------

function page(role, initial = {}, typed = null) {
  const nodes = new Map(), writes = [], notices = [];
  const storage = new Map(Object.entries(initial));
  function node(selector) {
    if (nodes.has(selector)) return nodes.get(selector);
    const handlers = new Map();
    const element = {
      value: '', innerHTML: '', textContent: '', dataset: {}, style: {}, hidden: false, disabled: false, opened: false,
      classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
      addEventListener(name, fn) { if (!handlers.has(name)) handlers.set(name, []); handlers.get(name).push(fn); },
      fire(name, event = {}) { (handlers.get(name) || []).forEach((fn) => fn(event)); },
      click() { this.fire('click'); },
      showModal() { this.opened = true; }, close() { this.opened = false; },
      querySelector: node, querySelectorAll() { return []; }, focus() {}
    };
    nodes.set(selector, element);
    return element;
  }
  // The menu rows the person typed in the form.
  if (typed) node('#vendor-menu-rows').querySelectorAll = () => typed.map((row) => ({
    querySelector: (s) => ({ value: s === '[data-mitem]' ? row.item : row.price }),
    querySelectorAll: () => row.tags.map((tag) => ({ checked: true, dataset: { mtag: tag } }))
  }));
  const nav = node('vendor-navigation'); nav.dataset.section = 'Vendors';
  const context = vm.createContext({ console, Intl, Date, Set, Number, String, Array, JSON, Math, Object,
    window: { festivalAccess: { role }, addEventListener() {}, openSiteMapAt() {} },
    document: { querySelector: node, querySelectorAll: (s) => (s === '.sidebar-item' ? [nav] : []), activeElement: null },
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem(key, value) { writes.push(key); storage.set(key, value); } },
    toast: (message) => notices.push(message) });
  for (const file of ['rules/access-rules.js', 'rules/capacity-rules.js', 'rules/vendor-rules.js', 'vendors/vendors-page.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  const click = (dataset) => node('#vendors-view').fire('click', { target: { closest: (s) => (s === 'button' ? { dataset } : null) } });
  const fill = (values) => Object.entries(values).forEach(([id, value]) => { node(`#vendor-${id}`).value = value; });
  const submit = () => node('#vendor-form').fire('submit', { preventDefault() {} });
  const dialogClick = (button) => node('#vendor-dialog').fire('click', { target: { closest: () => ({ dataset: {}, ...button }) } });
  return { node, storage, writes, notices, click, fill, submit, dialogClick };
}

const typedStand = { name: 'Döner Delight', category: 'Food', cuisine: 'Kebab', fee: '950', text: 'Kebab wraps.', photo: 'Doner kebab' };
const typedMenu = [{ item: 'Döner wrap', price: '8.50', tags: [] }, { item: 'Falafel wrap', price: '7.50', tags: ['vegan'] }];

test('the Vendors page has an "Add vendor" button; Admin and Editor can add a stand with its menu', () => {
  for (const role of ['Admin', 'Editor']) {
    const ui = page(role, {}, typedMenu);
    assert.match(ui.node('#vendors-view').innerHTML, /data-vadd >\+ Add vendor/);
    ui.click({ vadd: '' });
    assert.equal(ui.node('#vendor-dialog').opened, true);
    ui.fill(typedStand);
    ui.submit();
    const saved = JSON.parse(ui.storage.get(CUSTOM_VENDORS_KEY));
    assert.equal(saved.length, 1, role);
    assert.equal(saved[0].name, 'Döner Delight');
    assert.equal(saved[0].fee, 950);
    assert.deepEqual(saved[0].menu.map((m) => [m.item, m.price]), [['Döner wrap', 8.5], ['Falafel wrap', 7.5]]);
    assert.equal(ui.node('#vendor-dialog').opened, false);
    assert.match(ui.node('#vendors-view').innerHTML, /Your stand/);
    assert.match(ui.notices.at(-1), /added/);
  }
});

test('a wrong form shows the reason in the form, keeps it open and saves nothing', () => {
  const ui = page('Admin', {}, [{ item: 'Döner wrap', price: '0', tags: [] }]);
  ui.click({ vadd: '' });
  ui.fill(typedStand);
  ui.submit();
  assert.match(ui.node('#vendor-message').textContent, /price above €0/);
  assert.equal(ui.node('#vendor-dialog').opened, true);
  assert.deepEqual(ui.writes, []);
});

test('Viewer sees the button disabled and cannot add, edit or delete own stands, even by direct calls', () => {
  const { list, vendor } = addCustomVendor([], stand());
  const ui = page('Viewer', { [CUSTOM_VENDORS_KEY]: JSON.stringify(list) }, typedMenu);
  assert.match(ui.node('#vendors-view').innerHTML, /data-vadd disabled/);
  assert.match(ui.node('#vendors-view').innerHTML, new RegExp(`data-vedit="${vendor.id}" disabled`));
  ui.click({ vadd: '' });
  ui.click({ vedit: vendor.id });
  assert.equal(ui.node('#vendor-dialog').opened, false);
  ui.fill(typedStand);
  ui.submit();
  assert.deepEqual(ui.writes, []);
  assert.equal(ui.notices.length, 2);
});

test('editing an own stand keeps its pitch; deleting needs a second click and frees the pitch', () => {
  const { list, vendor } = addCustomVendor([], stand());
  const ui = page('Admin', { [CUSTOM_VENDORS_KEY]: JSON.stringify(list), [VENDOR_STORAGE_KEY]: JSON.stringify({ [vendor.id]: 'P2' }), 'festival-architect-ground': '{"visitors":5000}' }, typedMenu);
  ui.click({ vedit: vendor.id });
  assert.equal(ui.node('#vendor-name').value, 'Döner Delight');
  ui.fill({ ...typedStand, fee: '1100' });
  ui.submit();
  assert.equal(JSON.parse(ui.storage.get(CUSTOM_VENDORS_KEY))[0].fee, 1100);
  assert.equal(JSON.parse(ui.storage.get(VENDOR_STORAGE_KEY))[vendor.id], 'P2');
  ui.click({ vedit: vendor.id });
  ui.dialogClick({ id: 'vendor-delete' });
  assert.equal(JSON.parse(ui.storage.get(CUSTOM_VENDORS_KEY)).length, 1, 'the first click only asks');
  assert.match(ui.node('#vendor-message').textContent, /cannot be undone/);
  ui.dialogClick({ id: 'vendor-delete' });
  assert.deepEqual(JSON.parse(ui.storage.get(CUSTOM_VENDORS_KEY)), []);
  assert.deepEqual(JSON.parse(ui.storage.get(VENDOR_STORAGE_KEY)), {});
  assert.match(ui.notices.at(-1), /Pitch P2 is free again/);
});

test('a stand name that looks like HTML is shown as text, also inside a pitch message (no code injection)', () => {
  const name = '<img src=x onerror=alert(1)>';
  const { list, vendor } = addCustomVendor([], stand({ name }));
  const ui = page('Admin', { [CUSTOM_VENDORS_KEY]: JSON.stringify(list), [VENDOR_STORAGE_KEY]: JSON.stringify({ [vendor.id]: 'P2' }), 'festival-architect-ground': '{"visitors":5000}' }, typedMenu);
  ui.click({ confirm: vendor.id }); // already on P2 → "<name> is already on pitch P2."
  const html = ui.node('#vendors-view').innerHTML;
  assert.match(html, /already on pitch P2/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});
