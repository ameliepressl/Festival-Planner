# Feature — Start new festival finances at zero

Owner: Kira · Branch: `codex/zero-finance-start` · Builds on: `several-festivals.md`, `financial-overview.md`

## Why

The original finance examples currently become the starting values of a newly created festival.
New organisers should enter their own assumptions rather than remove demonstration figures first.
Existing saved projects and both demo festivals must retain their finance values.

## What

- [x] Each newly created festival stores every finance assumption as zero, with no custom income or cost lines.
- [x] **Rules in `rules/finance-rules.js`:** create a fresh zero-valued finance section only when creation did not provide one. Keep example defaults for demos and older saved data.
- [x] **Accounts:** use the same initialization for the first festival of an account and the sidebar's New festival action. Never initialize finance when opening an existing festival.
- [x] **Screen:** distinguish an unconfigured finance forecast from a meaningful break-even or cash-flow result. Keep hypothetical matrix figures hidden until financial values are entered.
- [x] Entered assumptions continue saving through the existing `festival-architect-finance` section and survive reopening/reloading.

## Out of scope

- Changing stored festivals, demo figures, database tables, access permissions, lineup budgets or festival-size defaults.
- Changing finance formulas or the explicit Reset-to-example action.
- Publishing, pushing or merging this local branch.

## Done when

- [x] First-account creation and New festival both store a complete independent zero finance section.
- [x] Starting another festival never copies or resets the previous festival's saved finances.
- [x] Both demos keep their current saved assumptions and calculated forecasts.
- [x] A fresh festival has zero revenue, costs, profit and cash-flow amounts; real artist/vendor amounts still contribute when planned.
- [x] New regression tests cover initialization, preservation, saved values and the empty finance screen; all existing tests remain unchanged in meaning.
- [x] All tests pass; changed flow tried in the browser, including reload and a narrow screen.
- [x] README and project progress reflect the starting values and verification.

## Tests

Added seven account-coordinator tests and nine finance-rule/screen tests. Existing assertions are unchanged; the account test harness additionally loads the actual finance rules.

Full suite: **470 tests, 470 passed, 0 failed, 0 cancelled, 0 skipped, 0 todo**. Tests use fake storage/account services and never contact Supabase. They cover first-account creation, subsequent festivals, legacy import/empty choices, saving before switching, reopening saved finances, both demos, independent zero assumptions, zero forecasts, real artist/vendor amounts, and the empty screen.

Browser verification used separate localhost origins with a fictional account service; the real Supabase client and configuration were excluded from those previews. Checked:

- First festival of a new account and the sidebar New festival action both show zero assumptions and Overview/Finances totals.
- Reload preserves zeros. Entering a €42 ticket price and 75% sales gives €157,500 revenue/profit with zero costs; these figures survive reload.
- Switching back to the original test project preserves its €61 ticket price, 75% sales, sponsorship and custom cost; its totals remain €309,690 revenue and €123,399 costs.
- Both demos retain their original totals: Lisbon €269,830 revenue / €143,669 costs; Munich €4,221,120 revenue / €4,412,610 costs.
- The empty finance page fits a 375px viewport without document overflow; the desktop view is also readable. Both preview consoles had no errors.
- Returned to the normal app and verified the existing Lisbon festival still displays its saved figures. No saved user festival was created or edited for testing.

Full test output is available locally at `/private/tmp/zero-finance-start-tests.txt`; no commit, push or merge was made.
