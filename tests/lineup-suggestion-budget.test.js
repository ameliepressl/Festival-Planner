// "Suggest lineup" uses the same budget rule as manual booking (brief: "Flexible budget"):
// the artist budget is not a hard limit; a suggestion that creates or increases an overrun
// is only saved after the same confirmation dialog. See feature-plans/automatic-lineup-fillup.md.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function rules(count = 10, budget = 10000) {
  const ctx = vm.createContext({ console, Date, Intl });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../rules/festival-rules.js'), 'utf8'), ctx);
  const run = code => vm.runInContext(code, ctx);
  run(`let plan = normalizePlan(null); plan.event={name:'Test',venue:'',startDate:'2027-03-20',endDate:'2027-03-21',startMinutes:840,endMinutes:1380};
    plan.settings.budget=${budget}; plan.artists=Array.from({length:${count}},(_,i)=>({id:'a'+i,name:'Artist '+i,genre:i%2?'Rock':'Pop',fee:100+i,duration:60,colour:'#b7e4dc'}));`);
  return run;
}

test('the budget does not limit the suggestion: every artist that fits the hours is planned', () => {
  const r = rules(10, 250);
  assert.equal(r(`const o=automaticLineup(plan); o.problem`), '');
  assert.equal(r(`o.bookings.filter(isPerformance).length`), 10, 'all artists, although their fees total far more than €250');
  assert.equal(r(`o.skipped.length`), 0);
  assert.equal(r(`plan.settings.budget=0; automaticLineup(plan).problem`), '', 'a €0 budget is no reason to refuse');
  assert.equal(r(`automaticLineup(plan,{realistic:true}).bookings.filter(isPerformance).length`), 10);
});

test('an existing lineup that is already over budget can still get a suggestion', () => {
  const r = rules(4, 100);
  r(`plan.bookings=[{id:'existing',artistId:'a3',date:'2027-03-21',stage:'A',start:900,duration:60,fee:500,status:'confirmed',changeover:0,notes:''}]`);
  assert.equal(r(`automaticLineup(plan,{headlinerId:'a3'}).problem`), '');
  assert.equal(r(`automaticLineup(plan,{headlinerId:'a3'}).bookings.filter(isPerformance).length`), 3);
});

test('artists left out are only ever left out for lack of time, never for budget', () => {
  const r = rules(40, 1);
  const reasons = JSON.parse(r(`JSON.stringify([...new Set(automaticLineup(plan).skipped.map(x=>x.reason))])`));
  assert.ok(reasons.length > 0, '40 one-hour sets do not fit two days on two stages');
  assert.deepEqual(reasons, ['No slot found within the hours, changeover and genre rules.']);
});

test('budgetOverrunGrows: confirmation only when an overrun is created or increased', () => {
  const r = rules(3, 300);
  const set = (id, fee) => `{id:'${id}',artistId:'a0',date:'2027-03-20',stage:'A',start:${840 + Number(id.slice(1)) * 70},duration:60,fee:${fee},status:'tentative',changeover:0,notes:''}`;
  const plans = (before, after) => `budgetOverrunGrows({...plan,bookings:[${before}]},{...plan,bookings:[${after}]})`;
  assert.equal(r(plans(set('b0', 100), `${set('b0', 100)},${set('b1', 150)}`)), false, '€250 of €300: fits');
  assert.equal(r(plans(set('b0', 100), `${set('b0', 100)},${set('b1', 201)}`)), true, '€301 of €300: creates an overrun');
  assert.equal(r(plans(set('b0', 400), `${set('b0', 400)},${set('b1', 1)}`)), true, 'already over: increases it');
  assert.equal(r(plans(set('b0', 400), set('b0', 350))), false, 'already over: reduces it');
  assert.equal(r(plans(set('b0', 400), set('b0', 400))), false, 'unchanged overrun');
});

// The real "Suggest lineup" screen with small stand-ins for the planner page.
function screen({ budget = 10000 } = {}) {
  const nodes = new Map();
  function $(id) {
    if (!nodes.has(id)) nodes.set(id, { value: '15', textContent: '', innerHTML: '', disabled: false, handlers: {},
      addEventListener(e, h) { this.handlers[e] = h; }, showModal() { this.open = true; },
      close() { this.open = false; this.handlers.close?.(); }, focus() {} });
    return nodes.get(id);
  }
  const ctx = vm.createContext({ console, Date, Intl, $, document: { querySelector: $ } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../rules/festival-rules.js'), 'utf8'), ctx);
  vm.runInContext(`let state=normalizePlan(null);let lineupLoadProblem=''; let saves=0; let asked=[];
    state.event={name:'Test',venue:'',startDate:'2027-03-20',endDate:'2027-03-21',startMinutes:840,endMinutes:1380};
    state.settings.budget=${budget};
    state.artists=Array.from({length:4},(_,i)=>({id:'a'+i,name:'Artist '+i,genre:i%2?'Rock':'Pop',fee:1000,duration:60,colour:'#b7e4dc'}));
    const canFestival=()=>true;const writable=()=>!state.final;
    const toast=()=>{};const render=()=>{};const euros=n=>'€'+n;const escapeHtml=s=>String(s);
    // Stand-in for app.js confirmBudget: remembers the question; the test answers it.
    function confirmBudget(projected,apply){asked.push({projected,apply});}
    function save(next){state=next;saves++;return true;}`, ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../automatic-lineup.js'), 'utf8'), ctx);
  const run = s => vm.runInContext(s, ctx);
  return { $, run, preview() { $('#auto-plan-lineup').onclick(); $('#auto-plan-form').onsubmit({ preventDefault() {} }); } };
}

test('a suggestion over budget shows the overrun and is saved only after confirming', () => {
  const s = screen({ budget: 2500 });
  s.preview();
  assert.match(s.$('#auto-plan-message').textContent, /4 suggested performances · €4000 artist fees · €1500 over the €2500 artist budget/);
  s.$('#auto-plan-apply').onclick();
  assert.equal(s.run('saves'), 0, 'nothing is saved while the question is open');
  assert.equal(s.run('asked.length'), 1);
  assert.equal(s.run('asked[0].projected'), 4000);
  s.run('asked[0].apply()');
  assert.equal(s.run('saves'), 1);
  assert.equal(s.run('state.bookings.filter(isPerformance).length'), 4);
});

test('"Keep editing" in the budget dialog keeps the timetable unchanged', () => {
  const s = screen({ budget: 2500 });
  s.preview();
  s.$('#auto-plan-apply').onclick();
  assert.equal(s.run('asked.length'), 1);
  assert.equal(s.run('saves'), 0);
  assert.equal(s.run('state.bookings.length'), 0);
});

test('a suggestion within budget is saved straight away, without the dialog', () => {
  const s = screen({ budget: 10000 });
  s.preview();
  assert.match(s.$('#auto-plan-message').textContent, /€6000 budget remaining/);
  s.$('#auto-plan-apply').onclick();
  assert.equal(s.run('asked.length'), 0);
  assert.equal(s.run('saves'), 1);
});

test('if the festival changes while the budget question is open, nothing is saved', () => {
  const s = screen({ budget: 2500 });
  s.preview();
  s.$('#auto-plan-apply').onclick();
  s.run('state={...state,settings:{...state.settings,stages:3}}');
  s.run('asked[0].apply()');
  assert.equal(s.run('saves'), 0);
  assert.match(s.$('#auto-plan-message').textContent, /changed/);
});
