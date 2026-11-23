# Festival Architect (team project) — notes for people and AI agents

Team project for Introduction to Programming (Nova SBE): Kira, Amelie, Frederik, Vicky.
Several of us are beginners. Explain what you change and why, in plain language.

## Running things

- From the Festival-Planner folder, run `python3 -m http.server 8000` and open
  `http://localhost:8000/` in a browser. This only serves the files; there is no project
  server any more. The deployed version is plain files too.
- Sign in or create an account on the first screen. Accounts and saved festivals live in
  Supabase (see "Accounts and data" below).
- Run the tests: `uvx --from nodejs-wheel node --test` (uv downloads Node by itself).
  The tests never talk to Supabase.

## The project

- `index.html` = the page structure, `styles.css` = the look.
- `app.js` = the planner screen. `overview.js` = Overview and the team roster.
- `gantt-editor.js` = the saved project schedule that feeds the Gantt and Overview milestones.
- `account/account.js` = sign-in screen, saving the plan to the account, Sign out, teammate lookup.
- `rules/account-rules.js` = the account rules (input checks, which data is synced). No screen code.
- `rules/task-rules.js` = who a subtask belongs to, the "Assigned to" filter, team progress.
  `task-assignments.js` reads and saves them for the Gantt, the Task board and the Overview.
- `supabase-config.js` = the Supabase project URL and publishable key (public by design).
- `migrations/` = every change to the Supabase database, as SQL, in order.
- `vendor/` = the only third-party library (supabase-js), pinned; see `vendor/README.md`.
- `rules/festival-rules.js` = the rules (budget, times, stages, finalising). No screen code here.
- `tests/` = business-rule scenarios and selected integration checks. Original regression
  assertions remain in a Node-only compatibility module; the current brief describes active behaviour.
- `product-brief/festival-architect-brief.html` = the product brief. It wins over anything else.
- `feature-plans/` = one plan per feature: Why, What, Out of scope, Done when.
- `PROJECT_PROGRESS.md` = who owns which branch and its status.
- Rules are always checked in `rules/` (one file per area, e.g. `festival-rules.js`, `finance-rules.js`,
  `vendor-rules.js`), never only in the screen.

## Accounts and data

- Storage: Supabase (Postgres) holds the accounts (`profiles`) and the festival plans
  (`festivals`; up to 20 per account since `migrations/005`, see `feature-plans/several-festivals.md`). The pages still save in the browser; `account/account.js` copies
  every key that starts with `festival-` to the account. **New saved data must use a key
  that starts with `festival-`**, otherwise it is not saved to the account.
- Several accounts can plan one festival (`feature-plans/shared-festivals.md`). Admins add
  teammates in Settings → Team; the database table `festival_members` is the real team, the
  roster key `festival-architect-team-v1` is only a copy of it and is never saved in the plan.
- Access control is enforced in the database with Row Level Security (`migrations/001`,
  `003`, `004`, `006`): only the owner and members can read a festival; Owner, Admin and Editor can save it;
  Editors cannot change the finances or the task assignments (`festival-task-assignments-v1`);
  only Owner and Admin can change the team; Editors cannot change the festival details
  (`event`) or the overall artist budget (`settings.budget`) inside the lineup section
  (`migrations/006`). The pages use
  the same roles through `canFestival()` in `rules/access-rules.js`. Never rely on hiding
  buttons alone.
- Saving sends only the sections (keys) that changed, which reduces interference between teammates.
  Concurrent edits to the same section still use the last saved value; this is not live
  collaborative editing. Do not write one big key for everything.
- Changes to tables or rules are written as a new numbered SQL file in `migrations/` and run
  in the Supabase SQL Editor by the database owner (Amelie). Never change or delete tables or
  rows in Supabase unless the task says so.
- To start another plan, use New festival in the festival chooser. Do not delete database
  rows manually to create a fresh plan. Signing out only removes the local festival copy
  from that browser; it does not delete the saved festival in Supabase.

## Secrets

- `supabase-config.js` contains only the **publishable** key. It is meant for browser code and
  only allows what Row Level Security allows.
- The **secret** / `service_role` key, database passwords and personal access tokens are never
  written into code, never committed and never pasted into chats, issues or agent
  conversations. If one is ever needed, it comes from an environment variable or a local
  `.env` file, which is listed in `.gitignore` before it is created.
- If a secret leaks: revoke it in the provider's dashboard at once and create a new one.
  Deleting the commit is not enough.

## Working together

- Start every feature from the latest `main`. One branch per feature.
- Never commit to `main` directly. Open a pull request; one other team member reviews it.
- Write the plan in `feature-plans/` before building, starting from `feature-plans/_TEMPLATE.md`. Update `PROJECT_PROGRESS.md` in the same pull request.
- Change only what the feature needs. Do not fix other things you notice — note them instead.
- Follow the checklist in `CONTRIBUTING.md`; the pull request template asks for the plan, how AI was
  used, the test output and the browser check. Why we work this way: `docs/ai-workflow.md`.

## Tests and verification

- Never edit, weaken, skip or delete a test to make it pass. If a test looks wrong,
  say so and stop.
- After every change run the tests and paste the final output in the pull request.
- Then open the app through a local file server and try the changed flow yourself, including a page reload.
