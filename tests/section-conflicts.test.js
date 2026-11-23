// Two people changing the same section (feature-plans/section-conflicts.md).
// Part 1: the pure rules. Part 2: the real account coordinator (account/account.js) with a fake
// browser storage and a fake database that behaves like migration 007 (the SQL itself was run
// against a real Postgres, see the plan). Part 3: the two-browser test, step by step.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
  ACCOUNT_META_KEY, parseAccountMeta, sectionsToSave, captureSaveBatch, acknowledgeSaveBatch,
  cleanVersions, expectedVersions, applySaveResult, keepMine, hasUnheldChanges, conflictMessage
} = require('../rules/account-rules.js');

const ROOT = path.join(__dirname, '..');
const USER = '11111111-1111-4111-8111-111111111111';
const FESTIVAL = '22222222-2222-4222-8222-222222222222';
const FINANCE = 'festival-architect-finance';
const VENDORS = 'festival-architect-vendors';
const CHECKLIST = 'festival-architect-checklist';
const clone = value => JSON.parse(JSON.stringify(value));
const settle = () => new Promise(resolve => setImmediate(resolve));

// --- Part 1: the rules ---------------------------------------------------------------------

test('only whole, non-negative version numbers of festival sections are kept', () => {
  assert.deepEqual(cleanVersions({ [FINANCE]: 3, [VENDORS]: 0, 'festival-architect-team-v1': 2, other: 1, [CHECKLIST]: -1, 'festival-x': 1.5 }),
    { [FINANCE]: 3, [VENDORS]: 0 });
  assert.equal(cleanVersions(null), undefined);
  assert.equal(cleanVersions([1, 2]), undefined);
  assert.equal(cleanVersions('3'), undefined);
});

test('the saved browser state keeps its versions and its unresolved conflicts', () => {
  const text = JSON.stringify({ userId: USER, festivalId: FESTIVAL, syncedAt: 't1', dirtyKeys: [FINANCE],
    versions: { [FINANCE]: 2 }, conflicts: { [FINANCE]: 3 } });
  const meta = parseAccountMeta(text);
  assert.deepEqual(meta.versions, { [FINANCE]: 2 });
  assert.deepEqual(meta.conflicts, { [FINANCE]: 3 });
  const plain = parseAccountMeta(JSON.stringify({ userId: USER, festivalId: FESTIVAL, syncedAt: 't1', dirtyKeys: [] }));
  assert.equal('versions' in plain, false, 'a browser from before versions has none');
  assert.equal('conflicts' in plain, false);
});

test('a save starts from the versions the browser has seen, and is not checked without any', () => {
  assert.deepEqual(expectedVersions({ [FINANCE]: 2 }, [FINANCE, VENDORS]), { [FINANCE]: 2, [VENDORS]: 0 });
  assert.equal(expectedVersions(undefined, [FINANCE]), null);
});

test('saved sections move to their new version; refused ones are held with the teammate\'s version', () => {
  const batch = { keys: [FINANCE, VENDORS] };
  const outcome = applySaveResult({ versions: { [FINANCE]: 1, [VENDORS]: 1 }, conflicts: {} }, batch,
    { versions: { [FINANCE]: 2, [VENDORS]: 2 }, conflicts: [FINANCE] });
  assert.deepEqual(outcome.versions, { [FINANCE]: 1, [VENDORS]: 2 });
  assert.deepEqual(outcome.conflicts, { [FINANCE]: 2 });
  assert.deepEqual(outcome.saved, [VENDORS]);
  assert.deepEqual(outcome.refused, [FINANCE]);
});

test('a later successful save of a held section releases it', () => {
  const outcome = applySaveResult({ versions: { [FINANCE]: 2 }, conflicts: { [FINANCE]: 2 } }, { keys: [FINANCE] },
    { versions: { [FINANCE]: 3 }, conflicts: [] });
  assert.deepEqual(outcome.conflicts, {});
  assert.deepEqual(outcome.versions, { [FINANCE]: 3 });
});

