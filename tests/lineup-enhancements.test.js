const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const clone = value => JSON.parse(JSON.stringify(value));
const sampleArtists = [
  { id: 'alpha', name: 'Alpha Band', genre: 'Jazz', fee: 100, duration: 60, colour: '#b7e4dc' },
  { id: 'beta', name: 'Beta Band', genre: 'Rock', fee: 200, duration: 45, colour: '#f5c8be' }
];
function seed(extra = {}) {
  return {
    artists: clone(sampleArtists), bookings: [], final: false,
    settings: { stages: 2, budget: 1000, stageNames: { A: 'Main Stage', B: 'Acoustic Tent' } },
    event: { startDate: '2026-10-15', endDate: '2026-10-16', startMinutes: 840, endMinutes: 1380 },
    dailyHoursResetV1: true, stageHoursResetV1: true, ...clone(extra)
  };
}
function rules(plan = seed()) {
  const context = vm.createContext({ console, Date, Intl, Set, Number, String, Array, JSON, Math, seedPlan: clone(plan) });
  vm.runInContext(fs.readFileSync(path.join(root, 'rules/festival-rules.js'), 'utf8'), context);
  vm.runInContext('let state = normalizePlan(seedPlan)', context);
  return { run: code => vm.runInContext(code, context), json: code => JSON.parse(vm.runInContext(`JSON.stringify(${code})`, context)) };
}
function app(plan = seed(), { overview = false, savedTeam = null, lookupTeammate, protocol = 'http:', role } = {}) {
  const nodes = new Map();
  function element() {
    return {
      value: '', textContent: '', innerHTML: '', hidden: false, disabled: false, opened: false, files: [], dataset: {},
      classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
      style: {}, querySelector: selector => nodeFor(selector), querySelectorAll() { return []; }, addEventListener(name, handler) { this['on' + name] = handler; }, removeAttribute() {}, setAttribute() {},
      showModal() { this.opened = true; }, close() { this.opened = false; this.onclose?.(); }, click() {}, focus() {},
      getBoundingClientRect() { return { left: 0, top: 0, bottom: 50, width: 200, height: 50 }; }
    };
  }
  function nodeFor(selector) {
    if (!nodes.has(selector)) nodes.set(selector, element());
    return nodes.get(selector);
  }
  const storage = new Map([['festival-architect-v2', JSON.stringify(plan)], ['festival-architect-team-v1', savedTeam]]);
  const context = vm.createContext({ console, Intl, Date, Set, Number, String, Array, JSON, Math, role,
    crypto: require('node:crypto').webcrypto, setTimeout() {}, Blob, URL, URLSearchParams,
    window: { location: { protocol }, addEventListener() {}, print() {}, innerWidth: 1024, innerHeight: 768, lookupTeammate },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    document: { querySelector: nodeFor,
      querySelectorAll() { return []; }, createElement() { return element(); }, body: { appendChild() {}, append() {} } }
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'rules/access-rules.js'), 'utf8'), context);
  if (role) vm.runInContext('canFestival = action => roleCan(role, action)', context);
  const files = ['rules/festival-rules.js', 'app.js'];
  if (overview) files.push('rules/checklist-rules.js', 'checkliste-festivalplanung/checklist-page.js', 'overview.js');
  for (const file of files) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  return { nodes, storage, run: code => vm.runInContext(code, context) };
}
function performance(extra = {}) {
  return { id: 'performance-one', artistId: 'alpha', date: '2026-10-15', stage: 'A', start: 900,
    duration: 60, fee: 100, status: 'tentative', changeover: 0, notes: '', ...extra };
}

test('loading an older performance snapshots its fee and duration without changing saved input', () => {
  const saved = seed({ bookings: [{ id: 'old', artistId: 'alpha', date: '2026-10-15', stage: 'A', start: 900 }] });
  const original = clone(saved);
  const p = rules(saved);
  assert.equal(p.run('state.bookings[0].duration'), 60);
  assert.equal(p.run('state.bookings[0].fee'), 100);
  assert.equal(p.run('state.bookings[0].status'), 'tentative');
  p.run("state.artists[0].fee=900; state.artists[0].duration=120");
  assert.equal(p.run('entryFee(state.bookings[0])'), 100);
  assert.equal(p.run('entryDuration(state.bookings[0])'), 60);
  assert.deepEqual(saved, original);
});

