// Festival backdrop on the Overview (feature-plans/festival-backdrop.md).
// An animated live stage on a <canvas>: lasers, light cones, haze, an LED wall, confetti and a
// crowd that moves to the beat. Colours, tempo and landscape come from rules/backdrop-rules.js.
// Decorative only: nothing is saved or sent. Each frame is a pure function of the time, so the
// drawing can be tested without a browser.

// --- Layout: everything that does not move, worked out once per size and festival ----------

function buildStageScene(backdrop, W, H) {
  const rnd = backdropRandom(backdrop.seed);
  const r = (min, max) => min + rnd() * (max - min);
  const horizon = H * 0.66;
  const stageW = Math.min(W * 0.34, 400), cx = W * (backdrop.landmark ? 0.45 : 0.58); // with a landmark the stage steps aside
  const stage = { cx, x: cx - stageW / 2, w: stageW, top: H * 0.43, floor: H * 0.78 };

  const stars = Array.from({ length: Math.round(W / 9) }, () => ({ x: r(0, W), y: r(0, H * 0.45), size: r(0.5, 1.6), phase: r(0, 6.3), speed: r(0.8, 2.4) }));
  const aurora = [0, 1, 2].map(i => ({ x: W * (0.15 + i * 0.35), y: H * r(0.1, 0.3), radius: W * r(0.22, 0.34), speed: r(0.05, 0.12), phase: r(0, 6.3) }));
  const sun = { x: rnd() < 0.5 || backdrop.landmark ? W * r(0.08, 0.22) : W * r(0.86, 0.95), y: horizon - H * r(0.12, 0.2), radius: H * r(0.08, 0.11) };

  // The famous landmark stands to the right of the stage, on the ground of the landscape.
  const ground = H * 0.86; // ground level: the landmark stands among the crowd, whose back row hides its feet
  const zoneLeft = stage.x + stage.w + 34;
  const landmark = backdrop.landmark ? { kind: backdrop.landmark, left: zoneLeft, right: W, x: (zoneLeft + W) / 2, ground,
    width: W - zoneLeft, height: H * 0.62,
    sparkles: Array.from({ length: 34 }, () => ({ y: r(0.04, 0.9), side: r(-0.85, 0.85), phase: r(0, 6.3) })),
    houses: Array.from({ length: 8 }, () => ({ h: r(0.22, 0.38), step: rnd() < 0.5 })),
    windows: Array.from({ length: 60 }, () => ({ x: r(-0.5, 0.5), y: r(0.05, 0.95), phase: r(0, 6.3) })) } : null;

  // The landscape behind the stage.
  const land = { kind: backdrop.scene, layers: [], windows: [], trees: [] };
  if (backdrop.scene === 'mountains') {
    [[horizon + 4, H * 0.26, 0.5, W / 9], [horizon + H * 0.08, H * 0.16, 0.85, W / 12]].forEach(([base, height, alpha, step]) => {
      const points = [[0, base]];
      for (let x = 0; x < W + step; x += r(step * 0.6, step * 1.3)) points.push([x, base - r(height * 0.35, height)], [x + r(step * 0.3, step * 0.6), base - r(height * 0.1, height * 0.4)]);
      land.layers.push({ points, alpha });
    });
  } else if (backdrop.scene === 'field') {
    [[horizon + 6, H * 0.08, 0.55], [horizon + H * 0.09, H * 0.06, 0.9]].forEach(([base, height, alpha]) => {
      const points = [[0, base]];
      for (let x = 0; x <= W + 40; x += 40) points.push([x, base - height * (0.5 + 0.5 * Math.sin(x / W * 6.3 + alpha * 7))]);
      land.layers.push({ points, alpha });
    });
    for (let i = 0; i < 12; i++) land.trees.push({ x: rnd() < 0.5 ? r(0, stage.x - 20) : r(stage.x + stage.w + 20, W), h: r(H * 0.08, H * 0.15) });
  } else if (backdrop.scene === 'city') {
    for (let x = -10; x < W; ) {
      const w = r(W * 0.025, W * 0.06), h = r(H * 0.12, H * 0.42);
      land.layers.push({ x, w, h });
      for (let i = 0; i < 6; i++) if (rnd() < 0.55) land.windows.push({ x: x + r(3, w - 7), y: horizon + H * 0.06 - h + r(6, h - 10), phase: r(0, 6.3) });
      x += w + r(1, 8);
    }
    const ownSkyline = landmark && typeof BACKDROP_LANDMARK_STYLES !== 'undefined' && BACKDROP_LANDMARK_STYLES[landmark.kind] && BACKDROP_LANDMARK_STYLES[landmark.kind].shape === 'skyline';
    if (ownSkyline) { land.layers = []; land.windows = []; } // the city's own skyline replaces the generic one, across the whole horizon
  }

  // The crowd: a smaller back row and a bigger front row; some hold up arms or phones.
  const crowd = [];
  [[H * 0.84, H * 0.03, 0.75, 11], [H * 0.93, H * 0.045, 1, 15]].forEach(([y, size, shade, gap]) => {
    for (let x = -10; x < W + 10; x += r(gap * 0.8, gap * 1.3)) {
      crowd.push({ x, y: y + r(-3, 3), size: size * r(0.8, 1.15), shade, phase: r(0, 1), arm: rnd() < 0.18 ? (rnd() < 0.5 ? -1 : 1) : 0, phone: rnd() < 0.07 });
    }
  });

  const haze = Array.from({ length: 80 }, () => ({ x: stage.cx + r(-W * 0.35, W * 0.35), y: r(0, H), size: r(0.8, 2.4), speed: r(6, 22), phase: r(0, 6.3) }));
  return { W, H, horizon, stage, stars, aurora, sun, land, landmark, crowd, haze, colours: backdrop.colours, bpm: backdrop.bpm, seed: backdrop.seed };
}

