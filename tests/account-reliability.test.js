const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
  ACCOUNT_META_KEY, ACCOUNT_TRANSITION_KEY, ACCOUNT_TEAM_KEY, applyFestivalData, captureSaveBatch, acknowledgeSaveBatch,
  mergeTeamRoster, parseAccountMeta, syncAction
} = require('../rules/account-rules.js');

const ROOT = path.join(__dirname, '..');
const USER = '11111111-1111-4111-8111-111111111111';
const FIRST = '22222222-2222-4222-8222-222222222222';
const SECOND = '33333333-3333-4333-8333-333333333333';
const MEMBER = '44444444-4444-4444-8444-444444444444';
const OTHER = '55555555-5555-4555-8555-555555555555';
const THIRD = '66666666-6666-4666-8666-666666666666';
const LINEUP = 'festival-architect-v2';
const CHECKLIST = 'festival-architect-checklist';
const clone = value => JSON.parse(JSON.stringify(value));
const settle = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

// Run the real account coordinator with a fake localStorage and a controlled account
// service. The extra in-memory hook exposes its private functions only in this VM;
// no test hook or account credential is added to the browser application.
function accountScreen() {
  const values = new Map();
  let failStorage = null;
  class FakeStorage {
    get length() { return values.size; }
    key(i) { return [...values.keys()][i] ?? null; }
    getItem(key) { return values.get(String(key)) ?? null; }
    setItem(key, value) { if (failStorage?.(key, value)) throw new Error('Quota full'); values.set(String(key), String(value)); }
    removeItem(key) { values.delete(String(key)); }
  }
  const storage = new FakeStorage(), nodes = new Map(), timers = new Map(), events = new Map();
  let nextTimer = 0, reloads = 0, signedOut = 0;
  const saveRequests = [], mutations = [], rosters = new Map([[FIRST, []], [SECOND, []]]);
  const rows = new Map([FIRST, SECOND].map(id => [id, { id, owner_id: USER, data: {}, updated_at: 't0' }]));
  let memberGate = null, festivalGate = null, failMembers = false, failCatalog = false;
  function node(selector) {
    if (!nodes.has(selector)) nodes.set(selector, { hidden: true, textContent: '', value: '', disabled: false,
      inert: false, dataset: {}, classList: { add() {}, remove() {}, contains() { return false; } },
      setAttribute() {}, append() {}, addEventListener() {}, querySelector: node, selectedOptions: [] });
    return nodes.get(selector);
  }
  function query(table) {
    const filters = {}, request = { table };
    const builder = {
      select() { return builder; }, eq(key, value) { filters[key] = value; return builder; },
      insert(value) { request.action = 'insert'; request.value = clone(value); return builder; },
      update(value) { request.action = 'update'; request.value = clone(value); return builder; },
      delete() { request.action = 'delete'; return builder; },
      single() { return execute(); }, maybeSingle() { return execute(); },
      then(resolve, reject) { return execute().then(resolve, reject); }
    };
    async function execute() {
      if (request.action) mutations.push({ ...request, filters: { ...filters } });
      if (table === 'festival_members') {
        if (memberGate) { const gate = memberGate; memberGate = null; await gate.promise; }
        if (failMembers) return { error: { code: 'network' } };
        const id = request.value?.festival_id || filters.festival_id;
        const roster = rosters.get(id) || [];
        if (request.action === 'insert') roster.push({ userId: request.value.user_id, username: 'Member', role: request.value.role });
        if (request.action === 'update') roster.forEach(member => { if (member.userId === filters.user_id) member.role = request.value.role; });
        if (request.action === 'delete') rosters.set(id, roster.filter(member => member.userId !== filters.user_id));
        return { error: null };
      }
      if (request.action === 'insert') {
        const row = { id: THIRD, owner_id: USER, data: request.value.data, updated_at: 't0' }; rows.set(THIRD, row);
        return { data: row, error: null };
      }
      if (request.action === 'delete') { rows.delete(filters.id); return { data: [{ id: filters.id }], error: null }; }
      if (festivalGate) { const gate = festivalGate; festivalGate = null; await gate.promise; }
      return { data: rows.get(filters.id), error: null };
    }
    return builder;
  }
  const client = {
    auth: { onAuthStateChange() {}, async signOut() { signedOut++; return {}; },
      async getSession() { return { data: { session: { user: { id: USER, user_metadata: { username: 'Owner' } } } } }; } }, from: query,
    rpc(name, args) {
      if (name === 'save_festival_changes') return { single() {
        const pending = deferred(); saveRequests.push({ args: clone(args), resolve: pending.resolve }); return pending.promise;
      } };
      if (name === 'festival_team') return Promise.resolve({ data: (rosters.get(args.festival) || [])
        .map(member => ({ user_id: member.userId, username: member.username, role: member.role })), error: null });
      if (name === 'my_festivals') return Promise.resolve(failCatalog ? { error: { code: 'network' } } : { data: [...rows.values()]
        .map(row => ({ festival_id: row.id, owner_id: row.owner_id, owner_username: 'Owner', my_role: 'Owner', updated_at: row.updated_at })), error: null });
      return Promise.resolve({ data: [], error: null });
    }
  };
  const window = { localStorage: storage,
    FESTIVAL_SUPABASE: { url: 'https://isolated-audit.invalid', publishableKey: 'public-placeholder-for-isolated-tests' },
    supabase: { createClient: () => client }, location: { reload() { reloads++; } }, dispatchEvent() {},
    addEventListener(name, listener) { events.set(name, listener); } };
  const session = new Map();
  const context = vm.createContext({ window, Storage: FakeStorage,
    document: { documentElement: { classList: { add() {}, remove() {}, contains() { return false; } } },
      querySelector: node, querySelectorAll() { return []; }, addEventListener() {}, createElement: () => node('option') },
    sessionStorage: { getItem: key => session.get(key) ?? null, setItem: (key, value) => session.set(key, value), removeItem: key => session.delete(key) },
    Event: class { constructor(type) { this.type = type; } },
    setTimeout(fn, delay) { timers.set(++nextTimer, { fn, delay }); return nextTimer; },
    clearTimeout(id) { timers.delete(id); }, setInterval() { return 1; }, clearInterval() {}, TextEncoder, console });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'rules/account-rules.js'), 'utf8'), context);
  const source = fs.readFileSync(path.join(ROOT, 'account/account.js'), 'utf8');
  const hook = `window.accountTest = {
    start, saveNow, flushTeamChanges, readyToLeave, switchFestival, deleteOpenFestival, signOut,
    initialize() {
      ready = false; currentUser = { id: '${USER}', username: 'Owner' }; access = OWNER_ACCESS;
      meta = { userId: currentUser.id, festivalId: '${FIRST}', syncedAt: 't0', dirtyKeys: [], dirty: false, legacy: false, access: OWNER_ACCESS };
      festivals = ['${FIRST}', '${SECOND}'].map(id => ({ festival_id: id, owner_id: currentUser.id, my_role: 'Owner', updated_at: 't0' }));
      writeMeta(); ready = true;
    },
    resetForStartup() { ready = false; staleContext = false; contextTransition = false; currentUser = null; meta = readMeta(); },
    state: () => JSON.parse(JSON.stringify({ meta, staleContext, contextTransition, ready }))
  };}());`;
  vm.runInContext(source.replace(/\}\(\)\);\s*$/, hook), context, { filename: 'account/account.js' });
  window.accountTest.initialize();
  return { window, storage, values, nodes, node, saveRequests, mutations, rosters, rows, timers, events, session,
    api: window.accountTest, reloads: () => reloads, signedOut: () => signedOut,
    gateMembers() { memberGate = deferred(); return memberGate; },
    gateFestival() { festivalGate = deferred(); return festivalGate; },
    failStorage(predicate) { failStorage = predicate; }, failMembers(value) { failMembers = value; }, failCatalog(value) { failCatalog = value; } };
}

