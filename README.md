# 🎪 Festival Architect

**Plan a whole music festival in one place** — lineup, project tasks, site layout, vendors,
finances and the event-day checklist.

Team project for *Introduction to Programming* at **Nova SBE** by
**Kira, Amelie, Frederik and Vicky**.

![Tests](https://img.shields.io/badge/tests-127%20JavaScript-1a9a7c)
![Stack](https://img.shields.io/badge/stack-HTML%20%C2%B7%20CSS%20%C2%B7%20JavaScript%20%C2%B7%20Supabase-17272b)
![Dependencies](https://img.shields.io/badge/dependencies-1%2C%20pinned-ff684c)

---

## What it can do

| Section | What you can do there |
| --- | --- |
| **Overview** | Start page: festival details, projected finances, urgent tasks, milestones and the team roster. |
| **Lineup planner** | Multi-day timetable for several stages: book artists, agreed fees and durations per booking, calendar blocks, budget, finalise the plan, print / save as PDF, download and restore a backup. |
| **Task board** | Project tasks with deadlines, a "needs attention" list and an editable Gantt chart of the whole preparation. |
| **Site map** | Realistic aerial map with a clickable pin for every facility. Upload your own map (aerial photo or site plan), draw the fence, set the gate, mark water and other no-go areas — and let the planner **suggest the optimal layout** checked against 10 layout rules. |
| **Vendors** | 24 food, drink and merch vendors on the food court pitches; pitch income and a check of visitor needs (vegan, drinks, alcohol-free). |
| **Finances** | Profit and loss, break-even (tickets and price), where the money goes and comes from, profit by ticket price, scenarios (bad weather / plan / sold out) and artist spending. |
| **Final checklist** | Event-day checks for 12 teams with a progress bar. |

The pages work together: the **expected visitors** decide how many toilets, water points,
food pitches, first aiders and security staff are needed; the site map plans that many,
the vendors page offers that many pitches, and the finances use all of it.

## Run it

The app is plain files. Serve the folder with any static file server, for example Python's
(already on macOS):

```bash
python3 -m http.server 8000
```

Then open **<http://localhost:8000/>**, create an account (username, email, password) or sign
in. Leave the terminal running while you use the app; stop it with `Ctrl + C`.

## Accounts

Every person signs in and plans their own festival. The plan is saved to the account, so it
is the same on every device, and the database only lets each account reach its own festival
(Row Level Security). Details: [feature-plans/login.md](feature-plans/login.md).

Accounts and saved festivals are stored in **Supabase**. One-time setup by the project owner:

1. Create a Supabase project. In *Authentication → Sign In / Providers → Email*, switch off
   "Confirm email" (the free plan only sends a few emails per hour).
2. Run [`migrations/001_accounts_and_festivals.sql`](migrations/001_accounts_and_festivals.sql)
   in the Supabase *SQL Editor*.
3. Put the project URL and the **publishable** key into [`supabase-config.js`](supabase-config.js).
   Never the secret key — see [AGENTS.md → Secrets](AGENTS.md).
4. In *Authentication → URL Configuration*, add the deployed address and
   `http://localhost:8000` as allowed URLs.

The only third-party code is the Supabase library, pinned in [`vendor/`](vendor/README.md).

## Run the tests

```bash
uvx --from nodejs-wheel node --test
```

`uv` downloads Node by itself, so nobody has to install Node.

## How the code is organised

```text
index.html              page structure (all sections)
styles.css              shared look
account/                sign-in screen, saving the plan to the account, sign out
supabase-config.js      Supabase project URL + publishable key (public by design)
migrations/             database tables and access rules (SQL, run in Supabase)
vendor/                 the pinned Supabase library
app.js                  lineup planner screen
overview.js             overview page and team roster
work-board.js           task board
gantt-*.js              Gantt chart and project schedule
festival-countdown.js   days until the festival
site-map/               site map page and the aerial drawing
vendors/                vendors page
finance/                financial overview page
checkliste-festivalplanung/   final checklist page
rules/                  all rules and calculations — no screen code, fully tested
tests/                  automatic tests (JavaScript)
feature-plans/          one plan per feature: Why, What, Out of scope, Done when
product-brief/          the product brief (it wins over anything else)
```

**One rule holds everywhere:** rules and calculations live in `rules/`, screens only show
things and pass clicks on. That is why every rule can be tested without a browser.

## Who built what

Based on the git history; the lineup planner is shared work of the whole team.

| | |
| --- | --- |
| **Kira** | Overview start page, local server and team directory, lineup workflow and loading |
| **Amelie** | Left navigation, the first lineup edits, accounts and login with Supabase |
| **Frederik** | Rules and tests baseline, final checklist, site map with layout planner, vendors, festival size, financial overview |
| **Vicky** | Task board, Gantt chart, festival countdown, event-day checklist wording |

## How we work

- Every feature starts from the latest `main` on its own branch, with a plan in
  `feature-plans/` first.
- Pull requests are reviewed by another team member; tests must pass and are pasted into
  the pull request.
- Tests are never weakened to make them pass.

Details: [AGENTS.md](AGENTS.md) · progress: [PROJECT_PROGRESS.md](PROJECT_PROGRESS.md) ·
what comes next: **[Roadmap](feature-plans/roadmap.md)**
