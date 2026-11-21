// Festival Architect — artist photos from Wikipedia (only freely licensed Wikimedia Commons images).
// Any element with data-wiki="<Wikipedia title>" gets the photo once it scrolls into view.
// - One request asks for up to 50 artists at once, so Wikipedia is not flooded with requests.
// - A photo is only used when the article describes a musician/band, so an ambiguous name never
//   shows a wrong picture. Without a photo the element keeps its initials.
//   Dish photos for the vendor stands (data-photo-kind="dish", fixed titles like "Taco") skip this check.
// - Results are remembered in this browser (key "fa-artist-photos-v2"). The key does not start with
//   "festival-", so it is never copied into the festival data of the account.
// - Clicking a photo opens its Wikimedia Commons page (author and licence).
(function () {
  const CACHE_KEY = 'fa-artist-photos-v2';
  const MAX_AGE = 30 * 24 * 60 * 60 * 1000; // ask again after 30 days
  const MUSIC_WORDS = /(singer|rapper|band|musician|dj|disc jockey|producer|group|duo|trio|songwriter|composer|artist|pianist|guitarist|trumpeter|saxophonist|bassist|drummer|vocalist|fado|ensemble|orchestra|collective|entertainer|performer)/i;
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch { cache = {}; }
  const waiting = new Map(); // title -> [elements]
  let timer = null;

  function remember() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* photos still work without the cache */ }
  }

  function apply(element, entry) {
    element.dataset.photoDone = '1';
    if (!entry || !entry.src) return;
    const name = element.dataset.name || element.dataset.wiki;
    const img = document.createElement('img');
    img.src = entry.src;
    img.alt = `Photo of ${name}`;
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => { img.remove(); element.classList.remove('has-photo'); };
    if (entry.page && element.dataset.photoLink !== 'off') {
      const link = document.createElement('a');
      link.href = entry.page;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.title = 'Photo: Wikimedia Commons — click for author and licence';
      link.append(img);
      element.replaceChildren(link);
    } else element.replaceChildren(img);
    element.classList.add('has-photo');
  }

  async function flush() {
    timer = null;
    const titles = [...waiting.keys()].slice(0, 50);
    if (!titles.length) return;
    const elements = titles.map((t) => [t, waiting.get(t)]);
    const waitingFor = Object.fromEntries(elements);
    titles.forEach((t) => waiting.delete(t));
    const found = {};
    try {
      const url = 'https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&redirects=1'
        + '&prop=pageimages%7Cdescription&piprop=thumbnail&pithumbsize=240&pilicense=free&titles='
        + encodeURIComponent(titles.join('|'));
      const response = await fetch(url);
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();
      const rename = {};
      [...(data.query?.normalized || []), ...(data.query?.redirects || [])].forEach((n) => { rename[n.from] = n.to; });
      const pages = Object.fromEntries((data.query?.pages || []).map((p) => [p.title, p]));
      for (const title of titles) {
        let key = rename[title] || title;
        key = rename[key] || key;
        const page = pages[key];
        const src = page?.thumbnail?.source;
        const dish = (waitingFor[title] || []).some((el) => el.dataset.photoKind === 'dish');
        const fits = dish || MUSIC_WORDS.test(page?.description || '');
        found[title] = acceptableArtistPhoto(src) && fits ? { src, page: commonsFilePage(src) } : null;
      }
      titles.forEach((t) => { cache[t] = { photo: found[t], at: Date.now() }; });
      remember();
    } catch {
      // Offline or Wikipedia not reachable: keep the initials, try again next time.
    }
    elements.forEach(([title, list]) => list.forEach((el) => apply(el, found[title])));
    if (waiting.size) timer = setTimeout(flush, 400);
  }

  function request(element) {
    if (element.dataset.photoDone) return;
    const title = element.dataset.wiki;
    const known = cache[title];
    if (known && Date.now() - known.at < MAX_AGE) { apply(element, known.photo); return; }
    if (!waiting.has(title)) waiting.set(title, []);
    waiting.get(title).push(element);
    if (!timer) timer = setTimeout(flush, 150);
  }

  const watcher = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { watcher.unobserve(e.target); request(e.target); }
    }), { rootMargin: '200px' })
    : null;

  function observe(root = document) {
    root.querySelectorAll('[data-wiki]:not([data-photo-done])').forEach((el) => {
      if (watcher) watcher.observe(el); else request(el);
    });
  }

  window.ArtistPhotos = { observe };
  observe();
})();
