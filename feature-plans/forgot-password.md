# Forgot password

Owner: Amelie · Branch: `feature-forgot-password`

## Why

Until now, someone who forgot their password had no way back into their account: the sign-in
screen only offered "Sign in" and "Create account". A new account would not get their festivals
back, and teammates would have to add them to the team again.

## What

- [x] **"Forgot your password?"** under the sign-in form opens "Reset your password": enter the
      email, choose "Send reset link". Supabase emails a link (`resetPasswordForEmail`).
      The message is the same whether an account exists or not ("If an account exists for this
      email, …"), so nobody can find out which emails have an account.
- [x] **The link opens the app** (the page it was requested from) on "Choose a new password":
      new password twice, "Save new password" (`updateUser`). Afterwards the app opens signed in.
      The login tokens are removed from the address bar straight away.
- [x] **Expired or already used link:** "This reset link has expired or was already used.
      Request a new one below." with the reset form open.
- [x] Clear messages for: passwords that do not match, the same password as before, too many
      emails in the last hour, and an address the email service may not send to yet.
- [x] **Asking again within a minute** (Supabase allows one email per person per minute):
      "An email was just sent. Please wait 25 seconds before requesting another one." Before,
      this showed the hourly-limit message by mistake (found on the live app, 22 November).
- [x] The rules (reading the link, checking the new password, messages) live in
      `rules/account-rules.js` with tests in `tests/forgot-password.test.js`.

## Setup in Supabase (Amelie, once)

- **Authentication → URL Configuration:** Site URL `https://ameliepressl.github.io/Festival-Planner/`;
  Redirect URLs `https://ameliepressl.github.io/Festival-Planner/**` and, for testing,
  `http://localhost:8000/**`. Otherwise the link may open the wrong address.
- **Email sending:** Supabase's built-in email service only sends to the email addresses of
  members of the Supabase organization and only a few emails per hour. For everyone else,
  set up custom SMTP (Authentication → Emails → SMTP settings), for example with a free plan
  of an email provider.

## Out of scope

Changing the password while signed in (Settings), changing the email address, sign-in with a
one-time code, and custom email templates.

## Done when

- The tests pass.
- With the Supabase setup above: request a link, open it, set a new password, sign in with it;
  an old or used link shows the expired message.
