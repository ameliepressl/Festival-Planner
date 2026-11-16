# Feature — Vendors

## Why

As a festival organiser, I can choose the food, drink and merch vendors for the
festival, see where each one stands on the site map, how much pitch income they
bring in, and whether the visitors' basic needs are covered (e.g. a vegan option).

## What

- [ ] "Vendors" in the left navigation opens the vendor page.
- [ ] A catalogue of 24 vendors, each as a card with a symbol, category
      (Food, Drinks, Merch), short description, dietary tags and pitch fee.
- [ ] Filter chips by category.
- [ ] "Confirm" gives a vendor the first free food court pitch (P1–P6).
      With all 6 pitches taken, confirming is refused with a clear reason.
      "Remove" frees the pitch again. "Show on map" opens the site map at that pitch.
- [ ] A summary at the top: pitches used (x of 6), pitch income in euros, and a
      coverage check: at least one vegan option, one drinks vendor and one
      alcohol-free drinks vendor. Missing items are named.
- [ ] Confirmed vendors are saved in the browser and are still there after reloading.
- [ ] The catalogue and all rules live in rules/vendor-rules.js; the page code in vendors/.

## Out of scope

- Adding or editing vendors on the page
- Sharing the choice between different computers (the browser saves it locally)
- Linking pitch income to the artist budget

## Done when

1. `uvx --from nodejs-wheel node --test` passes all tests.
2. Nothing confirmed → "0 of 6 pitches", € 0 income, all three coverage items missing.
3. Confirming 6 vendors fills P1–P6; a 7th is refused with "All 6 pitches are taken".
4. Removing the vendor on P2 and confirming another one puts the new vendor on P2.
5. After reloading the page the same vendors are on the same pitches.
6. The site map shows the confirmed vendors on their pitches.

## Update — pitches follow the festival size

The number of food court pitches is no longer fixed at 6: it follows the expected
visitors (one pitch per 400 visitors, 4 – 20), see feature-plans/festival-size.md.
The rules keep 6 as the default when no size is given, so the checks above still hold.
