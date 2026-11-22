// Seekable crowd playback. Small groups share walking routes; each visitor has an individual position.
const VisitorSimulation = (() => {
  const geometry = typeof module !== 'undefined' ? require('./site-map-rules.js') : { isUsable, isOnFence, nearestBoundaryPoint };
  const crowd = typeof module !== 'undefined' ? require('./crowd-rules.js') : { normalizeCrowdSafety, strictEvacuationRoute, estimateEvacuation };

  function random(seed) {
    let n = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
    n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  // Keep the entire dot cloud inside the fence and away from blocked cells.
  function clearance(site, point, radius) {
    const [x, y] = point;
    if (!geometry.isUsable(site, point)) return 0;
    const fence = geometry.nearestBoundaryPoint(site, point);
    let room = Math.min(radius, Math.hypot(fence[0] - x, fence[1] - y));
    const { cols, rows, cells } = site.grid, w = site.width / cols, h = site.height / rows;
    for (let row = Math.max(0, Math.floor((y - room) / h)); row <= Math.min(rows - 1, Math.floor((y + room) / h)); row++) {
      for (let col = Math.max(0, Math.floor((x - room) / w)); col <= Math.min(cols - 1, Math.floor((x + room) / w)); col++) {
        if (cells[row * cols + col] !== '1') continue;
        const dx = Math.max(col * w - x, x - (col + 1) * w, 0);
        const dy = Math.max(row * h - y, y - (row + 1) * h, 0);
        room = Math.min(room, Math.hypot(dx, dy));
      }
    }
    return room * 0.98;
  }

  function build(site, visitors, stageIds, day) {
    const safety = crowd.normalizeCrowdSafety(site.crowdSafety, stageIds);
    const unit = site.widthMetres / site.width;
    const gate = site.placements.entrance || site.entrance;
    if (!gate || !geometry.isOnFence(site, gate)) return { problem: 'Place the entrance on a walkable part of the fence to simulate arrivals.' };
    if (!(safety.walkingSpeed > 0)) return { problem: 'Enter a walking speed in Crowd and evacuation estimates.' };

    function spot(id, point, metres) {
      return { id, point, radius: clearance(site, point, metres / unit) };
    }
    const entrance = spot('entrance', gate, 1);
    const pitches = Object.keys(site.placements).filter(id => /^P\d+$/.test(id) && geometry.isUsable(site, site.placements[id]));
    const facilities = [pitches[0], pitches[Math.floor(pitches.length / 2)], pitches.at(-1), 'water-a', 'water-b'].filter((id, i, ids) =>
      id && ids.indexOf(id) === i && site.placements[id] && geometry.isUsable(site, site.placements[id]));
    const hubs = new Map(facilities.map(id => [id, spot(id, site.placements[id], 20)]));
    const court = hubs.values().next().value?.point || [site.width / 2, site.height / 2];
    for (const id of stageIds) {
      const pin = site.placements[id];
      if (!pin || !geometry.isUsable(site, pin)) continue;
      const dx = court[0] - pin[0], dy = court[1] - pin[1], length = Math.hypot(dx, dy);
      const radius = Math.max(6, Math.min(65, Math.sqrt((safety.stages[id].area || 2000) / Math.PI)));
      const front = Math.min(length / 3, (15 + radius * 0.7) / unit);
      const point = length ? [pin[0] + dx / length * front, pin[1] + dy / length * front] : pin;
      const clearFront = geometry.isUsable(site, point) && crowd.strictEvacuationRoute(site, pin, point).reachable;
      hubs.set(id, spot(id, clearFront ? point : pin, radius));
    }

    // Cache arc lengths and clearances once. Paths never fall back to straight lines through obstacles.
    function makeRoute(from, to) {
      const backwards = from === entrance;
      const result = crowd.strictEvacuationRoute(site, ...(backwards ? [to.point, from.point] : [from.point, to.point]));
      if (!result.reachable) return null;
      const points = backwards ? result.points.reverse() : result.points;
      const cell = Math.min(site.width / site.grid.cols, site.height / site.grid.rows);
      const vertices = [];
      let distance = 0;
      for (let i = 0; i < points.length; i++) {
        const a = points[Math.max(0, i - 1)], b = points[i];
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (i && !length) continue;
        const steps = i ? Math.max(1, Math.ceil(length / (cell / 2))) : 1;
        for (let k = 1; k <= steps; k++) {
          const t = k / steps, p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
          const start = !i, end = i === points.length - 1 && k === steps;
          if (!start && !end && !geometry.isUsable(site, p)) return null;
          distance += length / steps;
          vertices.push({ x: p[0], y: p[1], at: distance, room: clearance(site, p, Math.max(5 / unit, from.radius, to.radius)) });
        }
      }
      return { from, to, vertices, length: distance, minutes: distance * unit / safety.walkingSpeed };
    }
    const cache = new Map();
    function between(from, to) {
      const key = from.id + ':' + to.id;
      if (!cache.has(key)) cache.set(key, makeRoute(from, to));
      return cache.get(key);
    }
    const reachable = [...hubs.values()].filter(hub => between(entrance, hub));
    const available = new Set(reachable.map(hub => hub.id));
    if (!reachable.length) return { problem: 'Place a stage or food-court pitch with a walkable route from the entrance.' };
    const rest = reachable.filter(hub => facilities.includes(hub.id));
    const shows = day.shows.filter(show => available.has(show.stage));
    const missing = day.shows.length - shows.length;
    const breaks = rest.length ? rest : reachable;
    const streams = [];
    const streamCount = Math.min(visitors, 48);
    for (let i = 0; i < streamCount; i++) {
      const arrival = day.start + random(i + 19) * Math.min(40, (day.end - day.start) / 4);
      const preferences = shows.map((show, index) => ({
        hub: hubs.get(show.stage), from: show.start - 12 * random(23 + i * 83 + index),
        to: show.end + 4 * random(73 + i * 59 + index), affinity: random(113 + i * 137 + index * 983)
      }));
      const changes = new Set([arrival]), active = new Set();
      const starts = preferences.slice().sort((a, b) => a.from - b.from);
      const ends = preferences.slice().sort((a, b) => a.to - b.to);
      let started = 0, finished = 0;
      for (const show of preferences) {
        if (show.from > arrival && show.from < day.end) changes.add(show.from);
        if (show.to > arrival && show.to < day.end) changes.add(show.to);
      }
      for (let t = arrival + 38; t < day.end; t += 38) changes.add(t);
      let here = entrance, ready = arrival;
      const trips = [];
      for (const at of [...changes].sort((a, b) => a - b)) {
        let favourite = null;
        while (started < starts.length && starts[started].from <= at) active.add(starts[started++]);
        while (finished < ends.length && ends[finished].to <= at) active.delete(ends[finished++]);
        for (const show of active) {
          const expected = safety.stages[show.hub.id].audience;
          const share = expected === null ? 0.75 : Math.min(1, expected / visitors);
          if (show.affinity >= 1 - share && (!favourite || show.affinity > favourite.affinity)) favourite = show;
        }
        const index = (i + Math.floor((at - arrival) / 38)) % breaks.length;
        const destination = favourite?.hub || breaks[index];
        if (here === destination) continue;
        const path = between(here, destination);
        if (!path) continue;
        const start = Math.max(at, ready);
        if (start >= day.end || (favourite && start >= favourite.to)) continue;
        trips.push({ start, path });
        ready = start + path.minutes; here = destination;
      }
      streams.push({ arrival, trips, first: Math.floor(i * visitors / streamCount), last: Math.floor((i + 1) * visitors / streamCount) });
    }
    const offsets = new Float32Array(visitors * 2);
    for (let i = 0; i < visitors; i++) {
      const angle = 2 * Math.PI * random(i + 9003), radius = Math.sqrt(random(i + 17169));
      offsets[i * 2] = radius * Math.cos(angle); offsets[i * 2 + 1] = radius * Math.sin(angle);
    }
    return { site, visitors, safety, stageIds, streams, offsets, day, entrance, makeRoute, spot, missing, unit };
  }

  function samplePath(path, fraction, unit) {
    if (fraction >= 1 || !path.length) return { x: path.to.point[0], y: path.to.point[1], r: path.to.radius };
    const d = Math.max(0, fraction) * path.length;
    const vertices = path.vertices;
    let lo = 0, hi = vertices.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >>> 1;
      if (vertices[mid].at <= d) lo = mid; else hi = mid;
    }
    const a = vertices[lo], b = vertices[hi], t = (d - a.at) / (b.at - a.at || 1);
    // Distance to an obstacle can decrease by at most the distance walked.
    const room = Math.max(0, a.room - (d - a.at), b.room - (b.at - d));
    const lane = 4 / unit;
    const desired = Math.max(Math.min(lane, path.from.radius + d, path.to.radius + path.length - d), path.from.radius - d, path.to.radius - (path.length - d));
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, r: Math.min(room, desired) };
  }

  function festivalPosition(model, stream, minute) {
    if (minute < stream.arrival) return null;
    const trips = stream.trips;
    let i = trips.length - 1;
    while (i >= 0 && trips[i].start > minute) i--;
    if (i < 0) return { x: model.entrance.point[0], y: model.entrance.point[1], r: 0 };
    const { path, start } = trips[i];
    return samplePath(path, path.minutes ? (minute - start) / path.minutes : 1, model.unit);
  }

  function evacuation(model, minute) {
    const { site, safety } = model;
    const exits = Object.entries(safety.exits).filter(([id, exit]) => exit.open && site.placements[id]
      && geometry.isOnFence(site, site.placements[id])).map(([id, exit]) => ({
        ...exit, hub: model.spot(id, site.placements[id], 0), nextFree: 0
      }));
    if (!exits.length) return { problem: 'Mark an emergency exit as available and place it on the fence.' };
    if (!(safety.preMovementMinutes >= 0) || safety.preMovementMinutes === null || !(safety.flowRate > 0))
      return { problem: 'Enter a response delay and exit flow in Crowd and evacuation estimates.' };

    const groups = [], paths = new Map();
    let count = 0, stranded = 0, unmeasured = 0, end = 0;
    for (const stream of model.streams) {
      const at = festivalPosition(model, stream, minute);
      if (!at) continue;
      const size = stream.last - stream.first;
      count += size;
      const from = { id: 'snapshot', point: [at.x, at.y], radius: at.r };
      const key = [at.x, at.y, at.r].join(',');
      if (!paths.has(key)) {
        const choices = exits.map(exit => ({ exit, path: model.makeRoute(from, exit.hub) })).filter(choice => choice.path);
        paths.set(key, choices.sort((a, b) => a.path.length - b.path.length)[0]);
      }
      const choice = paths.get(key);
      if (!choice) {
        groups.push({ stream, at }); stranded += size; continue;
      }
      const { exit, path } = choice;
      const arrive = safety.preMovementMinutes + path.minutes;
      // Keep waiting visitors visible on the approach. A missing width cannot clear a queue.
      const approach = path.length ? Math.max(0, 1 - 4 / model.unit / path.length) : 1;
      groups.push({ stream, at, exit, path, arrive, approach });
      end = Math.max(end, arrive);
    }
    if (!count) return { problem: 'Choose a time after visitors have arrived.' };
    for (const group of groups.filter(g => g.path).sort((a, b) => a.arrive - b.arrive)) {
      const size = group.stream.last - group.stream.first;
      if (!(group.exit.width > 0)) { unmeasured += size; continue; }
      group.rate = group.exit.width * safety.flowRate;
      group.service = Math.max(group.exit.nextFree, group.arrive);
      group.exit.nextFree = group.service + size / group.rate;
      end = Math.max(end, group.exit.nextFree);
    }
    const estimate = crowd.estimateEvacuation(site, model.visitors, safety, model.stageIds);
    return { groups, count, stranded, unmeasured, end, estimate, delay: safety.preMovementMinutes };
  }

  // The renderer receives groups with a contiguous range of individual dots.
  function frame(model, minute, drill, visit) {
    let inside = 0;
    if (!drill) {
      for (const stream of model.streams) {
        const at = festivalPosition(model, stream, minute);
        if (at) { visit(stream.first, stream.last, at); inside += stream.last - stream.first; }
      }
    } else {
      for (const group of drill.groups) {
        let first = group.stream.first;
        if (group.rate && minute > group.service) {
          const size = group.stream.last - first;
          const finished = minute >= group.service + size / group.rate;
          first += finished ? size : Math.min(size, Math.floor((minute - group.service) * group.rate));
        }
        if (first === group.stream.last) continue;
        const moving = group.path && minute > drill.delay;
        const fraction = moving && group.path.minutes ? (minute - drill.delay) / group.path.minutes : 1;
        const at = moving ? samplePath(group.path, Math.min(group.approach, fraction), model.unit) : group.at;
        visit(first, group.stream.last, at); inside += group.stream.last - first;
      }
    }
    return inside;
  }
  return { build, festivalPosition, evacuation, frame };
})();
if (typeof module !== 'undefined') module.exports = VisitorSimulation;
