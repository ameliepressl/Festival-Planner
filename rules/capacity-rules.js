// Festival Architect — festival size: from the expected number of visitors, how many toilets, water points,
// food court pitches and crew the festival needs. The site map and the Vendors page both use this.
// Only data and calculations live here (no screen code), so they can be tested (tests/).
//
// The numbers are common rules of thumb for a one-day open-air event. They are a starting point for
// planning, not a legal requirement: always check the local authority's rules for the real event.

const GROUND_STORAGE_KEY = 'festival-architect-ground';
const DEFAULT_VISITORS = 5000;
const MIN_VISITORS = 500;
const MAX_VISITORS = 20000;

const CAPACITY_RULES = {
  visitorsPerToilet: 100,     // one toilet cabin per 100 visitors
  cabinsPerBlock: 8,          // one toilet row on the map has 8 cabins
  visitorsPerWaterPoint: 1000,
  visitorsPerPitch: 400,      // one food or drink outlet per 400 visitors
  visitorsPerFirstAider: 500,
  visitorsPerSecurity: 250,
  minPitches: 4,
  maxPitches: 20
};

// Everything the festival needs for this many visitors. On the map there are always at least
// two toilet rows and two water points (one near each stage).
function capacityNeeds(visitors) {
  const r = CAPACITY_RULES;
  const toiletCabins = Math.ceil(visitors / r.visitorsPerToilet);
  return {
    visitors,
    toiletCabins,
    toiletBlocks: Math.max(2, Math.ceil(toiletCabins / r.cabinsPerBlock)),
    waterPoints: Math.max(2, Math.ceil(visitors / r.visitorsPerWaterPoint)),
    pitches: Math.min(r.maxPitches, Math.max(r.minPitches, Math.ceil(visitors / r.visitorsPerPitch))),
    firstAiders: Math.max(4, Math.ceil(visitors / r.visitorsPerFirstAider)),
    securityStaff: Math.max(10, Math.ceil(visitors / r.visitorsPerSecurity))
  };
}

// Only whole numbers between the minimum and the maximum are accepted.
function validVisitors(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= MIN_VISITORS && number <= MAX_VISITORS;
}

// Read the saved festival size back. Missing or broken data gives the default.
function parseGround(text) {
  try {
    const saved = JSON.parse(text);
    if (saved && validVisitors(saved.visitors)) return { visitors: saved.visitors };
  } catch { /* fall through to the default */ }
  return { visitors: DEFAULT_VISITORS };
}

// In the browser these are plain globals; in the tests (Node) they are exported.
if (typeof module !== 'undefined') {
  module.exports = { GROUND_STORAGE_KEY, DEFAULT_VISITORS, MIN_VISITORS, MAX_VISITORS, CAPACITY_RULES, capacityNeeds, validVisitors, parseGround };
}
