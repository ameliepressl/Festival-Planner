// Fixes from the click-through bug hunt with the Munich demo (feature-plans/demo-munich.md).
// Run with:  uvx --from nodejs-wheel node --test

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

// The lineup planner (app.js) with a tiny fake page, as in lineup-integration.test.js.
function planner(saved) {
  const nodes = new Map();
  const node = () => ({ value: '', innerHTML: '', textContent: '', hidden: false, opened: false,
    classList: { toggle() {}, add() {}, remove() {} }, querySelectorAll() { return []; }, addEventListener() {},
    showModal() { this.opened = true; }, close() { this.opened = false; } });
  const storage = new Map([['festival-architect-v2', JSON.stringify(saved)]]);
  const context = vm.createContext({ console, Intl, Date, Set, Number, String, Array, JSON, Math,
    crypto: require('node:crypto').webcrypto, setTimeout() {}, window: { addEventListener() {}, print() {} },
    localStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    document: { querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, node()); return nodes.get(selector); }, querySelectorAll() { return []; } } });
  for (const file of ['rules/access-rules.js', 'rules/festival-rules.js', 'app.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  return { run: (code) => vm.runInContext(code, context), nodes, storage };
}

test('editing an artist from the artist library keeps its library link (and so its photo)', () => {
  const p = planner({ artists: [{ id: 'lib-doechii', name: 'Doechii', genre: 'Hip-hop', fee: 52500, duration: 75, colour: '#f9dc88', libraryId: 'lib-doechii' }] });
  p.run("openArtist('lib-doechii')");
  p.nodes.get('#name-input').value = 'Doechii (live band)';
  p.nodes.get('#genre-input').value = 'Hip-hop';
  p.nodes.get('#fee-input').value = '60000';
  p.nodes.get('#duration-input').value = '75';
  p.nodes.get('#artist-form').onsubmit({ preventDefault() {} });
  const saved = JSON.parse(p.storage.get('festival-architect-v2')).artists[0];
  assert.equal(saved.name, 'Doechii (live band)');
  assert.equal(saved.fee, 60000);
  assert.equal(saved.libraryId, 'lib-doechii');
  assert.equal(saved.colour, '#f9dc88');
});
