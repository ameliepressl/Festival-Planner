// Festival Architect — the "Load demo festival" button in the left sidebar.
// It asks first (two demos to choose from), then writes the demo (rules/demo-festival.js) into this
// browser and reloads the page.
// Replaced: lineup, festival size, vendors, finance assumptions and the demo site map.
// Not touched: uploaded maps, Gantt plan, checklist and the team roster. The task board statuses are
// only touched by the Munich demo (all done except artists, lineup, food stands and ticket prices).

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

  // which: 'load' = Lisbon Sound Festival (small), 'load-munich' = Munich Loud Weekend (big, real artists).
  function loadDemo(which) {
    // Recheck before writing, even if a dialog was opened earlier or triggered directly.
    if (!canLoadDemo()) { toast(permissionMessage); return false; }
    const demo = which === 'load-munich' ? munichDemoFestival() : demoFestival();
    const pitches = capacityNeeds(demo.ground.visitors).pitches;
    const placements = demo.vendors.reduce((p, id) => confirmVendor(p, id, pitches).placements, {});
    // Keep uploaded maps; only the demo map is planned again for the demo festival size.
    const maps = parseSiteMaps(localStorage.getItem(SITE_MAPS_STORAGE_KEY)).filter((m) => m.id !== 'demo');
    // The demo map gets one stage per lineup stage (the Munich demo has three).
    const site = demoSite(layoutItems({ ...capacityNeeds(demo.ground.visitors), stages: demo.plan.settings?.stages }));
    if (demo.crowdSafety) site.crowdSafety = normalizeCrowdSafety(demo.crowdSafety);
    maps.unshift(site);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demo.plan));
    localStorage.setItem(GROUND_STORAGE_KEY, JSON.stringify(demo.ground));
    localStorage.setItem(VENDOR_STORAGE_KEY, JSON.stringify(placements));
    localStorage.setItem(FINANCE_STORAGE_KEY, JSON.stringify({ ...DEFAULT_FINANCE, ...demo.finance }));
    localStorage.setItem(SITE_MAPS_STORAGE_KEY, JSON.stringify(maps));
    localStorage.setItem('festival-architect-site-map-selected', 'demo');
    // Munich only (asked for by the team for the presentation): all project tasks are done except the
    // fun ones (artists, lineup, food stands, ticket prices). The Lisbon demo leaves tasks alone.
    if (which === 'load-munich' && typeof window !== 'undefined' && typeof window.getSavedGanttPlan === 'function') {
      localStorage.setItem(typeof PROJECT_STATUS_KEY === 'string' ? PROJECT_STATUS_KEY : 'festival-work-board-status-v1',
        JSON.stringify(munichTaskStatuses(window.getSavedGanttPlan())));
    }
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
    const which = dialog.returnValue;
    if (which !== 'load' && which !== 'load-munich') return;
    try {
      if (loadDemo(which)) location.reload();
    } catch {
      toast('The demo could not be saved in this browser (storage full or blocked).');
    }
  });
})();
