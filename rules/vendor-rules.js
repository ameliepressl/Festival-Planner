// Festival Architect — vendors: the food, drink and merch catalogue and which vendor stands on which pitch.
// Only data and calculations live here (no screen code), so they can be tested (tests/) and used by
// vendors/vendors-page.js and site-map/site-map-page.js.
// "placements" is a plain object: vendor id -> pitch, e.g. { tacos: 'P1', coffee: 'P2' }.

const PITCHES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']; // the smallest food court
const MAX_PITCHES = 20;
// The pitch names for a food court of this size: pitchList(3) -> ['P1', 'P2', 'P3'].
function pitchList(count) { return Array.from({ length: count }, (_, i) => `P${i + 1}`); }
const VENDOR_STORAGE_KEY = 'festival-architect-vendors';

const VENDOR_CATEGORIES = ['Food', 'Drinks', 'Merch'];

// Menus: 'Item|price|tags' -> { item, price, tags }. Tag codes: vg = vegan, v = vegetarian,
// gf = gluten-free, a = contains alcohol, af = alcohol-free. Prices are fictional festival prices.
const MENU_TAGS = { vg: 'vegan', v: 'vegetarian', gf: 'gluten-free', a: 'alcohol', af: 'alcohol-free' };
function menuFrom(lines) {
  return lines.map((line) => {
    const [item, price, codes = ''] = line.split('|');
    return { item, price: Number(price), tags: codes.split(',').filter(Boolean).map((code) => MENU_TAGS[code]) };
  });
}