// --- One frame at time t (seconds) ----------------------------------------------------------

function drawStageFrame(ctx, scene, t) {
  const { W, H, horizon, stage, colours } = scene;
  const [laserA, laserB] = colours.lasers;
  const beat = t * scene.bpm / 60;
  const pulse = Math.pow(1 - (beat % 1), 3); // 1 on the beat, fading until the next one
  const TAU = Math.PI * 2;

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  // Sky.
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, colours.sky[0]); sky.addColorStop(0.62, colours.sky[1]); sky.addColorStop(1, colours.sky[2]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

  // Aurora: big soft colour clouds drifting slowly.
  ctx.globalCompositeOperation = 'lighter';
  scene.aurora.forEach((cloud, i) => {
    const x = cloud.x + Math.sin(t * cloud.speed + cloud.phase) * W * 0.12, y = cloud.y + Math.cos(t * cloud.speed * 1.3 + cloud.phase) * H * 0.06;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, cloud.radius);
    glow.addColorStop(0, i % 2 ? laserA : laserB); glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.16; ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  });

  // Twinkling stars.
  ctx.fillStyle = '#ffffff';
  scene.stars.forEach(star => {
    ctx.globalAlpha = 0.25 + 0.6 * (0.5 + 0.5 * Math.sin(t * star.speed + star.phase));
    ctx.fillRect(star.x, star.y, star.size, star.size);
  });

  // Sun or moon with its glow.
  const sunGlow = ctx.createRadialGradient(scene.sun.x, scene.sun.y, 0, scene.sun.x, scene.sun.y, scene.sun.radius * 3.2);
  sunGlow.addColorStop(0, colours.sun); sunGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.55; ctx.fillStyle = sunGlow; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.95; ctx.fillStyle = colours.sun;
  ctx.beginPath(); ctx.arc(scene.sun.x, scene.sun.y, scene.sun.radius, 0, TAU); ctx.fill();

  drawLand(ctx, scene, t);
  if (scene.landmark) drawLandmark(ctx, scene, t, beat);

  // Wide light cones from both sides of the stage roof, sweeping slowly.
  ctx.globalCompositeOperation = 'lighter';
  [[stage.x + stage.w * 0.12, 1], [stage.x + stage.w * 0.88, -1]].forEach(([x, side], i) => {
    const angle = -Math.PI / 2 + side * (0.25 + 0.35 * Math.sin(t * 0.45 + i * 1.7));
    drawBeam(ctx, x, stage.top, angle, H * 1.4, 0.22, i ? laserB : laserA, 0.16 + 0.1 * pulse);
  });

  // Lasers: thin bright lines from the stage, changing pattern every 16 beats.
  const pattern = Math.floor(beat / 16) % 3, count = 9;
  for (let i = 0; i < count; i++) {
    const k = i / (count - 1) - 0.5;
    let x = stage.cx, angle;
    if (pattern === 0) angle = -Math.PI / 2 + k * 1.5 + Math.sin(t * 0.8) * 0.35;                 // fan sweeping
    else if (pattern === 1) { x = k < 0 ? stage.x + 20 : stage.x + stage.w - 20; angle = -Math.PI / 2 + (k < 0 ? 1 : -1) * (0.2 + Math.abs(k) * 1.1) * Math.sin(t * 0.9 + Math.abs(k) * 2); } // crossing
    else angle = -Math.PI / 2 + Math.sin(t * 0.6 + k * 4) * 0.9;                                // waving
    drawLaser(ctx, x, stage.top + 6, angle, H * 1.5, i % 2 ? laserB : laserA, 0.35 + 0.65 * pulse);
  }

  // Haze drifting up through the light.
  ctx.fillStyle = '#ffffff';
  scene.haze.forEach(p => {
    const y = ((p.y - t * p.speed) % H + H) % H, x = p.x + Math.sin(t * 0.3 + p.phase) * 18;
    ctx.globalAlpha = 0.08 + 0.18 * (1 - Math.abs(x - stage.cx) / (W * 0.4)) * (y / H);
    if (ctx.globalAlpha > 0) ctx.fillRect(x, y, p.size, p.size);
  });

  drawStage(ctx, scene, beat, pulse);
  drawConfetti(ctx, scene, beat);

  // Light spilling from the stage over the crowd, so the crowd stands out as silhouettes.
  ctx.globalCompositeOperation = 'lighter';
  // A soft oval of light from the bottom centre (a squashed circle, so there are no hard edges).
  ctx.save();
  ctx.translate(stage.cx, H);
  ctx.scale(1, 0.24);
  const spill = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.6);
  spill.addColorStop(0, laserB); spill.addColorStop(0.4, laserA); spill.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.38 + 0.22 * pulse; ctx.fillStyle = spill;
  ctx.fillRect(-W, -W * 0.6, W * 2, W * 0.6);
  ctx.restore();
  drawCrowd(ctx, scene, beat, t);

  // Darker left side so the festival name stays readable.
  ctx.globalCompositeOperation = 'source-over';
  const shadeLeft = ctx.createLinearGradient(0, 0, W * 0.55, 0);
  shadeLeft.addColorStop(0, 'rgba(0,0,0,0.45)'); shadeLeft.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 1; ctx.fillStyle = shadeLeft; ctx.fillRect(0, 0, W, H);
}

function drawBeam(ctx, x, y, angle, length, width, colour, alpha) {
  const ex = x + Math.cos(angle) * length, ey = y + Math.sin(angle) * length;
  const nx = Math.cos(angle + Math.PI / 2) * length * width, ny = Math.sin(angle + Math.PI / 2) * length * width;
  const fade = ctx.createLinearGradient(x, y, ex, ey);
  fade.addColorStop(0, colour); fade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha; ctx.fillStyle = fade;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex + nx, ey + ny); ctx.lineTo(ex - nx, ey - ny); ctx.closePath(); ctx.fill();
}

