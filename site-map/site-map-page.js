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
    explore: { label: 'Explore', hint: 'Click a pin to see its details · drag to move around · scroll or use + / − to zoom.' },
    move: { label: 'Move pins', hint: 'Drag a pin to a new spot. The layout check updates when you let go.' },
    border: { label: 'Draw fence', hint: 'Click the corners of the festival ground one after another, then press “Done”.' },
    entrance: { label: 'Set gate', hint: 'Click the spot on the fence where the main entrance should be.' },
    paint: { label: 'Mark no-go', hint: 'Drag over water, forest, roads or buildings to mark them as no-go areas.' },
    erase: { label: 'Erase no-go', hint: 'Drag over red areas to make them usable again.' }
  };

  let sites = loadSites();
  let currentId = read(SELECTED_KEY) || 'demo';
  if (!sites.some((s) => s.id === currentId)) currentId = 'demo';
  let active = MAP_CATEGORIES.map((c) => c.id);
  let selectedId = null;
  let mode = 'explore';
  let showNogo = false;
  let draftBorder = null;
  let box = null;     // the visible part of the map (zoom and pan)
  let pointer = null; // what the mouse is doing right now

  // ---------- saving in the browser ----------
  function read(key) { try { return localStorage.getItem(key); } catch { return null; } }
  function loadSites() {
    const list = parseSiteMaps(read(SITE_MAPS_STORAGE_KEY));
    if (!list.some((s) => s.id === 'demo')) list.unshift(demoSite());
    return list;
  }
  function save() {
    try {
      localStorage.setItem(SITE_MAPS_STORAGE_KEY, JSON.stringify(sites));
      localStorage.setItem(SELECTED_KEY, currentId);
    } catch {
      toast('Could not save: the browser storage is full. Delete a map or upload a smaller image.');
    }
  }
  const site = () => sites.find((s) => s.id === currentId);
  const vendors = () => parsePlacements(read(VENDOR_STORAGE_KEY));
  const colourOf = (categoryId) => MAP_CATEGORIES.find((c) => c.id === categoryId).colour;
  const titleOf = (categoryId) => MAP_CATEGORIES.find((c) => c.id === categoryId).title;
  const escape = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- the page frame (drawn once per visit or map change) ----------
  function renderPage() {
    const s = site();
    view.innerHTML = `
      <section class="checklist-hero sm-hero">
        <p class="eyebrow">SITE MAP · LAYOUT PLANNER</p>
        <h1>Plan the ground,<br /><em>pin by pin.</em></h1>
        <p class="hero-copy">Click any pin to see its details. Upload an aerial photo or site plan of your own ground and the planner suggests the optimal layout: stages, first aid, toilets, water, food court, gate and emergency exits.</p>
      </section>
      <div class="sm-toolbar">
        <label class="sm-select">MAP<select id="sm-select">${sites.map((m) => `<option value="${m.id}" ${m.id === currentId ? 'selected' : ''}>${escape(m.name)}</option>`).join('')}</select></label>
        <label class="button secondary sm-upload">⇪ Upload map<input type="file" accept="image/*" id="sm-upload" class="hidden" /></label>
        <span class="sm-spacer"></span>
        <button type="button" class="button primary" id="sm-suggest">✦ Suggest optimal layout</button>
      </div>
      <div class="sm-layout">
        <div class="sm-main">
          <div class="sm-tools" role="group" aria-label="Map tools">
            ${Object.entries(MODES).map(([id, m]) => `<button type="button" class="sm-tool ${mode === id ? 'on' : ''}" data-mode="${id}" aria-pressed="${mode === id}">${m.label}</button>`).join('')}
            <label class="sm-toggle"><input type="checkbox" id="sm-show-nogo" ${showNogo ? 'checked' : ''} /> Show no-go areas</label>
          </div>
          <div class="map-chips" role="group" aria-label="Show categories">
            ${MAP_CATEGORIES.map((c) => `<button type="button" class="map-chip ${active.includes(c.id) ? 'on' : ''}" data-category="${c.id}" aria-pressed="${active.includes(c.id)}" style="--marker:${c.colour}"><i></i>${c.title}</button>`).join('')}
          </div>
          <div class="sm-frame mode-${mode}">
            <div class="sm-hint" id="sm-hint"></div>
            <svg id="sm-svg" viewBox="0 0 ${s.width} ${s.height}" role="img" aria-label="Map of ${escape(s.name)}">
              ${MapDrawing.defs()}
              <g id="sm-scene"></g><g id="sm-nogo"></g><g id="sm-paths"></g><g id="sm-objects"></g><g id="sm-edit"></g>
            </svg>
            <div class="sm-zoom"><button type="button" data-zoom="in" aria-label="Zoom in">+</button><button type="button" data-zoom="out" aria-label="Zoom out">−</button><button type="button" data-zoom="reset" aria-label="Show whole map">⤢</button></div>
            <div class="sm-scale" id="sm-scale"></div>
          </div>
        </div>
        <aside class="sm-side">
          <section class="sm-card" id="sm-details" aria-live="polite"></section>
          <section class="sm-card" id="sm-score"></section>
          <section class="sm-card" id="sm-settings"></section>
        </aside>
      </div>`;
    box = box && box.site === currentId ? box : { site: currentId, x: 0, y: 0, w: s.width, h: s.height };
    drawScene();
    drawAll();
    renderSettings();
    bindMap();
  }

  function drawAll() { applyBox(); drawNogo(); drawObjects(); drawEdit(); renderHint(); renderDetails(); renderScore(); }

  // ---------- drawing the layers ----------
  function drawScene() { view.querySelector('#sm-scene').innerHTML = MapDrawing.scene(site()); }

  function drawNogo() {
    view.querySelector('#sm-nogo').innerHTML = showNogo || mode === 'paint' || mode === 'erase' ? MapDrawing.nogo(site()) : '';
  }

  function applyBox() {
    const s = site();
    view.querySelector('#sm-svg').setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`);
    // A scale bar of a round number of metres, about a fifth of the visible width.
    const metres = box.w * metresPerUnit(s) / 5;
    const nice = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000].find((n) => n >= metres) || 5000;
    const frame = view.querySelector('.sm-frame').clientWidth || 800;
    view.querySelector('#sm-scale').innerHTML = `<i style="width:${(nice / metresPerUnit(s) / box.w) * frame}px"></i>${nice} m`;
  }

  // The direction an object faces: stages, trucks and toilets towards the food court, gates inwards.
  function anglesFor(s) {
    const p = s.placements;
    const pitches = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'].filter((id) => p[id]).map((id) => p[id]);
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
    view.querySelector('#sm-paths').innerHTML = MapDrawing.walkways(s, s.placements);
    const items = LAYOUT_ITEMS.filter((item) => s.placements[item.id] && active.includes(item.category));
    // Selected pin last, so it is drawn on top.
    items.sort((a, b) => (a.id === selectedId) - (b.id === selectedId));
    view.querySelector('#sm-objects').innerHTML = items.map((item) => {
      const at = s.placements[item.id];
      const vendor = item.kind === 'pitch' ? vendorOnPitch(onPitches, item.id) : null;
      const label = vendor ? vendor.icon : item.symbol;
      const name = vendor ? `${item.name}: ${vendor.name}` : item.name;
      return `<g class="fa-item" data-id="${item.id}" transform="translate(${at[0]} ${at[1]})" tabindex="0" role="button" aria-label="${escape(name)}">
        ${MapDrawing.object(item, u, angle(item, at), vendor)}
        ${MapDrawing.pin(item, r, colourOf(item.category), label, item.id === selectedId)}</g>`;
    }).join('');
  }

  function drawEdit() {
    const layer = view.querySelector('#sm-edit');
    const s = site();
    const r = box.w / 160;
    let out = '';
    if (mode === 'border') {
      const points = draftBorder || [];
      out += `<polyline points="${points.map((p) => p.join(',')).join(' ')}" fill="rgba(255,104,76,.12)" stroke="#ff684c" stroke-width="${r * 0.6}" stroke-dasharray="${r * 2} ${r}" />`;
      out += points.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="${r * 1.4}" fill="#ff684c" stroke="#fff" stroke-width="${r * 0.4}" />`).join('');
    }
    if (mode === 'entrance' && s.entrance) out += `<circle cx="${s.entrance[0]}" cy="${s.entrance[1]}" r="${r * 3}" fill="none" stroke="#ff684c" stroke-width="${r * 0.6}" />`;
    layer.innerHTML = out;
  }

  function renderHint() {
    const hint = view.querySelector('#sm-hint');
    const extra = mode === 'border'
      ? ` <button type="button" class="button primary" data-border="done" ${(draftBorder || []).length < 3 ? 'disabled' : ''}>Done (${(draftBorder || []).length} corners)</button> <button type="button" class="button secondary" data-border="cancel">Cancel</button>`
      : '';
    hint.innerHTML = `<span>${MODES[mode].hint}</span>${extra}`;
  }

  // ---------- right column ----------
  function renderDetails() {
    const panel = view.querySelector('#sm-details');
    const s = site();
    const item = selectedId && s.placements[selectedId] ? findItem(selectedId) : null;
    if (!item) {
      panel.innerHTML = `<p class="eyebrow">DETAILS</p><h2>Click a pin</h2><p class="map-text">Every pin on the map is a facility. Click it to see what it is, who is responsible, how far it is from the gate and which layout rules it meets.</p>`;
      return;
    }
    const at = s.placements[item.id];
    const vendor = item.kind === 'pitch' ? vendorOnPitch(vendors(), item.id) : null;
    const fromGate = s.placements.entrance && item.id !== 'entrance'
      ? `${walkingMinutesBetween(s, s.placements.entrance, at)} min walk · ${metresBetweenPoints(s, s.placements.entrance, at)} m` : 'This is the gate.';
    const nearby = [['first-aid', 'First aid'], ['toilets', 'Toilets'], ['water', 'Water']]
      .filter(([kind]) => kind !== item.kind)
      .map(([kind, label]) => { const n = nearestOfKind(s, s.placements, at, kind); return n ? `<li><span>${label}</span><b>${n.metres} m</b></li>` : ''; }).join('');
    const rules = checkLayout(s, s.placements).filter((rule) => rule.items.includes(item.id));
    const vendorPart = item.kind !== 'pitch' ? '' : vendor
      ? `<div class="map-vendor"><span class="map-vendor-icon">${vendor.icon}</span><div><strong>${escape(vendor.name)}</strong><small>${vendor.category} · ${escape(vendor.text)}</small></div></div>
         <button class="button secondary" type="button" data-go-vendors>Open in Vendors</button>`
      : `<p class="map-free">Free pitch. Confirm a vendor on the Vendors page to fill it.</p>
         <button class="button primary" type="button" data-go-vendors>Choose a vendor</button>`;
    panel.innerHTML = `
      <p class="eyebrow">DETAILS</p>
      <h2>${escape(item.name)}</h2>
      <span class="map-pill" style="--marker:${colourOf(item.category)}">${titleOf(item.category)}</span>
      <p class="map-text">${escape(item.text)}</p>
      ${vendorPart}
      <dl class="map-facts">
        <div><dt>RESPONSIBLE TEAM</dt><dd>${item.team}</dd></div>
        <div><dt>OPEN</dt><dd>${item.hours}</dd></div>
        <div><dt>FROM THE MAIN GATE</dt><dd>${fromGate}</dd></div>
      </dl>
      ${nearby ? `<p class="sm-sub">NEAREST</p><ul class="sm-nearby">${nearby}</ul>` : ''}
      ${rules.length ? `<p class="sm-sub">LAYOUT RULES</p><ul class="sm-rules">${rules.map((rule) => `<li class="${rule.ok ? 'ok' : 'problem'}"><b>${rule.ok ? '✓' : '✕'}</b><span>${rule.label}<small>${escape(rule.detail)}</small></span></li>`).join('')}</ul>` : ''}
      <p class="sm-sub">${mode === 'move' ? 'Drag the pin to move it.' : 'Switch to “Move pins” to move it.'}</p>`;
  }

  function renderScore() {
    const s = site();
    const rules = checkLayout(s, s.placements);
    const score = layoutScore(rules);
    const passed = rules.filter((r) => r.ok).length;
    view.querySelector('#sm-score').innerHTML = `
      <div class="sm-score-top">
        <div class="sm-ring" style="--score:${score}"><span>${score}<small>%</small></span></div>
        <div><p class="eyebrow">LAYOUT CHECK</p><strong>${passed} of ${rules.length} rules met</strong><small>${score === 100 ? 'This layout is ready to work with.' : 'Click a rule to see what to fix.'}</small></div>
      </div>
      <ul class="sm-rules">${rules.map((rule) => `<li class="${rule.ok ? 'ok' : 'problem'}" data-rule="${rule.id}" tabindex="0"><b>${rule.ok ? '✓' : '✕'}</b><span>${rule.label}<small>${escape(rule.detail)}</small></span></li>`).join('')}</ul>`;
  }

  function renderSettings() {
    const s = site();
    view.querySelector('#sm-settings').innerHTML = `
      <p class="eyebrow">MAP SETTINGS</p>
      <label class="sm-field">Name<input id="sm-name" maxlength="60" value="${escape(s.name)}" ${s.id === 'demo' ? 'disabled' : ''} /></label>
      <label class="sm-field">Real width of the map (metres)<input id="sm-width" type="number" min="20" max="20000" step="10" value="${s.widthMetres}" />
        <small>How wide the area on the image is in reality. All distances and object sizes use this scale.</small></label>
      <div class="sm-setting-buttons">
        ${s.image ? '<button type="button" class="button secondary" data-action="detect">Detect water automatically</button>' : ''}
        <button type="button" class="button secondary" data-action="clear-nogo">Clear no-go areas</button>
        ${s.image ? '<button type="button" class="button secondary" data-action="whole">Use whole image as ground</button>' : ''}
        ${s.id === 'demo' ? '<button type="button" class="button secondary" data-action="reset-demo">Reset demo map</button>' : '<button type="button" class="button danger" data-action="delete">Delete this map</button>'}
      </div>`;
  }

  // ---------- actions ----------
  function suggest() {
    const s = site();
    const result = suggestLayout(s);
    if (result.problem) { toast(result.problem); return; }
    s.placements = result.placements;
    save();
    drawAll();
    const score = layoutScore(checkLayout(s, s.placements));
    toast(score === 100 ? 'Optimal layout suggested: all rules met.' : `Layout suggested: ${score}% of the rules met. The check on the right shows what the ground cannot fit.`);
  }

  function switchMap(id) {
    currentId = id; selectedId = null; draftBorder = null; box = null; mode = 'explore';
    save();
    renderPage();
  }

  function setMode(next) {
    mode = next;
    if (mode === 'border') draftBorder = [];
    view.querySelector('.sm-frame').className = `sm-frame mode-${mode}`;
    view.querySelectorAll('[data-mode]').forEach((b) => { b.classList.toggle('on', b.dataset.mode === mode); b.setAttribute('aria-pressed', b.dataset.mode === mode); });
    drawNogo(); drawEdit(); renderHint(); renderDetails();
  }

  function select(id) {
    selectedId = id;
    const item = findItem(id);
    if (item && !active.includes(item.category)) active = [...active, item.category];
    drawObjects(); renderDetails();
  }

  // Shrink the image so it fits in the browser storage, then read the colours for water detection.
  function loadImage(src) {
    return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src; });
  }

  async function upload(file) {
    if (!file || !file.type.startsWith('image/')) { toast('Please choose an image file (JPG or PNG).'); return; }
    try {
      const original = await loadImage(URL.createObjectURL(file));
      const scale = Math.min(1, 1600 / Math.max(original.width, original.height));
      const width = Math.round(original.width * scale);
      const height = Math.round(original.height * scale);
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
      created.placements = suggestLayout(created).placements;
      sites.push(created);
      switchMap(created.id);
      toast('Map uploaded and a first layout suggested. Set the real width, the fence and the gate, then suggest again.');
    } catch {
      toast('This image could not be read. Try a JPG or PNG.');
    }
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
      pointer = { start: [event.clientX, event.clientY], startBox: { ...box }, moved: false, itemId: itemEl?.dataset.id || null, el: itemEl };
      svg.setPointerCapture(event.pointerId);
      if (mode === 'border') { draftBorder = [...(draftBorder || []), p]; drawEdit(); renderHint(); pointer = null; return; }
      if (mode === 'entrance') {
        s.entrance = nearestBoundaryPoint(s, p);
        s.placements.entrance = s.entrance;
        save(); drawAll(); select('entrance');
        toast('Gate set. Press “Suggest optimal layout” to plan around it.');
        pointer = null; return;
      }
      if (mode === 'paint' || mode === 'erase') { pointer.paint = mode === 'paint' ? '1' : '0'; paintAt(p, pointer.paint); return; }
      if (mode === 'move' && pointer.itemId) { pointer.drag = true; select(pointer.itemId); pointer.el = view.querySelector(`.fa-item[data-id="${pointer.itemId}"]`); }
    });

    svg.addEventListener('pointermove', (event) => {
      if (!pointer) return;
      const dx = event.clientX - pointer.start[0];
      const dy = event.clientY - pointer.start[1];
      if (Math.hypot(dx, dy) > 4) pointer.moved = true;
      if (pointer.paint) { paintAt(toMap(event), pointer.paint); return; }
      if (pointer.drag) { const p = toMap(event); site().placements[pointer.itemId] = p; pointer.el.setAttribute('transform', `translate(${p[0]} ${p[1]})`); return; }
      if (pointer.moved) {
        const scale = pointer.startBox.w / svg.clientWidth;
        box = { ...box, x: pointer.startBox.x - dx * scale, y: pointer.startBox.y - dy * scale };
        clampBox(); applyBox();
      }
    });

    const finish = () => {
      if (!pointer) return;
      if (pointer.paint) { save(); drawObjects(); renderScore(); renderDetails(); }
      else if (pointer.drag) { save(); drawAll(); }
      else if (!pointer.moved && pointer.itemId) select(pointer.itemId);
      pointer = null;
    };
    svg.addEventListener('pointerup', finish);
    svg.addEventListener('pointercancel', finish);
    svg.addEventListener('wheel', (event) => { event.preventDefault(); zoom(event.deltaY > 0 ? 1.15 : 1 / 1.15, toMap(event)); }, { passive: false });
    svg.addEventListener('keydown', (event) => {
      const itemEl = event.target.closest('.fa-item');
      if (itemEl && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); select(itemEl.dataset.id); }
    });
  }

  // ---------- clicks on buttons and inputs ----------
  view.addEventListener('click', (event) => {
    const t = event.target;
    const s = site();
    if (t.closest('#sm-suggest')) return suggest();
    const modeButton = t.closest('[data-mode]');
    if (modeButton) return setMode(modeButton.dataset.mode);
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
      if (border.dataset.border === 'done' && draftBorder.length >= 3) {
        s.boundary = draftBorder; draftBorder = null; save(); drawScene(); setMode('explore'); drawAll();
        toast('Fence saved. Press “Suggest optimal layout” to plan inside it.');
      } else { draftBorder = null; setMode('explore'); }
      return;
    }
    const rule = t.closest('[data-rule]');
    if (rule) {
      const found = checkLayout(s, s.placements).find((r) => r.id === rule.dataset.rule);
      if (found && found.items.length) select(found.items[0]);
      return;
    }
    if (t.closest('[data-go-vendors]')) return document.querySelector('.sidebar-item[data-section="Vendors"]').click();
    const action = t.closest('[data-action]')?.dataset.action;
    if (action === 'detect') {
      detectWater(s).then((grid) => { s.grid = grid; showNogo = true; save(); renderPage(); toast('Blue areas marked as no-go. Check them and correct with “Mark no-go” / “Erase no-go”.'); });
    } else if (action === 'clear-nogo') {
      s.grid = emptyGrid(s.width, s.height); save(); drawAll();
    } else if (action === 'whole') {
      s.boundary = [[0, 0], [s.width, 0], [s.width, s.height], [0, s.height]]; save(); drawScene(); drawAll();
    } else if (action === 'reset-demo') {
      sites = sites.map((m) => (m.id === 'demo' ? demoSite() : m)); save(); renderPage();
    } else if (action === 'delete' && window.confirm(`Delete the map “${s.name}”? This cannot be undone.`)) {
      sites = sites.filter((m) => m.id !== s.id); switchMap('demo');
    }
  });

  view.addEventListener('change', (event) => {
    const s = site();
    if (event.target.id === 'sm-select') switchMap(event.target.value);
    else if (event.target.id === 'sm-upload') upload(event.target.files[0]);
    else if (event.target.id === 'sm-show-nogo') { showNogo = event.target.checked; drawNogo(); }
    else if (event.target.id === 'sm-name') { s.name = event.target.value.trim() || 'My map'; save(); view.querySelector(`#sm-select option[value="${s.id}"]`).textContent = s.name; }
    else if (event.target.id === 'sm-width') {
      const metres = Number(event.target.value);
      if (metres >= 20 && metres <= 20000) { s.widthMetres = metres; save(); drawAll(); }
    }
  });
  view.addEventListener('keydown', (event) => {
    const rule = event.target.closest('[data-rule]');
    if (rule && event.key === 'Enter') rule.click();
  });

  // The Vendors page uses this to jump straight to a pitch on the map.
  window.openSiteMapAt = function (placeId) {
    selectedId = placeId;
    const item = findItem(placeId);
    if (item && !active.includes(item.category)) active = [...active, item.category];
    document.querySelector('.sidebar-item[data-section="Site map"]').click();
  };

  // Left navigation: "Site map" shows this page (freshly drawn, so new vendors appear), anything else hides it.
  document.querySelectorAll('.sidebar-item').forEach((button) => button.addEventListener('click', () => {
    const onMap = button.dataset.section === 'Site map';
    view.classList.toggle('hidden', !onMap);
    if (onMap) { sites = loadSites(); if (!site()) currentId = 'demo'; renderPage(); }
  }));
})();