const VENDORS = [
  { id: 'tacos', name: 'Taco Tribe', category: 'Food', icon: '🌮', fee: 900, tags: ['vegan', 'gluten-free'], text: 'Corn tacos with a vegan jackfruit option.', cuisine: 'Tacos', photo: 'Taco',
    menu: menuFrom(['Beef tacos (3)|9.5|gf', 'Jackfruit tacos (3)|9|vg,v,gf', 'Nachos|6.5|vg,v,gf']) },
  { id: 'burgers', name: 'Smash Burger Co.', category: 'Food', icon: '🍔', fee: 1200, tags: [], text: 'Smashed beef burgers and fries.', cuisine: 'Burgers', photo: 'Hamburger',
    menu: menuFrom(['Smash burger|11|', 'Double smash burger|14|', 'Fries|4.5|']) },
  { id: 'pizza', name: 'Forno Pizza', category: 'Food', icon: '🍕', fee: 1000, tags: ['vegetarian'], text: 'Wood-fired pizza by the slice.', cuisine: 'Pizza', photo: 'Pizza',
    menu: menuFrom(['Margherita slice|5|v', 'Funghi slice|5.5|v', 'Whole margherita|13|v']) },
  { id: 'bowls', name: 'Green Bowl', category: 'Food', icon: '🥗', fee: 800, tags: ['vegan', 'gluten-free'], text: 'Fresh grain and salad bowls.', cuisine: 'Bowls', photo: 'Buddha bowl',
    menu: menuFrom(['Grain bowl|10|vg,v,gf', 'Superfood salad|10.5|vg,v,gf', 'Fruit cup|4|vg,v,gf']) },
  { id: 'noodles', name: 'Wok & Roll', category: 'Food', icon: '🍜', fee: 950, tags: ['vegetarian'], text: 'Stir-fried noodles from the wok.', cuisine: 'Noodles', photo: 'Ramen',
    menu: menuFrom(['Veggie stir-fried noodles|10|v', 'Chicken noodles|11|', 'Spring rolls (3)|5|v']) },
  { id: 'crepes', name: 'Crêpe Corner', category: 'Food', icon: '🥞', fee: 600, tags: ['vegetarian'], text: 'Sweet and savoury crêpes.', cuisine: 'Crêpes', photo: 'Crêpe',
    menu: menuFrom(['Nutella crêpe|6|v', 'Ham & cheese crêpe|7.5|', 'Lemon & sugar crêpe|5|v']) },
  { id: 'beer', name: 'Lisbon Craft Beer', category: 'Drinks', icon: '🍺', fee: 1500, tags: ['alcohol'], text: 'Local craft beer on tap.', cuisine: 'Craft beer', photo: 'Beer',
    menu: menuFrom(['Lager (0.4 l)|4.5|a', 'IPA (0.4 l)|5.5|a', 'Wheat beer (0.4 l)|5|a']) },
  { id: 'cocktails', name: 'Sunset Cocktails', category: 'Drinks', icon: '🍹', fee: 1400, tags: ['alcohol'], text: 'Cocktails and spritzes.', cuisine: 'Cocktails', photo: 'Cocktail',
    menu: menuFrom(['Aperol spritz|8|a', 'Caipirinha|8|a', 'Mojito|8|a']) },
  { id: 'coffee', name: 'Bean There Coffee', category: 'Drinks', icon: '☕', fee: 700, tags: ['alcohol-free', 'vegan'], text: 'Espresso, iced coffee and oat milk.', cuisine: 'Coffee', photo: 'Espresso',
    menu: menuFrom(['Espresso|1.5|vg,af', 'Oat cappuccino|3.5|vg,af', 'Iced coffee|4|v,af']) },
  { id: 'lemonade', name: 'Fresh Squeeze', category: 'Drinks', icon: '🍋', fee: 500, tags: ['alcohol-free', 'vegan'], text: 'Fresh lemonade and juices.', cuisine: 'Lemonade', photo: 'Lemonade',
    menu: menuFrom(['Fresh lemonade|4|vg,af', 'Orange juice|4|vg,af', 'Ginger lemonade|4.5|vg,af']) },
  { id: 'falafel', name: 'Falafel Factory', category: 'Food', icon: '🧆', fee: 750, tags: ['vegan'], text: 'Falafel wraps with hummus and pickles.', cuisine: 'Falafel', photo: 'Falafel',
    menu: menuFrom(['Falafel wrap|8.5|vg,v', 'Hummus & pickles plate|7|vg,v', 'Pita|2|vg,v']) },
  { id: 'bifanas', name: 'Bifana Bros', category: 'Food', icon: '🥪', fee: 850, tags: [], text: 'Portuguese marinated pork sandwiches.', cuisine: 'Portuguese sandwiches', photo: 'Bifana',
    menu: menuFrom(['Bifana|6|', 'Bifana with egg|7|', 'Batatas fritas|3.5|']) },
  { id: 'nata', name: 'Nata Lisboa', category: 'Food', icon: '🥧', fee: 550, tags: ['vegetarian'], text: 'Fresh pastéis de nata, warm from the oven.', cuisine: 'Pastries', photo: 'Pastel de nata',
    menu: menuFrom(['Pastel de nata|1.8|v', 'Box of 6 natas|9.5|v', 'Galão|2.5|v']) },
  { id: 'sushi', name: 'Rolling Sushi', category: 'Food', icon: '🍣', fee: 1000, tags: ['gluten-free'], text: 'Sushi rolls and poke bowls.', cuisine: 'Sushi', photo: 'Sushi',
    menu: menuFrom(['Salmon maki (8)|9|gf', 'Poke bowl|12.5|gf', 'Cucumber maki (8)|7.5|gf']) },
  { id: 'bbq', name: 'Smoke & Fire BBQ', category: 'Food', icon: '🍖', fee: 1300, tags: ['gluten-free'], text: 'Slow-smoked ribs and pulled pork.', cuisine: 'BBQ', photo: 'Barbecue',
    menu: menuFrom(['Smoked ribs|15|gf', 'Pulled pork plate|12|gf', 'Corn on the cob|4|gf']) },
  { id: 'curry', name: 'Curry Club', category: 'Food', icon: '🍛', fee: 900, tags: ['vegan', 'gluten-free'], text: 'Vegetable curries with rice.', cuisine: 'Curry', photo: 'Curry',
    menu: menuFrom(['Chickpea curry & rice|9.5|vg,v,gf', 'Lentil dal & rice|9|vg,v,gf', 'Vegetable samosas (2)|4.5|vg,v']) },
  { id: 'icecream', name: 'Gelato Gang', category: 'Food', icon: '🍦', fee: 600, tags: ['vegetarian', 'gluten-free'], text: 'Italian gelato and sorbet, vegan sorbets included.', cuisine: 'Ice cream', photo: 'Gelato',
    menu: menuFrom(['Gelato, 2 scoops|4.5|v,gf', 'Sorbet, 2 scoops|4.5|v,gf', 'Gelato cup, 3 scoops|6|v,gf']) },
  { id: 'churros', name: 'Churro Loco', category: 'Food', icon: '🍩', fee: 500, tags: ['vegan'], text: 'Churros with chocolate dip.', cuisine: 'Churros', photo: 'Churro',
    menu: menuFrom(['Churros (6) with chocolate|6|vg,v', 'Cinnamon churros|5|vg,v', 'Hot chocolate|3.5|']) },
  { id: 'wine', name: 'Vinho Verde Bar', category: 'Drinks', icon: '🍷', fee: 1200, tags: ['alcohol'], text: 'Portuguese wines and sangria.', cuisine: 'Wine', photo: 'Wine',
    menu: menuFrom(['Vinho verde (glass)|5|a', 'Sangria (glass)|6|a', 'Red wine (glass)|5.5|a']) },
  { id: 'smoothies', name: 'Smoothie Shack', category: 'Drinks', icon: '🥤', fee: 600, tags: ['alcohol-free', 'vegan'], text: 'Fruit smoothies and iced tea.', cuisine: 'Smoothies', photo: 'Smoothie',
    menu: menuFrom(['Mango smoothie|5.5|vg,af', 'Berry smoothie|5.5|vg,af', 'Peach iced tea|3.5|vg,af']) },
  { id: 'kombucha', name: 'Kombucha Kollective', category: 'Drinks', icon: '🧃', fee: 450, tags: ['alcohol-free', 'vegan'], text: 'Craft kombucha and alcohol-free beer.', cuisine: 'Kombucha', photo: 'Kombucha',
    menu: menuFrom(['Ginger kombucha|4.5|vg,af', 'Alcohol-free beer|4|af', 'Craft cola|3|vg,af']) },
  { id: 'sunglasses', name: 'Shade Shop', category: 'Merch', icon: '🕶️', fee: 350, tags: [], text: 'Sunglasses, hats and bucket hats.', cuisine: 'Accessories', photo: '',
    menu: menuFrom(['Sunglasses|15|', 'Bucket hat|18|', 'Sun cream|8|']) },
  { id: 'merch', name: 'Festival Merch', category: 'Merch', icon: '👕', fee: 1100, tags: [], text: 'Official festival shirts and tote bags.', cuisine: 'Festival merch', photo: '',
    menu: menuFrom(['Festival T-shirt|25|', 'Tote bag|12|', 'Hoodie|45|']) },
  { id: 'vinyl', name: 'Wax Records', category: 'Merch', icon: '💿', fee: 400, tags: [], text: 'Vinyl and posters from the line-up.', cuisine: 'Records', photo: '',
    menu: menuFrom(['Lineup poster|15|', 'Vinyl LP|28|', 'Sticker pack|5|']) }
];

