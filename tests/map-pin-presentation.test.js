// Facility display names and action wording. Saved pin data and existing rule contracts stay intact.
const test = require('node:test');
const assert = require('node:assert/strict');
const { layoutItems, extraPinItems, namedExtraPinItems, parseExtraPins, EXTRA_PIN_TYPES } = require('../rules/site-map-rules.js');
const { addExtraPin, anotherPinLabel, placedExtraPins } = require('../rules/map-pin-rules.js');
const { capacityNeeds } = require('../rules/capacity-rules.js');

const base = (visitors = 5000, stages = 2) => layoutItems({ ...capacityNeeds(visitors), stages });
const automaticPin = (id, kind, n = 1) => ({ id, kind,
  name: `${EXTRA_PIN_TYPES.find((type) => type.kind === kind).label} (added ${n})` });

test('Add another uses a countable facility name for every supported kind', () => {
  const expected = { toilets: 'Add another toilet block', water: 'Add another water point',
    'first-aid': 'Add another first aid point', bar: 'Add another bar', info: 'Add another info point',
    security: 'Add another security post', recycling: 'Add another recycling point', marker: 'Add another pin' };
  assert.deepEqual(EXTRA_PIN_TYPES.map((type) => anotherPinLabel(type.kind)),
    EXTRA_PIN_TYPES.map((type) => expected[type.kind]));
  assert.equal(anotherPinLabel('unknown'), 'Add another pin');
  assert.equal(anotherPinLabel('constructor'), 'Add another pin');
});

test('automatic facilities continue the preset names and numbering for all kinds', () => {
  const preset = base();
  const kinds = ['toilets', 'water', 'first-aid', 'bar', 'info', 'security', 'recycling'];
  const pins = kinds.map((kind, i) => automaticPin(`x-${i + 1}`, kind));
  const shown = namedExtraPinItems(pins, preset);
  assert.deepEqual(shown.map((pin) => pin.name), ['Toilets 8', 'Free water 6', 'First aid 3',
    'Bar 1', 'Info point & lost and found 2', 'Security control 2', 'Recycling point 2']);
  assert.deepEqual(shown.map((pin) => pin.id), pins.map((pin) => pin.id));
  assert.ok(shown.every((pin) => pin.added === true));
});

test('numbering includes all preset facilities even when none has a placement', () => {
  const preset = base(20000, 3);
  const shown = namedExtraPinItems([automaticPin('x-1', 'toilets'), automaticPin('x-2', 'water'),
    automaticPin('x-3', 'first-aid')], preset);
  assert.deepEqual(shown.map((pin) => pin.name), ['Toilets 26', 'Free water 21', 'First aid 4']);
});

test('custom names reserve their numbers before automatic names regardless of array order', () => {
  const preset = base(500, 2);
  const pins = [automaticPin('x-1', 'toilets'), { id: 'x-2', kind: 'toilets', name: 'toilets 3' },
    automaticPin('x-3', 'toilets', 2), { id: 'x-4', kind: 'marker', name: 'Toilets 5' }];
  assert.deepEqual(namedExtraPinItems(pins, preset).map((pin) => pin.name),
    ['Toilets 4', 'toilets 3', 'Toilets 6', 'Toilets 5']);
});

test('a gap in custom numbering is available without changing the custom facility name', () => {
  const pins = [{ id: 'x-1', kind: 'water', name: 'Free water 4' }, automaticPin('x-2', 'water', 2),
    automaticPin('x-3', 'water', 3)];
  assert.deepEqual(namedExtraPinItems(pins, base(500)).map((pin) => pin.name),
    ['Free water 4', 'Free water 3', 'Free water 5']);
});

test('only exact automatic labels change; custom names and custom pins remain intact', () => {
  const pins = [
    { id: 'x-1', kind: 'toilets', name: 'VIP toilets' },
    { id: 'x-2', kind: 'toilets', name: 'toilets (added 1)' },
    { id: 'x-3', kind: 'toilets', name: 'Toilets (added 01)' },
    { id: 'x-4', kind: 'toilets', name: 'Toilets (added 1) near gate' },
    { id: 'x-5', kind: 'marker', name: 'Own pin (added 1)' },
    { id: 'x-6', kind: 'marker', name: '<img src=x onerror=alert(1)>' }
  ];
  assert.deepEqual(namedExtraPinItems(pins, base()).map((pin) => pin.name), pins.map((pin) => pin.name));
});

