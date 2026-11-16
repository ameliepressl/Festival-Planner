// Festival Architect — the site map: which facilities a festival ground needs, the rules for a good
// layout, and the planner that suggests the best spot for every facility on any map.
// Only data and calculations live here (no screen code), so they can be tested (tests/) and used by
// site-map/site-map-page.js.
//
// A "site" is one map:
//   { id, name, image, width, height, widthMetres, boundary, entrance, grid, placements }
//   - width/height: size of the map in map units (for an uploaded photo: its pixels)
//   - widthMetres: how many real metres the map is wide (sets the scale)
//   - boundary: the fence as a list of corner points [[x, y], …]
//   - entrance: where the main gate should be (a point near the fence) or null
//   - grid: no-go areas (water, forest, buildings) as cells: { cols, rows, cells: '0010…' } with 1 = no-go
//   - placements: facility id -> [x, y]

const SITE_MAPS_STORAGE_KEY = 'festival-architect-site-maps';
const GRID_COLS = 60;
const WALKING_METRES_PER_MINUTE = 80; // a relaxed walk through a crowd

const MAP_CATEGORIES = [
  { id: 'stages', title: 'Stages', colour: '#ff684c' },
  { id: 'food', title: 'Food & drink', colour: '#f9c941' },
  { id: 'facilities', title: 'Facilities', colour: '#4fb3e0' },
  { id: 'safety', title: 'Safety', colour: '#43a995' },
  { id: 'services', title: 'Services', colour: '#9d86d6' }
];

// Every facility the planner places. "onFence" items belong on the border (gates and exits).
const LAYOUT_ITEMS = [
  { id: 'stage-a', kind: 'stage', name: 'Stage A · Main Stage', category: 'stages', symbol: 'A', team: 'Stage building', hours: 'During the programme',
    text: 'Open-air main stage. It faces the food court so the crowd has room to spread out in front of it.' },
  { id: 'stage-b', kind: 'stage', name: 'Stage B · Warehouse', category: 'stages', symbol: 'B', team: 'Stage building', hours: 'During the programme',
    text: 'Second stage, placed far from Stage A so the two sound systems do not mix.' },
  { id: 'backstage', kind: 'backstage', name: 'Backstage & artist area', category: 'services', symbol: '★', team: 'Artist care & transport', hours: 'From crew check-in',
    text: 'Dressing rooms, artist catering and check-in, right behind the main stage. Crew and artists only.' },
  { id: 'entrance', kind: 'entrance', name: 'Main entrance', category: 'services', symbol: 'IN', onFence: true, team: 'Tickets & entry', hours: 'From gates open',
    text: 'Ticket scanning, wristbands and bag checks in several lanes.' },
  { id: 'info', kind: 'info', name: 'Info point & lost and found', category: 'services', symbol: 'i', team: 'Security', hours: 'From gates open',
    text: 'Questions, lost items and the lost-child point, just inside the entrance.' },
  { id: 'security', kind: 'security', name: 'Security control', category: 'safety', symbol: '◈', team: 'Security', hours: 'Whole event',
    text: 'Security lead, radio base and CCTV, close to the entrance.' },
  { id: 'first-aid-a', kind: 'first-aid', name: 'First aid · Stage A', category: 'safety', symbol: '✚', team: 'First aid & safety', hours: 'Whole event',
    text: 'Medical tent with defibrillator, close to the main stage crowd.' },
  { id: 'first-aid-b', kind: 'first-aid', name: 'First aid · Stage B', category: 'safety', symbol: '✚', team: 'First aid & safety', hours: 'Whole event',
    text: 'Medical tent with defibrillator, close to the second stage crowd.' },
  { id: 'exit-1', kind: 'exit', name: 'Emergency exit 1', category: 'safety', symbol: 'EX', onFence: true, team: 'Security', hours: 'Always clear',
    text: 'Emergency exit in the fence with a meeting point outside.' },
  { id: 'exit-2', kind: 'exit', name: 'Emergency exit 2', category: 'safety', symbol: 'EX', onFence: true, team: 'Security', hours: 'Always clear',
    text: 'Second emergency exit, far from the first one and from the main entrance.' },
  { id: 'toilets-a', kind: 'toilets', name: 'Toilets · Stage A', category: 'facilities', symbol: 'WC', team: 'Toilets, water & waste', hours: 'From gates open',
    text: 'A row of toilet cabins including accessible units.' },
  { id: 'toilets-b', kind: 'toilets', name: 'Toilets · Stage B', category: 'facilities', symbol: 'WC', team: 'Toilets, water & waste', hours: 'From gates open',
    text: 'A row of toilet cabins including accessible units.' },
  { id: 'water-a', kind: 'water', name: 'Free water · Stage A', category: 'facilities', symbol: 'H₂O', team: 'Toilets, water & waste', hours: 'From gates open',
    text: 'Free drinking water refill station.' },
  { id: 'water-b', kind: 'water', name: 'Free water · Stage B', category: 'facilities', symbol: 'H₂O', team: 'Toilets, water & waste', hours: 'From gates open',
    text: 'Free drinking water refill station.' },
  { id: 'recycling', kind: 'recycling', name: 'Recycling point', category: 'facilities', symbol: '♲', team: 'Toilets, water & waste', hours: 'From gates open',
    text: 'Bins, recycling and cup return next to the food court.' },
  ...['P1', 'P2', 'P3', 'P4', 'P5', 'P6'].map((pitch) => ({
    id: pitch, kind: 'pitch', name: `Food court · Pitch ${pitch}`, category: 'food', symbol: pitch, team: 'Backstage & catering', hours: 'From gates open',
    text: 'Vendor pitch in the food court. Which vendor stands here is chosen on the Vendors page.'
  }))
];