test('successful save acknowledgements keep only sections changed after their captured revision', () => {
  const storage = { getItem: key => key === LINEUP ? 'lineup' : 'checklist' };
  const batch = captureSaveBatch({ storage, dirtyKeys: [LINEUP], role: 'Admin', revisions: { [LINEUP]: 1 }, userId: USER, festivalId: FIRST });
  assert.deepEqual(acknowledgeSaveBatch({ batch, userId: USER, festivalId: FIRST,
    dirtyKeys: [LINEUP, CHECKLIST], revisions: { [LINEUP]: 1, [CHECKLIST]: 1 } }), [CHECKLIST]);
  assert.deepEqual(acknowledgeSaveBatch({ batch, userId: USER, festivalId: FIRST,
    dirtyKeys: [LINEUP], revisions: { [LINEUP]: 2 } }), [LINEUP]);
  assert.deepEqual(acknowledgeSaveBatch({ batch, userId: USER, festivalId: SECOND,
    dirtyKeys: [LINEUP], revisions: { [LINEUP]: 1 } }), [LINEUP]);
});

test('account coordinator does not resend stale lineup data when checklist changes during its save', async () => {
  const ui = accountScreen(); ui.storage.setItem(LINEUP, 'first lineup');
  const first = ui.api.saveNow(); ui.storage.setItem(CHECKLIST, 'new checklist');
  ui.saveRequests[0].resolve({ data: { saved_at: 't1', previous_saved_at: 't0' }, error: null }); await first;
  const second = ui.api.saveNow();
  assert.deepEqual(ui.saveRequests[1].args.changes, { [CHECKLIST]: 'new checklist' });
  ui.saveRequests[1].resolve({ data: { saved_at: 't3', previous_saved_at: 'teammate-t2' }, error: null }); await second;
  assert.equal(ui.api.state().meta.dirty, false);
});

