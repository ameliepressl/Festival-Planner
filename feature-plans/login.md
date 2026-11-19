# Login with Supabase accounts

Owner: Amelie · Branch: `feature-login` · Roadmap: Platform → shared data, login (needed before 2FA)

## Why

The course grades security on access control that is really enforced, not only hidden
buttons. Today everybody who opens the page is the festival's Admin, and the plan only
lives in one browser. With accounts, every person signs in and plans their own festival,
and the database itself refuses access to other people's festivals. It is also the base
for two-factor authentication (2FA) later.

Supabase is the course's standard choice for login and shared data. Because it also holds
the user directory, the local Python server (`server.py`, SQLite) is no longer needed and
the app can be deployed as plain files (for example on GitHub Pages).

## What

- [ ] A sign-in screen opens first. "Create account" asks for a username, email and
      password; "Sign in" asks for email and password. Clear messages for wrong passwords,
      taken usernames or emails, weak passwords and when the service cannot be reached.
- [ ] Inputs are checked in `rules/account-rules.js` before anything is sent
      (username 3–32 letters, digits, `.` `_` `-`; valid email; password 8–72 characters).
- [ ] Every account has one festival plan in the `festivals` table. After signing in, the
      plan is loaded from the account; every change is saved back automatically. The
      sidebar shows who is signed in, whether the plan is saved, and a Sign out button.
- [ ] The pages keep saving in the browser as before (every key starts with `festival-`).
      `account/account.js` copies those keys to and from the account, so no page had to be
      rebuilt. Signing out removes the plan from the browser so the next person cannot see it.
- [ ] If a browser still holds a plan from before accounts existed, the first sign-in asks
      whether to keep that plan or use the account's plan, so nobody loses earlier work.
- [ ] Row Level Security in the database: a signed-in user can only read, create, change
      and delete their own festival. Usernames can be looked up by signed-in users only.
      Written down in `migrations/001_accounts_and_festivals.sql`.
- [ ] The Team form on the Overview finds teammates by their account username in Supabase
      instead of the local Python server. `server.py` and its SQLite tests are removed.
- [ ] If Supabase cannot be reached, the app does not crash: the sign-in screen says so,
      and a signed-in user keeps working in the browser while the sidebar shows that the
      plan is not saved yet; it is saved when the connection is back.
- [ ] The Supabase library is a pinned copy in `vendor/` (exact version, integrity hash).
      Only the public "publishable" key is in the repository; the secret key never is.

## Out of scope

- Sharing one festival between several accounts, and enforcing Admin/Editor/Viewer roles in
  the database (the roster still records roles for this festival only).
- Several festivals per account, changing username or email, deleting an account.
- Password reset by email (Supabase's free email limit is very low).
- Two-factor authentication — next step, built on this login.
- Live updates when the same account is open on two devices: the last save wins.

## Done when

1. `uvx --from nodejs-wheel node --test` passes, including new tests for
   `rules/account-rules.js` (accepted and rejected inputs, which data is synced, when the
   plan is loaded, uploaded or kept, teammate lookup results).
2. Kira's team tests still check the same behaviour (found, duplicate, unknown username,
   directory unavailable, roster kept) — adapted from the Python server to the Supabase
   lookup with the team's approval, no check removed.
3. With two test accounts A and B: A cannot see or change B's festival, also not by
   calling Supabase directly from the browser console.
4. Create account → plan festival → reload → still there → sign out → sign in in another
   browser → the same plan appears.
5. With the network switched off the app shows a clear message and does not crash.
