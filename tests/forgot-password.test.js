// Forgot password (feature-plans/forgot-password.md): the rules, and the real sign-in screen
// (account/account.js) with a fake Supabase. No email is sent and Supabase is never contacted.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { newPasswordProblem, passwordResetRedirect, recoveryFromUrl, accountErrorMessage } = require('../rules/account-rules.js');

const ROOT = path.join(__dirname, '..');
const settle = () => new Promise(resolve => setImmediate(resolve));

// --- Rules ------------------------------------------------------------------------------

test('the new password follows the account rules and must be typed the same twice', () => {
  assert.equal(newPasswordProblem({ password: 'festival-2027', confirm: 'festival-2027' }), '');
  assert.match(newPasswordProblem({ password: 'short', confirm: 'short' }), /at least 8/);
  assert.match(newPasswordProblem({ password: 'a'.repeat(73), confirm: 'a'.repeat(73) }), /at most 72/);
  assert.match(newPasswordProblem({ password: 'festival-2027', confirm: 'festival-2028' }), /do not match/);
  assert.match(newPasswordProblem(), /at least 8/);
});

test('the reset link leads back to this page without its address extras', () => {
  assert.equal(passwordResetRedirect({ origin: 'https://ameliepressl.github.io', pathname: '/Festival-Planner/' }),
    'https://ameliepressl.github.io/Festival-Planner/');
  assert.equal(passwordResetRedirect({ origin: 'http://localhost:8000', pathname: '/', hash: '#top', search: '?x=1' }),
    'http://localhost:8000/');
});

test('a page opened from a reset email is recognised; normal addresses are not', () => {
  assert.deepEqual(recoveryFromUrl('#access_token=abc&expires_in=3600&refresh_token=def&token_type=bearer&type=recovery'),
    { kind: 'recovery', accessToken: 'abc', refreshToken: 'def' });
  assert.deepEqual(recoveryFromUrl('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'),
    { kind: 'expired' });
  assert.deepEqual(recoveryFromUrl('#type=recovery&access_token=abc'), { kind: 'expired' }, 'incomplete link');
  for (const hash of ['', '#', '#top', '#access_token=abc&refresh_token=def&type=signup', undefined, null])
    assert.equal(recoveryFromUrl(hash), null, String(hash));
});

test('clear messages for the email service limits and reusing the old password', () => {
  assert.match(accountErrorMessage({ code: 'over_email_send_rate_limit', status: 429, message: 'email rate limit exceeded' }), /last hour/);
  assert.match(accountErrorMessage({ code: 'email_address_not_authorized', status: 400 }), /cannot send emails to this address/);
  assert.match(accountErrorMessage({ code: 'same_password', status: 422 }), /different from your old one/);
  assert.match(accountErrorMessage({ status: 429, code: 'over_request_rate_limit' }), /Too many attempts/, 'other limits unchanged');
});

// --- The real sign-in screen --------------------------------------------------------------

function signInScreen({ hash = '', search = '', session = null, auth = {} } = {}) {
  const nodes = new Map(), calls = [];
  let reloads = 0, ready = null;
  function node(selector) {
    if (!nodes.has(selector)) {
      const handlers = new Map();
      nodes.set(selector, { hidden: false, textContent: '', value: '', disabled: false, inert: false, dataset: {}, values: {},
        classList: { add() {}, remove() {}, contains() { return false; } },
        setAttribute(key, value) { this[key] = value; }, append() {},
        addEventListener(type, fn) { handlers.set(type, fn); },
        async submit() { handlers.get('submit')({ preventDefault() {}, currentTarget: this }); await settle(); },
        querySelector: inner => node(`${selector} ${inner}`) });
    }
    return nodes.get(selector);
  }
  const location = { origin: 'https://ameliepressl.github.io', pathname: '/Festival-Planner/', search, hash,
    reload() { reloads++; } };
  const client = { auth: {
    onAuthStateChange() {},
    async getSession() { calls.push(['getSession']); return { data: { session } }; },
    async resetPasswordForEmail(email, options) { calls.push(['resetPasswordForEmail', email, options]); return { error: null }; },
    async setSession(tokens) { calls.push(['setSession', tokens]); return { data: {}, error: null }; },
    async updateUser(changes) { calls.push(['updateUser', changes]); return { data: {}, error: null }; },
    async verifyOtp(params) { calls.push(['verifyOtp', params]); return { data: {}, error: null }; },
    ...auth } };
  const context = vm.createContext({
    window: { localStorage: new Map(), location, supabase: { createClient: () => client }, addEventListener() {}, dispatchEvent() {},
      FESTIVAL_SUPABASE: { url: 'https://isolated-test.invalid', publishableKey: 'public-placeholder-for-isolated-tests' } },
    history: { replaceState(state, title, url) { calls.push(['replaceState', url]); location.hash = ''; if (!String(url).includes('?')) location.search = ''; } },
    Storage: class { setItem() {} removeItem() {} },
    document: { documentElement: { classList: { add() {}, remove() {}, contains() { return false; } } },
      querySelector: node, querySelectorAll() { return []; },
      addEventListener(type, fn) { if (type === 'DOMContentLoaded') ready = fn; else if (type !== 'visibilitychange') throw new Error(type); } },
    FormData: class { constructor(form) { this.form = form; } entries() { return Object.entries(this.form.values); } },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    setTimeout() { return 1; }, clearTimeout() {}, setInterval() { return 1; }, clearInterval() {}, TextEncoder, URLSearchParams, console });
  context.window.localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'rules/account-rules.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'account/account.js'), 'utf8'), context, { filename: 'account/account.js' });
  ready();
  const plain = value => JSON.parse(JSON.stringify(value));
  return { node, get calls() { return plain(calls); }, location, reloads: () => reloads,
    shown: () => ['sign-in', 'sign-up', 'forgot', 'new-password'].filter(name => !node(`#${name}-form`).hidden) };
}