test('an edit to the same section during its request is still saved afterwards', async () => {
  const ui = accountScreen(); ui.storage.setItem(LINEUP, 'first');
  const first = ui.api.saveNow(); ui.storage.setItem(LINEUP, 'second');
  ui.saveRequests[0].resolve({ data: { saved_at: 't1', previous_saved_at: 't0' }, error: null }); await first;
  const second = ui.api.saveNow(); assert.equal(ui.saveRequests[1].args.changes[LINEUP], 'second');
  ui.saveRequests[1].resolve({ data: { saved_at: 't2', previous_saved_at: 't1' }, error: null }); await second;
  assert.equal(ui.api.state().meta.dirty, false);
});

test('switching contexts waits for queued and in-flight team changes before leaving', async () => {
  const ui = accountScreen(), gate = ui.gateMembers();
  ui.storage.setItem(ACCOUNT_TEAM_KEY, JSON.stringify([{ userId: MEMBER, username: 'Member', role: 'Editor' }]));
  let left = false; const leaving = ui.api.readyToLeave().then(result => { left = true; return result; });
  await settle(); assert.equal(left, false);
  assert.equal(ui.api.state().contextTransition, true);
  assert.throws(() => ui.storage.setItem(LINEUP, 'edit during switch'), /Wait until/);
  gate.resolve(); assert.equal(await leaving, '');
  assert.equal(ui.rosters.get(FIRST)[0].userId, MEMBER);
  assert.equal(ui.api.state().meta.teamDirty, undefined);
});

test('new team edits during a save and unrelated invitations from another Admin are both retained', async () => {
  const ui = accountScreen(), gate = ui.gateMembers();
  ui.storage.setItem(ACCOUNT_TEAM_KEY, JSON.stringify([{ userId: MEMBER, username: 'Member', role: 'Editor' }]));
  const saving = ui.api.flushTeamChanges(); await settle();
  ui.storage.setItem(ACCOUNT_TEAM_KEY, JSON.stringify([
    { userId: MEMBER, username: 'Member', role: 'Editor' }, { userId: OTHER, username: 'Member', role: 'Viewer' }
  ]));
  ui.rosters.get(FIRST).push({ userId: THIRD, username: 'Other admin invite', role: 'Viewer' });
  gate.resolve(); assert.equal(await saving, true);
  assert.deepEqual(ui.rosters.get(FIRST).map(member => member.userId).sort(), [MEMBER, OTHER, THIRD].sort());
});

