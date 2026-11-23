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
  ['heat', ['hip-hop', 'hip hop', 'rap', 'trap', 'afro', 'reggaeton', 'latin', 'dancehall', 'reggae', 'global', 'grime', 'drill', 'amapiano', 'kuduro', 'bachata', 'salsa', 'cumbia', 'corridos', 'axé', 'samba', 'bongo flava', 'mbalax', 'brazilian bass']],
  ['dusk', ['folk', 'country', 'fado', 'acoustic', 'classical', 'singer-songwriter', 'americana', 'kora', 'mpb', 'film music', 'cape verdean', 'sitar', 'flamenco']],
  ['candy', ['pop']],
  ['neon', ['electronic', 'electronica', 'techno', 'house', 'trance', 'edm', 'dance', 'drum', 'dubstep', 'ambient', 'disco', 'electro', 'big beat', 'future bass', 'uk bass', 'minimal', 'downtempo', 'trip hop']]
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
  ['coast', ['sydney', 'san francisco', 'lisbon', 'lisboa', 'lissabon', 'porto', 'cascais', 'algarve', 'tejo', 'beach', 'praia', 'playa', 'coast', 'costa', 'sea', 'ocean', 'harbour', 'harbor', 'bay', 'island', 'barcelona', 'marseille', 'sylt', 'strand', 'meer', 'lake']],
  ['field', ['park', 'field', 'farm', 'forest', 'wood', 'meadow', 'wiese', 'countryside', 'valley', 'garden', 'green']]
];

// Does the venue name one of these words? Short words must stand alone ("sea" is not "Seattle");
// with wholeWords, every word must ("Parisian" is not "Paris").
function venueMatch(venue, table, wholeWords = false) {
  const text = String(venue || '').toLowerCase();
  const words = text.split(/[^a-z0-9äöüßéèêáàâíóúçãõñ&]+/).filter(Boolean);
  const phrase = ` ${words.join(' ')} `;
  const has = word => word.includes(' ') ? phrase.includes(` ${word} `)
    : words.includes(word) || (!wholeWords && word.length > 4 && text.includes(word));
  const match = table.find(([, list]) => list.some(has));
  return match ? match[0] : '';
}

// The landscape for a venue: mountains, coast, field (hills) or city (the default).
function festivalScene(venue) {
  return venueMatch(venue, BACKDROP_SCENE_WORDS) || 'city';
}

// A famous landmark for well-known cities, drawn next to the stage ('' = none).
const BACKDROP_CLASSIC_LANDMARKS = [
  ['eiffel', ['paris']],
  ['bigben', ['london']],
  ['bridge', ['lisbon', 'lisboa', 'san francisco', 'lissabon']],
  ['frauenkirche', ['munich', 'münchen', 'muenchen']],
  ['fernsehturm', ['berlin']],
  ['colosseum', ['rome', 'roma', 'rom']],
  ['sagrada', ['barcelona']],
  ['empire', ['new york', 'nyc', 'manhattan', 'brooklyn']],
  ['opera', ['sydney']],
  ['riesenrad', ['vienna', 'wien']],
  ['canals', ['amsterdam']],
  ['burj', ['dubai']]
];

