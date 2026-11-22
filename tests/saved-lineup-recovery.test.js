const test = require('node:test');
const assert = require('node:assert/strict');
const { screen } = require('./helpers/screen-harness.cjs');
const KEY = 'festival-architect-v2';
const valid = () => ({ final: false, settings: { stages: 2, budget: 10000 },
  event: { name: 'Saved festival', startDate: '2030-06-01', endDate: '2030-06-02', startMinutes: 840, endMinutes: 1380 },
  artists: [{ id: 'my-artist', name: 'My artist', genre: 'Jazz', duration: 60, fee: 50, colour: '#b7e4dc' }], bookings: [] });
function planner(raw, role = 'Admin') {
  const ui = screen(role, raw === undefined ? {} : { [KEY]: raw });
  ui.load('rules/festival-rules.js'); ui.load('app.js'); return ui;
}

test('bad saved JSON, scalars and malformed lists remain unchanged behind explicit recovery UI', () => {
  for (const raw of ['{broken', 'null', 'false', '42', '[]', '"a plan"',
    JSON.stringify({ ...valid(), artists: [null] }),
    JSON.stringify({ ...valid(), bookings: [null] }),
    JSON.stringify({ ...valid(), artists: 'invalid' }),
    JSON.stringify({ ...valid(), event: { startDate: 'not-a-date' } }),
    JSON.stringify({ ...valid(), settings: { stages: -1, budget: 10 } })]) {
    let ui; assert.doesNotThrow(() => { ui = planner(raw); });
    assert.ok(ui.run('window.getLineupDataProblem()'));
    assert.equal(ui.values.get(KEY), raw);
    assert.equal(ui.node('#lineup-recovery-notice').hidden, false);
    assert.match(ui.node('#lineup-recovery-message').textContent, /original saved data has not been changed/);
    assert.equal(ui.node('#edit-settings').disabled, true);
    assert.equal(ui.run('writable("overview")'), false);
    assert.equal(ui.run('save({...state, final:true})'), false);
    assert.equal(ui.values.get(KEY), raw);
  }
});

test('orphan artist references never vanish silently from a saved lineup', () => {
  const plan = valid(); plan.bookings.push({ id: 'keep-me', artistId: 'missing', stage: 'A', date: plan.event.startDate, start: 900 });
  const raw = JSON.stringify(plan), ui = planner(raw);
  assert.match(ui.run('window.getLineupDataProblem()'), /artist missing/);
  ui.node('#add-artist').onclick();
  assert.equal(ui.node('#artist-dialog').opened, undefined);
  assert.equal(ui.values.get(KEY), raw);
});

test('valid legacy plans keep their artist snapshots and unnamed new projects remain editable', () => {
  const old = planner(JSON.stringify({ bookings: [{ id: 'old', artistId: 'naya', stage: 'A', start: 840 }], final: false }));
  assert.equal(old.run('window.getLineupDataProblem()'), '');
  assert.equal(old.run('state.bookings[0].fee'), 1800);
  assert.equal(old.run('state.bookings.length'), 1);
  const fresh = planner();
  assert.equal(fresh.run('window.getLineupDataProblem()'), '');
  assert.equal(fresh.run('writable()'), true);
  assert.equal(fresh.run('state.artists[0].id'), 'example');
  assert.equal(fresh.values.has(KEY), false);
});

test('repairable scheduling clashes remain visible rather than replacing the saved plan', () => {
  const plan = valid();
  plan.bookings = ['one', 'two'].map((id, index) => ({ id, artistId: 'my-artist', stage: index ? 'B' : 'A',
    date: plan.event.startDate, start: 900, duration: 60, fee: 50, notes: '' }));
  const ui = planner(JSON.stringify(plan));
  assert.equal(ui.run('window.getLineupDataProblem()'), '');
  assert.equal(ui.run('state.bookings.length'), 2);
  assert.ok(ui.run('planProblems(state).length') > 0);
});

test('a failed confirmed recovery preserves raw data and can be retried successfully', async () => {
  const ui = planner('{broken');
  const backup = ui.run(`JSON.stringify(makePlanBackup(normalizePlan(${JSON.stringify(valid())})))`);
  await ui.node('#backup-file').onchange({ target: { files: [{ size: backup.length, text: async () => backup }] } });
  assert.equal(ui.node('#restore-dialog').opened, true);
  assert.equal(ui.values.get(KEY), '{broken');
  ui.failWrites(); ui.node('#confirm-restore').onclick();
  assert.equal(ui.values.get(KEY), '{broken');
  assert.ok(ui.run('window.getLineupDataProblem()'));
  assert.equal(ui.node('#restore-dialog').opened, true);
  ui.failWrites(false); ui.node('#confirm-restore').onclick();
  assert.equal(ui.run('window.getLineupDataProblem()'), '');
  assert.equal(ui.run('state.event.name'), 'Saved festival');
  assert.equal(ui.node('#lineup-recovery-notice').hidden, true);
  assert.equal(JSON.parse(ui.values.get(KEY)).event.name, 'Saved festival');
});

test('cancelled or forbidden recovery leaves the original saved lineup alone', async () => {
  const ui = planner('{broken');
  const backup = ui.run(`JSON.stringify(makePlanBackup(normalizePlan(${JSON.stringify(valid())})))`);
  await ui.node('#backup-file').onchange({ target: { files: [{ size: backup.length, text: async () => backup }] } });
  ui.node('#cancel-restore').onclick(); ui.node('#confirm-restore').onclick();
  assert.equal(ui.values.get(KEY), '{broken');
  const viewer = planner('{broken', 'Viewer');
  assert.equal(viewer.node('#lineup-recovery-restore').disabled, true);
  await viewer.node('#backup-file').onchange({ target: { files: [{ size: backup.length, text: async () => backup }] } });
  assert.equal(viewer.run('pendingRestore'), null);
  assert.equal(viewer.values.get(KEY), '{broken');
});

test('retry only rereads the current source and never writes editable defaults over corrupted data', () => {
  const ui = planner('{broken'); ui.node('#lineup-recovery-retry').onclick();
  assert.equal(ui.values.get(KEY), '{broken'); assert.ok(ui.run('window.getLineupDataProblem()'));
  ui.values.set(KEY, JSON.stringify(valid())); ui.node('#lineup-recovery-retry').onclick();
  assert.equal(ui.run('window.getLineupDataProblem()'), '');
  assert.equal(ui.run('state.event.name'), 'Saved festival');
});

test('the recovery download exports the exact original raw text', async () => {
  const raw = '{broken', ui = planner(raw);
  let blob;
  ui.context.Blob = Blob;
  ui.context.URL = { createObjectURL(value) { blob = value; return 'blob:original'; }, revokeObjectURL() {} };
  ui.node('#lineup-recovery-download').onclick();
  assert.equal(await blob.text(), raw);
  assert.equal(ui.values.get(KEY), raw);
});