test('offline team edits remain pending in metadata and are retried after reconnecting', async () => {
  const ui = accountScreen(); ui.failMembers(true);
  ui.storage.setItem(ACCOUNT_TEAM_KEY, JSON.stringify([{ userId: MEMBER, username: 'Member', role: 'Editor' }]));
  assert.equal(await ui.api.flushTeamChanges(), false);
  const pending = parseAccountMeta(ui.storage.getItem(ACCOUNT_META_KEY));
  assert.equal(pending.teamDirty, true); assert.deepEqual(pending.teamBase, []);
  assert.equal(syncAction({ meta: pending, userId: USER, cloud: { id: FIRST, updatedAt: 'newer' }, localData: {} }), 'upload');
  ui.failMembers(false); assert.equal(await ui.api.flushTeamChanges(), true);
  assert.equal(ui.rosters.get(FIRST)[0].userId, MEMBER);
});

test('cancelling a project draft prevents switch, create, delete and sign-out before any mutation', async () => {
  for (const action of ['switch', 'create', 'delete', 'signout']) {
    const ui = accountScreen(); ui.window.confirmProjectNavigation = () => false;
    const before = ui.storage.getItem(ACCOUNT_META_KEY);
    if (action === 'switch') await ui.api.switchFestival(SECOND);
    if (action === 'create') assert.equal(await ui.window.openNewFestival({}), false);
    if (action === 'delete') await ui.api.deleteOpenFestival();
    if (action === 'signout') await ui.api.signOut();
    assert.deepEqual(ui.mutations, [], action); assert.equal(ui.signedOut(), 0, action);
    assert.equal(ui.reloads(), 0, action); assert.equal(ui.storage.getItem(ACCOUNT_META_KEY), before, action);
  }
});

test('a stale tab cannot write festival data or acknowledge an old request into a different context', async () => {
  const ui = accountScreen(); ui.storage.setItem(LINEUP, 'old festival'); const pending = ui.api.saveNow();
  const nextMeta = { ...JSON.parse(ui.storage.getItem(ACCOUNT_META_KEY)), festivalId: SECOND, dirtyKeys: [], dirty: false };
  ui.values.set(ACCOUNT_META_KEY, JSON.stringify(nextMeta)); ui.values.set(LINEUP, 'other festival');
  ui.events.get('storage')({ key: ACCOUNT_META_KEY });
  assert.throws(() => ui.storage.setItem(LINEUP, 'stale overwrite'), /Another tab/);
  assert.throws(() => ui.storage.removeItem(LINEUP), /Another tab/);
  ui.saveRequests[0].resolve({ data: { saved_at: 't1', previous_saved_at: 't0' }, error: null });
  assert.equal(await pending, false);
  assert.equal(ui.storage.getItem(LINEUP), 'other festival');
  assert.equal(JSON.parse(ui.storage.getItem(ACCOUNT_META_KEY)).festivalId, SECOND);
  assert.equal(ui.node('.app-layout').inert, true);
});

test('team requests keep their captured festival id even if another tab changes context mid-request', async () => {
  const ui = accountScreen(), gate = ui.gateMembers();
  ui.storage.setItem(ACCOUNT_TEAM_KEY, JSON.stringify([
    { userId: MEMBER, username: 'Member', role: 'Editor' }, { userId: OTHER, username: 'Member', role: 'Viewer' }
  ]));
  const saving = ui.api.flushTeamChanges(); await settle();
  const nextMeta = { ...JSON.parse(ui.storage.getItem(ACCOUNT_META_KEY)), festivalId: SECOND };
  ui.values.set(ACCOUNT_META_KEY, JSON.stringify(nextMeta)); gate.resolve();
  assert.equal(await saving, false);
  assert.ok(ui.mutations.every(request => (request.value?.festival_id || request.filters.festival_id) === FIRST));
  assert.equal(ui.mutations.length, 1, 'no further member requests start after the tab becomes stale');
  assert.deepEqual(ui.rosters.get(SECOND), []);
});

