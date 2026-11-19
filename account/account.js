// Accounts: sign in with Supabase, keep the open festival in step with the database, and let
// several accounts plan one festival. See feature-plans/login.md and
// feature-plans/shared-festivals.md. The checks it relies on are in rules/account-rules.js.
//
// How it works, in short:
// 1. This file runs in <head>, before any page script. It hides the app until the person is
//    signed in, tells the pages which role the account has (rules/access-rules.js), and
//    notices every save a page makes to a "festival-…" key.
// 2. After signing in, the open festival is loaded into the browser (the account's own one,
//    or a shared one picked in the sidebar). The team roster comes from the database.
// 3. Each change is saved a moment later — only the sections that changed, so teammates
//    working at the same time do not undo each other. A bar appears when a teammate saved.
// 4. Signing out removes the plan from this browser.
// The database itself (Row Level Security) enforces who may read and save what.
(function () {
  'use strict';

  const SAVE_DELAY = 1200;        // ms to wait after a change, so a burst of edits is one save
  const RETRY_DELAY = 15000;      // ms before trying again when a save failed
  const CHECK_DELAY = 20000;      // ms between checks whether a teammate saved
  const MAX_RELOADS = 3;          // safety net against reload loops while loading a plan
  const OWNER_ACCESS = Object.freeze({ role: 'Admin', creatorLabel: 'You (festival creator)' });

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
    meta.dirty = meta.dirtyKeys.length > 0;
    try { storage.setItem(ACCOUNT_META_KEY, JSON.stringify(meta)); } catch { /* private mode: nothing to remember */ }
  }
  function localPlan() {
    try { return collectFestivalData(storage); } catch { return {}; }
  }
  function localRoster() {
    try { return parseRoster(storage.getItem(ACCOUNT_TEAM_KEY)); } catch { return []; }
  }
  function emptyMeta(legacy = false) {
    return { userId: null, festivalId: null, syncedAt: null, dirtyKeys: [], dirty: false, legacy, access: null };
  }

  let meta = readMeta();
  if (!meta) {
    // First visit since accounts exist: remember whether a plan from before is in this browser.
    meta = emptyMeta(hasFestivalData(localPlan()));
    writeMeta();
  }

  // The role the pages start with (rules/access-rules.js reads it). It is checked again
  // against the database below; if it changed, the page reloads.
  const startAccess = meta.userId && meta.access ? meta.access : null;
  window.festivalAccess = startAccess;

  let sessionStored = false;
  try { sessionStored = Boolean(storage.getItem(SESSION_STORAGE_KEY)); } catch { /* storage blocked */ }
  root.classList.add(client && sessionStored ? 'account-checking' : 'account-locked');

  let currentUser = null;   // { id, username } once signed in
  let access = startAccess || OWNER_ACCESS;
  let festivals = [];       // every festival the account may open (my_festivals())
  let serverRoster = [];    // the open festival's team as the database has it
  let ready = false;        // true once page changes belong to the signed-in account
  const loadWrites = new Set();  // sections pages saved while the app was still starting
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
    if (watched && before !== String(value)) sectionChanged(String(key));
  };
  Storage.prototype.removeItem = function (key) {
    const watched = this === storage && !applying && isFestivalDataKey(String(key));
    const existed = watched && nativeGetItem.call(this, key) !== null;
    nativeRemoveItem.call(this, key);
    if (existed) sectionChanged(String(key));
  };

  function sectionChanged(key) {
    if (!ready) { loadWrites.add(key); return; }
    if (!currentUser) return;
    if (key === ACCOUNT_TEAM_KEY) { teamChanged(); return; }
    changeCount += 1;
    markUnsaved(key);
    setStatus(access.role === 'Viewer' ? 'readonly' : 'saving');
    scheduleSave(SAVE_DELAY);
  }

  function markUnsaved(key) {
    if (!meta.dirtyKeys.includes('*') && !meta.dirtyKeys.includes(key)) meta.dirtyKeys.push(key);
    writeMeta();
  }

  function replacePlan(data, roster = []) {
    applying = true;
    try {
      applyFestivalData(storage, data);
      if (roster.length) storage.setItem(ACCOUNT_TEAM_KEY, JSON.stringify(roster));
    } finally {
      applying = false;
    }
  }

  function writeRoster(roster) {
    applying = true;
    try { storage.setItem(ACCOUNT_TEAM_KEY, JSON.stringify(roster)); } finally { applying = false; }
  }

  // --- 2. Talking to Supabase -----------------------------------------------------------

  async function fetchFestival(id) {
    const { data, error } = await client.from('festivals')
      .select('id, owner_id, data, updated_at').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  async function fetchMyFestivals() {
    const { data, error } = await client.rpc('my_festivals');
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  async function fetchTeam(id) {
    const { data, error } = await client.rpc('festival_team', { festival: id });
    if (error) throw error;
    return rosterFromTeam(data);
  }

  async function createFestival(data) {
    const { data: row, error } = await client.from('festivals')
      .insert({ data: cleanFestivalData(data) }).select('id, owner_id, updated_at').single();
    if (!error) return row;
    if (error.code === '23505') {               // created meanwhile in another tab
      const own = (await fetchMyFestivals()).find((item) => item.owner_id === currentUser.id);
      if (own) return fetchFestival(own.festival_id);
    }
    throw error;
  }

  let saveTimer = null;
  let runningSave = null;
  function scheduleSave(delay) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, delay);
  }

  // Saves the changed sections now. Resolves to true when nothing is left to save.
  function saveNow() {
    clearTimeout(saveTimer);
    if (runningSave) return runningSave.then(() => (meta.dirty ? saveNow() : true));
    if (!currentUser || !client || !meta.dirty || !meta.festivalId) return Promise.resolve(!meta.dirty);

    const sections = sectionsToSave({ storage, dirtyKeys: meta.dirtyKeys, role: access.role });
    const nothingToSend = !Object.keys(sections.changes).length && !sections.removed.length;
    if (nothingToSend) {
      meta.dirtyKeys = [];
      writeMeta();
      setStatus(sections.skipped.length ? (access.role === 'Viewer' ? 'readonly' : 'partly') : 'saved');
      return Promise.resolve(true);
    }

    const changesBefore = changeCount;
    setStatus('saving');
    runningSave = client.rpc('save_festival_changes', {
      festival: meta.festivalId, changes: sections.changes, removed: sections.removed
    }).single()
      .then(({ data, error }) => {
        if (error) throw error;
        const teammateSaved = meta.syncedAt !== data.previous_saved_at;
        // A teammate saved in between: this browser lacks their sections until it reloads.
        meta.syncedAt = teammateSaved ? 'outdated' : data.saved_at;
        if (changeCount === changesBefore) meta.dirtyKeys = [];
        writeMeta();
        if (teammateSaved) showNotice('A teammate also saved this festival. Reload to see their changes — yours are saved.');
        if (meta.dirty) scheduleSave(SAVE_DELAY);
        else setStatus(sections.skipped.length ? 'partly' : 'saved');
        return !meta.dirty;
      })
      .catch((error) => {
        if (error?.code === '42501') {
          // The role was changed or the festival is no longer shared with this account.
          setStatus('readonly');
          showNotice('Your role in this festival changed, so your latest change was not saved. Reload to continue.');
          return false;
        }
        setStatus('offline');
        scheduleSave(RETRY_DELAY);
        return false;
      })
      .finally(() => { runningSave = null; });
    return runningSave;
  }

  // Every now and then: did a teammate save, or was this account removed from the team?
  let checkTimer = null;
  let dismissedVersion = null;     // the version a "teammate saved" bar was closed for
  let lastSeenVersion = null;
  async function checkForTeammates() {
    if (!ready || !currentUser || !meta.festivalId || document.hidden || runningSave || noticeShown()) return;
    try {
      const { data, error } = await client.from('festivals').select('updated_at').eq('id', meta.festivalId).maybeSingle();
      if (error) return;                      // offline: try again later
      if (!data) {
        showNotice('This festival is no longer shared with you. Reload to open your own festival.');
        return;
      }
      lastSeenVersion = data.updated_at;
      if (!meta.dirty && data.updated_at !== meta.syncedAt && data.updated_at !== dismissedVersion) {
        showNotice('A teammate changed this festival. Reload to see the latest version.');
      }
    } catch { /* offline */ }
  }

  // --- 3. Team (Overview → Team) ----------------------------------------------------------

  let teamTimer = null;
  function teamChanged() {
    if (access.role !== 'Admin') return;      // the pages only let Admins change the team
    clearTimeout(teamTimer);
    teamTimer = setTimeout(saveTeam, 300);
  }

  async function saveTeam() {
    const roster = localRoster();
    const changes = teamChanges(serverRoster, roster);
    const problems = [];
    const members = client.from('festival_members');
    for (const { userId, role } of changes.add) {
      const { error } = await members.insert({ festival_id: meta.festivalId, user_id: userId, role });
      if (error) problems.push(error);
    }
    for (const { userId, role } of changes.change) {
      const { error } = await client.from('festival_members').update({ role })
        .eq('festival_id', meta.festivalId).eq('user_id', userId);
      if (error) problems.push(error);
    }
    for (const userId of changes.remove) {
      const { error } = await client.from('festival_members').delete()
        .eq('festival_id', meta.festivalId).eq('user_id', userId);
      if (error) problems.push(error);
    }
    try {
      serverRoster = await fetchTeam(meta.festivalId);
    } catch {
      showNotice('The team change could not be saved — no connection. Reload to see the current team.');
      return;
    }
    if (problems.length || !sameRoster(serverRoster, roster)) {
      writeRoster(serverRoster);
      showNotice('Some team changes could not be saved (for example the festival creator cannot be added). Reload to see the current team.');
    }
  }

  // --- 4. Starting the app --------------------------------------------------------------

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

  function remember(row, rowAccess) {
    meta = { userId: currentUser.id, festivalId: row.id, syncedAt: row.updated_at, dirtyKeys: [], dirty: false, legacy: false, access: rowAccess };
    writeMeta();
  }

  // Load a festival into this browser and restart the pages with it.
  async function openFestival(row, rowAccess) {
    const cloud = row.data ? row : await fetchFestival(row.id);
    const roster = await fetchTeam(cloud.id).catch(() => []);
    replacePlan(cloud.data, roster);
    remember(cloud, rowAccess);
    reloadForPlan();
  }

  function finishStart() {
    sessionStorage.removeItem('fa-account-reloads');
    ready = true;
    unlock();
    if (meta.userId === currentUser.id) {
      // pages tidied their saved data while starting: store that version too
      loadWrites.forEach((key) => { if (key !== ACCOUNT_TEAM_KEY) markUnsaved(key); });
    }
    if (meta.dirty) saveNow();
    else setStatus(access.role === 'Viewer' ? 'readonly' : 'saved');
    clearInterval(checkTimer);
    checkTimer = setInterval(checkForTeammates, CHECK_DELAY);
    const notice = sessionStorage.getItem('fa-account-notice');
    if (notice) { sessionStorage.removeItem('fa-account-notice'); showNotice(notice, false); }
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

    try {
      festivals = await fetchMyFestivals();
    } catch (error) {
      if (meta.userId === currentUser.id && meta.festivalId) {
        // Offline, but this browser holds a festival of this account: keep working, save later.
        finishStart();
        setStatus('offline');
        if (meta.dirty) scheduleSave(RETRY_DELAY);
        return;
      }
      showProblem(accountErrorMessage(error), true);
      return;
    }

    const own = festivals.find((row) => row.owner_id === currentUser.id) || null;
    const previous = meta.userId === currentUser.id ? meta.festivalId : null;
    let target = festivals.find((row) => row.festival_id === previous) || own;
    if (previous && !festivals.some((row) => row.festival_id === previous)) {
      sessionStorage.setItem('fa-account-notice', 'A festival that was shared with you is no longer available. This is your own festival.');
    }

    try {
      if (!target) { await startWithoutFestival(); return; }

      const rowAccess = accessFor({ ownerId: target.owner_id, ownerUsername: target.owner_username, myRole: target.my_role }, currentUser.id);
      const cloud = await fetchFestival(target.festival_id);
      if (!cloud) throw new Error('Festival not found');
      const action = syncAction({
        meta, userId: currentUser.id, localData: localPlan(), cloud: { id: cloud.id, updatedAt: cloud.updated_at }
      });
      if (action === 'choose') { showChoice(cloud, rowAccess); return; }
      if (action === 'download') { await openFestival(cloud, rowAccess); return; }

      // 'upload' or 'keep': the browser already holds this festival.
      access = rowAccess;
      let rosterChanged = false;
      try {
        serverRoster = await fetchTeam(cloud.id);
        rosterChanged = !sameRoster(serverRoster, localRoster());
      } catch { /* team unknown for now: keep the roster in this browser */ }
      if (!sameAccess(rowAccess, startAccess || OWNER_ACCESS) || rosterChanged) {
        // The role or the team changed since the pages started: restart them with the new state.
        writeRoster(serverRoster);
        meta.access = rowAccess;
        meta.festivalId = cloud.id;
        writeMeta();
        reloadForPlan();
        return;
      }
      meta.festivalId = cloud.id;
      meta.access = rowAccess;
      writeMeta();
      buildSwitcher();
      finishStart();
    } catch (error) {
      showProblem(accountErrorMessage(error), true);
    }
  }

  // The account has no festival of its own yet (first sign-in).
  async function startWithoutFestival() {
    const action = syncAction({ meta, userId: currentUser.id, localData: localPlan(), cloud: null });
    if (action === 'choose') { showChoice(null, OWNER_ACCESS); return; }
    if (action === 'create') {
      remember(await createFestival(localPlan()), OWNER_ACCESS);
      access = OWNER_ACCESS;
      serverRoster = [];
      if (!sameAccess(OWNER_ACCESS, startAccess || OWNER_ACCESS) || localRoster().length) {
        writeRoster([]);
        reloadForPlan();
        return;
      }
      festivals = await fetchMyFestivals().catch(() => festivals);
      buildSwitcher();
      finishStart();
      return;
    }
    // 'create-empty': the browser holds a plan that is not this account's own
    remember(await createFestival({}), OWNER_ACCESS);
    replacePlan({});
    reloadForPlan();
  }

  // A plan from before accounts is in this browser: let the organiser pick.
  function showChoice(cloud, rowAccess) {
    showScreen('choice');
    $('#account-choice-text').textContent = cloud
      ? 'This browser still holds a festival plan from before accounts existed, and your account already has a plan. Which one do you want to keep? The other one is replaced.'
      : 'This browser still holds a festival plan from before accounts existed. Do you want to save it in your new account, or start with an empty plan?';
    $('#choice-use-account').textContent = cloud ? 'Use my account’s plan' : 'Start with an empty plan';
    $('#choice-use-browser').onclick = () => runChoice(async () => {
      const row = cloud || await createFestival(localPlan());
      remember(row, rowAccess);
      if (cloud) {
        // Replace the account's plan: send every section of this browser and remove the
        // sections only the account's plan had.
        meta.dirtyKeys = [...new Set([...Object.keys(localPlan()), ...Object.keys(cleanFestivalData(cloud.data))])];
        writeMeta();
      }
      writeRoster(cloud ? await fetchTeam(cloud.id).catch(() => []) : []);
      reloadForPlan();
    });
    $('#choice-use-account').onclick = () => runChoice(async () => {
      if (cloud) { await openFestival(cloud, rowAccess); return; }
      remember(await createFestival({}), rowAccess);
      replacePlan({});
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

  // --- 5. Switching between festivals -----------------------------------------------------

  function buildSwitcher() {
    const select = $('#festival-switch');
    const label = $('#festival-switch-label');
    if (!select || festivals.length < 2) { if (label) label.hidden = true; return; }
    select.innerHTML = '';
    for (const row of festivals) {
      const option = document.createElement('option');
      option.value = row.festival_id;
      option.textContent = festivalLabel(row, currentUser.id);
      option.selected = row.festival_id === meta.festivalId;
      select.append(option);
    }
    label.hidden = false;
    select.title = select.selectedOptions[0]?.textContent || '';
    select.onchange = () => switchFestival(select.value);
  }

  async function switchFestival(id) {
    const select = $('#festival-switch');
    const row = festivals.find((item) => item.festival_id === id);
    if (!row || id === meta.festivalId) return;
    select.disabled = true;
    try {
      if (meta.dirty && !(await saveNow()) && access.role !== 'Viewer') {
        select.value = meta.festivalId;
        showNotice('Your latest changes are not saved yet (no connection). Try switching again in a moment.', false);
        return;
      }
      const rowAccess = accessFor({ ownerId: row.owner_id, ownerUsername: row.owner_username, myRole: row.my_role }, currentUser.id);
      await openFestival({ id }, rowAccess);
    } catch (error) {
      select.value = meta.festivalId;
      showNotice(accountErrorMessage(error), false);
    } finally {
      select.disabled = false;
    }
  }

  // --- 6. Sign in, create account, sign out ---------------------------------------------

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
    if (meta.dirty && !leaveUnsaved && access.role !== 'Viewer') {
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
    meta = emptyMeta();
    writeMeta();
    window.location.reload();
  }

  if (client) {
    client.auth.onAuthStateChange((event) => {
      // e.g. the session ran out and could not be renewed, or it was ended in another tab
      if (event === 'SIGNED_OUT' && currentUser && !signingOut) leaveBrowserClean();
    });
  }

  // --- 7. Finding teammates (Team form on the Overview) ---------------------------------

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

  // --- 8. The screen --------------------------------------------------------------------

  const $ = (selector) => document.querySelector(selector);
  const STATUS_TEXT = {
    saved: 'Saved to your account',
    saving: 'Saving…',
    offline: 'Not saved yet — no connection to your account. Retrying…',
    readonly: 'View only — your changes are not saved',
    partly: 'Saved. Finance changes can only be saved by an Admin.'
  };

  function setStatus(kind) {
    const status = $('#account-sync-status');
    if (!status) return;
    status.textContent = STATUS_TEXT[kind];
    status.dataset.state = kind;
  }

  function noticeShown() {
    const notice = $('#account-notice');
    return Boolean(notice && !notice.hidden);
  }

  function showNotice(text, offerReload = true) {
    const notice = $('#account-notice');
    if (!notice) return;
    $('#account-notice-text').textContent = text;
    $('#account-notice-reload').hidden = !offerReload;
    notice.hidden = false;
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
    $('#account-notice-reload').onclick = async () => {
      if (meta.dirty && access.role !== 'Viewer') await saveNow();
      window.location.reload();
    };
    $('#account-notice-close').onclick = () => {
      $('#account-notice').hidden = true;
      dismissedVersion = lastSeenVersion;
    };
    showScreen(root.classList.contains('account-checking') ? 'loading' : 'forms');
    start();
  });

  // Save straight away when the tab is hidden or closed, so no change is lost.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && meta.dirty && ready) saveNow();
    if (document.visibilityState === 'visible' && ready) checkForTeammates();
  });
}());
