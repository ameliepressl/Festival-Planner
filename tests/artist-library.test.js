// Artist library (feature-plans/artist-library.md): a large catalogue of real artists with
// fictional fee estimates, filters, and photos from Wikimedia Commons only.
// Run with:  uvx --from nodejs-wheel node --test

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
  ARTIST_LIBRARY, ARTIST_GENRES, ARTIST_REGIONS, ARTIST_SIZES, GENRE_COLOURS, estimatedFee,
  filterArtistLibrary, libraryArtistToCatalogue, acceptableArtistPhoto, commonsFilePage
} = require('../rules/artist-library.js');

test('the library has at least 200 real artists with unique ids and complete details', () => {
  assert.ok(ARTIST_LIBRARY.length >= 200, `only ${ARTIST_LIBRARY.length} artists`);
  assert.equal(new Set(ARTIST_LIBRARY.map((a) => a.id)).size, ARTIST_LIBRARY.length);
  assert.equal(new Set(ARTIST_LIBRARY.map((a) => a.name.toLowerCase())).size, ARTIST_LIBRARY.length);
  for (const a of ARTIST_LIBRARY) {
    assert.ok(ARTIST_GENRES.includes(a.genre), `${a.name}: unknown genre ${a.genre}`);
    assert.ok(ARTIST_REGIONS.includes(a.region), `${a.name}: unknown region ${a.region}`);
    assert.ok(ARTIST_SIZES[a.size], `${a.name}: unknown size`);
    assert.ok(a.wiki && a.style && a.country, `${a.name}: missing details`);
    assert.match(GENRE_COLOURS[a.genre], /^#[0-9a-f]{6}$/i);
  }
});

test('fees are fictional estimates inside the range of the artist size and never change', () => {
  for (const a of ARTIST_LIBRARY) {
    const size = ARTIST_SIZES[a.size];
    assert.ok(a.fee >= size.min && a.fee <= size.max, `${a.name}: ${a.fee}`);
    assert.equal(a.fee, estimatedFee(a.name, a.size));
    assert.equal(a.duration, size.duration);
  }
});

test('the filters combine search, genre, region, size and maximum fee', () => {
  const fado = filterArtistLibrary(ARTIST_LIBRARY, { genre: 'World & Fado' });
  assert.ok(fado.length > 0 && fado.every((a) => a.genre === 'World & Fado'));
  const cheapPortugal = filterArtistLibrary(ARTIST_LIBRARY, { region: 'Portugal', maxFee: '25000' });
  assert.ok(cheapPortugal.length > 0);
  assert.ok(cheapPortugal.every((a) => a.region === 'Portugal' && a.fee <= 25000));
  const headliners = filterArtistLibrary(ARTIST_LIBRARY, { size: 'H' });
  assert.ok(headliners.length > 0 && headliners.every((a) => a.size === 'H'));
  assert.equal(filterArtistLibrary(ARTIST_LIBRARY, { query: 'zzzz-no-artist' }).length, 0);
});

test('the search ignores capitals and accents and matches every word', () => {
  const plain = filterArtistLibrary(ARTIST_LIBRARY, { query: 'ROSALIA' });
  assert.ok(plain.some((a) => a.name === 'Rosalía'));
  const twoWords = filterArtistLibrary(ARTIST_LIBRARY, { query: 'fado portugal' });
  assert.ok(twoWords.length > 0 && twoWords.every((a) => /fado/i.test(a.style + a.name) && a.country === 'Portugal'));
});

test('sorting by name or by fee', () => {
  const byName = filterArtistLibrary(ARTIST_LIBRARY, {}).map((a) => a.name);
  assert.deepEqual(byName, [...byName].sort((x, y) => x.localeCompare(y, 'en')));
  const low = filterArtistLibrary(ARTIST_LIBRARY, { sort: 'fee-low' }).map((a) => a.fee);
  assert.ok(low.every((fee, i) => i === 0 || low[i - 1] <= fee));
  const high = filterArtistLibrary(ARTIST_LIBRARY, { sort: 'fee-high' }).map((a) => a.fee);
  assert.ok(high.every((fee, i) => i === 0 || high[i - 1] >= fee));
});

test('filtering never changes the library itself', () => {
  const before = ARTIST_LIBRARY.map((a) => a.id).join();
  filterArtistLibrary(ARTIST_LIBRARY, { sort: 'fee-high' });
  assert.equal(ARTIST_LIBRARY.map((a) => a.id).join(), before);
});

test('an artist added from the library passes the festival plan rules and can be booked', () => {
  const context = vm.createContext({ Date, Intl, console });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../rules/festival-rules.js'), 'utf8'), context);
  const added = ARTIST_LIBRARY.slice(0, 20).map(libraryArtistToCatalogue);
  context.added = JSON.parse(JSON.stringify(added));
  const problems = JSON.parse(vm.runInContext(`(() => {
    const plan = normalizePlan(null);
    plan.artists = [...plan.artists, ...added];
    const a = added[0];
    plan.bookings = [{ id: 'b1', artistId: a.id, stage: 'A', date: plan.event.startDate,
      start: plan.event.startMinutes, duration: a.duration, fee: a.fee, status: 'tentative', changeover: 0, notes: '' }];
    return JSON.stringify(planProblems(plan));
  })()`, context));
  assert.deepEqual(problems, []);
  assert.equal(added[0].libraryId, ARTIST_LIBRARY[0].id);
});

test('only freely licensed Wikimedia Commons photos are accepted', () => {
  const ok = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Some_Singer_2019.jpg/240px-Some_Singer_2019.jpg';
  assert.equal(acceptableArtistPhoto(ok), true);
  assert.equal(acceptableArtistPhoto('https://upload.wikimedia.org/wikipedia/en/a/ab/Album_cover.jpg'), false);
  assert.equal(acceptableArtistPhoto('https://example.com/photo.jpg'), false);
  assert.equal(acceptableArtistPhoto(undefined), false);
  assert.equal(commonsFilePage(ok), 'https://commons.wikimedia.org/wiki/File:Some_Singer_2019.jpg');
  // The newer image host, as Wikipedia returns it today (with tracking parameters).
  const thumbHost = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7c/Adele_2016.jpg/250px-Adele_2016.jpg?utm_source=en.wikipedia.org';
  assert.equal(acceptableArtistPhoto(thumbHost), true);
  assert.equal(commonsFilePage(thumbHost), 'https://commons.wikimedia.org/wiki/File:Adele_2016.jpg');
  assert.equal(acceptableArtistPhoto('https://thumb.wikimedia.org/wikipedia/en/a/ab/Album_cover.jpg'), false);
});
