# Team user directory

## Why

Check usernames against a real user directory before adding teammates to a festival.

## What

- Run the planner and its directory API from a local Python server.
- Create a SQLite database with four demo users on first startup.
- Check usernames on the server. Use the matching account's username and ID in the local roster.
- Preserve existing roster entries and report unknown usernames or an unavailable directory.

## Out of scope

Sign-in, account registration, shared storage, sending invitations and enforcing roles.

## Done when

The server finds a demo user regardless of casing, the roster saves that user with the selected role, and a missing username or failed lookup leaves the roster intact.
