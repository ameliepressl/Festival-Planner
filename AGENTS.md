# Festival Architect (team project) — notes for people and AI agents

Team project for Introduction to Programming (Nova SBE): Kira, Amelie, Frederik, Vicky.
Several of us are beginners. Explain what you change and why, in plain language.

## Running things

- From the Festival-Planner folder, run `python3 server.py` and open
  `http://127.0.0.1:8000/` in a browser. Leave the terminal running while you use the app.
- On first run the server creates `data/users.sqlite3` with demo usernames
  `Kira`, `Amelie`, `Frederik`, and `Vicky`. To try the lookup, enter one of
  those usernames in the Team form. The database file stays local.
- Run the JavaScript tests: `uvx --from nodejs-wheel node --test`
  (uv downloads Node by itself).
- Run the Python tests: `python3 -m unittest discover -s tests -p 'test_*.py'`.
- The festival plan, Gantt schedule, checklist and roster are saved in the browser for the
  current address. Keep using the same address and port. If moving from
  `index.html` opened directly, download a lineup backup from that copy and
  restore it at the server address. Gantt changes, checklist ticks and roster entries stay
  with the original address and need to be re-entered at the new one.

## The project

- `index.html` = the page structure, `styles.css` = the look.
- `app.js` = the planner screen. `overview.js` = Overview and the team roster.
- `gantt-editor.js` = the saved project schedule that feeds the Gantt and Overview milestones.
- `server.py` = the local server and SQLite username lookup.
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
- Then open the app through the local server and try the changed flow yourself, including a page reload.
