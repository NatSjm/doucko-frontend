# Slice 7 (implement-practice-flow-ui) — RED run, task 2.6

- **Date:** 2026-10-05 (Europe/Prague)
- **Against:** compile-only stubs. `practice.ts` returns empty or identity values (`partStates` → `{}`,
  `answersToSend` → its input, `emptyParts` → `[]`, `clampCodePoints` / `czechNumber` → the value,
  `answerText` → `''`, `isChoice` → `false`, `applyResult` → the task); `HqScreen`, `MissionScreen` and
  `TaskScreen` render nothing. In place: the catalog keys, the three child routes (`/`, `/mission`,
  `/task`) with their example queries, client-side navigation (`navigate`, `Link`), the child API
  wrappers over the generated client, `ChildLayout`, and the shared contract stub extended with the
  child API and its practice seed (`src/test/fake-child-backend.ts`). `npx tsc -b` passed (no type or
  import error).

## Unit (Vitest)

- **Command:** `npx vitest run`
- **Result:** 83 failed, 448 passed (531), 6 of 35 files with failures. Every failure is an assertion
  on missing behaviour: 61 `TestingLibraryElementError` (element not found), 14 `AssertionError`
  (unexpected value) and 1 `TypeError` (reading `.status` of a part state the empty `partStates` stub
  does not return). No import or compile error.

| Test file | Failed |
|---|---|
| `src/features/task/TaskScreen.test.tsx` | 44 of 44 |
| `src/features/task/practice.test.ts` | 13 of 14 ("an unreadable submission changes nothing" passes on the identity stub) |
| `src/features/hq/HqScreen.test.tsx` | 9 of 9 |
| `src/features/mission/MissionScreen.test.tsx` | 7 of 7 |
| `src/app/i18n-coverage.test.tsx` | 6: the three child routes render no text and no content |
| `src/app/App.test.tsx` | 4: HQ at the root and the three NFR-7 click paths |

`src/app/navigation.test.tsx` passed: client-side navigation was in place before the screens (task
3.1 infrastructure the screens build on).

## E2E (Playwright, chromium)

- **Command:** `CI=1 npx playwright test e2e/practice-hq.spec.ts e2e/practice-task.spec.ts e2e/practice-help.spec.ts e2e/practice-resume.spec.ts e2e/practice-timing.spec.ts e2e/app-shell.spec.ts --project=chromium --retries=0 --timeout=15000`
- **Result:** 35 failed, 3 passed, 2 skipped (40). Every new practice test failed (HQ 9, task 9,
  hints/translation/report 12, resume 4) plus the app-shell test that now expects HQ at `/`:
  19 `expect(locator)…` assertions (`toBeVisible`, `toHaveCount`, `toBeFocused`), 12
  `locator.click` and 4 `locator.fill` timeouts waiting for the missing controls; no compile error.
  The 3 passes are the unchanged NFR-3 guard tests of `app-shell.spec.ts`; the 2 skips are
  `practice-timing.spec.ts` (NFR-5), stack-only by design.

The a11y and theme specs reach the child routes from the registry (`e2e/screens.ts`); they ran in
`qa:verify` after the implementation.
