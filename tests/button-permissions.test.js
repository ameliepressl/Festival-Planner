const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { VENDORS, VENDOR_STORAGE_KEY } = require('../rules/vendor-rules.js');

const root = path.join(__dirname, '..');

function screen(role, initial = {}) {
  const nodes = new Map(), writes = [], notices = [], mapped = [];
  const storage = new Map(Object.entries(initial));
  function node(selector) {
    if (nodes.has(selector)) return nodes.get(selector);
    const handlers = new Map();
    const element = {
      value: '', innerHTML: '', textContent: '', dataset: {}, style: {}, hidden: false, disabled: false,
      classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
      addEventListener(name, fn) { if (!handlers.has(name)) handlers.set(name, []); handlers.get(name).push(fn); },
      fire(name, event = {}) { (handlers.get(name) || []).forEach(fn => fn(event)); },
      click() { this.fire('click'); this.onclick?.(); },
      showModal() { this.opened = true; }, close() { this.opened = false; this.fire('close'); },
      querySelector: node, querySelectorAll() { return []; }, setAttribute() {}, removeAttribute() {},
      focus() {}, getBoundingClientRect() { return { left: 0, top: 0, bottom: 50, width: 200, height: 50 }; }
    };
    nodes.set(selector, element); return element;
  }
  const vendorNav = node('vendor-navigation'); vendorNav.dataset.section = 'Vendors';
  const signOut = node('#sign-out');
  const sidebar = [vendorNav, signOut];
  let reloads = 0;
  const context = vm.createContext({ console, Intl, Date, Set, Number, String, Array, JSON, Math,
    crypto: require('node:crypto').webcrypto, setTimeout() {},
    window: { festivalAccess: { role }, addEventListener() {}, scrollTo() {}, openSiteMapAt: pitch => mapped.push(pitch) },
    location: { reload() { reloads++; } },
    document: { querySelector: node, querySelectorAll: selector => selector === '.sidebar-item' ? sidebar : [] },
    localStorage: { getItem: key => storage.get(key) ?? null,
      setItem(key, value) { writes.push(key); storage.set(key, value); } },
    toast: message => notices.push(message)
  });
  const load = file => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  load('rules/access-rules.js');
  return { context, node, storage, writes, notices, mapped, vendorNav, signOut, load, reloads: () => reloads };
}

function vendors(role, placements = {}) {
  const ui = screen(role, { [VENDOR_STORAGE_KEY]: JSON.stringify(placements), 'festival-architect-ground': '{"visitors":500}' });
  for (const file of ['rules/capacity-rules.js', 'rules/vendor-rules.js', 'vendors/vendors-page.js']) ui.load(file);
  ui.action = dataset => ui.node('#vendors-view').fire('click', {
    target: { closest: selector => selector === 'button' ? { dataset } : null }
  });
  return ui;
}

test('Viewer cannot confirm or remove vendors, including direct handler calls, and can still filter or inspect the map', () => {
  const first = VENDORS[0], second = VENDORS[1];
  const ui = vendors('Viewer', { [first.id]: 'P1' });
  const before = ui.storage.get(VENDOR_STORAGE_KEY);
  ui.action({ confirm: second.id });
  ui.action({ remove: first.id });
  assert.equal(ui.storage.get(VENDOR_STORAGE_KEY), before);
  assert.deepEqual(ui.writes, []);
  assert.equal(ui.notices.length, 2);
  assert.match(ui.node('#vendors-view').innerHTML, new RegExp(`data-confirm="${second.id}" disabled`));
  assert.match(ui.node('#vendors-view').innerHTML, new RegExp(`data-remove="${first.id}" disabled`));
  ui.action({ filter: 'Food' });
  ui.action({ map: 'P1' });
  assert.deepEqual(ui.mapped, ['P1']);
  assert.deepEqual(ui.writes, []);
});

test('opening Vendors as Viewer never silently removes a vendor after the festival gets smaller', () => {
  const ui = vendors('Viewer', { [VENDORS[0].id]: 'P13' });
  const before = ui.storage.get(VENDOR_STORAGE_KEY);
  ui.vendorNav.click();
  assert.equal(ui.storage.get(VENDOR_STORAGE_KEY), before);
  assert.deepEqual(ui.writes, []);
});

