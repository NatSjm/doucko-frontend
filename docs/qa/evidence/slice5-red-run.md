# Slice 5 (implement-authoring-tasks-ui) — RED run, task 2.6

- **Date:** 2026-10-04 (Europe/Prague)
- **Against:** compile-only stubs. `format()` returns the template unfilled; `problem.ts`,
  `upload-limits.ts`, `page.ts` and `taskForm.ts` return empty or fixed values; `pdf.ts` throws;
  every new screen (`SourcesScreen`, `SourceViewerScreen`, `PdfViewer`, `TaskListScreen`,
  `TaskEditorScreen`, `PreviewScreen`, `AdminLayout`) renders nothing. The catalog keys, the six
  admin routes with their example queries, the shared fake admin backend and the test helpers were
  in place. `npx tsc -b` passed (no type or import errors).

## Unit (Vitest)

- **Command:** `npx vitest run`
- **Result:** 143 failed, 162 passed (305), 16 of 23 files with failures. Every failure is an
  assertion: an element not found, an unexpected value, or a `TypeError` reading a field of the
  empty object a stub returned (taskForm). No import error.

| Test file | Failed |
|---|---|
| `src/features/tasks/TaskEditorScreen.test.tsx` | 34 of 34 |
| `src/features/tasks/TaskListScreen.test.tsx` | 16 of 16 |
| `src/features/tasks/PreviewScreen.test.tsx` | 16 of 16 |
| `src/features/tasks/taskForm.test.ts` | 16 of 18 (the two `move`/off-end cases pass on the identity stub) |
| `src/features/sources/SourcesScreen.test.tsx` | 14 of 14 |
| `src/features/sources/PdfViewer.test.tsx` | 11 of 11 |
| `src/features/sources/SourceViewerScreen.test.tsx` | 5 of 5 |
| `src/features/sources/upload-limits.test.ts` | 5 of 7 (the two "accept" cases pass on the `ok` stub) |
| `src/features/sources/pdf.test.ts` | 3 of 3 |
| `src/features/sources/page.test.ts` | 1 of 12 (the refusals pass on the `null` stub; the accepted pages fail) |
| `src/features/admin-access/problem.test.ts` | 4 of 8 |
| `src/features/admin-access/AdminLayout.test.tsx` | 3 of 3 |
| `src/i18n/format.test.ts` | 3 of 3 |
| `src/app/i18n-coverage.test.tsx` | 10: the five authoring routes render no text and no content |
| `src/test/provenance.test.ts` | 1: the new `e2e/fixtures/admin.ts` was not yet listed (listed right after) |
| `src/test/lint-rule.test.ts` | 1 under full-suite load (timeout); passes alone, unrelated to this slice |

## E2E (Playwright, chromium)

- **Command:** `npx playwright test e2e/authoring-sources.spec.ts e2e/authoring-tasks.spec.ts e2e/authoring-preview.spec.ts --project=chromium --timeout=15000`
- **Result:** 14 failed of 14. Failures: element(s) not found / `toBeVisible` / `toHaveCount`
  (the screens render nothing); no compile error.

The a11y and theme specs now reach the admin screens signed in (`e2e/screens.ts`, `admin: true`);
they ran green in `qa:verify` after the implementation.