// ---------- the demo ground: a 600 m wide field with a forest and a lake ----------

const DEMO_SCENE = {
  forest: [[90, 110], [330, 92], [372, 190], [300, 262], [150, 300], [78, 250]],
  lake: [[820, 470], [930, 438], [1022, 486], [1036, 590], [952, 646], [852, 624], [800, 552]]
};

// ---------- small geometry helpers ----------

function findItem(id) { return LAYOUT_ITEMS.find((item) => item.id === id) || null; }
function distance(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
function metresPerUnit(site) { return site.widthMetres / site.width; }
function metresBetweenPoints(site, a, b) { return Math.round(distance(a, b) * metresPerUnit(site)); }
function walkingMinutesBetween(site, a, b) { return Math.ceil(metresBetweenPoints(site, a, b) / WALKING_METRES_PER_MINUTE); }

// Is the point inside the polygon? (Counts how often a line to the right crosses the border.)
function pointInPolygon(point, polygon) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function closestOnSegment(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared));
  return [a[0] + t * dx, a[1] + t * dy];
}

function nearestBoundaryPoint(site, p) {
  let best = null;
  site.boundary.forEach((a, i) => {
    const q = closestOnSegment(p, a, site.boundary[(i + 1) % site.boundary.length]);
    if (!best || distance(p, q) < distance(p, best)) best = q;
  });
  return best.map(Math.round);
}

function distanceToBoundary(site, p) { return distance(p, nearestBoundaryPoint(site, p)); }

// Points evenly spread along the fence.
function boundarySamples(site, count) {
  const edges = site.boundary.map((a, i) => [a, site.boundary[(i + 1) % site.boundary.length]]);
  const perimeter = edges.reduce((sum, [a, b]) => sum + distance(a, b), 0);
  const points = [];
  edges.forEach(([a, b]) => {
    const steps = Math.max(1, Math.round((distance(a, b) / perimeter) * count));
    for (let s = 0; s < steps; s++) points.push([a[0] + ((b[0] - a[0]) * s) / steps, a[1] + ((b[1] - a[1]) * s) / steps].map(Math.round));
  });
  return points;
}

// ---------- no-go areas ----------

function emptyGrid(width, height) {
  const rows = Math.max(1, Math.round((GRID_COLS * height) / width));
  return { cols: GRID_COLS, rows, cells: '0'.repeat(GRID_COLS * rows) };
}