function drawLaser(ctx, x, y, angle, length, colour, strength) {
  const ex = x + Math.cos(angle) * length, ey = y + Math.sin(angle) * length;
  ctx.strokeStyle = colour; ctx.lineCap = 'round';
  [[7, 0.10], [3, 0.25], [1.2, 0.9]].forEach(([width, alpha]) => {
    ctx.globalAlpha = alpha * strength; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
  });
}

function drawLand(ctx, scene, t) {
  const { W, H, horizon, land, colours } = scene;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = colours.shade;
  if (land.kind === 'coast') {
    // The sea lies at the horizon; in front of it is a beach, so stage, crowd and landmarks stand on land, not in the water.
    const shore = horizon + H * 0.12;
    ctx.globalAlpha = 0.6; ctx.fillRect(0, horizon, W, shore - horizon);
    ctx.strokeStyle = colours.sun; ctx.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) {
      const y = horizon + 6 + i * H * 0.025, length = 90 + i * 15, shift = (t * (14 + i * 6)) % length;
      ctx.globalAlpha = 0.5 - i * 0.08;
      ctx.beginPath(); ctx.moveTo(-length, y);
      for (let x = -length; x <= W + length; x += length / 8) ctx.lineTo(x + shift, y + Math.sin((x / length) * Math.PI * 2) * (2 + i));
      ctx.stroke();
    }
    ctx.globalAlpha = 0.95; ctx.fillRect(0, shore, W, H - shore); // the beach
    ctx.globalAlpha = 0.35; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; // foam at the water's edge
    ctx.beginPath(); ctx.moveTo(0, shore); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, shore + Math.sin(x * 0.05 + t * 1.2) * 1.5); ctx.stroke();
    return;
  }
  if (land.kind === 'city') {
    ctx.globalAlpha = 0.85;
    land.layers.forEach(b => ctx.fillRect(b.x, horizon + H * 0.06 - b.h, b.w, b.h + H));
    ctx.fillStyle = colours.sun;
    land.windows.forEach(w => { ctx.globalAlpha = 0.2 + 0.5 * (Math.sin(t * 0.7 + w.phase) > -0.3 ? 1 : 0.2); ctx.fillRect(w.x, w.y, 3, 4); });
    return;
  }
  land.layers.forEach((layer, i) => {
    ctx.globalAlpha = layer.alpha;
    ctx.beginPath(); ctx.moveTo(0, H);
    layer.points.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    if (i === 0 && land.trees.length) {
      ctx.globalAlpha = 0.75;
      land.trees.forEach(tree => { const y = horizon + H * 0.1; ctx.beginPath(); ctx.moveTo(tree.x, y - tree.h); ctx.lineTo(tree.x - tree.h * 0.3, y); ctx.lineTo(tree.x + tree.h * 0.3, y); ctx.closePath(); ctx.fill(); });
    }
  });
}

// --- Famous landmarks, lit up like at night ---------------------------------------------------

// Fills the current path with a warm light that is brighter at the bottom.
function litFill(ctx, top, bottom, light, dark, alpha = 0.95) {
  const glow = ctx.createLinearGradient(0, bottom, 0, top);
  glow.addColorStop(0, light); glow.addColorStop(1, dark);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = alpha; ctx.fillStyle = glow;
}
// Draws a shape given in units of the landmark's height (x to the right, y upwards).
function landmarkPath(ctx, points, x0, y0, u) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x0 + x * u, y0 - y * u) : ctx.moveTo(x0 + x * u, y0 - y * u));
  ctx.closePath();
}
function mirrored(half) { return [...half, ...half.slice(0, -1).reverse().map(([x, y]) => [-x, y])]; }
function blinking(t, speed, phase = 0) { return Math.sin(t * speed + phase) > 0 ? 1 : 0.15; }

