const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
function planner(saved = null) {
  const nodes = new Map();
  function node() { return { value: '', innerHTML: '', textContent: '', hidden: false, opened: false,
    classList: { toggle() {}, add() {}, remove() {} },
    querySelectorAll() { return []; }, addEventListener() {},
    showModal() { this.opened = true; }, close() { this.opened = false; } }; }
  const storage = new Map(saved ? [['festival-architect-v2', JSON.stringify(saved)]] : []);
  const context = vm.createContext({ console, Intl, Date, Set, Number, String, Array, JSON, Math,
    crypto: require('node:crypto').webcrypto, setTimeout() {},
    window: { addEventListener() {}, print() {} },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    document: { querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, node()); return nodes.get(selector); }, querySelectorAll() { return []; } }
  });
  for (const file of ['rules/festival-rules.js', 'app.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  return { run: code => vm.runInContext(code, context), nodes, storage };
}
test('merged planner starts with shared rules and renders both-day navigation', () => {
  const p = planner();
  assert.equal(p.run('days().length'), 2);
  assert.match(p.nodes.get('#calendar').innerHTML, /Stage A/);
  assert.equal(p.nodes.get('#performance-count').textContent, 0);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /id="checklist-view"/);
  assert.match(html, /data-section="Checklist"/);
  assert.match(html, /checklist-page.js/);
});
test('minute-level bookings, blocks, adjacent sets and separate dates use current rules', () => {
  const p = planner();
  p.run("state.bookings=[{id:'break',type:'block',title:'Changeover',date:'2026-10-15',stage:'A',start:911,duration:20,notes:'Drums'}]");
  assert.match(p.run("validation({artistId:'naya',date:'2026-10-15',stage:'A',start:920})"), /15:31/);
  assert.equal(p.run("validation({artistId:'naya',date:'2026-10-15',stage:'A',start:931})"), '');
  assert.equal(p.run("validation({artistId:'naya',date:'2026-10-16',stage:'A',start:911})"), '');
  assert.equal(p.run('total()'), 0);
  assert.equal(p.run('performances().length'), 0);
});
test('over-budget changes wait for confirmation and finalisation has no minimum', () => {
  const p = planner();
  p.run('state.settings.budget=100; let applied=false; confirmBudget(1800,()=>{applied=true})');
  assert.equal(p.run('applied'), false);
  assert.equal(p.nodes.get('#budget-dialog').opened, true);
  p.nodes.get('#confirm-budget').onclick();
  assert.equal(p.run('applied'), true);
  p.nodes.get('#finalise-btn').onclick();
  assert.equal(p.nodes.get('#finalise-dialog').opened, true);
});
test('saved custom artists and blocks survive loading; retired hours reset once', () => {
  const p = planner({ final:false, artists:[{id:'custom',name:'Custom artist',genre:'Jazz',fee:50,duration:30,colour:'#b7e4dc'}],
    bookings:[{id:'custom-set',artistId:'custom',date:'2026-10-15',stage:'A',start:911,notes:'Soundcheck complete'},
      {id:'break',type:'block',title:'Break',date:'2026-10-16',stage:'B',start:900,duration:20,notes:'Change drums'}],
    event:{startDate:'2026-10-15',endDate:'2026-10-16',startMinutes:840,endMinutes:1380,dayHours:{'2026-10-15':{start:900,end:1320,stages:{A:{start:960,end:1320}}}}} });
  assert.equal(p.run('state.bookings.length'), 2);
  assert.equal(p.run('total()'), 50);
  assert.equal(p.run("stageHours('2026-10-15','A').start"), 840);
  p.run('state.final=true;printPlan()');
  const print = p.nodes.get('#print-plan-content').innerHTML;
  assert.match(print, /Change drums/);
  assert.match(print, /Soundcheck complete/);
  assert.match(print, /Fri 16 October/);
});
