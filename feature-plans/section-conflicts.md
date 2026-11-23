# Feature — Conflicts between two people editing the same section

Owner: Amelie · Branch: `feature-section-conflicts` · Builds on: [shared-festivals.md](shared-festivals.md)

## Why

Amelie's browser test (Chrome and Safari, both on the Finances page) found that two accounts editing one
festival can silently overwrite each other **within the same section**, even when they change different fields:

1. Open Finances in two browser sessions.
2. In Chrome, change the sponsorship and wait for "Saved".
3. Without refreshing Safari, change the bar margin and wait for "Saved".
4. Reload Chrome: the sponsorship is back at Safari's old value. No conflict warning appeared.

Other findings of that test: a vendor change and a finance change both survived a reload (different sections
are fine); Safari kept stale values until it was refreshed. The cause is documented in AGENTS.md: a section is
one browser key, and the last save of a key wins.

## What

- [x] **Database (`migrations/007_section_conflicts.sql`):** every section has a version number
      (`festivals.section_versions`), raised by a trigger on every change. `save_festival_changes` takes the versions the
      browser started from (`expected`). A section that was saved by someone else in the meantime is **not written**; the
      answer names it in `conflicts`. Sections that did not clash are saved in the same call. Without `expected` the
      function behaves as before, so the old page code keeps working until the new one is online.
- [x] **Rules in `rules/account-rules.js`:** versions are kept in the browser's sync state (`meta.versions`); refused
      sections are held in `meta.conflicts` and never sent again until the person decides; `conflictMessage` names the
      section in plain words.
- [x] **Screen (`account/account.js`, notice bar):** the edit stays in the browser, nothing is lost. The bar says which
      section clashed and offers **Keep mine** (replaces the teammate's version, knowingly) and **Use theirs** (loads the
      saved festival, drops only the held edit; other sections are saved first). The sidebar status reads "Not saved —
      a teammate changed the same section". Reloading the page asks again. Signing out or opening another festival is
      blocked while a conflict waits, so the edit cannot be thrown away by accident.
- [x] **Safe order of deployment:** the page works with and without the migration (a missing `section_versions` column
      is handled; no `expected` is sent to a database without versions).

## Out of scope

- Merging two people's edits field by field (a section is an opaque text; the person chooses).
- Live collaborative editing or locks while someone else is typing.
- Team roster changes (they have their own save path) and the team's festival list.
- A "keep both" copy of the held edit.

## Done when

- [x] Different-section changes by two sessions both persist.
- [x] A same-section change by a stale session never silently replaces a teammate's version; it is refused with a clear message.
- [x] A refused save keeps the person's edit; reloading the page keeps it too and asks again.
- [x] Keep mine and Use theirs both end with the same data in both sessions after a reload.
- [x] Tests in `tests/section-conflicts.test.js` cover the rules, the coordinator and the browser test above step by step
- [x] All tests pass
- [ ] Tried in two real browsers after migration 007 is run (see "Run it" below)
- [x] `AGENTS.md` and `README.md` updated

## Run it

1. **Database (Amelie, once):** Supabase → SQL Editor → paste `migrations/007_section_conflicts.sql` → Run. Running it
   again is harmless. It adds one column and one trigger and replaces `save_festival_changes`; no data is changed or deleted.
2. **Merge the pull request** (the page then uses the versions).
3. **Browser test again** (Chrome and Safari, same account or two team accounts on one festival), reload both first:
   1. Chrome: change the sponsorship, wait for "Saved".
   2. Safari (not refreshed): change the bar margin. Expected: *Not saved — a teammate changed the finances…* with
      **Keep mine** and **Use theirs**; the bar margin is still shown; nothing is overwritten.
   3. Safari: change something in Vendors. Expected: saved.
   4. Reload Chrome: sponsorship still has Chrome's value, the vendor change is there.
   5. Safari: **Use theirs**. Expected: the page reloads with Chrome's sponsorship. (Or try **Keep mine** instead: Chrome's
      value is replaced after reloading Chrome.)
   6. Safari, new conflict, then reload the page before choosing: the edit and the question are still there.
   7. Both sessions reload and show the same data.

## Found in the first retest with two accounts (23 Nov, evening)

Test 2 (a vendor change saved while a finance conflict waited) replaced the conflict bar with the general
"A teammate also saved … yours are saved" bar, so Keep mine / Use theirs disappeared until a reload. Fixed: while
a section waits, no general bar replaces the conflict bar; any other bar keeps the two choices (and no useless
Reload); a closed conflict bar opens again when the status in the sidebar is clicked. Four regression tests
(two of them fail on the earlier code).

**Keep mine takes the whole section.** After Keep mine the finances of the person who chose it replace the teammate's
version *entirely* (e.g. a sponsorship value the teammate saved in between is lost too). That is the intended meaning
of Keep mine for now: a section is saved as one piece (see Out of scope). Use theirs, or copying the value by hand
before choosing, are the ways to keep the teammate's number.

## Tests

- `tests/section-conflicts.test.js`: 23 tests (rules, the real `account/account.js` with a fake database that behaves like
  migration 007, and the two-browser test step by step).
- The SQL was run against a real PostgreSQL (PGlite) together with migrations 001–006, twice in a row: different sections
  both saved; a stale same-section save refused and not written; a mixed batch saves only the clean section; a stale
  removal refused; a save without `expected` behaves as before; a direct `update` also raises the version; a Viewer is
  refused. Role rules (Editor/Viewer) are unchanged because the function still runs with the caller's rights.