test('an older database (no versions in its answer) changes nothing', () => {
  const outcome = applySaveResult({ versions: undefined, conflicts: undefined }, { keys: [FINANCE] }, { saved_at: 't1', previous_saved_at: 't0' });
  assert.equal(outcome.versions, undefined);
  assert.deepEqual(outcome.saved, [FINANCE]);
  assert.deepEqual(outcome.refused, []);
});

test('Keep mine starts the held sections from the teammate\'s version', () => {
  assert.deepEqual(keepMine({ versions: { [FINANCE]: 1, [VENDORS]: 4 }, conflicts: { [FINANCE]: 2 } }),
    { versions: { [FINANCE]: 2, [VENDORS]: 4 }, conflicts: {}, keys: [FINANCE] });
});

test('held sections are never sent again, but their edit stays pending', () => {
  const values = { [FINANCE]: '{"mine":1}', [VENDORS]: '{"v":1}' };
  const storage = { getItem: key => values[key] ?? null, key: i => Object.keys(values)[i], length: 2 };
  const sections = sectionsToSave({ storage, dirtyKeys: [FINANCE, VENDORS], role: 'Admin', held: [FINANCE] });
  assert.deepEqual(sections.changes, { [VENDORS]: '{"v":1}' });
  const everything = sectionsToSave({ storage, dirtyKeys: ['*'], role: 'Admin', held: [FINANCE] });
  assert.deepEqual(Object.keys(everything.changes), [VENDORS]);
  const batch = captureSaveBatch({ storage, dirtyKeys: [FINANCE, VENDORS], role: 'Admin', userId: USER, festivalId: FESTIVAL, held: [FINANCE] });
  assert.deepEqual(acknowledgeSaveBatch({ batch, userId: USER, festivalId: FESTIVAL, dirtyKeys: [FINANCE, VENDORS] }), [FINANCE]);
  assert.equal(hasUnheldChanges([FINANCE], { [FINANCE]: 2 }), false);
  assert.equal(hasUnheldChanges([FINANCE, VENDORS], { [FINANCE]: 2 }), true);
  assert.equal(hasUnheldChanges(['*'], { [FINANCE]: 2 }), true);
  assert.equal(hasUnheldChanges([], undefined), false);
});

test('the conflict message names the section and both choices', () => {
  const one = conflictMessage([FINANCE]);
  assert.match(one, /Not saved/); assert.match(one, /the finances/); assert.match(one, /Keep mine/); assert.match(one, /Use theirs/);
  assert.match(conflictMessage([FINANCE, VENDORS]), /the finances and the vendors/);
  assert.match(conflictMessage(['festival-architect-site-maps', 'festival-architect-ground']), /the site map\b(?! and)/, 'one name once');
  assert.match(conflictMessage(['festival-something-new']), /a part of the plan/);
});

// --- Part 2: the real coordinator -----------------------------------------------------------

// A database that behaves like migration 007: a version per section, refusal of stale sections.
function fakeDatabase(initialData = {}, withVersions = true) {
  const db = { data: clone(initialData), versions: {}, updatedAt: 0, withVersions, calls: [] };
  db.row = () => ({ id: FESTIVAL, owner_id: USER, data: clone(db.data), updated_at: 't' + db.updatedAt, ...(db.withVersions ? { section_versions: clone(db.versions) } : {}) });
  db.save = (args) => {
    db.calls.push(clone(args));
    if (db.offline) return { data: null, error: { message: 'offline' } };
    const before = 't' + db.updatedAt;
    const keys = [...Object.keys(args.changes), ...args.removed];
    const clash = args.expected ? keys.filter(key => (db.versions[key] || 0) !== (args.expected[key] || 0)).sort() : [];
    const changes = Object.fromEntries(Object.entries(args.changes).filter(([key]) => !clash.includes(key)));
    const removed = args.removed.filter(key => !clash.includes(key));
    if (Object.keys(changes).length || removed.length) {
      for (const key of removed) delete db.data[key];
      for (const [key, value] of Object.entries(changes)) db.data[key] = value;
      for (const key of [...Object.keys(changes), ...removed]) db.versions[key] = (db.versions[key] || 0) + 1;
      db.updatedAt++;
    }
    return { data: { saved_at: 't' + db.updatedAt, previous_saved_at: before, ...(db.withVersions ? { versions: clone(db.versions), conflicts: clash } : {}) }, error: null };
  };
  // What another browser does: it saves a section, so the version of that section moves on.
  db.teammateSaves = (key, value) => { db.data[key] = value; db.versions[key] = (db.versions[key] || 0) + 1; db.updatedAt++; };
  return db;
}

