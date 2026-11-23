// Site map: clear all pins and place them again one by one (feature-plans/clear-site-map-pins.md).
// No screen code here. Builds on rules/site-map-rules.js (MAP_CATEGORIES, isUsable, isOnFence,
// nearestBoundaryPoint, metresPerUnit). Only the pins change: the map, its fence, the no-go areas
// and the crowd measurements always stay.

// In the browser site-map-rules.js is loaded first; the tests load it with require.
const pinMap = typeof module !== 'undefined' && typeof require === 'function'
  ? require('./site-map-rules.js') : { MAP_CATEGORIES, isUsable, isOnFence, nearestBoundaryPoint };

// The placements left after "Clear all pins". keepGate keeps only the main entrance.
function clearedPlacements(placements = {}, { keepGate = false } = {}) {
  return keepGate && placements.entrance ? { entrance: [...placements.entrance] } : {};
}

// How many pins of the current facility list are on the map, and how many "Clear" would remove.
function pinCounts(items, placements = {}, { keepGate = false } = {}) {
  const placed = items.filter((item) => placements[item.id]);
  const kept = keepGate && placements.entrance ? 1 : 0;
  return { total: items.length, placed: placed.length, toRemove: placed.length - kept };
}

// The pins still waiting for a place, grouped by map category in the map's own order.
//   → [{ category, title, colour, items: [item, …] }]   (empty categories are left out)
function pinsToPlace(items, placements = {}) {
  return pinMap.MAP_CATEGORIES.map((category) => ({
    category: category.id, title: category.title, colour: category.colour,
    items: items.filter((item) => item.category === category.id && !placements[item.id])
  })).filter((group) => group.items.length > 0);
}

// After placing `placedId`: the next pin of the same category, otherwise the next one at all.
function nextPinToPlace(items, placements = {}, placedId = null) {
  const open = items.filter((item) => !placements[item.id] && item.id !== placedId);
  const category = items.find((item) => item.id === placedId)?.category;
  return open.find((item) => item.category === category) || open[0] || null;
}

// Where a pin lands when the organiser clicks `point` on the map.
// Gate and emergency exits snap onto the fence; everything else must be on usable ground.
//   → { ok: true, at: [x, y] } or { ok: false, problem: '…' }
function pinSpot(site, item, point) {
  if (!item) return { ok: false, problem: 'Choose a pin to place first.' };
  if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)) {
    return { ok: false, problem: 'That spot is not on the map.' };
  }
  if (item.onFence) {
    const at = pinMap.nearestBoundaryPoint(site, point).map(Math.round);
    return pinMap.isOnFence(site, at) ? { ok: true, at }
      : { ok: false, problem: `${item.name} must be on the fence, and that part of the fence is a no-go area. Click closer to another part of the fence.` };
  }
  if (!pinMap.isUsable(site, point)) {
    return { ok: false, problem: `${item.name} cannot stand there: it is outside the fence or on a no-go area. Click a spot inside the festival ground.` };
  }
  return { ok: true, at: point.map(Math.round) };
}

// "Fill the rest for me": keep every pin the organiser placed by hand and take the
// suggestion only for the pins that are still missing.
function fillMissingPins(placements = {}, suggested = {}) {
  return { ...suggested, ...placements };
}

if (typeof module !== 'undefined') {
  module.exports = { clearedPlacements, pinCounts, pinsToPlace, nextPinToPlace, pinSpot, fillMissingPins };
}
