// Several festivals per account (feature-plans/several-festivals.md):
// how many own festivals, which one may be deleted, which one opens afterwards,
// and the demo opening as a new festival instead of replacing the open one.
// Run with:  uvx --from nodejs-wheel node --test

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
  MAX_OWN_FESTIVALS, ownFestivals, canCreateFestival, canDeleteFestival, festivalAfterDelete,
  accountErrorMessage, cleanFestivalData
} = require('../rules/account-rules.js');

const ME = '0b6f3a52-9c1e-4b7a-8f43-2d5e6c7b8a91';
const KIRA = 'f2c4e6a8-1b3d-4f5a-9c7e-8d6b4a2c0e1f';
const fid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (n, owner, updatedAt, extra = {}) => ({ festival_id: fid(n), owner_id: owner, updated_at: updatedAt, ...extra });

test('an account may own up to 20 festivals; shared festivals do not count', () => {
  const own = Array.from({ length: MAX_OWN_FESTIVALS - 1 }, (_, i) => row(i + 1, ME, '2026-11-01'));
  const shared = row(99, KIRA, '2026-11-02', { my_role: 'Editor' });
  assert.equal(MAX_OWN_FESTIVALS, 20);
  assert.equal(ownFestivals([...own, shared], ME).length, 19);
  assert.equal(canCreateFestival([...own, shared], ME), true);
  assert.equal(canCreateFestival([...own, row(50, ME, '2026-11-03'), shared], ME), false);
  assert.equal(canCreateFestival([], ME), true);
  assert.equal(canCreateFestival(null, ME), true);
});

test('only the creator deletes a festival, and never their last own one', () => {
  const mine = row(1, ME, '2026-11-01');
  const demo = row(2, ME, '2026-11-20');
  const kiras = row(3, KIRA, '2026-11-21', { my_role: 'Admin' });
  assert.equal(canDeleteFestival([mine, kiras], ME, mine.festival_id), false, 'last own festival stays');
  assert.equal(canDeleteFestival([mine, demo, kiras], ME, demo.festival_id), true);
  assert.equal(canDeleteFestival([mine, demo, kiras], ME, mine.festival_id), true);
  assert.equal(canDeleteFestival([mine, demo, kiras], ME, kiras.festival_id), false, 'even an Admin of a shared festival cannot delete it');
  assert.equal(canDeleteFestival([mine, demo], ME, fid(77)), false, 'unknown festival');
});

test('after deleting, the most recently changed other own festival opens', () => {
  const old = row(1, ME, '2026-10-01T10:00:00Z');
  const recent = row(2, ME, '2026-11-20T10:00:00Z');
  const demo = row(3, ME, '2026-11-21T10:00:00Z');
  const kiras = row(4, KIRA, '2026-11-21T12:00:00Z');
  assert.equal(festivalAfterDelete([old, recent, demo, kiras], ME, demo.festival_id).festival_id, recent.festival_id);
  assert.equal(festivalAfterDelete([old, kiras], ME, old.festival_id).festival_id, kiras.festival_id, 'only a shared one left');
  assert.equal(festivalAfterDelete([old], ME, old.festival_id), null);
});

test('clear messages when the database update is missing or the limit is reached', () => {
  assert.match(accountErrorMessage({ code: '23505', message: 'duplicate key value violates unique constraint "festivals_one_per_account"' }),
    /migrations\/005_several_festivals\.sql/);
  assert.match(accountErrorMessage({ code: '54000', message: 'An account can have at most 20 festivals.' }), /already have 20 festivals/);
});

// --- The demo button with accounts: opens a new festival -------------------------------