function accountScreen({ database = fakeDatabase(), seed = {}, versions = { ...database.versions } } = {}) {
  const values = new Map(Object.entries(seed));
  class FakeStorage {
    get length() { return values.size; }
    key(i) { return [...values.keys()][i] ?? null; }
    getItem(key) { return values.get(String(key)) ?? null; }
    setItem(key, value) { values.set(String(key), String(value)); }
    removeItem(key) { values.delete(String(key)); }
  }
  const storage = new FakeStorage(), nodes = new Map(), timers = new Map();
  let nextTimer = 0, reloads = 0, signedOut = 0, withoutVersionsColumn = false;
  function node(selector) {
    if (!nodes.has(selector)) nodes.set(selector, { hidden: true, textContent: '', value: '', disabled: false, inert: false, dataset: {},
      classList: { add() {}, remove() {}, contains() { return false; } }, setAttribute() {}, append() {}, addEventListener() {}, querySelector: node, selectedOptions: [] });
    return nodes.get(selector);
  }
  function query() {
    const filters = {}, request = {};
    const builder = { select(columns) { request.columns = columns; return builder; }, eq(key, value) { filters[key] = value; return builder; },
      single() { return execute(); }, maybeSingle() { return execute(); }, then(resolve, reject) { return execute().then(resolve, reject); } };
    async function execute() {
      if (withoutVersionsColumn && /section_versions/.test(request.columns || '')) return { error: { code: '42703', message: 'column festivals.section_versions does not exist' } };
      const row = database.row();
      if (withoutVersionsColumn) delete row.section_versions;
      return { data: row, error: null };
    }
    return builder;
  }
  const client = {
    auth: { onAuthStateChange() {}, async signOut() { signedOut++; return {}; },
      async getSession() { return { data: { session: { user: { id: USER, user_metadata: { username: 'Owner' } } } } }; } }, from: query,
    rpc(name, args) {
      if (name === 'save_festival_changes') return { single: async () => database.save(clone(args)) };
      if (name === 'my_festivals') return Promise.resolve({ data: [{ festival_id: FESTIVAL, owner_id: USER, owner_username: 'Owner', my_role: 'Owner', updated_at: 't' + database.updatedAt }], error: null });
      return Promise.resolve({ data: [], error: null });
    }
  };
  const window = { localStorage: storage, FESTIVAL_SUPABASE: { url: 'https://isolated.invalid', publishableKey: 'public-placeholder-for-isolated-tests' },
    supabase: { createClient: () => client }, location: { reload() { reloads++; } }, dispatchEvent() {}, addEventListener() {} };
  const session = new Map();
  const context = vm.createContext({ window, Storage: FakeStorage,
    document: { documentElement: { classList: { add() {}, remove() {}, contains() { return false; } } }, querySelector: node, querySelectorAll() { return []; }, addEventListener() {}, createElement: () => node('option') },
    sessionStorage: { getItem: key => session.get(key) ?? null, setItem: (key, value) => session.set(key, value), removeItem: key => session.delete(key) },
    Event: class { constructor(type) { this.type = type; } },
    setTimeout(fn, delay) { timers.set(++nextTimer, { fn, delay }); return nextTimer; }, clearTimeout(id) { timers.delete(id); },
    setInterval() { return 1; }, clearInterval() {}, TextEncoder, console });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'rules/account-rules.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'rules/finance-rules.js'), 'utf8'), context);
  const source = fs.readFileSync(path.join(ROOT, 'account/account.js'), 'utf8');
  const hook = `window.accountTest = {
    start, saveNow, readyToLeave, signOut, keepMyVersion, useTheirVersion, showConflictNotice, showNotice,
    initialize(versions) {
      ready = false; currentUser = { id: '${USER}', username: 'Owner' }; access = OWNER_ACCESS;
      const stored = readMeta();
      meta = stored && stored.festivalId ? stored : { userId: currentUser.id, festivalId: '${FESTIVAL}', syncedAt: 't0', dirtyKeys: [], dirty: false, legacy: false, access: OWNER_ACCESS, ...(versions ? { versions } : {}) };
      festivals = [{ festival_id: '${FESTIVAL}', owner_id: currentUser.id, my_role: 'Owner', updated_at: 't0' }];
      writeMeta(); ready = true;
    },
    resetForStartup() { ready = false; staleContext = false; contextTransition = false; currentUser = null; meta = readMeta(); },
    state: () => JSON.parse(JSON.stringify({ meta, staleContext, contextTransition, ready }))
  };}());`;
  vm.runInContext(source.replace(/\}\(\)\);\s*$/, hook), context, { filename: 'account/account.js' });
  window.accountTest.initialize(database.withVersions ? versions : undefined);
  // the state is copied out of the VM, so that it can be compared with plain objects
  const api = Object.assign({}, window.accountTest, { state: () => clone(window.accountTest.state()) });
  return { storage, values, node, api, database, reloads: () => reloads, signedOut: () => signedOut,
    status: () => node('#account-sync-status').dataset.state, notice: () => ({ text: node('#account-notice-text').textContent, shown: !node('#account-notice').hidden,
      keep: !node('#account-notice-keep').hidden, theirs: !node('#account-notice-theirs').hidden }),
    withoutVersionsColumn() { withoutVersionsColumn = true; } };
}

