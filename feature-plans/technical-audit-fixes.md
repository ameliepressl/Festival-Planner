# Technical audit and reliability fixes

Owner: Kira · Branch: `codex/technical-audit-fixes` · Base: `92c6bd3`
Approved for local implementation: 22 November 2026. Kira subsequently authorised
committing and pushing this branch for team review. No merge or database change.

## Why

The current 273 tests pass, but focused reproductions found saving races, storage
failure inconsistencies, unsafe rendering of shared data and stage/timeline edge
cases. The team needs a reliable baseline before presentation preparation.

## What

- Acknowledge successful cloud saves per section, without resending stale sections.
- Flush team changes and confirm pending project drafts before changing contexts;
  capture festival IDs and guard against stale tabs writing to another festival.
- Retain browser state when loading or saving fails. Use the same save-first pattern
  for lineup, library, vendor, checklist and finance actions, with honest feedback.
- Harden saved-data rendering: escape attributes and reject malformed map images,
  grids, IDs and invalid saved lineup data without silently replacing a real plan.
- Keep active stage counts consistent across map, crowd estimates and readiness;
  handle one stage explicitly and exclude retired stage measurements. Preserve the
  legacy default/compatibility contracts and all existing test assertions.
- Bound timeline rendering for extreme dates, correct its save instructions and
  avoid accumulating duplicate event listeners. Remove only proven unused work;
  retain the task-table seed and active SVG definitions.
- Correct factual README inaccuracies and replace outdated active instructions with
  the current flexible rules, as approved by Kira. Preserve all existing test assertions.
- Explain the missing database protection for festival details and the overall
  artist budget. Kira asked to leave implementation to Amelie, without a SQL file
  in this branch. Do not make changes to Supabase.

## Out of scope

Teammates' UI redesign, finance simplification and empty-new-project defaults;
changing current booking behaviour; changing
or deleting existing tests to make them pass; live database or real-account edits;
2FA; new product features; publication; Part 2 study notes or a Word document.

## Done when

- Each confirmed fix has a regression scenario, including rejected operations.
- All existing tests still pass; added tests do not call Supabase or alter real data.
- Browser checks on disposable data include reloads, permissions and failed writes;
  actual live multi-account checks and database-policy deployment remain explicit
  limitations until separately verified.
- Part 1 findings distinguish fixed issues, preserved compatibility, team decisions
  and checks required again after the three upcoming teammate changes.
- Part 2 starts only after Kira explicitly authorises it.

## Part 1 audit findings and changes

This is a technical audit record, not the Part 2 presentation study document.
A passing suite and a source review cannot prove that every line, browser and live
multi-user situation is correct.

| Area | Confirmed problem | Resolution in this branch |
| --- | --- | --- |
| Shared saves | An edit made during another save could resend old sections and overwrite a teammate's newer data. | Capture and acknowledge revisions per section; retain later edits as pending. |
| Team changes | A queued invite/role change could be lost on navigation or target the wrong festival after an asynchronous wait. | Capture festival IDs, wait for the separate team queue, preserve retry metadata and rebase unrelated team changes. |
| Switching festivals | Other tabs could write into a partly replaced festival; cancelling the browser's late draft warning could leave the old screen attached to a new festival's storage. | Publish a local transition marker before replacement, recover interrupted loads explicitly, confirm drafts first, and block stale tabs and late responses. |
| Browser storage | Failed writes could leave phantom artists/bookings, different finance totals, checked boxes or misleading success messages. Loading a festival could leave a partially replaced plan. | Persist before changing live screen state; roll back plan, roster and account metadata together when loading fails. |
| Permissions | The existing SQL protected finance assumptions and task owners, but did not protect festival details and the artist budget nested in the lineup section. | Documented the problem for Amelie to fix separately. No SQL fix is included, and the live database has not been changed. |
| Shared markup | Saved identifiers, colours, status values and map image attributes could enter markup unsafely. | Escape attributes, restrict colours/status classes and validate map identifiers and raster image data. |
| Map calculations | One-stage lineups could show two map stages, readiness could cache an old stage count, and inactive crowd measurements could inflate results. | Use explicit active stages in map items, cached checks, density and evacuation calculations. Retain saved inactive measurements for later use. |
| Map input | Empty or excessively large grids and extreme uploaded image shapes could produce false passes or excessive work. | Require positive bounded dimensions and valid binary grids; bound generated grids and validate map scale/images. |
| Saved lineup | Damaged JSON, invalid dates or orphan artist references could crash the screen or appear as a fresh editable plan. | Keep the original raw data, block ordinary saves and offer exact download, retry or confirmed validated restoration; dependent figures stay unavailable. |
| Task timeline | Very distant dates could create millions of cells; malformed saved tasks could be replaced visually by the template. | Render at most 26 weeks at once with previous/next/date-jump controls. Validate unique safe identifiers, retain damaged saved tasks and explain why editing is blocked. |
| Redundant work | Sidebar handlers accumulated after refresh; hidden old preview/attention sections still rendered. | Bind navigation once and remove only the unused render paths. Retain the HTML task seed, active statistics and referenced SVG definitions. |
| Instructions | Active documents still described fixed event/artist/budget limits and old screen locations; test coverage was overstated. | Rewrite the active brief/baseline and correct README/agent notes to reflect current behaviour and verification limits. |

### Current rules and compatibility

The active documentation now describes configurable dates, stages and budget;
repeat performances after confirmation; permitted budget overruns after confirmation;
and no minimum artist count for finalisation. The old brief referred to eight
catalogue artists and four bookings, rather than eight required bookings.

