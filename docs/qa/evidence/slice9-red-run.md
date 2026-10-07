# Slice 9 (implement-progress-stats-ui) — RED run, task 2.6

- **Date:** 2026-10-07 (Europe/Prague)
- **Against:** compile-only stubs. `stats.ts` offers only 4 weeks, returns no rows, no short weeks,
  `noPractice` false, a first-try rate of 0 and the raw date as the week label; `reports.ts`
  returns the ISO time and `String(value)`; `StatsScreen` and `ReportsScreen` render nothing; the
  admin navigation has no Stats or Flag queue entry. In place: the catalog keys, the two routes in
  the registry (`/admin/stats`, `/admin/reports`, so the a11y, theme and `⟦` gates reach them), and
  the contract stub (`src/test/fake-progress-backend.ts`, wired into
  `src/test/fake-admin-backend.ts`). `npx tsc -b` passed (no type or import error).

## Unit (Vitest)

- **Command:** `npx vitest run src/features/stats src/features/reports src/features/admin-access/AdminLayout.test.tsx src/app/routes.test.ts src/app/i18n-coverage.test.tsx` (log: `../scratch/s9-frontend-red-unit.log`)
- **Result:** 45 failed, 44 passed (89), 5 of 6 files with failures. Every failure is an assertion
  on missing behaviour (element not found, unexpected value); no import or compile error.

| Test file | Failed |
|---|---|
| `src/features/stats/stats.test.ts` | 10 of 12 (the two "nothing short when the metric is met" checks pass vacuously on the empty stub; the others prove the marking) |
| `src/features/stats/StatsScreen.test.tsx` | 8 of 9 ("behind the admin session" passes on the empty stub: the gate is slice 2's) |
| `src/features/reports/ReportsScreen.test.tsx` | 22 of 22 |
| `src/features/admin-access/AdminLayout.test.tsx` | 1 (the Stats and Flag queue links) |
| `src/app/i18n-coverage.test.tsx` | 4: `/admin/stats` and `/admin/reports` render no text and no content |

`src/app/routes.test.ts` passed: the route paths were registered with the stubs (test data for the
gates). The "says loading failed" stats test first failed for a wrong reason (its 500 switch also
failed the session check); it was corrected to fail only the stats request and fails on the stub
for the right reason (the screen renders nothing).

## E2E (Playwright, chromium)

- **Command:** `CI=1 npx playwright test e2e/progress-stats.spec.ts e2e/flag-queue.spec.ts e2e/a11y.spec.ts --grep "stats|reports|flag queue|Flag|first-try|metric|report" --project=chromium --retries=0 --timeout=15000` (log: `../scratch/s9-frontend-red-e2e.log`)
- **Result:** 18 failed, 0 passed: every new FR-40 (6) and FR-41 (6) test and the six gate scans of
  the two routes (axe light, dark, reduced motion): 11 `toBeVisible` "element(s) not found", 4
  click / focus / selectOption timeouts waiting for the missing controls, 1 `toHaveText`, 1
  `toHaveCount`; the gate scans fail in `expectSignedInContent` (the stub screens render no admin
  navigation). No compile error.

The theme spec reaches both routes from the registry (`e2e/screens.ts`); it ran in `qa:verify`
after the implementation.
