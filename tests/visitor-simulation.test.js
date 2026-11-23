const test = require('node:test');
const assert = require('node:assert/strict');
const map = require('../rules/site-map-rules');
const crowd = require('../rules/crowd-rules');
const sim = require('../rules/visitor-simulation');
const { screen } = require('./helpers/screen-harness.cjs');

const stages = ['stage-a', 'stage-b'];
const day = { start: 780, end: 1500, shows: [
  { stage: 'stage-a', start: 850, end: 940 }, { stage: 'stage-b', start: 980, end: 1050 }
] };

function scenario() {
  const site = map.demoSite();
  site.crowdSafety = { stages: { 'stage-a': { audience: 500, area: 600 }, 'stage-b': { audience: 500, area: 500 } },
    exits: { 'exit-1': { width: 2 }, 'exit-2': { width: 3 } } };
  return site;
}
function positions(model, minute, drill = null) {
  const result = [];
  sim.frame(model, minute, drill, (first, last, at) => result.push([first, last, at.x, at.y, at.r]));
  return result.sort((a, b) => a[0] - b[0]);
}
const count = (model, minute, drill) => sim.frame(model, minute, drill, () => {});

test('the maximum audience has one offset per person, staggered arrivals and repeatable scrubbing', () => {
  const model = sim.build(scenario(), 20000, stages, day);
  assert.equal(model.offsets.length, 40000);
  assert.equal(count(model, day.start), 0);
  assert.ok(count(model, day.start + 20) > 0 && count(model, day.start + 20) < 20000);
  const first = positions(model, 880);
  assert.equal(count(model, 1120), 20000);
  assert.deepEqual(positions(model, 880), first);
  assert.equal(first.reduce((n, [a, b]) => n + b - a, 0), 20000);
});

test('actual sets attract visitors to mapped stages and breaks redirect them to facilities', () => {
  const model = sim.build(scenario(), 1000, stages, day);
  function at(minute, id) {
    return model.streams.filter(s => s.trips.filter(t => t.start + t.path.minutes <= minute).at(-1)?.path.to.id === id).length;
  }
  assert.ok(at(900, 'stage-a') > 5);
  assert.equal(at(900, 'stage-b'), 0);
  assert.ok(at(1020, 'stage-b') > 5);
  assert.equal(at(1170, 'stage-b'), 0);
  assert.equal(sim.build(scenario(), 1000, stages, { ...day, shows: [] }).missing, 0);
});

test('the full individual dot clouds stay on usable ground along walking routes', () => {
  const model = sim.build(scenario(), 1000, stages, day);
  for (let at = 781; at < 1110; at += 1.7) {
    sim.frame(model, at, null, (first, last, p) => {
      for (let i = first; i < last; i++) {
        assert.ok(map.isUsable(model.site, [p.x + p.r * model.offsets[i * 2], p.y + p.r * model.offsets[i * 2 + 1]]));
      }
    });
  }
});

test('evacuation starts at exactly the displayed locations and conserves people through delay and queues', () => {
  const site = scenario(), original = JSON.stringify(site);
  const model = sim.build(site, 1000, stages, day);
  const drill = sim.evacuation(model, 855);
  assert.equal(drill.count, 1000);
  assert.deepEqual(positions(model, 0, drill), positions(model, 855));
  assert.deepEqual(positions(model, drill.delay, drill), positions(model, 855));
  assert.deepEqual(drill.estimate, crowd.estimateEvacuation(site, 1000, site.crowdSafety, stages));
  let last = 1000;
  for (let t = 0; t < drill.end; t += 0.2) {
    const inside = count(model, t, drill);
    assert.ok(inside >= 0 && inside <= last);
    last = inside;
  }
  assert.equal(count(model, drill.end, drill), 0);
  assert.equal(JSON.stringify(site), original);
});

test('closed exits receive nobody and narrower exits take longer to clear', () => {
  const site = scenario();
  site.crowdSafety.exits['exit-1'].open = false;
  const run = () => sim.evacuation(sim.build(site, 1000, stages, day), 951);
  const wide = run();
  assert.ok(wide.groups.every(g => g.exit.hub.id === 'exit-2'));
  site.crowdSafety.exits['exit-2'].width = 0.5;
  assert.ok(run().end > wide.end);
  site.crowdSafety.exits['exit-2'].open = false;
  assert.match(run().problem, /exit/);
});

test('unmeasured exits hold their visitors and incomplete inputs do not produce an estimate', () => {
  const site = scenario(); delete site.crowdSafety;
  const model = sim.build(site, 1000, stages, day);
  const drill = sim.evacuation(model, 905);
  assert.equal(drill.unmeasured, 1000);
  assert.equal(drill.estimate.valid, false);
  assert.equal(count(model, drill.end, drill), 1000);
  assert.match(sim.evacuation(model, day.start).problem, /arrived/);
});