// The vendor library (rules/vendor-library.js) adds many more food and drink stands. It is looked up
// when needed, so this file still works on its own (then only the 24 vendors above exist).
function libraryVendors() {
  if (typeof VENDOR_LIBRARY !== 'undefined') return VENDOR_LIBRARY;
  if (typeof module !== 'undefined' && typeof require === 'function') return require('./vendor-library.js').VENDOR_LIBRARY;
  return [];
}
// ——— Your own stands ("Add vendor" on the Vendors page) ———
// Saved per festival under a "festival-" key, so they are part of the festival data of the account.
// Stored as a list of vendors with the same fields as the catalogue (id starts with "c-").
const CUSTOM_VENDORS_KEY = 'festival-architect-custom-vendors';
const MAX_CUSTOM_VENDORS = 50;
const MAX_MENU_ITEMS = 12;
const MAX_VENDOR_FEE = 20000;
const MAX_MENU_PRICE = 500;
const DIET_TAGS = ['vegan', 'vegetarian', 'gluten-free', 'alcohol', 'alcohol-free'];

const vendorText = (value) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '');
const vendorNumber = (value) => (value === '' || value === null || value === undefined || typeof value === 'boolean' ? NaN : Number(value));

// The stand's labels follow its menu, so a stand never claims more than it sells
// (same rule as the vendor library). Vegan dishes count as vegetarian too.
function standTagsFromMenu(menu, category) {
  const has = (tag) => menu.some((m) => m.tags.includes(tag));
  return DIET_TAGS.filter((tag) => has(tag) && (category === 'Drinks' || (tag !== 'alcohol' && tag !== 'alcohol-free')));
}

