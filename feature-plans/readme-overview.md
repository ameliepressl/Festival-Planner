# Docs — README overview and CI badge

## Why

Graders and new visitors should see the scope of the app and that it is tested automatically
within a few seconds, without reading the whole README.

## What

- [x] Short "At a glance" table at the top of the README (one row per area), linking to the
      detailed Features section instead of repeating it.
- [x] The static "tests" badge is replaced by the live GitHub Actions status badge.
- [x] One sentence on CI: the test suite runs on every pull request and every push to `main`
      (as configured in `.github/workflows/tests.yml`).

## Tests

Documentation only; no code or test changed. The full suite still passes.
