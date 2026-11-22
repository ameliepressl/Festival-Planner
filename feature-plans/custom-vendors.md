# Feature — "Add vendor": your own stands

Builds on `vendors.md` and `vendor-catalogue.md`.

## Why

The catalogue has 24 original vendors and 172 library stands, but a real festival works with its own
partners (a local bakery, the sponsor's drinks bar). Organisers need to add them with everything the
app knows about a stand, so they can be booked, appear on the site map and count in the finances.

## What

- [x] **"+ Add vendor" button** on the Vendors page (next to "Clear filters"). It opens a form with:
      stand name, category (Food / Drinks / Merch), kind of stand (suggestions from the catalogue),
      pitch fee, description, optional dish photo (Wikipedia article) and a **menu of 1–12 items**,
      each with a name, a price and diet labels (vegan, vegetarian, gluten-free, alcohol, alcohol-free).
- [x] **Rules in `rules/vendor-rules.js`** (`customVendorProblem`, `addCustomVendor`, `updateCustomVendor`,
      `deleteCustomVendor`, `parseCustomVendors`):
  - name 2–60 characters, unique among all vendors (upper/lower case ignored)
  - kind 2–40 characters; description ≤ 200; photo word ≤ 80
  - pitch fee whole euros €0–€20,000
  - menu prices above €0, at most €500, at most two decimals
  - only drinks stands sell alcohol; a drink is never both alcohol and alcohol-free
  - vegan dishes count as vegetarian; **the stand's labels follow its menu**, so a stand never claims
    more than it sells (same rule as the vendor library)
  - at most 50 own stands
  - every wrong input gets one sentence that says what to change; nothing is saved
- [x] **Own stands behave like catalogue vendors**: listed first with a "Your stand" badge, searchable
      and filterable, Confirm puts them on a pitch, the pitch income, visitor needs, site map and
      finances include them.
- [x] **Edit and delete** own stands (Edit button on their card). Editing keeps the id, so the pitch stays.
      Delete needs a second click and frees the pitch.
- [x] **Saved per festival** under `festival-architect-custom-vendors`, so the stands are part of the
      festival data of the account (synced like the other `festival-` sections). Saved data is checked
      again when it is read; broken or tampered entries are dropped.
- [x] **Roles**: Admin and Editor can add, edit and delete (same right as confirming vendors); Viewer
      sees the button disabled, and direct calls are refused too.

## Not included

- Uploading your own photo (only a Wikipedia article name).
- Editing the 196 catalogue vendors (they stay fixed examples).

## Tests

`tests/custom-vendors.test.js`:
- accepted stands with all fields, labels from the menu
- every rejected input
- unique names and ids, the 50-stand limit
- edit keeps the pitch; delete frees the pitch
- reading back drops broken and tampered data
- own stands from storage count for pitches, pitch income and visitor needs
- the Vendors page: Admin and Editor add, a wrong form stays open, Viewer is blocked, edit and two-click delete

No existing test was changed.

## Security follow-up (innerHTML audit)

Own stand names are free text, so every place that shows them must escape them. The audit found one
place that did not: the pitch message on a vendor card ("<name> is already on pitch P2") was inserted
as HTML. It is now escaped (`vendors/vendors-page.js`). A new test adds a stand called
`<img src=x onerror=alert(1)>` and checks the message shows it as text; it failed before the fix.
