# Festival Architect — collaboration log

Use this file together with GitHub branches and pull requests so the team can see what changed, who owns it, and whether it is ready to merge.

## Working agreement

1. Start every feature from the latest `main` branch.
2. Create one branch per small feature, for example `feature/site-map`.
3. One person owns the implementation; another collaborator reviews the pull request.
4. Keep each pull request focused and describe the user-visible change, files changed, and how it was tested.
5. Merge only after the team agrees that the preview works.

## Current progress

| Branch | Scope | Status | Reviewers | Date |
| --- | --- | --- | --- | --- |
| `codex/left-navigation` | Add a visual left navigation bar to the original lineup planner. No new feature pages yet. | Ready for team preview — not committed | Kira, Vicky, Fredderik | 28 October 2026 |

## Team ownership

Agree an owner before starting each row. Update this table in the same pull request as the work.

| Area | Owner | Branch | Status | Notes |
| --- | --- | --- | --- | --- |
| Left navigation | Amelie | `codex/left-navigation` | In review | First small shared feature |
| Lineup planner | Unassigned | — | Existing baseline | Keep working while other features are added |
| Task board | Unassigned | — | Not started | Add only after navigation is approved |
| Site map | Unassigned | — | Not started | Add in its own feature branch |
| Food & vendors | Unassigned | — | Not started | Add in its own feature branch |

## Pull request checklist

- [ ] I worked only on my own feature branch.
- [ ] The app still loads and the existing lineup flow works.
- [ ] I described what changed and how I tested it.
- [ ] At least one teammate reviewed the pull request.
- [ ] The table above reflects the current status.