// Check what someone typed for a new or changed stand. Returns '' when it is fine, otherwise one
// sentence that says what to change. "others" = every other vendor (for the name check).
function customVendorProblem(input, others = []) {
  const value = input && typeof input === 'object' ? input : {};
  const name = vendorText(value.name);
  if (name.length < 2 || name.length > 60) return 'Enter a stand name of 2–60 characters.';
  if (others.some((v) => v.name.toLowerCase() === name.toLowerCase())) return `There is already a stand called “${name}”. Choose another name.`;
  if (!VENDOR_CATEGORIES.includes(value.category)) return 'Choose Food, Drinks or Merch.';
  const cuisine = vendorText(value.cuisine);
  if (cuisine.length < 2 || cuisine.length > 40) return 'Enter the kind of stand (2–40 characters), for example “Tacos” or “Craft beer”.';
  if (vendorText(value.text).length > 200) return 'Keep the description to 200 characters.';
  if (vendorText(value.photo).length > 80) return 'Keep the photo search word to 80 characters.';
  const fee = vendorNumber(value.fee);
  if (!Number.isInteger(fee) || fee < 0 || fee > MAX_VENDOR_FEE) return `Enter the pitch fee as whole euros from €0 to €${MAX_VENDOR_FEE.toLocaleString('en-GB')}.`;
  const menu = Array.isArray(value.menu) ? value.menu : [];
  if (menu.length < 1 || menu.length > MAX_MENU_ITEMS) return `Add 1 to ${MAX_MENU_ITEMS} menu items.`;
  for (const [i, entry] of menu.entries()) {
    const item = vendorText(entry && entry.item);
    const label = `Menu item ${i + 1}`;
    if (item.length < 2 || item.length > 60) return `${label}: enter a name of 2–60 characters.`;
    const price = vendorNumber(entry.price);
    if (!Number.isFinite(price) || price <= 0 || price > MAX_MENU_PRICE) return `${label} (“${item}”): enter a price above €0 and at most €${MAX_MENU_PRICE}.`;
    if (Math.abs(price * 100 - Math.round(price * 100)) > 1e-6) return `${label} (“${item}”): use at most two decimals for the price.`;
    const tags = Array.isArray(entry.tags) ? entry.tags : [];
    if (!tags.every((t) => DIET_TAGS.includes(t))) return `${label} (“${item}”): unknown label.`;
    if (tags.includes('alcohol') && tags.includes('alcohol-free')) return `${label} (“${item}”): a drink cannot contain alcohol and be alcohol-free.`;
    if (tags.includes('alcohol') && value.category !== 'Drinks') return `${label} (“${item}”): only drinks stands can sell alcohol.`;
  }
  return '';
}

// Build the stand from what was typed (only call after customVendorProblem returned '').
function customVendorFrom(input, id) {
  const category = input.category;
  const menu = input.menu.map((entry) => {
    const tags = DIET_TAGS.filter((t) => entry.tags.includes(t) || (t === 'vegetarian' && entry.tags.includes('vegan')));
    return { item: vendorText(entry.item), price: Math.round(vendorNumber(entry.price) * 100) / 100, tags };
  });
  return { id, name: vendorText(input.name), category, icon: '', fee: vendorNumber(input.fee), tags: standTagsFromMenu(menu, category),
    text: vendorText(input.text), cuisine: vendorText(input.cuisine), photo: vendorText(input.photo), menu, custom: true };
}

