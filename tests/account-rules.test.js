// Checks for accounts and for keeping the plan in the account (rules/account-rules.js),
// see feature-plans/login.md.
// Run with:  uvx --from nodejs-wheel node --test

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SESSION_STORAGE_KEY, ACCOUNT_META_KEY, ACCOUNT_TEAM_KEY, ACCOUNT_FINANCE_KEY, usernameProblem, emailProblem, passwordProblem,
  signUpProblem, signInProblem, usernameKey, accountErrorMessage, isFestivalDataKey,
  collectFestivalData, cleanFestivalData, hasFestivalData, clearFestivalData, applyFestivalData,
  parseAccountMeta, syncAction, teammateFromRows, accessFor, sameAccess, sectionsToSave, rosterFromTeam,
  parseRoster, teamChanges, sameRoster, festivalLabel
} = require('../rules/account-rules.js');

// A small stand-in for the browser's localStorage.
function fakeStorage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    get length() { return map.size; },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    entries: () => Object.fromEntries(map)
  };
}

const ID_A = '0b6f3a52-9c1e-4b7a-8f43-2d5e6c7b8a91';
const ID_B = 'f2c4e6a8-1b3d-4f5a-9c7e-8d6b4a2c0e1f';

test('sign-up accepts a valid username, email and password', () => {
  assert.equal(signUpProblem({ username: 'Amelie_P', email: 'amelie@novasbe.pt', password: 'stage-door-42' }), '');
  assert.equal(usernameProblem('k.ira-4'), '');
  assert.equal(passwordProblem('12345678'), '');
});

test('sign-up rejects bad usernames, emails and passwords and says why', () => {
  for (const username of ['', 'ab', 'a'.repeat(33), 'Vicky F', 'name@x', '<script>', null]) {
    assert.match(usernameProblem(username), /3–32 letters/, String(username));
  }
  for (const email of ['', 'amelie', 'amelie@', '@novasbe.pt', 'a b@x.pt', `${'a'.repeat(250)}@x.pt`]) {
    assert.match(emailProblem(email), /valid email/, email);
  }
  assert.match(passwordProblem('1234567'), /at least 8/);
  assert.match(passwordProblem('a'.repeat(73)), /at most 72/);
  // 72 is counted in bytes, like Supabase does: 37 two-byte letters are too long
  assert.match(passwordProblem('ä'.repeat(37)), /at most 72/);
  assert.match(signUpProblem({ username: 'ok_name', email: 'x@y.pt', password: 'short' }), /at least 8/);
});

test('sign-in only needs an email and some password; the service decides if it is right', () => {
  assert.equal(signInProblem({ email: 'vicky@novasbe.pt', password: 'x' }), '');
  assert.match(signInProblem({ email: 'vicky', password: 'whatever1' }), /valid email/);
  assert.match(signInProblem({ email: 'vicky@novasbe.pt', password: '' }), /Enter your password/);
});

test('usernames are compared without case and surrounding spaces', () => {
  assert.equal(usernameKey(' Vicky '), 'vicky');
  assert.equal(usernameKey('VICKY'), usernameKey('vicky'));
  assert.equal(usernameKey(undefined), '');
});

