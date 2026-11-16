# Feature — Site map & layout planner

## Why

As a festival organiser, I can see the festival ground as a realistic map, click any
facility to see its details, upload maps of different grounds, and let the page
suggest the optimal layout for each one — so stages, first aid, toilets, water,
the food court, the gate and the emergency exits are where they should be.

## What

- [ ] "Site map" in the left navigation opens the map page; the other items still work.
- [ ] A realistic top-down (aerial) map: grass, forest, lake, gravel walkways and every
      facility in its real size (stages with crowd area, tents, food trucks, toilet rows …).
      Every facility has a pin. Clicking a pin shows: name, category, description,
      responsible team, opening hours, walking time from the gate, the nearest first
      aid / toilets / water, and the layout rules it meets or breaks.
- [ ] Zoom (mouse wheel, + / −) and pan (drag); a scale bar in metres.
- [ ] Category chips show or hide the pins of a category.
- [ ] A demo ground is always there. "Upload map" adds an aerial photo or site plan;
      several maps can be saved and switched with the map selector, and deleted.
- [ ] Per map: real width in metres (the scale), "Draw fence", "Set gate",
      "Mark no-go" / "Erase no-go" (water, forest, roads, buildings) and
      "Detect water automatically" (blue areas of the photo become no-go).
- [ ] "Suggest optimal layout" places all 21 facilities: gate on the fence, main stage
      far from the gate, second stage far from the main stage, food court in the
      middle, first aid, water and toilets near each stage, info and security at the
      gate, two emergency exits far apart, stages with 25 m free ground around them,
      nothing on a no-go area. Walkways are routed around no-go areas.
- [ ] "Move pins" lets you drag facilities; the layout check updates immediately.
- [ ] The layout check shows a score and 10 rules (✓ / ✕ with the numbers);
      clicking a rule selects the facility concerned.
- [ ] The food court pitches show the vendors confirmed on the Vendors page as food trucks.
- [ ] Maps and layouts are saved in the browser and are still there after reloading.
- [ ] Facilities, rules, planner and walkway routing live in rules/site-map-rules.js;
      the drawing in site-map/map-drawing.js; the page in site-map/site-map-page.js.

## The 10 layout rules

1. Every facility is on the map.
2. Nothing stands on a no-go area or outside the fence; gate and exits are on the fence.
3. The stages are at least 150 m apart (sound).
4. First aid within 200 m of every stage.
5. Toilets within 150 m of every stage.
6. Free water within 120 m of every stage.
7. The food court is at least 50 m from each stage.
8. Two emergency exits at least 150 m apart.
9. Info and security within 80 m of the gate.
10. Facilities at least 10 m apart (food pitches 5 m).

## Out of scope

- Recognising buildings or roads in photos automatically (only water is detected;
  everything else is marked by hand)
- More than two stages, adding new kinds of facilities on the page
- Sharing maps between different computers (the browser saves them locally)
- Real geographic coordinates or satellite tiles

## Done when

1. `uvx --from nodejs-wheel node --test` passes all tests.
2. On the demo ground the suggested layout meets all 10 rules (100 %).
3. Clicking a pin shows its details; clicking a rule selects its facility.
4. Uploading a photo with a blue lake marks the lake as no-go and suggests a layout
   where nothing stands in the lake.
5. Dragging the toilets into the lake turns the layout check red and names the toilets;
   "Suggest optimal layout" brings it back to 100 %.
6. Drawing a new fence and setting the gate on another side, then suggesting again,
   plans around the new fence and gate.
7. After reloading the page the uploaded map and its layout are still there.
8. Clicking "Lineup planner" shows the planner again; booking still works.
