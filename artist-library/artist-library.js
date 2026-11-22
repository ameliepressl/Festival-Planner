// Festival Architect — the artist library screen inside the lineup planner's artist panel.
// Two tabs: "This festival" (the festival's own catalogue, drawn by app.js) and "Artist library"
// (ARTIST_LIBRARY from rules/artist-library.js) with search, filters and sorting.
// "Add" copies an artist into the festival's catalogue; "Book" adds them if needed and opens the
// booking dialog. All filter rules live in rules/artist-library.js.
(function () {
  const panel = document.querySelector('.artists-panel');
  const festivalList = document.querySelector('#artist-list');
  if (!panel || !festivalList || typeof ARTIST_LIBRARY === 'undefined') return;
  const PAGE = 24;
  const filters = { query: '', genre: '', region: '', size: '', maxFee: '', sort: 'name' };
  let shown = PAGE;
  let tab = 'festival';

  const escape = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
  const initials = (name) => name.replace(/[^\p{L}\p{N} ]/gu, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const inFestival = (id) => state.artists.some((a) => a.id === id);

  const tabs = document.createElement('div');
  tabs.className = 'lib-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.innerHTML = `<button type="button" role="tab" data-lib-tab="festival" aria-selected="true">This festival <span id="lib-festival-count"></span></button>
    <button type="button" role="tab" data-lib-tab="library" aria-selected="false">Artist library <span>${ARTIST_LIBRARY.length}</span></button>`;
  panel.querySelector('.section-heading').after(tabs);

  const library = document.createElement('div');
  library.id = 'artist-library';
  library.className = 'lib hidden';
  library.innerHTML = `
    <div class="lib-filters" role="search">
      <label class="lib-search">Search<input type="search" data-filter="query" placeholder="Name, style or country" /></label>
      <label>Genre<select data-filter="genre"><option value="">All genres</option>${ARTIST_GENRES.map((g) => `<option>${escape(g)}</option>`).join('')}</select></label>
      <label>Region<select data-filter="region"><option value="">Everywhere</option>${ARTIST_REGIONS.map((r) => `<option>${escape(r)}</option>`).join('')}</select></label>
      <label>Size<select data-filter="size"><option value="">All sizes</option>${Object.entries(ARTIST_SIZES).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join('')}</select></label>
      <label>Max. fee<select data-filter="maxFee"><option value="">Any fee</option>${[10000, 25000, 50000, 100000, 150000].map((v) => `<option value="${v}">up to ${money(v)}</option>`).join('')}</select></label>
      <label>Sort<select data-filter="sort"><option value="name">Name A–Z</option><option value="fee-low">Fee: low to high</option><option value="fee-high">Fee: high to low</option></select></label>
    </div>
    <div class="lib-summary"><span id="lib-count" aria-live="polite"></span><button type="button" class="button secondary" data-lib-reset>Clear filters</button></div>
    <div class="lib-grid" id="lib-grid"></div>
    <div class="lib-more"><button type="button" class="button secondary" data-lib-more>Show more</button></div>
    <p class="lib-note">Fees are <b>fictional estimates</b> for planning, based on the artist's size — not real quotes.
      Photos come from Wikimedia Commons via Wikipedia; click a photo for its author and licence. Artists without a free photo show their initials.</p>`;
  festivalList.after(library);

  function card(a) {
    const added = inFestival(a.id);
    const locked = state.final || !canFestival('lineup');
    return `<article class="lib-card">
      <div class="lib-photo" data-wiki="${escape(a.wiki)}" data-name="${escape(a.name)}" style="background:${GENRE_COLOURS[a.genre] || '#d8c7ed'}">${escape(initials(a.name))}</div>
      <div class="lib-info">
        <h3>${escape(a.name)}</h3>
        <p>${escape(a.style)} · ${escape(a.country)}</p>
        <p class="lib-meta"><span class="lib-size size-${a.size}">${escape(a.sizeLabel)}</span> ≈ ${money(a.fee)} · ${a.duration} min</p>
      </div>
      <div class="lib-actions">
        ${added ? '<span class="lib-added">✓ In festival</span>' : `<button type="button" class="button secondary" data-lib-add="${a.id}" ${locked ? 'disabled' : ''}>Add</button>`}
        <button type="button" class="button secondary" data-lib-book="${a.id}" ${locked ? 'disabled' : ''}>Book</button>
      </div>
    </article>`;
  }

  function renderLibrary() {
    const results = filterArtistLibrary(ARTIST_LIBRARY, filters);
    library.querySelector('#lib-count').textContent = `${results.length} of ${ARTIST_LIBRARY.length} artists`;
    library.querySelector('#lib-grid').innerHTML = results.slice(0, shown).map(card).join('')
      || '<p class="lib-empty">No artist matches these filters. Try fewer filters.</p>';
    library.querySelector('.lib-more').hidden = results.length <= shown;
    library.querySelector('[data-lib-more]').textContent = `Show more (${Math.min(PAGE, results.length - shown)} of ${results.length - shown} left)`;
    window.ArtistPhotos?.observe(library);
  }

  function renderTabs() {
    tabs.querySelector('#lib-festival-count').textContent = state.artists.length;
    tabs.querySelectorAll('[data-lib-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.libTab === tab)));
    festivalList.classList.toggle('hidden', tab !== 'festival');
    library.classList.toggle('hidden', tab !== 'library');
    if (tab === 'library') renderLibrary();
  }

  // Copy a library artist into the festival's own catalogue (once). Returns the catalogue id.
  function addToFestival(id) {
    if (!writable()) return null;
    const entry = ARTIST_LIBRARY.find((a) => a.id === id);
    if (!entry) return null;
    if (!inFestival(id)) {
      if (!save({ ...state, artists: [...state.artists, libraryArtistToCatalogue(entry)] })) return null;
      render();
      toast(`${entry.name} added to this festival's artists.`);
    }
    return id;
  }

  tabs.addEventListener('click', (event) => {
    const button = event.target.closest('[data-lib-tab]');
    if (!button) return;
    tab = button.dataset.libTab;
    renderTabs();
  });
  library.addEventListener('input', (event) => {
    const key = event.target.dataset.filter;
    if (!key) return;
    filters[key] = event.target.value;
    shown = PAGE;
    renderLibrary();
  });
  library.addEventListener('click', (event) => {
    if (event.target.closest('[data-lib-more]')) { shown += PAGE; renderLibrary(); return; }
    if (event.target.closest('[data-lib-reset]')) {
      Object.assign(filters, { query: '', genre: '', region: '', size: '', maxFee: '', sort: 'name' });
      library.querySelectorAll('[data-filter]').forEach((el) => { el.value = filters[el.dataset.filter]; });
      shown = PAGE; renderLibrary(); return;
    }
    const add = event.target.closest('[data-lib-add]');
    if (add) { if (addToFestival(add.dataset.libAdd)) renderLibrary(); return; }
    const book = event.target.closest('[data-lib-book]');
    if (book) {
      const id = addToFestival(book.dataset.libBook);
      if (id) { renderLibrary(); openBooking(id); }
    }
  });

  // Keep the count, the "In festival" marks and the photos of the festival's artists up to date.
  window.addEventListener('festival-plan-updated', () => {
    renderTabs();
    window.ArtistPhotos?.observe(festivalList);
  });
  renderTabs();
  window.ArtistPhotos?.observe(festivalList);
})();