test('replacing a plan and roster rolls back together when a later storage write fails', () => {
  const values = new Map([[LINEUP, 'old plan'], [ACCOUNT_TEAM_KEY, 'old roster'], ['unrelated-cache', 'keep']]);
  const storage = { get length() { return values.size; }, key: i => [...values.keys()][i] ?? null,
    getItem: key => values.get(key) ?? null, removeItem: key => values.delete(key), setItem(key, value) {
      if (key === ACCOUNT_TEAM_KEY && value !== 'old roster') throw new Error('Quota full'); values.set(key, value);
    } };
  assert.throws(() => applyFestivalData(storage, { [LINEUP]: 'new plan', [CHECKLIST]: 'new checks' }, {
    roster: [{ userId: MEMBER, username: 'Member', role: 'Viewer' }]
  }), error => error.restored === true);
  assert.deepEqual(Object.fromEntries(values), { [LINEUP]: 'old plan', [ACCOUNT_TEAM_KEY]: 'old roster', 'unrelated-cache': 'keep' });
});

test('team rebasing applies only intended changes and retains unrelated new members', () => {
  const member = { userId: MEMBER, username: 'Member', role: 'Editor' };
  const other = { userId: OTHER, username: 'Other', role: 'Viewer' };
  assert.deepEqual(mergeTeamRoster([], [member], [other]), [other, member]);
  assert.deepEqual(mergeTeamRoster([member], [], [member, other]), [other]);
});

test('a metadata storage failure rolls back the downloaded plan as well as its project association', () => {
  const oldMeta = JSON.stringify({ userId: USER, festivalId: FIRST });
  const values = new Map([[LINEUP, 'old plan'], [ACCOUNT_META_KEY, oldMeta]]);
  const storage = { get length() { return values.size; }, key: i => [...values.keys()][i] ?? null,
    getItem: key => values.get(key) ?? null, removeItem: key => values.delete(key), setItem(key, value) {
      if (key === ACCOUNT_META_KEY && value !== oldMeta) throw new Error('Quota full'); values.set(key, value);
    } };
  assert.throws(() => applyFestivalData(storage, { [LINEUP]: 'other plan' }, {
    accountMeta: { userId: USER, festivalId: SECOND }
  }), error => error.restored === true);
  assert.deepEqual(Object.fromEntries(values), { [LINEUP]: 'old plan', [ACCOUNT_META_KEY]: oldMeta });
});

test('a pending download cannot overwrite the festival another tab opened while it was loading', async () => {
  const ui = accountScreen(), gate = ui.gateFestival();
  ui.values.set(LINEUP, 'first plan'); ui.rows.get(SECOND).data = { [LINEUP]: 'second plan' };
  const switching = ui.api.switchFestival(SECOND); await settle();
  const thirdMeta = { ...JSON.parse(ui.storage.getItem(ACCOUNT_META_KEY)), festivalId: THIRD };
  ui.values.set(ACCOUNT_META_KEY, JSON.stringify(thirdMeta)); ui.values.set(LINEUP, 'third plan');
  ui.events.get('storage')({ key: ACCOUNT_META_KEY }); gate.resolve(); await switching;
  assert.equal(ui.storage.getItem(LINEUP), 'third plan');
  assert.equal(JSON.parse(ui.storage.getItem(ACCOUNT_META_KEY)).festivalId, THIRD);
  assert.equal(ui.reloads(), 0);
});

test('a local edit is rejected as a whole if its pending-save marker cannot be stored', () => {
  for (const key of [LINEUP, ACCOUNT_TEAM_KEY]) {
    const ui = accountScreen(); ui.values.set(key, 'previous value');
    const before = ui.storage.getItem(ACCOUNT_META_KEY);
    ui.failStorage(candidate => candidate === ACCOUNT_META_KEY);
    const value = key === LINEUP ? 'new plan' : JSON.stringify([{ userId: MEMBER, username: 'Member', role: 'Editor' }]);
    assert.throws(() => ui.storage.setItem(key, value), /Quota full/);
    assert.equal(ui.storage.getItem(key), 'previous value');
    assert.equal(ui.storage.getItem(ACCOUNT_META_KEY), before);
    assert.equal(ui.api.state().meta.dirty, false);
    assert.equal(ui.api.state().meta.teamDirty, undefined);
  }
});

