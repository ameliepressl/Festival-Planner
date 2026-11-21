// Map edits stay in memory until the organiser explicitly saves them.
const cloneMapDraft = value => JSON.parse(JSON.stringify(value));
const mapDraftFingerprint = value => JSON.stringify({ sites: value.sites, ground: value.ground, currentId: value.currentId });

function createMapDraft(snapshot) {
  return { saved: cloneMapDraft(snapshot), present: cloneMapDraft(snapshot), previous: null };
}

function mapDraftDirty(draft) { return mapDraftFingerprint(draft.present) !== mapDraftFingerprint(draft.saved); }

function changeMapDraft(draft, snapshot) {
  const changed = mapDraftFingerprint(snapshot) !== mapDraftFingerprint(draft.present);
  if (changed) draft.previous = cloneMapDraft(draft.present);
  draft.present = cloneMapDraft(snapshot);
  return changed;
}

function undoMapDraft(draft) {
  if (!draft.previous) return false;
  draft.present = draft.previous;
  draft.previous = null;
  return true;
}

function discardMapDraft(draft) {
  draft.present = cloneMapDraft(draft.saved);
  draft.previous = null;
}

// localStorage has no transaction: restore all three previous values if any write fails.
// Account sync runs after this synchronous operation and therefore sees the restored values.
function saveMapDraft(draft, storage, keys) {
  const writes = [[keys.sites, JSON.stringify(draft.present.sites)],
    [keys.ground, JSON.stringify(draft.present.ground)], [keys.selected, draft.present.currentId]];
  let before;
  try {
    before = writes.map(([key]) => [key, storage.getItem(key)]);
    writes.forEach(([key, value]) => storage.setItem(key, value));
  } catch (error) {
    let restored = true;
    (before || []).forEach(([key, value]) => {
      try { if (value === null) storage.removeItem(key); else storage.setItem(key, value); }
      catch { restored = false; }
    });
    return { ok: false, restored, error };
  }
  draft.saved = cloneMapDraft(draft.present);
  return { ok: true };
}

if (typeof module !== 'undefined') module.exports = {
  createMapDraft, mapDraftDirty, changeMapDraft, undoMapDraft, discardMapDraft, saveMapDraft
};
