// Festival backdrop on the Overview (feature-plans/festival-backdrop.md).
// Pure rules: which mood (colours, tempo) and which landscape fit a festival.
// No screen code here; overview-backdrop.js draws the animated stage from this.

// Colours and tempo per mood: sky from top to horizon, sun/moon, two laser colours,
// silhouettes, and the beat (beats per minute) the crowd and lights move to.
const BACKDROP_MOODS = {
  neon: { label: 'Neon nights', sky: ['#0b0020', '#3a0ca3', '#f72585'], sun: '#4cc9f0', lasers: ['#4cc9f0', '#f72585'], shade: '#07010f', bpm: 128 },
  ember: { label: 'Rock & fire', sky: ['#120505', '#6a040f', '#f48c06'], sun: '#ffba08', lasers: ['#ffba08', '#ff3d00'], shade: '#0a0404', bpm: 140 },
  gold: { label: 'Golden hour', sky: ['#0a1626', '#8d5524', '#f6bd60'], sun: '#ffe8a3', lasers: ['#ffd166', '#ff9f1c'], shade: '#081019', bpm: 92 },
  heat: { label: 'Hot beats', sky: ['#1a0033', '#9d0208', '#ffb703'], sun: '#ffd60a', lasers: ['#ffd60a', '#ff006e'], shade: '#0f001f', bpm: 100 },
  dusk: { label: 'Golden dusk', sky: ['#14303f', '#ef8354', '#ffd6a5'], sun: '#fff1c1', lasers: ['#ffd6a5', '#90e0ef'], shade: '#0d1f28', bpm: 84 },
  candy: { label: 'Pop dream', sky: ['#2a004a', '#ff4d9d', '#ffd166'], sun: '#fff3b0', lasers: ['#ff8fd8', '#7df9ff'], shade: '#1a0030', bpm: 120 },
  sunset: { label: 'Festival sunset', sky: ['#12202a', '#ff684c', '#ffd29d'], sun: '#fff0c9', lasers: ['#ffd29d', '#ff684c'], shade: '#0b171c', bpm: 112 }
};

// Checked in this order: "Pop rock" is rock, "Dance pop" is pop, "Indie dance" is electronic.
const BACKDROP_GENRE_MOODS = [
  ['ember', ['metal', 'punk', 'rock', 'grunge', 'hardcore']],
  ['gold', ['jazz', 'blues', 'soul', 'r&b', 'funk', 'gospel', 'swing']],
  ['heat', ['hip-hop', 'hip hop', 'rap', 'trap', 'afro', 'reggaeton', 'latin', 'dancehall', 'reggae', 'global']],
  ['dusk', ['folk', 'country', 'fado', 'acoustic', 'classical', 'singer-songwriter', 'americana']],
  ['candy', ['pop']],
  ['neon', ['electronic', 'electronica', 'techno', 'house', 'trance', 'edm', 'dance', 'drum', 'dubstep', 'ambient', 'disco']]
];

function backdropMoodForGenre(genre) {
  const text = String(genre || '').toLowerCase();
  if (!text) return '';
  const match = BACKDROP_GENRE_MOODS.find(([, words]) => words.some(word => text.includes(word)));
  return match ? match[0] : '';
}

// The mood of the festival: the most common mood among the booked performances; with none
// booked, among the artists in the catalogue. Ties go to the mood listed first above.
function festivalMood(artists = [], bookings = []) {
  const artistById = new Map((Array.isArray(artists) ? artists : []).filter(a => a && a.id).map(a => [a.id, a]));
  const booked = (Array.isArray(bookings) ? bookings : [])
    .filter(b => b && b.artistId && artistById.has(b.artistId))
    .map(b => artistById.get(b.artistId));
  const source = booked.length ? booked : [...artistById.values()];
  const counts = new Map();
  source.forEach(artist => {
    const mood = backdropMoodForGenre(artist.genre);
    if (mood) counts.set(mood, (counts.get(mood) || 0) + 1);
  });
  let best = 'sunset', bestCount = 0;
  BACKDROP_GENRE_MOODS.forEach(([mood]) => {
    if ((counts.get(mood) || 0) > bestCount) { best = mood; bestCount = counts.get(mood); }
  });
  return best;
}

const BACKDROP_SCENE_WORDS = [
  ['mountains', ['munich', 'münchen', 'muenchen', 'zurich', 'zürich', 'zuerich', 'alps', 'alpen', 'alpine', 'innsbruck', 'salzburg', 'geneva', 'genf', 'bern', 'mountain', 'berg', 'ski', 'tirol', 'tyrol', 'dolomit']],
  ['coast', ['lisbon', 'lisboa', 'porto', 'cascais', 'algarve', 'tejo', 'beach', 'praia', 'playa', 'coast', 'costa', 'sea', 'ocean', 'harbour', 'harbor', 'bay', 'island', 'barcelona', 'nice', 'marseille', 'sylt', 'strand', 'meer', 'see', 'lake']],
  ['field', ['park', 'field', 'farm', 'forest', 'wood', 'meadow', 'wiese', 'countryside', 'valley', 'garden', 'green']]
];

// The landscape for a venue: mountains, coast, field (hills) or city (the default).
function festivalScene(venue) {
  const text = String(venue || '').toLowerCase();
  const words = text.split(/[^a-z0-9äöüßéèêáàâíóúçãõñ&-]+/).filter(Boolean);
  const has = word => word.includes(' ') ? text.includes(word) : words.includes(word) || (word.length > 4 && text.includes(word));
  const match = BACKDROP_SCENE_WORDS.find(([, list]) => list.some(has));
  return match ? match[0] : 'city';
}

// A small seeded random generator, so one festival always gets the same picture.
function backdropSeed(text) {
  let hash = 2166136261;
  for (const char of String(text || '')) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}
function backdropRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Everything the Overview needs to draw the stage: mood, landscape, seed, colours, tempo.
function festivalBackdrop({ name = '', venue = '', artists = [], bookings = [] } = {}) {
  const mood = festivalMood(artists, bookings);
  const scene = festivalScene(venue);
  const seed = backdropSeed(`${name}|${venue}`);
  const colours = BACKDROP_MOODS[mood];
  return { mood, scene, seed, label: colours.label, bpm: colours.bpm, colours, key: `${mood}|${scene}|${seed}` };
}

if (typeof module !== 'undefined') {
  module.exports = { BACKDROP_MOODS, backdropMoodForGenre, festivalMood, festivalScene, backdropSeed, backdropRandom, festivalBackdrop };
}
