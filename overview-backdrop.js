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
  const stageW = Math.min(W * 0.34, 400), cx = W * 0.58;
  const stage = { cx, x: cx - stageW / 2, w: stageW, top: H * 0.43, floor: H * 0.78 };

  const stars = Array.from({ length: Math.round(W / 9) }, () => ({ x: r(0, W), y: r(0, H * 0.45), size: r(0.5, 1.6), phase: r(0, 6.3), speed: r(0.8, 2.4) }));
  const aurora = [0, 1, 2].map(i => ({ x: W * (0.15 + i * 0.35), y: H * r(0.1, 0.3), radius: W * r(0.22, 0.34), speed: r(0.05, 0.12), phase: r(0, 6.3) }));
  const sun = { x: rnd() < 0.5 ? W * r(0.08, 0.22) : W * r(0.86, 0.95), y: horizon - H * r(0.12, 0.2), radius: H * r(0.08, 0.11) };

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
  }

  // The crowd: a smaller back row and a bigger front row; some hold up arms or phones.
  const crowd = [];
  [[H * 0.84, H * 0.03, 0.75, 11], [H * 0.93, H * 0.045, 1, 15]].forEach(([y, size, shade, gap]) => {
    for (let x = -10; x < W + 10; x += r(gap * 0.8, gap * 1.3)) {
      crowd.push({ x, y: y + r(-3, 3), size: size * r(0.8, 1.15), shade, phase: r(0, 1), arm: rnd() < 0.18 ? (rnd() < 0.5 ? -1 : 1) : 0, phone: rnd() < 0.07 });
    }
  });

  const haze = Array.from({ length: 80 }, () => ({ x: stage.cx + r(-W * 0.35, W * 0.35), y: r(0, H), size: r(0.8, 2.4), speed: r(6, 22), phase: r(0, 6.3) }));
  return { W, H, horizon, stage, stars, aurora, sun, land, crowd, haze, colours: backdrop.colours, bpm: backdrop.bpm, seed: backdrop.seed };
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
    ctx.globalAlpha = 0.6; ctx.fillRect(0, horizon, W, H - horizon);
    ctx.strokeStyle = colours.sun; ctx.lineWidth = 1.6;
    for (let i = 0; i < 5; i++) {
      const y = horizon + 8 + i * H * 0.035, length = 90 + i * 15, shift = (t * (14 + i * 6)) % length;
      ctx.globalAlpha = 0.5 - i * 0.07;
      ctx.beginPath(); ctx.moveTo(-length, y);
      for (let x = -length; x <= W + length; x += length / 8) ctx.lineTo(x + shift, y + Math.sin((x / length) * Math.PI * 2) * (2 + i));
      ctx.stroke();
    }
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
