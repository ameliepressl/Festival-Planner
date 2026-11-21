// Readiness is a transparent checklist, not a prediction that an event is safe.
// Every applicable check has the same weight. Missing measurements stay unresolved.
// The screen supplies the saved lineup/map/finance calculations; this file never saves data.

function readinessValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function buildReadiness(input = {}) {
  const { event = {}, lineup = {}, mapChecks, finance = {} } = input || {};
  const checks = [];
  const number = value => typeof value === 'number' && Number.isFinite(value);
  const count = value => Number.isInteger(value) && value >= 0;
  function add(id, label, ok, detail, section, unknown = false) {
    checks.push({ id, label, ok: ok === true, detail, section, unknown });
  }

  const nameKnown = typeof event?.name === 'string';
  const named = nameKnown && Boolean(event.name.trim());
  add('event-name', 'Name the festival', named,
    named ? 'The festival has a name.' : 'Enter the festival name in Settings.', 'Settings', !nameKnown);

  const datesKnown = Boolean(event?.startDate && event?.endDate);
  const datesValid = readinessValidDate(event?.startDate) && readinessValidDate(event?.endDate)
    && event.startDate <= event.endDate;
  add('event-dates', 'Choose valid festival dates', datesValid,
    datesValid ? `${event.startDate} to ${event.endDate}.` : 'Choose valid opening and closing dates in Settings.',
    'Settings', !datesKnown);

  const performancesKnown = count(lineup?.performances);
  const hasPerformances = performancesKnown && lineup.performances > 0;
  add('lineup-performances', 'Plan artist performances', hasPerformances,
    hasPerformances ? `${lineup.performances} performances planned.` : 'Add at least one artist performance to the lineup.',
    'Lineup planner', !performancesKnown);

  const problemsKnown = Array.isArray(lineup?.problems)
    && lineup.problems.every(problem => typeof problem === 'string' && Boolean(problem.trim()));
  add('lineup-schedule', 'Resolve lineup scheduling issues', hasPerformances && problemsKnown && lineup.problems.length === 0,
    !hasPerformances ? 'Add performances before checking their schedule.'
      : !problemsKnown ? 'The saved lineup has not been checked yet.'
        : lineup.problems.length ? [...new Set(lineup.problems)].join(' ') : 'All saved calendar entries pass the lineup rules.',
    'Lineup planner', !performancesKnown || !problemsKnown);

  const budgetKnown = number(lineup?.spent) && lineup.spent >= 0 && number(lineup?.budget) && lineup.budget >= 0;
  const withinBudget = budgetKnown && lineup.spent <= lineup.budget;
  add('lineup-budget', 'Keep artist fees within budget', withinBudget,
    !budgetKnown ? 'The artist budget and planned fees have not been checked yet.'
      : withinBudget ? 'Planned artist fees are within the artist budget.' : 'Planned artist fees exceed the artist budget.',
    'Lineup planner', !budgetKnown);

  const confirmationKnown = performancesKnown && count(lineup?.unconfirmed) && lineup.unconfirmed <= lineup.performances;
  add('lineup-confirmed', 'Confirm artist bookings', hasPerformances && confirmationKnown && lineup.unconfirmed === 0,
    !hasPerformances ? 'Add performances before confirming artist bookings.'
      : !confirmationKnown ? 'Booking confirmations have not been checked yet.'
        : lineup.unconfirmed ? `${lineup.unconfirmed} performances still need confirmation.` : 'All artist performances are confirmed.',
    'Lineup planner', !confirmationKnown);

  // Map rules already have stable ids. Combine duplicate ids conservatively: a
  // passing duplicate must never conceal a failing or unassessed measurement.
  const mapped = new Map();
  let mapUnknown = !Array.isArray(mapChecks) || mapChecks.length === 0;
  for (const check of Array.isArray(mapChecks) ? mapChecks : []) {
    if (!check || typeof check.id !== 'string' || !check.id.trim()) { mapUnknown = true; continue; }
    const id = 'map-' + check.id;
    const unknown = check.unknown === true || typeof check.ok !== 'boolean';
    const next = {
      id, label: typeof check.label === 'string' && check.label.trim() ? check.label : 'Review map layout',
      ok: check.ok === true && !unknown,
      detail: typeof check.detail === 'string' && check.detail.trim() ? check.detail : 'Review this check on the Site map.',
      section: 'Site map', unknown
    };
    const previous = mapped.get(id);
    if (previous) {
      next.ok = previous.ok && next.ok;
      next.unknown = previous.unknown || next.unknown;
      next.detail = [...new Set([previous.detail, next.detail])].join(' ');
    }
    mapped.set(id, next);
  }
  if (mapUnknown) {
    const detail = 'Save a map and complete its layout, crowd and exit measurements.';
    const existing = mapped.get('map-assessment');
    mapped.set('map-assessment', {
      id: 'map-assessment', label: 'Assess the festival map', ok: false,
      detail: existing ? `${existing.detail} ${detail}` : detail, section: 'Site map', unknown: true
    });
  }
  checks.push(...[...mapped.values()].sort((a, b) => a.id.localeCompare(b.id)));

  const profitKnown = number(finance?.profit);
  add('finance-profit', 'Review projected festival finances', profitKnown && finance.profit >= 0,
    !profitKnown ? 'Projected income and costs have not been calculated yet.'
      : finance.profit < 0 ? 'The current forecast shows a loss. Review income and costs.' : 'The current forecast covers projected costs.',
    'Finances', !profitKnown);

  const cashKnown = number(finance?.cashNeeded) && finance.cashNeeded >= 0;
  add('finance-cash', 'Review pre-event cash shortfall', cashKnown && finance.cashNeeded === 0,
    !cashKnown ? 'The cash-flow forecast has not been calculated yet.'
      : finance.cashNeeded > 0 ? 'The cash-flow forecast needs extra funding before all income arrives. Review the cash-flow plan.'
        : 'The forecast shows no pre-event cash shortfall.',
    'Finances', !cashKnown);

  const passed = checks.filter(check => check.ok).length;
  const total = checks.length;
  // Avoid displaying 100% for a nearly complete checklist rounded up to 100.
  const score = passed === total ? 100 : Math.min(99, Math.round(passed / total * 100));
  return { score, passed, total, checks, issues: checks.filter(check => !check.ok) };
}

// Derived issue cards keep the source check id. Rebuilding them cannot create
// duplicate tasks, and fixing the source removes the card without a fake “Done”.
function readinessIssueTasks(readiness) {
  const seen = new Set();
  return (Array.isArray(readiness?.issues) ? readiness.issues : []).filter(issue => {
    if (!issue || typeof issue.id !== 'string' || seen.has(issue.id)) return false;
    seen.add(issue.id);
    return true;
  }).map(issue => ({
    id: 'readiness-' + issue.id, sourceId: issue.id, title: issue.label,
    detail: issue.detail, section: issue.section, status: 'planned', generated: true
  }));
}

if (typeof module !== 'undefined') module.exports = { buildReadiness, readinessIssueTasks };
