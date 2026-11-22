const test = require('node:test');
const assert = require('node:assert/strict');
const { screen } = require('./helpers/screen-harness.cjs');

const PLAN_KEY = 'festival-architect-v2';
const seed = () => ({ final: false, settings: { stages: 2, budget: 10000 },
  event: { name: 'Storage test', startDate: '2030-06-01', endDate: '2030-06-02', startMinutes: 840, endMinutes: 1380 },
  artists: [{ id: 'saved', name: 'Saved Artist', genre: 'Jazz', fee: 50, duration: 60, colour: '#b7e4dc' }], bookings: [] });
function planner(plan = seed()) {
  const ui = screen('Admin', { [PLAN_KEY]: JSON.stringify(plan) });
  ui.load('rules/festival-rules.js'); ui.load('app.js');
  return ui;
}

test('failed artist editing keeps the live and stored plan; retry commits the intended edit', () => {
  const ui = planner(), before = ui.values.get(PLAN_KEY);
  ui.run("openArtist('saved')"); ui.node('#name-input').value = 'Edited Artist'; ui.failWrites();
  assert.doesNotThrow(() => ui.node('#artist-form').onsubmit({ preventDefault() {} }));
  assert.equal(ui.run('state.artists[0].name'), 'Saved Artist');
  assert.equal(ui.values.get(PLAN_KEY), before);
  assert.equal(ui.node('#artist-dialog').opened, true);
  assert.match(ui.node('#toast').textContent, /could not be saved/);
  ui.failWrites(false); ui.node('#artist-form').onsubmit({ preventDefault() {} });
  assert.equal(ui.run('state.artists[0].name'), 'Edited Artist');
  assert.equal(JSON.parse(ui.values.get(PLAN_KEY)).artists[0].name, 'Edited Artist');
});

test('failed performance saves do not add an invisible booking or close the editing dialog', () => {
  const ui = planner(); ui.run("openBooking('saved')"); ui.node('#time-input').value = '15:11'; ui.failWrites();
  assert.doesNotThrow(() => ui.node('#booking-form').onsubmit({ preventDefault() {} }));
  assert.equal(ui.run('state.bookings.length'), 0);
  assert.equal(ui.node('#booking-dialog').opened, true);
  ui.failWrites(false); ui.node('#booking-form').onsubmit({ preventDefault() {} });
  assert.equal(ui.run('state.bookings.length'), 1);
  assert.equal(JSON.parse(ui.values.get(PLAN_KEY)).bookings[0].start, 911);
});

