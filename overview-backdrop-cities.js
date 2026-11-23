// Festival backdrop: landmarks of 100 more cities (feature-plans/festival-backdrop.md).
// The cities share a few shapes (needle, spires, dome, onion, castle, skyline, pagoda, pyramid,
// temple, arch, peak); each city brings its own colours and details from
// rules/backdrop-rules.js (BACKDROP_LANDMARK_STYLES). Like everything on the stage, a frame is a
// pure function of the time. Helpers such as litFill and landmarkPath live in overview-backdrop.js.

const CITY_TAU = Math.PI * 2;

// Plain colour, drawn normally / drawn as light that adds to what is behind it.
function cityPaint(ctx, colour, alpha = 1) { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = alpha; ctx.fillStyle = colour; }
function cityGlow(ctx, colour, alpha) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha; ctx.fillStyle = colour; }
function cityRect(ctx, x0, gy, u, dx, y, w, h) { ctx.fillRect(x0 + dx * u, gy - (y + h) * u, w * u, h * u); } // units of u, y upwards

// A hill under a castle or temple.
function cityHill(ctx, c, width, height) {
  cityPaint(ctx, c.colours.shade, 0.97);
  ctx.beginPath(); ctx.ellipse(c.m.x, c.gy, width, height, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
}

// A bulb-shaped onion dome with its base at (x, y) and a radius r.
function onionPath(ctx, x, y, r) {
  ctx.beginPath(); ctx.moveTo(x - r * 0.55, y);
  ctx.bezierCurveTo(x - r * 1.5, y - r * 0.5, x - r * 0.5, y - r * 1.4, x, y - r * 2.1);
  ctx.bezierCurveTo(x + r * 0.5, y - r * 1.4, x + r * 1.5, y - r * 0.5, x + r * 0.55, y);
  ctx.closePath();
}

const CITY_SHAPES = {
  // A slender tower, with pods, a saucer, or nothing but a spire.
  needle(ctx, c) {
    const { m, gy, style: s, t, beat, colours } = c, [laserA, laserB] = colours.lasers;
    const u = Math.min(m.height * (s.h || 1), m.width * 3.2), x0 = m.x, w = s.w || 0.02, top = s.saucer ? 0.82 : s.pods ? 0.8 : 0.96;
    landmarkPath(ctx, [[-w, 0], [-w * 0.4, top], [w * 0.4, top], [w, 0]], x0, gy, u);
    litFill(ctx, gy - top * u, gy, s.light, s.dark); ctx.fill();
    const pods = s.saucer ? [{ y: 0.84, rx: 0.1, ry: 0.028 }]
      : Array.from({ length: s.pods || 0 }, (_, i) => ({ y: s.pods === 1 ? 0.66 : 0.34 + i * 0.22, rx: (0.05 - i * 0.012) * (s.pods === 1 ? 1.2 : 1), ry: 0.045 - i * 0.01 }));
    pods.forEach((p, i) => {
      cityPaint(ctx, s.light, 0.97); ctx.beginPath(); ctx.ellipse(x0, gy - p.y * u, p.rx * u, p.ry * u, 0, 0, CITY_TAU); ctx.fill();
      cityGlow(ctx, (i + Math.floor(beat)) % 2 ? laserA : laserB, 0.6); ctx.beginPath(); ctx.ellipse(x0, gy - p.y * u, p.rx * u, p.ry * u * 0.4, 0, 0, CITY_TAU); ctx.fill();
    });
    cityPaint(ctx, s.light, 0.97); ctx.fillRect(x0 - 0.004 * u, gy - u, 0.008 * u, (1 - top) * u + 1);
    cityGlow(ctx, '#ff2b2b', blinking(t, 2.8, s.light.length)); ctx.beginPath(); ctx.arc(x0, gy - u, 2.5, 0, CITY_TAU); ctx.fill();
  },

  // Towers of a church or cathedral: pointed, flat, leaning, stepped.
  spires(ctx, c) {
    const { m, gy, style: s, t, colours } = c, u = Math.min(m.height * 0.9, m.width * 1.5), x0 = m.x;
    const towers = s.towers || [[-0.13, 0.7, 0.07], [0.13, 0.7, 0.07]];
    if (s.wings) {
      landmarkPath(ctx, mirrored([[-0.24, 0], [-0.24, 0.12], [-0.17, 0.12], [-0.17, 0.26], [-0.1, 0.26], [-0.1, 0.42], [0, 0.42]]), x0, gy, u);
      litFill(ctx, gy - 0.42 * u, gy, s.light, s.dark); ctx.fill();
    } else if (!s.noNave) {
      landmarkPath(ctx, [[-0.32, 0], [-0.32, 0.2], [0.32, 0.2], [0.32, 0]], x0, gy, u);
      litFill(ctx, gy - 0.2 * u, gy, s.light, s.dark); ctx.fill();
      cityGlow(ctx, '#ffd48a', 0.35 + 0.3 * blinking(t, 0.3, 1)); ctx.beginPath(); ctx.arc(x0, gy - 0.12 * u, 0.045 * u, 0, CITY_TAU); ctx.fill();
    }
    towers.forEach(([dx, h, w], index) => {
      ctx.save();
      if (s.lean) { ctx.translate(x0 + dx * u, gy); ctx.rotate(s.lean); ctx.translate(-(x0 + dx * u), -gy); }
      landmarkPath(ctx, [[dx - w, 0], [dx - w, h], [dx + w, h], [dx + w, 0]], x0, gy, u);
      litFill(ctx, gy - h * u, gy, s.light, s.dark); ctx.fill();
      if (s.flat) {
        cityPaint(ctx, s.roof || s.dark, 0.97); cityRect(ctx, x0, gy, u, dx - w * 1.15, h, w * 2.3, 0.03);
        ctx.beginPath(); ctx.arc(x0 + dx * u, gy - (h + 0.05) * u, 0.016 * u, 0, CITY_TAU); ctx.fill();
      } else {
        landmarkPath(ctx, [[dx - w * 1.15, h], [dx, h + (s.roofH || 4) * w], [dx + w * 1.15, h]], x0, gy, u);
        cityPaint(ctx, s.roof || s.dark, 0.97); ctx.fill();
      }
      for (let k = 0; k < 3; k++) {
        const y = h * (0.22 + k * 0.24);
        cityPaint(ctx, colours.shade, 0.7); cityRect(ctx, x0, gy, u, dx - w * 0.35, y, w * 0.7, 0.045);
        cityGlow(ctx, '#ffd48a', 0.2 + 0.4 * blinking(t, 0.35, k + index * 2)); cityRect(ctx, x0, gy, u, dx - w * 0.35, y, w * 0.7, 0.045);
      }
      for (let k = 1; k <= (s.tiers || 0); k++) { cityPaint(ctx, colours.shade, 0.45); cityRect(ctx, x0, gy, u, dx - w, h * k / (s.tiers + 1), w * 2, 0.008); }
      ctx.restore();
    });
  },

  // A domed building with minarets, small domes or a campanile.
  dome(ctx, c) {
    const { m, gy, style: s, t, beat, colours } = c, u = Math.min(m.height * 0.75, m.width * 0.85), x0 = m.x, baseW = s.baseW || 0.4, baseH = 0.18;
    landmarkPath(ctx, [[-baseW, 0], [-baseW, baseH], [baseW, baseH], [baseW, 0]], x0, gy, u);
    litFill(ctx, gy - baseH * u, gy, s.light, s.dark); ctx.fill();
    cityPaint(ctx, colours.shade, 0.5);
    for (let i = 0; i < 9; i++) cityRect(ctx, x0, gy, u, -baseW + 0.04 + i * (2 * baseW - 0.09) / 8, 0, 0.02, 0.13);
    const r = s.r || 0.2, h = s.h || 0.3, top = baseH + 0.07;
    landmarkPath(ctx, [[-r * 0.85, baseH], [-r * 0.85, top], [r * 0.85, top], [r * 0.85, baseH]], x0, gy, u);
    litFill(ctx, gy - top * u, gy - baseH * u, s.light, s.dark); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x0, gy - top * u, r * u, h * u, 0, Math.PI, 0); ctx.closePath();
    litFill(ctx, gy - (top + h) * u, gy - top * u, s.domeLight || s.light, s.domeDark || s.dark); ctx.fill();
    cityPaint(ctx, '#ffd27a', 0.95); cityRect(ctx, x0, gy, u, -0.012, top + h, 0.024, 0.05);
    ctx.beginPath(); ctx.moveTo(x0 - 0.012 * u, gy - (top + h + 0.05) * u); ctx.lineTo(x0, gy - (top + h + 0.1) * u); ctx.lineTo(x0 + 0.012 * u, gy - (top + h + 0.05) * u); ctx.closePath(); ctx.fill();
    for (let k = 0; k < (s.small || 0); k++) { // small domes
      const dx = (k % 2 ? 1 : -1) * (r + 0.08 + Math.floor(k / 2) * 0.1), sr = r * 0.45;
      ctx.beginPath(); ctx.ellipse(x0 + dx * u, gy - baseH * u, sr * u, sr * 0.9 * u, 0, Math.PI, 0); ctx.closePath();
      litFill(ctx, gy - (baseH + sr) * u, gy - baseH * u, s.domeLight || s.light, s.domeDark || s.dark); ctx.fill();
    }
    const side = s.minarets || 0;
    for (let k = 0; k < side; k++) { // minarets, pointed
      const dx = (k % 2 ? 1 : -1) * (baseW + 0.03 + Math.floor(k / 2) * 0.08), mh = 0.66 - Math.floor(k / 2) * 0.08;
      landmarkPath(ctx, [[dx - 0.014, 0], [dx - 0.014, mh], [dx + 0.014, mh], [dx + 0.014, 0]], x0, gy, u);
      litFill(ctx, gy - mh * u, gy, s.light, s.dark); ctx.fill();
      cityPaint(ctx, s.light, 0.97); cityRect(ctx, x0, gy, u, dx - 0.025, mh - 0.14, 0.05, 0.015);
      landmarkPath(ctx, [[dx - 0.016, mh], [dx, mh + 0.1], [dx + 0.016, mh]], x0, gy, u); cityPaint(ctx, s.domeDark || s.dark, 0.97); ctx.fill();
    }
    if (s.tower) { // a campanile beside the dome
      const dx = s.tower * (baseW + 0.1), th = 0.82;
      landmarkPath(ctx, [[dx - 0.04, 0], [dx - 0.04, th], [dx + 0.04, th], [dx + 0.04, 0]], x0, gy, u);
      litFill(ctx, gy - th * u, gy, s.light, s.dark); ctx.fill();
      landmarkPath(ctx, [[dx - 0.05, th], [dx, th + 0.1], [dx + 0.05, th]], x0, gy, u); cityPaint(ctx, s.domeDark || s.dark, 0.97); ctx.fill();
    }
    cityGlow(ctx, colours.lasers[Math.floor(beat) % 2], 0.12 + 0.1 * blinking(t, 0.5)); ctx.beginPath(); ctx.ellipse(x0, gy - top * u, r * u, h * u, 0, Math.PI, 0); ctx.fill();
  },

  // Colourful onion domes, sometimes with a tall tent roof.
  onion(ctx, c) {
    const { m, gy, style: s, t, colours } = c, u = Math.min(m.height * 0.8, m.width * 1.1), x0 = m.x;
    landmarkPath(ctx, [[-0.3, 0], [-0.3, 0.2], [0.3, 0.2], [0.3, 0]], x0, gy, u);
    litFill(ctx, gy - 0.2 * u, gy, s.light, s.dark); ctx.fill();
    if (s.tent) {
      landmarkPath(ctx, [[-0.06, 0.2], [-0.06, 0.5], [0, 0.98], [0.06, 0.5], [0.06, 0.2]], x0, gy, u);
      litFill(ctx, gy - 0.98 * u, gy - 0.2 * u, '#f26a4f', '#9a2a1c'); ctx.fill();
    }
    (s.domes || []).forEach(([dx, h, r, light, dark], i) => {
      landmarkPath(ctx, [[dx - r * 0.6, 0.2], [dx - r * 0.6, h], [dx + r * 0.6, h], [dx + r * 0.6, 0.2]], x0, gy, u);
      litFill(ctx, gy - h * u, gy - 0.2 * u, s.light, s.dark); ctx.fill();
      onionPath(ctx, x0 + dx * u, gy - h * u, r * u);
      litFill(ctx, gy - (h + 2.1 * r) * u, gy - h * u, light, dark); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(x0 + dx * u - r * u * 0.5, gy - h * u - r * u * 0.5); ctx.quadraticCurveTo(x0 + dx * u - r * u * 0.1, gy - h * u - r * u * 1.4, x0 + dx * u, gy - (h + 2 * r) * u); ctx.stroke();
      cityPaint(ctx, '#ffd27a', 0.95); cityRect(ctx, x0, gy, u, dx - 0.004, h + 2.1 * r, 0.008, 0.045);
      cityGlow(ctx, '#ffd48a', 0.25 + 0.4 * blinking(t, 0.4, i)); cityRect(ctx, x0, gy, u, dx - r * 0.2, h - 0.08, r * 0.4, 0.045);
    });
    cityPaint(ctx, colours.shade, 0.5); for (let i = 0; i < 6; i++) cityRect(ctx, x0, gy, u, -0.26 + i * 0.1, 0.02, 0.04, 0.12);
  },

  // A castle on a hill: wall, crenellations, towers with pointed roofs.
  castle(ctx, c) {
    const { m, gy, style: s, t, colours } = c, u = Math.min(m.height * 0.7, m.width * 1.2), x0 = m.x, b = s.hill ? 0.09 : 0.0;
    if (s.hill) cityHill(ctx, c, 0.58 * u, 0.15 * u);
    landmarkPath(ctx, [[-0.42, b - 0.02], [-0.42, b + 0.16], [0.42, b + 0.16], [0.42, b - 0.02]], x0, gy, u);
    litFill(ctx, gy - (b + 0.16) * u, gy - b * u, s.light, s.dark); ctx.fill();
    cityPaint(ctx, s.dark, 0.97); for (let i = 0; i < 17; i++) cityRect(ctx, x0, gy, u, -0.42 + i * 0.0525, b + 0.16, 0.028, 0.028);
    (s.towers || [[-0.34, 0.38, 0.05], [-0.12, 0.55, 0.06], [0.14, 0.7, 0.07], [0.36, 0.42, 0.05]]).forEach(([dx, h, w], i) => {
      landmarkPath(ctx, [[dx - w, b], [dx - w, b + h], [dx + w, b + h], [dx + w, b]], x0, gy, u);
      litFill(ctx, gy - (b + h) * u, gy - b * u, s.light, s.dark); ctx.fill();
      landmarkPath(ctx, [[dx - w * 1.2, b + h], [dx, b + h + w * 3.2], [dx + w * 1.2, b + h]], x0, gy, u);
      cityPaint(ctx, s.roof || s.dark, 0.97); ctx.fill();
      cityGlow(ctx, '#ffd48a', 0.25 + 0.45 * blinking(t, 0.4, i * 2)); cityRect(ctx, x0, gy, u, dx - w * 0.25, b + h * 0.6, w * 0.5, 0.05);
    });
    cityPaint(ctx, colours.shade, 0.6); for (let i = 0; i < 5; i++) cityRect(ctx, x0, gy, u, -0.3 + i * 0.15, b + 0.03, 0.03, 0.07);
  },

  // A skyline of towers, one of them taller with a crown. The towers are the same every frame.
  skyline(ctx, c) {
    const { m, gy, style: s, t, colours } = c, rnd = backdropRandom(backdropSeed(m.kind));
    const n = Math.max(7, Math.floor(m.width / 24)), bw = m.width / n, star = Math.floor(n * 0.4);
    for (let i = 0; i < n; i++) {
      const r1 = rnd(), r2 = rnd(), tall = i === star;
      const h = (tall ? 0.95 : 0.18 + r1 * 0.5) * m.height * (s.tall || 0.8), w = bw * (tall ? 0.85 : 0.75 + r2 * 0.2), x = m.left + i * bw + (bw - w) / 2;
      ctx.beginPath(); ctx.rect(x, gy - h, w, h + 2);
      litFill(ctx, gy - h, gy, s.light, s.dark); ctx.fill();
      for (let y = gy - 8; y > gy - h + 5; y -= 8) for (let wx = x + 3; wx < x + w - 3; wx += 6) {
        const k = (i * 7 + Math.round(y) * 3 + Math.round(wx)) % 5;
        if (k < 2) { cityGlow(ctx, s.accent, 0.2 + 0.4 * blinking(t, 0.3, k + i + y)); ctx.fillRect(wx, y, 2, 3); }
      }
      if (tall) {
        const cx = x + w / 2, top = gy - h;
        cityPaint(ctx, s.light, 0.97);
        if (s.crown === 'stack') { [[0.7, 0.14], [0.5, 0.14], [0.3, 0.14]].forEach(([k, up], j) => ctx.fillRect(cx - w * k / 2, top - (j + 1) * h * 0.09, w * k, h * 0.09)); }
        else if (s.crown === 'spire') { ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(cx, top - h * 0.24); ctx.lineTo(x + w, top); ctx.closePath(); ctx.fill(); }
        else { ctx.fillRect(cx - 1, top - h * 0.22, 2, h * 0.22); }
        cityGlow(ctx, '#ff2b2b', blinking(t, 2.4, i)); ctx.beginPath(); ctx.arc(cx, top - h * 0.22, 2.2, 0, CITY_TAU); ctx.fill();
      }
    }
    cityPaint(ctx, colours.shade, 0.6); ctx.fillRect(m.left, gy, m.width, 3);
  },

  // A pagoda with upturned roofs, a prang, or a castle keep.
  pagoda(ctx, c) {
    const { m, gy, style: s, t, colours } = c, u = Math.min(m.height * 0.85, m.width * 1.3), x0 = m.x;
    if (s.prang) {
      [[0, 1], [-0.36, 0.55], [0.36, 0.55]].forEach(([dx, h]) => {
        landmarkPath(ctx, mirrored([[-0.14, 0], [-0.14, 0.2], [-0.1, 0.2], [-0.1, 0.4], [-0.07, 0.4], [-0.07, 0.6], [-0.045, 0.6], [-0.045, 0.8], [-0.02, 0.8], [0, 1]]), x0 + dx * u, gy, u * h);
        litFill(ctx, gy - h * u, gy, s.light, s.dark); ctx.fill();
      });
      cityGlow(ctx, '#ffd48a', 0.3 + 0.3 * blinking(t, 0.5)); cityRect(ctx, x0, gy, u, -0.02, 0.3, 0.04, 0.08);
      return;
    }
    const tiers = s.tiers || 5, step = 0.88 / tiers;
    landmarkPath(ctx, [[-0.3, 0], [-0.3, 0.05], [0.3, 0.05], [0.3, 0]], x0, gy, u); litFill(ctx, gy - 0.05 * u, gy, s.light, s.dark); ctx.fill();
    for (let i = 0; i < tiers; i++) {
      const y0 = 0.05 + i * step, bw = (s.bw0 || 0.15) * (1 - i / (tiers + 1)) + 0.03, y1 = y0 + step * 0.6;
      landmarkPath(ctx, [[-bw, y0], [-bw, y1], [bw, y1], [bw, y0]], x0, gy, u); litFill(ctx, gy - y1 * u, gy - y0 * u, s.light, s.dark); ctx.fill();
      cityGlow(ctx, '#ffd48a', 0.2 + 0.4 * blinking(t, 0.4, i)); cityRect(ctx, x0, gy, u, -bw * 0.3, y0 + step * 0.15, bw * 0.6, step * 0.3);
      landmarkPath(ctx, [[-bw - 0.08, y1 - 0.012], [-bw - 0.04, y1], [-bw, y1 + 0.045], [bw, y1 + 0.045], [bw + 0.04, y1], [bw + 0.08, y1 - 0.012], [bw, y1 - 0.02], [-bw, y1 - 0.02]], x0, gy, u);
      cityPaint(ctx, s.roof || s.dark, 0.97); ctx.fill();
    }
    cityPaint(ctx, s.roof || s.dark, 0.97); cityRect(ctx, x0, gy, u, -0.004, 0.05 + tiers * step + 0.02, 0.008, 0.07);
    if (s.torii) { // a red gate beside the pagoda
      const gx = -0.46; cityPaint(ctx, '#d6402f', 0.97);
      cityRect(ctx, x0, gy, u, gx - 0.07, 0, 0.02, 0.22); cityRect(ctx, x0, gy, u, gx + 0.05, 0, 0.02, 0.22); cityRect(ctx, x0, gy, u, gx - 0.1, 0.2, 0.24, 0.025); cityRect(ctx, x0, gy, u, gx - 0.08, 0.15, 0.2, 0.014);
    }
    cityPaint(ctx, colours.shade, 0.4);
  },

  // Pyramids: smooth ones in a row, a single glass one with a beam, or stepped ones with a temple.
  pyramid(ctx, c) {
    const { m, gy, style: s, t, colours } = c, u = Math.min(m.height * 0.6, m.width * 0.7), x0 = m.x;
    if (s.step) {
      const n = s.steps || 8, hw = 0.5;
      for (let i = 0; i < n; i++) {
        const w = hw * (1 - i / n), h = 0.8 / n;
        landmarkPath(ctx, [[-w, i * h], [-w, (i + 1) * h], [w, (i + 1) * h], [w, i * h]], x0, gy, u);
        litFill(ctx, gy - (i + 1) * h * u, gy - i * h * u, s.light, s.dark); ctx.fill();
      }
      cityPaint(ctx, colours.shade, 0.45); cityRect(ctx, x0, gy, u, -0.03, 0, 0.06, 0.8);
      cityPaint(ctx, s.light, 0.97); cityRect(ctx, x0, gy, u, -0.09, 0.8, 0.18, 0.08); cityPaint(ctx, colours.shade, 0.7); cityRect(ctx, x0, gy, u, -0.03, 0.8, 0.06, 0.05);
      cityGlow(ctx, '#ffd48a', 0.3 + 0.3 * blinking(t, 0.4)); cityRect(ctx, x0, gy, u, -0.03, 0.8, 0.06, 0.05);
      return;
    }
    (s.count > 1 ? [[-0.32, 0.62, 0.42], [0.12, 1, 0.55], [0.46, 0.42, 0.3]] : [[0, 1, 0.55]]).forEach(([dx, h, hw]) => {
      landmarkPath(ctx, [[dx - hw, 0], [dx, h], [dx, 0]], x0, gy, u); litFill(ctx, gy - h * u, gy, s.light, s.dark); ctx.fill();
      landmarkPath(ctx, [[dx, 0], [dx, h], [dx + hw, 0]], x0, gy, u); cityPaint(ctx, s.dark, 0.97); ctx.fill();
    });
    if (s.beam) { cityGlow(ctx, s.beam, 1); drawBeam(ctx, x0, gy - u, -Math.PI / 2, m.height * 1.3, 0.018, s.beam, 0.45 + 0.25 * Math.sin(t * 1.3)); }
  },

  // The Parthenon: steps, eight columns, a pediment.
  temple(ctx, c) {
    const { m, gy, style: s, t } = c, u = Math.min(m.height * 0.6, m.width * 1.1), x0 = m.x, b = 0.08;
    cityHill(ctx, c, 0.58 * u, 0.15 * u);
    for (let i = 0; i < 3; i++) { landmarkPath(ctx, [[-0.42 + i * 0.02, b + i * 0.02], [-0.42 + i * 0.02, b + i * 0.02 + 0.02], [0.42 - i * 0.02, b + i * 0.02 + 0.02], [0.42 - i * 0.02, b + i * 0.02]], x0, gy, u); litFill(ctx, gy - (b + 0.1) * u, gy - b * u, s.light, s.dark); ctx.fill(); }
    const y0 = b + 0.06;
    for (let i = 0; i < 8; i++) {
      landmarkPath(ctx, [[-0.34 + i * 0.097, y0], [-0.34 + i * 0.097, y0 + 0.3], [-0.31 + i * 0.097, y0 + 0.3], [-0.31 + i * 0.097, y0]], x0, gy, u);
      litFill(ctx, gy - (y0 + 0.3) * u, gy - y0 * u, s.light, s.dark); ctx.fill();
    }
    landmarkPath(ctx, [[-0.4, y0 + 0.3], [-0.4, y0 + 0.34], [0.4, y0 + 0.34], [0.4, y0 + 0.3]], x0, gy, u); litFill(ctx, gy - (y0 + 0.34) * u, gy - (y0 + 0.3) * u, s.light, s.dark); ctx.fill();
    landmarkPath(ctx, [[-0.4, y0 + 0.34], [0, y0 + 0.46], [0.4, y0 + 0.34]], x0, gy, u); litFill(ctx, gy - (y0 + 0.46) * u, gy - (y0 + 0.34) * u, s.light, s.dark); ctx.fill();
    cityGlow(ctx, '#ffd48a', 0.15 + 0.12 * blinking(t, 0.5)); cityRect(ctx, x0, gy, u, -0.36, y0, 0.72, 0.3);
  },

  // The Gateway Arch, or a great gate.
  arch(ctx, c) {
    const { m, gy, style: s, t, colours } = c, u = Math.min(m.height * 0.85, m.width * 0.9), x0 = m.x;
    if (s.kind === 'parabola') {
      ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'butt';
      [[0.06, s.dark], [0.035, s.light]].forEach(([wd, colour]) => {
        ctx.globalAlpha = 0.97; ctx.strokeStyle = colour; ctx.lineWidth = Math.max(2, wd * u);
        ctx.beginPath(); ctx.moveTo(x0 - 0.4 * u, gy); ctx.quadraticCurveTo(x0, gy - 2 * u, x0 + 0.4 * u, gy); ctx.stroke();
      });
      cityGlow(ctx, '#ffffff', 0.35 + 0.3 * blinking(t, 0.5)); ctx.beginPath(); ctx.arc(x0, gy - u + 2, 3, 0, CITY_TAU); ctx.fill();
      return;
    }
    const w = 0.36, h = 0.55;
    ctx.beginPath(); ctx.rect(x0 - w * u, gy - h * u, 2 * w * u, h * u);
    ctx.moveTo(x0 - 0.14 * u, gy); ctx.lineTo(x0 - 0.14 * u, gy - 0.28 * u); ctx.arc(x0, gy - 0.28 * u, 0.14 * u, Math.PI, 0); ctx.lineTo(x0 + 0.14 * u, gy); ctx.closePath();
    litFill(ctx, gy - h * u, gy, s.light, s.dark); ctx.fill('evenodd');
    cityPaint(ctx, s.dark, 0.97); cityRect(ctx, x0, gy, u, -w - 0.02, h, 2 * w + 0.04, 0.03);
    if (s.turrets) [-1, 1].forEach(side => { // the four little towers of Mumbai's gate
      const tx = side * (w - 0.04); cityPaint(ctx, s.light, 0.97); cityRect(ctx, x0, gy, u, tx - 0.04, h, 0.08, 0.1);
      ctx.beginPath(); ctx.arc(x0 + tx * u, gy - (h + 0.1) * u, 0.045 * u, Math.PI, 0); ctx.fill();
    });
    cityGlow(ctx, '#ffd48a', 0.2 + 0.25 * blinking(t, 0.4)); cityRect(ctx, x0, gy, u, -0.14, 0, 0.28, 0.12);
    cityPaint(ctx, colours.shade, 0.45);
  },

  // Mountains and volcanoes: table mountain, Vesuvius, the Matterhorn, Mont Blanc, terraces, Corcovado.
  peak(ctx, c) {
    const { m, gy, style: s, t } = c, u = Math.min(m.height * 0.95, m.width * 0.95), x0 = m.x;
    const shapes = {
      table: [[-0.5, 0], [-0.46, 0.35], [-0.4, 0.5], [-0.3, 0.58], [0.3, 0.58], [0.38, 0.5], [0.46, 0.35], [0.5, 0]],
      volcano: [[-0.55, 0], [-0.12, 0.5], [-0.06, 0.52], [0.06, 0.52], [0.12, 0.5], [0.55, 0]],
      horn: [[-0.42, 0], [-0.22, 0.4], [-0.1, 0.7], [-0.04, 0.95], [0.02, 1], [0.07, 0.8], [0.16, 0.62], [0.3, 0.3], [0.45, 0]],
      mont: [[-0.55, 0], [-0.38, 0.45], [-0.28, 0.38], [-0.12, 0.8], [0, 1], [0.1, 0.75], [0.22, 0.82], [0.34, 0.45], [0.55, 0]],
      terraces: [[-0.5, 0], [-0.3, 0.35], [-0.1, 0.9], [0.05, 0.7], [0.2, 0.4], [0.5, 0]],
      rio: [[-0.55, 0], [-0.4, 0.3], [-0.25, 0.6], [-0.12, 0.78], [0, 0.82], [0.1, 0.6], [0.2, 0.3], [0.55, 0]]
    };
    landmarkPath(ctx, shapes[s.kind] || shapes.mont, x0, gy, u);
    litFill(ctx, gy - u, gy, s.light, s.dark); ctx.fill();
    if (s.kind === 'horn' || s.kind === 'mont') {
      const snow = s.kind === 'horn' ? [[-0.1, 0.7], [-0.04, 0.95], [0.02, 1], [0.07, 0.8], [0, 0.76], [-0.05, 0.8]] : [[-0.12, 0.8], [0, 1], [0.1, 0.75], [0.0, 0.72], [-0.06, 0.78]];
      landmarkPath(ctx, snow, x0, gy, u); cityPaint(ctx, '#f6f9ff', 0.95); ctx.fill();
    }
    if (s.kind === 'table') { // the tablecloth: a cloud rolling over the top
      cityGlow(ctx, '#ffffff', 0.35); ctx.beginPath(); ctx.ellipse(x0 + Math.sin(t * 0.2) * 0.05 * u, gy - 0.6 * u, 0.3 * u, 0.035 * u, 0, 0, CITY_TAU); ctx.fill();
    }
    if (s.kind === 'volcano') { // glowing crater and smoke
      cityGlow(ctx, '#ff7a2f', 0.5 + 0.3 * Math.sin(t * 2.1)); ctx.beginPath(); ctx.ellipse(x0, gy - 0.52 * u, 0.06 * u, 0.016 * u, 0, 0, CITY_TAU); ctx.fill();
      for (let i = 0; i < 5; i++) { const k = ((t * 0.12 + i / 5) % 1); cityPaint(ctx, '#8a8f99', 0.35 * (1 - k)); ctx.beginPath(); ctx.arc(x0 + k * 0.12 * u + Math.sin(i) * 0.02 * u, gy - (0.55 + k * 0.4) * u, (0.02 + k * 0.05) * u, 0, CITY_TAU); ctx.fill(); }
    }
    if (s.kind === 'terraces') { cityPaint(ctx, 'rgba(20,50,20,.55)', 0.55); for (let i = 0; i < 6; i++) cityRect(ctx, x0, gy, u, -0.3 + i * 0.05, 0.05 + i * 0.08, 0.5 - i * 0.07, 0.01); }
    if (s.kind === 'rio') { // the statue on top, lit up and with open arms
      cityPaint(ctx, '#f4f6f2', 0.97); cityRect(ctx, x0, gy, u, -0.008, 0.82, 0.016, 0.09); cityRect(ctx, x0, gy, u, -0.045, 0.88, 0.09, 0.012);
      ctx.beginPath(); ctx.arc(x0, gy - 0.915 * u, 0.012 * u, 0, CITY_TAU); ctx.fill();
      cityGlow(ctx, '#fffbe0', 0.4 + 0.3 * blinking(t, 0.5)); ctx.beginPath(); ctx.arc(x0, gy - 0.88 * u, 0.05 * u, 0, CITY_TAU); ctx.fill();
    }
  }
};

function drawCityLandmark(ctx, scene, t, beat) {
  const m = scene.landmark, style = BACKDROP_LANDMARK_STYLES[m.kind], draw = style && CITY_SHAPES[style.shape];
  if (!draw) return;
  draw(ctx, { m, gy: m.ground, W: scene.W, H: scene.H, colours: scene.colours, t, beat, style });
}
