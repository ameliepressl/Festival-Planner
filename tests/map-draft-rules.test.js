const test = require('node:test');
const assert = require('node:assert/strict');
const { createMapDraft, mapDraftDirty, changeMapDraft, undoMapDraft, discardMapDraft, saveMapDraft } = require('../rules/map-draft-rules.js');

const initial = () => ({ sites: [{ id: 'map-a', placements: { toilet: [10, 20] } }], ground: { visitors: 500 }, currentId: 'map-a' });
const keys = { sites: 'festival-architect-site-maps', ground: 'festival-architect-ground', selected: 'festival-architect-site-map-selected' };
function fakeStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
}

test('map gestures stay in memory; undo restores the complete previous gesture', () => {
  const draft = createMapDraft(initial()), storage = fakeStorage();
  const moved = initial(); moved.sites[0].placements.toilet = [100, 200];
  assert.equal(changeMapDraft(draft, moved), true);
  assert.equal(mapDraftDirty(draft), true);
  assert.equal(storage.getItem(keys.sites), null);
  assert.equal(undoMapDraft(draft), true);
  assert.deepEqual(draft.present, initial());
  assert.equal(mapDraftDirty(draft), false);
  assert.equal(undoMapDraft(draft), false);
});

test('save commits map, expected visitors and active map together; discard returns to saved version', () => {
  const draft = createMapDraft(initial()), storage = fakeStorage();
  const changed = initial(); changed.ground.visitors = 1000; changed.currentId = 'map-b'; changed.sites.push({ id: 'map-b' });
  changeMapDraft(draft, changed);
  assert.equal(saveMapDraft(draft, storage, keys).ok, true);
  assert.deepEqual(JSON.parse(storage.getItem(keys.sites)), changed.sites);
  assert.deepEqual(JSON.parse(storage.getItem(keys.ground)), changed.ground);
  assert.equal(storage.getItem(keys.selected), 'map-b');
  assert.equal(mapDraftDirty(draft), false);
  changeMapDraft(draft, initial());
  discardMapDraft(draft);
  assert.deepEqual(draft.present, changed);
  assert.equal(mapDraftDirty(draft), false);
});

test('a failed multi-key save restores previous storage values and preserves the recoverable draft', () => {
  const seed = { [keys.sites]: 'old-maps', [keys.ground]: 'old-ground', [keys.selected]: 'old-selection' };
  const storage = fakeStorage(seed), nativeSet = storage.setItem;
  let rejected = false;
  storage.setItem = (key, value) => {
    if (key === keys.ground && !rejected) { rejected = true; throw new Error('quota'); }
    nativeSet(key, value);
  };
  const draft = createMapDraft(initial()), changed = initial(); changed.ground.visitors = 1500;
  changeMapDraft(draft, changed);
  const result = saveMapDraft(draft, storage, keys);
  assert.equal(result.ok, false); assert.equal(result.restored, true);
  Object.entries(seed).forEach(([key, value]) => assert.equal(storage.getItem(key), value));
  assert.deepEqual(draft.present, changed); assert.equal(mapDraftDirty(draft), true);
  assert.equal(saveMapDraft(draft, storage, keys).ok, true);
});

test('unchanged gestures do not replace the undo history; selecting an active map requires saving', () => {
  const draft = createMapDraft(initial()), changed = initial(); changed.currentId = 'map-b';
  changeMapDraft(draft, changed);
  assert.equal(mapDraftDirty(draft), true);
  assert.equal(changeMapDraft(draft, changed), false);
  assert.equal(undoMapDraft(draft), true);
  assert.deepEqual(draft.present, initial());
});

test('undo after saving settings restores the last action as a new draft, while discard returns to the committed settings', () => {
  const draft = createMapDraft(initial()), storage = fakeStorage();
  const changed = initial(); changed.sites[0].widthMetres = 250; changed.ground.visitors = 2000;
  changeMapDraft(draft, changed);
  assert.equal(saveMapDraft(draft, storage, keys).ok, true);
  assert.equal(undoMapDraft(draft), true);
  assert.deepEqual(draft.present, initial());
  assert.equal(mapDraftDirty(draft), true);
  assert.deepEqual(JSON.parse(storage.getItem(keys.ground)), changed.ground);
  discardMapDraft(draft);
  assert.deepEqual(draft.present, changed);
  assert.equal(mapDraftDirty(draft), false);
});
