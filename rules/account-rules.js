// Rules for accounts and for keeping a festival plan in the signed-in account.
// No screen code here: account/account.js uses these functions and
// tests/account-rules.test.js checks them. See feature-plans/login.md.

// Every page saves its data in the browser under a key that starts with "festival-".
// Exactly these keys make up one festival plan and are copied to and from the account.
const FESTIVAL_KEY_PREFIX = 'festival-';
// Where Supabase keeps the login session in the browser (not festival data).
const SESSION_STORAGE_KEY = 'sb-festival-architect-auth';
// Which account the plan in this browser belongs to, and whether it still has to be saved.
const ACCOUNT_META_KEY = 'fa-account-sync';
// A short-lived marker prevents another tab reading/writing a half-replaced plan.
// Contains context identifiers only, never plan data or an authentication session.
const ACCOUNT_TRANSITION_KEY = 'fa-account-transition';
// The team roster (Settings → Team). It is not part of the saved plan: the database's
// list of members is the truth, and the roster is filled from it (feature-plans/shared-festivals.md).
const ACCOUNT_TEAM_KEY = 'festival-architect-team-v1';
// The finance assumptions. Only Admins may change them (Kira's "budget" right).
const ACCOUNT_FINANCE_KEY = 'festival-architect-finance';
const ACCOUNT_ASSIGNMENTS_KEY = 'festival-task-assignments-v1';
// Sections only the owner and Admins may change; the database refuses Editors (migrations/003, 004).
const ACCOUNT_ADMIN_ONLY_KEYS = Object.freeze([ACCOUNT_FINANCE_KEY, ACCOUNT_ASSIGNMENTS_KEY]);
const ACCOUNT_ROLES = ['Admin', 'Editor', 'Viewer'];
// How many festivals one account may own (the database enforces the same limit, migrations/005).
const MAX_OWN_FESTIVALS = 20;

const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,32}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72; // Supabase stores passwords with bcrypt, which reads at most 72 bytes
const ACCOUNT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// --- Checking what people type -------------------------------------------------------

function usernameProblem(username) {
  if (typeof username !== 'string' || !USERNAME_PATTERN.test(username)) {
    return 'Choose a username of 3–32 letters, numbers, dots, dashes or underscores.';
  }
  return '';
}

function emailProblem(email) {
  if (typeof email !== 'string' || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return 'Enter a valid email address.';
  }
  return '';
}

function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN) {
    return `Use a password of at least ${PASSWORD_MIN} characters.`;
  }
  if (new TextEncoder().encode(password).length > PASSWORD_MAX) {
    return `Use a password of at most ${PASSWORD_MAX} characters.`;
  }
  return '';
}

// First problem with a sign-up, or '' when everything may be sent.
function signUpProblem({ username, email, password } = {}) {
  return usernameProblem(username) || emailProblem(email) || passwordProblem(password);
}

// First problem with a sign-in, or ''. Only checks that something sensible was typed:
// whether the password is right is decided by Supabase.
function signInProblem({ email, password } = {}) {
  if (emailProblem(email)) return 'Enter a valid email address.';
  if (typeof password !== 'string' || password.length === 0) return 'Enter your password.';
  return '';
}

// "Vicky", " vicky " and "VICKY" are the same username.
function usernameKey(username) {
  return typeof username === 'string' ? username.trim().toLowerCase() : '';
}

// Turns an error from Supabase into a sentence the organiser understands.
function accountErrorMessage(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  const status = Number(error?.status);
  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return 'Email or password is wrong.';
  }
  if (code === 'user_already_exists' || code === 'email_exists' || message.includes('already registered')) {
    return 'An account with this email already exists. Sign in instead.';
  }
  if (message.includes('database error saving new user')) {
    return 'This username is already taken. Choose another one.';
  }
  if (code === 'weak_password' || message.includes('password should')) {
    return `Choose a stronger password (at least ${PASSWORD_MIN} characters).`;
  }
  if (code === 'email_not_confirmed') {
    return 'Confirm your email first (check your inbox), then sign in.';
  }
  if (status === 429 || code.includes('rate_limit')) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  // Several festivals per account (migrations/005_several_festivals.sql)
  if (message.includes('festivals_one_per_account')) {
    return 'Several festivals need a database update first: run migrations/005_several_festivals.sql in the Supabase SQL Editor (Amelie).';
  }
  if (code === '54000' || message.includes('at most 20 festivals')) {
    return `You already have ${MAX_OWN_FESTIVALS} festivals. Delete one you no longer need (Settings → This festival) first.`;
  }
  if (status === 0 || code === 'network' || message.includes('failed to fetch') || message.includes('network')) {
    return 'Cannot reach the account service. Check your internet connection and try again.';
  }
  return 'Something went wrong. Please try again.';
}

