# Feature — Clear all pins on the Site map

Owner: Frederik · Branch: `feature-clear-site-map` · Builds on: the Site map and its draft (`rules/map-draft-rules.js`)

## Why

Team request: *"Site map: create button to clear all pins so that the user can start adjusting the
layout from scratch."* Until now an organiser could only move the suggested pins one by one, or press
*Suggest layout* again. There was no way to start with an empty ground and place everything yourself.

## What

- [x] **Clear all pins** next to *Suggest layout*. A confirmation says exactly what happens:
      how many pins go (by category, in the map colours), what stays (map, fence, no-go areas,
      festival size, crowd measurements) and that nothing is saved yet.
- [x] **Keep the main entrance** is ticked by default, because everything else is planned around the gate.
      The button counts live: "Clear 77 pins" / "Clear 78 pins".
- [x] **Pins to place** card: every pin still missing, grouped by category, with a progress bar
      ("12 of 78"). Pick a pin, click its spot on the map, and the next one of the same kind is ready.
- [x] Many pins of one kind share one button ("Toilets ×25", "Free water ×20", "Food pitches ×20");
      it places the toilets and water next to each stage first. Fewer than four keep their own names.
- [x] While placing, a see-through pin follows the mouse; it turns into a red ✕ where the pin
      cannot stand (water, forest, outside the fence), and a click there explains why.
      Gate and emergency exits snap onto the fence.
- [x] The dark hint bar shows the pin being placed and how many are left, with *Skip* and
      *Done placing*, and *All pins* jumps to the list (handy on narrow screens); **Esc** stops too.
- [x] **Fill the rest for me** keeps every pin placed by hand and plans only the missing ones.
      The existing *Plan them* button now does the same instead of replacing hand-placed pins.
- [x] The last pin: the layout check ring pops and a message gives the score.
- [x] Everything stays a draft: **Undo change** brings the pins back right after clearing,
      **Discard changes** returns to the saved map, **Save changes** keeps the new layout.
- [x] Viewers (no edit right) see the button disabled, like *Suggest layout*.
- [x] **Rules in `rules/map-pin-rules.js`:** `clearedPlacements`, `pinCounts`, `pinsToPlace`,
      `pinChoices`, `nextPinToPlace`, `pinSpot` (usable ground / snap to fence), `fillMissingPins`. Screen code only
      in `site-map/site-map-page.js`, styles in `site-map/site-map.css`.
- [x] Cache versions raised in `index.html` for the changed page script and stylesheet.

## Out of scope

- Several undo steps (the draft keeps one step, as before).
- Dragging pins from the card onto the map (click to place works with mouse, touch and keyboard focus).
- Changing the layout rules or *Suggest layout*.

## Done when

- [x] Clearing, keeping the gate, placing, refusing bad spots, snapping to the fence, filling the rest,
      undo and discard all work in the browser.
- [x] New tests for every rule; no existing test changed. Full suite passes.
- [x] Works at phone width (375 px) without sideways scrolling.

## Tests

`tests/clear-site-map-pins.test.js` (15 tests): clear with and without the gate; the saved object is never
changed; counts; pins grouped by category; next pin after placing and after Skip; normal spot; lake,
forest and outside the fence refused with a message; gate and exits snap onto the fence and pass the
layout check; nonsense input; "Fill the rest" keeps hand-placed pins; clear + Undo through the map draft;
a cleared map still parses with fence, gate and no-go areas; many pins of one kind share a button (stage
toilets first) while a few keep their own names. No existing test was changed.
Full suite: 498 tests, 498 pass, 0 fail.

Browser check (Munich demo, port 8021, test storage cleared afterwards): dialog shows 77 pins with the gate
kept, 78 without; after clearing only the gate is left and Stage A is ready; the preview pin follows the
mouse and turns red over the lake; a click in the lake is refused with the message; Stage B is ready after
Stage A; *Fill the rest* adds 76 pins and keeps both hand-placed ones (layout check 90 %); *Discard changes*
restores all 78 saved pins; *Keep my pins* closes the dialog and returns focus; the grouped *Toilets ×25*
button starts with "Toilets · Stage A". No console errors.