// "Taco Tribe 2" -> "c-taco-tribe-2"; a number is added when the id is already taken.
function customVendorId(name, takenIds) {
  const base = 'c-' + (vendorText(name).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'stand');
  let id = base;
  for (let n = 2; takenIds.includes(id); n++) id = `${base}-${n}`;
  return id;
}

// Add a stand to the list. Returns { list, vendor, problem }; on a problem the list is unchanged.
function addCustomVendor(list, input) {
  if (list.length >= MAX_CUSTOM_VENDORS) return { list, vendor: null, problem: `You can add at most ${MAX_CUSTOM_VENDORS} own stands.` };
  const everyone = [...list, ...VENDORS, ...libraryVendors()];
  const problem = customVendorProblem(input, everyone);
  if (problem) return { list, vendor: null, problem };
  const vendor = customVendorFrom(input, customVendorId(input.name, everyone.map((v) => v.id)));
  return { list: [...list, vendor], vendor, problem: null };
}

// Change one of your own stands (its id, and so its pitch, stays the same).
function updateCustomVendor(list, id, input) {
  if (!list.some((v) => v.id === id)) return { list, vendor: null, problem: 'This stand no longer exists.' };
  const others = [...list.filter((v) => v.id !== id), ...VENDORS, ...libraryVendors()];
  const problem = customVendorProblem(input, others);
  if (problem) return { list, vendor: null, problem };
  const vendor = customVendorFrom(input, id);
  return { list: list.map((v) => (v.id === id ? vendor : v)), vendor, problem: null };
}

// Delete one of your own stands; if it had a pitch, the pitch becomes free.
function deleteCustomVendor(list, placements, id) {
  const rest = { ...placements };
  delete rest[id];
  return { list: list.filter((v) => v.id !== id), placements: rest };
}

// Read the saved stands back. Broken or doubled entries are dropped instead of crashing the page.
function parseCustomVendors(text) {
  let saved;
  try { saved = JSON.parse(text); } catch { return []; }
  if (!Array.isArray(saved)) return [];
  const result = [];
  for (const entry of saved.slice(0, MAX_CUSTOM_VENDORS)) {
    if (!entry || typeof entry.id !== 'string' || !/^c-[a-z0-9-]{1,60}$/.test(entry.id) || result.some((v) => v.id === entry.id)) continue;
    if (customVendorProblem(entry, result)) continue;
    result.push(customVendorFrom(entry, entry.id));
  }
  return result;
}

// The stands of the open festival, read from this browser (none in the tests unless they set storage).
let customVendorCache = { raw: null, list: [] };
function customVendors() {
  let raw = null;
  try { raw = typeof localStorage !== 'undefined' ? localStorage.getItem(CUSTOM_VENDORS_KEY) : null; } catch { raw = null; }
  if (raw !== customVendorCache.raw) customVendorCache = { raw, list: raw ? parseCustomVendors(raw) : [] };
  return customVendorCache.list;
}

// Every vendor that can be booked: your own stands first, then the 24 original vendors, then the library.
function allVendors() { return [...customVendors(), ...VENDORS, ...libraryVendors()]; }

function findVendor(id) {
  return VENDORS.find((vendor) => vendor.id === id) || customVendors().find((vendor) => vendor.id === id)
    || libraryVendors().find((vendor) => vendor.id === id) || null;
}

