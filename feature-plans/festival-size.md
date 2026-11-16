# Feature — Festival size (expected visitors)

## Why

As a festival organiser, I enter how many visitors I expect, and the app tells me how
many toilets, water points, food pitches, first aiders and security staff I need — and
plans that many on the site map and on the Vendors page.

## What

- [ ] A "Festival size" card on the Site map with "Expected visitors" (500 – 20,000).
- [ ] It shows the needs: toilet cabins (in rows of 8), water points, food pitches,
      first aiders, security staff — with a note that these are rules of thumb.
- [ ] The map gets that many toilet rows, water points and pitches. After a change,
      the layout check names the facilities that still need a place, with a
      "Plan them" button. The planner spreads extra toilets and water along the walkways.
- [ ] The Vendors page has as many pitches as the festival size needs ("x of y pitches").
      If the food court gets smaller, vendors on pitches that no longer exist lose their
      pitch and the page says which ones.
- [ ] The festival size is saved in the browser.
- [ ] The numbers live in rules/capacity-rules.js.

## Rules of thumb used

| Need | Rule |
| --- | --- |
| Toilet cabins | 1 per 100 visitors, in rows of 8, at least 2 rows |
| Water points | 1 per 1,000 visitors, at least 2 |
| Food pitches | 1 per 400 visitors, at least 4, at most 20 |
| First aiders | 1 per 500 visitors, at least 4 |
| Security staff | 1 per 250 visitors, at least 10 |

These are a starting point for planning, not a legal requirement.

## Out of scope

- Different rules for multi-day or camping festivals
- Crew scheduling for first aiders and security

## Done when

1. `uvx --from nodejs-wheel node --test` passes all tests.
2. 5,000 visitors → 50 toilet cabins (7 rows), 5 water points, 13 pitches, 10 first aiders, 20 security staff.
3. Changing to 12,000 shows "22 facilities … still need a place"; "Plan them" gives 100 % on the demo ground.
4. The Vendors page then shows 20 pitches; with 3,000 visitors it shows 8, and vendors on P9–P20 lose their pitch with a message.
5. After reloading the page the festival size is still there.