test('one artist can have different agreed fees and set durations on separate days', () => {
  const p = rules(seed({ bookings: [performance({ duration: 30, fee: 50 }),
    performance({ id: 'evening', date: '2026-10-16', duration: 90, fee: 250, status: 'confirmed' })] }));
  assert.equal(p.run('performances().length'), 2);
  assert.equal(p.run('artistCount()'), 1);
  assert.equal(p.run('total()'), 300);
  assert.equal(p.run('validation(state.bookings[1], "evening")'), '');
});

test('stage display names change without changing stage IDs or booked positions', () => {
  const p = rules(seed({ bookings: [performance()] }));
  assert.equal(p.run("stageName('A')"), 'Main Stage');
  p.run("state.settings.stageNames.A='River Stage'");
  assert.equal(p.run("stageName('A')"), 'River Stage');
  assert.equal(p.run('state.bookings[0].stage'), 'A');
  assert.equal(p.run('validation(state.bookings[0], state.bookings[0].id)'), '');
});

test('automatic changeovers follow the performance and do not add artist fees or counts', () => {
  const p = rules();
  p.run(`const originalPerformance=${JSON.stringify(performance({ changeover: 20 }))}; state.bookings=buildPerformanceEntries(originalPerformance)`);
  const entries = p.json('state.bookings');
  assert.equal(entries.length, 2);
  assert.equal(entries[1].linkedTo, entries[0].id);
  assert.equal(entries[1].start, 960);
  assert.equal(entries[1].duration, 20);
  assert.equal(entries[1].stage, 'A');
  assert.equal(p.run('total()'), 100);
  assert.equal(p.run('performances().length'), 1);
  p.run("state.bookings=buildPerformanceEntries({...originalPerformance,date:'2026-10-16',stage:'B',start:1000,duration:30,changeover:10})");
  assert.equal(p.run('state.bookings[1].date'), '2026-10-16');
  assert.equal(p.run('state.bookings[1].stage'), 'B');
  assert.equal(p.run('state.bookings[1].start'), 1030);
});

test('a set whose changeover hits an appointment is rejected and a valid edit ignores its own old changeover', () => {
  const p = rules(seed({ bookings: [{ id: 'break', type: 'block', title: 'Stage maintenance', date: '2026-10-15', stage: 'A', start: 960, duration: 20, notes: '' }] }));
  p.run(`const candidate=${JSON.stringify(performance({ changeover: 20 }))}`);
  assert.notEqual(p.run('validation(candidate)'), '');
  assert.equal(p.run('state.bookings.length'), 1);
  p.run('state.bookings=buildPerformanceEntries(candidate)');
  assert.equal(p.run('validation({...candidate,start:910},candidate.id)'), '');
});

test('next free slot fits the complete performance and changeover at minute precision', () => {
  const p = rules(seed({ bookings: [{ id: 'break', type: 'block', title: 'Maintenance', date: '2026-10-15', stage: 'A', start: 911, duration: 20, notes: '' }] }));
  p.run(`const candidate=${JSON.stringify(performance({ start: 911, duration: 30, changeover: 20 }))}`);
  assert.equal(p.run('nextFreeSlot(candidate)'), 931);
  assert.equal(p.run('validation({...candidate,start:nextFreeSlot(candidate)})'), '');
  assert.equal(p.run('nextFreeSlot({...candidate,start:1370})'), null);
});

test('backup round trip retains notes, status, prices, stage names and linked blocks even over budget', () => {
  const p = rules(seed({ settings: { stages: 2, budget: 10, stageNames: { A: 'River Stage', B: 'Quiet Tent' } } }));
  p.run(`state.bookings=buildPerformanceEntries(${JSON.stringify(performance({ status: 'confirmed', changeover: 20, fee: 150, notes: 'Private tour manager detail' }))});state.final=true;const backupText=JSON.stringify(makePlanBackup(state)); const restored=parsePlanBackup(backupText)`);
  assert.deepEqual(p.json('restored.artists'), p.json('state.artists'));
  assert.deepEqual(p.json('restored.bookings'), p.json('state.bookings'));
  assert.deepEqual(p.json('restored.settings'), p.json('state.settings'));
  assert.deepEqual(p.json('restored.event'), p.json('state.event'));
  assert.equal(p.run('restored.final'), true);
  assert.equal(p.run('restored.bookings[0].notes'), 'Private tour manager detail');
});

