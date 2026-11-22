# Security — audit of every place that builds HTML (`innerHTML`)

## Why

The app builds most screens as HTML text and puts it into the page with `innerHTML`. If text that a
user typed (an artist name, a task title, an own stand ...) went in unescaped, a teammate in a shared
festival could save something like `<img src=x onerror=...>` and run code in everyone else's browser
(stored cross-site scripting). Text from users must therefore always be escaped.

## How we checked (22 November 2026, after the vendor and finance features)

1. Listed every HTML sink in the app code (`innerHTML`, `insertAdjacentHTML`): 49 places in 11 files.
2. A small script listed every `${...}` value inside an HTML template, including templates nested in
   `.map(...)`, that was not obviously safe (escaped, a formatted number or a fixed text).
3. Each remaining value was traced back to where it comes from:
   - **text from users** (artist and stage names, genres, notes, task titles, festival and map names,
     usernames, own stands with menus, own finance lines) → must be escaped;
   - **fixed texts in the code** (labels, checklist items, scenario and month names, roles) → safe;
   - **numbers, dates and ids** that the rules check when loading (e.g. own finance lines only allow
     ids like `x1a2b`, own stands only `c-name`) → safe.
4. Messages that only use `textContent`, `toast`, `confirm` or `aria-label` via `setAttribute` show
   text, never HTML, and are safe by design.

## Result

- **One problem found and fixed:** on a vendor card, the message "*name* is already on pitch P2" was
  inserted as HTML. Since own stand names are free text, a name like `<img src=x onerror=alert(1)>`
  could run code. It is now escaped (`vendors/vendors-page.js`), and a test in
  `tests/custom-vendors.test.js` uses exactly that name; it failed before the fix and passes now.
- Everything else that shows user text uses `escapeHtml` / `escape`, or rebuilds saved data from an
  allow-list when it is loaded (`parseCustomVendors`, `parseFinanceExtras`, ...).
- Defence in depth: the database (Row Level Security) decides who may save which section, so only
  invited teammates with the right role can write data that others will see.

## Limits

This is a careful manual review with a helper script, not a formal security test. New screens must
keep the rule: **every value from users goes through `escape`/`escapeHtml` or `textContent`.**
