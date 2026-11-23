// Site map: clear all pins or one pin, and place pins again one by one (feature-plans/clear-site-map-pins.md).
// No screen code here. Builds on rules/site-map-rules.js (MAP_CATEGORIES, isUsable, isOnFence,
// nearestBoundaryPoint, metresPerUnit). Only the pins change: the map, its fence, the no-go areas
// and the crowd measurements always stay.

// In the browser site-map-rules.js is loaded first; the tests load it with require.
const pinMap = typeof module !== 'undefined' && typeof require === 'function'
  ? require('./site-map-rules.js')
  : { MAP_CATEGORIES, isUsable, isOnFence, nearestBoundaryPoint, EXTRA_PIN_TYPES, EXTRA_PIN_MAX, EXTRA_PIN_NAME_MAX, parseExtraPins };

// The placements left after "Clear all pins". keepGate keeps only the main entrance.
function clearedPlacements(placements = {}, { keepGate = false } = {}) {
  return keepGate && placements.entrance ? { entrance: [...placements.entrance] } : {};
}

// One pin taken off the map; it then waits under "Pins to place". Nothing else changes.
function withoutPin(placements = {}, id) {
  const rest = { ...placements };
  delete rest[id];
  return rest;
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

// Kinds that come in large numbers share one button in "Pins to place" ("Toilets ×25").
const PIN_BULK_LABELS = { toilets: 'Toilets', water: 'Free water', pitch: 'Food pitches' };
const PIN_BULK_FROM = 4;

// The buttons of "Pins to place": one per pin, except many open pins of one kind share a button.
// A shared button places its first open pin (e.g. the toilets next to Stage A come first).
//   → [{ category, title, colour, count, choices: [{ id, ids, label, symbol, count }] }]
function pinChoices(items, placements = {}) {
  return pinsToPlace(items, placements).map((group) => {
    const choices = [];
    for (const item of group.items) {
      const same = group.items.filter((other) => other.kind === item.kind);
      if (same.length >= PIN_BULK_FROM && PIN_BULK_LABELS[item.kind]) {
        if (same[0] !== item) continue;
        choices.push({ id: item.id, ids: same.map((other) => other.id), label: PIN_BULK_LABELS[item.kind], symbol: item.symbol, count: same.length });
      } else {
        choices.push({ id: item.id, ids: [item.id], label: item.name, symbol: item.symbol, count: 1 });
      }
    }
    return { category: group.category, title: group.title, colour: group.colour, count: group.items.length, choices };
  });
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

// "+ Add pin": a new extra pin of one type, with the next free id and a name.
// The name is the organiser's own (e.g. "VIP area") or the type's label with a number ("Toilets (added 2)").
//   → { ok: true, extraPins, pin } or { ok: false, problem }
function addExtraPin(extraPins = [], kind, name = '') {
  const pins = pinMap.parseExtraPins(extraPins);
  const type = pinMap.EXTRA_PIN_TYPES.find((entry) => entry.kind === kind);
  if (!type) return { ok: false, problem: 'Choose what kind of pin to add.' };
  if (pins.length >= pinMap.EXTRA_PIN_MAX) return { ok: false, problem: `A map can have at most ${pinMap.EXTRA_PIN_MAX} added pins. Remove one first.` };
  const own = String(name || '').trim();
  if (own.length > pinMap.EXTRA_PIN_NAME_MAX) return { ok: false, problem: `Keep the name to ${pinMap.EXTRA_PIN_NAME_MAX} characters.` };
  if (kind === 'marker' && !own) return { ok: false, problem: 'Give your own pin a name, e.g. "VIP area".' };
  let n = 1;
  while (pins.some((pin) => pin.id === `x-${n}`)) n++;
  const sameKind = pins.filter((pin) => pin.kind === kind).length + 1;
  const pin = { id: `x-${n}`, kind, name: own || `${type.label} (added ${sameKind})` };
  return { ok: true, extraPins: [...pins, pin], pin };
}

// Removing an added pin deletes it completely (it does not wait under "Pins to place").
function withoutExtraPin(extraPins = [], id) {
  return pinMap.parseExtraPins(extraPins).filter((pin) => pin.id !== id);
}

// Added pins that are not on the map (e.g. adding was cancelled) are dropped.
function placedExtraPins(extraPins = [], placements = {}) {
  return pinMap.parseExtraPins(extraPins).filter((pin) => placements[pin.id]);
}

// "Fill the rest for me": keep every pin the organiser placed by hand and take the
// suggestion only for the pins that are still missing.
function fillMissingPins(placements = {}, suggested = {}) {
  return { ...suggested, ...placements };
}

if (typeof module !== 'undefined') {
  module.exports = { clearedPlacements, withoutPin, pinCounts, pinsToPlace, pinChoices, nextPinToPlace, pinSpot, fillMissingPins,
    addExtraPin, withoutExtraPin, placedExtraPins };
}
