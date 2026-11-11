# Lineup workflow enhancements

Why: make everyday scheduling easier and support realistic stage operations without adding a separate event homepage.

Approved scope:
- Click an empty calendar slot to prefill a performance or manual block; suggest the next available same-day stage time after a conflict.
- Individual tentative/confirmed performance status, duration and fee copied from catalogue defaults and stored on each booking.
- Optional linked changeover blocks that follow edits and removal of their performance and participate in collision checks.
- Editable stage names with stable underlying stage IDs.
- Editable JSON backup/restore with strict validation, preview, explicit replacement confirmation and an option to save the current plan first. This backs up the lineup; the final checklist is separate.
- Internal PDF for all appointments, notes and costs; public PDF with confirmed performances only, omitting private notes, fees and operational blocks.

Storage: same local browser plan key, extended with booking fields and stage names. Existing plans are migrated without dropping valid artists or appointments. Work remains local on codex/fix-lineup-loading; no commit/push/merge authorised.

Verification: existing tests unchanged except explicit fixtures already approved; new tests for snapshots, linked blocks and atomic conflicts, slot suggestions, backup roundtrip and rejected imports, and public-output privacy. Browser checks cover booking, notes, statuses, custom stage names, backup/restore and reload. Public print output is inspected separately from the internal plan.
