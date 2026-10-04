# Implement admin access (frontend)

## Why

Slice 2 of the capability plan (`contract/docs/mvp-capability-plan.md` §4.2).
Store spec: `admin-access`. Every admin screen of later slices needs the
sign-in in front of it. This change owns no FR. It travels NFR-1 (admin UI
behind a password), NFR-15 (form sign-in posted as JSON, CSRF header on admin
mutations, the sign-in form after a 401) and NFR-9 and NFR-13 (the sign-in
route joins the `⟦` render test and the a11y gate).

## What Changes

- Route `/admin` (English, `lang="en"`): `AdminGate` asks `getAdminSession`.
  Without a session it shows the sign-in form (one password field), and with
  one it shows the admin home (a placeholder heading and sign-out until
  slice 5).
- `src/features/admin-access/`: `adminClient` (openapi-fetch on the generated
  `paths`) sends `X-XSRF-TOKEN` from the `XSRF-TOKEN` cookie on every
  data-changing request and reports any admin 401, so the gate falls back to
  the sign-in form (idle expiry). The client consumes `signIn`,
  `getAdminSession` and `signOut`.
- English `admin.*` catalog entries.
- Route registry: `/admin` added (a11y light and dark, reduced motion, theme,
  `⟦` test). E2E: sign-in screen without a session, the keyboard path,
  wrong password, sign-in and sign-out (API stubbed when no stack runs).

## Impact

- Store spec: admin-access · Contract pin: docs `4c87d67` (API 0.5.1) · Generated client regenerated: yes (unchanged contract)
- Features: `src/features/admin-access`
- No new dependency. No client-side router: routes stay full page loads, and
  the first slice that needs in-app navigation picks the router.
