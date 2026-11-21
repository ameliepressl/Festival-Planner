// Festival Architect — the "Load demo festival" button in the left sidebar.
// It asks first, then writes the demo (rules/demo-festival.js) into this browser and reloads the page.
// Replaced: lineup, festival size, vendors, finance assumptions and the demo site map.
// Not touched: uploaded maps, Gantt, task board, checklist and the team roster.

(function () {
  const button = document.querySelector('#load-demo');
  const dialog = document.querySelector('#demo-dialog');
  if (!button || !dialog) return;
  // Loading replaces festival details and finances as well as the lineup.
  const canLoadDemo = () => typeof canFestival === 'function'
    && canFestival('lineup') && canFestival('overview') && canFestival('budget');
  const permissionMessage = 'Only the festival creator and Admins can replace the festival with the demo.';
  button.disabled = !canLoadDemo();
  if (button.disabled) button.title = permissionMessage;

  function loadDemo() {
    // Recheck before writing, even if a dialog was opened earlier or triggered directly.
    if (!canLoadDemo()) { toast(permissionMessage); return false; }
    const demo = demoFestival();
    const pitches = capacityNeeds(demo.ground.visitors).pitches;
    const placements = demo.vendors.reduce((p, id) => confirmVendor(p, id, pitches).placements, {});
    // Keep uploaded maps; only the demo map is planned again for the demo festival size.
    const maps = parseSiteMaps(localStorage.getItem(SITE_MAPS_STORAGE_KEY)).filter((m) => m.id !== 'demo');
    maps.unshift(demoSite(layoutItems(capacityNeeds(demo.ground.visitors))));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demo.plan));
    localStorage.setItem(GROUND_STORAGE_KEY, JSON.stringify(demo.ground));
    localStorage.setItem(VENDOR_STORAGE_KEY, JSON.stringify(placements));
    localStorage.setItem(FINANCE_STORAGE_KEY, JSON.stringify({ ...DEFAULT_FINANCE, ...demo.finance }));
    localStorage.setItem(SITE_MAPS_STORAGE_KEY, JSON.stringify(maps));
    localStorage.setItem('festival-architect-site-map-selected', 'demo');
    return true;
  }

  button.addEventListener('click', () => {
    if (!canLoadDemo()) {
      toast(permissionMessage);
      return;
    }
    dialog.showModal();
  });

  dialog.addEventListener('close', () => {
    if (dialog.returnValue !== 'load') return;
    try {
      if (loadDemo()) location.reload();
    } catch {
      toast('The demo could not be saved in this browser (storage full or blocked).');
    }
  });
})();