test('a save carries the versions the browser started from and remembers the new ones', async () => {
  const database = fakeDatabase({ [FINANCE]: '{"sponsor":1}' }); database.versions[FINANCE] = 1;
  const ui = accountScreen({ database });
  ui.storage.setItem(FINANCE, '{"sponsor":2}');
  assert.equal(await ui.api.saveNow(), true);
  assert.deepEqual(database.calls[0].expected, { [FINANCE]: 1 });
  assert.deepEqual(ui.api.state().meta.versions, { [FINANCE]: 2 });
  assert.equal(ui.api.state().meta.dirty, false);
  assert.equal(ui.status(), 'saved');
});

test('a section a teammate saved first is refused: the edit stays, nothing is sent again, a clear choice is shown', async () => {
  const database = fakeDatabase({ [FINANCE]: '{"sponsor":1}' }); database.versions[FINANCE] = 1;
  const ui = accountScreen({ database });
  database.teammateSaves(FINANCE, '{"sponsor":9}');                // the other browser saved the finances
  ui.storage.setItem(FINANCE, '{"sponsor":1,"margin":40}');         // this browser (stale) edits another field
  await ui.api.saveNow();
  assert.equal(database.data[FINANCE], '{"sponsor":9}', 'the teammate\'s version was not overwritten');
  assert.equal(ui.storage.getItem(FINANCE), '{"sponsor":1,"margin":40}', 'the person\'s edit is still in this browser');
  const { meta } = ui.api.state();
  assert.deepEqual(meta.conflicts, { [FINANCE]: 2 });
  assert.deepEqual(meta.dirtyKeys, [FINANCE], 'still waiting to be saved');
  assert.equal(ui.status(), 'conflict');
  const notice = ui.notice();
  assert.ok(notice.shown && notice.keep && notice.theirs);
  assert.match(notice.text, /Not saved/); assert.match(notice.text, /the finances/);
  const requests = database.calls.length;
  assert.equal(await ui.api.saveNow(), true, 'nothing left that can be saved');
  assert.equal(database.calls.length, requests, 'the held section is not sent again and again');
});

