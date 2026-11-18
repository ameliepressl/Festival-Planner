# 🎪 Festival Architect

**Plan a whole music festival in one place** — lineup, project tasks, site layout, vendors,
finances and the event-day checklist.

Team project for *Introduction to Programming* at **Nova SBE** by
**Kira, Amelie, Frederik and Vicky**.

![Tests](https://img.shields.io/badge/tests-112%20JavaScript%20%2B%207%20Python-1a9a7c)
![Stack](https://img.shields.io/badge/stack-HTML%20%C2%B7%20CSS%20%C2%B7%20JavaScript%20%C2%B7%20Python-17272b)
![Dependencies](https://img.shields.io/badge/dependencies-none-ff684c)

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

You need Python 3 (already on macOS). No installation, no packages.

```bash
python3 server.py
```

Then open **<http://127.0.0.1:8000/>** in your browser and leave the terminal running while
you use the app. Stop it with `Ctrl + C`.

On the first run the server creates `data/users.sqlite3` with the demo usernames
`Kira`, `Amelie`, `Frederik` and `Vicky` (the file stays on your computer and is not in git).

> **Good to know:** the festival plan is saved in your browser (localStorage) for this
> address. Another browser or device starts with an empty festival — see
> "Platform" in [the roadmap](feature-plans/roadmap.md) for shared data.

## Run the tests

```bash
uvx --from nodejs-wheel node --test
```

```bash
python3 -m unittest discover -s tests -p 'test_*.py'
```

`uv` downloads Node by itself, so nobody has to install Node.

## How the code is organised

```text
index.html              page structure (all sections)
styles.css              shared look
server.py               local server + SQLite username lookup
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
tests/                  automatic tests (JavaScript and Python)
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
| **Amelie** | Left navigation and the first lineup edits |
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
