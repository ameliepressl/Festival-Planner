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
  if (status === 0 || code === 'network' || message.includes('failed to fetch') || message.includes('network')) {
    return 'Cannot reach the account service. Check your internet connection and try again.';
  }
  return 'Something went wrong. Please try again.';
}

// --- Which data belongs to the festival plan -----------------------------------------

function isFestivalDataKey(key) {
  return typeof key === 'string' && key.startsWith(FESTIVAL_KEY_PREFIX);
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
  for (const key of festivalKeys(storage)) {
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
    if (isFestivalDataKey(key) && typeof value === 'string') clean[key] = value;
  }
  return clean;
}

function hasFestivalData(data) {
  return Object.keys(cleanFestivalData(data)).length > 0;
}

// Removes the plan from this browser (signing out, or before loading another plan).
// Login session and other data are not touched.
function clearFestivalData(storage) {
  for (const key of festivalKeys(storage)) storage.removeItem(key);
}

// Replaces the plan in this browser with the given plan.
function applyFestivalData(storage, data) {
  clearFestivalData(storage);
  const clean = cleanFestivalData(data);
  for (const [key, value] of Object.entries(clean)) storage.setItem(key, value);
  return Object.keys(clean).length;
}

// --- Keeping browser and account in step ---------------------------------------------

// meta = { userId, syncedAt, dirty, legacy } saved under ACCOUNT_META_KEY.
//   userId   account the plan in this browser belongs to (null = nobody signed in)
//   syncedAt updated_at of the account's plan when browser and account were last equal
//   dirty    the browser has changes that are not saved to the account yet
//   legacy   the browser held a plan from before accounts existed
function parseAccountMeta(text) {
  try {
    const meta = JSON.parse(text);
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
    return {
      userId: typeof meta.userId === 'string' ? meta.userId : null,
      syncedAt: typeof meta.syncedAt === 'string' ? meta.syncedAt : null,
      dirty: meta.dirty === true,
      legacy: meta.legacy === true
    };
  } catch {
    return null;
  }
}

// What to do right after signing in or opening the app while signed in.
//   cloud: the account's festival row ({ updatedAt }) or null if the account has none yet.
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
  const ownedByThisUser = Boolean(meta && meta.userId === userId);
  if (!ownedByThisUser && meta?.legacy && hasFestivalData(localData)) return 'choose';
  if (!cloud) return ownedByThisUser || !meta?.userId ? 'create' : 'create-empty';
  if (!ownedByThisUser) return 'download';
  if (meta.dirty) return 'upload';
  if (cloud.updatedAt !== meta.syncedAt) return 'download';
  return 'keep';
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
    FESTIVAL_KEY_PREFIX, SESSION_STORAGE_KEY, ACCOUNT_META_KEY, PASSWORD_MIN, PASSWORD_MAX,
    usernameProblem, emailProblem, passwordProblem, signUpProblem, signInProblem, usernameKey,
    accountErrorMessage, isFestivalDataKey, collectFestivalData, cleanFestivalData, hasFestivalData,
    clearFestivalData, applyFestivalData, parseAccountMeta, syncAction, teammateFromRows
  };
}