function drawLandmark(ctx, scene, t, beat) {
  const m = scene.landmark, { W, H, colours } = scene, gy = m.ground;
  const [laserA, laserB] = colours.lasers;
  // Ground: the sky fades into dark earth down to the crowd, so the landmark stands at ground level.
  ctx.save();
  const soilTop = scene.horizon + (scene.land.kind === 'coast' ? H * 0.12 : 0), soil = ctx.createLinearGradient(0, soilTop, 0, H);
  soil.addColorStop(0, 'rgba(5,3,10,0)'); soil.addColorStop(0.45, colours.shade); soil.addColorStop(1, '#05030a');
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.97; ctx.fillStyle = soil; ctx.fillRect(0, soilTop, W, H - soilTop);
  ctx.restore();
  if (typeof BACKDROP_LANDMARK_STYLES !== 'undefined' && BACKDROP_LANDMARK_STYLES[m.kind]) { // the 100 more cities
    ctx.save();
    if (typeof drawCityLandmark === 'function') drawCityLandmark(ctx, scene, t, beat);
    ctx.restore();
    return;
  }
  ctx.save();
  if (m.kind === 'eiffel') {
    const u = Math.min(m.height, m.width * 2.4), x0 = m.x;
    const half = [[-0.21, 0], [-0.125, 0.18], [-0.14, 0.2], [-0.14, 0.235], [-0.1, 0.235], [-0.065, 0.45], [-0.075, 0.47], [-0.075, 0.5], [-0.046, 0.5], [-0.022, 0.8], [-0.012, 0.96], [0, 1]];
    landmarkPath(ctx, mirrored(half), x0, gy, u);
    ctx.moveTo(x0 - 0.15 * u, gy); ctx.quadraticCurveTo(x0, gy - 0.22 * u, x0 + 0.15 * u, gy); ctx.closePath(); // the arch
    litFill(ctx, gy - u, gy, '#ffd27a', '#c9801f'); ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(60,30,0,.45)'; ctx.lineWidth = 1;
    for (let k = 0; k < 4; k++) { const y1 = 0.24 + k * 0.05, y2 = y1 + 0.05; ctx.beginPath(); ctx.moveTo(x0 - (0.1 - k * 0.008) * u, gy - y1 * u); ctx.lineTo(x0 + (0.1 - k * 0.008) * u, gy - y2 * u); ctx.moveTo(x0 + (0.1 - k * 0.008) * u, gy - y1 * u); ctx.lineTo(x0 - (0.1 - k * 0.008) * u, gy - y2 * u); ctx.stroke(); }
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffffff';
    m.sparkles.forEach(s => { // the famous sparkle
      ctx.globalAlpha = Math.pow(Math.max(0, Math.sin(t * 7 + s.phase)), 12);
      if (ctx.globalAlpha > 0.02) ctx.fillRect(x0 + s.side * 0.2 * Math.pow(1 - s.y, 1.7) * u - 1, gy - s.y * u - 1, 2.4, 2.4);
    });
    drawBeam(ctx, x0, gy - u, -Math.PI / 2 + Math.sin(t * 0.5) * 1.35, W * 0.7, 0.02, '#fff3c4', 0.3); // searchlight
  } else if (m.kind === 'bigben') {
    const u = Math.min(m.height * 0.95, m.width * 2), x0 = m.left + Math.min(m.width * 0.22, u * 0.12);
    landmarkPath(ctx, [[-0.05, 0], [-0.05, 0.6], [-0.066, 0.6], [-0.066, 0.73], [-0.05, 0.75], [-0.03, 0.9], [0, 1], [0.03, 0.9], [0.05, 0.75], [0.066, 0.73], [0.066, 0.6], [0.05, 0.6], [0.05, 0]], x0, gy, u);
    litFill(ctx, gy - u, gy, '#f2c879', '#9a6a2c'); ctx.fill();
    const cy = gy - 0.665 * u, cr = 0.04 * u;
    ctx.globalAlpha = 0.95; ctx.fillStyle = '#fff4d6'; ctx.beginPath(); ctx.arc(x0, cy, cr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2b1d0e'; ctx.lineWidth = 1.4; ctx.beginPath();
    ctx.moveTo(x0, cy); ctx.lineTo(x0 + Math.cos(t * 0.3) * cr * 0.8, cy + Math.sin(t * 0.3) * cr * 0.8);
    ctx.moveTo(x0, cy); ctx.lineTo(x0 + Math.cos(t * 0.025 - 1) * cr * 0.55, cy + Math.sin(t * 0.025 - 1) * cr * 0.55); ctx.stroke();
    // The London Eye, turning slowly.
    const R = Math.min(0.32 * u, m.width * 0.42), ex = Math.min(W - R * 0.35, x0 + 0.12 * u + R), ey = gy - R - 0.05 * u;
    ctx.globalAlpha = 0.9; ctx.strokeStyle = colours.shade; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(ex - R * 0.5, gy); ctx.lineTo(ex, ey); ctx.lineTo(ex + R * 0.15, gy); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#dfe6ff'; ctx.lineWidth = 1;
    ctx.globalAlpha = 0.35; ctx.beginPath();
    for (let i = 0; i < 20; i++) { const a = t * 0.08 + i * Math.PI / 10; ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(a) * R, ey + Math.sin(a) * R); }
    ctx.stroke();
    ctx.globalAlpha = 0.85; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(ex, ey, R, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 32; i++) { const a = t * 0.08 + i * Math.PI / 16; ctx.fillStyle = i % 2 ? laserA : laserB; ctx.globalAlpha = 0.9; ctx.fillRect(ex + Math.cos(a) * R - 2, ey + Math.sin(a) * R - 2, 4, 4); }
  } else if (m.kind === 'bridge') {
    // A suspension bridge entirely to the right of the stage: two towers, a deck above the crowd, piers down to the ground.
    const deck = gy - H * 0.1, xa = m.left + m.width * 0.24, xb = m.left + m.width * 0.82, th = Math.min(H * 0.3, m.height * 0.5), mid = (xa + xb) / 2;
    const cableY = x => { const k = (x - mid) / ((xb - xa) / 2); return deck - th + (th - 8) * (1 - k * k); };
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.95; ctx.fillStyle = '#6e2018';
    [xa, xb].forEach(x => { ctx.fillRect(x - 6, deck, 4, gy - deck); ctx.fillRect(x + 2, deck, 4, gy - deck); }); // piers
    ctx.strokeStyle = '#d2412f'; ctx.lineWidth = 1;
    ctx.beginPath(); for (let x = xa + 8; x < xb; x += 9) { ctx.moveTo(x, cableY(x)); ctx.lineTo(x, deck); } ctx.stroke(); // hangers
    ctx.lineWidth = 2.4; ctx.beginPath();
    ctx.moveTo(xa, deck - th); ctx.quadraticCurveTo(mid, deck - th + (th - 8) * 2, xb, deck - th); // main cable
    ctx.moveTo(xa, deck - th); ctx.quadraticCurveTo((xa + m.left) / 2, deck - th * 0.45, m.left, deck); // back stays
    ctx.moveTo(xb, deck - th); ctx.quadraticCurveTo((xb + W) / 2, deck - th * 0.45, W, deck);
    ctx.stroke();
    ctx.fillStyle = '#b8352a'; [xa, xb].forEach(x => { ctx.fillRect(x - 5, deck - th - 4, 3, th + 4); ctx.fillRect(x + 2, deck - th - 4, 3, th + 4); [0.1, 0.45, 0.8].forEach(k => ctx.fillRect(x - 5, deck - th + th * k, 10, 3)); });
    ctx.fillStyle = '#7d2219'; ctx.fillRect(m.left, deck, W - m.left, 5);
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffe2a8';
    for (let x = m.left; x < W; x += 16) { ctx.globalAlpha = 0.45 + 0.4 * blinking(t, 1.3, x); ctx.fillRect(x, deck + 1, 2, 2); }
  } else if (m.kind === 'frauenkirche') {
    const u = Math.min(m.height * 0.82, m.width * 1.5), x0 = m.x;
    landmarkPath(ctx, [[-0.3, 0], [-0.3, 0.27], [0, 0.4], [0.3, 0.27], [0.3, 0]], x0, gy, u);
    litFill(ctx, gy - 0.4 * u, gy, '#e8b47a', '#8a5a2e', 0.9); ctx.fill();
    [-0.11, 0.11].forEach(dx => {
      landmarkPath(ctx, [[dx - 0.065, 0], [dx - 0.065, 0.64], [dx + 0.065, 0.64], [dx + 0.065, 0]], x0, gy, u);
      litFill(ctx, gy - 0.64 * u, gy, '#f0c08a', '#9b6636'); ctx.fill();
      ctx.globalAlpha = 0.95; ctx.fillStyle = '#6f9c86'; ctx.beginPath(); ctx.ellipse(x0 + dx * u, gy - 0.7 * u, 0.068 * u, 0.075 * u, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = colours.shade; ctx.fillRect(x0 + dx * u - 1, gy - 0.82 * u, 2, 0.06 * u);
      ctx.fillStyle = '#fff1cf'; ctx.beginPath(); ctx.arc(x0 + dx * u, gy - 0.55 * u, 0.025 * u, 0, Math.PI * 2); ctx.fill();
    });
  } else if (m.kind === 'fernsehturm') {
    const u = Math.min(m.height, m.width * 3), x0 = m.left + Math.min(m.width * 0.3, u * 0.2);
    landmarkPath(ctx, [[-0.026, 0], [-0.014, 0.62], [0.014, 0.62], [0.026, 0]], x0, gy, u);
    litFill(ctx, gy - 0.62 * u, gy, '#cfd8e3', '#7d8794'); ctx.fill();
    const sy = gy - 0.68 * u, sr = 0.075 * u, ball = ctx.createRadialGradient(x0 - sr * 0.4, sy - sr * 0.4, 1, x0, sy, sr);
    ball.addColorStop(0, '#f4f7fb'); ball.addColorStop(1, '#7a8796');
    ctx.globalAlpha = 0.97; ctx.fillStyle = ball; ctx.beginPath(); ctx.arc(x0, sy, sr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe9b0'; ctx.fillRect(x0 - sr * 0.95, sy - 1.5, sr * 1.9, 3);
    ctx.fillStyle = '#c8d0da'; ctx.fillRect(x0 - 0.009 * u, gy - 0.88 * u, 0.018 * u, 0.13 * u); ctx.fillRect(x0 - 0.0035 * u, gy - u, 0.007 * u, 0.13 * u);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = blinking(t, 3); ctx.fillStyle = '#ff2b2b';
    ctx.beginPath(); ctx.arc(x0, gy - u, 3, 0, Math.PI * 2); ctx.fill();
    const gx = x0 + Math.max(0.2 * u, 46), gw = Math.min(0.36 * u, W - gx - 6), gh = gw * 0.42; // Brandenburg Gate
    if (gw > 40) {
      ctx.globalCompositeOperation = 'source-over';
      landmarkPath(ctx, [[0, 0], [0, 0.8], [0.42, 0.8], [0.44, 1], [0.56, 1], [0.58, 0.8], [1, 0.8], [1, 0]], gx, gy, 1);
      ctx.beginPath(); ctx.rect(gx, gy - gh * 0.8, gw, gh * 0.8); ctx.rect(gx + gw * 0.4, gy - gh, gw * 0.2, gh * 0.2);
      litFill(ctx, gy - gh, gy, '#f3d29b', '#a7783f'); ctx.fill();
      ctx.fillStyle = colours.shade; ctx.globalAlpha = 0.8;
      for (let i = 0; i < 5; i++) ctx.fillRect(gx + gw * (0.07 + i * 0.185), gy - gh * 0.62, gw * 0.1, gh * 0.62);
    }
  } else if (m.kind === 'colosseum') {
    const w = Math.min(m.width * 0.96, m.height * 1.25), h = w * 0.34, x0 = m.x - w / 2;
    ctx.beginPath(); ctx.moveTo(x0, gy); ctx.lineTo(x0, gy - h); ctx.lineTo(x0 + w * 0.62, gy - h); ctx.lineTo(x0 + w, gy - h * 0.66); ctx.lineTo(x0 + w, gy); ctx.closePath();
    litFill(ctx, gy - h, gy, '#f0bd78', '#9c6633'); ctx.fill();
    ctx.fillStyle = 'rgba(40,18,5,.75)';
    [[0.08, 0.3], [0.38, 0.6], [0.68, 0.86]].forEach(([y1, y2], row) => {
      for (let i = 0; i < 10; i++) {
        const ax = x0 + w * (0.03 + i * 0.097), roof = i / 10 > 0.62 ? 1 - (i / 10 - 0.62) / 0.38 * 0.34 : 1;
        if (y2 < roof - 0.04) { ctx.beginPath(); ctx.moveTo(ax, gy - y1 * h); ctx.lineTo(ax, gy - (y2 - 0.06) * h); ctx.quadraticCurveTo(ax + w * 0.03, gy - y2 * h - 3, ax + w * 0.06, gy - (y2 - 0.06) * h); ctx.lineTo(ax + w * 0.06, gy - y1 * h); ctx.closePath(); ctx.fill(); }
      }
    });
  } else if (m.kind === 'sagrada') {
    const u = Math.min(m.height, m.width * 1.4), x0 = m.x;
    landmarkPath(ctx, [[-0.26, 0], [-0.26, 0.24], [0.26, 0.24], [0.26, 0]], x0, gy, u);
    litFill(ctx, gy - 0.24 * u, gy, '#e9bb85', '#8f5f32'); ctx.fill();
    [[0, 1], [-0.07, 0.86], [0.07, 0.84], [-0.15, 0.74], [0.15, 0.72], [-0.22, 0.56], [0.22, 0.55]].forEach(([dx, top]) => {
      landmarkPath(ctx, [[dx - 0.026, 0.2], [dx - 0.012, top - 0.06], [dx, top], [dx + 0.012, top - 0.06], [dx + 0.026, 0.2]], x0, gy, u);
      litFill(ctx, gy - top * u, gy - 0.2 * u, '#f3c88f', '#9a6a39'); ctx.fill();
      ctx.globalAlpha = 0.95; ctx.fillStyle = colours.sun; ctx.beginPath(); ctx.arc(x0 + dx * u, gy - top * u, Math.max(1.5, 0.01 * u), 0, Math.PI * 2); ctx.fill();
    });
  } else if (m.kind === 'empire') {
    const u = Math.min(m.height, m.width * 2.6), x0 = m.x;
    landmarkPath(ctx, mirrored([[-0.13, 0], [-0.13, 0.55], [-0.1, 0.55], [-0.1, 0.68], [-0.07, 0.68], [-0.07, 0.77], [-0.045, 0.77], [-0.045, 0.84], [-0.02, 0.84], [-0.02, 0.9], [-0.004, 0.9], [-0.004, 1], [0, 1]]), x0, gy, u);
    ctx.globalAlpha = 0.97; ctx.fillStyle = colours.shade; ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    m.windows.forEach(w => { if (w.y < 0.75) { ctx.globalAlpha = 0.25 + 0.35 * blinking(t, 0.4, w.phase); ctx.fillStyle = colours.sun; ctx.fillRect(x0 + w.x * 0.2 * u * (w.y < 0.55 ? 1 : 0.7), gy - w.y * u, 2, 3); } });
    const top = Math.floor(beat / 4) % 2 ? laserA : laserB; // the top changes colour every 4 beats
    ctx.globalAlpha = 0.85; ctx.fillStyle = top;
    ctx.fillRect(x0 - 0.045 * u, gy - 0.84 * u, 0.09 * u, 0.07 * u); ctx.fillRect(x0 - 0.02 * u, gy - 0.9 * u, 0.04 * u, 0.06 * u);
    ctx.globalAlpha = blinking(t, 2.6); ctx.fillStyle = '#ff2b2b'; ctx.fillRect(x0 - 1.5, gy - u - 2, 3, 3);
  } else if (m.kind === 'opera') {
    const w = Math.min(m.width * 0.98, m.height * 1.3), x0 = m.x, base = gy - w * 0.04;
    ctx.globalAlpha = 0.9; ctx.fillStyle = '#a99a83'; ctx.fillRect(x0 - w * 0.5, base, w, w * 0.05);
    [[-0.46, -0.2, 0.5], [-0.26, 0.0, 0.66], [-0.06, 0.18, 0.56], [0.14, 0.34, 0.44], [0.28, 0.46, 0.32]].forEach(([a, b, h]) => {
      const xa = x0 + a * w, xb = x0 + b * w, top = base - h * w * 0.5;
      ctx.beginPath(); ctx.moveTo(xa, base); ctx.quadraticCurveTo(xa + (xb - xa) * 0.05, top, xb, top + (base - top) * 0.12); ctx.lineTo(xb, base); ctx.closePath();
      litFill(ctx, top, base, '#fffaf0', '#d9d2c3'); ctx.fill();
      ctx.strokeStyle = 'rgba(90,80,60,.4)'; ctx.lineWidth = 1; ctx.stroke();
    });
  } else if (m.kind === 'riesenrad') {
    const R = Math.min(m.height * 0.42, m.width * 0.44), cx = m.x, cy = gy - R - m.height * 0.06;
    ctx.globalAlpha = 0.95; ctx.strokeStyle = colours.shade; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx - R * 0.55, gy); ctx.lineTo(cx, cy); ctx.lineTo(cx + R * 0.55, gy); ctx.stroke();
    ctx.strokeStyle = '#e8443a'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i < 30; i++) { const a = t * 0.06 + i * Math.PI / 15; ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); }
    ctx.stroke();
    ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, R * 0.93, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 15; i++) {
      const a = t * 0.06 + i * Math.PI * 2 / 15, px = cx + Math.cos(a) * R, py = cy + Math.sin(a) * R;
      ctx.fillStyle = '#c0392b'; ctx.fillRect(px - 5, py, 10, 8); ctx.fillStyle = '#ffd88a'; ctx.fillRect(px - 3, py + 2, 6, 3);
    }
  } else if (m.kind === 'canals') {
    const n = m.houses.length, hw = m.width / n;
    m.houses.forEach((house, i) => {
      const x = m.left + i * hw, h = house.h * m.height, top = gy - h;
      ctx.beginPath(); ctx.moveTo(x + 1, gy); ctx.lineTo(x + 1, top + hw * 0.4);
      if (house.step) { ctx.lineTo(x + hw * 0.2, top + hw * 0.4); ctx.lineTo(x + hw * 0.2, top + hw * 0.15); ctx.lineTo(x + hw * 0.8, top + hw * 0.15); ctx.lineTo(x + hw * 0.8, top + hw * 0.4); }
      else ctx.lineTo(x + hw / 2, top);
      ctx.lineTo(x + hw - 1, top + hw * 0.4); ctx.lineTo(x + hw - 1, gy); ctx.closePath();
      ctx.globalAlpha = 0.97; ctx.fillStyle = ['#2b1a14', '#33231a', '#241812'][i % 3]; ctx.fill();
      ctx.fillStyle = '#ffd48a';
      for (let row = 0; row < 4; row++) for (let col = 0; col < 2; col++) {
        const wy = top + hw * 0.55 + row * (h - hw * 0.7) / 4;
        if (wy < gy - 6) { ctx.globalAlpha = 0.35 + 0.5 * blinking(t, 0.3, i * 3 + row + col); ctx.fillRect(x + hw * (0.25 + col * 0.35), wy, hw * 0.16, Math.max(3, hw * 0.18)); }
      }
    });
  } else if (m.kind === 'burj') {
    const u = Math.min(gy - H * 0.04, m.width * 4), x0 = m.x;
    landmarkPath(ctx, mirrored([[-0.09, 0], [-0.09, 0.25], [-0.07, 0.25], [-0.07, 0.45], [-0.05, 0.45], [-0.05, 0.62], [-0.035, 0.62], [-0.035, 0.75], [-0.02, 0.75], [-0.02, 0.85], [-0.01, 0.85], [-0.01, 0.93], [-0.003, 0.93], [-0.002, 1], [0, 1]]), x0, gy, u);
    litFill(ctx, gy - u, gy, '#8fa3b8', '#2e3a48', 0.97); ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = colours.sun;
    for (let i = 0; i < 26; i++) { const y = 0.03 + i * 0.033, wHalf = y < 0.25 ? 0.07 : y < 0.45 ? 0.055 : y < 0.62 ? 0.038 : y < 0.75 ? 0.025 : 0.012; ctx.globalAlpha = 0.25 + 0.3 * blinking(t, 0.5, i); ctx.fillRect(x0 - wHalf * u, gy - y * u, wHalf * 2 * u, 1.2); }
    ctx.globalAlpha = blinking(t, 2.2); ctx.fillStyle = '#ff2b2b'; ctx.fillRect(x0 - 1.5, gy - u - 2, 3, 3);
  }
  ctx.restore();
}

