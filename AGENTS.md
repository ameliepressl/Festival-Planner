# Festival Architect (team project) — notes for people and AI agents

Team project for Introduction to Programming (Nova SBE): Kira, Amelie, Frederik, Vicky.
Several of us are beginners. Explain what you change and why, in plain language.

## Running things

- Open the app: open `index.html` in a browser (macOS: `open index.html`). No server needed.
- Run the tests: `uvx --from nodejs-wheel node --test`
  (uv downloads Node by itself; nobody has to install Node).
- The plan is saved in the browser (localStorage). To start fresh, clear the site
  data for the page in the browser.

## The project

- `index.html` = the page structure, `styles.css` = the look.
- `app.js` = the screen: draws the page, reacts to clicks, calls the rules.
- `rules/festival-rules.js` = the rules (budget, times, stages, finalising). No screen code here.
- `tests/` = automatic checks of the rules, one per scenario in the brief.
- `product-brief/festival-architect-brief.html` = the product brief. It wins over anything else.
- `feature-plans/` = one plan per feature: Why, What, Out of scope, Done when.
- `PROJECT_PROGRESS.md` = who owns which branch and its status.
- Rules are always checked in `rules/festival-rules.js`, never only in the screen.

## Working together

- Start every feature from the latest `main`. One branch per feature.
- Never commit to `main` directly. Open a pull request; one other team member reviews it.
- Write the plan in `feature-plans/` before building. Update `PROJECT_PROGRESS.md` in the same pull request.
- Change only what the feature needs. Do not fix other things you notice — note them instead.

## Tests and verification

- Never edit, weaken, skip or delete a test to make it pass. If a test looks wrong,
  say so and stop.
- After every change run the tests and paste the final output in the pull request.
- Then open `index.html` and try the changed flow yourself, including a page reload.
