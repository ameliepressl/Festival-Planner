# Feature — Consistent map pin names and appearance

Owner: Kira · Branch: `codex/docs-clarity-and-service-dependencies` · Builds on: `clear-site-map-pins.md`

The user requested the main update and these map refinements on the existing branch with the documentation changes. Fetched `main` at `dd51701`; the branch was already up to date.

## Why

Added facilities currently say “Add another toilets”, use names such as “Toilets (added 1)”, and carry orange origin labels and a plus badge. They should read and look like the preset facilities.

## What

- [x] Use grammatical countable labels for Add another across all supported pin types.
- [x] Give automatically named added facilities the same naming style as presets, continuing the facility numbering without collisions.
- [x] Preserve user-entered names, pin IDs, placements and saved data compatibility.
- [x] Remove the orange origin label and extra plus badge; keep standard category colours and normal pin rendering.
- [x] Keep placement, movement, removal, undo, save/reload and Viewer restrictions working.
- [x] **Rules:** `rules/site-map-rules.js` derives consistent names; `rules/map-pin-rules.js` supplies singular action wording and names new pins before saving. Screens render those results.
- [x] The user's existing documentation edits stay on this branch.

## Out of scope

- Changing map safety/layout calculations, database permissions or existing test assertions.
- Renaming user-defined pins or rewriting stored festival data on load.
- Merging this branch into main.

## Done when

- [x] All supported Add another labels are grammatical.
- [x] Added and preset facilities use the same marker drawing, without “Added by you” labels or a plus badge.
- [x] Saved automatically named pins display consistent names after reload; custom names remain intact.
- [x] New checks cover numbering, existing data, preserved custom names and rendered controls.
- [x] The full suite passes; browser checks include placement, save/reload and a narrow view using isolated test data.
- [x] Updated JS/CSS cache versions, README and project progress reflect the change.

## Tests

Full suite: **530 tests, 530 passed, 0 failed, 0 cancelled, 0 skipped, 0 todo**.
Output is saved locally at `/private/tmp/festival-map-pin-prepush-tests.txt`.

Added 17 tests across `tests/map-pin-presentation.test.js` and
`tests/map-pin-presentation-page.test.js`: all eight action labels, collision-free numbering,
old saved labels, custom names and HTML escaping, matching SVG rendering, Viewer restrictions,
and adding/saving/reopening a pin. Existing assertions were not changed.

Browser checks used a separate local server with a mocked account, so no live festival data
was changed: placed Toilets 8, reversed it with Undo, placed it again and saved/reloaded;
added Free water 6 and a custom VIP lounge and verified both after another save/reload.
The popup showed “Add another toilet block” / “Add another water point”, with no origin
label or extra badge. At 375px width the popup fit without horizontal overflow.
Console errors: none. The normal local app was then reopened on Site map without editing it.

Pre-push review caught a collision when the preset facility count increased. New generated
names now keep `automaticName: true` through parsing/saving so they can adapt after resizing.
Custom names remain fixed. Three additional regressions check this flag, resizing and names
that look like standard labels. The new page test also checks that this flag is saved.
In the isolated browser, a new Toilets 3 became Toilets 9 after increasing visitors from
500 to 5,000 because an existing custom Toilets 8 was reserved. After save/reload, all 40
rendered names were unique and VIP lounge was unchanged; no console errors.

JS/CSS cache versions were updated. Kira subsequently requested committing and pushing the
combined map/documentation branch for team review. No merge or database change is requested.
