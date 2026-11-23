# Contributing to Festival Architect

This is the checklist every change follows, whether a person or an AI agent writes the code.
Why we work this way is explained in [docs/ai-workflow.md](docs/ai-workflow.md); the rules for agents
are in [AGENTS.md](AGENTS.md).

## 1. Before you start

- [ ] Pull the latest `main`: `git checkout main && git pull`
- [ ] Check the [product brief](product-brief/festival-architect-brief.html). It wins over everything else.
- [ ] For a new idea or bug, open an issue (templates: *Feature* or *Bug*) or agree on it in the team chat.

## 2. Plan

- [ ] Copy [`feature-plans/_TEMPLATE.md`](feature-plans/_TEMPLATE.md) to `feature-plans/<feature-name>.md`.
- [ ] Fill in **Why · What · Out of scope · Done when**. "Done when" items must be checkable.
- [ ] Give the plan to your AI agent as the starting point, together with `AGENTS.md`.

## 3. Build on a branch

- [ ] One branch per feature, never commit to `main`:
      `feature-…` (new), `fix-…` (bug), `docs-…` (documentation only).
- [ ] Business rules go into `rules/` (no screen code there). Screens only call them.
- [ ] Data that must be saved to the account uses a `localStorage` key that starts with `festival-`.
- [ ] Database changes are a new numbered file in `migrations/`; only the database owner runs it.
- [ ] Write or update tests in `tests/` together with the code.
- [ ] Change only what the feature needs; note other findings instead of fixing them on the side.

## 4. Verify before the pull request

- [ ] Run all tests and keep the final output:
      ```bash
      uvx --from nodejs-wheel node --test
      ```
- [ ] Serve the app (`python3 -m http.server 8000`), try the changed flow in a real browser,
      reload the page, check a phone-width window and the console for errors.
- [ ] **Never edit, weaken, skip or delete a test to make it pass.** If a requirement changed, say
      which test changed and why in the PR.
- [ ] Bump the `?v=` version in `index.html` for every changed CSS/JS file, so browsers load the new file.

## 5. Pull request

- [ ] Open a PR into `main`. The template asks for the plan, what changed, how AI was used, the test
      output and the browser check.
- [ ] If your PR builds on another open PR, say so and give the merge order.
- [ ] Ask **another** team member for review.

## 6. Review and merge

The reviewer:

- [ ] reads the plan and the diff, and checks that the "Done when" items are met;
- [ ] tries the change in the browser;
- [ ] checks that rules are in `rules/`, user text is escaped, and no test was weakened;
- [ ] approves or asks for changes.

We usually review **together in person**: the author walks the reviewer through plan, diff and app,
and fixes findings in the same session. Remote reviews use GitHub's **Review changes → Approve**.
Either way, the reviewer is named in the PR.

Merge when **CI is green and the reviewer agrees**; the author then merges. Use a merge commit, as on
all earlier PRs.
After merging, everyone runs `git checkout main && git pull`.

## Definition of Done

A change is done when all of these are true:

1. Every "Done when" item of the plan is met and ticked.
2. All tests pass locally and in CI; new behaviour has tests.
3. The changed flow was tried in a browser, including a reload.
4. Rules are enforced in `rules/` (and in the database where access is involved).
5. Another team member approved the PR.
6. `README.md`, `AGENTS.md` and the feature plan are updated if users, developers or agents would
   notice the change.