// --- Which data belongs to the festival plan -----------------------------------------

function isFestivalDataKey(key) {
  return typeof key === 'string' && key.startsWith(FESTIVAL_KEY_PREFIX);
}

// A festival key that is saved as part of the plan (everything except the team roster).
function isSyncedKey(key) {
  return isFestivalDataKey(key) && key !== ACCOUNT_TEAM_KEY;
}

function festivalKeys(storage) {
  const keys = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (isFestivalDataKey(key)) keys.push(key);
  }
  return keys.sort();
}

// The whole plan as one object { key: saved text }, ready to store in the account.
function collectFestivalData(storage) {
  const data = {};
  for (const key of festivalKeys(storage).filter(isSyncedKey)) {
    const value = storage.getItem(key);
    if (typeof value === 'string') data[key] = value;
  }
  return data;
}

// Keeps only festival keys with text values, so broken or foreign data is never written.
function cleanFestivalData(data) {
  const clean = {};
  if (!data || typeof data !== 'object' || Array.isArray(data)) return clean;
  for (const [key, value] of Object.entries(data)) {
    if (isSyncedKey(key) && typeof value === 'string') clean[key] = value;
  }
  return clean;
}

function hasFestivalData(data) {
  return Object.keys(cleanFestivalData(data)).length > 0;
}

// Removes the plan, including the team roster, from this browser (signing out, or before
// loading another plan). Login session and other data are not touched.
function clearFestivalData(storage) {
  for (const key of festivalKeys(storage)) storage.removeItem(key);
}

// Replaces the plan in this browser with the given plan.
function applyFestivalData(storage, data, { roster = [], accountMeta, recoverTransition } = {}) {
  const clean = cleanFestivalData(data);
  const previousTransition = storage.getItem(ACCOUNT_TRANSITION_KEY);
  if (previousTransition !== null && previousTransition !== recoverTransition) {
    throw new Error('Another festival change is unfinished. Reload and recover the saved festival before continuing.');
  }
  const previous = new Map(festivalKeys(storage).map(key => [key, storage.getItem(key)]));
  if (accountMeta !== undefined) previous.set(ACCOUNT_META_KEY, storage.getItem(ACCOUNT_META_KEY));
  const next = { ...clean };
  if (roster.length) next[ACCOUNT_TEAM_KEY] = JSON.stringify(roster);
  if (accountMeta !== undefined) next[ACCOUNT_META_KEY] = JSON.stringify(accountMeta);
  const before = parseAccountMeta(storage.getItem(ACCOUNT_META_KEY));
  storage.setItem(ACCOUNT_TRANSITION_KEY, JSON.stringify({
    version: 1, startedAt: Date.now(), nonce: Math.random().toString(36).slice(2),
    before: { userId: before?.userId || null, festivalId: before?.festivalId || null },
    after: { userId: (accountMeta === undefined ? before?.userId : accountMeta.userId) ?? null,
      festivalId: (accountMeta === undefined ? before?.festivalId : accountMeta.festivalId) ?? null }
  }));
  try {
    clearFestivalData(storage);
    for (const [key, value] of Object.entries(next)) storage.setItem(key, value);
    storage.removeItem(ACCOUNT_TRANSITION_KEY);
    return Object.keys(clean).length;
  } catch (cause) {
    let restored = true;
    try {
      for (const key of festivalKeys(storage)) if (!previous.has(key)) storage.removeItem(key);
      for (const [key, value] of previous) {
        if (key === ACCOUNT_META_KEY) continue;
        if (storage.getItem(key) !== value) {
          if (value === null) storage.removeItem(key);
          else storage.setItem(key, value);
        }
      }
      // Publish the old association only after all its sections are restored.
      if (previous.has(ACCOUNT_META_KEY)) {
        const value = previous.get(ACCOUNT_META_KEY);
        if (storage.getItem(ACCOUNT_META_KEY) !== value) {
          if (value === null) storage.removeItem(ACCOUNT_META_KEY);
          else storage.setItem(ACCOUNT_META_KEY, value);
        }
      }
      if (previousTransition === null) storage.removeItem(ACCOUNT_TRANSITION_KEY);
      else storage.setItem(ACCOUNT_TRANSITION_KEY, previousTransition);
    } catch { restored = false; }
    const error = new Error(restored
      ? 'Could not load the festival in browser storage. Your previous browser data was restored.'
      : 'Could not load or restore the festival in browser storage. Keep this page open and try again.');
    error.cause = cause;
    error.restored = restored;
    throw error;
  }
}

