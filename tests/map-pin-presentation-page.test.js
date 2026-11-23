// Added facilities use the same marker presentation as preset facilities.
// Runs the real map screen with disposable storage and SVG/DOM doubles; never Supabase.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const map = require('../rules/site-map-rules.js');
const capacity = require('../rules/capacity-rules.js');
const vendors = require('../rules/vendor-rules.js');
const crowd = require('../rules/crowd-rules.js');
const pins = require('../rules/map-pin-rules.js');

const ROOT = path.join(__dirname, '..');
const SELECTED_KEY = 'festival-architect-site-map-selected';
const baseItems = () => map.layoutItems({ ...capacity.capacityNeeds(500), stages: 2 });
const clone = value => JSON.parse(JSON.stringify(value));

function fixture(extraPins = []) {
  const site = map.demoSite(baseItems());
  site.extraPins = clone(extraPins);
  extraPins.forEach((pin, index) => { site.placements[pin.id] = [600 + index * 10, 400]; });
  return site;
}

function mapScreen({ role = 'Admin', site = fixture(), saved } = {}) {
  const values = new Map(saved || [
    [map.SITE_MAPS_STORAGE_KEY, JSON.stringify([site])],
    [capacity.GROUND_STORAGE_KEY, JSON.stringify({ visitors: 500 })],
    [SELECTED_KEY, site.id],
    ['festival-architect-v2', JSON.stringify({ settings: { stages: 2 } })]
  ]);
  const writes = [], notices = [], nodes = new Map();
  function node(selector) {
    if (selector === '#sm-crowd' || selector === 'dialog[open]') return null;
    if (!nodes.has(selector)) {
      const classes = new Set(), attributes = new Map();
      nodes.set(selector, {
        innerHTML: '', textContent: '', value: '', hidden: false, disabled: false, open: false,
        style: {}, dataset: {}, clientWidth: 800,
        classList: {
          add(...names) { names.forEach(name => classes.add(name)); },
          remove(...names) { names.forEach(name => classes.delete(name)); },
          contains(name) { return classes.has(name); },
          toggle(name, force) {
            const enabled = force === undefined ? !classes.has(name) : force;
            if (enabled) classes.add(name); else classes.delete(name);
            return enabled;
          }
        },
        setAttribute(name, value) { attributes.set(name, String(value)); },
        getAttribute(name) { return attributes.get(name) ?? null; },
        addEventListener() {}, querySelector: node, querySelectorAll() { return []; },
        focus() {}, scrollIntoView() {},
        getBoundingClientRect() { return { left: 0, top: 0, bottom: 600, width: 800, height: 600 }; }
      });
    }
    return nodes.get(selector);
  }
  const view = node('#site-map-view');
  const context = vm.createContext({ ...map, ...capacity, ...vendors, ...crowd, ...pins,
    console, Event: class { constructor(type) { this.type = type; } },
    setTimeout() {}, clearTimeout() {},
    canFestival: () => role !== 'Viewer',
    window: { addEventListener() {}, dispatchEvent() {}, confirm: () => true },
    document: { querySelector: () => view, querySelectorAll: () => [], addEventListener() {} },
    localStorage: {
      getItem: key => values.get(key) ?? null,
      setItem(key, value) { writes.push(key); values.set(key, String(value)); },
      removeItem(key) { writes.push(key); values.delete(key); }
    },
    toast: message => notices.push(message)
  });
  const load = file => vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  load('rules/map-draft-rules.js');
  load('site-map/map-drawing.js');
  // Route drawing is a separate component; this screen test exercises the real facility and pin SVG.
  vm.runInContext('MapDrawing.walkways = () => "";', context);
  const source = fs.readFileSync(path.join(ROOT, 'site-map/site-map-page.js'), 'utf8');
  const hook = `window.pinPresentationTest = {
    render(id = null) {
      refreshItems();
      box = { site: currentId, x: 0, y: 0, w: site().width, h: site().height };
      selectedId = id; mode = 'explore';
      drawObjects(); renderTray();
    },
    addPin, placeAt, commitChanges, addChooser,
    snapshot: () => JSON.parse(JSON.stringify(snapshot()))
  };\n})();`;
  assert.match(source, /\}\)\(\);\s*$/);
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, hook), context, { filename: 'site-map/site-map-page.js' });
  return { api: context.window.pinPresentationTest, values, writes, notices, node };
}