test('backup rejects malformed, unsupported and inconsistent plans without changing the current plan', () => {
  const p = rules(seed({ bookings: [performance()] }));
  const original = p.json('state');
  assert.throws(() => p.run("parsePlanBackup('not json')"));
  assert.throws(() => p.run("parsePlanBackup(JSON.stringify({...makePlanBackup(state),version:999}))"));
  const invalidMutations = [
    "draft.bookings[0].artistId='missing'",
    'draft.bookings[0].start=-1',
    'draft.bookings[0].fee=-20',
    'draft.bookings[0].duration=0',
    "draft.bookings[0].status='paid'",
    "draft.bookings[0].date='2026-02-31'",
    "draft.bookings[0].stage='Z'",
    "draft.event.endDate='2028-10-16'",
    "draft.artists.push({...draft.artists[0]})",
    "draft.bookings.push({...draft.bookings[0]})",
    "draft.bookings.push({...draft.bookings[0],id:'overlap',artistId:'beta'})",
    "draft.bookings.push({id:'orphan',type:'block',linkedTo:'missing',title:'Orphan',date:'2026-10-15',stage:'B',start:1000,duration:20,notes:''})"
  ];
  for (const mutation of invalidMutations) {
    assert.throws(() => p.run(`{const draft=JSON.parse(JSON.stringify(state));${mutation};parsePlanBackup(JSON.stringify({...makePlanBackup(state),plan:draft}))}`), mutation);
  }
  assert.deepEqual(p.json('state'), original);
});

test('internal print includes operational detail while public print exposes confirmed performances only', () => {
  const plan = seed({ final: true, bookings: [
    performance({ status: 'confirmed', notes: 'PRIVATE-NOTE-ABC', fee: 321 }),
    performance({ id: 'tentative', artistId: 'beta', status: 'tentative', start: 1020, notes: 'PRIVATE-NOTE-XYZ', fee: 654 }),
    { id: 'technical', type: 'block', title: 'SECRET-STAGE-WORK', date: '2026-10-15', stage: 'B', start: 1000, duration: 20, notes: 'PRIVATE-CREW-NOTE' }
  ] });
  const p = app(plan);
  const internal = p.run("createPrintMarkup('internal')");
  assert.match(internal, /Alpha Band/);
  assert.match(internal, /Beta Band/);
  assert.match(internal, /PRIVATE-NOTE-ABC/);
  assert.match(internal, /SECRET-STAGE-WORK/);
  const publicPrint = p.run("createPrintMarkup('public')");
  assert.match(publicPrint, /Alpha Band/);
  assert.match(publicPrint, /Main Stage/);
  assert.match(publicPrint, /15:00/);
  for (const privateValue of ['Beta Band', 'PRIVATE-NOTE-ABC', 'PRIVATE-NOTE-XYZ', 'PRIVATE-CREW-NOTE', 'SECRET-STAGE-WORK', '321', '654', '€', 'Budget:']) {
    assert.ok(!publicPrint.includes(privateValue), `Public output must exclude ${privateValue}`);
  }
});

test('saving, moving and removing a performance updates its linked changeover atomically', () => {
  const p = app();
  p.run(`savePerformance(${JSON.stringify(performance({ changeover: 20 }))})`);
  assert.equal(p.run('state.bookings.length'), 2);
  assert.equal(p.run("state.bookings.find(b=>b.linkedTo==='performance-one').start"), 960);
  p.run(`savePerformance(${JSON.stringify(performance({ stage: 'B', start: 1000, duration: 30, changeover: 10 }))})`);
  assert.equal(p.run('state.bookings.length'), 2);
  assert.equal(p.run("state.bookings.find(b=>b.linkedTo==='performance-one').stage"), 'B');
  assert.equal(p.run("state.bookings.find(b=>b.linkedTo==='performance-one').start"), 1030);
  p.run("removePerformance('performance-one')");
  assert.equal(p.run('state.bookings.length'), 0);
});

test('an overlap prevents the performance and its automatic changeover from being partially saved', () => {
  const p = app(seed({ bookings: [{ id: 'existing', type: 'block', title: 'Existing maintenance', date: '2026-10-15', stage: 'A', start: 970, duration: 10, notes: '' }] }));
  const before = p.run('JSON.stringify(state.bookings)');
  p.run(`savePerformance(${JSON.stringify(performance({ changeover: 20 }))})`);
  assert.equal(p.run('JSON.stringify(state.bookings)'), before);
});