test('an isolated stage or emergency exit never gets a straight line through a no-go area', () => {
  const site = { width: 200, height: 100, widthMetres: 200,
    boundary: [[0,0],[200,0],[200,100],[0,100]], grid: map.buildGrid(200,100,[[[94,0],[106,0],[106,100],[94,100]]]),
    placements: { entrance: [0,50], 'stage-a': [35,50], 'stage-b': [170,50], P1: [30,65], 'exit-1': [200,50] },
    crowdSafety: { exits: { 'exit-1': { width: 2 }, 'exit-2': { open: false } } } };
  const model = sim.build(site, 500, stages, day);
  assert.equal(model.missing, 1);
  const drill = sim.evacuation(model, 900);
  assert.equal(drill.stranded, 500);
  assert.equal(count(model, drill.end, drill), 500);
  delete site.placements.entrance;
  assert.match(sim.build(site, 500, stages, day).problem, /entrance/);
});

test('the selected day uses its own hours, stage and artist names, including an after-midnight set', () => {
  const s = screen('Viewer');
  s.load('rules/festival-rules.js'); s.load('site-map/visitor-playback.js');
  s.context.plan = { event: { startMinutes: 600, endMinutes: 1200,
    dayHours: { '2027-03-20': { start: 1080, end: 1620 } } }, settings: { stages: 1, stageNames: { A: 'Arena' } },
    artists: [{ id: 'one', name: 'Night Set', duration: 45 }],
    bookings: [{ date: '2027-03-20', stage: 'A', artistId: 'one', start: 30 },
      { date: '2027-03-20', type: 'block', start: 1110, duration: 15 },
      { date: '2027-03-21', stage: 'A', artistId: 'one', start: 720 }] };
  const actual = JSON.parse(s.run("JSON.stringify(VisitorPlayback.dayFor(plan, '2027-03-20'))"));
  assert.deepEqual(actual, { start: 1080, end: 1620,
    shows: [{ stage: 'stage-a', start: 1470, end: 1515, label: 'Night Set · Arena' }] });
  assert.deepEqual(s.writes, []);
});

test('a Viewer can play, pause, seek, restart, evacuate, return and close without any writes', () => {
  const s = screen('Viewer');
  s.load('rules/festival-rules.js'); s.load('site-map/visitor-playback.js');
  let nextFrame, pending = false, disconnected = false;
  const drawing = { setTransform() {}, clearRect() {}, drawImage() {}, putImageData() {}, fillRect() {},
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) };
  const canvas = s.node('#sm-visitors-canvas');
  Object.assign(canvas, { clientWidth: 400, clientHeight: 300, getContext: () => drawing });
  s.context.document.createElement = () => ({ getContext: () => drawing });
  s.context.document.addEventListener = s.context.document.removeEventListener = () => {};
  Object.assign(s.context, { VisitorSimulation: sim, testSite: scenario(),
    Option: class { constructor(label, value) { this.value = value; } },
    ResizeObserver: class { observe() {} disconnect() { disconnected = true; } },
    requestAnimationFrame(fn) { nextFrame = fn; pending = true; return 1; },
    cancelAnimationFrame() { pending = false; }
  });
  const field = name => s.node('[data-sim="' + name + '"]');
  field('day').add = function(option) { if (!this.value) this.value = option.value; };
  field('heat').checked = true; field('legend').lastChild = {}; field('speed').value = '2';
  s.node('#sm-simulation').getClientRects = () => [{}];
  s.run("let state = normalizePlan({event:{startDate:'2027-03-20',endDate:'2027-03-21',startMinutes:900,endMinutes:1380},bookings:[]})");
  s.run("let panel = VisitorPlayback.mount(document.querySelector('#site-map-view'), testSite, 1000, ['stage-a','stage-b'], state, () => ({x:0,y:0,w:testSite.width,h:testSite.height}))");
  field('play').onclick(); nextFrame(100); nextFrame(1100);
  assert.equal(Number(field('time').value), 928);
  field('play').onclick(); assert.equal(pending, false);
  field('time').value = 975; field('time').oninput();
  assert.match(field('count').textContent, /1,000 on site/);
  field('evacuate').onclick(); assert.match(field('note').textContent, /Peak-scenario planning estimate/);
  // A native range control can serialize a fractional maximum just below the model time.
  const sliderMax = Number(field('time').max);
  field('time').value = Math.floor(sliderMax * 1e12) / 1e12;
  field('time').oninput();
  assert.equal(field('count').textContent, '0 on site', 'seeking to the browser endpoint clears measured queues');
  assert.equal(field('play').textContent, 'Replay');
  field('time').value = field('time').max; field('time').oninput();
  assert.equal(field('count').textContent, '0 on site');
  field('evacuate').onclick(); assert.equal(Number(field('time').value), 975);
  field('restart').onclick(); assert.equal(Number(field('time').value), 900);
  field('day').value = '2027-03-21'; field('day').onchange(); assert.equal(Number(field('time').value), 920);
  field('heat').checked = false; field('heat').onchange(); assert.equal(field('legend').hidden, true);
  field('play').onclick(); s.run('panel.close()');
  assert.equal(pending, false); assert.equal(disconnected, true); assert.equal(canvas.hidden, true);
  assert.deepEqual(s.writes, []);
});
