// Transparent planning estimates, not a certified evacuation model or legal capacity.
// Flow reference: SGSA Vehicle Security Barriers at Event Venues (2025), 82 people/m/min
// for level routes. The organiser must choose suitable assumptions for their venue.
const CROWD_STAGE_IDS = ['stage-a', 'stage-b'];
const CROWD_EXIT_IDS = ['exit-1', 'exit-2'];
const CROWD_ASSUMPTIONS = Object.freeze({ walkingSpeed: 60, flowRate: 82,
  preMovementMinutes: 2, targetMinutes: 10, densityLimit: 2 });

function normalizeCrowdSafety(value) {
  const source = value && typeof value === 'object' ? value : {};
  const number = value => value !== '' && value !== null && Number.isFinite(Number(value)) ? Number(value) : null;
  return {
    ...Object.fromEntries(Object.entries(CROWD_ASSUMPTIONS).map(([key, fallback]) =>
      [key, Object.hasOwn(source, key) ? number(source[key]) : fallback])),
    stages: Object.fromEntries(CROWD_STAGE_IDS.map(id => [id, {
      area: number(source.stages?.[id]?.area), audience: number(source.stages?.[id]?.audience)
    }])),
    exits: Object.fromEntries(CROWD_EXIT_IDS.map(id => [id, {
      width: number(source.exits?.[id]?.width), open: source.exits?.[id]?.open !== false
    }]))
  };
}

const positiveCrowdNumber = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const validCrowdCount = value => Number.isInteger(value) && value >= 0;

// Unlike decorative walkwayRoute, an unreachable route never becomes a straight line.
// Diagonals cannot cut between two blocked corners.
function strictEvacuationRoute(site, from, to) {
  const fail = { reachable: false, points: [], metres: null };
  if (!site?.grid || !Array.isArray(from) || !Array.isArray(to)) return fail;
  const geometry = typeof module !== 'undefined' ? require('./site-map-rules.js') : null;
  const usable = geometry ? geometry.isUsable : isUsable;
  const blocked = geometry ? geometry.isBlocked : isBlocked;
  const onFence = geometry ? geometry.isOnFence : isOnFence;
  if (!usable(site, from) || blocked(site, to) || !(usable(site, to) || onFence(site, to))) return fail;
  const { cols, rows } = site.grid;
  const cw = site.width / cols, ch = site.height / rows;
  const cell = p => [Math.min(cols - 1, Math.max(0, Math.floor(p[0] / cw))), Math.min(rows - 1, Math.max(0, Math.floor(p[1] / ch)))];
  const [sc, sr] = cell(from), [ec, er] = cell(to);
  const key = (c, r) => r * cols + c;
  const centre = (c, r) => [(c + .5) * cw, (r + .5) * ch];
  const walkable = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows
    && site.grid.cells[key(c, r)] !== '1'
    && ((c === sc && r === sr) || (c === ec && r === er) || usable(site, centre(c, r)));
  const costs = new Map([[key(sc, sr), 0]]), previous = new Map(), done = new Set();
  const open = [[0, sc, sr]];
  while (open.length) {
    open.sort((a, b) => a[0] - b[0]);
    const [, c, r] = open.shift(), k = key(c, r);
    if (done.has(k)) continue;
    done.add(k);
    if (c === ec && r === er) {
      const cells = [];
      for (let at = k; at !== undefined; at = previous.get(at)) cells.unshift([at % cols, Math.floor(at / cols)]);
      const points = [from, ...cells.slice(1, -1).map(([cc, rr]) => centre(cc, rr)), to];
      const metres = points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - points[i][0], p[1] - points[i][1]), 0) * site.widthMetres / site.width;
      return { reachable: true, points, metres };
    }
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
      if ((!dc && !dr) || !walkable(c + dc, r + dr)) continue;
      if (dc && dr && (!walkable(c + dc, r) || !walkable(c, r + dr))) continue;
      const nextKey = key(c + dc, r + dr), cost = costs.get(k) + Math.hypot(dc * cw, dr * ch);
      if (cost < (costs.get(nextKey) ?? Infinity)) {
        costs.set(nextKey, cost); previous.set(nextKey, k);
        open.push([cost + Math.hypot((c + dc - ec) * cw, (r + dr - er) * ch), c + dc, r + dr]);
      }
    }
  }
  return fail;
}