test('"Forgot your password?" sends a reset link back to this page without saying whether the account exists', async () => {
  const ui = signInScreen();
  await settle();
  assert.deepEqual(ui.shown(), ['sign-in']);
  ui.node('#sign-in-form input[name="email"]').value = ' kira@novasbe.pt ';
  ui.node('#forgot-password').onclick();
  assert.deepEqual(ui.shown(), ['forgot']);
  assert.equal(ui.node('#account-title').textContent, 'Reset your password');
  assert.equal(ui.node('.account-tabs').hidden, true);
  assert.equal(ui.node('#forgot-form input[name="email"]').value, 'kira@novasbe.pt', 'the typed email is carried over');

  const form = ui.node('#forgot-form');
  form.values = { email: 'not-an-email' };
  await form.submit();
  assert.match(ui.node('#forgot-form .form-message').textContent, /valid email/);
  assert.equal(ui.calls.some(([name]) => name === 'resetPasswordForEmail'), false);

  form.values = { email: ' kira@novasbe.pt ' };
  await form.submit();
  assert.deepEqual(ui.calls.find(([name]) => name === 'resetPasswordForEmail'),
    ['resetPasswordForEmail', 'kira@novasbe.pt', { redirectTo: 'https://ameliepressl.github.io/Festival-Planner/' }]);
  assert.match(ui.node('#forgot-form .form-message').textContent, /If an account exists for this email/);

  ui.node('#back-to-sign-in').onclick();
  assert.deepEqual(ui.shown(), ['sign-in']);
  assert.equal(ui.node('.account-tabs').hidden, false);
});

test('the service limit is explained instead of pretending the email was sent', async () => {
  const ui = signInScreen({ auth: { async resetPasswordForEmail() {
    return { error: { code: 'over_email_send_rate_limit', status: 429, message: 'email rate limit exceeded' } }; } } });
  await settle();
  ui.node('#forgot-password').onclick();
  ui.node('#forgot-form').values = { email: 'vicky@novasbe.pt' };
  await ui.node('#forgot-form').submit();
  assert.match(ui.node('#forgot-form .form-message').textContent, /Too many emails/);
});

test('the link from the email opens "Choose a new password", removes the tokens from the address and saves the password', async () => {
  const ui = signInScreen({ hash: '#access_token=abc&expires_in=3600&refresh_token=def&token_type=bearer&type=recovery' });
  await settle();
  assert.deepEqual(ui.calls[0], ['replaceState', '/Festival-Planner/'], 'tokens are removed first');
  assert.deepEqual(ui.calls[1], ['setSession', { access_token: 'abc', refresh_token: 'def' }]);
  assert.equal(ui.calls.some(([name]) => name === 'getSession'), false, 'the festival is not opened yet');
  assert.deepEqual(ui.shown(), ['new-password']);
  assert.equal(ui.node('#account-title').textContent, 'Choose a new password');

  const form = ui.node('#new-password-form');
  form.values = { password: 'festival-2027', confirm: 'festival-2028' };
  await form.submit();
  assert.match(ui.node('#new-password-form .form-message').textContent, /do not match/);
  assert.equal(ui.calls.some(([name]) => name === 'updateUser'), false);

  form.values = { password: 'festival-2027', confirm: 'festival-2027' };
  await form.submit();
  assert.deepEqual(ui.calls.at(-1), ['updateUser', { password: 'festival-2027' }]);
  assert.equal(ui.reloads(), 1, 'the app then opens signed in');
});

