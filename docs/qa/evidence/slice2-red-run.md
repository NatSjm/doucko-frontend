# Slice 2 (implement-admin-access-ui) — RED run, task 2.5

- **Date:** 2026-10-04 (Europe/Prague)
- **Command:** `npx vitest run src/features src/app`
- **Against:** compile-only stubs (`AdminArea` renders nothing, `adminClient` has no middleware) with
  the catalog keys and the `/admin` route registered.
- **Result:** 13 failed, 24 passed. Every failure is an assertion (an element not found, a header
  missing, a listener not called). No type or import errors.

| Test file | Failed |
|---|---|
| `src/features/admin-access/adminClient.test.ts` | 3 of 5. The read and JSON-body cases pass on plain openapi-fetch |
| `src/features/admin-access/AdminGate.test.tsx` | 9 of 9 |
| `src/app/i18n-coverage.test.tsx` | 1, `route /admin shows only catalog text` (the page is empty) |

The e2e spec `e2e/admin-sign-in.spec.ts` was written in the same step. It
runs green in `qa:verify` after the implementation.
