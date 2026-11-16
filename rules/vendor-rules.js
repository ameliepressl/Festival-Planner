// Festival Architect — vendors: the food, drink and merch catalogue and which vendor stands on which pitch.
// Only data and calculations live here (no screen code), so they can be tested (tests/) and used by
// vendors/vendors-page.js and site-map/site-map-page.js.
// "placements" is a plain object: vendor id -> pitch, e.g. { tacos: 'P1', coffee: 'P2' }.

const PITCHES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
const VENDOR_STORAGE_KEY = 'festival-architect-vendors';

const VENDOR_CATEGORIES = ['Food', 'Drinks', 'Merch'];

const VENDORS = [
  { id: 'tacos', name: 'Taco Tribe', category: 'Food', icon: '🌮', fee: 900, tags: ['vegan', 'gluten-free'], text: 'Corn tacos with a vegan jackfruit option.' },
  { id: 'burgers', name: 'Smash Burger Co.', category: 'Food', icon: '🍔', fee: 1200, tags: [], text: 'Smashed beef burgers and fries.' },
  { id: 'pizza', name: 'Forno Pizza', category: 'Food', icon: '🍕', fee: 1000, tags: ['vegetarian'], text: 'Wood-fired pizza by the slice.' },
  { id: 'bowls', name: 'Green Bowl', category: 'Food', icon: '🥗', fee: 800, tags: ['vegan', 'gluten-free'], text: 'Fresh grain and salad bowls.' },
  { id: 'noodles', name: 'Wok & Roll', category: 'Food', icon: '🍜', fee: 950, tags: ['vegetarian'], text: 'Stir-fried noodles from the wok.' },
  { id: 'crepes', name: 'Crêpe Corner', category: 'Food', icon: '🥞', fee: 600, tags: ['vegetarian'], text: 'Sweet and savoury crêpes.' },
  { id: 'beer', name: 'Lisbon Craft Beer', category: 'Drinks', icon: '🍺', fee: 1500, tags: ['alcohol'], text: 'Local craft beer on tap.' },
  { id: 'cocktails', name: 'Sunset Cocktails', category: 'Drinks', icon: '🍹', fee: 1400, tags: ['alcohol'], text: 'Cocktails and spritzes.' },
  { id: 'coffee', name: 'Bean There Coffee', category: 'Drinks', icon: '☕', fee: 700, tags: ['alcohol-free', 'vegan'], text: 'Espresso, iced coffee and oat milk.' },
  { id: 'lemonade', name: 'Fresh Squeeze', category: 'Drinks', icon: '🍋', fee: 500, tags: ['alcohol-free', 'vegan'], text: 'Fresh lemonade and juices.' },
  { id: 'falafel', name: 'Falafel Factory', category: 'Food', icon: '🧆', fee: 750, tags: ['vegan'], text: 'Falafel wraps with hummus and pickles.' },
  { id: 'bifanas', name: 'Bifana Bros', category: 'Food', icon: '🥪', fee: 850, tags: [], text: 'Portuguese marinated pork sandwiches.' },
  { id: 'nata', name: 'Nata Lisboa', category: 'Food', icon: '🥧', fee: 550, tags: ['vegetarian'], text: 'Fresh pastéis de nata, warm from the oven.' },
  { id: 'sushi', name: 'Rolling Sushi', category: 'Food', icon: '🍣', fee: 1000, tags: ['gluten-free'], text: 'Sushi rolls and poke bowls.' },
  { id: 'bbq', name: 'Smoke & Fire BBQ', category: 'Food', icon: '🍖', fee: 1300, tags: ['gluten-free'], text: 'Slow-smoked ribs and pulled pork.' },
  { id: 'curry', name: 'Curry Club', category: 'Food', icon: '🍛', fee: 900, tags: ['vegan', 'gluten-free'], text: 'Vegetable curries with rice.' },
  { id: 'icecream', name: 'Gelato Gang', category: 'Food', icon: '🍦', fee: 600, tags: ['vegetarian', 'gluten-free'], text: 'Italian gelato and sorbet, vegan sorbets included.' },
  { id: 'churros', name: 'Churro Loco', category: 'Food', icon: '🍩', fee: 500, tags: ['vegan'], text: 'Churros with chocolate dip.' },
  { id: 'wine', name: 'Vinho Verde Bar', category: 'Drinks', icon: '🍷', fee: 1200, tags: ['alcohol'], text: 'Portuguese wines and sangria.' },
  { id: 'smoothies', name: 'Smoothie Shack', category: 'Drinks', icon: '🥤', fee: 600, tags: ['alcohol-free', 'vegan'], text: 'Fruit smoothies and iced tea.' },
  { id: 'kombucha', name: 'Kombucha Kollective', category: 'Drinks', icon: '🧃', fee: 450, tags: ['alcohol-free', 'vegan'], text: 'Craft kombucha and alcohol-free beer.' },
  { id: 'sunglasses', name: 'Shade Shop', category: 'Merch', icon: '🕶️', fee: 350, tags: [], text: 'Sunglasses, hats and bucket hats.' },
  { id: 'merch', name: 'Festival Merch', category: 'Merch', icon: '👕', fee: 1100, tags: [], text: 'Official festival shirts and tote bags.' },
  { id: 'vinyl', name: 'Wax Records', category: 'Merch', icon: '💿', fee: 400, tags: [], text: 'Vinyl and posters from the line-up.' }
];