test('reusing the old password is refused with a clear message and no reload', async () => {
  const ui = signInScreen({ hash: '#access_token=abc&refresh_token=def&type=recovery',
    auth: { async updateUser() { return { error: { code: 'same_password', status: 422 } }; } } });
  await settle();
  ui.node('#new-password-form').values = { password: 'festival-2027', confirm: 'festival-2027' };
  await ui.node('#new-password-form').submit();
  assert.match(ui.node('#new-password-form .form-message').textContent, /different from your old one/);
  assert.equal(ui.reloads(), 0);
});

test('an expired, used or rejected link offers to request a new one', async () => {
  for (const setup of [
    { hash: '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired' },
    { hash: '#access_token=old&refresh_token=used&type=recovery',
      auth: { async setSession() { return { data: {}, error: { code: 'refresh_token_already_used', status: 400 } }; } } },
    { hash: '#access_token=old&refresh_token=used&type=recovery', auth: { async setSession() { throw new Error('offline'); } } }
  ]) {
    const ui = signInScreen(setup);
    await settle();
    assert.deepEqual(ui.shown(), ['forgot'], setup.hash);
    assert.match(ui.node('#forgot-form .form-message').textContent, /expired or was already used/);
    assert.equal(ui.location.hash, '');
    assert.equal(ui.calls.some(([name]) => name === 'getSession'), false);
  }
});

test('a normal visit still checks the session as before', async () => {
  const ui = signInScreen({ hash: '#top' });
  await settle();
  assert.deepEqual(ui.calls, [['getSession']]);
  assert.deepEqual(ui.shown(), ['sign-in']);
});

// --- Waiting a minute between two reset emails (seen on the live app, 22 November) ---------

test('asking again within a minute says how long to wait, not that the hourly limit was reached', () => {
  const perPerson = { code: 'over_email_send_rate_limit', status: 429,
    message: 'For security purposes, you can only request this after 25 seconds.' };
  assert.equal(accountErrorMessage(perPerson), 'An email was just sent. Please wait 25 seconds before requesting another one.');
  assert.doesNotMatch(accountErrorMessage(perPerson), /last hour/);
  assert.match(accountErrorMessage({ ...perPerson, message: 'For security purposes, you can only request this after 1 second.' }),
    /wait 1 second before/);
  assert.match(accountErrorMessage({ code: 'over_email_send_rate_limit', status: 429, message: 'email rate limit exceeded' }),
    /last hour/, 'the hourly limit keeps its own message');
});

test('the reset form shows the waiting message from Supabase', async () => {
  const ui = signInScreen({ auth: { async resetPasswordForEmail() {
    return { error: { code: 'over_email_send_rate_limit', status: 429,
      message: 'For security purposes, you can only request this after 25 seconds.' } }; } } });
  await settle();
  ui.node('#forgot-password').onclick();
  ui.node('#forgot-form').values = { email: 'amelie@novasbe.pt' };
  await ui.node('#forgot-form').submit();
  assert.match(ui.node('#forgot-form .form-message').textContent, /Please wait 25 seconds/);
});

// --- Reset links that mail scanners cannot use up (23 November) ----------------------------
// Microsoft Safe Links (@novasbe.pt) opened every reset link ~15 seconds after it was sent,
// which used up the one-time token before the person clicked ("expired"). Scanner-safe
// links point to the app with ?token_hash=…; the token is redeemed only on "Save new password".

const HASH = 'pkce_0123456789abcdef0123456789abcdef0123456789abcdef01234567';

test('a scanner-safe reset link is recognised; anything else is not', () => {
  const { recoveryTokenFromQuery, resetLinkUsedUp } = require('../rules/account-rules.js');
  assert.equal(recoveryTokenFromQuery(`?token_hash=${HASH}&type=recovery`), HASH);
  assert.equal(recoveryTokenFromQuery(`token_hash=${HASH}&type=recovery`), HASH);
  for (const search of ['', '?', '?type=recovery', `?token_hash=${HASH}&type=signup`, `?token_hash=${HASH}`,
    '?token_hash=<script>&type=recovery', '?token_hash=short&type=recovery', undefined, null])
    assert.equal(recoveryTokenFromQuery(search), null, String(search));
  assert.equal(resetLinkUsedUp({ code: 'otp_expired', status: 403 }), true);
  assert.equal(resetLinkUsedUp({ status: 403, message: 'Email link is invalid or has expired' }), true);
  assert.equal(resetLinkUsedUp({ status: 0, message: 'Failed to fetch' }), false);
});

