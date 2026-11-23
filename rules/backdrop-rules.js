// Festival backdrop on the Overview (feature-plans/festival-backdrop.md).
// Pure rules: which mood (colours) and which landscape fit a festival, and the SVG picture.
// No screen code here. User text (festival name, venue) never goes into the SVG.

// Colours per mood: sky from top to horizon, sun, light beams, silhouettes.
const BACKDROP_MOODS = {
  neon: { label: 'Neon nights', sky: ['#12002b', '#3a0ca3', '#f72585'], sun: '#4cc9f0', beam: '#4cc9f0', shade: '#0b0318' },
  ember: { label: 'Rock & fire', sky: ['#160707', '#6a040f', '#f48c06'], sun: '#ffba08', beam: '#ffd166', shade: '#0d0505' },
  gold: { label: 'Golden hour', sky: ['#0d1b2a', '#8d5524', '#f6bd60'], sun: '#ffe8a3', beam: '#f6bd60', shade: '#0a1420' },
  heat: { label: 'Hot beats', sky: ['#240046', '#9d0208', '#ffb703'], sun: '#ffd60a', beam: '#ff9e00', shade: '#14002a' },
  dusk: { label: 'Golden dusk', sky: ['#1b3a4b', '#ef8354', '#ffd6a5'], sun: '#fff1c1', beam: '#ffe5b4', shade: '#13262f' },
  candy: { label: 'Pop dream', sky: ['#3d0066', '#ff4d9d', '#ffd166'], sun: '#fff3b0', beam: '#ffc6e0', shade: '#23003b' },
  sunset: { label: 'Festival sunset', sky: ['#17272b', '#ff684c', '#ffd29d'], sun: '#fff0c9', beam: '#ffe1d6', shade: '#102024' }
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

// Everything the Overview needs: mood, landscape, caption and the SVG text.
function festivalBackdrop({ name = '', venue = '', artists = [], bookings = [] } = {}) {
  const mood = festivalMood(artists, bookings);
  const scene = festivalScene(venue);
  const seed = backdropSeed(`${name}|${venue}`);
  return { mood, scene, seed, label: BACKDROP_MOODS[mood].label, key: `${mood}|${scene}|${seed}`,
    svg: backdropSvg({ mood, scene, seed }) };
}

function backdropSvg({ mood = 'sunset', scene = 'city', seed = 1 } = {}) {
  const colours = BACKDROP_MOODS[mood] || BACKDROP_MOODS.sunset;
  const rnd = backdropRandom(seed);
  const W = 1200, H = 300, horizon = 222;
  const r = (min, max) => min + rnd() * (max - min);
  const n = value => Math.round(value * 10) / 10;
  const parts = [];

  parts.push(`<defs>
<linearGradient id="bd-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${colours.sky[0]}"/><stop offset=".62" stop-color="${colours.sky[1]}"/><stop offset="1" stop-color="${colours.sky[2]}"/></linearGradient>
<radialGradient id="bd-glow"><stop offset="0" stop-color="${colours.sun}" stop-opacity=".75"/><stop offset="1" stop-color="${colours.sun}" stop-opacity="0"/></radialGradient>
<linearGradient id="bd-beam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${colours.beam}" stop-opacity=".55"/><stop offset="1" stop-color="${colours.beam}" stop-opacity="0"/></linearGradient>
</defs>`);
  parts.push(`<rect width="${W}" height="${H}" fill="url(#bd-sky)"/>`);

  // Stars in the upper sky.
  const stars = [];
  for (let i = 0; i < 46; i++) stars.push(`<circle cx="${n(r(0, W))}" cy="${n(r(6, 120))}" r="${n(r(.6, 1.8))}" opacity="${n(r(.25, .9))}"/>`);
  parts.push(`<g fill="#ffffff">${stars.join('')}</g>`);

  // Sun or moon with a glow, away from the stage in the middle.
  const sunX = n(rnd() < .5 ? r(150, 400) : r(800, 1050)), sunY = n(r(150, 185));
  parts.push(`<circle cx="${sunX}" cy="${sunY}" r="150" fill="url(#bd-glow)"/><circle cx="${sunX}" cy="${sunY}" r="${n(r(42, 58))}" fill="${colours.sun}" opacity=".95"/>`);

  // Light beams from the stage (they sway with CSS; the class is the hook).
  const beams = [];
  [-34, -16, 0, 16, 34].forEach((angle, i) => {
    const spread = 46;
    beams.push(`<g transform="rotate(${angle} 600 236)"><polygon class="bd-beam bd-beam-${i}" points="600,236 ${600 - spread},-20 ${600 + spread},-20" fill="url(#bd-beam)"/></g>`);
  });
  parts.push(`<g opacity=".8">${beams.join('')}</g>`);

  // The landscape behind the stage.
  parts.push(backdropScene(scene, colours, r, n, W, H, horizon, rnd));

  // The stage: roof, truss, speakers.
  parts.push(`<g fill="${colours.shade}">
<rect x="470" y="200" width="260" height="10"/><rect x="474" y="210" width="8" height="58"/><rect x="718" y="210" width="8" height="58"/>
<path d="M462 200 L600 176 L738 200 Z"/><rect x="452" y="232" width="22" height="40"/><rect x="726" y="232" width="22" height="40"/>
<rect x="482" y="254" width="236" height="18"/></g>`);
  parts.push(`<g fill="${colours.sun}" opacity=".9"><circle cx="520" cy="214" r="3"/><circle cx="560" cy="214" r="3"/><circle cx="640" cy="214" r="3"/><circle cx="680" cy="214" r="3"/></g>`);

  // The crowd: heads and some raised arms along the bottom.
  const crowd = [];
  for (let x = -6; x < W + 10; x += r(13, 19)) {
    const y = r(280, 292), size = r(6.5, 9.5);
    crowd.push(`<circle cx="${n(x)}" cy="${n(y)}" r="${n(size)}"/><rect x="${n(x - size)}" y="${n(y + size * .6)}" width="${n(size * 2)}" height="${n(H - y)}" rx="${n(size * .8)}"/>`);
    if (rnd() < .22) {
      const side = rnd() < .5 ? -1 : 1;
      crowd.push(`<path d="M${n(x + side * size * .6)} ${n(y + 4)} L${n(x + side * (size + r(6, 12)))} ${n(y - r(16, 28))}" stroke="${colours.shade}" stroke-width="3.2" stroke-linecap="round"/>`);
    }
  }
  parts.push(`<g fill="${colours.shade}">${crowd.join('')}</g>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" focusable="false" aria-hidden="true">${parts.join('')}</svg>`;
}

function backdropScene(scene, colours, r, n, W, H, horizon, rnd) {
  if (scene === 'coast') {
    const waves = [];
    for (let i = 0; i < 4; i++) {
      const y = horizon + 10 + i * 13, amp = 3 + i, len = r(70, 110);
      let d = `M0 ${n(y)}`;
      for (let x = 0; x <= W; x += len) d += ` Q${n(x + len / 4)} ${n(y - amp)} ${n(x + len / 2)} ${n(y)} T${n(x + len)} ${n(y)}`;
      waves.push(`<path d="${d}" fill="none" stroke="${colours.sun}" stroke-width="${n(2.2 - i * .3)}" opacity="${n(.55 - i * .1)}"/>`);
    }
    return `<rect x="0" y="${horizon}" width="${W}" height="${H - horizon}" fill="${colours.shade}" opacity=".55"/>${waves.join('')}`;
  }
  if (scene === 'mountains') {
    const ridge = (base, low, high, step, opacity) => {
      let d = `M0 ${base}`, x = 0;
      while (x < W) { x += r(step * .6, step * 1.4); d += ` L${n(Math.min(x, W))} ${n(base - r(low, high))}`; x += r(step * .4, step); d += ` L${n(Math.min(x, W))} ${n(base - r(low * .3, low))}`; }
      return `<path d="${d} L${W} ${H} L0 ${H} Z" fill="${colours.shade}" opacity="${opacity}"/>`;
    };
    return ridge(horizon + 6, 40, 110, 120, .45) + ridge(horizon + 22, 20, 60, 90, .8);
  }
  if (scene === 'field') {
    const hills = [];
    [[horizon + 4, .45, 30], [horizon + 20, .8, 20]].forEach(([base, opacity, height]) => {
      let d = `M0 ${base}`;
      for (let x = 0; x < W; x += 300) d += ` Q${n(x + 150)} ${n(base - r(height * .5, height * 1.6))} ${n(x + 300)} ${n(base)}`;
      hills.push(`<path d="${d} L${W} ${H} L0 ${H} Z" fill="${colours.shade}" opacity="${opacity}"/>`);
    });
    // Trees stand between the far and the near hills, so their feet are hidden.
    const trees = [];
    for (let i = 0; i < 9; i++) {
      const x = rnd() < .5 ? r(20, 420) : r(780, 1180), h = r(26, 48), y = horizon + 24;
      trees.push(`<path d="M${n(x)} ${n(y - h)} L${n(x - h * .32)} ${n(y)} L${n(x + h * .32)} ${n(y)} Z"/>`);
    }
    return hills[0] + `<g fill="${colours.shade}" opacity=".7">${trees.join('')}</g>` + hills[1];
  }
  // City skyline with a few lit windows.
  const blocks = [], windows = [];
  for (let x = -10; x < W; ) {
    const w = r(34, 78), h = r(40, 118);
    if (x + w < 430 || x > 770 || h < 70) {
      blocks.push(`<rect x="${n(x)}" y="${n(horizon + 26 - h)}" width="${n(w)}" height="${n(h + 60)}"/>`);
      for (let i = 0; i < 4; i++) if (rnd() < .6) windows.push(`<rect x="${n(x + r(4, w - 10))}" y="${n(horizon + 26 - h + r(8, h - 14))}" width="4" height="5"/>`);
    }
    x += w + r(2, 10);
  }
  return `<g fill="${colours.shade}" opacity=".7">${blocks.join('')}</g><g fill="${colours.sun}" opacity=".55">${windows.join('')}</g>`;
}

if (typeof module !== 'undefined') {
  module.exports = { BACKDROP_MOODS, backdropMoodForGenre, festivalMood, festivalScene, backdropSeed, festivalBackdrop, backdropSvg };
}
