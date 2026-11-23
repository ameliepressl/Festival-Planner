// Festival Architect — the Site map page.
// Shows a realistic map of the festival ground with a clickable pin for every facility. You can upload
// your own maps (aerial photos or site plans), mark the fence, the gate and no-go areas (water, forest,
// buildings), and let the page suggest the optimal layout. Pins can be dragged; the layout check updates.
// Rules and the layout planner: rules/site-map-rules.js. Drawing: site-map/map-drawing.js.
// Vendors on the food court pitches come from rules/vendor-rules.js (chosen on the Vendors page).

(function () {
  const view = document.querySelector('#site-map-view');
  const SELECTED_KEY = 'festival-architect-site-map-selected';
  const MODES = {
    explore: { label: 'Explore', hint: 'Click a pin for its options · drag a pin to move it · drag the map to look around · scroll or + / − to zoom.' },
    move: { label: 'Move pins', hint: 'Drag a pin to a new spot. The layout check updates when you let go.' },
    border: { label: 'Draw fence', hint: 'Click the corners of the festival ground one after another, then press “Done”.' },
    entrance: { label: 'Set gate', hint: 'Click the spot on the fence where the main entrance should be.' },
    paint: { label: 'Mark no-go', hint: 'Drag over water, forest, roads or buildings to mark them as no-go areas.' },
    erase: { label: 'Erase no-go', hint: 'Drag over red areas to make them usable again.' },
    // Not a toolbar button: started from "Pins to place" (rules/map-pin-rules.js).
    place: { label: 'Place pins', hint: 'Click the map to place the pin.' }
  };
  const TOOLBAR_MODES = Object.entries(MODES).filter(([id]) => id !== 'place');

  // Festival size: the expected visitors decide how many toilets, water points and pitches the map needs.
  // A saved lineup decides how many stages the map has (Stage A, B, C, ...).
  function lineupStages() {
    try { return JSON.parse(read(typeof STORAGE_KEY === 'string' ? STORAGE_KEY : 'festival-architect-v2'))?.settings?.stages; } catch { return undefined; }
  }
  const sizeFor = (visitors) => ({ ...capacityNeeds(visitors), stages: mapStageCount(lineupStages(), { allowSingle: true }) });
  const activeStageIds = values => values.filter(item => item.kind === 'stage').map(item => item.id);
  let ground = parseGround(read(GROUND_STORAGE_KEY));
  let needs = sizeFor(ground.visitors);
  let items = layoutItems(needs);
  let sites = loadSites();
  // The pins of the open map: the facilities for the festival size plus the pins the organiser added.
  const baseItems = () => layoutItems(needs);
  function refreshItems() {
    const open = sites.find((entry) => entry.id === currentId);
    const presets = baseItems();
    items = [...presets, ...namedExtraPinItems(open?.extraPins, presets)];
  }
  // Suggestions plan only the built-in facilities; added pins keep their spots.
  const addedPlacements = (s) => Object.fromEntries(extraPinItems(s.extraPins).filter((pin) => s.placements[pin.id]).map((pin) => [pin.id, s.placements[pin.id]]));
  let addOpen = false;   // the "+ Add pin" chooser in the dock
  let ownOpen = false;   // the name field for "Own pin" inside the chooser
  let moveFrom = null;   // an added pin being moved: { id, at }; Esc puts it back there
  // One line under each choice in "+ Add pin", so the organiser knows what the pin is for.
  const ADD_HINTS = {
    toilets: 'Counts for toilets near a stage', water: 'Counts for water near a stage',
    'first-aid': 'Counts for first aid near a stage', bar: 'A drinks bar away from the food court',
    info: 'Help desk, lost & found', security: 'Extra post, e.g. at a bottleneck',
    recycling: 'Cups, bottles and bins', marker: 'VIP area, meeting point… you name it'
  };
  let currentId = read(SELECTED_KEY) || 'demo';
  if (!sites.some((s) => s.id === currentId)) currentId = 'demo';
  let active = MAP_CATEGORIES.map((c) => c.id);
  let selectedId = null;
  let mode = 'explore';
  let showNogo = false;
  let draftBorder = null;
  let placing = null; // the pin that the next click on the map places (mode "place")
  let ghost = null;   // preview under the mouse while placing: { at, ok }
  let chipDrag = null; // a pin dragged from "Pins to place" onto the map
  let suppressChipClick = false;
  let box = null;    // the visible part of the map (zoom and pan)
  let pointer = null; // what the mouse is doing right now
  let busy = false;
  let simulation = null;
  function closeSimulation() { simulation?.close(); simulation = null; }
  const snapshot = () => ({ sites, ground, currentId, pendingFence: draftBorder?.length ? draftBorder : null });
  const draft = createMapDraft(snapshot());
  const lineupProblem = () => window.getLineupDataProblem?.() || '';
  const editable = () => canFestival('checklist') && !lineupProblem();
  let savedReadinessCache = null;
  let committedMapIds = new Set(parseSiteMaps(read(SITE_MAPS_STORAGE_KEY)).map(map => map.id));

  // ---------- saving in the browser ----------
  function read(key) { try { return localStorage.getItem(key); } catch { return null; } }
  function loadSites() {
    const list = parseSiteMaps(read(SITE_MAPS_STORAGE_KEY));
    if (!list.some((s) => s.id === 'demo')) list.unshift(demoSite(items));
    return list;
  }
  // Historical callers mark a completed action; only commitChanges writes storage now.
  function save() {
    closeSimulation();
    changeMapDraft(draft, snapshot());
    renderDraftActions();
  }
  function renderDraftActions() {
    const dirty = mapDraftDirty(draft);
    const needsFirstSave = !committedMapIds.has(currentId);
    const status = view.querySelector('#sm-save-status');
    if (status) status.textContent = !editable() ? 'View only' : busy ? 'Preparing map…' : dirty || draftBorder?.length ? 'Unsaved changes' : needsFirstSave ? 'Map not saved yet' : 'No unsaved changes';
    const saveButton = view.querySelector('#sm-save');
    if (saveButton) saveButton.disabled = !editable() || (!dirty && !needsFirstSave) || busy || !!draftBorder?.length;
    const undoButton = view.querySelector('#sm-undo');
    if (undoButton) undoButton.disabled = !editable() || !draft.previous || busy;
    const discardButton = view.querySelector('#sm-discard');
    if (discardButton) discardButton.disabled = !editable() || (!dirty && !draftBorder?.length) || busy;
  }
  function applyDraft() {
    ({ sites, ground, currentId } = cloneMapDraft(draft.present));
    needs = sizeFor(ground.visitors); items = layoutItems(needs);
    selectedId = null; draftBorder = draft.present.pendingFence ? cloneMapDraft(draft.present.pendingFence) : null;
    pointer = null; box = null; placing = null; ghost = null; mode = draftBorder?.length ? 'border' : 'explore';
    renderPage();
  }
  function commitChanges() {
    if (!editable() || busy) return false;
    if (draftBorder?.length) { mapMessage('Finish the fence with Done, or cancel drawing it, before saving.'); return false; }
    changeMapDraft(draft, snapshot());
    const result = saveMapDraft(draft, localStorage, { sites: SITE_MAPS_STORAGE_KEY, ground: GROUND_STORAGE_KEY, selected: SELECTED_KEY });
    if (!result.ok) {
      mapMessage(result.restored ? 'Could not save. Your draft is still here and the previous saved map was restored. Free browser storage and try again.'
        : 'Could not save or fully restore browser storage. Keep this page open; your draft is still here.');
      renderDraftActions(); return false;
    }
    committedMapIds = new Set(draft.saved.sites.map(map => map.id));
    savedReadinessCache = null;
    renderDraftActions();
    window.dispatchEvent(new Event('festival-map-saved'));
    mapMessage('Map changes saved.');
    return true;
  }

  window.hasUnsavedMapChanges = () => editable() && (busy || mapDraftDirty({ saved: draft.saved, present: snapshot() }) || !!draftBorder?.length);
  window.confirmMapNavigation = () => {
    if (!window.hasUnsavedMapChanges()) return true;
    if (busy) { mapMessage('Please wait for the map operation to finish before leaving.'); return false; }
    if (!window.confirm('Leave without saving your map changes? Cancel to return and choose Save changes.')) return false;
    discardMapDraft(draft); applyDraft(); return true;
  };
  window.addEventListener('beforeunload', event => {
    if (!window.hasUnsavedMapChanges()) return;
    event.preventDefault(); event.returnValue = '';
  });
  // The Overview always reads the committed map, never an experiment in this draft.
  window.getSavedMapReadiness = () => {
    if (lineupProblem()) return [{ id: 'map:stage-context', label: 'Map stage configuration', ok: false, unknown: true,
      detail: 'The saved lineup needs recovery, so its active stages are unknown. Recover the lineup before editing or assessing this map.', section: 'Lineup planner' }];
    const saved = draft.saved;
    const stageCount = mapStageCount(lineupStages(), { allowSingle: true });
    if (savedReadinessCache?.snapshot === saved && savedReadinessCache.stageCount === stageCount) return savedReadinessCache.rules.map(rule => ({ ...rule }));
    const map = saved.sites.find(value => value.id === saved.currentId) || saved.sites[0];
    if (!map || !committedMapIds.has(map.id)) return [{ id: `map:${map?.id || 'missing'}:saved`, label: 'Save and assess festival map', ok: false,
      unknown: true, detail: 'The suggested map has not been saved yet. Review the layout and measurements, then choose Save changes on Site map.', section: 'Site map' }];
    const savedPresets = layoutItems(sizeFor(saved.ground.visitors));
    const savedItems = [...savedPresets, ...namedExtraPinItems(map.extraPins, savedPresets)];
    const rules = [...checkLayout(map, map.placements, savedItems), ...crowdSafetyChecks(map, saved.ground.visitors, activeStageIds(savedItems)).checks]
      .map(rule => ({ id: `map:${map.id}:${rule.id}`, label: rule.label, ok: rule.ok, unknown: !!rule.unknown, detail: rule.detail, section: 'Site map' }));
    savedReadinessCache = { snapshot: saved, stageCount, rules };
    return rules.map(rule => ({ ...rule }));
  };
  const site = () => sites.find((s) => s.id === currentId);
  const currentPlacements = (s) => Object.fromEntries(items.filter((i) => s.placements[i.id]).map((i) => [i.id, s.placements[i.id]]));
  const vendors = () => parsePlacements(read(VENDOR_STORAGE_KEY));
  const colourOf = (categoryId) => MAP_CATEGORIES.find((c) => c.id === categoryId).colour;
  const titleOf = (categoryId) => MAP_CATEGORIES.find((c) => c.id === categoryId).title;
  const escape = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function mapMessage(message) {
    const dialog = view.querySelector('#sm-settings-dialog');
    if (dialog?.open) {
      const feedback = view.querySelector('#sm-settings-message');
      feedback.textContent = message;
      feedback.scrollIntoView({block:'nearest'});
    } else toast(message);
  }

  // ---------- the page frame (drawn once per visit or map change) ----------
  function renderPage() {
    closeSimulation();
    refreshItems();
    const keepSettingsOpen = !!view.querySelector("#sm-settings-dialog")?.open;
    const s = site();
    view.innerHTML = `
      <section class="checklist-hero sm-hero">
        <h1>Site map</h1>
        <p class="hero-copy">Plan where everything stands: <b>Suggest layout</b> places it for you, then drag pins to adjust. The layout check on the right tells you what still needs work.</p>
      </section>
      <div class="sm-save-actions" role="group" aria-label="Save map changes">
        <span id="sm-save-status" role="status" aria-live="polite"></span>
        <button type="button" class="button primary" id="sm-save">Save changes</button>
        <button type="button" class="button secondary" id="sm-undo">Undo change</button>
        <button type="button" class="button secondary" id="sm-discard">Discard changes</button>
      </div>
      <div class="sm-layout">
        <div class="sm-main" role="region" aria-labelledby="festival-layout-title">
          <div class="sm-head">
            <h2 id="festival-layout-title">Festival layout <small>${escape(s.name)}</small></h2>
            <button type="button" class="button secondary" id="sm-open-settings" aria-haspopup="dialog" aria-controls="sm-settings-dialog">⚙ Map settings</button>
          </div>
          <div class="sm-bar">
            <div class="sm-layout-actions" role="group" aria-label="Pins">
              <button type="button" class="button primary" id="sm-suggest">✦ Suggest layout</button>
              <button type="button" class="button secondary" id="sm-add-pin" aria-controls="sm-tray">+ Add pin</button>
              <button type="button" class="button secondary sm-clear-button" id="sm-clear-pins" aria-haspopup="dialog" aria-controls="sm-clear-dialog">Clear all pins</button>
            </div>
            <div class="sm-tools" role="group" aria-label="Map tools"><span class="sm-cap">Tool</span>
              <div class="sm-seg">${TOOLBAR_MODES.map(([id, m]) => `<button type="button" class="sm-tool ${mode === id ? 'on' : ''}" data-mode="${id}" aria-pressed="${mode === id}">${m.label}</button>`).join('')}</div>
            </div>
          </div>
          <div class="map-chips" role="group" aria-label="Show on the map"><span class="sm-cap">Show</span>
            ${MAP_CATEGORIES.map((c) => `<button type="button" class="map-chip ${active.includes(c.id) ? 'on' : ''}" data-category="${c.id}" aria-pressed="${active.includes(c.id)}" style="--marker:${c.colour}"><i></i>${c.title}</button>`).join('')}
            <label class="sm-toggle"><input type="checkbox" id="sm-show-nogo" ${showNogo ? 'checked' : ''} /> No-go areas</label>
          </div>
          <div class="sm-frame mode-${mode}">
            <details class="sm-simulation" id="sm-simulation"><summary>Visitor simulation</summary><div class="sm-sim-body"></div></details>
            <div class="sm-hint" id="sm-hint"></div>
            <div class="sm-map-viewport">
              <svg id="sm-svg" viewBox="0 0 ${s.width} ${s.height}" role="img" aria-label="Map of ${escape(s.name)}">
                ${MapDrawing.defs()}
                <g id="sm-scene"></g><g id="sm-nogo"></g><g id="sm-paths"></g><g id="sm-objects"></g><g id="sm-edit"></g>
              </svg>
              <canvas id="sm-visitors-canvas" hidden aria-hidden="true"></canvas>
              <div class="sm-zoom"><button type="button" data-zoom="in" aria-label="Zoom in">+</button><button type="button" data-zoom="out" aria-label="Zoom out">−</button><button type="button" data-zoom="reset" aria-label="Show whole map">⤢</button></div>
              <div class="sm-scale" id="sm-scale"></div>
              <div class="sm-pop" id="sm-pop" role="group" aria-label="Pin options" hidden></div>
            </div>
            <section class="sm-dock" id="sm-tray" aria-labelledby="sm-tray-title" hidden></section>
          </div>
        </div>
        <aside class="sm-side">
          <section class="sm-card" id="sm-details" aria-live="polite"></section>
          <section class="sm-card" id="sm-score" aria-label="Layout check"></section>
        </aside>
      </div>
      <div class="sm-more">
        <details class="sm-card sm-size-disclosure" open><summary>Festival size <small>how many toilets, water points and pitches the map needs</small></summary><div id="sm-size"></div></details>
        <details class="sm-card sm-crowd-disclosure"><summary>Crowd and evacuation estimates</summary><div id="sm-crowd"></div></details>
      </div>
      <dialog id="sm-settings-dialog" aria-labelledby="sm-settings-title">
        <header class="sm-dialog-heading"><h2 id="sm-settings-title">Map settings</h2><button type="button" class="button secondary" id="sm-close-settings" aria-label="Close map settings">×</button></header>
        <label class="sm-select">MAP<select id="sm-select">${sites.map((m) => `<option value="${escape(m.id)}" ${m.id === currentId ? 'selected' : ''}>${escape(m.name)}</option>`).join('')}</select></label>
        <div id="sm-settings"></div>
        <p class="field-help">Changes remain a draft until you choose Save changes above the map.</p><p id="sm-settings-message" role="status" aria-live="polite"></p>
      </dialog>
      <dialog id="sm-clear-dialog" class="confirm-dialog sm-clear-dialog" aria-labelledby="sm-clear-title"><form method="dialog"></form></dialog>`;
    box = box && box.site === currentId ? box : { site: currentId, x: 0, y: 0, w: s.width, h: s.height };
    drawScene();
    drawAll();
    renderSettings();
    const settingsDialog = view.querySelector('#sm-settings-dialog');
    view.querySelector('#sm-open-settings').onclick = () => settingsDialog.showModal();
    view.querySelector('#sm-close-settings').onclick = () => settingsDialog.close();
    settingsDialog.addEventListener('close', () => view.querySelector('#sm-open-settings').focus());
    if (keepSettingsOpen) settingsDialog.showModal();
    renderSize();
    renderCrowd();
    renderDraftActions();
    if (!editable()) {
      view.querySelectorAll('[data-mode]:not([data-mode="explore"]), #sm-suggest, #sm-add-pin, #sm-clear-pins, #sm-visitors, #sm-name, #sm-width, #sm-upload, [data-action], [data-crowd-field]').forEach(control => { control.disabled = true; });
    }
    const playbackPanel = view.querySelector('#sm-simulation');
    playbackPanel.ontoggle = () => {
      if (!playbackPanel.isConnected) return;
      if (!playbackPanel.open) { closeSimulation(); return; }
      if (lineupProblem() || draftBorder?.length || busy) {
        playbackPanel.querySelector('.sm-sim-body').textContent = lineupProblem() ? 'Recover the saved lineup to simulate this festival.' :
          'Finish the current map change before starting a simulation.';
        return;
      }
      if (mode !== 'explore') setMode('explore');
      simulation = VisitorPlayback.mount(view, s, ground.visitors, activeStageIds(items), state, () => box);
    };
    bindMap();
  }

  function drawAll() { applyBox(); drawNogo(); drawObjects(); drawEdit(); renderHint(); renderDetails(); renderScore(); renderCrowd(); renderTray(); }

  // ---------- drawing the layers ----------
  function drawScene() { view.querySelector('#sm-scene').innerHTML = MapDrawing.scene(site()); }

  function drawNogo() {
    view.querySelector('#sm-nogo').innerHTML = showNogo || mode === 'paint' || mode === 'erase' ? MapDrawing.nogo(site()) : '';
  }

  function applyBox() {
    const s = site();
    view.querySelector('#sm-svg').setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`);
    simulation?.paint();
    positionPopover();
    // A scale bar of a round number of metres, about a fifth of the visible width.
    const metres = box.w * metresPerUnit(s) / 5;
    const nice = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000].find((n) => n >= metres) || 5000;
    const frame = view.querySelector('.sm-frame').clientWidth || 800;
    view.querySelector('#sm-scale').innerHTML = `<i style="width:${(nice / metresPerUnit(s) / box.w) * frame}px"></i>${nice} m`;
  }

  // The direction an object faces: stages, trucks and toilets towards the food court, gates inwards.
  function anglesFor(s) {
    const p = s.placements;
    const pitches = items.filter((i) => i.kind === 'pitch' && p[i.id]).map((i) => p[i.id]);
    const court = pitches.length ? [0, 1].map((k) => pitches.reduce((sum, q) => sum + q[k], 0) / pitches.length) : [s.width / 2, s.height / 2];
    const inside = [0, 1].map((k) => s.boundary.reduce((sum, q) => sum + q[k], 0) / s.boundary.length);
    return (item, at) => {
      const target = item.onFence ? inside : item.kind === 'pitch' ? (p.entrance || inside) : court;
      return (Math.atan2(target[1] - at[1], target[0] - at[0]) * 180) / Math.PI;
    };
  }

  function drawObjects() {
    const s = site();
    const onPitches = vendors();
    const u = (metres) => metres / metresPerUnit(s);
    const angle = anglesFor(s);
    const r = box.w / 58;
    view.querySelector('#sm-paths').innerHTML = MapDrawing.walkways(s, currentPlacements(s));
    const shown = items.filter((item) => s.placements[item.id] && active.includes(item.category));
    // Selected pin last, so it is drawn on top.
    shown.sort((a, b) => (a.id === selectedId) - (b.id === selectedId));
    view.querySelector('#sm-objects').innerHTML = shown.map((item) => {
      const at = s.placements[item.id];
      const vendor = item.kind === 'pitch' ? vendorOnPitch(onPitches, item.id) : null;
      const label = vendor ? vendor.icon : item.symbol;
      const name = vendor ? `${item.name}: ${vendor.name}` : item.name;
      return `<g class="fa-item" data-id="${item.id}" transform="translate(${at[0]} ${at[1]})" tabindex="0" role="button" aria-label="${escape(name)}">
        ${MapDrawing.object(item, u, angle(item, at), vendor)}
        ${MapDrawing.pin(item, r, colourOf(item.category), label, item.id === selectedId)}</g>`;
    }).join('');
    renderPopover();
  }

  function drawEdit() {
    const layer = view.querySelector('#sm-edit');
    const s = site();
    const r = box.w / 160;
    let out = '';
    if (mode === 'border' || draftBorder?.length) {
      const points = draftBorder || [];
      out += `<polyline points="${points.map((p) => p.join(',')).join(' ')}" fill="rgba(255,104,76,.12)" stroke="#ff684c" stroke-width="${r * 0.6}" stroke-dasharray="${r * 2} ${r}" />`;
      out += points.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="${r * 1.4}" fill="#ff684c" stroke="#fff" stroke-width="${r * 0.4}" />`).join('');
    }
    if (mode === 'entrance' && s.entrance) out += `<circle cx="${s.entrance[0]}" cy="${s.entrance[1]}" r="${r * 3}" fill="none" stroke="#ff684c" stroke-width="${r * 0.6}" />`;
    // While placing: a see-through pin follows the mouse; red with a cross where it cannot stand.
    const item = mode === 'place' && placing && ghost ? findItem(placing, items) : null;
    if (item) {
      const pinSize = box.w / 58;
      out += `<g class="sm-ghost ${ghost.ok ? 'ok' : 'blocked'}" transform="translate(${ghost.at[0]} ${ghost.at[1]})" pointer-events="none">
        <circle r="${pinSize * 0.5}" fill="none" stroke="#fff" stroke-width="${pinSize * 0.12}" stroke-dasharray="${pinSize * 0.3} ${pinSize * 0.2}" />
        ${MapDrawing.pin(item, pinSize, ghost.ok ? colourOf(item.category) : '#c14b3c', ghost.ok ? item.symbol : '✕', false)}</g>`;
    }
    layer.innerHTML = out;
  }

  // ---------- "Clear all pins" and placing them again (rules/map-pin-rules.js) ----------
  function showCategory(categoryId) {
    if (active.includes(categoryId)) return;
    active = [...active, categoryId];
    const chip = view.querySelector(`[data-category="${categoryId}"]`);
    chip?.classList.add('on'); chip?.setAttribute('aria-pressed', 'true');
  }

  // Arms one pin: the next click on the map places it.
  function startPlacing(id) {
    const item = findItem(id, items);
    if (!item || site().placements[id] || !editable() || busy) return;
    if (draftBorder?.length) { mapMessage('Finish the fence with Done, or cancel drawing it, before placing pins.'); return; }
    if (moveFrom && moveFrom.id !== id) putBackMoved();
    showCategory(item.category);
    if (mode !== 'place') setMode('place');
    placing = id; ghost = null;
    drawEdit(); renderHint(); renderTray();
  }

  // One pin off the map (Remove from map, Delete key); with pickUp it is ready to be placed again.
  function removePin(id, { pickUp = false } = {}) {
    const s = site();
    const item = findItem(id, items);
    if (!item || !s.placements[id] || !editable() || busy) return;
    if (draftBorder?.length) { mapMessage('Finish the fence with Done, or cancel drawing it, before changing pins.'); return; }
    if (item.added && pickUp) moveFrom = { id, at: s.placements[id] };
    s.placements = withoutPin(s.placements, id);
    if (selectedId === id) selectedId = null;
    if (item.added && !pickUp) {
      s.extraPins = withoutExtraPin(s.extraPins, id);
      refreshItems(); save(); drawAll();
      mapMessage(`${item.name} deleted from the map. Undo change brings it back.`);
      return;
    }
    save();
    drawAll();
    if (pickUp) {
      startPlacing(id);
      mapMessage(item.added ? `Click the new spot for ${item.name}. Esc puts it back where it was.`
        : `Click the new spot for ${item.name}. Esc leaves it under “Pins to place”.`);
    } else {
      mapMessage(`${item.name} taken off the map. It waits under the map in “Pins to place”; Undo change puts it back.`);
      view.querySelector(`#sm-tray [data-place="${id}"]`)?.focus({ preventScroll: true });
    }
  }

  // Moving an added pin was cancelled: it goes back to where it stood.
  function putBackMoved() {
    const s = site();
    const from = moveFrom;
    moveFrom = null;
    if (!from || !s || s.placements[from.id] || !s.extraPins?.some((pin) => pin.id === from.id)) return;
    s.placements = { ...s.placements, [from.id]: from.at };
    save();
    drawAll();
  }

  // An added pin whose placing was cancelled is dropped again.
  function dropUnplacedAdded() {
    const s = site();
    if (!s?.extraPins?.length) return;
    const kept = placedExtraPins(s.extraPins, s.placements);
    if (kept.length === s.extraPins.length) return;
    s.extraPins = kept;
    refreshItems(); save();
  }

  function stopPlacing() {
    placing = null; ghost = null;
    if (mode === 'place') setMode('explore'); else { drawEdit(); renderTray(); }
  }

  function placeAt(point) {
    const s = site();
    const item = findItem(placing, items);
    const spot = pinSpot(s, item, point);
    if (!spot.ok) { mapMessage(spot.problem); return; }
    s.placements = { ...s.placements, [item.id]: spot.at };
    if (item.id === 'entrance') s.entrance = spot.at;
    if (moveFrom?.id === item.id) moveFrom = null;
    save();
    // After an added pin, placing ends; after a built-in one, the next missing pin is ready.
    const next = item.added ? null : nextPinToPlace(items.filter((entry) => !entry.added), s.placements, item.id);
    placing = next?.id || null; ghost = null;
    if (next) showCategory(next.category);
    selectedId = item.id;
    drawAll();
    if (!next) {
      setMode('explore');
      if (item.added) mapMessage(`${item.name} is on the map. Drag it to fine-tune, or add another from its menu; Save changes keeps it.`);
      else celebrate();
    }
  }

  // The last pin is on the map: say how good the new layout is.
  function celebrate() {
    const s = site();
    const score = layoutScore(checkLayout(s, s.placements, items));
    view.querySelector('.sm-ring')?.classList.add('sm-ring-done');
    mapMessage(score === 100 ? `All ${items.length} pins placed, and every layout rule is met. Choose Save changes to keep it.`
      : `All ${items.length} pins placed. Layout check: ${score}%. Click a red rule to see what to move, then Save changes.`);
  }

  function fillMissing() {
    const s = site();
    const result = suggestLayout(s, baseItems());
    if (result.problem) { mapMessage(result.problem); return; }
    const before = items.filter((item) => s.placements[item.id]).length;
    s.placements = fillMissingPins(s.placements, result.placements);
    placing = null; ghost = null;
    save();
    if (mode === 'place') setMode('explore');
    drawAll();
    const added = items.filter((item) => s.placements[item.id]).length - before;
    const score = layoutScore(checkLayout(s, s.placements, items));
    mapMessage(`${added} ${added === 1 ? 'pin' : 'pins'} added; your ${before} placed ${before === 1 ? 'pin stays' : 'pins stay'} where you put them. Layout check: ${score}%.`);
  }

  // The dock under the map: every pin still waiting for a place, by category, with progress.
  // Pins are dragged from here onto the map (or clicked, then placed with a click), and dragged
  // back here to take them off the map.
  function renderTray() {
    const tray = view.querySelector('#sm-tray');
    if (!tray) return;
    const s = site();
    const groups = pinChoices(items, s.placements);
    tray.hidden = lineupProblem();
    if (tray.hidden) { tray.innerHTML = ''; return; }
    const { total, placed } = pinCounts(items, s.placements);
    const locked = !editable() || busy;
    const current = placing ? findItem(placing, items) : null;
    const head = `<div class="sm-dock-head">
        <h2 id="sm-tray-title">Pins to place</h2>
        <span class="sm-dock-count">${placed} of ${total} on the map</span>
        <div class="sm-tray-progress ${groups.length ? '' : 'done'}" role="progressbar" aria-label="Pins placed" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${placed}"><i style="width:${Math.round((placed / total) * 100)}%"></i></div>
        ${baseItems().some((entry) => !s.placements[entry.id]) ? `<button type="button" class="button primary" data-tray="fill" ${locked ? 'disabled' : ''} title="Keeps every pin you placed and plans only the missing ones">Fill the rest for me</button>` : ''}
        <button type="button" class="button secondary sm-add-toggle ${addOpen ? 'on' : ''}" data-tray="add" aria-expanded="${addOpen}" ${locked ? 'disabled' : ''}>+ Add pin</button>
      </div>
      ${addOpen && !locked ? addChooser() : ''}`;
    const drop = '<div class="sm-dock-drop" aria-hidden="true">Drop here to take the pin off the map</div>';
    if (!groups.length) {
      tray.innerHTML = `${head}<p class="sm-dock-empty"><b>✓ Every facility is on the map.</b> Drag a pin to move it. To take one off, drag it here or click it and choose <b>Remove</b>.</p>${addedList(locked)}${drop}`;
      return;
    }
    tray.innerHTML = `${head}
      <p class="sm-dock-help">${current ? `Placing <b>${escape(current.name)}</b>: click its spot on the map${current.onFence ? ' (it snaps to the fence)' : ''}.`
        : '<b>Drag a pin onto the map</b>, or click it and then click the map.'}</p>
      <div class="sm-dock-groups">${groups.map((group) => `<div class="sm-tray-group"><span class="sm-dock-label">${escape(group.title)} <small>${group.count}</small></span><div class="sm-tray-pins">
        ${group.choices.map((choice) => { const on = choice.ids.includes(placing); return `<button type="button" class="sm-tray-pin ${on ? 'on' : ''}" data-place="${choice.id}" aria-pressed="${on}" style="--marker:${group.colour}" ${locked ? 'disabled' : ''} aria-label="Place ${escape(choice.label)}${choice.count > 1 ? `, ${choice.count} left` : ''}">
          <i>${escape(choice.symbol)}</i>${escape(choice.label)}${choice.count > 1 ? `<b>×${choice.count}</b>` : ''}</button>`; }).join('')}</div></div>`).join('')}</div>
      ${addedList(locked)}${drop}`;
  }

  // Shortcuts for individual facilities; click to find a pin, × to delete it.
  function addedList(locked) {
    const s = site();
    const added = items.filter((item) => item.added && s.placements[item.id]);
    if (!added.length) return '';
    return `<div class="sm-dock-added"><span class="sm-dock-label">Pin shortcuts <small>${added.length}</small></span><div class="sm-tray-pins">
      ${added.map((item) => `<span class="sm-added-chip ${item.id === selectedId ? 'on' : ''}" style="--marker:${colourOf(item.category)}">
        <button type="button" data-find-pin="${item.id}" aria-label="Show ${escape(item.name)} on the map"><i>${escape(item.symbol)}</i>${escape(item.name)}</button>
        <button type="button" class="sm-added-x" data-delete-pin="${item.id}" ${locked ? 'disabled' : ''} aria-label="Delete ${escape(item.name)}" title="Delete">×</button></span>`).join('')}
    </div></div>`;
  }

  // "+ Add pin": big choices with a line on what each is for; "Own pin" asks for a name first.
  function addChooser() {
    const tiles = EXTRA_PIN_TYPES.map((type) => {
      const own = type.kind === 'marker';
      return `<button type="button" class="sm-add-tile ${own && ownOpen ? 'on' : ''}" ${own ? `data-add-own aria-expanded="${ownOpen}"` : `data-add-type="${type.kind}"`} style="--marker:${colourOf(type.category)}">
        <i>${escape(type.symbol)}</i><span><b>${escape(type.label)}</b><small>${escape(ADD_HINTS[type.kind] || '')}</small></span></button>`;
    }).join('');
    return `<div class="sm-add" role="group" aria-labelledby="sm-add-title">
      <div class="sm-add-head"><div><b id="sm-add-title">What do you want to add?</b><span>Pick one, then click its spot on the map.</span></div>
        <button type="button" class="sm-pop-close" data-tray="add" aria-label="Close “Add a pin”">×</button></div>
      <div class="sm-add-grid">${tiles}</div>
      ${ownOpen ? `<form class="sm-add-own" novalidate>
        <label for="sm-add-name">Name your pin</label>
        <div><input id="sm-add-name" maxlength="${EXTRA_PIN_NAME_MAX}" placeholder="e.g. VIP area, charging station" autocomplete="off" />
        <button type="submit" class="button primary">Place it on the map</button></div></form>` : ''}
    </div>`;
  }

  function addPin(kind) {
    if (!editable() || busy) return;
    const s = site();
    const name = kind === 'marker' ? view.querySelector('#sm-add-name')?.value || '' : '';
    const result = addExtraPin(s.extraPins, kind, name, baseItems());
    if (!result.ok) { mapMessage(result.problem); view.querySelector('#sm-add-name')?.focus(); return; }
    s.extraPins = result.extraPins;
    refreshItems();
    addOpen = false; ownOpen = false;
    selectedId = null;
    startPlacing(result.pin.id);
    view.querySelector('.sm-frame')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    mapMessage(`Now click the spot for ${findItem(result.pin.id, items).name} on the map. Esc cancels.`);
  }

  function toggleAdd(open = !addOpen, { own = false } = {}) {
    addOpen = open;
    ownOpen = open && own;
    if (open && mode === 'place') stopPlacing();
    renderTray();
    if (addOpen) {
      view.querySelector('#sm-tray')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      (view.querySelector('#sm-add-name') || view.querySelector('.sm-add-tile'))?.focus({ preventScroll: true });
    }
  }

  // The small menu next to the selected pin, right on the map.
  function renderPopover() {
    const pop = view.querySelector('#sm-pop');
    if (!pop) return;
    const s = site();
    const item = selectedId && s.placements[selectedId] && mode !== 'place' && !pointer?.drag ? findItem(selectedId, items) : null;
    if (!item || !active.includes(item.category)) { pop.hidden = true; return; }
    const at = s.placements[item.id];
    const vendor = item.kind === 'pitch' ? vendorOnPitch(vendors(), item.id) : null;
    pop.innerHTML = `<div class="sm-pop-title"><i style="--marker:${colourOf(item.category)}"></i><b>${escape(vendor ? `${item.name}: ${vendor.name}` : item.name)}</b>
        <button type="button" class="sm-pop-close" data-pop="close" aria-label="Close pin options">×</button></div>
      ${editable() ? `<div class="sm-pop-actions">
        <button type="button" data-pin="move" ${busy ? 'disabled' : ''} title="Pick the pin up, then click its new spot">↔ Move</button>
        <button type="button" data-pin="remove" class="danger" ${busy ? 'disabled' : ''} title="${item.added ? 'Delete this pin' : 'Take the pin off the map'} (Delete key)">✕ ${item.added ? 'Delete' : 'Remove'}</button>
      </div>${item.added ? `<button type="button" class="sm-pop-another" data-pin-another="${item.kind}" ${busy ? 'disabled' : ''}>+ ${escape(anotherPinLabel(item.kind))}</button>` : ''}<small>or drag the pin to a new spot</small>` : '<small>View only</small>'}`;
    pop.hidden = false;
    positionPopover(at);
  }

  function positionPopover(at = site().placements[selectedId]) {
    const pop = view.querySelector('#sm-pop');
    const svg = view.querySelector('#sm-svg');
    if (!pop || pop.hidden || !at || !svg?.getScreenCTM) return;
    const ctm = svg.getScreenCTM();
    const frame = view.querySelector('.sm-map-viewport').getBoundingClientRect();
    if (!ctm) return;
    const pinTop = at[1] - (box.w / 58) * 2.6;  // the pin is drawn above its point
    const x = at[0] * ctm.a + ctm.e - frame.left;
    let y = pinTop * ctm.d + ctm.f - frame.top - 12;   // a gap, so the menu never covers the pin itself
    const below = y < pop.offsetHeight + 12;
    if (below) y = at[1] * ctm.d + ctm.f - frame.top + 14;
    const inside = x > 0 && x < frame.width && y > -20 && y < frame.height + 20;
    pop.classList.toggle('below', below);
    pop.style.visibility = inside ? '' : 'hidden';
    // Keep the whole menu inside the map; the little arrow still points at the pin.
    const half = pop.offsetWidth / 2;
    const left = Math.min(frame.width - half - 6, Math.max(half + 6, x));
    pop.style.left = `${left}px`;
    pop.style.top = `${y}px`;
    pop.style.setProperty('--arrow', `${Math.min(half - 10, Math.max(10 - half, x - left))}px`);
  }

  function deselect() {
    if (!selectedId) return;
    selectedId = null;
    drawObjects(); renderDetails();
  }

  // Screen point → map point, or null when the point is not over the map.
  function mapPointAt(clientX, clientY) {
    const svg = view.querySelector('#sm-svg');
    const rect = svg?.getBoundingClientRect();
    if (!rect || clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
    const point = svg.createSVGPoint();
    point.x = clientX; point.y = clientY;
    const p = point.matrixTransform(svg.getScreenCTM().inverse());
    return [Math.round(p.x), Math.round(p.y)];
  }

  function overDock(clientX, clientY) {
    const rect = view.querySelector('#sm-tray')?.getBoundingClientRect();
    return Boolean(rect) && clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }

  // The confirmation for "Clear all pins": what goes, what stays, and that it can be undone.
  function openClearDialog() {
    const s = site();
    const dialog = view.querySelector('#sm-clear-dialog');
    const hasGate = Boolean(s.placements.entrance);
    // "Keep the main entrance" starts ticked, so the first count already leaves the gate out.
    const counts = pinCounts(items, s.placements, { keepGate: hasGate });
    if (!counts.toRemove) { mapMessage('There are no pins to clear on this map. Pick one under “Pins to place”.'); return; }
    const byCategory = MAP_CATEGORIES.map((category) => ({ ...category,
      count: items.filter((item) => item.category === category.id && item.id !== 'entrance' && s.placements[item.id]).length })).filter((category) => category.count);
    dialog.querySelector('form').innerHTML = `
      <p class="eyebrow">Site map · ${escape(s.name)}</p>
      <h2 id="sm-clear-title">Start the layout from scratch?</h2>
      <p>All <b id="sm-clear-count">${counts.toRemove}</b> pins are taken off the map so you can place every facility yourself.</p>
      <ul class="sm-clear-chips">${byCategory.map((category) => `<li style="--marker:${category.colour}"><i></i>${category.count} ${escape(category.title)}</li>`).join('')}</ul>
      ${hasGate ? '<label class="sm-clear-keep"><input type="checkbox" id="sm-clear-keep-gate" checked /> <span>Keep the main entrance where it is<small>Everything else is planned around the gate.</small></span></label>' : ''}
      ${s.extraPins?.length ? `<p class="sm-clear-safe">The ${s.extraPins.length} ${s.extraPins.length === 1 ? 'pin you added is' : 'pins you added are'} deleted.</p>` : ''}
      <div class="sm-clear-stays"><b>Stays as it is:</b> the map, the fence, no-go areas, the festival size and crowd measurements.</div>
      <p class="sm-clear-safe">Nothing is saved yet. <b>Undo change</b> brings the pins back right away, <b>Discard changes</b> returns to your saved map.</p>
      <div class="dialog-actions"><button class="button secondary" value="cancel">Keep my pins</button><button class="button danger" value="clear" id="sm-clear-confirm">Clear ${counts.toRemove} pins</button></div>`;
    const keep = dialog.querySelector('#sm-clear-keep-gate');
    keep?.addEventListener('change', () => {
      const n = pinCounts(items, s.placements, { keepGate: keep.checked }).toRemove;
      dialog.querySelector('#sm-clear-count').textContent = n;
      dialog.querySelector('#sm-clear-confirm').textContent = `Clear ${n} pins`;
    });
    dialog.returnValue = '';
    dialog.onclose = () => {
      if (dialog.returnValue === 'clear') clearPins({ keepGate: Boolean(keep?.checked) });
      else view.querySelector('#sm-clear-pins')?.focus();
    };
    dialog.showModal();
    dialog.querySelector('[value="cancel"]').focus();
  }

  function clearPins({ keepGate }) {
    if (!editable() || busy) return;
    const s = site();
    const removed = pinCounts(items, s.placements, { keepGate }).toRemove;
    s.placements = clearedPlacements(s.placements, { keepGate });
    if (s.extraPins?.length) s.extraPins = [];   // added pins are deleted, not kept waiting
    refreshItems();
    selectedId = null;
    save();
    const first = nextPinToPlace(items, s.placements);
    placing = null;
    drawAll();
    if (first) startPlacing(first.id);
    mapMessage(`${removed} pins cleared. Click the map to place ${first ? first.name : 'the first pin'}; Undo change brings them all back.`);
  }

  function renderHint() {
    const hint = view.querySelector('#sm-hint');
    if (mode === 'place') {
      const item = placing ? findItem(placing, items) : null;
      const left = pinsToPlace(items, site().placements).reduce((sum, group) => sum + group.items.length, 0);
      if (item?.added) {
        hint.innerHTML = `<span>${moveFrom ? 'Click the new spot for' : 'Click the map to place'} <b>${escape(item.name)}</b> · Esc ${moveFrom ? 'puts it back' : 'cancels'}</span><button type="button" class="button secondary" data-tray="stop">Cancel</button>`;
        return;
      }
      hint.innerHTML = item
        ? `<span>Click the map to place <b>${escape(item.name)}</b>${item.onFence ? ' (snaps to the fence)' : ''} · ${left} left · Esc to stop</span><button type="button" class="button secondary" data-tray="skip">Skip</button> <button type="button" class="button secondary" data-tray="stop">Done placing</button>`
        : '<span>Pick a pin under “Pins to place”.</span>';
      return;
    }
    const extra = mode === 'border' || draftBorder?.length
      ? ` <button type="button" class="button primary" data-border="done" ${(draftBorder || []).length < 3 ? 'disabled' : ''}>Done (${(draftBorder || []).length} corners)</button> <button type="button" class="button secondary" data-border="cancel">Cancel</button>`
      : '';
    const pending = mode !== 'border' && draftBorder?.length ? ' Your fence draft is still pending; finish or cancel it before saving.' : '';
    hint.innerHTML = `<span>${MODES[mode].hint}${pending}</span>${extra}`;
  }

  // ---------- right column ----------
  function renderDetails() {
    const panel = view.querySelector('#sm-details');
    const s = site();
    const item = selectedId && s.placements[selectedId] ? findItem(selectedId, items) : null;
    if (!item) {
      panel.innerHTML = `<h2>Click a pin</h2><p class="map-text">Every pin on the map is a facility. Click it to see what it is, who is responsible, how far it is from the gate and which layout rules it meets.</p>`;
      return;
    }
    const at = s.placements[item.id];
    const vendor = item.kind === 'pitch' ? vendorOnPitch(vendors(), item.id) : null;
    const fromGate = s.placements.entrance && item.id !== 'entrance'
      ? `${walkingMinutesBetween(s, s.placements.entrance, at)} min walk · ${metresBetweenPoints(s, s.placements.entrance, at)} m` : 'This is the gate.';
    const nearby = [['first-aid', 'First aid'], ['toilets', 'Toilets'], ['water', 'Water']]
      .filter(([kind]) => kind !== item.kind)
      .map(([kind, label]) => { const n = nearestOfKind(s, s.placements, at, kind, items); return n ? `<li><span>${label}</span><b>${n.metres} m</b></li>` : ''; }).join('');
    const rules = checkLayout(s, s.placements, items).filter((rule) => rule.items.includes(item.id));
    const vendorPart = item.kind !== 'pitch' ? '' : vendor
      ? `<div class="map-vendor"><span class="map-vendor-icon">${vendor.icon}</span><div><strong>${escape(vendor.name)}</strong><small>${vendor.category} · ${escape(vendor.text)}</small></div></div>
         <button class="button secondary" type="button" data-go-vendors>Open in Vendors</button>`
      : `<p class="map-free">Free pitch. Confirm a vendor on the Vendors page to fill it.</p>
         <button class="button primary" type="button" data-go-vendors>Choose a vendor</button>`;
    panel.innerHTML = `
      <h2>${escape(item.name)}</h2>
      <span class="map-pill" style="--marker:${colourOf(item.category)}">${titleOf(item.category)}</span>
      <p class="map-text">${escape(item.text)}</p>
      ${vendorPart}
      <dl class="map-facts">
        <div><dt>Responsible team</dt><dd>${item.team}</dd></div>
        <div><dt>OPEN</dt><dd>${item.hours}</dd></div>
        <div><dt>From the main gate</dt><dd>${fromGate}</dd></div>
      </dl>
      ${nearby ? `<p class="sm-sub">Nearest</p><ul class="sm-nearby">${nearby}</ul>` : ''}
      ${rules.length ? `<p class="sm-sub">Layout rules</p><ul class="sm-rules">${rules.map((rule) => `<li class="${rule.ok ? 'ok' : 'problem'}"><b>${rule.ok ? '✓' : '✕'}</b><span>${rule.label}<small>${escape(rule.detail)}</small></span></li>`).join('')}</ul>` : ''}
      ${editable() ? `<div class="sm-pin-actions">
        <button type="button" class="button secondary" data-pin="move" ${busy ? 'disabled' : ''}>Move to another spot</button>
        <button type="button" class="button danger" data-pin="remove" ${busy ? 'disabled' : ''}>${item.added ? 'Delete pin' : 'Remove from map'}</button></div>
      <p class="sm-sub">${item.added ? 'Drag the pin to move it. Delete removes it completely; Undo change brings it back.' : 'Tip: drag the pin to move it, or select it and press Delete to remove it.'}</p>` : ''}`;
  }

  function renderScore() {
    const s = site();
    if (lineupProblem()) {
      view.querySelector('#sm-score').innerHTML = '<h2>Map checks paused</h2><p class="sm-note">Recover the saved lineup before assessing the map. Its active stages are currently unknown.</p>';
      return;
    }
    const rules = checkLayout(s, s.placements, items);
    const score = layoutScore(rules);
    const passed = rules.filter((r) => r.ok).length;
    view.querySelector('#sm-score').innerHTML = `
      <div class="sm-score-top">
        <div class="sm-ring" style="--score:${score}"><span>${score}<small>%</small></span></div>
        <div><p class="sm-score-label">Layout check</p><strong>${passed} of ${rules.length} rules met</strong><small>${score === 100 ? 'This layout is ready to work with.' : 'Click a rule to see what to fix.'}</small></div>
      </div>
      ${rules[0].ok ? '' : `<div class="sm-missing"><span>${missingText(items.filter((i) => !s.placements[i.id]).length)} for ${needs.visitors.toLocaleString('en-GB')} visitors still ${items.filter((i) => !s.placements[i.id]).length === 1 ? 'needs' : 'need'} a place.</span><button type="button" class="button primary" data-action="plan-missing">Plan them</button></div>`}
      <ul class="sm-rules">${rules.map((rule) => `<li class="${rule.ok ? 'ok' : 'problem'}" data-rule="${rule.id}" tabindex="0"><b>${rule.ok ? '✓' : '✕'}</b><span>${rule.label}<small>${escape(rule.detail)}</small></span></li>`).join('')}</ul>`;
  }

  const missingText = (count) => `${count} ${count === 1 ? 'facility' : 'facilities'}`;

  function renderSettings() {
    const s = site();
    view.querySelector('#sm-settings').innerHTML = `
      <label class="sm-field">Map name<input id="sm-name" maxlength="60" value="${escape(s.name)}" ${s.id === 'demo' || !editable() ? 'disabled' : ''} /></label>
      <label class="sm-field">Real width of the map (metres)<input id="sm-width" type="number" min="20" max="20000" step="any" value="${s.widthMetres}" ${!editable() ? 'disabled' : ''} />
        <small>Sets the scale for all map distances and facility sizes.</small></label>
      <div class="sm-setting-buttons"><label class="button secondary sm-upload">⇪ Upload map<input type="file" accept="image/*" id="sm-upload" class="hidden" /></label>
        ${s.image ? '<button type="button" class="button secondary" data-action="detect">Detect water automatically</button>' : ''}
        <button type="button" class="button secondary" data-action="clear-nogo">Clear no-go areas</button>
        ${s.image ? '<button type="button" class="button secondary" data-action="whole">Use whole image as ground</button>' : ''}
        ${s.id === 'demo' ? '<button type="button" class="button secondary" data-action="reset-demo">Reset demo map</button>' : '<button type="button" class="button danger" data-action="delete">Delete this map</button>'}
      </div>`;
    if (!editable()) view.querySelectorAll('#sm-settings button, #sm-settings input').forEach(control => { control.disabled = true; });
  }

  function renderSize() {
    const rows = [
      ['Toilet cabins', `${needs.toiletCabins}`, `${needs.toiletBlocks} rows of 8 on the map`],
      ['Water points', `${needs.waterPoints}`, 'on the map'],
      ['Food pitches', `${needs.pitches}`, 'on the map and the Vendors page'],
      ['First aiders', `${needs.firstAiders}`, 'crew on duty'],
      ['Security staff', `${needs.securityStaff}`, 'crew on duty']
    ];
    view.querySelector('#sm-size').innerHTML = `
      <label class="sm-field">Expected visitors<input id="sm-visitors" type="number" min="${MIN_VISITORS}" max="${MAX_VISITORS}" step="500" value="${ground.visitors}" ${!editable() ? 'disabled' : ''} /></label>
      <ul class="sm-needs">${rows.map(([label, value, note]) => `<li><b>${value}</b><span>${label}<small>${note}</small></span></li>`).join('')}</ul>
      <small class="sm-note">Rules of thumb for a one-day open-air event (e.g. one toilet per 100 visitors). Check the local authority's rules for the real event.</small>`;
  }

  function renderCrowd() {
    const panel = view.querySelector('#sm-crowd');
    if (!panel) return;
    if (lineupProblem()) {
      panel.innerHTML = '<p class="sm-note">Crowd and evacuation estimates are unavailable until the saved lineup is recovered.</p>';
      return;
    }
    const assumptionsOpen = !!panel.querySelector('.sm-assumptions')?.open;
    const { safety, checks, evacuation } = crowdSafetyChecks(site(), ground.visitors, activeStageIds(items));
    const crowdStages = Object.keys(safety.stages);
    const routeLabels = evacuation.valid ? crowdStages.map(id => {
      const route = evacuation.originAssignments.find(value => value.originId === id);
      const label = `Stage ${id.slice(-1).toUpperCase()}`;
      return route ? `${label} → Exit ${route.exitId.slice(-1)}` : `${label}: no audience`;
    }) : [];
    const otherRoute = evacuation.originAssignments.find(route => route.originId === 'other-visitors');
    if (otherRoute) routeLabels.push(`Other visitors → Exit ${otherRoute.exitId.slice(-1)}`);
    const input = (label, path, value, min = '0', step = '1', unit = '') => `<label class="sm-field">${label}${unit ? ` (${unit})` : ''}<input type="number" data-crowd-field="${path}" min="${min}" step="${step}" value="${value === null ? '' : escape(value)}" ${!editable() ? 'disabled' : ''} /></label>`;
    panel.innerHTML = `
      <p class="sm-note">Enter measured usable audience areas, excluding stages, barriers and obstructions. Audience numbers describe the same peak scenario. Blank measurements cannot pass the checks.</p>
      <div class="sm-crowd-grid">${crowdStages.map(id => `<fieldset><legend>Stage ${id.slice(-1).toUpperCase()}</legend>
        ${input('Usable audience area', `stages.${id}.area`, safety.stages[id].area, '.1', '.1', 'm²')}
        ${input('Expected audience', `stages.${id}.audience`, safety.stages[id].audience, '0', '1', 'people')}
      </fieldset>`).join('')}
      ${CROWD_EXIT_IDS.map(id => `<fieldset><legend>Emergency exit ${id.slice(-1)}</legend>
        <label class="sm-crowd-checkbox"><input type="checkbox" data-crowd-field="exits.${id}.open" ${safety.exits[id].open ? 'checked' : ''} ${!editable() ? 'disabled' : ''} /> Available in this scenario</label>
        ${input('Clear usable width', `exits.${id}.width`, safety.exits[id].width, '.1', '.1', 'm')}
      </fieldset>`).join('')}</div>
      <details class="sm-assumptions" ${assumptionsOpen ? 'open' : ''}><summary>Calculation assumptions</summary><div class="sm-crowd-grid">
        ${input('Walking speed', 'walkingSpeed', safety.walkingSpeed, '.1', '1', 'm/min')}
        ${input('Exit flow', 'flowRate', safety.flowRate, '.1', '1', 'people/m/min')}
        ${input('Response delay', 'preMovementMinutes', safety.preMovementMinutes, '0', '.1', 'min')}
        ${input('Project evacuation target', 'targetMinutes', safety.targetMinutes, '.1', '.1', 'min')}
        ${input('Project density limit', 'densityLimit', safety.densityLimit, '.1', '.1', 'people/m²')}
      </div><p class="sm-note">Starting assumptions: 60 m/min walking, 2 min response delay, a 10 min project target and 2 people/m² density limit. Exit flow starts at 82 people/m/min, the SGSA level-route reference maximum; choose a lower appropriate value when needed. These are editable project assumptions, not legal limits.</p>
      <p class="sm-note">People from each stage use the nearest reachable open exit. Remaining visitors start at the food-court centre. Estimate = response delay + the longest (route travel time + exit queue time). It does not simulate shared-route bottlenecks, uneven crowds, accessibility needs or behaviour.</p>
      <p class="sm-note">References: <a href="https://www.hse.gov.uk/event-safety/venue-site-design.htm" target="_blank" rel="noopener noreferrer">HSE site design</a> · <a href="https://www.gov.uk/government/publications/fire-safety-risk-assessment-open-air-events-and-venues" target="_blank" rel="noopener noreferrer">Home Office open-air guidance</a> · <a href="https://sgsa.org.uk/wp-content/uploads/2025/09/Vehicle-Security-Barriers-at-Event-Venues.pdf" target="_blank" rel="noopener noreferrer">SGSA flow reference</a></p></details>
      <ul class="sm-rules">${checks.map(rule => `<li class="${rule.ok ? 'ok' : 'problem'}"><b>${rule.ok ? '✓' : '!'}</b><span>${escape(rule.label)}<small>${escape(rule.detail)}</small></span></li>`).join('')}</ul>
      ${evacuation.valid ? `<p class="sm-note">${evacuation.exits.map(exit => `Exit ${exit.id.slice(-1)}: ${exit.people.toLocaleString('en-GB')} people · longest route ${Math.round(exit.longestMetres)} m · travel ${exit.travelMinutes.toFixed(1)} min + queue ${exit.queueMinutes.toFixed(1)} min`).join('<br>')}</p>` : ''}
      ${evacuation.valid ? `<p class="sm-note" id="sm-evacuation-routes">Estimated routes: ${escape(routeLabels.join(' · '))}</p>` : ''}
      <p class="sm-note">Planning estimates only. A qualified assessment and applicable local requirements determine real event capacity and evacuation arrangements. Choose Save changes to include these inputs in the saved plan and Overview readiness.</p>`;
  }

  // A new festival size: new facility list; the map shows what still needs a place.
  function changeVisitors(value) {
    if (!validVisitors(value)) { mapMessage(`Please enter a whole number from ${MIN_VISITORS.toLocaleString('en-GB')} to ${MAX_VISITORS.toLocaleString('en-GB')}.`); renderSize(); return; }
    ground = { visitors: Number(value) };
    needs = sizeFor(ground.visitors);
    refreshItems();
    save();
    if (selectedId && !findItem(selectedId, items)) selectedId = null;
    renderSize(); drawAll(); renderCrowd();
    const missing = items.filter((i) => !site().placements[i.id]).length;
    mapMessage(missing ? `${missing} new facilities need a place. Press “Plan them” or “Suggest layout”, then Save changes.` : 'Festival size changed in the draft. Choose Save changes to keep it.');
  }

  // ---------- actions ----------
  function suggest() {
    const s = site();
    const result = suggestLayout(s, baseItems());
    if (result.problem) { mapMessage(result.problem); return; }
    s.placements = { ...result.placements, ...addedPlacements(s) };
    save();
    drawAll();
    const score = layoutScore(checkLayout(s, s.placements, items));
    mapMessage(score === 100 ? 'Optimal layout suggested: all rules met.' : `Layout suggested: ${score}% of the rules met. The check on the right shows what the ground cannot fit.`);
  }

  function switchMap(id, skipNavigationCheck = false) {
    if (id === currentId) return true;
    if (!skipNavigationCheck && !window.confirmMapNavigation()) {
      view.querySelector('#sm-select').value = currentId;
      renderSettings(); return false;
    }
    currentId = id; selectedId = null; draftBorder = null; box = null; placing = null; ghost = null; mode = 'explore';
    // Choosing the festival's active map is saved deliberately too. Overview keeps
    // using the previous committed map until Save changes is chosen.
    if (!skipNavigationCheck && editable()) save();
    renderPage();
    return true;
  }

  function setMode(next) {
    closeSimulation();
    mode = next;
    if (mode !== 'place') { placing = null; ghost = null; putBackMoved(); dropUnplacedAdded(); }
    if (mode === 'border' && draftBorder === null) draftBorder = [];
    view.querySelector('.sm-frame').className = `sm-frame mode-${mode}`;
    view.querySelectorAll('[data-mode]').forEach((b) => { b.classList.toggle('on', b.dataset.mode === mode); b.setAttribute('aria-pressed', b.dataset.mode === mode); });
    drawNogo(); drawEdit(); renderHint(); renderDetails(); renderDraftActions(); renderTray(); renderPopover();
  }

  function select(id) {
    selectedId = id;
    const item = findItem(id, items);
    if (item && !active.includes(item.category)) active = [...active, item.category];
    drawObjects(); renderDetails();
  }

  // Shrink the image so it fits in the browser storage, then read the colours for water detection.
  function loadImage(src) {
    return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src; });
  }

  async function upload(file) {
    if (!file || !file.type.startsWith('image/')) { mapMessage('Please choose an image file (JPG or PNG).'); return; }
    if (!editable() || busy) return;
    busy = true; renderDraftActions();
    let objectUrl;
    try {
      objectUrl = URL.createObjectURL(file);
      const original = await loadImage(objectUrl);
      const scale = Math.min(1, 1600 / Math.max(original.width, original.height));
      const width = Math.round(original.width * scale);
      const height = Math.round(original.height * scale);
      const rows = Math.max(1, Math.round(GRID_COLS * height / width));
      if (width < 1 || height < 1 || !Number.isFinite(rows) || rows * GRID_COLS > MAX_MAP_GRID_CELLS) {
        mapMessage('This image is too narrow for a usable map grid. Crop it to a wider ground plan and upload it again.');
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(original, 0, 0, width, height);
      const inset = Math.round(Math.min(width, height) * 0.03);
      const created = {
        id: `map-${Date.now()}`, name: file.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'My map',
        image: canvas.toDataURL('image/jpeg', 0.82), width, height, widthMetres: 500,
        boundary: [[inset, inset], [width - inset, inset], [width - inset, height - inset], [inset, height - inset]],
        entrance: null, grid: emptyGrid(width, height), placements: {}
      };
      created.grid = await detectWater(created);
      created.placements = suggestLayout(created, baseItems()).placements;
      sites.push(created);
      switchMap(created.id, true); save();
      mapMessage('Map uploaded and a first layout suggested. Set the real width, the fence and the gate, then suggest again.');
    } catch {
      mapMessage('This image could not be read. Try a JPG or PNG.');
    } finally { if (objectUrl) URL.revokeObjectURL(objectUrl); busy = false; renderDraftActions(); }
  }

  // Water is blue: every grid cell whose average colour is clearly blue becomes a no-go area.
  async function detectWater(s) {
    const img = await loadImage(s.image);
    const canvas = document.createElement('canvas');
    canvas.width = s.grid.cols; canvas.height = s.grid.rows;
    const context = canvas.getContext('2d');
    context.imageSmoothingQuality = 'high';
    context.drawImage(img, 0, 0, s.grid.cols, s.grid.rows);
    const data = context.getImageData(0, 0, s.grid.cols, s.grid.rows).data;
    let cells = '';
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      cells += b > 60 && b > r + 25 && b > g - 8 ? '1' : s.grid.cells[i / 4];
    }
    return { ...s.grid, cells };
  }

  function paintAt(p, value) {
    const s = site();
    const c = Math.floor((p[0] / s.width) * s.grid.cols);
    const r = Math.floor((p[1] / s.height) * s.grid.rows);
    let changed = false;
    const cells = s.grid.cells.split('');
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr; const cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= s.grid.rows || cc >= s.grid.cols) continue;
      if (cells[rr * s.grid.cols + cc] !== value) { cells[rr * s.grid.cols + cc] = value; changed = true; }
    }
    if (changed) { s.grid = { ...s.grid, cells: cells.join('') }; drawNogo(); }
  }

  function zoom(factor, centre) {
    const s = site();
    const w = Math.min(s.width, Math.max(s.width / 10, box.w * factor));
    const h = (w / s.width) * s.height;
    const c = centre || [box.x + box.w / 2, box.y + box.h / 2];
    box = { ...box, w, h, x: c[0] - ((c[0] - box.x) * w) / box.w, y: c[1] - ((c[1] - box.y) * h) / box.h };
    clampBox();
    applyBox(); drawObjects(); drawEdit();
  }
  function clampBox() {
    const s = site();
    box.x = Math.min(s.width - box.w, Math.max(0, box.x));
    box.y = Math.min(s.height - box.h, Math.max(0, box.y));
  }

  // ---------- mouse and keyboard on the map ----------
  function bindMap() {
    const svg = view.querySelector('#sm-svg');
    const toMap = (event) => {
      const point = svg.createSVGPoint();
      point.x = event.clientX; point.y = event.clientY;
      const p = point.matrixTransform(svg.getScreenCTM().inverse());
      return [Math.round(p.x), Math.round(p.y)];
    };

    svg.addEventListener('pointerdown', (event) => {
      const s = site();
      const p = toMap(event);
      const itemEl = event.target.closest('.fa-item');
      pointer = { start: [event.clientX, event.clientY], startBox: { ...box }, moved: false, itemId: itemEl?.dataset.id || null, el: itemEl, at: p };
      svg.setPointerCapture(event.pointerId);
      if ((!editable() || busy) && mode !== 'explore') { pointer = null; return; }
      if (mode === 'border') { draftBorder = [...(draftBorder || []), p]; save(); drawEdit(); renderHint(); renderDraftActions(); pointer = null; return; }
      if (mode === 'entrance') {
        s.entrance = nearestBoundaryPoint(s, p);
        s.placements.entrance = s.entrance;
        save(); drawAll(); select('entrance');
        mapMessage('Gate set. Press “Suggest layout” to plan around it.');
        pointer = null; return;
      }
      if (mode === 'paint' || mode === 'erase') { pointer.paint = mode === 'paint' ? '1' : '0'; paintAt(p, pointer.paint); return; }
      // A pin can be dragged straight away (not only in "Move pins"); a short click still selects it.
      if (pointer.itemId && editable() && !busy) {
        pointer.origin = s.placements[pointer.itemId];
        if (mode === 'move') startPinDrag();
        else pointer.canDrag = true;
      }
    });

    function startPinDrag() {
      pointer.drag = true;
      pointer.canDrag = false;
      select(pointer.itemId);
      pointer.el = view.querySelector(`.fa-item[data-id="${pointer.itemId}"]`);
      view.querySelector('#sm-pop').hidden = true;
      view.querySelector('#sm-tray')?.classList.add('dropping');
    }

    svg.addEventListener('pointermove', (event) => {
      if (!pointer && mode === 'place' && placing) {
        const p = toMap(event);
        const spot = pinSpot(site(), findItem(placing, items), p);
        ghost = { at: spot.ok ? spot.at : p, ok: spot.ok };
        drawEdit();
        return;
      }
      if (!pointer) return;
      const dx = event.clientX - pointer.start[0];
      const dy = event.clientY - pointer.start[1];
      if (Math.hypot(dx, dy) > 4) pointer.moved = true;
      if (pointer.paint) { paintAt(toMap(event), pointer.paint); return; }
      if (pointer.canDrag && pointer.moved) startPinDrag();
      if (pointer.drag) {
        const p = toMap(event);
        site().placements[pointer.itemId] = p;
        pointer.el?.setAttribute('transform', `translate(${p[0]} ${p[1]})`);
        view.querySelector('#sm-tray')?.classList.toggle('hot', overDock(event.clientX, event.clientY));
        return;
      }
      if (pointer.moved) {
        const scale = pointer.startBox.w / svg.clientWidth;
        box = { ...box, x: pointer.startBox.x - dx * scale, y: pointer.startBox.y - dy * scale };
        clampBox(); applyBox();
      }
    });

    const finish = (event) => {
      if (!pointer) return;
      if (pointer.paint) { save(); drawObjects(); renderScore(); renderDetails(); renderCrowd(); }
      else if (pointer.drag) { const done = pointer; pointer = null; finishPinDrag(done, event); return; }
      else if (!pointer.moved && pointer.itemId) select(pointer.itemId);
      else if (!pointer.moved && mode === 'place' && placing && editable() && !busy) { const at = pointer.at; pointer = null; placeAt(at); return; }
      else if (!pointer.moved && mode === 'explore') deselect();
      pointer = null;
    };

    // A dragged pin: dropped on the dock = off the map; on a bad spot = back where it was.
    function finishPinDrag(done, event) {
      const tray = view.querySelector('#sm-tray');
      tray?.classList.remove('dropping', 'hot');
      const s = site();
      const item = findItem(done.itemId, items);
      if (event && overDock(event.clientX, event.clientY)) {
        s.placements[done.itemId] = done.origin;
        removePin(done.itemId);
        return;
      }
      const spot = pinSpot(s, item, s.placements[done.itemId]);
      if (!spot.ok) {
        s.placements[done.itemId] = done.origin;
        drawAll();
        mapMessage(item.onFence ? `${spot.problem} The pin went back to where it was.`
          : `${item.name} cannot stand on water, forest or outside the fence, so it went back to where it was.`);
        return;
      }
      s.placements[done.itemId] = spot.at;
      if (done.itemId === 'entrance') s.entrance = spot.at;
      save(); drawAll();
    }
    svg.addEventListener('pointerleave', () => { if (ghost) { ghost = null; drawEdit(); } });
    svg.addEventListener('pointerup', finish);
    svg.addEventListener('pointercancel', finish);
    svg.addEventListener('wheel', (event) => { event.preventDefault(); zoom(event.deltaY > 0 ? 1.15 : 1 / 1.15, toMap(event)); }, { passive: false });
    svg.addEventListener('keydown', (event) => {
      const itemEl = event.target.closest('.fa-item');
      if (itemEl && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); select(itemEl.dataset.id); }
      if (itemEl && (event.key === 'Delete' || event.key === 'Backspace')) { event.preventDefault(); removePin(itemEl.dataset.id); }
    });
  }

  // ---------- clicks on buttons and inputs ----------
  view.addEventListener('click', (event) => {
    const t = event.target;
    const s = site();
    if (t.closest('#sm-save')) return commitChanges();
    if (t.closest('#sm-undo')) {
      if (editable() && !busy && undoMapDraft(draft)) { applyDraft(); mapMessage('Last map change undone. Choose Save changes to keep this version.'); }
      return;
    }
    if (t.closest('#sm-discard')) {
      if (editable() && !busy && window.confirm('Discard all unsaved map changes?')) { discardMapDraft(draft); applyDraft(); mapMessage('Unsaved map changes discarded.'); }
      return;
    }
    if (t.closest('#sm-suggest')) { if (editable() && !busy) suggest(); return; }
    if (t.closest('#sm-clear-pins')) { if (editable() && !busy) openClearDialog(); return; }
    if (t.closest('#sm-add-pin')) { if (editable() && !busy) toggleAdd(true); return; }
    const addType = t.closest('[data-add-type]')?.dataset.addType;
    if (addType) { addPin(addType); return; }
    if (t.closest('[data-add-own]')) { toggleAdd(true, { own: !ownOpen }); return; }
    const another = t.closest('[data-pin-another]')?.dataset.pinAnother;
    if (another) { if (another === 'marker') toggleAdd(true, { own: true }); else addPin(another); return; }
    const findPin = t.closest('[data-find-pin]')?.dataset.findPin;
    if (findPin) { select(findPin); renderTray(); return; }
    const deletePin = t.closest('[data-delete-pin]')?.dataset.deletePin;
    if (deletePin) { removePin(deletePin); return; }
    if (t.closest('[data-pop="close"]')) { deselect(); return; }
    const pinAction = t.closest('[data-pin]')?.dataset.pin;
    if (pinAction && selectedId) { removePin(selectedId, { pickUp: pinAction === 'move' }); return; }
    const placeButton = t.closest('[data-place]');
    if (placeButton) {
      if (suppressChipClick) { suppressChipClick = false; return; }
      startPlacing(placeButton.dataset.place); return;
    }
    const trayAction = t.closest('[data-tray]')?.dataset.tray;
    if (trayAction === 'stop') { stopPlacing(); return; }
    if (trayAction === 'add') { if (editable() && !busy) toggleAdd(); return; }
    if (trayAction === 'list') {
      // On narrow screens the list sits below the map: jump there and focus the pin being placed.
      const tray = view.querySelector('#sm-tray');
      tray?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      (tray?.querySelector('.sm-tray-pin.on') || tray?.querySelector('.sm-tray-pin'))?.focus({ preventScroll: true });
      return;
    }
    if (trayAction === 'skip') {
      const next = nextPinToPlace(items, site().placements, placing);
      if (next && next.id !== placing) startPlacing(next.id);
      return;
    }
    if (trayAction === 'fill') { if (editable() && !busy) fillMissing(); return; }
    const modeButton = t.closest('[data-mode]');
    if (modeButton) { if (modeButton.dataset.mode === 'explore' || (editable() && !busy)) setMode(modeButton.dataset.mode); return; }
    const chip = t.closest('[data-category]');
    if (chip) {
      const id = chip.dataset.category;
      active = active.includes(id) ? active.filter((c) => c !== id) : [...active, id];
      chip.classList.toggle('on', active.includes(id)); chip.setAttribute('aria-pressed', active.includes(id));
      return drawObjects();
    }
    const zoomButton = t.closest('[data-zoom]');
    if (zoomButton) {
      if (zoomButton.dataset.zoom === 'reset') { box = { site: currentId, x: 0, y: 0, w: s.width, h: s.height }; applyBox(); drawObjects(); drawEdit(); return; }
      return zoom(zoomButton.dataset.zoom === 'in' ? 1 / 1.4 : 1.4);
    }
    const border = t.closest('[data-border]');
    if (border) {
      if (!editable() || busy) return;
      if (border.dataset.border === 'done' && draftBorder.length >= 3) {
        s.boundary = draftBorder; draftBorder = null; save(); drawScene(); setMode('explore'); drawAll();
        mapMessage('Fence changed in the draft. Press “Suggest layout” to plan inside it, then Save changes.');
      } else { draftBorder = null; save(); setMode('explore'); }
      renderDraftActions();
      return;
    }
    const rule = t.closest('[data-rule]');
    if (rule) {
      const found = checkLayout(s, s.placements, items).find((r) => r.id === rule.dataset.rule);
      if (found && found.items.length) select(found.items[0]);
      return;
    }
    if (t.closest('[data-go-vendors]')) return document.querySelector('.sidebar-item[data-section="Vendors"]').click();
    const action = t.closest('[data-action]')?.dataset.action;
    if (action && (!editable() || busy)) return;
    if (action === 'plan-missing') return fillMissing();
    if (t.closest('.sm-upload')) mapMessage('Choose a JPG or PNG image. Uploading it creates a new map.');
    if (action === 'detect') {
      busy = true; renderDraftActions();
      mapMessage('Detecting water…');
      detectWater(s).then((grid) => { s.grid = grid; showNogo = true; save(); renderPage(); mapMessage('Blue areas marked in the draft. Check them and choose Save changes.'); })
        .catch(() => mapMessage('Water detection failed. Try again or mark no-go areas manually.'))
        .finally(() => { busy = false; renderDraftActions(); });
    } else if (action === 'clear-nogo') {
      s.grid = emptyGrid(s.width, s.height); save(); drawAll();
      mapMessage('No-go areas cleared.');
    } else if (action === 'whole') {
      s.boundary = [[0, 0], [s.width, 0], [s.width, s.height], [0, s.height]]; save(); drawScene(); drawAll();
      mapMessage('The whole image is now the festival ground.');
    } else if (action === 'reset-demo') {
      sites = sites.map((m) => (m.id === 'demo' ? demoSite(items) : m)); save(); renderPage(); mapMessage('Demo map restored.');
    } else if (action === 'delete' && window.confirm(`Delete the map “${s.name}” from this draft? Choose Save changes to keep the deletion.`)) {
      sites = sites.filter((m) => m.id !== s.id); switchMap('demo', true); save(); mapMessage('Map removed from the draft. Undo change can restore it.');
    }
  });

  view.addEventListener('change', (event) => {
    const s = site();
    if (event.target.id === 'sm-select') {
      const changed = switchMap(event.target.value);
      mapMessage(changed ? 'Map selected.' : 'Map selection cancelled. Your unsaved changes are still here.');
    }
    else if (event.target.id === 'sm-show-nogo') { showNogo = event.target.checked; drawNogo(); }
    else if (!editable() || busy) return;
    else if (event.target.matches('[data-crowd-field]')) {
      const retained = normalizeCrowdSafety(s.crowdSafety);
      const safety = normalizeCrowdSafety(retained, activeStageIds(items));
      const path = event.target.dataset.crowdField.split('.');
      let target = safety;
      path.slice(0, -1).forEach(key => { target = target[key]; });
      target[path.at(-1)] = event.target.type === 'checkbox' ? event.target.checked : event.target.value === '' ? null : Number(event.target.value);
      // A retired stage is excluded from calculations, but its measurements remain
      // available if that stage is brought back later. Editing A must not delete C.
      s.crowdSafety = { ...safety, stages: { ...retained.stages, ...safety.stages } };
      save(); renderCrowd();
    }
    else if (event.target.id === 'sm-upload') upload(event.target.files[0]);
    else if (event.target.id === 'sm-visitors') changeVisitors(event.target.value);
    else if (event.target.id === 'sm-name') {
      s.name = event.target.value.trim() || 'My map'; save();
      const option = Array.from(view.querySelector('#sm-select').options).find(value => value.value === s.id);
      if (option) option.textContent = s.name;
    }
    else if (event.target.id === 'sm-width') {
      const metres = Number(event.target.value);
      if (validMapWidth(event.target.value)) { s.widthMetres = metres; save(); drawAll(); }
      else {
        event.target.value = String(s.widthMetres);
        mapMessage('Enter a map width from 20 to 20,000 metres. The previous valid width has been kept.');
      }
    }
  });
  // Dragging a pin from "Pins to place" onto the map. A click without moving just picks it.
  view.addEventListener('pointerdown', (event) => {
    const chip = event.target.closest('#sm-tray [data-place]');
    if (!chip || chip.disabled || event.button > 0) return;
    chipDrag = { id: chip.dataset.place, start: [event.clientX, event.clientY], moved: false };
  });
  document.addEventListener('pointermove', (event) => {
    if (!chipDrag) return;
    if (!chipDrag.moved) {
      if (Math.hypot(event.clientX - chipDrag.start[0], event.clientY - chipDrag.start[1]) < 6) return;
      chipDrag.moved = true;
      startPlacing(chipDrag.id);
      chipDrag.id = placing;
      document.body.classList.add('sm-dragging-pin');
    }
    const p = mapPointAt(event.clientX, event.clientY);
    if (p && placing) {
      const spot = pinSpot(site(), findItem(placing, items), p);
      ghost = { at: spot.ok ? spot.at : p, ok: spot.ok };
    } else ghost = null;
    drawEdit();
  });
  document.addEventListener('pointerup', (event) => {
    if (!chipDrag) return;
    const drag = chipDrag;
    chipDrag = null;
    if (!drag.moved) return;
    document.body.classList.remove('sm-dragging-pin');
    suppressChipClick = true;
    setTimeout(() => { suppressChipClick = false; }, 0);
    const p = mapPointAt(event.clientX, event.clientY);
    if (p && placing) placeAt(p);
    else { ghost = null; drawEdit(); }
  });

  // Esc stops placing pins; Delete removes the selected pin (not while a dialog is open).
  document.addEventListener('keydown', (event) => {
    if (view.classList.contains('hidden') || view.querySelector('dialog[open]')) return;
    if (event.key === 'Escape' && mode === 'place') stopPlacing();
    else if (event.key === 'Escape' && addOpen) { toggleAdd(false); view.querySelector('#sm-add-pin')?.focus({ preventScroll: true }); }
    else if (event.key === 'Escape' && selectedId) deselect();
    // Delete removes the selected pin, unless the person is typing in a field.
    const typing = event.target?.closest?.('input, textarea, select, [contenteditable="true"]');
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId && !typing && !event.target?.closest?.('.fa-item')) {
      event.preventDefault(); removePin(selectedId);
    }
  });
  view.addEventListener('submit', (event) => {
    if (!event.target.closest('.sm-add-own')) return;
    event.preventDefault();
    addPin('marker');
  });
  view.addEventListener('keydown', (event) => {
    const rule = event.target.closest('[data-rule]');
    if (rule && event.key === 'Enter') rule.click();
  });

  // The Vendors page uses this to jump straight to a pitch on the map.
  window.openSiteMapAt = function (placeId) {
    selectedId = placeId;
    const item = findItem(placeId, items);
    if (item && !active.includes(item.category)) active = [...active, item.category];
    document.querySelector('.sidebar-item[data-section="Site map"]').click();
  };

  // Left navigation: "Site map" shows this page (freshly drawn, so new vendors appear), anything else hides it.
  document.addEventListener('click', event => {
    const button = event.target.closest('.sidebar-item');
    if (!button || button.dataset.section === 'Site map' || !window.hasUnsavedMapChanges()) return;
    if (!window.confirmMapNavigation()) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  document.querySelectorAll('.sidebar-item').forEach((button) => button.addEventListener('click', () => {
    const onMap = button.dataset.section === 'Site map';
    if (!onMap) closeSimulation();
    view.classList.toggle('hidden', !onMap);
    if (onMap) {
      if (!window.hasUnsavedMapChanges()) {
        ground = parseGround(read(GROUND_STORAGE_KEY)); needs = sizeFor(ground.visitors); items = layoutItems(needs); sites = loadSites();
        if (!site()) currentId = 'demo';
        // Re-entering can pick up saved changes made elsewhere in this app.
        const fresh = snapshot();
        // If the saved selection no longer exists (e.g. deleted on another device), the page shows the
        // demo map; count that as the saved state too, so it is not reported as an unsaved change.
        const storedId = read(SELECTED_KEY) || draft.saved.currentId;
        const committedId = sites.some((m) => m.id === storedId) ? storedId : currentId;
        committedMapIds = new Set(parseSiteMaps(read(SITE_MAPS_STORAGE_KEY)).map(map => map.id));
        draft.saved = { ...cloneMapDraft(fresh), currentId: committedId };
        draft.present = cloneMapDraft(editable() ? fresh : draft.saved); draft.previous = null;
      }
      renderPage();
    }
  }));
})();