// 100 more cities. Each city has its own colours and details, but they share a few shapes
// (needle, spires, dome, onion, castle, skyline, pagoda, pyramid, temple, arch, peak),
// which overview-backdrop-cities.js draws. [key, words that name the city, style].
const BACKDROP_CITY_LANDMARKS = (() => {
  const N = (light, dark, extra) => ({ shape: 'needle', light, dark, ...extra });
  const S = (light, dark, extra) => ({ shape: 'spires', light, dark, ...extra });
  const D = (light, dark, extra) => ({ shape: 'dome', light, dark, ...extra });
  const O = (light, dark, extra) => ({ shape: 'onion', light, dark, ...extra });
  const C = (light, dark, extra) => ({ shape: 'castle', light, dark, ...extra });
  const K = (light, dark, accent, extra) => ({ shape: 'skyline', light, dark, accent, ...extra });
  const P = (light, dark, extra) => ({ shape: 'pagoda', light, dark, ...extra });
  const Y = (light, dark, extra) => ({ shape: 'pyramid', light, dark, ...extra });
  const A = (light, dark, extra) => ({ shape: 'arch', light, dark, ...extra });
  const M = (light, dark, extra) => ({ shape: 'peak', light, dark, ...extra });
  return [
  // Needles and towers
  ['tokyo', ['tokyo', 'tokio'], N('#cfe3ff', '#5c7fb8', { pods: 2, w: 0.018 })],
  ['toronto', ['toronto'], N('#e6e9f0', '#7a8493', { pods: 1, w: 0.022 })],
  ['seattle', ['seattle'], N('#f3ecdc', '#8d8575', { saucer: true, h: 0.8 })],
  ['auckland', ['auckland'], N('#d9e0ea', '#6d7a8c', { pods: 1, h: 0.95 })],
  ['kualalumpur', ['kuala lumpur'], N('#e8eef7', '#6a7f99', { pods: 1 })],
  ['dallas', ['dallas'], N('#e8e2ff', '#6a5fa8', { pods: 1, h: 0.85 })],
  ['guangzhou', ['guangzhou', 'canton'], N('#d7f3ee', '#3f8f86', { pods: 0, w: 0.03 })],
  ['dublin', ['dublin'], N('#e8eef5', '#8a97a8', { pods: 0, w: 0.012 })],
  ['buenosaires', ['buenos aires'], N('#f1efe6', '#9a968a', { pods: 0, w: 0.03, h: 0.9 })],
  ['shanghai', ['shanghai'], N('#ffc4e1', '#c0397f', { pods: 3, w: 0.022 })],
  // Cathedrals and church towers
  ['cologne', ['cologne', 'köln', 'koeln'], S('#b9b3a8', '#4c4a46', { towers: [[-0.11, 0.8, 0.065], [0.11, 0.8, 0.065]], roofH: 5 })],
  ['milan', ['milan', 'milano', 'mailand'], S('#fff3e0', '#c9b79c', { towers: [[-0.2, 0.5, 0.03], [-0.1, 0.62, 0.03], [0, 0.85, 0.035], [0.1, 0.62, 0.03], [0.2, 0.5, 0.03]], roofH: 5 })],
  ['zurich', ['zurich', 'zürich', 'zuerich'], S('#e9e1cf', '#8a7f68', { towers: [[-0.1, 0.62, 0.065], [0.1, 0.62, 0.065]], roof: '#6aa58f', roofH: 2 })],
  ['strasbourg', ['strasbourg', 'straßburg'], S('#e9a07a', '#9a4f35', { towers: [[0.1, 1, 0.06]], roofH: 7 })],
  ['antwerp', ['antwerp', 'antwerpen'], S('#e6d7bd', '#8c7a5a', { towers: [[-0.05, 0.95, 0.07]], roofH: 6 })],
  ['brussels', ['brussels', 'bruxelles', 'brüssel'], S('#f0d9a0', '#a98a3d', { towers: [[0, 1, 0.045]], roofH: 8 })],
  ['bruges', ['bruges', 'brugge'], S('#d99a6d', '#85472b', { towers: [[0, 0.8, 0.09]], flat: true })],
  ['gdansk', ['gdansk', 'danzig'], S('#d98f6d', '#7e3b2a', { towers: [[-0.09, 0.62, 0.07], [0.12, 0.8, 0.045]], roofH: 4 })],
  ['krakow', ['krakow', 'kraków', 'cracow', 'krakau'], S('#d8a67a', '#85502f', { towers: [[-0.12, 0.9, 0.06], [0.12, 0.7, 0.055]], roof: '#3f7f6c', roofH: 3 })],
  ['riga', ['riga'], S('#e7c9a0', '#8f6b3f', { towers: [[0, 1, 0.04]], roof: '#3d8a7a', roofH: 8 })],
  ['copenhagen', ['copenhagen', 'kopenhagen'], S('#e0b78a', '#855a32', { towers: [[0, 0.9, 0.05]], roof: '#3aa085', roofH: 5, noNave: true })],
  ['stockholm', ['stockholm'], S('#e8b28a', '#a35a3c', { towers: [[0.05, 0.85, 0.055]], roof: '#4b8c7c', roofH: 4 })],
  ['hamburg', ['hamburg'], S('#e6c69a', '#8c6a40', { towers: [[0, 0.9, 0.06]], roof: '#52b69a', roofH: 4.5 })],
  ['seville', ['seville', 'sevilla'], S('#f0c58a', '#a56d2f', { towers: [[0, 0.95, 0.07]], roof: '#d8a24b', roofH: 2, noNave: true })],
  ['marrakech', ['marrakech', 'marrakesh', 'marrakesch'], S('#e8a773', '#a05a2e', { towers: [[0, 1, 0.065]], flat: true, noNave: true })],
  ['reykjavik', ['reykjavik', 'reykjavík'], S('#f1f4f8', '#8a96a8', { towers: [[0, 1, 0.04]], roofH: 3, wings: true })],
  ['pisa', ['pisa'], S('#fbf2e0', '#b9a88a', { towers: [[0, 0.82, 0.075]], lean: 0.09, tiers: 6, flat: true, noNave: true })],
  // Domes and minarets
  ['florence', ['florence', 'firenze', 'florenz'], D('#f1e4cd', '#8c7a5f', { domeLight: '#e0663d', domeDark: '#8f2f1a', r: 0.19, h: 0.3, tower: 1 })],
  ['budapest', ['budapest'], D('#f2e4c8', '#8b7650', { domeLight: '#d8c9a8', domeDark: '#7a6a4d', r: 0.12, h: 0.3, minarets: 2, baseW: 0.44 })],
  ['washington', ['washington'], D('#fbfbfb', '#9aa1ad', { domeLight: '#fbfbfb', domeDark: '#9aa1ad', r: 0.14, h: 0.3, baseW: 0.44 })],
  ['istanbul', ['istanbul'], D('#f0d9b4', '#8f7550', { domeLight: '#cfd6e0', domeDark: '#6a7586', r: 0.22, h: 0.26, minarets: 4 })],
  ['jerusalem', ['jerusalem'], D('#7fb2d9', '#2f5f8a', { domeLight: '#ffd75a', domeDark: '#b8860b', r: 0.16, h: 0.26, baseW: 0.26 })],
  ['abudhabi', ['abu dhabi'], D('#fbfaf6', '#a9a79d', { domeLight: '#fbfaf6', domeDark: '#a9a79d', r: 0.14, h: 0.2, small: 4, minarets: 4 })],
  ['helsinki', ['helsinki'], D('#f4f6f7', '#a6b0b6', { domeLight: '#6fc2a4', domeDark: '#2e7d63', r: 0.15, h: 0.24, small: 4, baseW: 0.34 })],
  ['dresden', ['dresden'], D('#e3d3b4', '#7d6a4a', { domeLight: '#9aa9a0', domeDark: '#4a5750', r: 0.17, h: 0.38, baseW: 0.3 })],
  ['venice', ['venice', 'venezia', 'venedig'], D('#f3e3c2', '#9c845a', { domeLight: '#d9e2e6', domeDark: '#6f8794', r: 0.12, h: 0.18, small: 4, tower: -1, baseW: 0.32 })],
  ['valletta', ['valletta'], D('#f0dcb4', '#9a8052', { domeLight: '#c9d3d6', domeDark: '#5f7378', r: 0.15, h: 0.28, baseW: 0.34, tower: 1 })],
  ['havana', ['havana', 'habana'], D('#f6f1e4', '#a39a85', { domeLight: '#e8eef3', domeDark: '#8896a6', r: 0.13, h: 0.28, baseW: 0.42 })],
  // Onion domes
  ['moscow', ['moscow', 'moskau'], O('#f3dcc0', '#9a6b3d', { tent: true, domes: [[-0.2, 0.34, 0.07, '#4fc08a', '#1f7a55'], [0.2, 0.34, 0.07, '#f2c54a', '#b9831d'], [-0.1, 0.28, 0.055, '#e05a4f', '#962a22'], [0.1, 0.28, 0.055, '#4a8fd6', '#1f4f8f']] })],
  ['stpetersburg', ['saint petersburg', 'st petersburg', 'sankt petersburg'], O('#e7d6c6', '#8c6a55', { tent: true, domes: [[-0.22, 0.3, 0.07, '#7ad0e8', '#2f7f99'], [0.22, 0.3, 0.07, '#f5b04f', '#b36a18'], [0, 0.5, 0.075, '#e9573f', '#8f2316']] })],
  ['kyiv', ['kyiv', 'kiev', 'kiew'], O('#f4f1e6', '#a39d8a', { domes: [[-0.22, 0.34, 0.06, '#ffd75a', '#b98a14'], [0, 0.48, 0.08, '#ffd75a', '#b98a14'], [0.22, 0.34, 0.06, '#ffd75a', '#b98a14']] })],
  ['sofia', ['sofia'], O('#f2eadc', '#a79a82', { domes: [[-0.18, 0.3, 0.06, '#ffd75a', '#b98a14'], [0.08, 0.46, 0.1, '#ffd75a', '#b98a14'], [0.26, 0.3, 0.05, '#53b28d', '#1f7457']] })],
  // Castles
  ['prague', ['prague', 'praha', 'prag'], C('#e9d9bd', '#85704d', { hill: true, roof: '#3e8f7a', towers: [[-0.34, 0.3, 0.05], [-0.1, 0.5, 0.06], [0.12, 0.8, 0.065], [0.36, 0.4, 0.05]] })],
  ['edinburgh', ['edinburgh'], C('#cfc7bb', '#4f4a44', { hill: true, roof: '#4f4a44' })],
  ['salzburg', ['salzburg'], C('#f0e6d2', '#8f7d5f', { hill: true, roof: '#b4503e' })],
  ['bratislava', ['bratislava'], C('#fbf7ee', '#aaa293', { hill: true, roof: '#c8573f', towers: [[-0.36, 0.5, 0.05], [-0.12, 0.5, 0.05], [0.12, 0.5, 0.05], [0.36, 0.5, 0.05]] })],
  ['heidelberg', ['heidelberg'], C('#e0a487', '#8a4a35', { hill: true, roof: '#8a4a35' })],
  ['nuremberg', ['nuremberg', 'nürnberg', 'nuernberg'], C('#e6c9a0', '#8a6a42', { hill: true, roof: '#b24f3a' })],
  ['tallinn', ['tallinn'], C('#e9dcc4', '#85745a', { roof: '#a8443a', towers: [[-0.38, 0.45, 0.04], [-0.2, 0.7, 0.045], [0, 0.55, 0.04], [0.2, 0.75, 0.045], [0.38, 0.45, 0.04]] })],
  ['dubrovnik', ['dubrovnik'], C('#efd9b4', '#9a7c4d', { hill: true, roof: '#cf6a43' })],
  ['luxembourg', ['luxembourg', 'luxemburg'], C('#dcd5c7', '#6f685a', { hill: true, roof: '#4a6a7a' })],
  ['cardiff', ['cardiff'], C('#e2d3b8', '#7f6c4b', { roof: '#6f5a46' })],
  ['granada', ['granada'], C('#f0b98a', '#9b5a33', { hill: true, roof: '#c8643f', towers: [[-0.36, 0.34, 0.06], [-0.1, 0.46, 0.06], [0.14, 0.38, 0.06], [0.38, 0.5, 0.05]] })],
  // Skylines
  ['chicago', ['chicago'], K('#a9c3e8', '#2c3f66', '#ffe08a', { crown: 'antenna', tall: 1 })],
  ['houston', ['houston'], K('#c7d2e8', '#34425f', '#ffd27a', { crown: 'spire' })],
  ['miami', ['miami'], K('#ffb3d1', '#8f3d73', '#7dfcf0', { crown: 'spire', tall: 0.7 })],
  ['losangeles', ['los angeles'], K('#ffc58a', '#8a4a3a', '#fff0b3', { crown: 'stack', tall: 0.75 })],
  ['sandiego', ['san diego'], K('#9fd1e8', '#2f5b74', '#fff0b3', { crown: 'spire', tall: 0.6 })],
  ['boston', ['boston'], K('#b8c9de', '#3a4960', '#ffe29a', { crown: 'spire', tall: 0.75 })],
  ['philadelphia', ['philadelphia'], K('#cbd5e0', '#3f4b5e', '#ffe29a', { crown: 'spire', tall: 0.8 })],
  ['atlanta', ['atlanta'], K('#d6c6e8', '#4a3a66', '#ffd9a0', { crown: 'antenna', tall: 0.85 })],
  ['denver', ['denver'], K('#c3d6e8', '#3a4f66', '#ffe29a', { crown: 'spire', tall: 0.65 })],
  ['austin', ['austin'], K('#e8d0b0', '#6a4a30', '#ffd27a', { crown: 'spire', tall: 0.6 })],
  ['neworleans', ['new orleans'], K('#d7b3e8', '#5a3a73', '#ffd27a', { crown: 'spire', tall: 0.55 })],
  ['hongkong', ['hong kong', 'hongkong'], K('#a3e1ff', '#1f4a80', '#ff9ad1', { crown: 'antenna', tall: 1.05 })],
  ['singapore', ['singapore', 'singapur'], K('#a8f0d6', '#1f6a66', '#fff0a0', { crown: 'stack', tall: 0.9 })],
  ['seoul', ['seoul'], K('#c9d9ff', '#3a4a8a', '#ffe3a0', { crown: 'antenna', tall: 0.9 })],
  ['taipei', ['taipei', 'taipeh'], K('#a6e8b8', '#2a6a4a', '#fff0a0', { crown: 'stack', tall: 1 })],
  ['shenzhen', ['shenzhen'], K('#c0d8ff', '#34508a', '#7df0ff', { crown: 'antenna', tall: 0.95 })],
  ['doha', ['doha'], K('#e8d2b0', '#7a5a38', '#ffe2a0', { crown: 'spire', tall: 0.8 })],
  ['riyadh', ['riyadh'], K('#f0d6a8', '#8a6a3a', '#ffe9b0', { crown: 'stack', tall: 0.85 })],
  ['telaviv', ['tel aviv'], K('#fbe9d2', '#9a7a58', '#ffd9a0', { crown: 'spire', tall: 0.7 })],
  ['johannesburg', ['johannesburg'], K('#e8c9a6', '#7a4f33', '#ffe0a0', { crown: 'antenna', tall: 0.8 })],
  ['saopaulo', ['sao paulo', 'são paulo'], K('#d9d9e8', '#4a4a6a', '#ffe3a0', { crown: 'antenna', tall: 0.9 })],
  ['santiago', ['santiago'], K('#cfe0f0', '#3a5570', '#ffe3a0', { crown: 'antenna', tall: 0.95 })],
  ['frankfurt', ['frankfurt'], K('#bfd4ee', '#33496e', '#ffe29a', { crown: 'spire', tall: 0.9 })],
  ['rotterdam', ['rotterdam'], K('#c2d8e8', '#36506a', '#ffe29a', { crown: 'spire', tall: 0.75 })],
  ['warsaw', ['warsaw', 'warszawa', 'warschau'], K('#e2d2c0', '#6a523f', '#ffe0a0', { crown: 'spire', tall: 0.8 })],
  ['madrid', ['madrid'], K('#f0cfa8', '#8a5a3a', '#ffe0a0', { crown: 'stack', tall: 0.75 })],
  ['vancouver', ['vancouver'], K('#a8dcea', '#2a5e70', '#fff0a8', { crown: 'spire', tall: 0.7 })],
  ['melbourne', ['melbourne'], K('#d0c0f0', '#4a3a80', '#ffe29a', { crown: 'spire', tall: 0.85 })],
  // Pagodas, temples and pyramids
  ['kyoto', ['kyoto'], P('#e8503f', '#8f1f14', { tiers: 5, roof: '#3a2a26', torii: true })],
  ['osaka', ['osaka'], P('#f6f1e4', '#a9a08c', { tiers: 5, roof: '#3d7a66', bw0: 0.2 })],
  ['beijing', ['beijing', 'peking'], P('#e8503f', '#8f1f14', { tiers: 3, roof: '#2a5fb0', bw0: 0.2 })],
  ['bangkok', ['bangkok'], P('#f7efe0', '#b7a88a', { prang: true })],
  ['xian', ['xian', 'xi an'], P('#d9b48a', '#7e5a36', { tiers: 7, roof: '#7e5a36', bw0: 0.14 })],
  ['cairo', ['cairo', 'kairo', 'giza'], Y('#f3d08a', '#a9742a', { count: 3 })],
  ['mexicocity', ['mexico city', 'mexiko stadt'], Y('#d6b88a', '#7e5f38', { step: true, steps: 9 })],
  ['cancun', ['cancun', 'cancún'], Y('#e2c79a', '#8a6a3f', { step: true, steps: 9, jungle: true })],
  ['lasvegas', ['las vegas'], Y('#2a2f45', '#0d1020', { count: 1, beam: '#bdf4ff' })],
  ['athens', ['athens', 'athen'], { shape: 'temple', light: '#f5ead2', dark: '#a99572' }],
  // Arches
  ['stlouis', ['st louis', 'saint louis'], A('#dfe8f0', '#7d8fa3', { kind: 'parabola' })],
  ['newdelhi', ['new delhi', 'delhi'], A('#e8a47a', '#9b4f33', { kind: 'gate' })],
  ['mumbai', ['mumbai', 'bombay'], A('#f0c477', '#9a6a2a', { kind: 'gate', turrets: true })],
  // Mountains and volcanoes
  ['capetown', ['cape town', 'kapstadt'], M('#c6b49a', '#5f4f3d', { kind: 'table' })],
  ['naples', ['naples', 'napoli', 'neapel'], M('#9a7e6d', '#3f2f28', { kind: 'volcano' })],
  ['rio', ['rio de janeiro', 'rio'], M('#7fa88a', '#2f5a42', { kind: 'rio' })],
  ['zermatt', ['zermatt'], M('#a9b4c4', '#46526a', { kind: 'horn' })],
  ['chamonix', ['chamonix'], M('#a9b8cf', '#44546f', { kind: 'mont' })],
  ['cusco', ['cusco', 'cuzco'], M('#8fb37a', '#37592f', { kind: 'terraces' })]
  ];
})();
const BACKDROP_LANDMARK_STYLES = Object.fromEntries(BACKDROP_CITY_LANDMARKS.map(([key, , style]) => [key, style]));
const BACKDROP_LANDMARKS = BACKDROP_CLASSIC_LANDMARKS.concat(BACKDROP_CITY_LANDMARKS.map(([key, words]) => [key, words]));
function festivalLandmark(venue) {
  return venueMatch(venue, BACKDROP_LANDMARKS, true);
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
  const landmark = festivalLandmark(venue);
  const seed = backdropSeed(`${name}|${venue}`);
  const colours = BACKDROP_MOODS[mood];
  return { mood, scene, landmark, seed, label: colours.label, bpm: colours.bpm, colours, key: `${mood}|${scene}|${landmark}|${seed}` };
}

if (typeof module !== 'undefined') {
  module.exports = { BACKDROP_MOODS, BACKDROP_LANDMARKS, BACKDROP_LANDMARK_STYLES, BACKDROP_CITY_LANDMARKS, backdropMoodForGenre, festivalMood, festivalScene, festivalLandmark, backdropSeed, backdropRandom, festivalBackdrop };
}