// Mark every cell that touches one of the polygons (its centre or a corner lies inside) as no-go.
function buildGrid(width, height, polygons) {
  const grid = emptyGrid(width, height);
  let cells = '';
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const probes = [[0.5, 0.5], [0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => [((c + dx) * width) / grid.cols, ((r + dy) * height) / grid.rows]);
      cells += polygons.some((polygon) => probes.some((p) => pointInPolygon(p, polygon))) ? '1' : '0';
    }
  }
  return { ...grid, cells };
}

function cellAt(site, p) {
  const c = Math.min(site.grid.cols - 1, Math.max(0, Math.floor((p[0] / site.width) * site.grid.cols)));
  const r = Math.min(site.grid.rows - 1, Math.max(0, Math.floor((p[1] / site.height) * site.grid.rows)));
  return r * site.grid.cols + c;
}

function isBlocked(site, p) { return site.grid.cells[cellAt(site, p)] === '1'; }
function isUsable(site, p) { return pointInPolygon(p, site.boundary) && !isBlocked(site, p); }
function isOnFence(site, p) { return distanceToBoundary(site, p) * metresPerUnit(site) <= 6 && !isBlocked(site, p); }

// Every usable spot on a regular raster: the places the planner can choose from.
function candidatePoints(site) {
  const step = site.width / 80;
  const points = [];
  for (let y = step / 2; y < site.height; y += step) {
    for (let x = step / 2; x < site.width; x += step) {
      const p = [Math.round(x), Math.round(y)];
      if (isUsable(site, p)) points.push(p);
    }
  }
  return points;
}

// ---------- the layout planner ----------

function direction(from, to) {
  const length = distance(from, to) || 1;
  return [(to[0] - from[0]) / length, (to[1] - from[1]) / length];
}
const sideways = (v) => [-v[1], v[0]];
const stepFrom = (p, v, units) => [p[0] + v[0] * units, p[1] + v[1] * units];
const bestBy = (list, score) => list.reduce((best, p) => (best === null || score(p) > score(best) ? p : best), null);

