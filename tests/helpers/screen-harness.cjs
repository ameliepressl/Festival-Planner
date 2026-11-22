// Small DOM/storage doubles for exercising real screen handlers without a browser or Supabase.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../..');

function screen(role = 'Admin', initial = {}) {
  const nodes = new Map(), created = [], notices = [], writes = [];
  const values = new Map(Object.entries(initial));
  let rejectWrites = false;
  function makeNode() {
    const handlers = new Map(), attributes = new Map();
    return {
      value: '', innerHTML: '', textContent: '', dataset: {}, style: {}, hidden: false, disabled: false,
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      addEventListener(type, fn) { if (!handlers.has(type)) handlers.set(type, []); handlers.get(type).push(fn); },
      fire(type, event = {}) { for (const fn of handlers.get(type) || []) fn(event); },
      click() { this.fire('click'); this.onclick?.(); },
      showModal() { this.opened = true; }, close() { this.opened = false; this.fire('close'); },
      querySelector: node, querySelectorAll() { return []; }, append() {}, prepend() {}, before() {}, after() {}, insertBefore() {}, replaceChildren() {},
      setAttribute(key, value) { attributes.set(key, String(value)); }, getAttribute: key => attributes.get(key) ?? null,
      removeAttribute(key) { attributes.delete(key); }, focus() {}, scrollIntoView() {},
      getBoundingClientRect() { return { x: 0, y: 0, left: 0, top: 0, bottom: 50, width: 400, height: 50 }; }
    };
  }
  function node(selector) {
    const byId = selector.startsWith('#') && created.find(item => item.id === selector.slice(1));
    if (byId) return byId;
    if (!nodes.has(selector)) nodes.set(selector, makeNode());
    return nodes.get(selector);
  }
  const nav = ['Vendors', 'Finances', 'Final checklist'].map(section => { const item = makeNode(); item.dataset.section = section; return item; });
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem(key, value) { if (rejectWrites) throw new Error('Simulated storage quota failure'); writes.push(key); values.set(key, String(value)); },
    removeItem(key) { if (rejectWrites) throw new Error('Simulated storage quota failure'); values.delete(key); }
  };
  const windowHandlers = new Map();
  class TestEvent { constructor(type) { this.type = type; } }
  const context = vm.createContext({ console, Intl, Date, Map, Set, Number, String, Array, JSON, Math, Event: TestEvent,
    crypto: require('node:crypto').webcrypto, setTimeout() {}, clearTimeout() {}, setInterval() {},
    window: { festivalAccess: { role }, Event: TestEvent, scrollTo() {}, print() {},
      addEventListener(type, fn) { if (!windowHandlers.has(type)) windowHandlers.set(type, []); windowHandlers.get(type).push(fn); },
      dispatchEvent(event) { for (const fn of windowHandlers.get(event.type) || []) fn(event); } },
    document: { querySelector: node, querySelectorAll: selector => selector === '.sidebar-item' ? nav : [],
      createElement() { const item = makeNode(); created.push(item); return item; } },
    localStorage: storage, toast: message => notices.push(message)
  });
  const run = code => vm.runInContext(code, context);
  const load = file => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  load('rules/access-rules.js');
  return { context, node, nav, values, writes, notices, run, load, failWrites(value = true) { rejectWrites = value; } };
}

module.exports = { screen };