test('the saved status waits for team changes as well as ordinary plan sections', async () => {
  const ui = accountScreen(), gate = ui.gateMembers();
  ui.storage.setItem(ACCOUNT_TEAM_KEY, JSON.stringify([{ userId: MEMBER, username: 'Member', role: 'Editor' }]));
  const teamSaving = ui.api.flushTeamChanges(); await settle();
  ui.storage.setItem(LINEUP, 'new plan'); const planSaving = ui.api.saveNow();
  ui.saveRequests[0].resolve({ data: { saved_at: 't1', previous_saved_at: 't0' }, error: null }); await planSaving;
  assert.equal(ui.node('#account-sync-status').textContent, 'Saving…');
  gate.resolve(); await teamSaving;
  assert.equal(ui.node('#account-sync-status').textContent, 'Saved to your account');
});

test('a replacement marker blocks an old tab before its delayed edit can mix two festivals', () => {
  const ui = accountScreen(); ui.values.set(LINEUP, 'A saved');
  const metaB = { ...JSON.parse(ui.values.get(ACCOUNT_META_KEY)), festivalId: SECOND };
  let blocked = false;
  const otherTab = { get length() { return ui.values.size; }, key: i => [...ui.values.keys()][i] ?? null,
    getItem: key => ui.values.get(key) ?? null, removeItem: key => ui.values.delete(key), setItem(key, value) {
      ui.values.set(key, value);
      if (key === LINEUP && value === 'B saved') {
        assert.notEqual(ui.values.get(ACCOUNT_TRANSITION_KEY), undefined);
        assert.throws(() => ui.storage.setItem(LINEUP, 'late A edit'), /festival change is in progress/);
        blocked = true;
      }
    } };
  applyFestivalData(otherTab, { [LINEUP]: 'B saved', [CHECKLIST]: 'B checks' }, { accountMeta: metaB });
  assert.equal(blocked, true);
  assert.equal(ui.storage.getItem(LINEUP), 'B saved');
  assert.equal(ui.storage.getItem(CHECKLIST), 'B checks');
  assert.equal(JSON.parse(ui.storage.getItem(ACCOUNT_META_KEY)).festivalId, SECOND);
  assert.equal(ui.storage.getItem(ACCOUNT_TRANSITION_KEY), null);
  assert.equal(ui.api.state().staleContext, true);
});

test('rollback restores old sections before publishing their metadata and removing the marker', () => {
  const oldMeta = JSON.stringify({ userId: USER, festivalId: FIRST });
  const values = new Map([[LINEUP, 'A saved'], [ACCOUNT_META_KEY, oldMeta]]);
  let failFinish = true, restoredAssociation = false;
  const storage = { get length() { return values.size; }, key: i => [...values.keys()][i] ?? null,
    getItem: key => values.get(key) ?? null, setItem(key, value) {
      if (key === ACCOUNT_META_KEY && value === oldMeta) {
        assert.equal(values.get(LINEUP), 'A saved');
        assert.equal(values.has(CHECKLIST), false);
        assert.equal(values.has(ACCOUNT_TRANSITION_KEY), true);
        restoredAssociation = true;
      }
      values.set(key, value);
    }, removeItem(key) {
      if (key === ACCOUNT_TRANSITION_KEY && failFinish) { failFinish = false; throw new Error('Interrupted finalisation'); }
      values.delete(key);
    } };
  assert.throws(() => applyFestivalData(storage, { [LINEUP]: 'B saved', [CHECKLIST]: 'B checks' }, {
    accountMeta: { userId: USER, festivalId: SECOND }
  }), error => error.restored === true);
  assert.equal(restoredAssociation, true);
  assert.deepEqual(Object.fromEntries(values), { [LINEUP]: 'A saved', [ACCOUNT_META_KEY]: oldMeta });
});

