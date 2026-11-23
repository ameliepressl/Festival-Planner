// The fake database and page of tests/section-conflicts.test.js (a copy, so that test stays
// untouched), shared by tests/final-check-fixes.test.js. See feature-plans/final-check-fixes.md.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');
const USER = '11111111-1111-4111-8111-111111111111';
const FESTIVAL = '22222222-2222-4222-8222-222222222222';
const clone = value => JSON.parse(JSON.stringify(value));
const settle = () => new Promise(resolve => setImmediate(resolve));

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

module.exports = { fakeDatabase, accountScreen, settle };