test('unsafe shared artist and booking attributes are text, not markup or CSS', () => {
  const plan = seed(), probe = '" data-audit-probe="unsafe';
  plan.artists[0].id += probe; plan.artists[0].colour += probe;
  plan.bookings = [{ id: 'booking' + probe, artistId: plan.artists[0].id, date: plan.event.startDate,
    stage: 'A', start: 900, duration: 60, fee: 50, status: 'tentative' + probe, changeover: 0, notes: '' }];
  // Exercise the renderer independently; the saved-data loader also rejects this fixture.
  const ui = planner();
  ui.run(`state = normalizePlan(${JSON.stringify(plan)}); render();`);
  for (const html of [ui.node('#artist-list').innerHTML, ui.node('#calendar').innerHTML]) {
    assert.doesNotMatch(html, /data-audit-probe="unsafe/);
    assert.match(html, /&quot; data-audit-probe=&quot;unsafe/);
  }
  assert.match(ui.node('#artist-list').innerHTML, /background:#b7e4dc/);
  ui.run(`openBooking(${JSON.stringify(plan.artists[0].id)})`);
  assert.doesNotMatch(ui.node('#booking-artist').innerHTML, /data-audit-probe="unsafe/);
});

test('a failed artist-library Add leaves no phantom artist to be saved by a later action', () => {
  const ui = planner(); ui.load('rules/artist-library.js'); ui.load('artist-library/artist-library.js');
  const id = ui.run('ARTIST_LIBRARY[0].id'), before = ui.run('state.artists.length'); ui.failWrites();
  const button = { dataset: { libAdd: id } };
  ui.node('#artist-library').fire('click', { target: { closest: selector => selector === '[data-lib-add]' ? button : null } });
  assert.equal(ui.run('state.artists.length'), before);
  assert.equal(JSON.parse(ui.values.get(PLAN_KEY)).artists.length, before);
});

test('a failed checklist change restores the checkbox and saved progress', () => {
  const key = 'festival-architect-checklist', ui = screen('Admin', { [key]: '[]' });
  ui.load('rules/checklist-rules.js'); ui.load('checkliste-festivalplanung/checklist-page.js'); ui.failWrites();
  const checkbox = { dataset: { task: 'security-plan' }, checked: true };
  assert.doesNotThrow(() => ui.node('#checklist-view').fire('change', { target: checkbox }));
  assert.equal(checkbox.checked, false); assert.equal(ui.values.get(key), '[]');
  assert.match(ui.notices.at(-1), /previous checks are kept/);
});

test('failed finance edits and reset keep calculations consistent and never announce success', () => {
  const key = 'festival-architect-finance', ui = screen('Admin', { [key]: '{"ticketPrice":44}' });
  for (const file of ['rules/festival-rules.js','rules/capacity-rules.js','rules/vendor-rules.js','rules/finance-rules.js']) ui.load(file);
  ui.run(`let state = normalizePlan(${JSON.stringify(seed())})`); ui.load('finance/finance-page.js');
  const before = ui.run('window.getOverviewFinance().profit'); ui.failWrites();
  const field = { dataset: { field: 'ticketPrice' }, value: '88' };
  ui.node('#finance-view').fire('change', { target: field });
  assert.equal(ui.run('window.getOverviewFinance().profit'), before);
  assert.equal(ui.run('window.getReadinessFinance().profit'), before);
  assert.equal(Number(field.value), 44);
  ui.node('#finance-view').fire('click', { target: { closest: selector => selector === '[data-reset]' ? {} : null } });
  assert.equal(ui.run('window.getOverviewFinance().profit'), before);
  assert.doesNotMatch(ui.notices.join(' '), /Assumptions reset/);
});

function vendors(placements = {}) {
  const { VENDOR_STORAGE_KEY } = require('../rules/vendor-rules.js');
  const ui = screen('Admin', { [VENDOR_STORAGE_KEY]: JSON.stringify(placements), 'festival-architect-ground': '{"visitors":500}' });
  for (const file of ['rules/capacity-rules.js','rules/vendor-rules.js','rules/vendor-library.js','vendors/vendors-page.js']) ui.load(file);
  ui.vendorAction = dataset => ui.node('#vendors-view').fire('click', { target: { closest: selector => selector === 'button' ? { dataset } : null } });
  return { ui, key: VENDOR_STORAGE_KEY };
}

test('failed vendor confirmation leaves no phantom booking and can be retried', () => {
  const { ui, key } = vendors(), id = ui.run('VENDORS[0].id'), before = ui.values.get(key);
  ui.failWrites(); ui.vendorAction({ confirm: id }); ui.vendorAction({ filter: 'Food' });
  assert.doesNotMatch(ui.node('#vendors-view').innerHTML, new RegExp(`data-remove="${id}"`));
  assert.equal(ui.values.get(key), before);
  ui.failWrites(false); ui.vendorAction({ confirm: id });
  assert.equal(JSON.parse(ui.values.get(key))[id], 'P1');
});

test('failed vendor removal keeps the booked pitch in storage and the next render', () => {
  const { ui, key } = vendors({ tacos: 'P1' }), before = ui.values.get(key);
  ui.failWrites(); ui.vendorAction({ remove: 'tacos' }); ui.vendorAction({ filter: 'Food' });
  assert.match(ui.node('#vendors-view').innerHTML, /data-remove="tacos"/);
  assert.equal(ui.values.get(key), before);
  assert.doesNotMatch(ui.notices.join(' '), /Pitch P1 is free again/);
});

test('failed automatic pitch fitting retains the original booking and reports no false success', () => {
  const { ui, key } = vendors({ tacos: 'P20' }), before = ui.values.get(key);
  ui.failWrites(); ui.nav.find(item => item.dataset.section === 'Vendors').click();
  assert.equal(ui.values.get(key), before);
  assert.match(ui.node('#vendors-view').innerHTML, /data-remove="tacos"/);
  assert.doesNotMatch(ui.notices.join(' '), /lost their pitch/);
});


test('unreadable lineup data never becomes plausible Overview, finance, countdown or readiness totals', () => {
  const ui = screen('Admin', { [PLAN_KEY]: '{broken', 'festival-architect-finance': '{"ticketPrice":44}' });
  for (const file of ['rules/festival-rules.js','app.js','rules/capacity-rules.js','rules/vendor-rules.js','rules/finance-rules.js','finance/finance-page.js','rules/countdown-rules.js','festival-countdown.js','overview.js','rules/readiness-rules.js','readiness.js']) ui.load(file);
  assert.match(ui.node('#overview-title').textContent, /unavailable/);
  assert.equal(ui.node('#overview-budget').textContent, '—');
  assert.equal(ui.node('#overview-performances').textContent, '—');
  assert.equal(ui.node('#overview-profit').textContent, '—');
  assert.equal(ui.run('window.getOverviewFinance()'), null);
  assert.equal(ui.run('window.getReadinessFinance()'), null);
  ui.nav.find(item => item.dataset.section === 'Finances').click();
  assert.match(ui.node('#finance-view').innerHTML, /Financial totals are unavailable/);
  assert.equal(ui.node('#countdown-days').textContent, '—');
  assert.equal(ui.run('window.getFestivalReadiness().score'), null);
  assert.equal(ui.run('window.getFestivalReadiness().issues[0].unknown'), true);
  ui.node('#finance-view').fire('change', { target: { dataset: { field: 'ticketPrice' }, value: '88' } });
  assert.equal(ui.values.get('festival-architect-finance'), '{"ticketPrice":44}');
  assert.equal(ui.values.get(PLAN_KEY), '{broken');
  ui.values.set(PLAN_KEY, JSON.stringify(seed())); ui.node('#lineup-recovery-retry').onclick();
  assert.equal(ui.node('#overview-title').textContent, 'Storage test');
  assert.equal(ui.node('#overview-budget').textContent, '€10,000');
  assert.equal(typeof ui.run('window.getFestivalReadiness().score'), 'number');
  assert.notEqual(ui.node('#countdown-days').textContent, '—');
  ui.context.window.isFestivalContextCurrent = () => false;
  assert.equal(ui.run('window.getFestivalReadiness().score'), null);
  assert.match(ui.run('window.getFestivalReadiness().issues[0].detail'), /festival is changing/);
});