test('sections that did not clash are saved, even in the same save as one that did', async () => {
  const database = fakeDatabase({ [FINANCE]: '{"a":1}', [VENDORS]: '{"v":1}' }); database.versions[FINANCE] = 1; database.versions[VENDORS] = 1;
  const ui = accountScreen({ database });
  database.teammateSaves(FINANCE, '{"a":2}');
  ui.storage.setItem(FINANCE, '{"a":1,"mine":true}'); ui.storage.setItem(VENDORS, '{"v":2}');
  await ui.api.saveNow();
  assert.equal(database.data[VENDORS], '{"v":2}', 'the vendors were saved');
  assert.equal(database.data[FINANCE], '{"a":2}');
  const { meta } = ui.api.state();
  assert.deepEqual(meta.dirtyKeys, [FINANCE]);
  assert.equal(meta.versions[VENDORS], 2);
});

test('Keep mine replaces the teammate\'s version with the person\'s, and the conflict is gone', async () => {
  const database = fakeDatabase({ [FINANCE]: '{"a":1}' }); database.versions[FINANCE] = 1;
  const ui = accountScreen({ database });
  database.teammateSaves(FINANCE, '{"a":2}');
  ui.storage.setItem(FINANCE, '{"a":1,"mine":true}');
  await ui.api.saveNow();
  ui.api.keepMyVersion(); await settle();
  assert.equal(database.data[FINANCE], '{"a":1,"mine":true}');
  const { meta } = ui.api.state();
  assert.equal(meta.conflicts, undefined); assert.equal(meta.dirty, false);
  assert.deepEqual(database.calls.at(-1).expected, { [FINANCE]: 2 }, 'it started from the teammate\'s version');
  assert.equal(ui.status(), 'saved');
});

test('Use theirs loads the saved festival and drops only the held edit', async () => {
  const database = fakeDatabase({ [FINANCE]: '{"a":1}', [VENDORS]: '{"v":1}' }); database.versions[FINANCE] = 1; database.versions[VENDORS] = 1;
  const ui = accountScreen({ database });
  database.teammateSaves(FINANCE, '{"a":2}');
  ui.storage.setItem(FINANCE, '{"a":1,"mine":true}'); ui.storage.setItem(VENDORS, '{"v":2}');
  await ui.api.saveNow();
  await ui.api.useTheirVersion(); await settle();
  assert.equal(ui.storage.getItem(FINANCE), '{"a":2}', 'the teammate\'s finances are shown');
  assert.equal(ui.storage.getItem(VENDORS), '{"v":2}', 'the other section had been saved and is kept');
  assert.equal(database.data[VENDORS], '{"v":2}');
  const { meta } = ui.api.state();
  assert.equal(meta.conflicts, undefined); assert.deepEqual(meta.dirtyKeys, []);
  assert.deepEqual(meta.versions, { [FINANCE]: 2, [VENDORS]: 2 });
  assert.equal(ui.reloads(), 1, 'the pages restart with the loaded festival');
});

test('reloading the page keeps the edit and asks again; the held section is still not sent', async () => {
  const database = fakeDatabase({ [FINANCE]: '{"a":1}' }); database.versions[FINANCE] = 1;
  const first = accountScreen({ database });
  database.teammateSaves(FINANCE, '{"a":2}');
  first.storage.setItem(FINANCE, '{"a":1,"mine":true}');
  await first.api.saveNow();
  // "Reload": a new page with the same browser storage.
  const seed = Object.fromEntries(first.values);
  const second = accountScreen({ database, seed });
  const calls = database.calls.length;
  second.api.resetForStartup(); await second.api.start(); await settle();
  assert.equal(second.storage.getItem(FINANCE), '{"a":1,"mine":true}', 'the unsaved edit survived the reload');
  assert.deepEqual(second.api.state().meta.conflicts, { [FINANCE]: 2 });
  assert.ok(second.notice().shown && second.notice().keep && second.notice().theirs, 'the choice is offered again');
  assert.equal(database.calls.length, calls, 'nothing was sent');
  assert.equal(database.data[FINANCE], '{"a":2}');
});