function drawStage(ctx, scene, beat, pulse) {
  const { stage, colours } = scene;
  const [laserA, laserB] = colours.lasers;
  const wall = { x: stage.x + stage.w * 0.16, y: stage.top + 12, w: stage.w * 0.68, h: (stage.floor - stage.top) * 0.52 };
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.fillStyle = colours.shade;
  // Roof, towers, speakers and floor.
  ctx.beginPath(); ctx.moveTo(stage.x - 14, stage.top); ctx.lineTo(stage.cx, stage.top - 26); ctx.lineTo(stage.x + stage.w + 14, stage.top); ctx.closePath(); ctx.fill();
  ctx.fillRect(stage.x - 6, stage.top, stage.w + 12, 9);
  ctx.fillRect(stage.x, stage.top, 9, stage.floor - stage.top);
  ctx.fillRect(stage.x + stage.w - 9, stage.top, 9, stage.floor - stage.top);
  ctx.fillRect(stage.x - 26, stage.floor - 52, 22, 52); ctx.fillRect(stage.x + stage.w + 4, stage.floor - 52, 22, 52);
  ctx.fillRect(stage.x, stage.floor - 14, stage.w, 16);
  // LED wall with an equalizer that jumps to the beat.
  ctx.fillStyle = '#05030a'; ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
  const bars = 22, gap = 2, barW = (wall.w - gap * (bars + 1)) / bars;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < bars; i++) {
    const level = (0.2 + 0.8 * Math.abs(Math.sin(beat * Math.PI * 0.5 + i * 0.55) * Math.cos(beat * 0.25 + i * 0.21))) * (0.55 + 0.45 * pulse);
    const h = Math.max(2, (wall.h - 4) * level);
    ctx.globalAlpha = 0.9; ctx.fillStyle = i % 2 ? laserA : laserB;
    ctx.fillRect(wall.x + gap + i * (barW + gap), wall.y + wall.h - 2 - h, barW, h);
  }
  // Front lights flashing on the beat.
  for (let i = 0; i < 6; i++) {
    const x = stage.x + stage.w * (0.12 + i * 0.152), y = stage.top + 14;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 16);
    glow.addColorStop(0, i % 2 ? laserA : laserB); glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.25 + 0.75 * pulse; ctx.fillStyle = glow; ctx.fillRect(x - 16, y - 16, 32, 32);
  }
}

