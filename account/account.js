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
  function writeMeta(strict = false) {
    if (staleContext) {
      if (strict) throw new Error('Another tab changed the festival. Reload before editing.');
      return;
    }
    if (ready && !contextTransition && !contextIsCurrent()) {
      if (strict) throw new Error('Another tab changed the festival. Reload before editing.');
      return;
    }
    meta.dirty = meta.dirtyKeys.length > 0;
    try { storage.setItem(ACCOUNT_META_KEY, JSON.stringify(meta)); }
    catch (error) { if (strict) throw error; }
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

  let ready = false;        // true once page changes belong to the signed-in account
  let staleContext = false;
  let contextTransition = false;
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
  const loadWrites = new Set();  // sections pages saved while the app was still starting
  let applying = false;     // true while this file itself writes the plan
  const sectionRevisions = Object.create(null);

  function pendingTransition() {
    try { return storage.getItem(ACCOUNT_TRANSITION_KEY); } catch { return null; }
  }

  function lockStaleContext(message = 'Another tab opened a different festival or account. Reload this tab before editing.') {
    staleContext = true;
    clearTimeout(saveTimer);
    clearTimeout(teamTimer);
    const layout = document.querySelector('.app-layout');
    if (layout) layout.inert = true;
    setStatus('readonly');
    showNotice(message);
  }

  function contextIsCurrent() {
    if (staleContext) return false;
    if (pendingTransition() !== null) {
      if (ready) lockStaleContext('Another tab is changing festivals. Wait for it to finish, then reload this tab.');
      return false;
    }
    if (!ready) return true;
    const stored = readMeta();
    if (!sameFestivalContext(meta, stored) || (stored?.access && meta.access && !sameAccess(stored.access, meta.access))) {
      lockStaleContext();
      return false;
    }
    return true;
  }
  window.isFestivalContextCurrent = () => contextIsCurrent() && !contextTransition;
  function checkLocalWrite() {
    if (pendingTransition() !== null) {
      if (ready) lockStaleContext('Another tab is changing festivals. Reload after it finishes.');
      throw new Error('A festival change is in progress. Reload before editing.');
    }
    if (ready && (!contextIsCurrent() || contextTransition)) {
      throw new Error(staleContext ? 'Another tab changed the festival. Reload before editing.' : 'Wait until the festival change has finished.');
    }
  }
  function beginTransition() {
    contextTransition = true;
    const layout = document.querySelector('.app-layout');
    if (layout) layout.inert = true;
  }
  function endTransition() {
    contextTransition = false;
    if (!staleContext) {
      const layout = document.querySelector('.app-layout');
      if (layout) layout.inert = false;
    }
  }

  // Notice every save to a festival key. Writing the same value again is not a change.
  const nativeGetItem = Storage.prototype.getItem;
  const nativeSetItem = Storage.prototype.setItem;
  const nativeRemoveItem = Storage.prototype.removeItem;
  function trackedWrite(key, before, write) {
    const previous = ready ? { meta: JSON.parse(JSON.stringify(meta)),
      text: nativeGetItem.call(storage, ACCOUNT_META_KEY), revision: sectionRevisions[key], teamRevision } : null;
    let written = false;
    try {
      const result = write(); written = true;
      sectionChanged(key, before);
      return result;
    } catch (error) {
      // A saved value without its pending-save marker would be silently lost on reload.
      // Reject the local edit as a whole if either write could not be remembered.
      if (previous) {
        try {
          if (written && pendingTransition() === null) {
            if (before === null) nativeRemoveItem.call(storage, key);
            else nativeSetItem.call(storage, key, before);
          }
          if (!staleContext && nativeGetItem.call(storage, ACCOUNT_META_KEY) !== previous.text) {
            if (previous.text === null) nativeRemoveItem.call(storage, ACCOUNT_META_KEY);
            else nativeSetItem.call(storage, ACCOUNT_META_KEY, previous.text);
          }
        } catch { lockStaleContext('Browser storage could not be restored. Keep this page open and retry when storage is available.'); }
        meta = previous.meta;
        if (previous.revision === undefined) delete sectionRevisions[key];
        else sectionRevisions[key] = previous.revision;
        teamRevision = previous.teamRevision;
      }
      throw error;
    }
  }
  Storage.prototype.setItem = function (key, value) {
    const watched = this === storage && !applying && isFestivalDataKey(String(key));
    if (watched) checkLocalWrite();
    const before = watched ? nativeGetItem.call(this, key) : null;
    if (watched && before !== String(value)) return trackedWrite(String(key), before, () => nativeSetItem.call(this, key, value));
    return nativeSetItem.call(this, key, value);
  };
  Storage.prototype.removeItem = function (key) {
    const watched = this === storage && !applying && isFestivalDataKey(String(key));
    if (watched) checkLocalWrite();
    const before = watched ? nativeGetItem.call(this, key) : null;
    const existed = watched && nativeGetItem.call(this, key) !== null;
    if (existed) return trackedWrite(String(key), before, () => nativeRemoveItem.call(this, key));
    return nativeRemoveItem.call(this, key);
  };

  function sectionChanged(key, previous) {
    if (!ready) { loadWrites.add(key); return; }
    if (!currentUser) return;
    if (key === ACCOUNT_TEAM_KEY) { peopleChanged(); teamChanged(previous); return; }
    sectionRevisions[key] = (sectionRevisions[key] || 0) + 1;
    markUnsaved(key, true);
    setStatus(access.role === 'Viewer' ? 'readonly' : 'saving');
    scheduleSave(SAVE_DELAY);
  }

  function markUnsaved(key, strict = false) {
    if (!meta.dirtyKeys.includes('*') && !meta.dirtyKeys.includes(key)) meta.dirtyKeys.push(key);
    writeMeta(strict);
  }

  function replacePlan(data, roster = [], accountMeta, recoverTransition) {
    if (ready && !contextIsCurrent()) throw new Error('Another tab changed the festival. Reload before opening a plan.');
    applying = true;
    try {
      applyFestivalData(storage, data, { roster, accountMeta, recoverTransition });
    } finally {
      applying = false;
    }
  }

  function writeRoster(roster) {
    if (ready && !contextIsCurrent()) throw new Error('Another tab changed the festival. Reload before updating its team.');
    applying = true;
    try { storage.setItem(ACCOUNT_TEAM_KEY, JSON.stringify(roster)); } finally { applying = false; }
    peopleChanged();
  }

  // Pages that show who does which task (work-board.js, gantt-editor.js, overview.js) redraw.
  function peopleChanged() {
    setTimeout(() => window.dispatchEvent(new Event('festival-people-changed')), 0);
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
    if (!contextIsCurrent()) return Promise.resolve(false);
    if (runningSave) return runningSave.then(() => (meta.dirty ? saveNow() : true));
    if (!currentUser || !client || !meta.dirty || !meta.festivalId) return Promise.resolve(!meta.dirty);

    const sections = captureSaveBatch({ storage, dirtyKeys: meta.dirtyKeys, role: access.role,
      revisions: sectionRevisions, userId: currentUser.id, festivalId: meta.festivalId });
    const nothingToSend = !Object.keys(sections.changes).length && !sections.removed.length;
    if (nothingToSend) {
      meta.dirtyKeys = acknowledgeSaveBatch({ batch: sections, userId: currentUser.id, festivalId: meta.festivalId,
        dirtyKeys: meta.dirtyKeys, revisions: sectionRevisions, currentKeys: festivalKeys(storage).filter(isSyncedKey) });
      writeMeta();
      setStatus(meta.teamDirty ? 'saving' : sections.skipped.length ? (access.role === 'Viewer' ? 'readonly' : 'partly') : 'saved');
      return Promise.resolve(true);
    }

    const syncedBefore = meta.syncedAt;
    setStatus('saving');
    runningSave = client.rpc('save_festival_changes', {
      festival: sections.festivalId, changes: sections.changes, removed: sections.removed
    }).single()
      .then(({ data, error }) => {
        if (error) throw error;
        if (!contextIsCurrent() || !sameFestivalContext(sections, { userId: currentUser?.id, festivalId: meta.festivalId })) return false;
        const teammateSaved = syncedBefore !== data.previous_saved_at;
        // A teammate saved in between: this browser lacks their sections until it reloads.
        meta.syncedAt = teammateSaved ? 'outdated' : data.saved_at;
        meta.dirtyKeys = acknowledgeSaveBatch({ batch: sections, userId: currentUser.id, festivalId: meta.festivalId,
          dirtyKeys: meta.dirtyKeys, revisions: sectionRevisions, currentKeys: festivalKeys(storage).filter(isSyncedKey) });
        writeMeta();
        if (teammateSaved) showNotice('A teammate also saved this festival. Reload to see their changes — yours are saved.');
        if (meta.dirty) scheduleSave(SAVE_DELAY);
        else setStatus(meta.teamDirty ? 'saving' : sections.skipped.length ? 'partly' : 'saved');
        return !meta.dirty;
      })
      .catch((error) => {
        if (!contextIsCurrent()) return false;
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
    if (!ready || !currentUser || !meta.festivalId || contextTransition || !contextIsCurrent() || document.hidden || runningSave || noticeShown()) return;
    try {
      const { data, error } = await client.from('festivals').select('updated_at').eq('id', meta.festivalId).maybeSingle();
      if (!contextIsCurrent()) return;
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
  let runningTeamSave = null;
  let teamRevision = 0;
  function teamChanged(previous) {
    if (access.role !== 'Admin') return;      // the pages only let Admins change the team
    if (!meta.teamDirty) meta.teamBase = parseRoster(previous);
    meta.teamDirty = true;
    teamRevision += 1;
    writeMeta(true);
    setStatus('saving');
    scheduleTeamSave(300);
  }
  function scheduleTeamSave(delay) {
    clearTimeout(teamTimer);
    teamTimer = setTimeout(flushTeamChanges, delay);
  }

  // Team changes are a separate queue because the roster is not a plan section.
  // Every request keeps the festival id it started with, including after an await.
  function flushTeamChanges() {
    clearTimeout(teamTimer);
    if (!contextIsCurrent()) return Promise.resolve(false);
    if (runningTeamSave) return runningTeamSave.then(saved => saved && meta.teamDirty ? flushTeamChanges() : saved);
    if (!meta.teamDirty) return Promise.resolve(true);
    if (!currentUser || !client || access.role !== 'Admin') return Promise.resolve(false);
    const batch = { userId: currentUser.id, festivalId: meta.festivalId, revision: teamRevision,
      base: meta.teamBase || serverRoster, desired: localRoster() };
    const currentBatch = () => contextIsCurrent()
      && sameFestivalContext(batch, { userId: currentUser?.id, festivalId: meta.festivalId });
    setStatus('saving');
    runningTeamSave = (async () => {
      try {
        const actual = await fetchTeam(batch.festivalId);
        if (!currentBatch()) return false;
        const target = mergeTeamRoster(batch.base, batch.desired, actual);
        const changes = teamChanges(actual, target);
        for (const { userId, role } of changes.add) {
          if (!currentBatch()) return false;
          const { error } = await client.from('festival_members').insert({ festival_id: batch.festivalId, user_id: userId, role });
          if (error) throw error;
        }
        for (const { userId, role } of changes.change) {
          if (!currentBatch()) return false;
          const { error } = await client.from('festival_members').update({ role })
            .eq('festival_id', batch.festivalId).eq('user_id', userId);
          if (error) throw error;
        }
        for (const userId of changes.remove) {
          if (!currentBatch()) return false;
          const { error } = await client.from('festival_members').delete()
            .eq('festival_id', batch.festivalId).eq('user_id', userId);
          if (error) throw error;
        }
        const latest = await fetchTeam(batch.festivalId);
        if (!currentBatch()) return false;
        if (!sameRoster(mergeTeamRoster(batch.base, batch.desired, latest), latest)) {
          throw new Error('Some team changes were refused. Check the team and try again.');
        }
        serverRoster = latest;
        if (teamRevision === batch.revision) {
          delete meta.teamDirty; delete meta.teamBase;
          writeRoster(latest);
        } else {
          // A later invitation is kept, while unrelated changes from another Admin survive.
          const rebased = mergeTeamRoster(batch.desired, localRoster(), latest);
          meta.teamBase = latest;
          writeRoster(rebased);
        }
        writeMeta();
        if (!meta.dirty && !meta.teamDirty) setStatus('saved');
        return true;
      } catch (error) {
        if (!currentBatch()) return false;
        setStatus(error?.code === '42501' ? 'readonly' : 'offline');
        showNotice('Team changes are not saved yet. They are kept in this browser; check the connection and try again.');
        if (error?.code !== '42501') scheduleTeamSave(RETRY_DELAY);
        return false;
      }
    })().finally(() => { runningTeamSave = null; });
    return runningTeamSave.then(saved => saved && meta.teamDirty ? flushTeamChanges() : saved);
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
    meta = festivalMeta(row, rowAccess);
    writeMeta();
  }
  function festivalMeta(row, rowAccess) {
    return { userId: currentUser.id, festivalId: row.id, syncedAt: row.updated_at, dirtyKeys: [], dirty: false, legacy: false, access: rowAccess };
  }

  // Load a festival into this browser and restart the pages with it.
  async function openFestival(row, rowAccess, recoverTransition) {
    const cloud = row.data ? row : await fetchFestival(row.id);
    if (!cloud) throw new Error('This festival is no longer available.');
    const roster = await fetchTeam(cloud.id).catch(() => []);
    const nextMeta = festivalMeta(cloud, rowAccess);
    replacePlan(cloud.data, roster, nextMeta, recoverTransition);
    meta = nextMeta;
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
    else setStatus(meta.teamDirty ? 'saving' : access.role === 'Viewer' ? 'readonly' : 'saved');
    if (meta.teamDirty) scheduleTeamSave(0);
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

    const interrupted = pendingTransition();
    const recoverRequested = sessionStorage.getItem('fa-account-recover-transition');
    sessionStorage.removeItem('fa-account-recover-transition');
    if (interrupted !== null && recoverRequested !== interrupted) {
      showProblem('A festival change is unfinished. Wait for any other tab to finish, then choose Try again. If it was interrupted, the saved festival will be recovered from your account.', true);
      return;
    }

    try {
      festivals = await fetchMyFestivals();
    } catch (error) {
      if (interrupted !== null) { showProblem('The unfinished festival change needs a connection to recover its saved data. Try again when connected.', true); return; }
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
    if (interrupted !== null) {
      let marker;
      try { marker = JSON.parse(interrupted); } catch { marker = {}; }
      const contexts = [marker.after, marker.before].filter(value => value?.userId === currentUser.id);
      target = contexts.map(value => festivals.find(row => row.festival_id === value.festivalId)).find(Boolean) || own || festivals[0];
    }
    if (previous && !festivals.some((row) => row.festival_id === previous)) {
      sessionStorage.setItem('fa-account-notice', 'The festival you had open is no longer available (it was deleted or is no longer shared with you). This is your own festival.');
    }

    try {
      if (interrupted !== null) {
        // Never upload local sections while they may belong to a half-replaced plan.
        const row = target ? await fetchFestival(target.festival_id) : await createFestival({});
        const rowAccess = target ? accessFor({ ownerId: target.owner_id, ownerUsername: target.owner_username, myRole: target.my_role }, currentUser.id) : OWNER_ACCESS;
        await openFestival(row, rowAccess, interrupted);
        return;
      }
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
      const pendingTeam = meta.teamDirty === true && rowAccess.role === 'Admin';
      try {
        serverRoster = await fetchTeam(cloud.id);
        rosterChanged = !pendingTeam && !sameRoster(serverRoster, localRoster());
      } catch { /* team unknown for now: keep the roster in this browser */ }
      if (meta.teamDirty && !pendingTeam) {
        delete meta.teamDirty; delete meta.teamBase;
        sessionStorage.setItem('fa-account-notice', 'Your role changed. Pending team edits could not be applied; the saved team is shown.');
      }
      if (!sameAccess(rowAccess, startAccess || OWNER_ACCESS) || rosterChanged) {
        // The role or the team changed since the pages started: restart them with the new state.
        if (!pendingTeam) writeRoster(serverRoster);
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

  // The FESTIVAL list in the sidebar is always there once signed in, so a second festival
  // (new or demo) and the way back to the first one are easy to find.
  function buildSwitcher() {
    const select = $('#festival-switch');
    const label = $('#festival-switch-label');
    buildFestivalManagement();
    if (!select || !festivals.length) { if (label) label.hidden = true; return; }
    select.innerHTML = '';
    for (const row of festivals) {
      const option = document.createElement('option');
      option.value = row.festival_id;
      // Own festivals by name only; shared ones also say who created them and your role.
      option.textContent = row.owner_id === currentUser.id ? (row.festival_name || 'Untitled festival') : festivalLabel(row, currentUser.id);
      option.selected = row.festival_id === meta.festivalId;
      select.append(option);
    }
    label.hidden = false;
    select.title = select.selectedOptions[0]?.textContent || '';
    select.onchange = () => switchFestival(select.value);
  }

  // Before another festival opens: an unsaved site map draft asks first, and changes of the
  // open festival are saved. Returns '' when it is fine to leave, otherwise why not.
  const NOT_SAVED_YET = 'Your latest changes are not saved yet (no connection). Try again in a moment.';
  function confirmDraftNavigation() {
    if (window.confirmMapNavigation && !window.confirmMapNavigation()) return false;
    if (window.confirmProjectNavigation && !window.confirmProjectNavigation()) return false;
    return true;
  }
  async function readyToLeave() {
    if (!contextIsCurrent()) return 'Reload this tab before opening another festival.';
    if (contextTransition) return 'A festival change is already in progress.';
    if (!confirmDraftNavigation()) return 'cancelled';
    beginTransition();
    if (!(await flushTeamChanges()) || (meta.dirty && !(await saveNow()) && access.role !== 'Viewer')) {
      endTransition();
      return NOT_SAVED_YET;
    }
    if (!contextIsCurrent()) { endTransition(); return 'Reload this tab before opening another festival.'; }
    return '';
  }

  async function switchFestival(id) {
    if (contextTransition || !contextIsCurrent()) return;
    const select = $('#festival-switch');
    const row = festivals.find((item) => item.festival_id === id);
    if (!row || id === meta.festivalId) return;
    select.disabled = true;
    let opened = false;
    try {
      const problem = await readyToLeave();
      if (problem) {
        select.value = meta.festivalId;
        if (problem !== 'cancelled') showNotice(problem, false);
        return;
      }
      const rowAccess = accessFor({ ownerId: row.owner_id, ownerUsername: row.owner_username, myRole: row.my_role }, currentUser.id);
      await openFestival({ id }, rowAccess);
      opened = true;
    } catch (error) {
      select.value = meta.festivalId;
      showNotice(accountErrorMessage(error), false);
    } finally {
      select.disabled = false;
      if (!opened) endTransition();
    }
  }

  // --- 5b. Several festivals: new, demo, delete (feature-plans/several-festivals.md) -------

  // Creates a festival of this account with the given sections ({} = empty) and opens it.
  // The festival that was open stays as it is. Used by "＋ New festival" and by the demo
  // (demo/demo-loader.js). Rejects with an Error whose message can be shown as it is.
  let creating = false;
  window.openNewFestival = async function openNewFestival(sections = {}) {
    if (!client || !currentUser || !ready) throw new Error('Wait until your festival has loaded, then try again.');
    if (creating) throw new Error('A new festival is already being created.');
    if (contextTransition || !contextIsCurrent()) throw new Error('Wait until the open festival is ready, or reload this tab.');
    if (!canCreateFestival(festivals, currentUser.id)) {
      throw new Error(accountErrorMessage({ code: '54000' }));
    }
    creating = true;
    let opened = false;
    try {
      const problem = await readyToLeave();
      if (problem === 'cancelled') return false;
      if (problem) throw new Error(problem);
      const { data: row, error } = await client.from('festivals')
        .insert({ data: cleanFestivalData(sections) }).select('id, owner_id, updated_at').single();
      if (error) throw new Error(accountErrorMessage(error));
      sessionStorage.setItem('fa-account-notice',
        'This is a new festival. Your other festivals are saved — switch back with the FESTIVAL list in the sidebar.');
      await openFestival(row, OWNER_ACCESS);
      opened = true;
      return true;
    } catch (error) {
      sessionStorage.removeItem('fa-account-notice');
      throw error instanceof Error ? error : new Error(accountErrorMessage(error));
    } finally {
      creating = false;
      if (!opened) endTransition();
    }
  };

  function openFestivalRow() {
    return festivals.find((row) => row.festival_id === meta.festivalId) || null;
  }

  // Sidebar "＋ New festival" and Settings → This festival.
  function buildFestivalManagement() {
    if (!currentUser) return;
    const newButton = $('#new-festival');
    if (newButton) {
      newButton.hidden = false;
      newButton.disabled = !canCreateFestival(festivals, currentUser.id);
      newButton.title = newButton.disabled ? accountErrorMessage({ code: '54000' }) : 'Start another festival; this one stays saved';
    }
    const card = $('#festival-manage');
    if (!card) return;
    const row = openFestivalRow();
    card.hidden = !row;
    if (!row) return;
    const own = row.owner_id === currentUser.id;
    const deletable = canDeleteFestival(festivals, currentUser.id, row.festival_id);
    const count = `You have access to ${festivals.length} festival${festivals.length === 1 ? '' : 's'}.`;
    $('#festival-manage-summary').textContent = own ? `You created this festival. ${count}` : `${festivalLabel(row, currentUser.id)}. ${count}`;
    $('#delete-festival').hidden = !deletable;
    $('#festival-manage-help').textContent = deletable ? ''
      : own ? 'This is your only own festival, so it cannot be deleted. Create another festival first.'
        : 'Only the festival creator can delete this festival.';
  }

  async function deleteOpenFestival() {
    if (contextTransition || !contextIsCurrent()) return;
    const row = openFestivalRow();
    const button = $('#delete-festival');
    if (!row || !canDeleteFestival(festivals, currentUser.id, row.festival_id)) return;
    const next = festivalAfterDelete(festivals, currentUser.id, row.festival_id);
    if (!next) return;
    button.disabled = true;
    let opened = false;
    let deleted = false;
    try {
      const problem = await readyToLeave();
      if (problem) {
        if (problem !== 'cancelled') showNotice(problem, false);
        return;
      }
      // No save may reach the festival while it is being deleted.
      clearTimeout(saveTimer);
      if (runningSave) await runningSave.catch(() => {});
      const { data, error } = await client.from('festivals').delete().eq('id', row.festival_id).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('Only the festival creator can delete this festival.');
      deleted = true;
      meta.dirtyKeys = [];     // changes of the deleted festival have nowhere to go
      writeMeta();
      sessionStorage.setItem('fa-account-notice', `“${row.festival_name || 'Untitled festival'}” was deleted.`);
      const nextAccess = accessFor({ ownerId: next.owner_id, ownerUsername: next.owner_username, myRole: next.my_role }, currentUser.id);
      await openFestival({ id: next.festival_id }, nextAccess);
      opened = true;
    } catch (error) {
      sessionStorage.removeItem('fa-account-notice');
      showNotice(error instanceof Error && !error.code ? error.message : accountErrorMessage(error), false);
      button.disabled = false;
      if (meta.dirty) scheduleSave(SAVE_DELAY);   // not deleted: keep saving this festival
      if (deleted) lockStaleContext('This festival was deleted, but the next one could not be loaded. Reload to open an available festival.');
    } finally {
      if (!opened && !deleted) endTransition();
      button.disabled = false;
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
    if (contextTransition || !contextIsCurrent() || !confirmDraftNavigation()) return;
    const button = $('#sign-out');
    beginTransition();
    if ((meta.dirty || meta.teamDirty) && !leaveUnsaved && access.role !== 'Viewer') {
      button.disabled = true;
      const teamSaved = await flushTeamChanges();
      const saved = teamSaved && await saveNow();
      button.disabled = false;
      if (!saved) {
        leaveUnsaved = true;
        button.textContent = 'Sign out without saving';
        setStatus('offline');
        endTransition();
        return;
      }
    }
    signingOut = true;
    clearTimeout(saveTimer); clearTimeout(teamTimer);
    try { await client.auth.signOut({ scope: 'local' }); } catch { /* signed out locally below */ }
    try { storage.removeItem(SESSION_STORAGE_KEY); } catch { /* already gone */ }
    leaveBrowserClean();
  }

  // The next person using this browser must not see the plan.
  function leaveBrowserClean() {
    if (ready && !contextIsCurrent()) return;
    beginTransition();
    const cleanMeta = emptyMeta();
    replacePlan({}, [], cleanMeta);
    meta = cleanMeta;
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
  // Who works on the open festival: { me, owner, members } (members = the Team table).
  // Used to assign tasks; null until signed in.
  window.festivalPeople = function festivalPeople() {
    if (!currentUser || !ready) return null;
    const me = { userId: currentUser.id, username: currentUser.username };
    const row = festivals.find((festival) => festival.festival_id === meta.festivalId);
    let owner = access.creatorLabel === OWNER_ACCESS.creatorLabel ? me : null;   // offline: only "me" is known
    if (row?.owner_id) owner = row.owner_id === currentUser.id ? me : { userId: row.owner_id, username: row.owner_username || 'Owner' };
    return { me, owner, members: localRoster() };
  };

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
    partly: 'Saved. Changes to finances or task assignments can only be saved by an Admin.'
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
    $('#account-avatar').textContent = currentUser.username.trim().charAt(0).toUpperCase();
    $('#sidebar-account').hidden = false;
  }

  function unlock() {
    root.classList.remove('account-locked', 'account-checking');
    $('.app-layout').inert = false;
    $('#account-screen').hidden = true;
    readyCallbacks.splice(0).forEach((callback) => callback());
    peopleChanged();
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('.app-layout').inert = true;
    $('#tab-sign-in').onclick = () => showTab('sign-in');
    $('#tab-sign-up').onclick = () => showTab('sign-up');
    $('#sign-in-form').addEventListener('submit', signIn);
    $('#sign-up-form').addEventListener('submit', signUp);
    $('#sign-out').onclick = signOut;
    $('#account-retry').onclick = () => {
      const marker = pendingTransition();
      if (marker !== null) sessionStorage.setItem('fa-account-recover-transition', marker);
      window.location.reload();
    };
    $('#account-notice-reload').onclick = async () => {
      if (staleContext) { window.location.reload(); return; }
      const problem = await readyToLeave();
      if (problem) {
        if (problem !== 'cancelled') showNotice(problem, false);
        return;
      }
      window.location.reload();
    };
    // returnValue is reset on every opening, so closing with Escape never repeats an earlier choice.
    $('#new-festival').onclick = () => { $('#new-festival-dialog').returnValue = ''; $('#new-festival-dialog').showModal(); };
    $('#new-festival-dialog').addEventListener('close', () => {
      if ($('#new-festival-dialog').returnValue !== 'create') return;
      const button = $('#new-festival');
      button.disabled = true;
      window.openNewFestival({})
        .catch((error) => showNotice(error.message, false))
        .finally(() => { button.disabled = !canCreateFestival(festivals, currentUser.id); });
    });
    $('#delete-festival').onclick = () => {
      const row = openFestivalRow();
      if (!row) return;
      $('#delete-festival-name').textContent = row.festival_name || 'Untitled festival';
      $('#delete-festival-dialog').returnValue = '';
      $('#delete-festival-dialog').showModal();
    };
    $('#delete-festival-dialog').addEventListener('close', () => {
      if ($('#delete-festival-dialog').returnValue === 'delete') deleteOpenFestival();
    });
    $('#account-notice-close').onclick = () => {
      $('#account-notice').hidden = true;
      dismissedVersion = lastSeenVersion;
    };
    showScreen(root.classList.contains('account-checking') ? 'loading' : 'forms');
    start();
  });

  // Save straight away when the tab is hidden or closed, so no change is lost.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && ready && !contextTransition && contextIsCurrent()) {
      if (meta.dirty) saveNow();
      if (meta.teamDirty) flushTeamChanges();
    }
    if (document.visibilityState === 'visible' && ready) checkForTeammates();
  });
  // Only compare identifiers and roles. No plan or authentication data is broadcast.
  window.addEventListener('storage', event => {
    if ([ACCOUNT_META_KEY, ACCOUNT_TRANSITION_KEY].includes(event.key) && ready && !applying) contextIsCurrent();
  });
}());