test('while a conflict waits, signing out and opening another festival cannot throw the edit away', async () => {
  const database = fakeDatabase({ [FINANCE]: '{"a":1}' }); database.versions[FINANCE] = 1;
  const ui = accountScreen({ database });
  database.teammateSaves(FINANCE, '{"a":2}');
  ui.storage.setItem(FINANCE, '{"a":1,"mine":true}');
  await ui.api.saveNow();
  assert.equal(await ui.api.readyToLeave(), 'cancelled');
  await ui.api.signOut();
  assert.equal(ui.signedOut(), 0, 'not signed out');
  assert.equal(ui.storage.getItem(FINANCE), '{"a":1,"mine":true}');
  assert.ok(ui.notice().keep, 'the choice is shown');
});

test('a database without versions (migration 007 not run yet) is saved to exactly as before', async () => {
  const database = fakeDatabase({ [FINANCE]: '{"a":1}' }, false);
  const ui = accountScreen({ database });
  ui.storage.setItem(FINANCE, '{"a":2}');
  assert.equal(await ui.api.saveNow(), true);
  assert.equal('expected' in database.calls[0], false, 'no version check is sent');
  assert.equal(database.data[FINANCE], '{"a":2}');
  assert.equal('versions' in ui.api.state().meta, false);
});

test('opening a festival before migration 007 is run still works (the versions column is missing)', async () => {
  const database = fakeDatabase({ [FINANCE]: '{"a":1}' }, true);
  const ui = accountScreen({ database }); ui.withoutVersionsColumn();
  ui.api.resetForStartup(); await ui.api.start(); await settle();
  assert.equal(ui.api.state().ready, true, 'the festival opened');
});

test('a teammate\'s other save while a conflict waits does not replace the conflict bar (bug found in the browser test)', async () => {
  const database = fakeDatabase({ [FINANCE]: '{"a":1}', [VENDORS]: '{"v":1}' }); database.versions[FINANCE] = 1; database.versions[VENDORS] = 1;
  const ui = accountScreen({ database });
  database.teammateSaves(FINANCE, '{"a":2}');
  ui.storage.setItem(FINANCE, '{"a":1,"mine":true}');
  await ui.api.saveNow();                                   // conflict bar is shown
  ui.storage.setItem(VENDORS, '{"v":2}');                   // then a change in another section is saved ...
  await ui.api.saveNow();                                   // ... which also tells us "a teammate saved too"
  const notice = ui.notice();
  assert.ok(notice.shown);
  assert.match(notice.text, /Not saved/, 'the conflict text stays');
  assert.doesNotMatch(notice.text, /yours are saved/);
  assert.ok(notice.keep && notice.theirs, 'Keep mine and Use theirs stay within reach');
  assert.equal(ui.status(), 'conflict');
});

test('any other bar shown while a conflict waits still offers the two choices, and not a useless Reload', async () => {
  const database = fakeDatabase({ [FINANCE]: '{"a":1}', [VENDORS]: '{"v":1}' }); database.versions[FINANCE] = 1; database.versions[VENDORS] = 1;
  const ui = accountScreen({ database });
  database.teammateSaves(FINANCE, '{"a":2}');
  ui.storage.setItem(FINANCE, '{"a":1,"mine":true}');
  await ui.api.saveNow();
  ui.api.showNotice('Something else happened.');
  assert.equal(ui.notice().text, 'Something else happened.');
  assert.ok(ui.notice().keep && ui.notice().theirs);
  assert.equal(ui.node('#account-notice-reload').hidden, true);
  // Use theirs while the connection is down: the error is shown, the choices remain.
  ui.storage.setItem(VENDORS, '{"v":2}');
  database.offline = true;
  await ui.api.useTheirVersion();
  assert.match(ui.notice().text, /not saved yet/i);
  assert.ok(ui.notice().keep && ui.notice().theirs, 'the person can try again');
  assert.equal(ui.storage.getItem(FINANCE), '{"a":1,"mine":true}', 'the held edit is still here');
});