function estimateEvacuation(site, visitors, input = site?.crowdSafety) {
  const safety = normalizeCrowdSafety(input);
  const invalid = detail => ({ valid: false, minutes: null, detail, exits: [], originAssignments: [] });
  if (!validCrowdCount(visitors) || visitors === 0) return invalid('Enter the expected visitor count.');
  if (!CROWD_STAGE_IDS.every(id => validCrowdCount(safety.stages[id].audience))) return invalid('Enter the audience at each stage for the same evacuation scenario.');
  const stageTotal = CROWD_STAGE_IDS.reduce((sum, id) => sum + safety.stages[id].audience, 0);
  if (stageTotal > visitors) return invalid('Stage audiences together exceed the expected visitor count.');
  if (!positiveCrowdNumber(safety.walkingSpeed) || !positiveCrowdNumber(safety.flowRate)
      || !positiveCrowdNumber(safety.targetMinutes) || !positiveCrowdNumber(safety.densityLimit)
      || !Number.isFinite(safety.preMovementMinutes) || safety.preMovementMinutes < 0)
    return invalid('Enter positive walking speed, exit flow, density limit and target, and a non-negative response delay.');
  const exits = CROWD_EXIT_IDS.filter(id => safety.exits[id].open);
  if (!exits.length) return invalid('No emergency exit is open.');
  if (!exits.every(id => positiveCrowdNumber(safety.exits[id].width) && Array.isArray(site?.placements?.[id])))
    return invalid('Place every open exit and enter its clear usable width.');
  const geometry = typeof module !== 'undefined' ? require('./site-map-rules.js') : null;
  const onFence = geometry ? geometry.isOnFence : isOnFence;
  if (!exits.every(id => onFence(site, site.placements[id]))) return invalid('Every open emergency exit must be on an unblocked part of the fence.');
  const origins = CROWD_STAGE_IDS.filter(id => safety.stages[id].audience > 0)
    .map(id => ({ id, people: safety.stages[id].audience, point: site?.placements?.[id] }));
  const other = visitors - stageTotal;
  if (other > 0) {
    const pitches = Object.entries(site?.placements || {}).filter(([id]) => /^P\d+$/.test(id)).map(([, at]) => at);
    if (!pitches.length) return invalid('Place food-court pitches: other visitors are assumed to start at their centre.');
    origins.push({ id: 'other-visitors', people: other, point: [0, 1].map(k => pitches.reduce((sum, at) => sum + at[k], 0) / pitches.length) });
  }
  const allocation = Object.fromEntries(exits.map(id => [id, { id, people: 0, longestMetres: 0, width: safety.exits[id].width }]));
  const originAssignments = [];
  for (const origin of origins) {
    const options = exits.map(id => ({ id, ...strictEvacuationRoute(site, origin.point, site.placements[id]) }))
      .filter(route => route.reachable).sort((a, b) => a.metres - b.metres);
    if (!options.length) return invalid(`No usable route from ${origin.id === 'other-visitors' ? 'the food court' : origin.id.replace('stage-', 'Stage ').toUpperCase()} to an open exit.`);
    const route = options[0], exit = allocation[route.id];
    originAssignments.push({ originId: origin.id, exitId: route.id, people: origin.people, metres: route.metres });
    exit.people += origin.people; exit.longestMetres = Math.max(exit.longestMetres, route.metres);
  }
  const results = Object.values(allocation).map(exit => ({ ...exit,
    travelMinutes: exit.longestMetres / safety.walkingSpeed,
    queueMinutes: exit.people / (exit.width * safety.flowRate)
  }));
  const minutes = safety.preMovementMinutes + Math.max(...results.map(exit => exit.travelMinutes + exit.queueMinutes));
  return { valid: true, minutes, exits: results, originAssignments,
    detail: 'Response delay + the longest exit travel/queue estimate. Each audience zone uses its nearest reachable open exit; other visitors start at the food court. No shared-route bottleneck or behavioural simulation.' };
}

function crowdSafetyChecks(site, visitors) {
  const safety = normalizeCrowdSafety(site?.crowdSafety);
  const checks = CROWD_STAGE_IDS.map(id => {
    const { area, audience } = safety.stages[id];
    const measured = positiveCrowdNumber(area) && validCrowdCount(audience) && audience <= visitors && positiveCrowdNumber(safety.densityLimit);
    const density = measured ? audience / area : null;
    return { id: `density-${id}`, label: `Stage ${id.slice(-1).toUpperCase()} crowd density`,
      ok: measured && density <= safety.densityLimit, density, unknown: !measured,
      detail: measured ? `${density.toFixed(2)} people/m² · project limit ${safety.densityLimit} people/m²`
        : 'Enter usable audience area and expected audience; a missing measurement cannot pass.' };
  });
  const bothOpen = CROWD_EXIT_IDS.every(id => safety.exits[id].open);
  const bothMeasured = CROWD_EXIT_IDS.every(id => positiveCrowdNumber(safety.exits[id].width));
  const bothPlaced = CROWD_EXIT_IDS.every(id => Array.isArray(site?.placements?.[id])
    && site.placements[id].length === 2 && site.placements[id].every(Number.isFinite));
  checks.push({ id: 'emergency-exits-available', label: 'Both emergency exits available',
    ok: bothOpen && bothMeasured && bothPlaced, unknown: bothOpen && (!bothMeasured || !bothPlaced),
    detail: bothOpen && bothMeasured && bothPlaced ? 'Project requirement: both exits are mapped, open and have a measured clear width.'
      : 'Project requirement: keep both emergency exits available. Map each exit, enter its clear width and mark it available. Closed-exit scenarios can still be estimated below.' });
  const evacuation = estimateEvacuation(site, visitors, safety);
  checks.push({ id: 'evacuation', label: 'Evacuation planning estimate', ok: evacuation.valid && evacuation.minutes <= safety.targetMinutes,
    unknown: !site?.crowdSafety,
    detail: evacuation.valid ? `${evacuation.minutes.toFixed(1)} min · project target ${safety.targetMinutes} min` : evacuation.detail });
  return { checks, evacuation, safety };
}

if (typeof module !== 'undefined') module.exports = { CROWD_ASSUMPTIONS, normalizeCrowdSafety,
  strictEvacuationRoute, estimateEvacuation, crowdSafetyChecks };