// --- Keeping browser and account in step ---------------------------------------------

// meta = { userId, festivalId, syncedAt, dirtyKeys, legacy, access } saved under ACCOUNT_META_KEY.
//   userId     account the plan in this browser belongs to (null = nobody signed in)
//   festivalId the festival that is open (the account's own one or a shared one)
//   syncedAt   updated_at of that festival when browser and account were last equal
//   dirtyKeys  sections changed in the browser but not saved yet ('*' = all of them)
//   legacy     the browser held a plan from before accounts existed
//   access     { role, creatorLabel } the pages were started with (see accessFor)
function parseAccountMeta(text) {
  try {
    const meta = JSON.parse(text);
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
    let dirtyKeys = Array.isArray(meta.dirtyKeys)
      ? [...new Set(meta.dirtyKeys.filter((key) => key === '*' || isSyncedKey(key)))]
      : [];
    if (meta.dirty === true && dirtyKeys.length === 0) dirtyKeys = ['*'];   // saved by the first login version
    return {
      userId: typeof meta.userId === 'string' ? meta.userId : null,
      festivalId: typeof meta.festivalId === 'string' && ACCOUNT_ID_PATTERN.test(meta.festivalId) ? meta.festivalId : null,
      syncedAt: typeof meta.syncedAt === 'string' ? meta.syncedAt : null,
      dirtyKeys,
      dirty: dirtyKeys.length > 0,
      legacy: meta.legacy === true,
      access: parseAccess(meta.access),
      ...(meta.teamDirty === true ? {
        teamDirty: true,
        teamBase: rosterFromTeam((Array.isArray(meta.teamBase) ? meta.teamBase : []).map(member => ({
          user_id: member?.userId, username: member?.username, role: member?.role
        })))
      } : {})
    };
  } catch {
    return null;
  }
}

function parseAccess(access) {
  if (!access || !ACCOUNT_ROLES.includes(access.role) || typeof access.creatorLabel !== 'string') return null;
  return { role: access.role, creatorLabel: access.creatorLabel };
}

// What to do right after signing in or opening the app while signed in.
//   cloud: the festival to open ({ id, updatedAt }) or null if the account has none yet.
// Returns
//   'create'       the account has no plan yet → save the browser's plan as its plan
//   'create-empty' the account has no plan yet, but the browser holds another account's
//                  plan → start the account with an empty plan instead
//   'choose'       this browser holds a plan from before accounts → ask which plan to use
//   'download'     the browser holds another account's plan, or the account's plan is newer
//                  (changed on another device) → replace the browser's plan
//   'upload'       the browser has changes that are not saved yet → save them (last save wins)
//   'keep'         browser and account are equal
function syncAction({ meta, userId, cloud, localData }) {
  const sameFestival = !meta?.festivalId || !cloud || meta.festivalId === cloud.id;
  const ownedByThisUser = Boolean(meta && meta.userId === userId && sameFestival);
  if (!ownedByThisUser && meta?.legacy && hasFestivalData(localData)) return 'choose';
  if (!cloud) {
    // Keep the browser's plan only if it is this account's own, older plan. A plan of a
    // shared festival or of another account must not become this account's festival.
    const ownOldPlan = meta?.userId === userId && !meta.festivalId;
    return ownOldPlan || !meta?.userId ? 'create' : 'create-empty';
  }
  if (!ownedByThisUser) return 'download';
  if (meta.dirty || meta.teamDirty) return 'upload';
  if (cloud.updatedAt !== meta.syncedAt) return 'download';
  return 'keep';
}

// --- Sharing a festival -----------------------------------------------------------------