test('resizing the facility list avoids collisions without rewriting saved extra pins', () => {
  const pins = [automaticPin('x-1', 'toilets')];
  const before = JSON.stringify(pins);
  assert.equal(namedExtraPinItems(pins, base(500))[0].name, 'Toilets 3');
  assert.equal(namedExtraPinItems(pins, base(20000))[0].name, 'Toilets 26');
  assert.equal(JSON.stringify(pins), before);
});

test('naming creates fresh layout items while preserving metadata, source inputs and saved fallback', () => {
  const preset = base();
  const created = addExtraPin([], 'toilets');
  assert.equal(created.pin.name, 'Toilets (added 1)', 'the stored compatibility label is unchanged');
  const before = JSON.stringify({ preset, pins: created.extraPins });
  const originalItem = extraPinItems(created.extraPins)[0];
  const shown = namedExtraPinItems(created.extraPins, preset)[0];
  const { name, ...metadata } = shown;
  const { name: oldName, ...originalMetadata } = originalItem;
  assert.equal(name, 'Toilets 8');
  assert.deepEqual(metadata, originalMetadata);
  shown.name = 'Changed in this view';
  shown.text = 'Changed in this view';
  assert.equal(JSON.stringify({ preset, pins: created.extraPins }), before);
  assert.equal(namedExtraPinItems(created.extraPins, preset)[0].name, 'Toilets 8');
});

test('an empty map list uses type labels and unnamed input yields no facilities', () => {
  assert.deepEqual(namedExtraPinItems(), []);
  assert.equal(namedExtraPinItems([automaticPin('x-1', 'water')], [])[0].name, 'Free water 1');
  assert.deepEqual(namedExtraPinItems([{ id: 'bad', kind: 'water', name: 'bad' }], base()), []);
});

test('new automatic names survive storage and avoid preset collisions after festival size changes', () => {
  const created = addExtraPin([], 'toilets', '', base(500));
  assert.deepEqual(created.pin, { id: 'x-1', kind: 'toilets', name: 'Toilets 3', automaticName: true });
  const stored = JSON.parse(JSON.stringify(placedExtraPins(created.extraPins, { 'x-1': [600, 400] })));
  const reopened = parseExtraPins(stored);
  const before = JSON.stringify(reopened);
  const larger = base(5000);
  const shown = namedExtraPinItems(reopened, larger);
  assert.equal(shown[0].name, 'Toilets 8');
  assert.equal(shown[0].id, 'x-1');
  assert.equal(shown[0].automaticName, true);
  const names = [...larger, ...shown].map(pin => pin.name.toLowerCase());
  assert.equal(new Set(names).size, names.length);
  assert.equal(JSON.stringify(reopened), before, 'displaying a resized map does not rewrite saved pins');
  assert.equal(namedExtraPinItems(reopened, base(500))[0].name, 'Toilets 3');
});

test('explicit standard-looking names stay custom while new automatic names reflow around them', () => {
  const own = addExtraPin([], 'toilets', 'Toilets 8', base(5000));
  const automatic = addExtraPin(own.extraPins, 'toilets', '', base(5000));
  assert.equal(Object.hasOwn(own.pin, 'automaticName'), false);
  assert.equal(automatic.pin.name, 'Toilets 9');
  const reopened = parseExtraPins(JSON.parse(JSON.stringify(automatic.extraPins)));
  assert.deepEqual(namedExtraPinItems(reopened, base(20000)).map(pin => pin.name), ['Toilets 8', 'Toilets 26']);
  assert.deepEqual(namedExtraPinItems(reopened, base(500)).map(pin => pin.name), ['Toilets 8', 'Toilets 3']);
});

test('parsing keeps only a strict automatic-name flag for standard facility pins', () => {
  const pins = [
    { id: 'x-1', kind: 'water', name: 'Free water 3', automaticName: true, ignored: 'discard' },
    { id: 'x-2', kind: 'water', name: 'Custom water', automaticName: 'true' },
    { id: 'x-3', kind: 'water', name: 'Other water', automaticName: 1 },
    { id: 'x-4', kind: 'marker', name: 'Free water 3', automaticName: true },
    { id: 'x-5', kind: 'bar', name: 'Custom bar', automaticName: false }
  ];
  const parsed = parseExtraPins(pins);
  assert.deepEqual(parsed, [
    { id: 'x-1', kind: 'water', name: 'Free water 3', automaticName: true },
    { id: 'x-2', kind: 'water', name: 'Custom water' },
    { id: 'x-3', kind: 'water', name: 'Other water' },
    { id: 'x-4', kind: 'marker', name: 'Free water 3' },
    { id: 'x-5', kind: 'bar', name: 'Custom bar' }
  ]);
  assert.equal(namedExtraPinItems(parsed, base(5000))[3].name, 'Free water 3');
});
