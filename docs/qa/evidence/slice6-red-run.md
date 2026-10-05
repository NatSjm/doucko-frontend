# Slice 6 (implement-authoring-missions-ui) — RED run, task 2.6

- **Date:** 2026-10-04 (Europe/Prague)
- **Against:** compile-only stubs. `missionForm.ts` returns empty or identity values;
  `problemConflicts` returns `[]`; `ConflictAlert`, `DeleteControl`, `TaskStatusPanel`,
  `MissionListScreen`, `MissionEditorScreen` and `SourceEditScreen` render nothing; the admin
  navigation has no mission entries and the source list no "Edit" link. In place: the catalog keys,
  the three new routes with their example queries, the API wrappers over the generated client, and
  the shared fake admin backend extended with missions, source update and delete, task status and
  delete and the store-spec rules. `npx tsc -b` passed (no type or import errors); ESLint reported
  only the unused parameters of the stubs.

## Unit (Vitest)

- **Command:** `npx vitest run`
- **Result:** 74 failed, 358 passed (432), 10 of 30 files with failures. Every failure is an
  assertion: 54 `TestingLibraryElementError` (element not found) and 12 `AssertionError` (unexpected
  value) in the failure details, the rest the same kinds repeated. No import error.

| Test file | Failed |
|---|---|
| `src/features/missions/MissionEditorScreen.test.tsx` | 27 of 27 |
| `src/features/sources/SourceEditScreen.test.tsx` | 10 of 10 |
| `src/features/tasks/TaskStatusPanel.test.tsx` | 9 of 9 |
| `src/features/missions/missionForm.test.ts` | 9 of 20 (the refused positions pass on the `null` stub; a move past an end and the 50-maximum case pass on the identity stub) |
| `src/features/admin-access/ConflictAlert.test.tsx` | 6 of 7 ("shows nothing without an error" passes on the empty stub) |
| `src/features/missions/MissionListScreen.test.tsx` | 4 of 4 |
| `src/app/i18n-coverage.test.tsx` | 6: the three new routes render no text and no content |
| `src/features/admin-access/AdminLayout.test.tsx` | 1: no Missions / New mission links |
| `src/features/sources/SourcesScreen.test.tsx` | 1: no "Edit" link on a source row |
| `src/features/admin-access/problem.test.ts` | 1: `problemConflicts` returns no ids |

## E2E (Playwright, chromium)

- **Command:** `npx playwright test e2e/authoring-missions.spec.ts e2e/authoring-edit.spec.ts --project=chromium --timeout=15000`
- **Result:** 13 failed of 13 (8 in `authoring-missions.spec.ts`, 5 in `authoring-edit.spec.ts`).
  Failures: `locator.click` / `locator.selectOption` timeouts waiting for the missing controls
  (Missions link, Publish mission, Status and deletion region, Edit link, Delete source),
  `element(s) not found`, `toBeVisible` / `toBeDisabled`; no compile error.

The a11y and theme specs reach the new routes from the registry (`e2e/screens.ts`); they ran in
`qa:verify` after the implementation.
