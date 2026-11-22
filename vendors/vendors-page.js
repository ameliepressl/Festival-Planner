// Festival Architect — the Vendors page: shows the vendor catalogue (the 24 original vendors plus the
// vendor library with many more food and drink stands), lets you search and filter it, shows each
// stand's menu, lets you confirm and remove vendors, and shows the pitches, the pitch income and
// whether the visitors' basic needs are covered.
// The catalogue and all rules live in rules/vendor-rules.js and rules/vendor-library.js.
// Confirmed vendors are saved in this browser.

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
    const menuButton = vendor.menu ? `<button type="button" class="button quiet vendor-menu-toggle" data-menu="${vendor.id}" aria-expanded="${isOpen}">${isOpen ? 'Hide menu' : `Menu (${vendor.menu.length})`}</button>` : '';
    return `
      <article class="vendor-card ${pitch ? 'confirmed' : ''}">
        <div class="vendor-top">
          <span class="vendor-icon cat-${escape(vendor.category.toLowerCase())}"${photo}>${escape(initials(vendor.name))}</span>
          <div><h2>${escape(vendor.name)}</h2><small>${escape(vendor.cuisine || vendor.category)} · ${euros(vendor.fee)} pitch fee</small></div>
          ${pitch ? `<span class="vendor-pitch">${pitch}</span>` : ''}
        </div>
        <p>${escape(vendor.text)}</p>
        <div class="vendor-tags">${vendor.tags.map((tag) => `<span>${tag}</span>`).join('')}</div>
        ${menuMarkup(vendor)}
        ${message && message.vendorId === vendor.id ? `<p class="form-message" role="alert">${message.text}</p>` : ''}
        <div class="vendor-actions">${menuButton}${actions}</div>
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
      <div class="vendor-summary"><span aria-live="polite">${results.length} of ${all.length} vendors</span><button type="button" class="button secondary" data-vreset>Clear filters</button></div>
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
    if ((button.dataset.confirm || button.dataset.remove) && !canEditVendors()) {
      toast('Your role can view vendors but cannot change them.');
      return;
    }
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