test('errors from the account service become clear sentences', () => {
  assert.match(accountErrorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' }), /Email or password is wrong/);
  assert.match(accountErrorMessage({ code: 'user_already_exists' }), /already exists/);
  assert.match(accountErrorMessage({ message: 'Database error saving new user' }), /username is already taken/);
  assert.match(accountErrorMessage({ code: 'weak_password' }), /stronger password/);
  assert.match(accountErrorMessage({ status: 429 }), /Too many attempts/);
  assert.match(accountErrorMessage({ message: 'Failed to fetch' }), /Cannot reach/);
  assert.match(accountErrorMessage({ code: 'email_not_confirmed' }), /Confirm your email/);
  assert.match(accountErrorMessage(undefined), /Something went wrong/);
});

test('only keys starting with "festival-" belong to the plan; the login session never does', () => {
  ['festival-architect-v2', 'festival-gantt-project-v1', 'festival-work-board-status-v1', 'festival-architect-team-v1']
    .forEach((key) => assert.equal(isFestivalDataKey(key), true, key));
  [SESSION_STORAGE_KEY, ACCOUNT_META_KEY, 'something-else', '', null].forEach((key) => assert.equal(isFestivalDataKey(key), false, String(key)));
});

test('collecting the plan takes every festival key and nothing else', () => {
  const storage = fakeStorage({
    'festival-architect-v2': '{"bookings":[]}', 'festival-architect-finance': '{"price":39}',
    [SESSION_STORAGE_KEY]: '{"access_token":"secret"}', [ACCOUNT_META_KEY]: '{}'
  });
  assert.deepEqual(collectFestivalData(storage), {
    'festival-architect-finance': '{"price":39}', 'festival-architect-v2': '{"bookings":[]}'
  });
});

test('loading a plan replaces the old plan but keeps the login session', () => {
  const storage = fakeStorage({
    'festival-architect-v2': 'old plan', 'festival-architect-vendors': 'old vendors',
    [SESSION_STORAGE_KEY]: 'session'
  });
  const written = applyFestivalData(storage, { 'festival-architect-v2': 'new plan' });
  assert.equal(written, 1);
  assert.deepEqual(storage.entries(), { [SESSION_STORAGE_KEY]: 'session', 'festival-architect-v2': 'new plan' });
});

test('broken or foreign data from the account is never written into the browser', () => {
  assert.deepEqual(cleanFestivalData({ 'festival-a': 'ok', 'festival-b': 42, [SESSION_STORAGE_KEY]: 'x', other: 'y' }), { 'festival-a': 'ok' });
  assert.deepEqual(cleanFestivalData(null), {});
  assert.deepEqual(cleanFestivalData(['festival-a']), {});
  assert.equal(hasFestivalData({}), false);
  assert.equal(hasFestivalData({ 'festival-a': '{}' }), true);
});

test('signing out removes the plan from the browser and nothing else', () => {
  const storage = fakeStorage({ 'festival-architect-v2': 'plan', 'festival-architect-checklist': '[]', 'other-app': 'keep' });
  clearFestivalData(storage);
  assert.deepEqual(storage.entries(), { 'other-app': 'keep' });
});

test('saved sync information is read safely', () => {
  // written by the first login version (only "dirty"): every section counts as unsaved
  assert.deepEqual(parseAccountMeta(JSON.stringify({ userId: ID_A, syncedAt: '2026-11-19T12:00:00Z', dirty: true })),
    { userId: ID_A, festivalId: null, syncedAt: '2026-11-19T12:00:00Z', dirtyKeys: ['*'], dirty: true, legacy: false, access: null });
  assert.deepEqual(parseAccountMeta('{"userId":5,"dirty":"yes"}'),
    { userId: null, festivalId: null, syncedAt: null, dirtyKeys: [], dirty: false, legacy: false, access: null });
  const meta = parseAccountMeta(JSON.stringify({
    userId: ID_A, festivalId: ID_B, syncedAt: 't1', dirtyKeys: ['festival-architect-v2', 'festival-architect-team-v1', 'sb-x', 'festival-architect-v2'],
    access: { role: 'Editor', creatorLabel: 'Amelie (festival creator)' }
  }));
  assert.equal(meta.festivalId, ID_B);
  assert.deepEqual(meta.dirtyKeys, ['festival-architect-v2'], 'the team roster and foreign keys are never unsaved plan sections');
  assert.deepEqual(meta.access, { role: 'Editor', creatorLabel: 'Amelie (festival creator)' });
  assert.equal(parseAccountMeta(JSON.stringify({ access: { role: 'Boss', creatorLabel: 'x' }, festivalId: 'nope' })).access, null);
  assert.equal(parseAccountMeta('not json'), null);
  assert.equal(parseAccountMeta(null), null);
  assert.equal(parseAccountMeta('[]'), null);
});

test('a new account gets a new plan; a plan from before accounts asks first', () => {
  const plan = { 'festival-architect-v2': '{}' };
  assert.equal(syncAction({ meta: { userId: null, legacy: false }, userId: ID_A, cloud: null, localData: {} }), 'create');
  assert.equal(syncAction({ meta: { userId: null, legacy: true }, userId: ID_A, cloud: null, localData: plan }), 'choose');
  assert.equal(syncAction({ meta: { userId: null, legacy: true }, userId: ID_A, cloud: { updatedAt: 't1' }, localData: plan }), 'choose');
  // a legacy flag without a plan left in the browser has nothing to choose from
  assert.equal(syncAction({ meta: { userId: null, legacy: true }, userId: ID_A, cloud: null, localData: {} }), 'create');
});

test('the browser never keeps or uploads another account\'s plan', () => {
  const meta = { userId: ID_B, syncedAt: 't1', dirty: true, legacy: false };
  assert.equal(syncAction({ meta, userId: ID_A, cloud: { updatedAt: 't1' }, localData: { 'festival-x': '1' } }), 'download');
  assert.equal(syncAction({ meta: null, userId: ID_A, cloud: { updatedAt: 't1' }, localData: {} }), 'download');
  // a new account must not start with the plan another account left in this browser
  assert.equal(syncAction({ meta, userId: ID_A, cloud: null, localData: { 'festival-x': '1' } }), 'create-empty');
  assert.equal(syncAction({ meta: { ...meta, userId: ID_A }, userId: ID_A, cloud: null, localData: { 'festival-x': '1' } }), 'create');
});

test('unsaved changes are uploaded, a newer plan from another device is downloaded, otherwise nothing happens', () => {
  const synced = { userId: ID_A, syncedAt: 't1', dirty: false, legacy: false };
  assert.equal(syncAction({ meta: { ...synced, dirty: true }, userId: ID_A, cloud: { updatedAt: 't1' }, localData: {} }), 'upload');
  assert.equal(syncAction({ meta: synced, userId: ID_A, cloud: { updatedAt: 't2' }, localData: {} }), 'download');
  assert.equal(syncAction({ meta: synced, userId: ID_A, cloud: { updatedAt: 't1' }, localData: {} }), 'keep');
});

test('a teammate is found only for exactly one valid account', () => {
  assert.deepEqual(teammateFromRows([{ id: ID_A, username: 'Vicky' }]), { id: ID_A, username: 'Vicky' });
  assert.equal(teammateFromRows([]), null);
  assert.equal(teammateFromRows(null), null);
  assert.equal(teammateFromRows([{ id: ID_A, username: 'Vicky' }, { id: ID_B, username: 'vicky' }]), null);
  assert.equal(teammateFromRows([{ id: 4, username: 'Vicky' }]), null);
  assert.equal(teammateFromRows([{ id: ID_A, username: '<img src=x>' }]), null);
});

// --- Shared festivals (feature-plans/shared-festivals.md) ------------------------------

const ID_C = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

test('the team roster is never saved as part of the plan and never comes from it', () => {
  const storage = fakeStorage({ 'festival-architect-v2': 'plan', [ACCOUNT_TEAM_KEY]: '[{"userId":"x"}]' });
  assert.deepEqual(collectFestivalData(storage), { 'festival-architect-v2': 'plan' });
  assert.deepEqual(cleanFestivalData({ [ACCOUNT_TEAM_KEY]: '[]', 'festival-architect-v2': 'plan' }), { 'festival-architect-v2': 'plan' });
  clearFestivalData(storage);
  assert.equal(storage.getItem(ACCOUNT_TEAM_KEY), null, 'signing out also removes the roster');
});

test('a different festival than the one in this browser is loaded, not overwritten', () => {
  const meta = { userId: ID_A, festivalId: ID_A, syncedAt: 't1', dirty: true, legacy: false };
  assert.equal(syncAction({ meta, userId: ID_A, cloud: { id: ID_B, updatedAt: 't1' }, localData: {} }), 'download');
  assert.equal(syncAction({ meta, userId: ID_A, cloud: { id: ID_A, updatedAt: 't1' }, localData: {} }), 'upload');
  // a browser from the first login version knows no festival id yet: it is the own festival
  assert.equal(syncAction({ meta: { ...meta, festivalId: null, dirty: false }, userId: ID_A, cloud: { id: ID_A, updatedAt: 't1' }, localData: {} }), 'keep');
  // the open festival is gone and there is no own festival yet: start empty, never copy a shared plan
  assert.equal(syncAction({ meta: { ...meta, festivalId: ID_B }, userId: ID_A, cloud: null, localData: { 'festival-x': '1' } }), 'create-empty');
});

test('owners are Admins; members get their role; the creator is named', () => {
  assert.deepEqual(accessFor({ ownerId: ID_A, ownerUsername: 'Amelie', myRole: 'Owner' }, ID_A),
    { role: 'Admin', creatorLabel: 'You (festival creator)' });
  assert.deepEqual(accessFor({ ownerId: ID_A, ownerUsername: 'Amelie', myRole: 'Editor' }, ID_B),
    { role: 'Editor', creatorLabel: 'Amelie (festival creator)' });
  assert.equal(accessFor({ ownerId: ID_A, ownerUsername: 'Amelie', myRole: 'Boss' }, ID_B).role, 'Viewer', 'unknown roles may only look');
  assert.equal(accessFor({ ownerId: ID_A, ownerUsername: '<b>x</b>', myRole: 'Admin' }, ID_B).creatorLabel, 'Owner (festival creator)');
  assert.equal(sameAccess({ role: 'Admin', creatorLabel: 'a' }, { role: 'Admin', creatorLabel: 'a' }), true);
  assert.equal(sameAccess({ role: 'Admin', creatorLabel: 'a' }, { role: 'Editor', creatorLabel: 'a' }), false);
  assert.equal(sameAccess(null, { role: 'Admin', creatorLabel: 'a' }), false);
});

test('only the changed sections are sent, as the role allows', () => {
  const storage = fakeStorage({
    'festival-architect-v2': 'lineup', [ACCOUNT_FINANCE_KEY]: 'money', 'festival-architect-checklist': '[]', [ACCOUNT_TEAM_KEY]: '[]'
  });
  assert.deepEqual(sectionsToSave({ storage, dirtyKeys: ['festival-architect-v2', 'festival-architect-vendors'], role: 'Admin' }),
    { changes: { 'festival-architect-v2': 'lineup' }, removed: ['festival-architect-vendors'], skipped: [] });
  assert.deepEqual(sectionsToSave({ storage, dirtyKeys: ['*'], role: 'Admin' }).changes,
    { [ACCOUNT_FINANCE_KEY]: 'money', 'festival-architect-checklist': '[]', 'festival-architect-v2': 'lineup' });
  const editor = sectionsToSave({ storage, dirtyKeys: ['*'], role: 'Editor' });
  assert.equal(ACCOUNT_FINANCE_KEY in editor.changes, false, 'editors never send the finances');
  assert.deepEqual(editor.skipped, [ACCOUNT_FINANCE_KEY]);
  const viewer = sectionsToSave({ storage, dirtyKeys: ['festival-architect-v2'], role: 'Viewer' });
  assert.deepEqual(viewer.changes, {}, 'viewers send nothing');
  assert.deepEqual(viewer.skipped, ['festival-architect-v2']);
  assert.deepEqual(sectionsToSave({ storage, dirtyKeys: [ACCOUNT_TEAM_KEY], role: 'Admin' }).changes, {}, 'the roster is never sent');
});

test('the team from the database becomes the roster; broken rows are dropped', () => {
  assert.deepEqual(rosterFromTeam([
    { user_id: ID_B, username: 'Kira', role: 'Editor' },
    { user_id: 4, username: 'Old', role: 'Admin' },
    { user_id: ID_C, username: 'Vicky', role: 'Boss' }
  ]), [{ userId: ID_B, username: 'Kira', role: 'Editor' }]);
  assert.deepEqual(rosterFromTeam(null), []);
  assert.deepEqual(parseRoster('not json'), []);
  assert.deepEqual(parseRoster('[{"userId":"a"}]'), [{ userId: 'a' }]);
});

test('saving the roster adds, changes and removes exactly the members that differ', () => {
  const server = [{ userId: ID_B, username: 'Kira', role: 'Editor' }, { userId: ID_C, username: 'Vicky', role: 'Viewer' }];
  const roster = [{ userId: ID_B, username: 'Kira', role: 'Admin' }, { userId: ID_A, username: 'Frederik', role: 'Viewer' },
    { userId: 4, username: 'Old', role: 'Admin' }];
  assert.deepEqual(teamChanges(server, roster), {
    add: [{ userId: ID_A, role: 'Viewer' }], change: [{ userId: ID_B, role: 'Admin' }], remove: [ID_C]
  });
  assert.deepEqual(teamChanges(server, server), { add: [], change: [], remove: [] });
  assert.equal(sameRoster(server, [...server].reverse()), true);
  assert.equal(sameRoster(server, roster), false);
});

test('the festival switcher names the own festival and shows owner and role for shared ones', () => {
  assert.equal(festivalLabel({ owner_id: ID_A, festival_name: 'Harbour Sound' }, ID_A), 'My festival · Harbour Sound');
  assert.equal(festivalLabel({ owner_id: ID_A, festival_name: ' ', owner_username: 'Amelie', my_role: 'Editor' }, ID_B),
    'Untitled festival · by Amelie · Editor');
  assert.equal(festivalLabel({ owner_id: ID_A, festival_name: 'X', owner_username: null, my_role: null }, ID_B), 'X · by someone · Viewer');
});

test('editors never send the task assignments either; admins do', () => {
  const { ACCOUNT_ASSIGNMENTS_KEY } = require('../rules/account-rules.js');
  const storage = fakeStorage({ [ACCOUNT_ASSIGNMENTS_KEY]: '{"groups":{},"steps":{}}', 'festival-work-board-status-v1': '{}' });
  const editor = sectionsToSave({ storage, dirtyKeys: ['*'], role: 'Editor' });
  assert.deepEqual(editor.changes, { 'festival-work-board-status-v1': '{}' }, 'editors still save task statuses');
  assert.deepEqual(editor.skipped, [ACCOUNT_ASSIGNMENTS_KEY]);
  assert.deepEqual(Object.keys(sectionsToSave({ storage, dirtyKeys: [ACCOUNT_ASSIGNMENTS_KEY], role: 'Admin' }).changes),
    [ACCOUNT_ASSIGNMENTS_KEY]);
});