// Confetti bursts from the stage every 8 beats and falls for about 3 seconds.
function drawConfetti(ctx, scene, beat) {
  const { W, H, stage, colours } = scene;
  const seconds = (beat % 8) * 60 / scene.bpm;
  if (seconds > 3.2) return;
  const rnd = backdropRandom(scene.seed + Math.floor(beat / 8) * 7919);
  const palette = [colours.lasers[0], colours.lasers[1], colours.sun, '#ffffff'];
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 70; i++) {
    const vx = (rnd() - 0.5) * W * 0.55, vy = -(H * 0.7 + rnd() * H * 0.6), spin = rnd() * 10, colour = palette[i % 4];
    const x = stage.cx + vx * seconds, y = stage.top + vy * seconds + 0.5 * H * 1.6 * seconds * seconds;
    if (y > H || y < -20) continue;
    ctx.globalAlpha = Math.max(0, 1 - seconds / 3.2);
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, 2 + 4 * Math.abs(Math.cos(seconds * 6 + spin)), 4);
  }
}

function drawCrowd(ctx, scene, beat, t) {
  const { H, colours } = scene;
  ctx.globalCompositeOperation = 'source-over';
  scene.crowd.forEach(person => {
    const bounce = person.size * 0.6 * Math.abs(Math.sin(Math.PI * (beat + person.phase)));
    const y = person.y - bounce, s = person.size;
    ctx.globalAlpha = person.shade; ctx.fillStyle = colours.shade;
    ctx.beginPath(); ctx.arc(person.x, y, s, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(person.x - s * 1.1, y + s * 0.7, s * 2.2, H - y);
    if (person.arm) {
      const sway = Math.sin(t * 2 + person.phase * 6) * s * 0.6;
      ctx.strokeStyle = colours.shade; ctx.lineWidth = Math.max(2, s * 0.45); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(person.x + person.arm * s * 0.7, y + s); ctx.lineTo(person.x + person.arm * s * 1.3 + sway, y - s * 2.2); ctx.stroke();
      if (person.phone) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(t * 3 + person.phase * 9));
        ctx.fillStyle = '#ffffff'; ctx.fillRect(person.x + person.arm * s * 1.3 + sway - 1.5, y - s * 2.6, 3, 4);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  });
}

// --- The Overview banner: draws, animates, pauses when it cannot be seen --------------------

let overviewBackdropKey = '';
let overviewBackdrop = null;
let overviewStage = null;
let overviewStageSize = '';
let overviewStageFrame = 0;
let overviewStageInView = true;
let overviewStageWatching = false;

function overviewStageCanRun() {
  const box = document.querySelector('#overview-backdrop');
  return Boolean(box && !box.hidden && overviewStageInView && !document.hidden && overviewStage);
}

function prefersStillStage() {
  try { return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch { return false; }
}

function drawOverviewStage(now) {
  overviewStageFrame = 0;
  const canvas = document.querySelector('#overview-backdrop-canvas');
  const ctx = canvas && canvas.getContext && canvas.getContext('2d');
  if (!ctx || !overviewStage) return;
  const ratio = canvas.width / overviewStage.W || 1;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  drawStageFrame(ctx, overviewStage, prefersStillStage() ? 2.6 : now / 1000);
  if (!prefersStillStage() && overviewStageCanRun() && typeof requestAnimationFrame === 'function') {
    overviewStageFrame = requestAnimationFrame(drawOverviewStage);
  }
}

function startOverviewStage() {
  if (overviewStageFrame || !overviewStageCanRun()) return;
  if (typeof requestAnimationFrame === 'function' && !prefersStillStage()) overviewStageFrame = requestAnimationFrame(drawOverviewStage);
  else drawOverviewStage(2600);
}

// Matches the canvas to its box (sharp on retina screens) and rebuilds the layout if needed.
function sizeOverviewStage() {
  const canvas = document.querySelector('#overview-backdrop-canvas');
  if (!canvas || !overviewBackdrop) return;
  const W = Math.max(320, Math.round(canvas.clientWidth || 960)), H = Math.max(160, Math.round(canvas.clientHeight || 280));
  const ratio = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const size = `${W}x${H}x${ratio}|${overviewBackdropKey}`;
  if (size === overviewStageSize) return;
  overviewStageSize = size;
  canvas.width = Math.round(W * ratio); canvas.height = Math.round(H * ratio);
  overviewStage = buildStageScene(overviewBackdrop, W, H);
  if (!overviewStageFrame) drawOverviewStage(performanceNow());
}

function performanceNow() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}

function watchOverviewStage() {
  if (overviewStageWatching) return;
  overviewStageWatching = true;
  const box = document.querySelector('#overview-backdrop');
  try {
    if (typeof IntersectionObserver === 'function') new IntersectionObserver(entries => {
      overviewStageInView = entries.some(entry => entry.isIntersecting);
      if (overviewStageInView) startOverviewStage();
    }).observe(box);
    if (typeof ResizeObserver === 'function') new ResizeObserver(() => { sizeOverviewStage(); startOverviewStage(); }).observe(box);
    else if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('resize', () => { sizeOverviewStage(); startOverviewStage(); });
    if (document.addEventListener) document.addEventListener('visibilitychange', startOverviewStage);
  } catch { /* the banner still draws once */ }
}

function renderOverviewBackdrop() {
  const box = document.querySelector('#overview-backdrop');
  if (!box) return;
  if (typeof festivalBackdrop !== 'function' || typeof state === 'undefined' || !state?.event) { box.hidden = true; return; }
  try {
    const backdrop = festivalBackdrop({ name: state.event.name, venue: state.event.venue, artists: state.artists, bookings: state.bookings });
    document.querySelector('#overview-backdrop-title').textContent = state.event.name || 'Your festival';
    const dates = document.querySelector('#overview-dates')?.textContent || '';
    document.querySelector('#overview-backdrop-caption').textContent = [state.event.venue, dates, backdrop.label].filter(Boolean).join(' · ');
    box.dataset.mood = backdrop.mood;
    box.dataset.scene = backdrop.scene;
    // The title glows in the laser colour and pulses to the festival's beat.
    box.style.setProperty('--bd-glow', backdrop.colours.lasers[1]);
    box.style.setProperty('--bd-beat', `${(60 / backdrop.bpm).toFixed(3)}s`);
    box.hidden = false;
    if (backdrop.key !== overviewBackdropKey) { overviewBackdropKey = backdrop.key; overviewBackdrop = backdrop; overviewStageSize = ''; }
    watchOverviewStage();
    sizeOverviewStage();
    startOverviewStage();
  } catch {
    box.hidden = true; // a picture must never stop the Overview from working
  }
}

if (typeof module !== 'undefined') module.exports = { buildStageScene, drawStageFrame };
