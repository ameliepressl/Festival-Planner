// Festival Architect — the Vendors page: shows the vendor catalogue, lets you confirm and remove vendors,
// and shows the pitches, the pitch income and whether the visitors' basic needs are covered.
// The catalogue and all rules live in rules/vendor-rules.js. Confirmed vendors are saved in this browser.

(function () {
  const view = document.querySelector('#vendors-view');
  let placements = parsePlacements(localStorage.getItem(VENDOR_STORAGE_KEY));
  // How many pitches the food court has follows the festival size (set on the Site map, rules/capacity-rules.js).
  const festivalSize = () => capacityNeeds(parseGround(localStorage.getItem(GROUND_STORAGE_KEY)).visitors);
  let filter = 'All';
  let message = null; // { vendorId, text }: why the last confirm did not work

  const euros = (amount) => `€ ${amount.toLocaleString('en-GB')}`;
  function save() { localStorage.setItem(VENDOR_STORAGE_KEY, JSON.stringify(placements)); }

  function pitchRow(count) {
    return pitchList(count).map((pitch) => {
      const vendor = vendorOnPitch(placements, pitch);
      return `<button type="button" class="pitch-slot ${vendor ? 'taken' : ''}" data-map="${pitch}" aria-label="${pitch}: ${vendor ? vendor.name : 'free'} – show on map">
        <span>${vendor ? vendor.icon : '+'}</span><small>${pitch}</small></button>`;
    }).join('');
  }

  function cardMarkup(vendor) {
    const pitch = placements[vendor.id];
    const actions = pitch
      ? `<button type="button" class="button secondary" data-map="${pitch}">Show on map</button>
         <button type="button" class="button danger" data-remove="${vendor.id}">Remove</button>`
      : `<button type="button" class="button primary" data-confirm="${vendor.id}">Confirm</button>`;
    return `
      <article class="vendor-card ${pitch ? 'confirmed' : ''}">
        <div class="vendor-top">
          <span class="vendor-icon" aria-hidden="true">${vendor.icon}</span>
          <div><h2>${vendor.name}</h2><small>${vendor.category.toUpperCase()} · ${euros(vendor.fee)} pitch fee</small></div>
          ${pitch ? `<span class="vendor-pitch">${pitch}</span>` : ''}
        </div>
        <p>${vendor.text}</p>
        <div class="vendor-tags">${vendor.tags.map((tag) => `<span>${tag}</span>`).join('')}</div>
        ${message && message.vendorId === vendor.id ? `<p class="form-message" role="alert">${message.text}</p>` : ''}
        <div class="vendor-actions">${actions}</div>
      </article>`;
  }

  function render() {
    const size = festivalSize();
    const used = Object.keys(placements).length;
    const needs = coverage(placements);
    const shown = VENDORS.filter((v) => filter === 'All' || v.category === filter);
    view.innerHTML = `
      <section class="checklist-hero">
        <p class="eyebrow">VENDORS · FOOD COURT</p>
        <h1>Feed the crowd,<br /><em>fill the pitches.</em></h1>
        <p class="hero-copy">Confirm vendors for the food court pitches. The number of pitches follows the expected visitors (one per 400). Each confirmed vendor appears on the site map. Your choice saves automatically in this browser.</p>
      </section>
      <section class="metrics vendor-metrics">
        <div class="metric"><span>PITCHES USED</span><strong>${used} of ${size.pitches}</strong><small>for ${size.visitors.toLocaleString('en-GB')} visitors · <a href="#" data-size>change</a></small></div>
        <div class="metric"><span>PITCH INCOME</span><strong>${euros(pitchIncome(placements))}</strong></div>
        <div class="metric vendor-needs"><span>VISITOR NEEDS</span>
          ${needs.checks.map((c) => `<small class="${c.ok ? 'ok' : 'missing'}">${c.ok ? '✓' : '✕'} ${c.label}</small>`).join('')}
        </div>
      </section>
      <div class="pitch-row" aria-label="Food court pitches">${pitchRow(size.pitches)}</div>
      <div class="map-chips" role="group" aria-label="Filter vendors">
        ${['All', ...VENDOR_CATEGORIES].map((c) => `<button type="button" class="map-chip ${filter === c ? 'on' : ''}" data-filter="${c}" aria-pressed="${filter === c}" style="--marker:var(--coral)"><i></i>${c}</button>`).join('')}
      </div>
      <div class="vendor-grid">${shown.map(cardMarkup).join('')}</div>`;
  }

  view.addEventListener('click', (event) => {
    if (event.target.closest('[data-size]')) { event.preventDefault(); document.querySelector('.sidebar-item[data-section="Site map"]').click(); return; }
    const button = event.target.closest('button');
    if (!button) return;
    message = null;
    if (button.dataset.confirm) {
      const result = confirmVendor(placements, button.dataset.confirm, festivalSize().pitches);
      if (result.problem) message = { vendorId: button.dataset.confirm, text: result.problem };
      else { placements = result.placements; save(); toast(`${findVendor(button.dataset.confirm).name} is on pitch ${placements[button.dataset.confirm]}.`); }
    } else if (button.dataset.remove) {
      const pitch = placements[button.dataset.remove];
      placements = removeVendor(placements, button.dataset.remove);
      save();
      toast(`${findVendor(button.dataset.remove).name} removed. Pitch ${pitch} is free again.`);
    } else if (button.dataset.filter) {
      filter = button.dataset.filter;
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
        placements = fitted.placements; save();
        toast(`The food court is smaller now: ${fitted.removed.map((v) => v.name).join(', ')} lost their pitch.`);
      }
      render();
    }
  }));

  render();
})();