// What the signed-in account may do in the open festival. Owners are Admins.
//   { ownerId, ownerUsername, myRole } come from the database (my_festivals()).
// Returns { role, creatorLabel } for rules/access-rules.js.
function accessFor({ ownerId, ownerUsername, myRole }, userId) {
  if (ownerId === userId) return { role: 'Admin', creatorLabel: 'You (festival creator)' };
  const role = ACCOUNT_ROLES.includes(myRole) ? myRole : 'Viewer';
  const owner = usernameProblem(ownerUsername) ? 'Owner' : ownerUsername;
  return { role, creatorLabel: `${owner} (festival creator)` };
}

function sameAccess(a, b) {
  return Boolean(a && b && a.role === b.role && a.creatorLabel === b.creatorLabel);
}

// The sections of the plan to send after changes, as the role allows.
//   Viewers send nothing; Editors never send the finances or the task assignments;
//   the team roster is never sent.
// Returns { changes: { key: text }, removed: [key], skipped: [key] }.
function sectionsToSave({ storage, dirtyKeys, role }) {
  const result = { changes: {}, removed: [], skipped: [] };
  const keys = dirtyKeys.includes('*') ? festivalKeys(storage).filter(isSyncedKey) : dirtyKeys.filter(isSyncedKey);
  for (const key of [...new Set(keys)].sort()) {
    if (role === 'Viewer' || (role === 'Editor' && ACCOUNT_ADMIN_ONLY_KEYS.includes(key))) {
      result.skipped.push(key);
      continue;
    }
    const value = storage.getItem(key);
    if (typeof value === 'string') result.changes[key] = value;
    else result.removed.push(key);
  }
  return result;
}

// Capture the revision of each section, not just one revision for the whole page.
// An edit to the checklist during a lineup save must not resend the old lineup.
function captureSaveBatch({ storage, dirtyKeys, role, revisions = {}, userId, festivalId }) {
  const sections = sectionsToSave({ storage, dirtyKeys, role });
  const keys = [...new Set([...Object.keys(sections.changes), ...sections.removed, ...sections.skipped])];
  return { ...sections, userId, festivalId, keys,
    revisions: Object.fromEntries(keys.map(key => [key, revisions[key] || 0])) };
}

function sameFestivalContext(a, b) {
  return Boolean(a && b && a.userId === b.userId && a.festivalId === b.festivalId);
}

function acknowledgeSaveBatch({ batch, userId, festivalId, dirtyKeys, revisions = {}, currentKeys = [] }) {
  if (!sameFestivalContext(batch, { userId, festivalId })) return [...dirtyKeys];
  const pending = new Set(dirtyKeys.includes('*') ? [...currentKeys, ...batch.keys, ...Object.keys(revisions)] : dirtyKeys);
  for (const key of batch.keys) if ((revisions[key] || 0) === batch.revisions[key]) pending.delete(key);
  return [...pending];
}

// Apply only the intended team edits to a newer roster, keeping unrelated invitations.
function mergeTeamRoster(base, desired, latest) {
  const changes = teamChanges(base, desired);
  const result = new Map(latest.map(member => [member.userId, { ...member }]));
  const names = new Map(desired.map(member => [member.userId, member]));
  for (const id of changes.remove) result.delete(id);
  for (const change of [...changes.add, ...changes.change]) {
    result.set(change.userId, { ...(result.get(change.userId) || names.get(change.userId)), ...change });
  }
  return [...result.values()];
}

// The team from the database as Kira's roster: [{ userId, username, role }].
function rosterFromTeam(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => typeof row?.user_id === 'string' && ACCOUNT_ID_PATTERN.test(row.user_id)
      && !usernameProblem(row.username) && ACCOUNT_ROLES.includes(row.role))
    .map((row) => ({ userId: row.user_id, username: row.username, role: row.role }));
}

function parseRoster(text) {
  try {
    const roster = JSON.parse(text);
    return Array.isArray(roster) ? roster : [];
  } catch {
    return [];
  }
}

// What has to change in the database so it matches the roster an Admin just saved.
// Entries without a real account id (e.g. from the old local user directory) are ignored.
function teamChanges(serverRoster, roster) {
  const valid = (entry) => typeof entry?.userId === 'string' && ACCOUNT_ID_PATTERN.test(entry.userId)
    && ACCOUNT_ROLES.includes(entry.role);
  const before = new Map(serverRoster.filter(valid).map((entry) => [entry.userId, entry.role]));
  const after = new Map(roster.filter(valid).map((entry) => [entry.userId, entry.role]));
  const changes = { add: [], change: [], remove: [] };
  for (const [userId, role] of after) {
    if (!before.has(userId)) changes.add.push({ userId, role });
    else if (before.get(userId) !== role) changes.change.push({ userId, role });
  }
  for (const userId of before.keys()) if (!after.has(userId)) changes.remove.push(userId);
  return changes;
}

