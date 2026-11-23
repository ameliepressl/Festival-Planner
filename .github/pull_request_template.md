## Plan

<!-- Link the feature plan. Every PR has one: feature-plans/<name>.md -->
Plan: `feature-plans/…`

## What changed and why

<!-- 2–5 bullet points in plain language. What can a user now do or what is fixed? -->
-

## How AI was used

<!-- We use AI openly (see docs/ai-workflow.md). Be specific. -->
- **Tool:** <!-- e.g. Claude Code -->
- **AI did:** <!-- e.g. implemented the rules and tests from the plan, drafted the README text -->
- **A person checked / decided:** <!-- e.g. requirements, the numbers in the tests, the browser check -->

## Tests

<!-- Paste the final lines of: uvx --from nodejs-wheel node --test -->
```
ℹ tests …
ℹ pass …
ℹ fail 0
```

- [ ] New or changed behaviour has tests
- [ ] No test was edited, weakened, skipped or deleted to make it pass (if a requirement changed, explain which test and why)

## Browser check

- [ ] Tried the changed flow in a real browser
- [ ] Reloaded the page: data is still there
- [ ] Phone width and console checked (no errors)

## Checklist

- [ ] Rules are in `rules/`, not only in the screen
- [ ] Text from users is escaped before it is shown as HTML
- [ ] New saved data uses a `festival-` key; database changes are a new file in `migrations/`
- [ ] `?v=` versions in `index.html` bumped for changed CSS/JS files
- [ ] No secrets (only the publishable Supabase key is allowed)
- [ ] Merge order stated if this PR depends on another one

## Review

<!-- Another team member, not the author. -->
- **Reviewer:** <!-- name or GitHub username -->
- **Reviewed:** <!-- together in person / on GitHub -->
- **Please look closely at:** <!-- the riskiest part, e.g. a new rule, a database change, a tricky edge case -->
