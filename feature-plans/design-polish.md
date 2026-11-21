# Design polish — a calmer, more professional look

Owner: Amelie · Branch: `feature-design-polish` (builds on `feature-multiple-festivals`, PR #29)

## Why

People told us the app "looks like AI made it". The main reasons, page by page:
tiny all-caps typewriter labels above everything ("FESTIVAL OVERVIEW", "VENUE"), symbols
instead of icons in the sidebar (⌂ ⌁ ⌖ ▤ ✦), a decorative italic second headline
("230 days to go."), three fonts (a serif, a sans and a typewriter font), emojis as images,
many different button styles, and long explanation texts that say the same thing twice.

## What

The cream paper and coral stay: they are our festival look. Everything else gets one system:

- [ ] **Fonts:** Archivo Narrow (condensed, like a festival poster) for headings and big
      figures, Archivo for all other text. No serif, no typewriter font. Figures line up in
      columns (tabular numbers).
- [ ] **Colour:** coral only for the main action on a screen and small highlights. Dark text on
      coral buttons, because white text on coral is too faint to read well.
- [ ] **One button system:** primary (coral), secondary (outlined), danger (red outline), all
      with the same height and rounded corners. No jumping on hover.
- [ ] **Sidebar:** real line icons, no "PROJECT" label; the festival list, "New festival" and
      "Open demo festival" sit together; the signed-in person with their initial.
- [ ] **Header:** the logo appears once (sidebar). The header shows the festival and the
      countdown ("230 days left").
- [ ] **Overview:** the festival name is the big headline; no extra label or italic tagline;
      labels in normal sentence case; shorter texts.
- [ ] **Step 2, after Amelie's OK on step 1:** the same for Lineup planner, Project tasks,
      Site map, Vendors, Finances, Final checklist, Settings, dialogs and the sign-in screen.
- [ ] **Texts:** shorter and plainer; outdated ones fixed (e.g. "saves in this browser").

## Out of scope

- New features or different page layouts; what each page does stays the same.
- The rules in `rules/`, the database and saving.
- Translating the app (it stays in English).

## Done when

1. All tests pass; no test changed.
2. Every page checked in the browser on a laptop width and a phone width, with no console
   errors; screenshots before/after in the pull request.
3. A teammate reviewed the look.
