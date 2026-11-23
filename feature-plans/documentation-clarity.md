# Feature — Clarify the approved stack, service dependency and verification status

Owner: Kira · Branch: `codex/docs-clarity-and-service-dependencies` · Builds on: `course-standard.md`, `data-audit-and-cleanup.md`

## Why

The team has confirmed that using programming languages other than Python was agreed with the professor. Current documents still describe that approval as uncertain and retain an outdated database task. Readers also need a plain explanation of the dependency on Supabase and a clear distinction between current and historical tests.

## What

- [x] Record the professor's agreement, as confirmed by the team, consistently in the current README, brief and baseline documents.
- [x] Explain Supabase's role, availability risks, local versus account saves, recovery and remaining live-service checks in the README.
- [x] Mark migration 006 protection as implemented/applied, with real-account verification still pending.
- [x] Point the introductory README walkthrough to current integration tests and clearly label the historical compatibility tests without changing assertions.
- [x] Review active documentation for other clear contradictions; distinguish historical progress records from current instructions.
- [x] Keep the README focused on the current app: remove outdated screenshots and historical test detail, move deployment setup to a linked reference, and distinguish pending checks from routine pre-demo rechecks.
- [x] **Rules/screens:** no behaviour, storage format, permissions or database changes.

## Out of scope

- Running database migrations or claiming live verification that has not happened.
- Changing app behaviour, test cases or expected results.
- Rewriting the local study Word document, rewriting historical development records or merging this branch into main.

## Done when

- [x] Current documentation agrees on stack approval and database status.
- [x] Supabase limitations and recovery are described accurately without promising full offline use.
- [x] Current tests are easy to find; historical tests retain their assertions and are clearly labelled.
- [x] Documentation links resolve; all tests pass.
- [x] The brief renders correctly through the local server and survives reload.
- [x] Project progress records the scope and verification; unrelated local files remain untouched.
- [x] README cleanup remains on this same branch, with working links and an accurate current verification list.

## Tests

Started from the fetched `main` at `dd51701`. The team supplied the confirmation of the professor's agreement; no approval date or additional professor statement was invented.

Full suite: **513 tests, 513 passed, 0 failed, 0 cancelled, 0 skipped, 0 todo**. Output is saved locally at `/private/tmp/festival-docs-clarity-tests.txt`. The historical test file differs only in its opening comments; its executable code and all assertions are identical.

Relative Markdown file links were checked with no missing targets. The active approval/database wording is consistent. Two independent read-only reviews checked the overall clarity and Supabase descriptions against the account code.

Opened the updated HTML brief through the local server and reloaded it: the confirmed language choice and Supabase/live-verification limits render correctly, with no console errors. No database or live-account verification was performed. The untracked Word study guide was preserved separately and was not updated; it still needs comparison with final main before studying.

Follow-up README cleanup stayed on this branch: removed the outdated screenshot gallery/hero image and the detailed historical test paragraph, replaced future-sounding notification wording with current behaviour, and moved deployment configuration to `docs/supabase-setup.md`. The README's Release verification table separates the outstanding live-role check and reset-template confirmation from routine pre-demo saving/recovery and deployment checks. SMTP and redirect setup are recorded as already configured.

After cleanup: **513 tests passed, 0 failed or skipped**; output at `/private/tmp/festival-readme-cleanup-tests.txt`. Checked 98 relative documentation file links with no missing targets and confirmed the new section anchors exist. No app behaviour or test assertions changed; all documentation changes remain local and uncommitted on the same branch.

Kira subsequently requested committing and pushing these changes together with the map-pin
refinements on this branch. The local Word study guide remains excluded. No merge is requested.