test('a selected backup changes nothing until confirmation and cancelling leaves both plan and storage intact', async () => {
  const p = app(seed({ bookings: [performance()] }));
  const originalState = p.run('JSON.stringify(state)');
  const originalStorage = p.storage.get('festival-architect-v2');
  const backup = p.run("JSON.stringify(makePlanBackup({...state,bookings:[],settings:{...state.settings,budget:2000}}))");
  await p.nodes.get('#backup-file').onchange({ target: { files: [{ size: backup.length, text: async () => backup }] } });
  assert.equal(p.nodes.get('#restore-dialog').opened, true);
  assert.equal(p.run('JSON.stringify(state)'), originalState);
  assert.equal(p.storage.get('festival-architect-v2'), originalStorage);
  p.nodes.get('#cancel-restore').onclick();
  assert.equal(p.nodes.get('#restore-dialog').opened, false);
  assert.equal(p.run('pendingRestore'), null);
  assert.equal(p.run('JSON.stringify(state)'), originalState);
  assert.equal(p.storage.get('festival-architect-v2'), originalStorage);
});

test('confirming a validated backup restores only the lineup and leaves checklist data unchanged', async () => {
  const p = app(seed({ bookings: [performance()] }));
  p.storage.set('checklist-test-key', '["security"]');
  const backup = p.run("JSON.stringify(makePlanBackup({...state,bookings:[],settings:{...state.settings,budget:2000}}))");
  await p.nodes.get('#backup-file').onchange({ target: { files: [{ size: backup.length, text: async () => backup }] } });
  p.nodes.get('#confirm-restore').onclick();
  assert.equal(p.run('state.bookings.length'), 0);
  assert.equal(p.run('state.settings.budget'), 2000);
  assert.equal(JSON.parse(p.storage.get('festival-architect-v2')).settings.budget, 2000);
  assert.equal(p.storage.get('checklist-test-key'), '["security"]');
});

test('a rejected backup leaves current data unchanged and reports the problem', async () => {
  const p = app(seed({ bookings: [performance()] }));
  const originalState = p.run('JSON.stringify(state)');
  const originalStorage = p.storage.get('festival-architect-v2');
  await p.nodes.get('#backup-file').onchange({ target: { files: [{ size: 8, text: async () => 'not json' }] } });
  assert.equal(p.run('pendingRestore'), null);
  assert.equal(p.run('JSON.stringify(state)'), originalState);
  assert.equal(p.storage.get('festival-architect-v2'), originalStorage);
  assert.match(p.nodes.get('#backup-message').textContent, /not restored/i);
});

test('the same artist can play two separate sets on one day with different agreed durations and fees', () => {
  const p = rules(seed({ bookings: [performance({ start: 900, duration: 30, fee: 50 })] }));
  p.run(`const laterSet=${JSON.stringify(performance({ id: 'second-set', stage: 'B', start: 1020, duration: 90, fee: 250 }))}`);
  assert.equal(p.run('validation(laterSet)'), '');
  p.run('state.bookings.push(laterSet)');
  assert.equal(p.run('performances().length'), 2);
  assert.equal(p.run('artistCount()'), 1);
  assert.equal(p.run('total()'), 300);
});

test('the same artist cannot perform simultaneously on different stages', () => {
  const p = rules(seed({ bookings: [performance({ stage: 'A', start: 900, duration: 60 })] }));
  p.run(`const simultaneous=${JSON.stringify(performance({ id: 'other-stage', stage: 'B', start: 930, duration: 30 }))}`);
  assert.notEqual(p.run('validation(simultaneous)'), '');
  assert.equal(p.run('validation({...simultaneous,start:960})'), '');
  assert.equal(p.run('state.bookings.length'), 1);
});

