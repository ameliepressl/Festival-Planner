// Festival Architect — draws the site map as a realistic top-down (aerial) view in SVG:
// grass, forest, lake, gravel walkways, and every facility in its real size (stages, tents, food trucks,
// toilet rows …) with a clickable pin on top. Only drawing lives here; the rules are in rules/site-map-rules.js.
// Everything is collected in one object, MapDrawing, so no names clash with the rest of the app.

const MapDrawing = (function () {
  // A tiny repeatable random generator, so the trees stand in the same place every time.
  function seeded(seed) {
    let s = seed;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }
  const pts = (polygon) => polygon.map((p) => p.join(',')).join(' ');
  const centreOf = (polygon) => [0, 1].map((k) => polygon.reduce((sum, p) => sum + p[k], 0) / polygon.length);
  // A smooth closed outline through the corners (curves instead of straight edges), e.g. for the lake.
  function smooth(polygon) {
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const n = polygon.length;
    let d = `M${mid(polygon[n - 1], polygon[0]).join(' ')}`;
    polygon.forEach((p, i) => { d += ` Q${p.join(' ')} ${mid(p, polygon[(i + 1) % n]).join(' ')}`; });
    return `${d} Z`;
  }

  // Textures, gradients and shadows, defined once and reused.
  function defs() {
    return `<defs>
      <filter id="fa-grass" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="4" seed="4" result="noise" />
        <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.20  0 0 0 0 0.36  0 0 0 0 0.12  0 0 0 0.9 -0.25" result="patches" />
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="9" result="fine" />
        <feColorMatrix in="fine" type="matrix" values="0 0 0 0 0.1  0 0 0 0 0.2  0 0 0 0 0.05  0 0 0 0.35 0" result="blades" />
        <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="patches" /><feMergeNode in="blades" /></feMerge>
        <feComposite in2="SourceGraphic" operator="in" />
      </filter>
      <filter id="fa-gravel"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="3" result="g" />
        <feColorMatrix in="g" type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.40  0 0 0 0 0.32  0 0 0 0.5 0" result="grain" />
        <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="grain" /></feMerge><feComposite in2="SourceGraphic" operator="in" /></filter>
      <filter id="fa-water"><feTurbulence type="turbulence" baseFrequency="0.012 0.05" numOctaves="2" seed="2" result="w" />
        <feColorMatrix in="w" type="matrix" values="0 0 0 0 0.85  0 0 0 0 0.93  0 0 0 0 1  0 0 0 0.35 0" result="ripples" />
        <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="ripples" /></feMerge><feComposite in2="SourceGraphic" operator="in" /></filter>
      <filter id="fa-shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="3" dy="4" stdDeviation="2.5" flood-color="#0b1a0c" flood-opacity="0.45" /></filter>
      <filter id="fa-pin-shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-color="#000" flood-opacity="0.45" /></filter>
      <radialGradient id="fa-tree" cx="38%" cy="35%" r="65%"><stop offset="0" stop-color="#6f9e45" /><stop offset="0.55" stop-color="#3f6f2a" /><stop offset="1" stop-color="#22451b" /></radialGradient>
      <radialGradient id="fa-tree-dark" cx="38%" cy="35%" r="65%"><stop offset="0" stop-color="#5b8a3c" /><stop offset="0.6" stop-color="#2f5a22" /><stop offset="1" stop-color="#173414" /></radialGradient>
      <linearGradient id="fa-lake" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3f86a8" /><stop offset="0.6" stop-color="#2a6687" /><stop offset="1" stop-color="#1d4e6b" /></linearGradient>
      <linearGradient id="fa-roof" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a4f55" /><stop offset="1" stop-color="#1e2226" /></linearGradient>
      <linearGradient id="fa-asphalt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#55595c" /><stop offset="1" stop-color="#46494c" /></linearGradient>
      <pattern id="fa-mow" width="60" height="60" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)"><rect width="30" height="60" fill="#ffffff" opacity="0.045" /></pattern>
      <pattern id="fa-nogo" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="#d6452f" opacity="0.18" /><rect width="3" height="10" fill="#d6452f" opacity="0.55" /></pattern>
    </defs>`;
  }

  function tree(x, y, r, dark) {
    return `<ellipse cx="${x + r * 0.35}" cy="${y + r * 0.45}" rx="${r}" ry="${r * 0.9}" fill="#0d1f0c" opacity="0.35" />
      <circle cx="${x}" cy="${y}" r="${r}" fill="url(#${dark ? 'fa-tree-dark' : 'fa-tree'})" />`;
  }

  // Trees filling a polygon (the forest) or scattered along a line.
  function forest(polygon, seed, size) {
    const random = seeded(seed);
    const xs = polygon.map((p) => p[0]);
    const ys = polygon.map((p) => p[1]);
    let out = `<polygon points="${pts(polygon)}" fill="#2b4a1f" opacity="0.85" />`;
    for (let i = 0; i < 260; i++) {
      const x = Math.min(...xs) + random() * (Math.max(...xs) - Math.min(...xs));
      const y = Math.min(...ys) + random() * (Math.max(...ys) - Math.min(...ys));
      if (pointInPolygon([x, y], polygon)) out += tree(x, y, size * (0.7 + random() * 0.6), random() > 0.5);
    }
    return out;
  }

  // The demo map: farmland around, mown festival lawn inside the fence, forest, lake, road and car park.
  function demoScene(site) {
    const random = seeded(11);
    let surroundings = '';
    for (let i = 0; i < 70; i++) {
      const x = random() * site.width;
      const y = random() * site.height;
      if (!pointInPolygon([x, y], site.boundary)) surroundings += tree(x, y, 9 + random() * 8, random() > 0.4);
    }
    const lake = DEMO_SCENE.lake;
    const [lx, ly] = centreOf(lake);
    return `
      <rect width="${site.width}" height="${site.height}" fill="#7d8f4e" filter="url(#fa-grass)" />
      <path d="M0 160 L${site.width} 60 M0 560 L${site.width} 470" stroke="#a6a06a" stroke-width="2" opacity="0.5" />
      <polygon points="${pts(site.boundary)}" fill="#86ad55" filter="url(#fa-grass)" />
      <polygon points="${pts(site.boundary)}" fill="url(#fa-mow)" />
      <path d="M0 772 C 300 760, 900 768, ${site.width} 778" stroke="url(#fa-asphalt)" stroke-width="34" fill="none" />
      <path d="M0 772 C 300 760, 900 768, ${site.width} 778" stroke="#e8e2c8" stroke-width="1.5" stroke-dasharray="18 14" fill="none" />
      <rect x="760" y="700" width="230" height="58" fill="#5d6164" rx="3" opacity="0.95" />
      ${Array.from({ length: 22 }, (_, i) => `<line x1="${768 + i * 10}" y1="704" x2="${768 + i * 10}" y2="726" stroke="#d9d9d0" stroke-width="1" opacity="0.7" />`).join('')}
      ${Array.from({ length: 14 }, (_, i) => `<rect x="${770 + i * 15 + (i % 3)}" y="707" width="7" height="13" rx="2" fill="${['#c7c9cc', '#2d3a4f', '#a33a2c', '#f0f0ea', '#3d5f3a'][i % 5]}" />`).join('')}
      <path d="${smooth(lake.map(([x, y]) => [lx + (x - lx) * 1.08, ly + (y - ly) * 1.08]))}" fill="#c9b98a" opacity="0.9" />
      <path d="${smooth(lake)}" fill="url(#fa-lake)" filter="url(#fa-water)" />
      <path d="${smooth(lake)}" fill="none" stroke="#a9d3e3" stroke-width="2" opacity="0.6" />
      ${forest(DEMO_SCENE.forest, 5, 13)}
      ${surroundings}`;
  }

  // An uploaded map: the photo itself, the area outside the fence slightly darkened.
  function photoScene(site) {
    return `<image href="${site.image}" x="0" y="0" width="${site.width}" height="${site.height}" preserveAspectRatio="none" />
      <path d="M0 0 H${site.width} V${site.height} H0 Z M${pts(site.boundary).split(' ').join(' L')} Z" fill="#0d1a1d" opacity="0.38" fill-rule="evenodd" />`;
  }

  function fence(site) {
    return `<polygon points="${pts(site.boundary)}" fill="none" stroke="#f4efe0" stroke-width="${site.width / 300}" opacity="0.9" />
      <polygon points="${pts(site.boundary)}" fill="none" stroke="#2c2a25" stroke-width="${site.width / 600}" stroke-dasharray="${site.width / 120} ${site.width / 240}" />`;
  }

  function scene(site) { return (site.image ? photoScene(site) : demoScene(site)) + fence(site); }

  // No-go areas as red hatched cells (only shown while editing or when switched on).
  function nogo(site) {
    const w = site.width / site.grid.cols;
    const h = site.height / site.grid.rows;
    let out = '';
    for (let i = 0; i < site.grid.cells.length; i++) {
      if (site.grid.cells[i] === '1') out += `<rect x="${(i % site.grid.cols) * w}" y="${Math.floor(i / site.grid.cols) * h}" width="${w + 0.5}" height="${h + 0.5}" />`;
    }
    return `<g fill="url(#fa-nogo)">${out}</g>`;
  }

  // Gravel walkways: gate → food court → each stage, and stage A → backstage.
  function walkways(site, placements) {
    const p = placements;
    const pitches = Object.keys(p).filter((id) => /^P\d+$/.test(id));
    if (!p.entrance || !p['stage-a'] || !p['stage-b'] || !pitches.length) return '';
    const court = centreOf(pitches.map((id) => p[id]));
    const width = 7 / metresPerUnit(site);
    // Each walkway follows the route that goes around water, forest and no-go areas, drawn with soft corners.
    const curve = (a, b) => {
      const points = walkwayRoute(site, a, b);
      const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      let d = `M${points[0].join(' ')}`;
      for (let i = 1; i < points.length - 1; i++) d += ` L${mid(points[i - 1], points[i]).join(' ')} Q${points[i].join(' ')} ${mid(points[i], points[i + 1]).join(' ')}`;
      return `${d} L${points[points.length - 1].join(' ')}`;
    };
    const stages = Object.keys(p).filter((id) => /^stage-[a-l]$/.test(id)).sort();
    const routes = [curve(p.entrance, court), ...stages.map((id) => curve(court, p[id]))];
    if (p.backstage) routes.push(curve(p['stage-a'], p.backstage));
    const d = routes.join(' ');
    return `<path d="${d}" fill="none" stroke="#8a7a55" stroke-width="${width * 1.25}" stroke-linecap="round" opacity="0.55" />
      <path d="${d}" fill="none" stroke="#d8c9a0" stroke-width="${width}" stroke-linecap="round" filter="url(#fa-gravel)" />
      <ellipse cx="${court[0]}" cy="${court[1]}" rx="${32 / metresPerUnit(site)}" ry="${22 / metresPerUnit(site)}" fill="#d8c9a0" filter="url(#fa-gravel)" opacity="0.95" />`;
  }

  // A white marquee seen from above: four roof triangles in slightly different greys.
  function tent(w, h, accent) {
    return `<g filter="url(#fa-shadow)">
      <polygon points="${-w / 2},${-h / 2} ${w / 2},${-h / 2} 0,0" fill="#fbfbf7" /><polygon points="${w / 2},${-h / 2} ${w / 2},${h / 2} 0,0" fill="#dcdcd4" />
      <polygon points="${w / 2},${h / 2} ${-w / 2},${h / 2} 0,0" fill="#c9c9c0" /><polygon points="${-w / 2},${h / 2} ${-w / 2},${-h / 2} 0,0" fill="#ececE5" />
      ${accent || ''}</g>`;
  }

  // The real-size object for one facility, drawn around (0, 0); u converts metres to map units.
  // "angle" turns the front towards the food court.
  function object(item, u, angle, vendor) {
    switch (item.kind) {
      case 'stage': return `<g transform="rotate(${angle})">
          <path d="M${u(14)} ${-u(32)} A ${u(48)} ${u(32)} 0 0 1 ${u(14)} ${u(32)} Z" fill="#c8b98a" opacity="0.55" />
          <path d="M${u(16)} ${-u(24)} Q ${u(70)} 0 ${u(16)} ${u(24)}" fill="#b5a473" opacity="0.4" />
          <rect x="${u(44)}" y="${-u(4)}" width="${u(8)}" height="${u(8)}" fill="#2e3236" filter="url(#fa-shadow)" />
          <rect x="${-u(16)}" y="${-u(15)}" width="${u(30)}" height="${u(30)}" fill="#3b3f43" filter="url(#fa-shadow)" />
          <rect x="${-u(14)}" y="${-u(13)}" width="${u(26)}" height="${u(26)}" fill="url(#fa-roof)" />
          <path d="M${-u(14)} ${-u(13)} L${u(12)} ${u(13)} M${-u(14)} ${u(13)} L${u(12)} ${-u(13)}" stroke="#8d949b" stroke-width="${u(0.6)}" />
          <rect x="${u(12)}" y="${-u(17)}" width="${u(4)}" height="${u(5)}" fill="#111" /><rect x="${u(12)}" y="${u(12)}" width="${u(4)}" height="${u(5)}" fill="#111" />
          <rect x="${-u(26)}" y="${-u(10)}" width="${u(9)}" height="${u(6)}" fill="#e9e9e3" filter="url(#fa-shadow)" /><rect x="${-u(26)}" y="${u(3)}" width="${u(9)}" height="${u(6)}" fill="#e9e9e3" filter="url(#fa-shadow)" /></g>`;
      case 'backstage': return `<g transform="rotate(${angle})">
          <rect x="${-u(20)}" y="${-u(16)}" width="${u(40)}" height="${u(32)}" fill="#9aa67a" stroke="#f4f1e6" stroke-width="${u(0.8)}" stroke-dasharray="${u(2)} ${u(1)}" />
          <g transform="translate(${-u(9)} ${-u(7)})">${tent(u(10), u(10))}</g><g transform="translate(${u(8)} ${-u(7)})">${tent(u(10), u(10))}</g>
          <rect x="${-u(14)}" y="${u(5)}" width="${u(12)}" height="${u(6)}" fill="#e7e5dc" filter="url(#fa-shadow)" /><rect x="${u(2)}" y="${u(5)}" width="${u(12)}" height="${u(6)}" fill="#cfd6dc" filter="url(#fa-shadow)" /></g>`;
      case 'entrance': return `<g transform="rotate(${angle})">
          <rect x="${-u(4)}" y="${-u(16)}" width="${u(8)}" height="${u(32)}" fill="#f2f0e8" filter="url(#fa-shadow)" />
          ${[-12, -6, 0, 6, 12].map((y) => `<rect x="${-u(3)}" y="${u(y) - u(0.6)}" width="${u(14)}" height="${u(1.2)}" fill="#ff684c" />`).join('')}
          <rect x="${-u(10)}" y="${-u(16)}" width="${u(5)}" height="${u(5)}" fill="#30353a" /></g>`;
      case 'info': return `<circle r="${u(5)}" fill="#fbfbf7" filter="url(#fa-shadow)" /><circle r="${u(5)}" fill="none" stroke="#c9c9c0" stroke-width="${u(0.5)}" /><circle r="${u(1)}" fill="#9d86d6" />`;
      case 'security': return `<rect x="${-u(6)}" y="${-u(2.5)}" width="${u(12)}" height="${u(5)}" fill="#3e4a52" filter="url(#fa-shadow)" /><rect x="${-u(5)}" y="${-u(1.5)}" width="${u(10)}" height="${u(3)}" fill="#55636c" />`;
      case 'first-aid': return tent(u(9), u(9), `<rect x="${-u(3)}" y="${-u(0.9)}" width="${u(6)}" height="${u(1.8)}" fill="#d6312a" /><rect x="${-u(0.9)}" y="${-u(3)}" width="${u(1.8)}" height="${u(6)}" fill="#d6312a" />`);
      case 'exit': return `<g transform="rotate(${angle})"><rect x="${-u(1.5)}" y="${-u(6)}" width="${u(3)}" height="${u(12)}" fill="#1f9d55" filter="url(#fa-shadow)" />
          <path d="M${u(3)} ${-u(3)} L${u(8)} 0 L${u(3)} ${u(3)} Z" fill="#1f9d55" transform="rotate(180)" /></g>`;
      case 'toilets': return `<g transform="rotate(${angle + 90})" filter="url(#fa-shadow)">${Array.from({ length: 8 }, (_, i) => `<rect x="${-u(10) + i * u(2.5)}" y="${-u(1.2)}" width="${u(2.3)}" height="${u(2.4)}" fill="${i === 7 ? '#2f7fbf' : '#3a96d6'}" stroke="#1d5e8d" stroke-width="${u(0.2)}" />`).join('')}</g>`;
      case 'water': return `<circle r="${u(3.2)}" fill="#e9f4f8" filter="url(#fa-shadow)" /><circle r="${u(2)}" fill="#3a96d6" /><circle r="${u(0.7)}" fill="#e9f4f8" />`;
      case 'recycling': return `<g filter="url(#fa-shadow)">${['#2f8f4a', '#e3b62a', '#2f6fb8', '#7a7f84'].map((c, i) => `<rect x="${-u(4.5) + i * u(2.3)}" y="${-u(1.1)}" width="${u(2)}" height="${u(2.2)}" rx="${u(0.3)}" fill="${c}" />`).join('')}</g>`;
      case 'pitch': {
        if (!vendor) return `<rect x="${-u(4)}" y="${-u(2.5)}" width="${u(8)}" height="${u(5)}" fill="none" stroke="#f4efe0" stroke-width="${u(0.35)}" stroke-dasharray="${u(1)} ${u(0.7)}" />`;
        const body = { Food: '#e8573d', Drinks: '#2d7f9e', Merch: '#7a5bc4' }[vendor.category] || '#888';
        return `<g transform="rotate(${angle})"><g filter="url(#fa-shadow)"><rect x="${-u(3.6)}" y="${-u(1.5)}" width="${u(7.2)}" height="${u(3)}" rx="${u(0.4)}" fill="${body}" />
          <rect x="${-u(3.6)}" y="${-u(1.5)}" width="${u(1.6)}" height="${u(3)}" rx="${u(0.3)}" fill="#2a2d30" /><rect x="${-u(1.6)}" y="${-u(1)}" width="${u(4.8)}" height="${u(2)}" fill="#f4f2ea" /></g>
          <rect x="${-u(1.6)}" y="${u(1.5)}" width="${u(4.8)}" height="${u(1.4)}" fill="${body}" opacity="0.7" /></g>`;
      }
      default: return '';
    }
  }

  // The clickable map pin, drawn at a fixed size on screen (r is set from the current zoom).
  function pin(item, r, colour, label, selected) {
    return `<g class="fa-pin ${selected ? 'selected' : ''}" filter="url(#fa-pin-shadow)">
      ${selected ? `<circle class="fa-pin-pulse" r="${r * 1.4}" fill="none" stroke="${colour}" stroke-width="${r * 0.25}" />` : ''}
      <path d="M0 0 L${-r * 0.55} ${-r * 1.25} A ${r} ${r} 0 1 1 ${r * 0.55} ${-r * 1.25} Z" transform="translate(0 0)" fill="${colour}" stroke="#fff" stroke-width="${r * 0.14}" />
      <text y="${-r * 2.08}" dy="0.35em" text-anchor="middle" font-size="${label.length > 2 ? r * 0.72 : r * 0.95}" font-family="Archivo, sans-serif" font-weight="700" fill="#17272b">${label}</text></g>`;
  }

  return { defs, scene, nogo, walkways, object, pin };
})();