test('an unfinished replacement is never uploaded or unlocked offline, and explicit recovery loads the cloud', async () => {
  const ui = accountScreen();
  const marker = JSON.stringify({ version: 1, before: { userId: USER, festivalId: FIRST }, after: { userId: USER, festivalId: SECOND } });
  ui.values.set(ACCOUNT_TRANSITION_KEY, marker);
  ui.values.set(LINEUP, 'partial replacement');
  ui.values.set(ACCOUNT_META_KEY, JSON.stringify({ ...JSON.parse(ui.values.get(ACCOUNT_META_KEY)), dirty: true, dirtyKeys: [LINEUP] }));
  ui.api.resetForStartup(); await ui.api.start();
  assert.equal(ui.api.state().ready, false);
  assert.equal(ui.window.isFestivalContextCurrent(), false);
  assert.throws(() => ui.storage.setItem(LINEUP, 'startup write'), /festival change is in progress/);
  assert.equal(ui.saveRequests.length, 0);
  ui.session.set('fa-account-recover-transition', marker); ui.failCatalog(true); await ui.api.start();
  assert.equal(ui.api.state().ready, false);
  assert.equal(ui.saveRequests.length, 0);
  assert.equal(ui.storage.getItem(ACCOUNT_TRANSITION_KEY), marker);
  ui.failCatalog(false); ui.session.set('fa-account-recover-transition', marker);
  ui.rows.get(SECOND).data = { [LINEUP]: 'verified cloud B' }; await ui.api.start();
  assert.equal(ui.storage.getItem(LINEUP), 'verified cloud B');
  assert.equal(JSON.parse(ui.storage.getItem(ACCOUNT_META_KEY)).festivalId, SECOND);
  assert.equal(ui.storage.getItem(ACCOUNT_TRANSITION_KEY), null);
  assert.equal(ui.saveRequests.length, 0);
  assert.equal(ui.reloads(), 1);
});

test('an unfinished marker cannot be bypassed by an ordinary replacement or a different recovery token', () => {
  const values = new Map([[LINEUP, 'partial'], [ACCOUNT_TRANSITION_KEY, 'interrupted']]);
  const storage = { get length() { return values.size; }, key: i => [...values.keys()][i] ?? null,
    getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  assert.throws(() => applyFestivalData(storage, { [LINEUP]: 'new' }), /unfinished/);
  assert.throws(() => applyFestivalData(storage, { [LINEUP]: 'new' }, { recoverTransition: 'other-marker' }), /unfinished/);
  assert.deepEqual(Object.fromEntries(values), { [LINEUP]: 'partial', [ACCOUNT_TRANSITION_KEY]: 'interrupted' });
});

test('failed rollback keeps its marker, and failure to publish a marker changes no festival section', () => {
  const values = new Map([[LINEUP, 'A saved'], [ACCOUNT_META_KEY, JSON.stringify({ userId: USER, festivalId: FIRST })]]);
  const storage = { get length() { return values.size; }, key: i => [...values.keys()][i] ?? null,
    getItem: key => values.get(key) ?? null, removeItem: key => values.delete(key), setItem(key, value) {
      if (key === CHECKLIST || (key === LINEUP && value === 'A saved')) throw new Error('Storage unavailable');
      values.set(key, value);
    } };
  assert.throws(() => applyFestivalData(storage, { [LINEUP]: 'B partial', [CHECKLIST]: 'B checks' }, {
    accountMeta: { userId: USER, festivalId: SECOND }
  }), error => error.restored === false);
  assert.equal(values.has(ACCOUNT_TRANSITION_KEY), true);
  const untouched = new Map([[LINEUP, 'A saved']]);
  const blocked = { get length() { return untouched.size; }, key: i => [...untouched.keys()][i] ?? null,
    getItem: key => untouched.get(key) ?? null, removeItem: key => untouched.delete(key), setItem(key, value) {
      if (key === ACCOUNT_TRANSITION_KEY) throw new Error('Marker unavailable'); untouched.set(key, value);
    } };
  assert.throws(() => applyFestivalData(blocked, { [LINEUP]: 'B saved' }), /Marker unavailable/);
  assert.deepEqual(Object.fromEntries(untouched), { [LINEUP]: 'A saved' });
});