// Suggest the best spot for every facility. Returns { placements, problem }.
// The idea: gate on the fence, main stage as far from the gate as possible (the crowd walks past
// everything), second stage far from the main stage (sound), food court in the middle of the three,
// first aid, water and toilets between each stage and the food court, services next to the gate,
// emergency exits far from the gate and from each other. Nothing goes on a no-go area.
function suggestLayout(site) {
  const candidates = candidatePoints(site);
  if (candidates.length === 0) {
    return { placements: {}, problem: 'There is no usable ground. Draw the ground border and make sure not all of it is a no-go area.' };
  }
  const m = metresPerUnit(site);
  const u = (metres) => metres / m;
  const placed = {};
  const isFree = (p, minMetres) => Object.values(placed).every((q) => distance(p, q) * m >= minMetres);
  const snap = (target, minMetres, pool = candidates) => {
    const free = pool.filter((p) => isFree(p, minMetres));
    const choice = free.length ? free : pool.length ? pool : candidates;
    return choice.reduce((best, p) => (distance(p, target) < distance(best, target) ? p : best));
  };

  const entrance = nearestBoundaryPoint(site, site.entrance || [site.width / 2, site.height]);
  placed.entrance = entrance;

  // A stage needs free ground all around it (at least 25 m): no fence, water or forest right next to it.
  const hasRoom = (p) => distanceToBoundary(site, p) * m >= 25
    && [0, 45, 90, 135, 180, 225, 270, 315].every((deg) => [u(12), u(25)].every((r) => isUsable(site, [p[0] + Math.cos((deg * Math.PI) / 180) * r, p[1] + Math.sin((deg * Math.PI) / 180) * r])));
  const roomy = candidates.filter(hasRoom);
  const stagePool = roomy.length ? roomy : candidates;
  const stageA = bestBy(stagePool, (p) => distance(p, entrance));
  placed['stage-a'] = stageA;
  const stageBPool = stagePool.filter((p) => isFree(p, 40));
  const stageB = bestBy(stageBPool.length ? stageBPool : stagePool, (p) => distance(p, stageA) + 0.6 * distance(p, entrance));
  placed['stage-b'] = stageB;

  const middle = [(stageA[0] + stageB[0] + entrance[0]) / 3, (stageA[1] + stageB[1] + entrance[1]) / 3];
  const awayFromStages = candidates.filter((p) => distance(p, stageA) * m >= 60 && distance(p, stageB) * m >= 60);
  const court = snap(middle, 20, awayFromStages);
  [[-14, -7], [0, -7], [14, -7], [-14, 7], [0, 7], [14, 7]].forEach(([dx, dy], i) => {
    placed[`P${i + 1}`] = snap([court[0] + u(dx), court[1] + u(dy)], 8);
  });

  [['a', stageA], ['b', stageB]].forEach(([suffix, stage]) => {
    const towardsCourt = direction(stage, court);
    const side = sideways(towardsCourt);
    placed[`water-${suffix}`] = snap(stepFrom(stepFrom(stage, towardsCourt, u(45)), side, u(32)), 20);
    placed[`first-aid-${suffix}`] = snap(stepFrom(stepFrom(stage, towardsCourt, u(65)), side, -u(38)), 20);
    placed[`toilets-${suffix}`] = snap(stepFrom(stepFrom(stage, towardsCourt, u(95)), side, u(48)), 20);
  });
  placed.backstage = snap(stepFrom(stageA, direction(court, stageA), u(45)), 20);

  const inward = direction(entrance, court);
  const across = sideways(inward);
  placed.info = snap(stepFrom(stepFrom(entrance, inward, u(32)), across, u(22)), 15);
  placed.security = snap(stepFrom(stepFrom(entrance, inward, u(32)), across, -u(22)), 15);
  placed.recycling = snap(stepFrom(court, sideways(direction(entrance, court)), u(40)), 15);

  // An exit needs free ground on both sides of the fence, not a forest or lake right behind it.
  const clear = (p) => [-u(30), u(15), u(30)].every((d) => !isBlocked(site, stepFrom(p, direction(p, middle), d)));
  const fence = boundarySamples(site, 240).filter((p) => !isBlocked(site, p) && clear(p) && isFree(p, 20));
  const fencePool = fence.length ? fence : boundarySamples(site, 240);
  const exit1 = bestBy(fencePool, (p) => Math.min(distance(p, entrance), distance(p, stageA)));
  placed['exit-1'] = exit1;
  placed['exit-2'] = bestBy(fencePool, (p) => Math.min(distance(p, entrance), distance(p, exit1)));

  const placements = {};
  LAYOUT_ITEMS.forEach((item) => { placements[item.id] = placed[item.id].map(Math.round); });
  return { placements, problem: null };
}

// ---------- walkways ----------

// The shortest walkable route between two points that goes around no-go areas and stays inside the fence.
// It searches the grid cell by cell (the A* method, like a navigation app). Returns a list of points.
function walkwayRoute(site, from, to) {
  const { cols, rows } = site.grid;
  const cw = site.width / cols;
  const ch = site.height / rows;
  const cellOf = (p) => [Math.min(cols - 1, Math.max(0, Math.floor(p[0] / cw))), Math.min(rows - 1, Math.max(0, Math.floor(p[1] / ch)))];
  const centre = (c, r) => [(c + 0.5) * cw, (r + 0.5) * ch];
  const [sc, sr] = cellOf(from);
  const [ec, er] = cellOf(to);
  const key = (c, r) => r * cols + c;
  const walkable = (c, r) => (c === sc && r === sr) || (c === ec && r === er) || isUsable(site, centre(c, r));
  const guess = (c, r) => Math.hypot((c - ec) * cw, (r - er) * ch);
  const cost = new Map([[key(sc, sr), 0]]);
  const cameFrom = new Map();
  const open = [[guess(sc, sr), sc, sr]];
  const done = new Set();
  while (open.length) {
    open.sort((a, b) => a[0] - b[0]);
    const [, c, r] = open.shift();
    const k = key(c, r);
    if (done.has(k)) continue;
    done.add(k);
    if (c === ec && r === er) {
      const cells = [];
      for (let at = k; at !== undefined; at = cameFrom.get(at)) cells.unshift([at % cols, Math.floor(at / cols)]);
      const points = [from, ...cells.slice(1, -1).map(([cc, rr]) => centre(cc, rr)), to];
      // Keep only the corners, so the line is not jagged.
      return points.filter((p, i) => i === 0 || i === points.length - 1
        || Math.abs((p[0] - points[i - 1][0]) * (points[i + 1][1] - p[1]) - (p[1] - points[i - 1][1]) * (points[i + 1][0] - p[0])) > 1e-6)
        .map((p) => p.map(Math.round));
    }
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
      const nc = c + dc;
      const nr = r + dr;
      if ((dc || dr) && nc >= 0 && nr >= 0 && nc < cols && nr < rows && walkable(nc, nr) && !done.has(key(nc, nr))) {
        const next = cost.get(k) + Math.hypot(dc * cw, dr * ch);
        if (next < (cost.get(key(nc, nr)) ?? Infinity)) {
          cost.set(key(nc, nr), next);
          cameFrom.set(key(nc, nr), k);
          open.push([next + guess(nc, nr), nc, nr]);
        }
      }
    }
  }
  return [from, to]; // no way around: draw a straight line
}

