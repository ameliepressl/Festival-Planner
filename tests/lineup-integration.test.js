const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
// Explicit test data keeps booking checks independent of the editable starter catalogue.
const bookingArtists = [{id:'naya',name:'Naya Bloom',genre:'Dream pop',fee:1800,duration:60,colour:'#f5c8be'}];
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
  for (const file of ['rules/access-rules.js', 'rules/festival-rules.js', 'app.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  return { run: code => vm.runInContext(code, context), nodes, storage };
}
test('merged planner starts with shared rules and renders both-day navigation', () => {
  const p = planner();
  assert.equal(p.run('days().length'), 2);
  assert.match(p.nodes.get('#calendar').innerHTML, /Stage A/);
  assert.equal(p.nodes.get('#performance-count').textContent, 0);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /id="checklist-view"/);
  assert.match(html, /data-section="Final checklist"/);
  assert.match(html, /checklist-page.js/);
});
test('minute-level bookings, blocks, adjacent sets and separate dates use current rules', () => {
  const p = planner({ artists: bookingArtists });
  p.run("state.bookings=[{id:'break',type:'block',title:'Changeover',date:state.event.startDate,stage:'A',start:911,duration:20,notes:'Drums'}]");
  assert.match(p.run("validation({artistId:'naya',date:state.event.startDate,stage:'A',start:920})"), /15:31/);
  assert.equal(p.run("validation({artistId:'naya',date:state.event.startDate,stage:'A',start:931})"), '');
  assert.equal(p.run("validation({artistId:'naya',date:state.event.endDate,stage:'A',start:911})"), '');
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

test('booking form accepts a 15:11 start and keeps it after reloading saved data', () => {
  const p = planner({ artists: bookingArtists });
  p.run("openBooking('naya')");
  p.nodes.get('#time-input').value = '15:11';
  p.nodes.get('#booking-notes').value = 'Check microphone';
  p.nodes.get('#booking-form').onsubmit({ preventDefault() {} });
  assert.equal(p.run('state.bookings.length'), 1);
  assert.equal(p.run('state.bookings[0].start'), 911);
  assert.equal(p.nodes.get('#performance-count').textContent, 1);
  assert.match(p.nodes.get('#calendar').innerHTML, /15:11–16:11/);
  const reloaded = planner(JSON.parse(p.storage.get('festival-architect-v2')));
  assert.equal(reloaded.run('state.bookings[0].start'), 911);
  assert.equal(reloaded.run('state.bookings[0].notes'), 'Check microphone');
});

test('settings dialog opens and saves stages and budget', () => {
  const p = planner();
  p.nodes.get('#edit-settings').onclick();
  assert.equal(p.nodes.get('#settings-dialog').opened, true);
  p.nodes.get('#stages-input').value = '3';
  p.nodes.get('#budget-input').value = '15000';
  p.nodes.get('#settings-form').onsubmit({ preventDefault() {} });
  assert.equal(p.nodes.get('#settings-dialog').opened, false);
  assert.equal(p.run('state.settings.stages'), 3);
  assert.equal(p.nodes.get('#stage-count').textContent, 3);
  assert.match(p.nodes.get('#calendar').innerHTML, /Stage C/);
  assert.equal(p.run('state.settings.budget'), 15000);
});


test('fresh plans start with one editable example and adding or editing an artist persists', () => {
  const p = planner();
  assert.equal(p.run('state.artists.length'), 1);
  assert.equal(p.run('state.artists[0].name'), 'Example Artist');
  assert.equal(p.run('state.artists[0].fee'), 0);
  assert.equal(p.run('state.artists[0].duration'), 60);
  assert.equal(p.run('state.bookings.length'), 0);
  p.run("openArtist('example')");
  p.nodes.get('#name-input').value = 'My artist';
  p.nodes.get('#genre-input').value = 'Jazz';
  p.nodes.get('#fee-input').value = '500';
  p.nodes.get('#duration-input').value = '45';
  p.nodes.get('#artist-form').onsubmit({ preventDefault() {} });
  assert.equal(p.run("artist('example').name"), 'My artist');
  assert.equal(p.run("artist('example').fee"), 500);
  p.run('openArtist()');
  p.nodes.get('#name-input').value = 'Second artist';
  p.nodes.get('#genre-input').value = 'Rock';
  p.nodes.get('#fee-input').value = '700';
  p.nodes.get('#duration-input').value = '60';
  p.nodes.get('#artist-form').onsubmit({ preventDefault() {} });
  const reloaded = planner(JSON.parse(p.storage.get('festival-architect-v2')));
  assert.equal(reloaded.run('state.artists.length'), 2);
  assert.equal(reloaded.run("artist('example').duration"), 45);
  assert.match(reloaded.nodes.get('#artist-list').innerHTML, /Second artist/);
});

test('older saved bookings keep their artists when no catalogue was stored', () => {
  const p = planner({ bookings: [{id:'old',artistId:'naya',stage:'A',start:840}], final:false });
  assert.equal(p.run('state.bookings.length'), 1);
  assert.equal(p.run("artist('naya').name"), 'Naya Bloom');
  assert.equal(p.run('total()'), 1800);
});

test('a saved empty catalogue stays empty rather than reinserting the example', () => {
  const p = planner({artists:[],bookings:[],final:false});
  assert.equal(p.run('state.artists.length'), 0);
});