test('Admin and Editor can confirm and remove vendors and save the fitted pitches', () => {
  for (const role of ['Admin', 'Editor']) {
    const id = VENDORS[0].id;
    const ui = vendors(role);
    ui.action({ confirm: id });
    assert.equal(JSON.parse(ui.storage.get(VENDOR_STORAGE_KEY))[id], 'P1');
    ui.action({ remove: id });
    assert.deepEqual(JSON.parse(ui.storage.get(VENDOR_STORAGE_KEY)), {});
    const smaller = vendors(role, { [id]: 'P13' });
    smaller.vendorNav.click();
    assert.deepEqual(JSON.parse(smaller.storage.get(VENDOR_STORAGE_KEY)), {});
    assert.equal(smaller.writes.length, 1);
  }
});

function demo(role) {
  const ui = screen(role, { 'festival-architect-finance': '{"ticketPrice":77}', 'festival-architect-v2': '{"original":true}' });
  Object.assign(ui.context, {
    STORAGE_KEY: 'festival-architect-v2', GROUND_STORAGE_KEY: 'festival-architect-ground',
    VENDOR_STORAGE_KEY, FINANCE_STORAGE_KEY: 'festival-architect-finance', SITE_MAPS_STORAGE_KEY: 'festival-architect-site-maps',
    DEFAULT_FINANCE: { ticketPrice: 30 }, demoFestival: () => ({ plan: { name: 'Demo' }, ground: { visitors: 500 }, vendors: [], finance: { ticketPrice: 35 } }),
    capacityNeeds: () => ({ pitches: 4 }), confirmVendor: () => ({ placements: {} }),
    parseSiteMaps: text => JSON.parse(text || '[]'), layoutItems: () => [], demoSite: () => ({ id: 'demo' })
  });
  ui.load('demo/demo-loader.js');
  return ui;
}

test('Editor and Viewer cannot open or apply the complete demo, preserving protected finance and all plan sections', () => {
  for (const role of ['Editor', 'Viewer']) {
    const ui = demo(role), before = [...ui.storage];
    assert.equal(ui.node('#load-demo').disabled, true);
    ui.node('#load-demo').click();
    assert.notEqual(ui.node('#demo-dialog').opened, true);
    ui.node('#demo-dialog').returnValue = 'load';
    ui.node('#demo-dialog').fire('close');
    assert.deepEqual([...ui.storage], before);
    assert.deepEqual(ui.writes, []);
    assert.equal(ui.reloads(), 0);
  }
});

test('Admin can load the demo, but cancelling or losing permission before confirmation changes nothing', () => {
  const ui = demo('Admin');
  assert.equal(ui.node('#load-demo').disabled, false);
  ui.node('#load-demo').click();
  assert.equal(ui.node('#demo-dialog').opened, true);
  ui.node('#demo-dialog').returnValue = 'cancel'; ui.node('#demo-dialog').fire('close');
  assert.equal(ui.writes.length, 0);
  ui.context.window.festivalAccess.role = 'Editor';
  ui.node('#demo-dialog').returnValue = 'load'; ui.node('#demo-dialog').fire('close');
  assert.equal(ui.writes.length, 0);
  assert.equal(ui.reloads(), 0);
  ui.context.window.festivalAccess.role = 'Admin';
  ui.node('#demo-dialog').fire('close');
  assert.equal(JSON.parse(ui.storage.get('festival-architect-finance')).ticketPrice, 35);
  assert.equal(ui.writes.length, 6);
  assert.equal(ui.reloads(), 1);
});

test('Sign out reaches its account handler without a placeholder navigation message', () => {
  const ui = screen('Admin', { 'festival-architect-v2': JSON.stringify({
    event: { name: 'Button test', startDate: '2030-06-01', endDate: '2030-06-02', startMinutes: 840, endMinutes: 1380 },
    bookings: [], settings: { stages: 2, budget: 10000 }, final: false
  }) });
  for (const file of ['rules/festival-rules.js', 'app.js', 'overview.js']) ui.load(file);
  let signedOut = false; ui.signOut.onclick = () => { signedOut = true; };
  ui.signOut.click();
  assert.equal(signedOut, true);
  assert.equal(ui.node('#toast').textContent, '');
  ui.vendorNav.click();
  assert.equal(ui.node('#vendors-view').hidden, false, 'regular navigation remains available');
});
