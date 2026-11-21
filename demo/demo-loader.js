// Festival Architect — the "Load demo festival" button in the left sidebar.
// It asks first (two demos to choose from), then builds the demo (rules/demo-festival.js).
//
// Signed in (the normal case): the demo opens as a NEW festival in the account
// (window.openNewFestival from account/account.js, see feature-plans/several-festivals.md).
// The festival that was open is not touched; the FESTIVAL list in the sidebar switches back.
//
// Without the account layer (only in tests) the old behaviour stays: the demo replaces the
// lineup, festival size, vendors, finance assumptions and the demo site map in this browser,
// keeps uploaded maps, Gantt plan, checklist and team roster, and needs creator/Admin rights.

(function () {
  const button = document.querySelector('#load-demo');
  const dialog = document.querySelector('#demo-dialog');
  if (!button || !dialog) return;
  const asNewFestival = () => typeof window !== 'undefined' && typeof window.openNewFestival === 'function';
  // Replacing the open festival changes festival details and finances as well as the lineup.
  // A new festival belongs to whoever creates it, so every signed-in account may open the demo.
  const canLoadDemo = () => asNewFestival() || (typeof canFestival === 'function'
    && canFestival('lineup') && canFestival('overview') && canFestival('budget'));
  const permissionMessage = 'Only the festival creator and Admins can replace the festival with the demo.';
  button.disabled = !canLoadDemo();
  if (button.disabled) button.title = permissionMessage;

  // The saved sections of a demo festival: { storage key: text }.
  //   which: 'load' = Lisbon Sound Festival (small), 'load-munich' = Munich Loud Weekend (big, real artists).
  //   maps:  site maps to keep next to the demo map (uploaded maps when replacing the open festival).
  //   ganttPlan: the project plan whose tasks the Munich demo marks as done.
  function demoSections(which, { maps = [], ganttPlan = null } = {}) {
    const demo = which === 'load-munich' ? munichDemoFestival() : demoFestival();
    const pitches = capacityNeeds(demo.ground.visitors).pitches;
    const placements = demo.vendors.reduce((p, id) => confirmVendor(p, id, pitches).placements, {});
    // The demo map gets one stage per lineup stage (the Munich demo has three).
    const site = demoSite(layoutItems({ ...capacityNeeds(demo.ground.visitors), stages: demo.plan.settings?.stages }));
    if (demo.crowdSafety) site.crowdSafety = normalizeCrowdSafety(demo.crowdSafety);
    const sections = {
      [STORAGE_KEY]: JSON.stringify(demo.plan),
      [GROUND_STORAGE_KEY]: JSON.stringify(demo.ground),
      [VENDOR_STORAGE_KEY]: JSON.stringify(placements),
      [FINANCE_STORAGE_KEY]: JSON.stringify({ ...DEFAULT_FINANCE, ...demo.finance }),
      [SITE_MAPS_STORAGE_KEY]: JSON.stringify([site, ...maps.filter((m) => m.id !== 'demo')]),
      'festival-architect-site-map-selected': 'demo'
    };
    // Munich only (asked for by the team for the presentation): all project tasks are done except the
    // fun ones (artists, lineup, food stands, ticket prices). The Lisbon demo leaves tasks alone.
    if (which === 'load-munich' && ganttPlan) {
      sections[typeof PROJECT_STATUS_KEY === 'string' ? PROJECT_STATUS_KEY : 'festival-work-board-status-v1'] =
        JSON.stringify(munichTaskStatuses(ganttPlan));
    }
    return sections;
  }

  // Signed in: a new festival that starts with the default project plan (no Gantt of its own yet).
  function openDemoAsNewFestival(which) {
    const plan = typeof window.getDefaultGanttPlan === 'function' ? window.getDefaultGanttPlan()
      : typeof window.getSavedGanttPlan === 'function' ? window.getSavedGanttPlan() : null;
    let sections;
    try {
      sections = demoSections(which, { ganttPlan: plan });
    } catch {
      toast('The demo could not be prepared. Reload the page and try again.');
      return;
    }
    button.disabled = true;
    Promise.resolve(window.openNewFestival(sections))
      .catch((error) => toast(error?.message || 'The demo could not be opened. Try again in a moment.'))
      .finally(() => { button.disabled = !canLoadDemo(); });
  }

  // Without accounts: write the demo into the festival that is open in this browser.
  function replaceOpenFestival(which) {
    // Recheck before writing, even if a dialog was opened earlier or triggered directly.
    if (!canLoadDemo()) { toast(permissionMessage); return false; }
    // Keep uploaded maps; only the demo map is planned again for the demo festival size.
    const maps = parseSiteMaps(localStorage.getItem(SITE_MAPS_STORAGE_KEY));
    const plan = typeof window !== 'undefined' && typeof window.getSavedGanttPlan === 'function' ? window.getSavedGanttPlan() : null;
    const sections = demoSections(which, { maps, ganttPlan: plan });
    Object.entries(sections).forEach(([key, value]) => localStorage.setItem(key, value));
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
    if (asNewFestival()) { openDemoAsNewFestival(which); return; }
    try {
      if (replaceOpenFestival(which)) location.reload();
    } catch {
      toast('The demo could not be saved in this browser (storage full or blocked).');
    }
  });
})();
