# Docs — How we build with AI (process, templates, guardrails)

Owner: Frederik · Branch: `docs-ai-workflow`

## Why

The course encourages AI use. Our way of working with AI agents was good but scattered: rules in
`AGENTS.md`, plans in `feature-plans/`, checks in CI and in PR texts. A grader or new teammate could
not see the process in one place, and every PR described tests and AI use differently.

## What

- [x] `docs/ai-workflow.md`: the lifecycle of a change (diagram), who leads each step (person or AI),
      guardrails for agents, quality gates, real examples where a person caught or corrected the AI,
      and what we learned. Every example links to the PR or plan it comes from.
- [x] `CONTRIBUTING.md`: step-by-step checklist from plan to merge and a Definition of Done.
- [x] `.github/pull_request_template.md`: every new PR asks for the plan, what changed, **how AI was
      used and what a person checked**, the test output, the browser check and a safety checklist.
- [x] `.github/ISSUE_TEMPLATE/feature.md` and `bug.md`.
- [x] `feature-plans/_TEMPLATE.md`: the standard plan (Why · What · Out of scope · Done when · Tests).
- [x] `CLAUDE.md`: loads `AGENTS.md`, so Claude Code follows the same team rules as other agents.
- [x] `AGENTS.md`: the rules location now says `rules/` (it still named only `festival-rules.js`) and
      points to the plan template, the PR template and `CONTRIBUTING.md`.
- [x] README: "Start here" (five stops through the code) and "How we work with AI"; the project
      structure lists the new files.
- [x] **Self-review before the PR** (every claim checked against the repository and GitHub):
  - Reviews: described as we do them, together in person side by side; the PR template now also
    records the reviewer, so the review is documented on GitHub.
  - New section "We stay in control, the AI makes us fast": decisions that always stay with people,
    and where AI saves the most time.
  - Tools: Claude Code **and Codex** (from the PR descriptions), not only Claude Code.
  - Added "By the numbers" (counted on `main`) and "Risks of AI-written code and how we control them".
  - Every example links to where it is documented; the audit method note was added to the audit.

## Out of scope

- No change to app code, tests or the database.
- Branch protection on GitHub (repository setting, only the owner can change it).
- `PROJECT_PROGRESS.md` is maintained by Amelie and is not changed here.

## Done when

- [x] All new links point to files that exist.
- [x] All tests pass; nothing in the app changes.
- [x] The PR for this branch is the first one that uses the new template.

## Tests

Documentation only. Full test suite on this branch, plus a script that checks every relative link in
the new and changed Markdown files.
