# Feature — Vendor library (food and drink stands with menus)

Vendors page. Builds on `vendors.md` and `artist-library.md` (it reuses its photo loader), so
**merge the artist library first**.

## Why

24 vendors are too few to plan a real food court. The team wants a large choice of food and drink
stands, a quick way to find the right one (vegan, alcohol-free, cheap pitch fee, ...) and to see
what each stand actually sells.

## What

- [x] **Vendor library** (`rules/vendor-library.js`): 172 extra stands (112 food, 60 drinks) in
      43 kinds (Burgers, Tacos, Francesinha, Pastries, Craft beer, Port wine, Bubble tea, ...).
      All stands, menus and prices are **fictional examples**, and the page says so.
- [x] **Menus for every vendor**, the 24 originals included: items, prices and labels
      (vegan, vegetarian, gluten-free, alcohol-free). Shown with the "Menu" button on each card.
- [x] **Stand labels follow the menu**: a library stand is "vegan" only if its menu has a vegan item.
      The 24 originals keep their labels, and their menus never claim more than the labels do.
- [x] **Search and filters**: search by stand, kind, dish or drink (accents and capitals are ignored),
      category chips (All / Food / Drinks / Merch), kind of stand, "menu has" (vegan, vegetarian,
      gluten-free, alcohol-free), maximum pitch fee, sorting (featured, name, pitch fee),
      "Clear filters", and 24 cards per page with "Show more".
- [x] **Dish photos** from Wikipedia, using only freely licensed Wikimedia Commons images (e.g. the photo
      of the article "Taco"). They are loaded by `artist-library/artist-photos.js` with `data-photo-kind="dish"`.
      Clicking a photo opens its author and licence. Without a photo the emoji stays.
- [x] **Everything else stays the same**: confirming on pitches, pitch income, visitor needs, site map,
      finances and the demo festival work for every stand. The original 24 ids are unchanged.

## Rules (in `rules/`)

`vendor-rules.js`: `menuFrom`, `allVendors`, `findVendor` (now also finds library stands),
`filterVendors`, `vendorCuisines`. `vendor-library.js`: `VENDOR_LIBRARY`, `standMenu`, `tagsFromMenu`.
`vendor-rules.js` still works on its own: without the library only the 24 vendors exist.

## Tests

`tests/vendor-library.test.js`: size and unique ids, the originals first, every stand has a menu
with prices and a photo title, labels match the menus, menu shorthand, filters (category, kind,
diet incl. "vegan counts as vegetarian", fee, menu search, accents), sorting, kinds per category,
and library stands can be confirmed, saved, reloaded, counted as income and as visitor needs.
The existing vendor tests are unchanged and still pass.

## Out of scope

Real vendor companies, ordering or payment, editing menus in the app.