function findVendor(id) { return VENDORS.find((vendor) => vendor.id === id) || null; }

// Read the saved placements back. Broken data, unknown vendors, unknown or doubled pitches are dropped.
function parsePlacements(text) {
  let saved;
  try { saved = JSON.parse(text); } catch { return {}; }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
  const result = {};
  Object.entries(saved).forEach(([vendorId, pitch]) => {
    if (findVendor(vendorId) && PITCHES.includes(pitch) && !Object.values(result).includes(pitch)) result[vendorId] = pitch;
  });
  return result;
}

function freePitches(placements) {
  const taken = Object.values(placements);
  return PITCHES.filter((pitch) => !taken.includes(pitch));
}

// Confirm a vendor on the first free pitch. Returns { placements, problem }:
// problem is null when it worked, otherwise a sentence saying why not (placements then stay unchanged).
function confirmVendor(placements, vendorId) {
  const vendor = findVendor(vendorId);
  if (!vendor) return { placements, problem: 'This vendor is not in the catalogue.' };
  if (placements[vendorId]) return { placements, problem: `${vendor.name} is already on pitch ${placements[vendorId]}.` };
  const free = freePitches(placements);
  if (free.length === 0) return { placements, problem: `All ${PITCHES.length} pitches are taken. Remove a vendor first.` };
  return { placements: { ...placements, [vendorId]: free[0] }, problem: null };
}

// Remove a vendor; its pitch becomes free. Returns a new object, the old one is not changed.
function removeVendor(placements, vendorId) {
  const result = { ...placements };
  delete result[vendorId];
  return result;
}

function vendorOnPitch(placements, pitch) {
  const entry = Object.entries(placements).find(([, p]) => p === pitch);
  return entry ? findVendor(entry[0]) : null;
}

// Pitch fees the confirmed vendors pay to the festival.
function pitchIncome(placements) {
  return Object.keys(placements).reduce((sum, id) => sum + findVendor(id).fee, 0);
}

// Are the visitors' basic needs covered? Lists what is still missing.
function coverage(placements) {
  const chosen = Object.keys(placements).map(findVendor);
  const checks = [
    { label: 'a vegan option', ok: chosen.some((v) => v.tags.includes('vegan')) },
    { label: 'a drinks vendor', ok: chosen.some((v) => v.category === 'Drinks') },
    { label: 'alcohol-free drinks', ok: chosen.some((v) => v.category === 'Drinks' && v.tags.includes('alcohol-free')) }
  ];
  return { checks, missing: checks.filter((c) => !c.ok).map((c) => c.label) };
}

// In the browser these are plain globals; in the tests (Node) they are exported.
if (typeof module !== 'undefined') {
  module.exports = {
    PITCHES, VENDOR_STORAGE_KEY, VENDOR_CATEGORIES, VENDORS, findVendor, parsePlacements,
    freePitches, confirmVendor, removeVendor, vendorOnPitch, pitchIncome, coverage
  };
}