test('Download backup creates a named JSON file that restores the saved lineup', async () => {
  const saved = seed({ bookings: [performance({ status: 'confirmed', fee: 275, notes: 'Saved soundcheck note' })] });
  const p = app(saved);
  p.run(`
    let backupBlob, download;
    URL = {
      createObjectURL(blob) { backupBlob = blob; return 'blob:lineup-test'; },
      revokeObjectURL() {}
    };
    document.createElement = tag => ({
      click() { download = { tag, filename: this.download, href: this.href }; },
      remove() {}
    });
  `);
  p.nodes.get('#backup-plan').onclick();
  assert.deepEqual(clone(p.run('download')), {
    tag: 'a', filename: 'festival-lineup-2026-10-15.json', href: 'blob:lineup-test'
  });
  const blob = p.run('backupBlob');
  assert.equal(blob.type, 'application/json');
  const text = await blob.text();
  const restored = clone(p.run(`parsePlanBackup(${JSON.stringify(text)})`));
  assert.deepEqual(restored.bookings, saved.bookings);
  assert.deepEqual(restored.artists, saved.artists);
  assert.deepEqual(restored.settings, saved.settings);
  assert.equal(p.storage.get('festival-architect-v2'), JSON.stringify(saved));
});

test('festival date and hour edits protect existing performances and their changeovers', () => {
  const p = rules(seed({ bookings: [performance({ changeover: 15 })] }));
  const details = "{ ...state.event, name: 'Harbour Festival', venue: 'Lisbon' }";
  assert.equal(p.run(`eventChangeProblem(${details}, state)`), '');
  assert.match(p.run(`eventChangeProblem({ ...${details}, startDate: '2026-10-16' }, state)`), /Alpha Band.*outside the new festival dates/);
  assert.match(p.run(`eventChangeProblem({ ...${details}, endMinutes: 960 }, state)`), /Alpha Band.*changeover/);
});

test('festival updates preserve in-range custom hours and remove hours for dropped dates', () => {
  const p = rules(seed());
  p.run("state.event.dayHours = { '2026-10-15': { start: 900, end: 1200 }, '2026-10-16': { start: 800, end: 1200 } }");
  const updated = p.json("updatedFestivalEvent({ endDate: '2026-10-15' }, state.event)");
  assert.deepEqual(updated.dayHours, { '2026-10-15': { start: 900, end: 1200 } });
  assert.equal(p.run('Object.keys(state.event.dayHours).length'), 2);
});

test('overview saves event details, refreshes the lineup and restores the details on reload', () => {
  const saved = seed({ bookings: [performance()] });
  delete saved.dailyHoursResetV1;
  delete saved.stageHoursResetV1;
  const p = app(saved, { overview: true });
  assert.equal(p.nodes.get('#overview-dialog').opened, true);
  const submit = () => p.nodes.get('#overview-form').onsubmit({ preventDefault() {} });
  p.nodes.get('#festival-name').value = 'Harbour Festival';
  p.nodes.get('#festival-venue').value = 'Lisbon';
  p.nodes.get('#festival-start-date').value = '2026-10-16';
  submit();
  assert.match(p.nodes.get('#overview-error').textContent, /Alpha Band.*outside/);
  assert.equal(p.run('state.event.startDate'), '2026-10-15');
  assert.equal(JSON.parse(p.storage.get('festival-architect-v2')).event.name, undefined);

  p.nodes.get('#festival-start-date').value = '2026-10-15';
  p.nodes.get('#festival-end-date').value = '2026-10-17';
  p.nodes.get('#festival-close').value = '24:00';
  submit();
  assert.equal(p.nodes.get('#overview-dialog').opened, false);
  assert.equal(p.nodes.get('#overview-title').textContent, 'Harbour Festival');
  assert.match(p.nodes.get('#event-summary').textContent, /Harbour Festival · 3 days/);

  const reloaded = app(JSON.parse(p.storage.get('festival-architect-v2')), { overview: true });
  assert.equal(reloaded.nodes.get('#overview-dialog').opened, false);
  assert.equal(reloaded.nodes.get('#overview-venue').textContent, 'Lisbon');
  assert.match(reloaded.nodes.get('#overview-hours').textContent, /24:00/);
  reloaded.nodes.get('#overview-edit').onclick();
  assert.equal(reloaded.nodes.get('#overview-dialog').opened, true);
  assert.equal(reloaded.nodes.get('#overview-dialog-title').textContent, 'Edit festival details');
  assert.equal(reloaded.nodes.get('#festival-venue').value, 'Lisbon');
  assert.equal(reloaded.nodes.get('#festival-close').value, '24:00');
  assert.equal(reloaded.nodes.get('#overview-performances').textContent, 1);
});

