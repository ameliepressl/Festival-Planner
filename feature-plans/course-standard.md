# Current baseline — flexible festival planning and verifiable behaviour

Updated 22 November 2026. This is the active baseline; earlier single-day feature
descriptions in Git history do not set the current app's requirements. The active
[product brief](../product-brief/festival-architect-brief.html) describes the agreed rules.

## Why

The team needs one clear description of the planner it actually presents, with
checks that catch regressions and honest limits on what has been verified.

## What

- Use the chosen festival dates and opening hours, 1–12 stages and a configurable
  artist budget. Start times and durations use whole minutes.
- Keep an editable artist catalogue and per-performance fee/duration snapshots.
  There is no required artist count or minimum catalogue size.
- Reject overlapping appointments on one stage, out-of-hours bookings and
  simultaneous performances by the same artist. Rejected edits keep the previous plan.
- Allow repeated performances after a warning and confirmation. Charge each
  performance's agreed fee. Changes that create or increase a budget shortfall
  require confirmation and display the negative balance.
- Finalise by checking the existing appointments. A final lineup is read-only until
  explicitly reopened; there is no minimum number of artists for finalisation.
- Keep business rules in `rules/` and screen behaviour in the corresponding page
  files. Accepted saves survive reload; failed saves leave the previous saved data
  and provide feedback instead of claiming success.
- Support multiple and shared festivals through Supabase. Saved sections use
  `festival-` keys; database access rules enforce membership and permissions.
  The database owner applies numbered SQL migrations separately from the app.

## Verification

1. Run `uvx --from nodejs-wheel node --test`, or `node --test` with Node installed.
   Existing assertions remain intact; new regressions get meaningful additional tests.
2. Test flexible scheduling, same-stage and same-artist conflicts, repeated-booking
   warnings, over-budget confirmation, finalise/reopen and save/reload.
3. Test changed screens through a local static server, including a rejected action and
   a storage failure. Pure rules and simulated-DOM tests do not replace browser checks.
4. Record exactly which role and multi-account checks were performed. Mock Supabase
   tests do not establish that deployed database policies have been applied correctly.
5. Have another team member review a pull request before merging to `main`.

## Compatibility and remaining external checks

The unchanged original regression-test contract is isolated in
`rules/legacy-lineup-compatibility.js`. Node loads it for compatibility; the browser
uses the current multi-day functions in `rules/festival-rules.js`. The archived
contract does not add requirements to the active app.

Outstanding for Amelie: strengthen database permissions so Editors cannot change
festival details or the overall artist budget by bypassing the app controls. Amelie
will implement and test this separately. No database fix or SQL file is included
in this audit branch, and the live database has not been changed.

The project uses HTML, CSS and browser JavaScript with Supabase. **Teacher approval
for that stack remains unconfirmed.** Check the
[course stack guide](https://2477-introduction-programming.gitlab.io/wiki/guides/stack.html)
and confirm the permitted stack with the teacher. Do not report that approval as granted.

2FA is outside the team's agreed scope. Historical feature plans are records of
earlier work, rather than additional instructions for the current baseline.