test('opening the link (as a mail scanner does) redeems nothing and removes the token from the address', async () => {
  const ui = signInScreen({ search: `?token_hash=${HASH}&type=recovery` });
  await settle();
  assert.deepEqual(ui.calls, [['replaceState', '/Festival-Planner/']]);
  assert.equal(ui.location.search, '');
  assert.deepEqual(ui.shown(), ['new-password']);
  assert.equal(ui.node('#account-title').textContent, 'Choose a new password');
});

test('saving the new password redeems the link first, then changes the password and opens the app', async () => {
  const ui = signInScreen({ search: `?token_hash=${HASH}&type=recovery` });
  await settle();
  const form = ui.node('#new-password-form');
  form.values = { password: 'festival-2027', confirm: 'festival-2028' };
  await form.submit();
  assert.equal(ui.calls.some(([name]) => name === 'verifyOtp'), false, 'mismatched passwords do not use up the link');
  form.values = { password: 'festival-2027', confirm: 'festival-2027' };
  await form.submit();
  assert.deepEqual(ui.calls.slice(1), [
    ['verifyOtp', { token_hash: HASH, type: 'recovery' }],
    ['updateUser', { password: 'festival-2027' }]
  ]);
  assert.equal(ui.reloads(), 1);
});

test('a link that really expired or was already used offers a new one', async () => {
  const ui = signInScreen({ search: `?token_hash=${HASH}&type=recovery`,
    auth: { async verifyOtp() { return { data: {}, error: { code: 'otp_expired', status: 403, message: 'Email link is invalid or has expired' } }; } } });
  await settle();
  ui.node('#new-password-form').values = { password: 'festival-2027', confirm: 'festival-2027' };
  await ui.node('#new-password-form').submit();
  assert.deepEqual(ui.shown(), ['forgot']);
  assert.match(ui.node('#forgot-form .form-message').textContent, /expired or was already used/);
  assert.equal(ui.calls.some(([name]) => name === 'updateUser'), false);
});

test('offline while saving: the link stays usable for the next try', async () => {
  let attempt = 0;
  const ui = signInScreen({ search: `?token_hash=${HASH}&type=recovery`, auth: { async verifyOtp(params) {
    attempt++;
    return attempt === 1 ? { data: {}, error: { status: 0, message: 'Failed to fetch' } } : { data: {}, error: null }; } } });
  await settle();
  const form = ui.node('#new-password-form');
  form.values = { password: 'festival-2027', confirm: 'festival-2027' };
  await form.submit();
  assert.deepEqual(ui.shown(), ['new-password']);
  assert.notEqual(ui.node('#new-password-form .form-message').textContent, '');
  await form.submit();
  assert.equal(attempt, 2);
  assert.deepEqual(ui.calls.at(-1), ['updateUser', { password: 'festival-2027' }]);
  assert.equal(ui.reloads(), 1);
});

test('after the link is redeemed, a refused password can be retried without the link', async () => {
  let verified = 0, updates = 0;
  const ui = signInScreen({ search: `?token_hash=${HASH}&type=recovery`, auth: {
    async verifyOtp() { verified++; return { data: {}, error: null }; },
    async updateUser() { updates++; return updates === 1 ? { data: {}, error: { code: 'same_password', status: 422 } } : { data: {}, error: null }; } } });
  await settle();
  const form = ui.node('#new-password-form');
  form.values = { password: 'festival-2027', confirm: 'festival-2027' };
  await form.submit();
  assert.match(ui.node('#new-password-form .form-message').textContent, /different from your old one/);
  form.values = { password: 'festival-2028', confirm: 'festival-2028' };
  await form.submit();
  assert.equal(verified, 1, 'the link is redeemed once');
  assert.equal(updates, 2);
  assert.equal(ui.reloads(), 1);
});

test('the confirmation after requesting a link mentions the delay and the junk folder', async () => {
  const ui = signInScreen();
  await settle();
  ui.node('#forgot-password').onclick();
  ui.node('#forgot-form').values = { email: 'kira@novasbe.pt' };
  await ui.node('#forgot-form').submit();
  assert.match(ui.node('#forgot-form .form-message').textContent, /few minutes.*junk/);
});
