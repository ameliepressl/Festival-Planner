# Feature — Artist library (real artists, filters, photos)

Lineup planner. Builds on `lineup-integration.md` and `example-artist.md`.

## Why

Planning a lineup starts with "who could play?". Until now every artist had to be typed in by
hand. A large library of real artists lets the team search, compare and book in a few clicks,
while the festivals themselves stay fictional.

## What

- [x] **Library of 387 real artists** (`rules/artist-library.js`): name, genre (12 groups),
      style, country, region and size (Headliner / Main stage / Rising), including 21 Portuguese artists.
- [x] **Fictional fee estimates**: a fixed, repeatable number inside the range of the artist's size
      (Headliner €90k–250k, Main stage €25k–85k, Rising €4k–20k). These are **not real quotes**,
      and the screen says so.
- [x] **Filters**: search by name, style or country (ignores capitals and accents), genre, region,
      size and maximum fee; sorting by name or fee; "Clear filters"; 24 results per page with "Show more".
- [x] **Tabs** in the artist panel: "This festival" (the festival's own catalogue) and "Artist library".
- [x] **Add / Book**: "Add" copies the artist into the festival's catalogue (once); "Book" adds them
      if needed and opens the booking dialog. Only for people allowed to edit the lineup, and not after finalising.
- [x] **Photos**: from Wikipedia, only freely licensed Wikimedia Commons images, only when the
      article describes a musician (so a namesake never shows a wrong photo). Clicking a photo opens
      its Commons page (author and licence). There are at most 50 artists per request, and photos are
      remembered in the browser for 30 days under `fa-artist-photos-v2`, which never syncs to the account.
      Without a photo the initials stay. Festival artists taken from the library show their photo too.

## Rules (in `rules/`)

`filterArtistLibrary`, `estimatedFee`, `libraryArtistToCatalogue`, `acceptableArtistPhoto`,
`commonsFilePage`. A library artist is turned into a normal catalogue artist and passes `planProblems`.

## Tests

`tests/artist-library.test.js`: at least 200 artists, unique ids and names, complete details, fees
inside their range and repeatable, filters, accent-insensitive search, sorting, no change to the
library, a library artist passes the plan rules and can be booked, and only Commons photo URLs are accepted.

## Out of scope

Real booking fees or agency contacts; photos for the 17 artists without a free photo (they keep initials).
