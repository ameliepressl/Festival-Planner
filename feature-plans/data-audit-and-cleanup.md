# Feature — Data audit and clean-up before submission

Owner: Frederik · Branch: `audit-cleanup` · Builds on: [README overview](readme-overview.md), [AI workflow](ai-workflow.md)

## Why

Before the submission (23 November 2026, 23:59) the repository should be tidy and the README should meet the
course requirements on the [team project page](https://2477-introduction-programming.gitlab.io/wiki/team-project/):
the deployed URL, names and student numbers, and the commands to run the app and its tests on a fresh copy.
The grading also asks what the tests cover and what they do not, and where the data comes from.

## What

- [x] **Data audit** (script run once, not part of the app):
      - 387 artists: no duplicate names or ids, every genre has a colour, every country a region, every fee and set
        length is positive.
      - 24 vendors + 172 library stands: no duplicate ids or names, every stand has a menu, every price is between
        €0 and €60, and every vegan item is also marked vegetarian.
      - Lisbon and Munich demos: every booked artist exists, no overlapping sets on a stage, no artist twice at the
        same time, every set inside the opening hours and on an existing stage, fees within the budget
        (Lisbon €15,500 of €18,000; Munich €1,793,000 of €2,000,000), every vendor exists.
      - Secrets: the whole git history has no secret keys, tokens or private keys. Only the public, publishable
        Supabase key, and made-up passwords inside tests.
- [x] **README:** a fresh-copy quick start (clone, serve, run tests); a test table (accepted actions, rejected
      actions, edge cases, calculations, page flows) and what the tests do not cover; a table of where the
      example data comes from; a shorter Site map section; a neutral note on the stack.
- [x] **Numbers** in `docs/ai-workflow.md` updated (49 merged pull requests, 51 plans, 513 tests).
- [x] **Clean-up:** the macOS `.DS_Store` file is no longer tracked and is ignored from now on.

## Out of scope

- Changing app behaviour, rules or tests.
- `PROJECT_PROGRESS.md` (kept by Amelie).
- New screenshots (the README says they show an earlier demo).

## Done when

- [x] All README links point to existing files.
- [x] Every test example named in the README exists in `tests/`.
- [x] Full suite passes; no test changed.

## Tests

No new tests (no rule changed). Full suite: 513 tests, 513 pass, 0 fail.
