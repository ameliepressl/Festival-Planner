// Checks for accounts and for keeping the plan in the account (rules/account-rules.js),
// see feature-plans/login.md.
// Run with:  uvx --from nodejs-wheel node --test

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SESSION_STORAGE_KEY, ACCOUNT_META_KEY, usernameProblem, emailProblem, passwordProblem,
  signUpProblem, signInProblem, usernameKey, accountErrorMessage, isFestivalDataKey,
  collectFestivalData, cleanFestivalData, hasFestivalData, clearFestivalData, applyFestivalData,
  parseAccountMeta, syncAction, teammateFromRows
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
  assert.deepEqual(parseAccountMeta(JSON.stringify({ userId: ID_A, syncedAt: '2026-11-19T12:00:00Z', dirty: true })),
    { userId: ID_A, syncedAt: '2026-11-19T12:00:00Z', dirty: true, legacy: false });
  assert.deepEqual(parseAccountMeta('{"userId":5,"dirty":"yes"}'), { userId: null, syncedAt: null, dirty: false, legacy: false });
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