// ---------- the layout check: the rules a good festival ground follows ----------

const LAYOUT_RULE_COUNT = 10;

function checkLayout(site, placements) {
  const at = (id) => placements[id];
  const metres = (a, b) => metresBetweenPoints(site, at(a), at(b));
  const name = (id) => findItem(id).name;
  const missing = LAYOUT_ITEMS.filter((item) => !at(item.id)).map((item) => item.id);
  const rule = (id, label, ids, check) => {
    if (ids.some((i) => missing.includes(i))) return { id, label, ok: false, detail: 'Not everything for this rule is on the map yet.', items: ids };
    return { id, label, items: ids, ...check() };
  };
  const nearest = (stage, kind) => Math.min(...LAYOUT_ITEMS.filter((i) => i.kind === kind && at(i.id)).map((i) => metres(stage, i.id)));
  const perStage = (kind, limit) => () => {
    const a = nearest('stage-a', kind);
    const b = nearest('stage-b', kind);
    return { ok: a <= limit && b <= limit, detail: `Stage A: ${a} m · Stage B: ${b} m (at most ${limit} m)` };
  };
  const pitches = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];

  const rules = [
    { id: 'all-placed', label: 'Every facility is on the map', ok: missing.length === 0, items: missing,
      detail: missing.length ? `Missing: ${missing.map(name).join(', ')}` : `All ${LAYOUT_ITEMS.length} facilities placed` },
    rule('usable', 'Nothing stands on a no-go area or outside the fence', [], () => {
      const wrong = LAYOUT_ITEMS.filter((item) => at(item.id) && !(item.onFence ? isOnFence(site, at(item.id)) : isUsable(site, at(item.id))));
      return { ok: wrong.length === 0, items: wrong.map((i) => i.id),
        detail: wrong.length ? `Move: ${wrong.map((i) => i.name).join(', ')}` : 'Everything is on usable ground; gate and exits are on the fence' };
    }),
    rule('stage-distance', 'The stages are far enough apart for the sound', ['stage-a', 'stage-b'], () => {
      const d = metres('stage-a', 'stage-b');
      return { ok: d >= 150, detail: `${d} m apart (at least 150 m)` };
    }),
    rule('first-aid', 'First aid close to every stage', ['stage-a', 'stage-b', 'first-aid-a', 'first-aid-b'], perStage('first-aid', 200)),
    rule('toilets', 'Toilets close to every stage', ['stage-a', 'stage-b', 'toilets-a', 'toilets-b'], perStage('toilets', 150)),
    rule('water', 'Free water close to every stage', ['stage-a', 'stage-b', 'water-a', 'water-b'], perStage('water', 120)),
    rule('food-court', 'The food court is not in a stage crowd', ['stage-a', 'stage-b', ...pitches], () => {
      const centre = [0, 1].map((k) => pitches.reduce((sum, id) => sum + at(id)[k], 0) / pitches.length);
      const a = metresBetweenPoints(site, centre, at('stage-a'));
      const b = metresBetweenPoints(site, centre, at('stage-b'));
      return { ok: a >= 50 && b >= 50, detail: `${a} m from Stage A, ${b} m from Stage B (at least 50 m)` };
    }),
    rule('exits', 'Two emergency exits, far apart', ['exit-1', 'exit-2'], () => {
      const d = metres('exit-1', 'exit-2');
      return { ok: d >= 150, detail: `${d} m apart (at least 150 m)` };
    }),
    rule('entrance-services', 'Info and security right at the entrance', ['entrance', 'info', 'security'], () => {
      const i = metres('entrance', 'info');
      const s = metres('entrance', 'security');
      return { ok: i <= 80 && s <= 80, detail: `Info ${i} m, security ${s} m from the gate (at most 80 m)` };
    }),
    rule('spacing', 'Facilities do not overlap', [], () => {
      const placedItems = LAYOUT_ITEMS.filter((item) => at(item.id));
      const clashes = [];
      placedItems.forEach((a, i) => placedItems.slice(i + 1).forEach((b) => {
        const minimum = a.kind === 'pitch' && b.kind === 'pitch' ? 5 : 10;
        if (metres(a.id, b.id) < minimum) clashes.push([a, b]);
      }));
      return { ok: clashes.length === 0, items: [...new Set(clashes.flat().map((i) => i.id))],
        detail: clashes.length ? `Too close: ${clashes.slice(0, 2).map(([a, b]) => `${a.name} & ${b.name}`).join('; ')}` : 'At least 10 m between facilities' };
    })
  ];
  return rules;
}

