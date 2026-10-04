# Implement admin access (frontend)

## Why

Slice 2 of the capability plan (`contract/docs/mvp-capability-plan.md` §4.2).
Store spec: `admin-access`. Every admin screen of later slices needs the
sign-in in front of it. This change owns no FR, and NFR-1, NFR-15 and NFR-16
belong to the backend in the plan's ownership table. This change builds the UI
half of the store spec: the sign-in form, the CSRF header and the form after a
401. It traces only the ids the frontend owns: NFR-9 (English admin copy, the
`⟦` render test), NFR-13 (the a11y gate) and NFR-6 (the three browsers).

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
