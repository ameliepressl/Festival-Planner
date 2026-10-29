// Acceptance checks for the lineup planner rules (rules/festival-rules.js), one block per scenario A1–A6
// in product-brief/festival-architect-brief.html. Run with:  uvx --from nodejs-wheel node --test

const test = require('node:test');
const assert = require('node:assert/strict');
const logic = require('../rules/festival-rules.js');

const { validation, finaliseProblems, total, emptyState, parseState } = logic;

// 16:30 -> 990 minutes after midnight
const at = (clock) => { const [h, m] = clock.split(':').map(Number); return h * 60 + m; };

// Accept a booking the way app.js does: check it, then add it.
function book(state, artistId, stage, clock) {
  const booking = { id: `${artistId}-${stage}-${clock}`, artistId, stage, start: at(clock) };
  const problem = validation(state, booking);
  if (problem === '') state.bookings.push(booking);
  return problem;
}

// ---------- A1: same stage conflict ----------

test('A1: an overlapping set on the same stage is rejected', () => {
  const state = emptyState();
  assert.equal(book(state, 'naya', 'A', '16:00'), ''); // 16:00–17:00
  assert.match(book(state, 'nightbus', 'A', '16:30'), /overlaps another performance on Stage A/);
  assert.equal(state.bookings.length, 1);
});

test('A1: a set may start exactly when the previous one ends', () => {
  const state = emptyState();
  book(state, 'naya', 'A', '16:00');
  assert.equal(book(state, 'nightbus', 'A', '17:00'), '');
});

// ---------- A2: different stages ----------

test('A2: different artists may play at the same time on different stages', () => {
  const state = emptyState();
  assert.equal(book(state, 'naya', 'A', '16:00'), '');
  assert.equal(book(state, 'redwood', 'B', '16:00'), '');
});

// ---------- A3: festival boundaries ----------

test('A3: a 60-minute set at 13:59 or 22:01 is rejected, at 22:00 it is allowed', () => {
  const state = emptyState();
  assert.match(book(state, 'naya', 'A', '13:59'), /between 14:00 and 23:00/);
  assert.match(book(state, 'naya', 'A', '22:01'), /between 14:00 and 23:00/);
  assert.equal(book(state, 'naya', 'A', '22:00'), '');
});

// ---------- A4: budget and duplicates ----------

function spend8900() {
  const state = emptyState();
  book(state, 'naya', 'A', '14:00');     // €1,800
  book(state, 'satori', 'A', '15:00');   // €2,200
  book(state, 'riko', 'A', '16:15');     // €1,500
  book(state, 'nightbus', 'B', '14:00'); // €1,400
  book(state, 'redwood', 'B', '14:45');  // €2,000
  assert.equal(total(state), 8900);
  return state;
}

test('A4: spending exactly the €10,000 budget is allowed', () => {
  const state = spend8900();
  assert.equal(book(state, 'luna', 'B', '16:00'), ''); // €1,100 -> €10,000
  assert.equal(total(state), 10000);
});

test('A4: a booking that would exceed the budget is rejected', () => {
  const state = spend8900();
  assert.match(book(state, 'mila', 'B', '18:00'), /exceed the €10,000 artist budget/); // €1,200 -> €10,100
  assert.equal(total(state), 8900);
});

test('A4: an artist already in the lineup is rejected, on either stage', () => {
  const state = emptyState();
  book(state, 'naya', 'A', '16:00');
  assert.match(book(state, 'naya', 'B', '18:00'), /already in the lineup/);
  assert.equal(state.bookings.length, 1);
});

// ---------- A5: edit and remove ----------

test('A5: an edit does not clash with its own old slot (FA R5)', () => {
  const state = emptyState();
  book(state, 'naya', 'A', '16:00');
  const id = state.bookings[0].id;
  assert.equal(validation(state, { id, artistId: 'naya', stage: 'A', start: at('16:15') }, id), '');
});

test('A5: a conflicting edit is rejected, so the original booking stays', () => {
  const state = emptyState();
  book(state, 'naya', 'A', '16:00');
  book(state, 'nightbus', 'A', '17:00');
  const id = state.bookings[1].id;
  assert.match(validation(state, { id, artistId: 'nightbus', stage: 'A', start: at('16:30') }, id), /overlaps/);
  assert.equal(state.bookings[1].start, at('17:00'));
});

test('A5: swapping an artist counts the old fee out and the new fee in (FA R5)', () => {
  const state = spend8900();
  book(state, 'luna', 'B', '16:00'); // €10,000 spent
  const lunaId = state.bookings.find((b) => b.artistId === 'luna').id;
  // Luna (€1,100) -> Tomás (€900): €9,800, allowed even though the budget is full.
  assert.equal(validation(state, { id: lunaId, artistId: 'tomas', stage: 'B', start: at('16:00') }, lunaId), '');
  // Luna (€1,100) -> Mila (€1,200): €10,100, rejected.
  assert.match(validation(state, { id: lunaId, artistId: 'mila', stage: 'B', start: at('16:00') }, lunaId), /exceed/);
});

test('A5: removing a booking releases its slot and its fee', () => {
  const state = emptyState();
  book(state, 'naya', 'A', '16:00');
  state.bookings = state.bookings.filter((b) => b.artistId !== 'naya'); // what app.js does on remove
  assert.equal(total(state), 0);
  assert.equal(book(state, 'redwood', 'A', '16:00'), '');
});

// ---------- A6: save and finalise ----------

function bookFour() {
  const state = emptyState();
  book(state, 'naya', 'A', '14:00');
  book(state, 'nightbus', 'A', '15:00');
  book(state, 'mila', 'B', '14:00');
  return state;
}

test('A6: finalising with three artists is rejected', () => {
  assert.deepEqual(finaliseProblems(bookFour()), ['Book at least four artists before finalising.']);
});

test('A6: finalising with four valid bookings is allowed', () => {
  const state = bookFour();
  book(state, 'tomas', 'B', '15:00');
  assert.deepEqual(finaliseProblems(state), []);
});

test('FA05: finalising re-checks every booking against all rules', () => {
  // A plan that breaks a rule (two overlapping sets on Stage A), e.g. from an old saved plan.
  const state = bookFour();
  book(state, 'tomas', 'B', '15:00');
  state.bookings.push({ id: 'broken', artistId: 'riko', stage: 'A', start: at('14:30') });
  const problems = finaliseProblems(state);
  // Riko (14:30–15:30) clashes with Naya (14:00–15:00) and Night Bus (15:00–15:45): three problems.
  assert.equal(problems.length, 3);
  assert.match(problems.join(' '), /Riko Reyes: That slot overlaps/);
});

test('A6: a final plan is read-only', () => {
  const state = bookFour();
  state.final = true;
  assert.match(book(state, 'tomas', 'B', '15:00'), /final/);
  assert.equal(state.bookings.length, 3);
});

test('A6: the lineup, totals and final status survive reopening the app', () => {
  const state = bookFour();
  book(state, 'tomas', 'B', '15:00');
  state.final = true;
  const saved = JSON.stringify(state); // what app.js writes to localStorage

  const reopened = parseState(saved); // what app.js reads when the page opens again
  assert.deepEqual(reopened.bookings, state.bookings);
  assert.equal(total(reopened), total(state));
  assert.equal(reopened.final, true);
});

test('a broken or missing saved plan opens as an empty draft', () => {
  assert.deepEqual(parseState(null), emptyState());
  assert.deepEqual(parseState('not json'), emptyState());
});
