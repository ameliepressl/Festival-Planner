// Festival Architect — the Vendors page: shows the vendor catalogue (the 24 original vendors plus the
// vendor library with many more food and drink stands), lets you search and filter it, shows each
// stand's menu, lets you confirm and remove vendors, and shows the pitches, the pitch income and
// whether the visitors' basic needs are covered.
// The catalogue and all rules live in rules/vendor-rules.js and rules/vendor-library.js.
// Confirmed vendors are saved in this browser.
// "Add vendor" opens a form for your own stand (name, category, kind, fee, description, photo and a
// menu with prices and diet labels). The rules check it; own stands can be edited and deleted.

(function () {
  const view = document.querySelector('#vendors-view');
  let placements = parsePlacements(localStorage.getItem(VENDOR_STORAGE_KEY));
  // How many pitches the food court has follows the festival size (set on the Site map, rules/capacity-rules.js).
  const festivalSize = () => capacityNeeds(parseGround(localStorage.getItem(GROUND_STORAGE_KEY)).visitors);
  const canEditVendors = () => canFestival('lineup');
  const PAGE = 24;
  let filter = 'All'; // category chip: All, Food, Drinks or Merch
  const search = { query: '', cuisine: '', diet: '', maxFee: '', sort: 'featured' };
  let shown = PAGE;
  const openMenus = new Set();
  let message = null; // { vendorId, text }: why the last confirm did not work

  const euros = (amount) => `€${amount.toLocaleString('en-GB')}`;
  const price = (amount) => `€${amount.toFixed(2)}`;
  // Two letters for a stand, shown until (or instead of) its dish photo: "Taco Tribe" → "TT".
  const initials = (name) => String(name).replace(/[^\p{L}\p{N}\s&]/gu, '').split(/\s+|&/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  const escape = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function save(next) {
    try { localStorage.setItem(VENDOR_STORAGE_KEY, JSON.stringify(next)); }
    catch { toast('Vendor changes could not be saved in this browser. The previous bookings are kept.'); return false; }
    placements = next;
    return true;
  }

  function pitchRow(count) {
    return pitchList(count).map((pitch) => {
      const vendor = vendorOnPitch(placements, pitch);
      return `<button type="button" class="pitch-slot ${vendor ? `taken cat-${escape(vendor.category.toLowerCase())}` : ''}" data-map="${pitch}" aria-label="${pitch}: ${vendor ? escape(vendor.name) : 'free'} – show on map" title="${pitch}: ${vendor ? escape(vendor.name) : 'free'}">
        <span>${vendor ? escape(initials(vendor.name)) : '+'}</span><small>${pitch}</small></button>`;
    }).join('');
  }

  // The menu of a stand, shown when its "Menu" button is pressed. "alcohol" is not shown as a label.
  function menuMarkup(vendor) {
    if (!vendor.menu || !openMenus.has(vendor.id)) return '';
    return `<ul class="vendor-menu">${vendor.menu.map((m) => `<li><span>${escape(m.item)}${m.tags.filter((t) => t !== 'alcohol').map((t) => ` <i class="menu-tag">${t}</i>`).join('')}</span><b>${price(m.price)}</b></li>`).join('')}</ul>`;
  }

  function cardMarkup(vendor) {
    const pitch = placements[vendor.id];
    const editPermission = canEditVendors() ? '' : 'disabled title="Your role can view vendors but cannot change them."';
    const actions = pitch
      ? `<button type="button" class="button secondary" data-map="${pitch}">Show on map</button>
         <button type="button" class="button danger" data-remove="${vendor.id}" ${editPermission}>Remove</button>`
      : `<button type="button" class="button secondary" data-confirm="${vendor.id}" ${editPermission}>Confirm</button>`;
    const photo = vendor.photo ? ` data-wiki="${escape(vendor.photo)}" data-photo-kind="dish" data-name="${escape(vendor.cuisine || vendor.name)}"` : '';
    const isOpen = openMenus.has(vendor.id);
    const editButton = vendor.custom ? `<button type="button" class="button quiet" data-vedit="${escape(vendor.id)}" ${editPermission}>Edit</button>` : '';
    const menuButton = vendor.menu ? `<button type="button" class="button quiet vendor-menu-toggle" data-menu="${vendor.id}" aria-expanded="${isOpen}">${isOpen ? 'Hide menu' : `Menu (${vendor.menu.length})`}</button>` : '';
    return `
      <article class="vendor-card ${pitch ? 'confirmed' : ''}">
        <div class="vendor-top">
          <span class="vendor-icon cat-${escape(vendor.category.toLowerCase())}"${photo}>${escape(initials(vendor.name))}</span>
          <div><h2>${escape(vendor.name)}${vendor.custom ? ' <span class="vendor-own">Your stand</span>' : ''}</h2><small>${escape(vendor.cuisine || vendor.category)} · ${euros(vendor.fee)} pitch fee</small></div>
          ${pitch ? `<span class="vendor-pitch">${pitch}</span>` : ''}
        </div>
        ${vendor.text ? `<p>${escape(vendor.text)}</p>` : ''}
        <div class="vendor-tags">${vendor.tags.map((tag) => `<span>${tag}</span>`).join('')}</div>
        ${menuMarkup(vendor)}
        ${message && message.vendorId === vendor.id ? `<p class="form-message" role="alert">${message.text}</p>` : ''}
        <div class="vendor-actions">${menuButton}${editButton}${actions}</div>
      </article>`;
  }

  function filterBar(all) {
    const cuisines = vendorCuisines(all, filter);
    const option = (value, label, current) => `<option value="${escape(value)}" ${value === current ? 'selected' : ''}>${escape(label)}</option>`;
    const diets = [['', 'Anything'], ['vegan', 'Vegan options'], ['vegetarian', 'Vegetarian options'], ['gluten-free', 'Gluten-free options'], ['alcohol-free', 'Alcohol-free drinks']];
    const sorts = [['featured', 'Featured first'], ['name', 'Name A–Z'], ['fee-low', 'Pitch fee: low to high'], ['fee-high', 'Pitch fee: high to low']];
    return `<div class="vendor-filters" role="search">
      <label class="vendor-search">Search<input type="search" data-vfilter="query" value="${escape(search.query)}" placeholder="Stand, dish or drink" /></label>
      <label>Kind of stand<select data-vfilter="cuisine">${option('', 'All kinds', search.cuisine)}${cuisines.map((c) => option(c, c, search.cuisine)).join('')}</select></label>
      <label>Menu has<select data-vfilter="diet">${diets.map(([v, l]) => option(v, l, search.diet)).join('')}</select></label>
      <label>Max. pitch fee<select data-vfilter="maxFee">${option('', 'Any fee', search.maxFee)}${['600', '800', '1000', '1200'].map((v) => option(v, `up to ${euros(Number(v))}`, search.maxFee)).join('')}</select></label>
      <label>Sort<select data-vfilter="sort">${sorts.map(([v, l]) => option(v, l, search.sort)).join('')}</select></label>
    </div>`;
  }

  function render() {
    // Typing in the search box redraws the page; keep the cursor in the box.
    const active = document.activeElement;
    const focusKey = active && active.dataset ? active.dataset.vfilter : null;
    const caret = focusKey === 'query' ? active.selectionStart : null;
    const size = festivalSize();
    const used = Object.keys(placements).length;
    const needs = coverage(placements);
    const all = allVendors();
    const results = filterVendors(all, { ...search, category: filter });
    view.innerHTML = `
      <section class="checklist-hero">
        <h1>Vendors</h1>
        <p class="hero-copy">Choose the food, drink and merch stands for your food court. You get one pitch per 400 visitors, and every confirmed stand appears on the site map.</p>
      </section>
      <section class="metrics vendor-metrics">
        <div class="metric"><span>Pitches used</span><strong>${used} of ${size.pitches}</strong><small>for ${size.visitors.toLocaleString('en-GB')} visitors · <a href="#" data-size>change</a></small></div>
        <div class="metric"><span>Pitch income</span><strong>${euros(pitchIncome(placements))}</strong></div>
        <div class="metric vendor-needs"><span>Visitor needs</span>
          ${needs.checks.map((c) => `<small class="${c.ok ? 'ok' : 'missing'}">${c.ok ? '✓' : '✕'} ${c.label}</small>`).join('')}
        </div>
      </section>
      <div class="pitch-row" aria-label="Food court pitches">${pitchRow(size.pitches)}</div>
      <div class="map-chips" role="group" aria-label="Filter vendors">
        ${['All', ...VENDOR_CATEGORIES].map((c) => `<button type="button" class="map-chip ${filter === c ? 'on' : ''}" data-filter="${c}" aria-pressed="${filter === c}" style="--marker:var(--coral)"><i></i>${c}</button>`).join('')}
      </div>
      ${filterBar(all)}
      <div class="vendor-summary"><span aria-live="polite">${results.length} of ${all.length} vendors</span><span class="vendor-summary-actions"><button type="button" class="button secondary" data-vreset>Clear filters</button><button type="button" class="button primary" data-vadd ${canEditVendors() ? '' : 'disabled title="Your role can view vendors but cannot change them."'}>+ Add vendor</button></span></div>
      <div class="vendor-grid">${results.slice(0, shown).map(cardMarkup).join('') || '<p class="vendor-empty">No vendor matches these filters. Try fewer filters.</p>'}</div>
      ${results.length > shown ? `<div class="vendor-more"><button type="button" class="button secondary" data-vmore>Show more (${Math.min(PAGE, results.length - shown)} of ${results.length - shown} left)</button></div>` : ''}
      <p class="vendor-note">The extra stands, their menus and prices are fictional examples for planning. Dish photos come from Wikimedia Commons via Wikipedia; click a photo for its author and licence.</p>`;
    if (focusKey) {
      const box = view.querySelector(`[data-vfilter="${focusKey}"]`);
      if (box && box.focus) { box.focus(); if (caret !== null && box.setSelectionRange) box.setSelectionRange(caret, caret); }
    }
    if (window.ArtistPhotos) window.ArtistPhotos.observe(view);
  }

  view.addEventListener('input', (event) => {
    const key = event.target && event.target.dataset ? event.target.dataset.vfilter : null;
    if (!key) return;
    search[key] = event.target.value;
    shown = PAGE;
    render();
  });

  view.addEventListener('click', (event) => {
    if (event.target.closest('[data-size]')) { event.preventDefault(); document.querySelector('.sidebar-item[data-section="Site map"]').click(); return; }
    const button = event.target.closest('button');
    if (!button) return;
    if ((button.dataset.confirm || button.dataset.remove || button.dataset.vadd !== undefined || button.dataset.vedit) && !canEditVendors()) {
      toast('Your role can view vendors but cannot change them.');
      return;
    }
    if (button.dataset.vadd !== undefined) { openVendorForm(null); return; }
    if (button.dataset.vedit) { openVendorForm(button.dataset.vedit); return; }
    message = null;
    if (button.dataset.confirm) {
      const result = confirmVendor(placements, button.dataset.confirm, festivalSize().pitches);
      if (result.problem) message = { vendorId: button.dataset.confirm, text: result.problem };
      else {
        if (!save(result.placements)) return;
        toast(`${findVendor(button.dataset.confirm).name} is on pitch ${placements[button.dataset.confirm]}.`);
      }
    } else if (button.dataset.remove) {
      const pitch = placements[button.dataset.remove];
      if (!save(removeVendor(placements, button.dataset.remove))) return;
      toast(`${findVendor(button.dataset.remove).name} removed. Pitch ${pitch} is free again.`);
    } else if (button.dataset.filter) {
      filter = button.dataset.filter;
      // A kind of stand that does not exist in the new category is dropped.
      if (search.cuisine && !vendorCuisines(allVendors(), filter).includes(search.cuisine)) search.cuisine = '';
      shown = PAGE;
    } else if (button.dataset.menu) {
      if (openMenus.has(button.dataset.menu)) openMenus.delete(button.dataset.menu); else openMenus.add(button.dataset.menu);
    } else if (button.dataset.vmore !== undefined) {
      shown += PAGE;
    } else if (button.dataset.vreset !== undefined) {
      filter = 'All';
      Object.assign(search, { query: '', cuisine: '', diet: '', maxFee: '', sort: 'featured' });
      shown = PAGE;
    } else if (button.dataset.map) {
      return window.openSiteMapAt(button.dataset.map);
    }
    render();
  });

  // ---------- your own stands: the "Add vendor" form ----------
  const dialog = document.querySelector('#vendor-dialog');
  const form = document.querySelector('#vendor-form');
  const field = (id) => document.querySelector(`#vendor-${id}`);
  const rows = document.querySelector('#vendor-menu-rows');
  const formMessage = document.querySelector('#vendor-message');
  const deleteButton = document.querySelector('#vendor-delete');
  const LABELS = [['vegan', 'vegan'], ['vegetarian', 'vegetarian'], ['gluten-free', 'gluten-free'], ['alcohol', 'alcohol'], ['alcohol-free', 'alcohol-free']];
  let editingId = null;
  let draftMenu = [];
  let deleteArmed = false;

  function saveCustom(list) {
    try { localStorage.setItem(CUSTOM_VENDORS_KEY, JSON.stringify(list)); return true; }
    catch { toast('The stand could not be saved in this browser. Nothing was changed.'); return false; }
  }

  function renderMenuRows() {
    if (!rows) return;
    rows.innerHTML = draftMenu.map((m, i) => `<div class="vendor-menu-row" data-row="${i}">
      <label>Item<input data-mitem value="${escape(m.item)}" maxlength="60" placeholder="e.g. Beef tacos (3)"></label>
      <label>Price (EUR)<input data-mprice type="number" min="0.01" max="500" step="0.01" value="${escape(m.price)}" placeholder="9.50"></label>
      <div class="vendor-menu-tags" role="group" aria-label="Labels for menu item ${i + 1}">${LABELS.map(([tag, label]) => `<label><input type="checkbox" data-mtag="${tag}" ${m.tags.includes(tag) ? 'checked' : ''}> ${label}</label>`).join('')}</div>
      <button type="button" class="button quiet" data-mremove="${i}" aria-label="Remove menu item ${i + 1}" ${draftMenu.length <= 1 ? 'disabled' : ''}>Remove</button>
    </div>`).join('');
    const addItem = document.querySelector('#vendor-add-item');
    if (addItem) addItem.disabled = draftMenu.length >= MAX_MENU_ITEMS;
  }

  // What is typed in the menu rows right now (so adding or removing a row keeps it).
  function readMenuRows() {
    if (!rows || !rows.querySelectorAll) return draftMenu;
    const found = [...rows.querySelectorAll('.vendor-menu-row')].map((row) => ({
      item: row.querySelector('[data-mitem]').value,
      price: row.querySelector('[data-mprice]').value,
      tags: [...row.querySelectorAll('[data-mtag]')].filter((box) => box.checked).map((box) => box.dataset.mtag)
    }));
    return found.length ? found : draftMenu;
  }

  function openVendorForm(id) {
    if (!dialog || !form) return;
    const vendor = id ? customVendors().find((v) => v.id === id) : null;
    if (id && !vendor) { toast('This stand no longer exists.'); render(); return; }
    editingId = vendor ? vendor.id : null;
    deleteArmed = false;
    field('name').value = vendor ? vendor.name : '';
    field('category').value = vendor ? vendor.category : (filter !== 'All' ? filter : 'Food');
    field('cuisine').value = vendor ? vendor.cuisine : '';
    field('fee').value = vendor ? String(vendor.fee) : '';
    field('text').value = vendor ? vendor.text : '';
    field('photo').value = vendor ? vendor.photo : '';
    draftMenu = vendor ? vendor.menu.map((m) => ({ item: m.item, price: String(m.price), tags: [...m.tags] })) : [{ item: '', price: '', tags: [] }];
    const list = document.querySelector('#vendor-cuisine-list');
    if (list) list.innerHTML = vendorCuisines(allVendors()).map((c) => `<option value="${escape(c)}"></option>`).join('');
    const title = document.querySelector('#vendor-dialog-title');
    if (title) title.textContent = vendor ? `Edit ${vendor.name}` : 'Add vendor';
    if (deleteButton) { deleteButton.hidden = !vendor; deleteButton.textContent = 'Delete stand'; }
    if (formMessage) formMessage.textContent = '';
    renderMenuRows();
    dialog.showModal();
    if (field('name').focus) field('name').focus();
  }

  function readForm() {
    return { name: field('name').value, category: field('category').value, cuisine: field('cuisine').value,
      fee: field('fee').value.trim() === '' ? '' : Number(field('fee').value), text: field('text').value, photo: field('photo').value,
      menu: readMenuRows().map((m) => ({ item: m.item, price: String(m.price).trim() === '' ? '' : Number(m.price), tags: m.tags })) };
  }

  if (form) form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!canEditVendors()) { formMessage.textContent = 'Your role can view vendors but cannot change them.'; return; }
    const list = customVendors();
    const result = editingId ? updateCustomVendor(list, editingId, readForm()) : addCustomVendor(list, readForm());
    if (result.problem) { formMessage.textContent = result.problem; return; }
    if (!saveCustom(result.list)) return;
    dialog.close();
    if (!editingId) { filter = 'All'; Object.assign(search, { query: '', cuisine: '', diet: '', maxFee: '', sort: 'featured' }); shown = PAGE; }
    toast(editingId ? `${result.vendor.name} updated.` : `${result.vendor.name} added. Press “Confirm” to give it a pitch.`);
    render();
  });

  if (dialog) dialog.addEventListener('click', (event) => {
    const target = event.target && event.target.closest ? event.target.closest('button') : null;
    if (!target) return;
    if (target.id === 'vendor-cancel') { dialog.close(); return; }
    if (target.id === 'vendor-add-item') {
      draftMenu = readMenuRows();
      if (draftMenu.length < MAX_MENU_ITEMS) draftMenu.push({ item: '', price: '', tags: [] });
      renderMenuRows();
      const last = rows.querySelector('.vendor-menu-row:last-child [data-mitem]');
      if (last && last.focus) last.focus();
      return;
    }
    if (target.dataset.mremove !== undefined) {
      draftMenu = readMenuRows();
      if (draftMenu.length > 1) draftMenu.splice(Number(target.dataset.mremove), 1);
      renderMenuRows();
      return;
    }
    if (target.id === 'vendor-delete' && editingId) {
      if (!canEditVendors()) { formMessage.textContent = 'Your role can view vendors but cannot change them.'; return; }
      // Two clicks: the first asks, the second deletes (the pitch becomes free).
      if (!deleteArmed) { deleteArmed = true; target.textContent = 'Click again to delete'; formMessage.textContent = 'This deletes the stand and frees its pitch. It cannot be undone.'; return; }
      const vendor = customVendors().find((v) => v.id === editingId);
      const result = deleteCustomVendor(customVendors(), placements, editingId);
      if (!saveCustom(result.list)) return;
      const hadPitch = placements[editingId];
      if (hadPitch && !save(result.placements)) return;
      openMenus.delete(editingId);
      dialog.close();
      toast(`${vendor ? vendor.name : 'The stand'} deleted.${hadPitch ? ` Pitch ${hadPitch} is free again.` : ''}`);
      render();
    }
  });

  // Left navigation: "Vendors" shows this page, anything else hides it.
  document.querySelectorAll('.sidebar-item').forEach((button) => button.addEventListener('click', () => {
    const onVendors = button.dataset.section === 'Vendors';
    view.classList.toggle('hidden', !onVendors);
    if (onVendors) {
      message = null;
      // If the festival got smaller, vendors on pitches that no longer exist lose their pitch.
      const fitted = fitPlacements(placements, festivalSize().pitches);
      if (fitted.removed.length) {
        // Everyone sees only pitches that still exist; only people who may edit vendors save the change.
        if (canEditVendors()) {
          if (save(fitted.placements)) toast(`The food court is smaller now: ${fitted.removed.map((v) => v.name).join(', ')} lost their pitch.`);
        } else placements = fitted.placements;
      }
      render();
    }
  }));

  render();
})();