function sameRoster(a, b) {
  const key = (roster) => roster.map((entry) => `${entry.userId}:${entry.username}:${entry.role}`).sort().join('|');
  return key(a) === key(b);
}

// How a festival appears in the sidebar's festival switcher.
function festivalLabel(row, userId) {
  const name = typeof row?.festival_name === 'string' && row.festival_name.trim() ? row.festival_name.trim() : 'Untitled festival';
  if (row?.owner_id === userId) return `My festival · ${name}`;
  const owner = usernameProblem(row?.owner_username) ? 'someone' : row.owner_username;
  const role = ACCOUNT_ROLES.includes(row?.my_role) ? row.my_role : 'Viewer';
  return `${name} · by ${owner} · ${role}`;
}

// --- Several festivals per account (feature-plans/several-festivals.md) -------------------
// rows: what my_festivals() returned — { festival_id, owner_id, updated_at, ... }, own ones first.

function ownFestivals(rows, userId) {
  return (Array.isArray(rows) ? rows : []).filter((row) => row && row.owner_id === userId
    && typeof row.festival_id === 'string' && ACCOUNT_ID_PATTERN.test(row.festival_id));
}

// May this account start one more festival of its own (new or demo)?
function canCreateFestival(rows, userId) {
  return ownFestivals(rows, userId).length < MAX_OWN_FESTIVALS;
}

// Only the creator deletes a festival, and never their last own one: after deleting there
// must still be a festival of their own to open.
function canDeleteFestival(rows, userId, festivalId) {
  const own = ownFestivals(rows, userId);
  return own.length >= 2 && own.some((row) => row.festival_id === festivalId);
}

// The festival to open after deleting one: the most recently changed other own festival,
// otherwise any other festival. null if there is none.
function festivalAfterDelete(rows, userId, deletedId) {
  const others = (Array.isArray(rows) ? rows : []).filter((row) => row && row.festival_id !== deletedId
    && typeof row.festival_id === 'string' && ACCOUNT_ID_PATTERN.test(row.festival_id));
  const newest = (list) => [...list].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))[0] || null;
  return newest(others.filter((row) => row.owner_id === userId)) || newest(others);
}

// --- Finding teammates -----------------------------------------------------------------

// rows: what Supabase returned for a username. Exactly one valid row means "found".
function teammateFromRows(rows) {
  if (!Array.isArray(rows) || rows.length !== 1) return null;
  const [row] = rows;
  if (typeof row?.id !== 'string' || !ACCOUNT_ID_PATTERN.test(row.id)) return null;
  if (usernameProblem(row.username)) return null;
  return { id: row.id, username: row.username };
}

// In the browser these are plain globals; in the tests (Node) they are exported.
if (typeof module !== 'undefined') {
  module.exports = {
    FESTIVAL_KEY_PREFIX, SESSION_STORAGE_KEY, ACCOUNT_META_KEY, ACCOUNT_TRANSITION_KEY, ACCOUNT_TEAM_KEY, ACCOUNT_FINANCE_KEY,
    ACCOUNT_ASSIGNMENTS_KEY, ACCOUNT_ADMIN_ONLY_KEYS,
    ACCOUNT_ROLES, PASSWORD_MIN, PASSWORD_MAX, isSyncedKey, accessFor, sameAccess, sectionsToSave,
    captureSaveBatch, acknowledgeSaveBatch, sameFestivalContext, mergeTeamRoster,
    rosterFromTeam, parseRoster, teamChanges, sameRoster, festivalLabel,
    MAX_OWN_FESTIVALS, ownFestivals, canCreateFestival, canDeleteFestival, festivalAfterDelete,
    usernameProblem, emailProblem, passwordProblem, signUpProblem, signInProblem, usernameKey,
    accountErrorMessage, isFestivalDataKey, collectFestivalData, cleanFestivalData, hasFestivalData,
    clearFestivalData, applyFestivalData, parseAccountMeta, syncAction, teammateFromRows
  };
}
