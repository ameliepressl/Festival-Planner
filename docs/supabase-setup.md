# Supabase deployment setup

This is a reference for setting up a separate deployment. The team's existing project is
configured; the [README release checks](../README.md#release-verification) identify the remaining
verification. Supabase Auth handles sign-in and passwords, while Postgres holds profiles,
festival sections and team membership.

## One-time configuration

The project owner performs these steps for a new deployment:

1. Create a Supabase project and configure email/password authentication and the intended
   email-confirmation behaviour.
2. Apply the numbered files in [`migrations/`](../migrations/) in order using the Supabase
   SQL Editor. The database owner performs this step; the browser never runs SQL migrations.
3. Put the project URL and **publishable** key into [`supabase-config.js`](../supabase-config.js).
   Secret/service-role keys, database passwords and access tokens are kept outside the
   repository; see [AGENTS.md](../AGENTS.md#secrets).
4. In **Authentication → URL Configuration**, set the Site URL to the deployed address and add
   the deployed and local testing URLs to Redirect URLs. For this team's deployment these are
   `https://ameliepressl.github.io/Festival-Planner/**` and `http://localhost:8000/**`.
5. Configure a suitable email sender under **Authentication → Emails → SMTP settings**.
   Provider limits can affect delivery; test the reset flow with an intended user's address.
6. In **Authentication → Emails → Templates → Reset password**, use
   `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery` as the link. It opens the app
   without redeeming the one-time token until the new password is submitted, so email security
   scanners do not consume the token merely by opening the link.

## Current verification

Migration `006` is implemented and recorded as applied to the team project. Separate real-account
verification on the deployed app is still pending. The latest reset-template configuration
also needs confirmation from the database owner. SMTP and redirect URLs have already been
recorded as configured. See [Release verification](../README.md#release-verification) for the
current checks and [PROJECT_PROGRESS.md](../PROJECT_PROGRESS.md) for recorded evidence.

The automatic test suite uses local data and mock services; it does not run these setup steps
or verify the team's live Supabase project. Availability and recovery limits are explained in
[Supabase dependency and recovery](../README.md#supabase-dependency-and-recovery).