test('overview team saves roles, blocks duplicate usernames and restores the roster', async () => {
  // The user directory is Supabase (account/account.js); account ids are UUIDs.
  const vickyId = '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b';
  const lookupTeammate = async username => {
    assert.equal(username.toLowerCase(), 'vicky');
    return { status: 'found', user: { id: vickyId, username: 'Vicky' } };
  };
  const p = app(seed(), { overview: true, lookupTeammate });
  const submit = () => p.nodes.get('#team-form').onsubmit({ preventDefault() {} });
  p.run("$('#team-username').value = 'vicky'; $('#team-role').value = 'Viewer';");
  await submit();
  assert.match(p.nodes.get('#team-rows').innerHTML, /View the festival, lineup and checklist/);
  p.nodes.get('#team-username').value = 'vicky';
  await submit();
  assert.match(p.nodes.get('#team-error').textContent, /already on the team/);

  p.nodes.get('#team-rows').onchange({ target: { dataset: { teamIndex: '0' }, value: 'Admin' } });
  assert.match(p.nodes.get('#team-rows').innerHTML, /Role for Vicky[^]*<option selected>Admin<\/option>/);
  const savedTeam = p.storage.get('festival-architect-team-v1');
  assert.deepEqual(JSON.parse(savedTeam), [{ userId: vickyId, username: 'Vicky', role: 'Admin' }]);
  const reloaded = app(seed(), { overview: true, savedTeam });
  const rows = reloaded.nodes.get('#team-rows');
  assert.match(rows.innerHTML, /You \(festival creator\)[^]*<td>Admin<\/td>[^]*Vicky/);
  assert.doesNotMatch(rows.innerHTML, /Remove You|Role for You/);
  const requestRemoval = () => rows.onclick({ target: { dataset: { removeMember: '0' } } });
  const confirmRemoval = () => reloaded.nodes.get('#remove-teammate-form').onsubmit({ preventDefault() {} });
  requestRemoval();
  assert.equal(reloaded.nodes.get('#remove-teammate-dialog').opened, true);
  assert.match(reloaded.nodes.get('#remove-teammate-description').textContent, /Are you sure.*Vicky/);
  assert.equal(reloaded.storage.get('festival-architect-team-v1'), savedTeam);
  reloaded.nodes.get('#cancel-remove-teammate').onclick();
  assert.equal(reloaded.nodes.get('#remove-teammate-dialog').opened, false);
  confirmRemoval();
  assert.equal(reloaded.storage.get('festival-architect-team-v1'), savedTeam);
  requestRemoval();
  confirmRemoval();
  assert.deepEqual(JSON.parse(reloaded.storage.get('festival-architect-team-v1')), []);
  assert.match(rows.innerHTML, /You \(festival creator\)/);
});

test('overview keeps the existing roster when a username is unknown or the directory is unavailable', async () => {
  const savedTeam = JSON.stringify([{ username: 'Kira', role: 'Admin' }]);
  let reply = async () => ({ status: 'not-found' });
  const p = app(seed(), { overview: true, savedTeam, lookupTeammate: () => reply() });
  const submit = () => p.nodes.get('#team-form').onsubmit({ preventDefault() {} });
  p.run("$('#team-username').value = 'Vikcy'; $('#team-role').value = 'Viewer';");
  await submit();
  assert.match(p.nodes.get('#team-error').textContent, /Username not found/);
  assert.equal(p.storage.get('festival-architect-team-v1'), savedTeam);
  assert.equal(p.nodes.get('#team-add').disabled, false);

  reply = async () => { throw new Error('Offline'); };
  await submit();
  assert.match(p.nodes.get('#team-error').textContent, /Could not reach the user directory/);
  assert.equal(p.storage.get('festival-architect-team-v1'), savedTeam);
  assert.equal(p.nodes.get('#team-username').value, 'Vikcy');
  assert.match(p.nodes.get('#team-rows').innerHTML, /Kira/);
});

test('without the account directory the roster is preserved and the problem is explained', async () => {
  const savedTeam = JSON.stringify([{ username: 'Kira', role: 'Admin' }]);
  const p = app(seed(), { overview: true, savedTeam });
  p.run("$('#team-username').value = 'Vicky'; $('#team-role').value = 'Viewer';");
  await p.nodes.get('#team-form').onsubmit({ preventDefault() {} });
  assert.match(p.nodes.get('#team-error').textContent, /Could not reach the user directory/);
  assert.equal(p.storage.get('festival-architect-team-v1'), savedTeam);
});