test('preset and added facilities use ordinary category markers without an origin badge', () => {
  const site = fixture([{ id: 'x-1', kind: 'toilets', name: 'Toilets (added 1)' }]);
  const ui = mapScreen({ site });
  const before = ui.values.get(map.SITE_MAPS_STORAGE_KEY);
  ui.api.render();
  const svg = ui.node('#sm-objects').innerHTML;
  assert.match(svg, /data-id="toilets-a"/);
  assert.match(svg, /data-id="x-1"/);
  assert.doesNotMatch(svg, /sm-added-badge|Added by you|\(added 1\)/);
  const ordinaryMarkers = [...svg.matchAll(/class="fa-pin /g)];
  assert.equal(ordinaryMarkers.length, Object.keys(site.placements).length);
  assert.match(svg, /aria-label="Toilets 3"/);
  assert.equal(ui.values.get(map.SITE_MAPS_STORAGE_KEY), before, 'rendering names does not overwrite saved map data');
  assert.equal(ui.writes.length, 0);
});

test('every added pin type gets grammatical menu text without an origin label', () => {
  const expected = {
    toilets: 'Add another toilet block', water: 'Add another water point',
    'first-aid': 'Add another first aid point', bar: 'Add another bar',
    info: 'Add another info point', security: 'Add another security post',
    recycling: 'Add another recycling point', marker: 'Add another pin'
  };
  const extraPins = map.EXTRA_PIN_TYPES.map((type, index) => ({
    id: `x-${index + 1}`, kind: type.kind,
    name: type.kind === 'marker' ? 'VIP area' : `${type.label} (added 1)`
  }));
  const ui = mapScreen({ site: fixture(extraPins) });
  extraPins.forEach(pin => {
    ui.api.render(pin.id);
    const menu = ui.node('#sm-pop').innerHTML;
    assert.match(menu, new RegExp(`>\\+ ${expected[pin.kind]}</button>`), pin.kind);
    assert.doesNotMatch(menu, /Added by you|<em>|another toilets|another free water|another own pin/);
    assert.equal(ui.node('#sm-pop').classList.contains('added'), false, 'added and preset menus share their normal styling');
    assert.match(menu, /data-pin="move"/);
    assert.match(menu, /data-pin="remove"/);
  });
});

test('pin shortcuts and popovers preserve a custom name as escaped text', () => {
  const name = '<img src=x onerror=alert(1)>';
  const ui = mapScreen({ site: fixture([{ id: 'x-1', kind: 'marker', name }]) });
  ui.api.render('x-1');
  const popup = ui.node('#sm-pop').innerHTML;
  const tray = ui.node('#sm-tray').innerHTML;
  assert.match(popup, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(tray, /Pin shortcuts/);
  assert.match(tray, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(popup + tray + ui.api.addChooser(), /Added by you|<img /);
  assert.match(tray, /data-find-pin="x-1"/);
  assert.match(tray, /data-delete-pin="x-1"/);
});

test('a Viewer can inspect matching pin names but cannot add or edit a facility', () => {
  const ui = mapScreen({ role: 'Viewer', site: fixture([{ id: 'x-1', kind: 'water', name: 'Free water (added 1)' }]) });
  ui.api.render('x-1');
  const before = JSON.stringify(ui.api.snapshot());
  ui.api.addPin('toilets');
  assert.equal(JSON.stringify(ui.api.snapshot()), before);
  assert.equal(ui.writes.length, 0);
  assert.match(ui.node('#sm-pop').innerHTML, /View only/);
  assert.doesNotMatch(ui.node('#sm-pop').innerHTML, /data-pin="move"|data-pin="remove"|data-pin-another/);
  assert.match(ui.node('#sm-tray').innerHTML, /data-delete-pin="x-1" disabled/);
});

test('adding, placing and saving uses preset-style names which survive reopening', () => {
  const ui = mapScreen();
  ui.api.render();
  ui.api.addPin('toilets');
  const fresh = ui.api.snapshot().sites.find(site => site.id === 'demo');
  assert.deepEqual(clone(fresh.extraPins), [{ id: 'x-1', kind: 'toilets', name: 'Toilets 3', automaticName: true }]);
  ui.api.placeAt([600, 400]);
  assert.equal(ui.api.commitChanges(), true);
  const saved = JSON.parse(ui.values.get(map.SITE_MAPS_STORAGE_KEY)).find(site => site.id === 'demo');
  assert.deepEqual(saved.extraPins, [{ id: 'x-1', kind: 'toilets', name: 'Toilets 3', automaticName: true }]);
  assert.deepEqual(saved.placements['x-1'], [600, 400]);
  const reopened = mapScreen({ saved: [...ui.values] });
  reopened.api.render('x-1');
  assert.match(reopened.node('#sm-pop').innerHTML, />Toilets 3<\/b>/);
  assert.doesNotMatch(reopened.node('#sm-objects').innerHTML, /sm-added-badge|Added by you/);
});
