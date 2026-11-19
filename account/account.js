// Accounts: sign in with Supabase and keep this browser's festival plan in the account.
// See feature-plans/login.md. The checks it relies on are in rules/account-rules.js.
//
// How it works, in short:
// 1. This file runs in <head>, before any page script. It hides the app until the person
//    is signed in, and it notices every save a page makes to a "festival-…" key.
// 2. After signing in, the account's plan is loaded into the browser (or created).
// 3. Every change is saved to the account a moment later. The sidebar shows the status.
// 4. Signing out removes the plan from this browser.
// The database itself (Row Level Security) makes sure each account only reaches its own plan.
(function () {
  'use strict';

  const SAVE_DELAY = 1200;        // ms to wait after a change, so a burst of edits is one save
  const RETRY_DELAY = 15000;      // ms before trying again when a save failed
  const MAX_RELOADS = 3;          // safety net against reload loops while loading a plan

  const root = document.documentElement;
  const storage = window.localStorage;
  const config = window.FESTIVAL_SUPABASE || {};
  const configured = typeof config.url === 'string' && config.url.startsWith('https://')
    && !config.url.includes('YOUR-PROJECT') && typeof config.publishableKey === 'string'
    && config.publishableKey.length > 20 && !config.publishableKey.startsWith('YOUR-');
  const client = configured && window.supabase
    ? window.supabase.createClient(config.url, config.publishableKey, {
      auth: { storageKey: SESSION_STORAGE_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    })
    : null;

  // --- 1. Before the page scripts run --------------------------------------------------

  function readMeta() {
    try { return parseAccountMeta(storage.getItem(ACCOUNT_META_KEY)); } catch { return null; }
  }
  function writeMeta() {
    try { storage.setItem(ACCOUNT_META_KEY, JSON.stringify(meta)); } catch { /* private mode: nothing to remember */ }
  }
  function localPlan() {
    try { return collectFestivalData(storage); } catch { return {}; }
  }

  let meta = readMeta();
  if (!meta) {
    // First visit since accounts exist: remember whether a plan from before is in this browser.
    meta = { userId: null, syncedAt: null, dirty: false, legacy: hasFestivalData(localPlan()) };
    writeMeta();
  }

  let sessionStored = false;
  try { sessionStored = Boolean(storage.getItem(SESSION_STORAGE_KEY)); } catch { /* storage blocked */ }
  root.classList.add(client && sessionStored ? 'account-checking' : 'account-locked');

  let currentUser = null;   // { id, username } once signed in
  let festivalId = null;    // id of the account's row in the festivals table
  let ready = false;        // true once page changes belong to the signed-in account
  let loadWrites = false;   // a page saved something while the app was still starting
  let applying = false;     // true while this file itself writes the plan
  let changeCount = 0;      // grows with every real change; detects edits during a save

  // Notice every save to a festival key. Writing the same value again is not a change.
  const nativeGetItem = Storage.prototype.getItem;
  const nativeSetItem = Storage.prototype.setItem;
  const nativeRemoveItem = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (key, value) {
    const watched = this === storage && !applying && isFestivalDataKey(String(key));
    const before = watched ? nativeGetItem.call(this, key) : null;
    nativeSetItem.call(this, key, value);
    if (watched && before !== String(value)) planChanged();
  };
  Storage.prototype.removeItem = function (key) {
    const watched = this === storage && !applying && isFestivalDataKey(String(key));
    const existed = watched && nativeGetItem.call(this, key) !== null;
    nativeRemoveItem.call(this, key);
    if (existed) planChanged();
  };

  function planChanged() {
    if (!ready) { loadWrites = true; return; }
    if (!currentUser) return;
    changeCount += 1;
    meta.dirty = true;
    writeMeta();
    setStatus('saving');
    scheduleSave(SAVE_DELAY);
  }

  function replacePlan(data) {
    applying = true;
    try { applyFestivalData(storage, data); } finally { applying = false; }
  }

  // --- 2. Talking to Supabase -----------------------------------------------------------

  async function fetchFestival() {
    const { data, error } = await client.from('festivals')
      .select('id, data, updated_at').eq('owner_id', currentUser.id).maybeSingle();
    if (error) throw error;
    return data;
  }

  async function createFestival(data) {
    const { data: row, error } = await client.from('festivals')
      .insert({ data: cleanFestivalData(data) }).select('id, updated_at').single();
    if (!error) return row;
    if (error.code === '23505') {               // created meanwhile in another tab
      const existing = await fetchFestival();
      if (existing) return existing;
    }
    throw error;
  }

  async function uploadPlan() {
    if (!festivalId) {
      const existing = await fetchFestival();
      festivalId = existing ? existing.id : (await createFestival({})).id;
    }
    const { data, error } = await client.from('festivals')
      .update({ data: localPlan() }).eq('id', festivalId).select('updated_at').single();
    if (error) {
      if (error.code === 'PGRST116') festivalId = null;   // row is gone: create it next time
      throw error;
    }
    return data.updated_at;
  }

  let saveTimer = null;
  let runningSave = null;
  function scheduleSave(delay) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, delay);
  }

  // Saves unsaved changes now. Resolves to true when the account has the latest plan.
  function saveNow() {
    clearTimeout(saveTimer);
    if (runningSave) return runningSave.then(() => (meta.dirty ? saveNow() : true));
    if (!currentUser || !client || !meta.dirty) return Promise.resolve(!meta.dirty);
    const changesBefore = changeCount;
    setStatus('saving');
    runningSave = uploadPlan()
      .then((updatedAt) => {
        meta.syncedAt = updatedAt;
        meta.dirty = changeCount !== changesBefore;   // edited while saving → save again
        writeMeta();
        if (meta.dirty) scheduleSave(SAVE_DELAY); else setStatus('saved');
        return !meta.dirty;
      })
      .catch(() => {
        setStatus('offline');
        scheduleSave(RETRY_DELAY);
        return false;
      })
      .finally(() => { runningSave = null; });
    return runningSave;
  }

  // --- 3. Starting the app --------------------------------------------------------------

  function reloadForPlan() {
    const count = Number(sessionStorage.getItem('fa-account-reloads') || 0) + 1;
    sessionStorage.setItem('fa-account-reloads', String(count));
    if (count > MAX_RELOADS) {
      showProblem('Your festival could not be loaded. Reload the page to try again.');
      sessionStorage.removeItem('fa-account-reloads');
      return;
    }
    window.location.reload();
  }

  function finishStart() {
    sessionStorage.removeItem('fa-account-reloads');
    ready = true;
    unlock();
    if (loadWrites && meta.userId === currentUser.id) {
      // pages tidied their saved data while starting: store that version too
      changeCount += 1;
      meta.dirty = true;
      writeMeta();
    }
    if (meta.dirty) saveNow(); else setStatus('saved');
  }

  function remember(row) {
    festivalId = row.id;
    meta = { userId: currentUser.id, syncedAt: row.updated_at, dirty: false, legacy: false };
    writeMeta();
  }

  async function start() {
    if (!client) {
      showSignIn();
      showProblem('Accounts are not set up yet: add the Supabase project URL and publishable key in supabase-config.js (see README → Accounts).');
      setFormsDisabled(true);
      return;
    }
    let session = null;
    try {
      const { data } = await client.auth.getSession();
      session = data.session;
    } catch { /* treated as signed out */ }
    if (!session) { showSignIn(); return; }

    const metadata = session.user.user_metadata || {};
    currentUser = { id: session.user.id, username: metadata.username || session.user.email || 'Signed in' };
    showAccountBox();

    let cloud;
    try {
      cloud = await fetchFestival();
    } catch (error) {
      if (meta.userId === currentUser.id) {
        // Offline, but this browser holds this account's plan: keep working and save later.
        finishStart();
        setStatus('offline');
        if (meta.dirty) scheduleSave(RETRY_DELAY);
        return;
      }
      showProblem(accountErrorMessage(error), true);
      return;
    }

    const action = syncAction({
      meta, userId: currentUser.id, localData: localPlan(),
      cloud: cloud ? { updatedAt: cloud.updated_at } : null
    });
    try {
      if (action === 'choose') { showChoice(cloud); return; }
      if (action === 'create') { remember(await createFestival(localPlan())); finishStart(); return; }
      if (action === 'create-empty') {
        remember(await createFestival({}));
        replacePlan({});
        reloadForPlan();
        return;
      }
      if (action === 'download') {
        replacePlan(cloud.data);
        remember(cloud);
        reloadForPlan();
        return;
      }
      festivalId = cloud.id;            // 'upload' or 'keep'
      finishStart();
    } catch (error) {
      showProblem(accountErrorMessage(error), true);
    }
  }

  // A plan from before accounts is in this browser: let the organiser pick.
  function showChoice(cloud) {
    showScreen('choice');
    $('#account-choice-text').textContent = cloud
      ? 'This browser still holds a festival plan from before accounts existed, and your account already has a plan. Which one do you want to keep? The other one is replaced.'
      : 'This browser still holds a festival plan from before accounts existed. Do you want to save it in your new account, or start with an empty plan?';
    $('#choice-use-account').textContent = cloud ? 'Use my account’s plan' : 'Start with an empty plan';
    $('#choice-use-browser').onclick = () => runChoice(async () => {
      const row = cloud ? { id: cloud.id, updated_at: cloud.updated_at } : await createFestival(localPlan());
      remember(row);
      if (cloud) { meta.dirty = true; writeMeta(); }
      finishStart();
    });
    $('#choice-use-account').onclick = () => runChoice(async () => {
      remember(cloud || await createFestival({}));
      replacePlan(cloud ? cloud.data : {});
      reloadForPlan();
    });
  }

  async function runChoice(action) {
    const buttons = document.querySelectorAll('#account-choice button');
    buttons.forEach((button) => { button.disabled = true; });
    try {
      await action();
    } catch (error) {
      showProblem(accountErrorMessage(error));
    } finally {
      buttons.forEach((button) => { button.disabled = false; });
    }
  }

  // --- 4. Sign in, create account, sign out ---------------------------------------------

  function formValues(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  async function submitForm(form, problem, send) {
    const message = form.querySelector('.form-message');
    message.textContent = problem;
    if (problem) return;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await send(message);
    } catch (error) {
      message.textContent = accountErrorMessage(error);
    } finally {
      button.disabled = false;
    }
  }

  function signIn(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const { email = '', password = '' } = formValues(form);
    const values = { email: email.trim(), password };
    submitForm(form, signInProblem(values), async (message) => {
      const { error } = await client.auth.signInWithPassword(values);
      if (error) { message.textContent = accountErrorMessage(error); return; }
      window.location.reload();
    });
  }

  function signUp(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const { username = '', email = '', password = '' } = formValues(form);
    const values = { username: username.trim(), email: email.trim(), password };
    submitForm(form, signUpProblem(values), async (message) => {
      const { data, error } = await client.auth.signUp({
        email: values.email, password: values.password, options: { data: { username: values.username } }
      });
      if (error) { message.textContent = accountErrorMessage(error); return; }
      if (!data.session) {
        showTab('sign-in');
        $('#sign-in-form .form-message').textContent = 'Account created. Confirm your email (check your inbox), then sign in.';
        return;
      }
      window.location.reload();
    });
  }

  let signingOut = false;
  let leaveUnsaved = false;
  async function signOut() {
    const button = $('#sign-out');
    if (meta.dirty && !leaveUnsaved) {
      button.disabled = true;
      const saved = await saveNow();
      button.disabled = false;
      if (!saved) {
        leaveUnsaved = true;
        button.textContent = 'Sign out without saving';
        setStatus('offline');
        return;
      }
    }
    signingOut = true;
    try { await client.auth.signOut({ scope: 'local' }); } catch { /* signed out locally below */ }
    try { storage.removeItem(SESSION_STORAGE_KEY); } catch { /* already gone */ }
    leaveBrowserClean();
  }

  // The next person using this browser must not see the plan.
  function leaveBrowserClean() {
    replacePlan({});
    meta = { userId: null, syncedAt: null, dirty: false, legacy: false };
    writeMeta();
    window.location.reload();
  }

  if (client) {
    client.auth.onAuthStateChange((event) => {
      // e.g. the session ran out and could not be renewed, or it was ended in another tab
      if (event === 'SIGNED_OUT' && currentUser && !signingOut) leaveBrowserClean();
    });
  }

  // --- 5. Finding teammates (Team form on the Overview) ---------------------------------

  window.lookupTeammate = async function lookupTeammate(username) {
    const name = typeof username === 'string' ? username.trim() : '';
    if (usernameProblem(name)) return { status: 'invalid' };
    if (!client || !currentUser) return { status: 'unavailable' };
    try {
      const { data, error } = await client.from('profiles')
        .select('id, username').eq('username_key', usernameKey(name)).limit(2);
      if (error) return { status: 'unavailable' };
      const user = teammateFromRows(data);
      return user ? { status: 'found', user } : { status: 'not-found' };
    } catch {
      return { status: 'unavailable' };
    }
  };

  // Page scripts wait with things like the first-time setup dialog until the app is shown.
  const readyCallbacks = [];
  window.whenAccountReady = function whenAccountReady(callback) {
    if (ready) callback(); else readyCallbacks.push(callback);
  };

  // --- 6. The screen --------------------------------------------------------------------

  const $ = (selector) => document.querySelector(selector);
  const STATUS_TEXT = {
    saved: 'Saved to your account',
    saving: 'Saving…',
    offline: 'Not saved yet — no connection to your account. Retrying…'
  };

  function setStatus(kind) {
    const status = $('#account-sync-status');
    if (!status) return;
    status.textContent = STATUS_TEXT[kind];
    status.dataset.state = kind;
  }

  function showScreen(name) {
    ['loading', 'forms', 'choice'].forEach((screen) => {
      $(`#account-${screen}`).hidden = screen !== name;
    });
  }

  function showTab(name) {
    ['sign-in', 'sign-up'].forEach((tab) => {
      const selected = tab === name;
      $(`#tab-${tab}`).setAttribute('aria-selected', String(selected));
      $(`#${tab}-form`).hidden = !selected;
    });
    $('#account-title').textContent = name === 'sign-in' ? 'Sign in' : 'Create your account';
  }

  function showSignIn() {
    root.classList.remove('account-checking');
    root.classList.add('account-locked');
    showScreen('forms');
    showTab('sign-in');
  }

  function showProblem(text, offerRetry = false) {
    const problem = $('#account-problem');
    problem.textContent = text;
    $('#account-retry').hidden = !offerRetry;
    if (offerRetry) showScreen('loading');
  }

  function setFormsDisabled(disabled) {
    document.querySelectorAll('#account-forms input, #account-forms button').forEach((element) => {
      element.disabled = disabled;
    });
  }

  function showAccountBox() {
    $('#account-username').textContent = currentUser.username;
    $('#sidebar-account').hidden = false;
  }

  function unlock() {
    root.classList.remove('account-locked', 'account-checking');
    $('.app-layout').inert = false;
    $('#account-screen').hidden = true;
    readyCallbacks.splice(0).forEach((callback) => callback());
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('.app-layout').inert = true;
    $('#tab-sign-in').onclick = () => showTab('sign-in');
    $('#tab-sign-up').onclick = () => showTab('sign-up');
    $('#sign-in-form').addEventListener('submit', signIn);
    $('#sign-up-form').addEventListener('submit', signUp);
    $('#sign-out').onclick = signOut;
    $('#account-retry').onclick = () => window.location.reload();
    showScreen(root.classList.contains('account-checking') ? 'loading' : 'forms');
    start();
  });

  // Save straight away when the tab is hidden or closed, so no change is lost.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && meta.dirty && ready) saveNow();
  });
}());