function layoutScore(rules) { return Math.round((rules.filter((r) => r.ok).length / rules.length) * 100); }

// The nearest facility of one kind (e.g. 'toilets') from a point, for the details panel.
function nearestOfKind(site, placements, from, kind) {
  const options = LAYOUT_ITEMS.filter((i) => i.kind === kind && placements[i.id])
    .map((item) => ({ item, metres: metresBetweenPoints(site, from, placements[item.id]) }));
  return options.sort((a, b) => a.metres - b.metres)[0] || null;
}

// ---------- the demo map and saving ----------

function demoSite() {
  const site = {
    id: 'demo', name: 'Demo festival ground', image: null, width: 1200, height: 800, widthMetres: 600,
    boundary: [[90, 110], [560, 70], [1080, 120], [1130, 420], [1060, 700], [600, 742], [140, 690], [70, 400]],
    entrance: [600, 742], grid: buildGrid(1200, 800, [DEMO_SCENE.forest, DEMO_SCENE.lake]), placements: {}
  };
  site.placements = suggestLayout(site).placements;
  return site;
}

const isPoint = (p) => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number' && Number.isFinite(n));

// Read the saved maps back. Broken entries are dropped instead of crashing the page.
function parseSiteMaps(text) {
  let saved;
  try { saved = JSON.parse(text); } catch { return []; }
  if (!Array.isArray(saved)) return [];
  return saved.filter((s) => s && typeof s.id === 'string' && typeof s.name === 'string'
    && s.width > 0 && s.height > 0 && s.widthMetres > 0
    && (s.image === null || (typeof s.image === 'string' && s.image.startsWith('data:image/')))
    && Array.isArray(s.boundary) && s.boundary.length >= 3 && s.boundary.every(isPoint)
    && (s.entrance === null || isPoint(s.entrance))
    && s.grid && typeof s.grid.cells === 'string' && s.grid.cells.length === s.grid.cols * s.grid.rows
    && s.placements && typeof s.placements === 'object')
    .map((s) => ({ ...s, placements: Object.fromEntries(Object.entries(s.placements).filter(([id, p]) => findItem(id) && isPoint(p))) }));
}

// In the browser these are plain globals; in the tests (Node) they are exported.
if (typeof module !== 'undefined') {
  module.exports = {
    SITE_MAPS_STORAGE_KEY, MAP_CATEGORIES, LAYOUT_ITEMS, LAYOUT_RULE_COUNT, DEMO_SCENE,
    findItem, distance, metresPerUnit, walkwayRoute, metresBetweenPoints, walkingMinutesBetween, pointInPolygon,
    nearestBoundaryPoint, emptyGrid, buildGrid, isBlocked, isUsable, isOnFence, candidatePoints,
    suggestLayout, checkLayout, layoutScore, nearestOfKind, demoSite, parseSiteMaps
  };
}
