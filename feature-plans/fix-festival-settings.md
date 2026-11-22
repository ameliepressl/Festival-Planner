# Festival settings name sync

## Why
The festival selector retains “Untitled festival” after festival details are saved.

## What
Refresh the active festival name in the account interface after a successful details save.

## Out of scope
Permissions and database changes.

## Done when
The selector reflects the saved name immediately, the test suite passes, and merge conflicts are resolved on `fix-festival-settings` only.

## Overnight hours and time format
Use explicit 24-hour HH:MM inputs throughout the app. A closing time earlier than opening means the following morning. Keep after-midnight performances and calendar blocks on their selected festival day; validate and restore these extended times in backups.