function demoScreen({ role = 'Viewer', openNewFestival, rules = 'stubs' } = {}) {
  const nodes = new Map();
  const storage = new Map([['festival-architect-v2', '{"original":true}'], ['festival-architect-finance', '{"ticketPrice":77}']]);
  const writes = [];
  const toasts = [];
  const calls = [];
  let reloads = 0;
  function node(selector) {
    if (nodes.has(selector)) return nodes.get(selector);
    const handlers = new Map();
    const element = {
      disabled: false, title: '', returnValue: '', opened: false,
      addEventListener(name, fn) { if (!handlers.has(name)) handlers.set(name, []); handlers.get(name).push(fn); },
      fire(name) { (handlers.get(name) || []).forEach((fn) => fn({})); },
      click() { this.fire('click'); },
      showModal() { this.opened = true; }
    };
    nodes.set(selector, element);
    return element;
  }
  const window = {
    festivalAccess: { role },
    getSavedGanttPlan: () => 'saved plan of the open festival',
    getDefaultGanttPlan: () => 'default plan of a new festival'
  };
  if (openNewFestival) {
    window.openNewFestival = (sections) => { calls.push(sections); return openNewFestival(sections); };
  }
  const context = vm.createContext({
    console, JSON, Math, Object, Array, Number, String, Set, Map, Promise, Error, Date, Intl, window,
    location: { reload() { reloads += 1; } },
    document: { querySelector: node },
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem(key, value) { writes.push(key); storage.set(key, String(value)); } },
    toast: (message) => toasts.push(message)
  });
  const load = (file) => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  load('rules/access-rules.js');
  if (rules === 'stubs') {
    Object.assign(context, {
      STORAGE_KEY: 'festival-architect-v2', GROUND_STORAGE_KEY: 'festival-architect-ground',
      VENDOR_STORAGE_KEY: 'festival-architect-vendors', FINANCE_STORAGE_KEY: 'festival-architect-finance',
      SITE_MAPS_STORAGE_KEY: 'festival-architect-site-maps', PROJECT_STATUS_KEY: 'festival-work-board-status-v1',
      DEFAULT_FINANCE: { ticketPrice: 30 },
      demoFestival: () => ({ plan: { name: 'Lisbon' }, ground: { visitors: 500 }, vendors: [], finance: { ticketPrice: 35 } }),
      munichDemoFestival: () => ({ plan: { name: 'Munich', settings: { stages: 3 } }, ground: { visitors: 20000 }, vendors: [], finance: {} }),
      munichTaskStatuses: (plan) => ({ from: plan }),
      capacityNeeds: () => ({ pitches: 4 }), confirmVendor: () => ({ placements: {} }),
      parseSiteMaps: (text) => JSON.parse(text || '[]'), layoutItems: () => [], demoSite: () => ({ id: 'demo' })
    });
  } else {
    // The real rules, so the demo is built exactly as in the browser.
    context.ARTIST_LIBRARY = undefined;
    context.STORAGE_KEY = 'festival-architect-v2';   // defined by app.js in the browser
    ['rules/festival-rules.js', 'rules/capacity-rules.js', 'rules/vendor-rules.js', 'rules/site-map-rules.js', 'rules/crowd-rules.js',
      'rules/finance-rules.js', 'rules/project-rules.js', 'rules/artist-library.js', 'rules/demo-festival.js'].forEach(load);
  }
  load('demo/demo-loader.js');
  const choose = (value) => { node('#demo-dialog').returnValue = value; node('#demo-dialog').fire('close'); };
  return { node, storage, writes, toasts, calls, choose, reloads: () => reloads };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test('signed in, every role may open the demo, and it becomes a new festival: the open one is not touched', async () => {
  for (const role of ['Viewer', 'Editor', 'Admin']) {
    const ui = demoScreen({ role, openNewFestival: async () => true });
    assert.equal(ui.node('#load-demo').disabled, false, role);
    ui.node('#load-demo').click();
    assert.equal(ui.node('#demo-dialog').opened, true);
    ui.choose('load');
    await settle();
    assert.equal(ui.calls.length, 1);
    assert.equal(JSON.parse(ui.calls[0]['festival-architect-v2']).name, 'Lisbon');
    assert.equal(JSON.parse(ui.calls[0]['festival-architect-finance']).ticketPrice, 35);
    assert.deepEqual(ui.writes, [], 'nothing written into the festival that is open');
    assert.equal(ui.storage.get('festival-architect-finance'), '{"ticketPrice":77}');
    assert.equal(ui.reloads(), 0, 'account.js opens the new festival itself');
  }
});

test('cancelling the demo dialog creates nothing', async () => {
  const ui = demoScreen({ openNewFestival: async () => true });
  ui.choose('cancel');
  ui.choose('');
  await settle();
  assert.equal(ui.calls.length, 0);
});

test('the Munich demo marks the tasks of a new festival, not the Gantt plan of the open festival', async () => {
  const ui = demoScreen({ openNewFestival: async () => true });
  ui.choose('load-munich');
  await settle();
  assert.deepEqual(JSON.parse(ui.calls[0]['festival-work-board-status-v1']), { from: 'default plan of a new festival' });
  assert.equal(JSON.parse(ui.calls[0]['festival-architect-site-maps']).length, 1, 'only the demo map, no maps of the open festival');
});

test('when the new festival cannot be created, the reason is shown and the button works again', async () => {
  const ui = demoScreen({ openNewFestival: async () => { throw new Error('You already have 20 festivals.'); } });
  ui.choose('load');
  assert.equal(ui.node('#load-demo').disabled, true, 'no second click while creating');
  await settle();
  assert.deepEqual(ui.toasts, ['You already have 20 festivals.']);
  assert.equal(ui.node('#load-demo').disabled, false);
  assert.deepEqual(ui.writes, []);
});

test('with the real rules, both demos consist only of sections that are saved to the account', async () => {
  for (const which of ['load', 'load-munich']) {
    const ui = demoScreen({ openNewFestival: async () => true, rules: 'real' });
    ui.choose(which);
    await settle();
    assert.equal(ui.toasts.length, 0, ui.toasts.join());
    const sections = JSON.parse(JSON.stringify(ui.calls[0]));   // out of the test's sandbox (other Object prototype)
    assert.ok(Object.keys(sections).length >= 6);
    assert.deepEqual(cleanFestivalData(sections), sections, 'every key starts with festival- and holds text');
    const plan = JSON.parse(sections['festival-architect-v2']);
    assert.match(plan.event.name, which === 'load' ? /Lisbon/ : /Munich/);
  }
});