Original test assertions remain unchanged. Their original Node API is isolated in
`rules/legacy-lineup-compatibility.js`, which the browser does not load. Legacy
catalogue data needed to open older booked plans is retained intentionally.

### Storage review

- Supabase Auth handles passwords. The app's `profiles` table stores profile data;
  `festivals` stores each festival's section values, and `festival_members` stores
  real membership and roles. Browser storage is a working copy, not an independent
  authoritative team database.
- Saved planning sections consistently use `festival-` keys. Team roster data is a
  cache rebuilt from membership and is excluded from the festival data payload.
  Account/session metadata and the optional public image cache have separate keys.
- Different sections are patched separately. Concurrent changes to the same section
  still use the last saved value; this is not real-time collaborative editing.
- Local edits can remain pending during a service outage. A new sign-in or a fresh
  device needs Supabase. Do not promise full offline use.
- The bundled Supabase library is pinned. The publishable browser key is expected
  in the repository; it relies on database policies. A targeted scan of tracked
  files found no private-key, GitHub-token, AWS access-key or Supabase-secret-key
  patterns. This was not a complete historical secret audit.
- The current download/restore backup covers the lineup, not all festival sections.
  Optional Wikipedia/Wikimedia photos fall back to initials. Google Fonts is also
  external; system fonts provide the fallback.

### Remaining decisions and release checks

1. Amelie will implement the missing database protection separately: Editors must
   not be able to change festival details or the overall artist budget through a
   direct request, while Owner/Admin access and permitted Editor planning edits
   must still work. Verify these permissions with real role accounts. Kira asked
   to remove the prepared SQL file to avoid confusion. No production SQL or account
   changes were made during this audit.
2. Teaching-staff approval for the browser JavaScript stack is **not confirmed**.
   The [stack guide](https://2477-introduction-programming.gitlab.io/wiki/guides/stack.html)
   requires checking this choice with teaching staff. Documentation cannot grant it.
3. Rehearse at the deployed URL with role accounts, two devices and a failed-service
   scenario; check that the reviewed main revision is actually deployed and the
   database is available. Keep suitable demo data separate from fresh empty plans,
   verify run/test instructions from a fresh clone, and close secrets/dashboard tabs.
   These checks follow the [demo guide](https://2477-introduction-programming.gitlab.io/wiki/guides/preparing-the-demo.html)
   and the [course guides](https://2477-introduction-programming.gitlab.io/wiki/guides/).
4. No additional visible button was confirmed to have no function in the inspected
   flows. Disabled role/final-plan controls are intentional. If a product control
   is later proposed for removal or repurposing, that remains a team decision.
5. Retained model limits: map walking times are approximate; crowd/evacuation values
   are planning estimates. The map and final checklist are separate from the task
   timeline and share readiness information rather than being duplicate task lists.

### Repeat after the teammates' changes

The friendlier interface, finance simplification and empty-new-festival defaults
are outside this branch. After merging them, rerun all tests and verify:

- Every saved planning key resets for a new festival, including bookings, progress,
  assignments, vendors, finance assumptions, maps and safety measurements; the
  previous festival and another account's festival remain intact.
- Decide explicitly which suggested task templates and example catalogue content
  remain available separately from an empty plan; update approved default-specific
  tests to match that decision without dropping the underlying behaviours.
- Empty-state calculations, finance/Overview/readiness totals, role permissions,
  dialogs, save/cancel/undo, rejected input and reloads still agree.
- New/switch/delete/sign-out flows cannot lose pending work or cross festival data;
  multi-account/cloud checks and failed-service recovery still pass.
- Documentation, screenshots, actual main code and the deployed app describe the
  same final behaviour. Run the five-minute live rehearsal only after this recheck.


## Verification completed — 22 November 2026

- Baseline: 273 existing tests passed before implementation. Final: **335 tests
  passed, 0 failed, 0 skipped** (62 new regression cases). No tracked existing
  test file was edited, deleted or weakened.
- Ran the suite with the already installed Node 24.19.0 executable. The normal
  `uvx` wrapper could not write its cache inside this session's sandbox; using the
  cached Node ran the same `--test` suite. GitHub CI uses Node 22 and has not run
  for this unpushed local branch.
- JavaScript syntax checks passed for 28 changed/new source and test files.
  `git diff --check` passed; all local script/style references in index.html exist.
- Browser checks used disposable localhost origins with account code replaced by
  a local test stub, so they could not write to Supabase or the user's real plan:
  artist edit; confirmed 15:11 performance and reload; one-stage lineup/map;
  task-group edit and reload; year 0001 date-jump within a bounded timeline;
  map Suggest/Undo/Save/reload; Viewer and Editor controls; failed artist saving
  with the original preserved after reload; damaged-lineup notice and Retry;
  unavailable finance/readiness/map checks during recovery; validated file
  restoration and another reload. No JavaScript console errors in these checks.
- Async account tests exercise the actual account script with a mock service,
  including section races, stale tabs, queued team writes, interrupted transitions
  and transactional rollback. They do not establish live Supabase correctness.
- The public deployed URL responded HTTP 200. This was a reachability check only,
  not a logged-in deployment or database-policy test. Course guide pages were
  read through direct HTTP retrieval because the web reader could not open them.

Final automatic-test summary:

```text
tests 335
suites 0
pass 335
fail 0
cancelled 0
skipped 0
todo 0
```

Publication: Kira authorised committing and pushing `codex/technical-audit-fixes`,
based on main `92c6bd3`, for team review. Keep main unchanged.
No merge, deployment, real-account change or production SQL execution.
Part 2 has not started.
