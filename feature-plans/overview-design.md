# Overview — same look as the other sections

Owner: Amelie · Branch: `feature-overview-design` (after shared festivals, #18)

## Why

The Overview was 880 px wide and centred, while every other section uses the full width,
a left-aligned header (small label, two-line serif headline with an orange italic second
line) and square white cards. Moving between sections felt like switching apps, and the
festival options were hidden behind a "⋯" menu.

## What

- [x] Same width and margins as the other sections (measured: content 266 px from the left
      edge, 1126 px wide at 1440 px, like Lineup, Tasks, Site map, Vendors, Finances, Checklist).
- [x] Header like the others: "FESTIVAL OVERVIEW", the festival name, and in orange italics
      how long until the festival ("41 days to go.", "Gates open today.", "Happening right
      now.", "That's a wrap."). Venue, dates and hours as labelled facts in one row.
- [x] "Edit festival details" is a visible button for Admins instead of the "⋯" menu.
- [x] Key figures as one row of tiles in the style of the Finances page: performances,
      artist budget remaining (of the total), project tasks done (new) and final checklist
      (with "x of 56 checks"). Each tile opens its section.
- [x] "Tasks needing attention" and "Finances" side by side as cards with serif titles and
      orange "Open … ↗" links, like the Task board; the Team below as a card.
- [x] One column on phones and narrow laptops.

## Out of scope

Assigning tasks and team progress (next feature), new data, changes to other sections.

## Done when

All tests pass; the overview lines up with the other sections at 1440 px, 1100 px and 390 px;
every ID the pages and tests use still exists; first-time setup, editing details, team and
the tile links still work after a reload.