test('editors can change lineup settings and checklist ticks but cannot change the festival, team or budget', async () => {
  const original = seed({ event: { ...seed().event, name: 'Harbour Festival' } });
  const savedTeam = JSON.stringify([{ userId: 4, username: 'Vicky', role: 'Editor' }]);
  let lookups = 0;
  const p = app(original, { overview: true, role: 'Editor', savedTeam, lookupTeammate: () => { lookups++; } });
  const submit = { preventDefault() {} };
  assert.equal(p.nodes.get('#overview-menu').hidden, true);
  p.nodes.get('#overview-edit').onclick();
  assert.equal(p.nodes.get('#overview-dialog').opened, false);
  p.nodes.get('#overview-form').onsubmit(submit);
  assert.equal(p.run('state.event.name'), 'Harbour Festival');
  assert.doesNotMatch(p.nodes.get('#team-rows').innerHTML, /data-remove-member|data-team-index/);
  await p.nodes.get('#team-form').onsubmit(submit);
  p.nodes.get('#team-rows').onclick({ target: { dataset: { removeMember: '0' } } });
  p.nodes.get('#team-rows').onchange({ target: { dataset: { teamIndex: '0' }, value: 'Admin' } });
  assert.equal(p.nodes.get('#remove-teammate-dialog').opened, false);
  assert.equal(lookups, 0);
  assert.equal(p.storage.get('festival-architect-team-v1'), savedTeam);
  assert.equal(p.nodes.get('#restore-plan').disabled, true);

  p.nodes.get('#edit-settings').onclick();
  assert.equal(p.nodes.get('#settings-dialog').opened, true);
  assert.equal(p.nodes.get('#budget-input').disabled, true);
  p.nodes.get('#budget-input').value = '1';
  p.nodes.get('#stages-input').value = '3';
  p.nodes.get('#settings-form').onsubmit(submit);
  assert.equal(p.run('state.settings.stages'), 3);
  assert.equal(p.run('state.settings.budget'), 1000);

  p.run("openArtist('alpha')");
  p.nodes.get('#fee-input').value = '125';
  p.nodes.get('#artist-form').onsubmit(submit);
  assert.equal(p.run("artist('alpha').fee"), 125);

  p.nodes.get('#checklist-view').onchange({ target: { dataset: { task: 'security-plan' }, checked: true } });
  assert.equal(p.run("localStorage.getItem(CHECKLIST_STORAGE_KEY)"), '["security-plan"]');
});

test('viewers cannot edit the lineup or checklist', () => {
  const p = app(seed(), { overview: true, role: 'Viewer' });
  assert.equal(p.nodes.get('#overview-dialog').opened, false);
  assert.equal(p.nodes.get('#edit-settings').disabled, true);
  p.nodes.get('#edit-settings').onclick();
  assert.equal(p.run("$('#settings-dialog').opened"), false);
  assert.equal(p.nodes.get('#add-artist').disabled, true);
  p.nodes.get('#add-artist').onclick();
  assert.equal(p.run("$('#artist-dialog').opened"), false);
  const target = { dataset: { task: 'security-plan' }, checked: true };
  p.nodes.get('#checklist-view').onchange({ target });
  assert.equal(target.checked, false);
  assert.equal(p.run("localStorage.getItem(CHECKLIST_STORAGE_KEY)"), null);
});

test('overview counts confirmed and tentative performances without counting calendar blocks', () => {
  const p = app(seed({ bookings: [
    performance({ status: 'confirmed' }),
    performance({ id: 'evening', stage: 'B' }),
    { id: 'soundcheck', type: 'block', title: 'Soundcheck', date: '2026-10-15', stage: 'A', start: 840, duration: 30 }
  ] }), { overview: true });
  assert.equal(p.nodes.get('#overview-performances').textContent, 2);
  assert.equal(p.nodes.get('#overview-booking-status').textContent, '1 confirmed · 1 tentative');
  p.run("state.bookings[1].status = 'confirmed'; renderOverview()");
  assert.equal(p.nodes.get('#overview-booking-status').textContent, '2 confirmed · 0 tentative');
});