test('without a waiting conflict a general bar looks as before (Reload offered, no choices)', async () => {
  const ui = accountScreen({ database: fakeDatabase({ [FINANCE]: '{"a":1}' }) });
  ui.api.showNotice('A teammate changed this festival. Reload to see the latest version.');
  assert.ok(ui.notice().shown);
  assert.equal(ui.node('#account-notice-reload').hidden, false);
  assert.equal(ui.notice().keep, false); assert.equal(ui.notice().theirs, false);
});

test('a closed conflict bar can be opened again', async () => {
  const database = fakeDatabase({ [FINANCE]: '{"a":1}' }); database.versions[FINANCE] = 1;
  const ui = accountScreen({ database });
  database.teammateSaves(FINANCE, '{"a":2}');
  ui.storage.setItem(FINANCE, '{"a":1,"mine":true}');
  await ui.api.saveNow();
  ui.node('#account-notice').hidden = true;                 // closed with the x
  ui.api.showConflictNotice();                              // what a click on the sidebar status does
  assert.ok(ui.notice().shown && ui.notice().keep && ui.notice().theirs);
});

// --- Part 3: the two-browser test, step by step -------------------------------------------------

test('two browsers on the finances (the browser test): sponsorship is never silently lost', async () => {
  const database = fakeDatabase({ [FINANCE]: '{"sponsorship":1000,"barMargin":50}', [VENDORS]: '{"stalls":3}' });
  database.versions[FINANCE] = 1; database.versions[VENDORS] = 1;
  const chrome = accountScreen({ database }), safari = accountScreen({ database });
  // 1. Chrome changes the sponsorship and waits for "Saved".
  chrome.storage.setItem(FINANCE, '{"sponsorship":2000,"barMargin":50}');
  await chrome.api.saveNow(); assert.equal(chrome.status(), 'saved');
  // 2. Without refreshing, Safari changes the bar margin in the same section.
  safari.storage.setItem(FINANCE, '{"sponsorship":1000,"barMargin":65}');
  await safari.api.saveNow();
  // 3. The old way: Safari's save replaced Chrome's sponsorship. Now it is refused and explained.
  assert.equal(database.data[FINANCE], '{"sponsorship":2000,"barMargin":50}', 'Chrome\'s sponsorship is still in the database');
  assert.equal(safari.status(), 'conflict');
  assert.match(safari.notice().text, /changed the finances/);
  assert.equal(safari.storage.getItem(FINANCE), '{"sponsorship":1000,"barMargin":65}', 'Safari keeps its unsaved bar margin');
  // 4. A change in another section by the stale browser is saved normally.
  safari.storage.setItem(VENDORS, '{"stalls":4}');
  await safari.api.saveNow();
  assert.equal(database.data[VENDORS], '{"stalls":4}');
  // 5. Chrome reloads: its sponsorship is intact and it sees the vendor change.
  const chromeReloaded = accountScreen({ database, seed: Object.fromEntries(chrome.values) });
  chromeReloaded.api.resetForStartup(); await chromeReloaded.api.start(); await settle();
  assert.equal(JSON.parse(database.data[FINANCE]).sponsorship, 2000);
  assert.equal(JSON.parse(database.data[VENDORS]).stalls, 4);
  // 6. Safari chooses "Use theirs", reloads and now shows what the database has.
  await safari.api.useTheirVersion(); await settle();
  assert.equal(safari.storage.getItem(FINANCE), '{"sponsorship":2000,"barMargin":50}');
  assert.equal(safari.storage.getItem(VENDORS), '{"stalls":4}');
  assert.equal(safari.api.state().meta.dirty, false);
});