// Search and filter the vendors for the Vendors page.
// filters: { query, category, cuisine, diet, maxFee, sort } — every part is optional.
// diet 'vegetarian' also finds vegan stands (vegan food is vegetarian too).
// sort: 'featured' (the original vendors first, as listed), 'name', 'fee-low' or 'fee-high'.
function filterVendors(list, filters = {}) {
  const plain = (text) => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const words = plain(filters.query || '').split(/\s+/).filter(Boolean);
  const maxFee = Number(filters.maxFee) > 0 ? Number(filters.maxFee) : Infinity;
  const fitsDiet = (v) => !filters.diet || v.tags.includes(filters.diet) || (filters.diet === 'vegetarian' && v.tags.includes('vegan'));
  const result = list.filter((v) => (!filters.category || filters.category === 'All' || v.category === filters.category)
    && (!filters.cuisine || v.cuisine === filters.cuisine)
    && fitsDiet(v) && v.fee <= maxFee
    && words.every((w) => plain(`${v.name} ${v.cuisine || ''} ${v.text} ${(v.menu || []).map((m) => m.item).join(' ')}`).includes(w)));
  const byName = (a, b) => a.name.localeCompare(b.name, 'en');
  const sorters = { name: byName, 'fee-low': (a, b) => a.fee - b.fee || byName(a, b), 'fee-high': (a, b) => b.fee - a.fee || byName(a, b) };
  return sorters[filters.sort] ? result.sort(sorters[filters.sort]) : result;
}

// The kinds of stands (Tacos, Craft beer, ...) for the filter, per category and sorted by name.
function vendorCuisines(list, category) {
  return [...new Set(list.filter((v) => !category || category === 'All' || v.category === category).map((v) => v.cuisine).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'en'));
}

// Read the saved placements back. Broken data, unknown vendors, unknown or doubled pitches are dropped.
function parsePlacements(text) {
  let saved;
  try { saved = JSON.parse(text); } catch { return {}; }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
  const result = {};
  Object.entries(saved).forEach(([vendorId, pitch]) => {
    if (findVendor(vendorId) && pitchList(MAX_PITCHES).includes(pitch) && !Object.values(result).includes(pitch)) result[vendorId] = pitch;
  });
  return result;
}

function freePitches(placements, pitchCount = PITCHES.length) {
  const taken = Object.values(placements);
  return pitchList(pitchCount).filter((pitch) => !taken.includes(pitch));
}

// Confirm a vendor on the first free pitch. Returns { placements, problem }:
// problem is null when it worked, otherwise a sentence saying why not (placements then stay unchanged).
function confirmVendor(placements, vendorId, pitchCount = PITCHES.length) {
  const vendor = findVendor(vendorId);
  if (!vendor) return { placements, problem: 'This vendor is not in the catalogue.' };
  if (placements[vendorId]) return { placements, problem: `${vendor.name} is already on pitch ${placements[vendorId]}.` };
  const free = freePitches(placements, pitchCount);
  if (free.length === 0) return { placements, problem: `All ${pitchCount} pitches are taken. Remove a vendor first.` };
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

// When the food court gets smaller, vendors on pitches that no longer exist lose their pitch.
// Returns { placements, removed } with the vendors that were taken off.
function fitPlacements(placements, pitchCount) {
  const allowed = pitchList(pitchCount);
  const removed = Object.keys(placements).filter((id) => !allowed.includes(placements[id])).map(findVendor);
  const kept = Object.fromEntries(Object.entries(placements).filter(([, pitch]) => allowed.includes(pitch)));
  return { placements: kept, removed };
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
    PITCHES, MAX_PITCHES, pitchList, fitPlacements, VENDOR_STORAGE_KEY, VENDOR_CATEGORIES, VENDORS, findVendor, parsePlacements,
    freePitches, confirmVendor, removeVendor, vendorOnPitch, pitchIncome, coverage,
    MENU_TAGS, menuFrom, allVendors, filterVendors, vendorCuisines,
    CUSTOM_VENDORS_KEY, MAX_CUSTOM_VENDORS, MAX_MENU_ITEMS, MAX_VENDOR_FEE, MAX_MENU_PRICE, DIET_TAGS,
    customVendorProblem, addCustomVendor, updateCustomVendor, deleteCustomVendor, parseCustomVendors, customVendors
  };
}
