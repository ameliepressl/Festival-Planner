// Festival details and the artist budget are Admin-only, also in the database (migrations/006).
// These checks make sure the planner never makes an Editor send a change the database refuses.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { screen } = require('./helpers/screen-harness.cjs');
const KEY = 'festival-architect-v2';

const oldPlan = () => ({ final: false, settings: { stages: 2, budget: 20000 },
  event: { name: 'Harbour', venue: 'Lisbon', startDate: '2030-06-01', endDate: '2030-06-02', startMinutes: 600, endMinutes: 1200,
    dayHours: { '2030-06-01': { start: 700, end: 1100 } } },
  artists: [{ id: 'my-artist', name: 'My artist', genre: 'Jazz', duration: 60, fee: 50, colour: '#b7e4dc' }], bookings: [] });

function planner(role, saved) {
  const ui = screen(role, saved === undefined ? {} : { [KEY]: JSON.stringify(saved) });
  ui.load('rules/festival-rules.js'); ui.load('app.js'); return ui;
}
const savedEvent = ui => JSON.parse(ui.values.get(KEY)).event;
const savedBudget = ui => JSON.parse(ui.values.get(KEY)).settings.budget;

test('an Editor keeps the saved festival details of an older plan when saving a planning change', () => {
  const ui = planner('Editor', oldPlan());
  assert.equal(ui.run('save({ ...state, settings: { ...state.settings, stages: 3 } })'), true);
  assert.deepEqual(savedEvent(ui), oldPlan().event);
  assert.equal(savedBudget(ui), 20000);
  assert.equal(JSON.parse(ui.values.get(KEY)).settings.stages, 3);
});

test('the festival creator and Admins still apply the one-time opening-hours migration', () => {
  const ui = planner('Admin', oldPlan());
  assert.equal(ui.run('save(state)'), true);
  const event = savedEvent(ui);
  assert.equal(event.startMinutes, 840);
  assert.equal(event.endMinutes, 1380);
  assert.equal(event.dayHours, undefined);
});

test('an Editor cannot create the lineup before the festival details exist; an Admin can', () => {
  const editor = planner('Editor');
  assert.equal(editor.run('save({ ...state, final: true })'), false);
  assert.equal(editor.values.has(KEY), false);
  assert.match(editor.node('#toast').textContent, /creator or an Admin needs to set up the festival details first/);

  const admin = planner('Admin');
  assert.equal(admin.run('save({ ...state, final: true })'), true);
  assert.equal(admin.values.has(KEY), true);
});

test('the database rule covers the festival details and the artist budget for Editors', () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '006_admin_only_lineup_details.sql'), 'utf8');
  assert.match(sql, /festival-architect-v2/);
  assert.match(sql, /'event'/);
  assert.match(sql, /'budget'/);
  assert.match(sql, /festival_role\(old\.id\) = 'Editor'\s+and private\.lineup_admin_fields\(new\.data\) is distinct from private\.lineup_admin_fields\(old\.data\)/);
  // The defaults the database assumes must match the app's defaults.
  const DEFAULT_EVENT = JSON.parse(planner('Admin').run('JSON.stringify(DEFAULT_EVENT)'));
  for (const [key, value] of Object.entries(DEFAULT_EVENT)) assert.match(sql, new RegExp(`"${key}": ${JSON.stringify(value)}`));
  assert.match(sql, /'10000'::jsonb/);
});
