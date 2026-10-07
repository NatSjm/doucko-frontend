# Slice 8 (implement-gamification-ui) — RED run, task 2.6

- **Date:** 2026-10-05 (Europe/Prague)
- **Against:** compile-only stubs. `rank.ts` returns a fixed empty bar (`xpProgress` → `{ have: 0,
  need: 1, percent: 0, top: false }`) and `formatXp` → `String(n)`; `RankUpCelebration` and
  `SummaryScreen` render nothing; `parseDenyList` / `findDenied` return `[]`; `rank.css` is empty.
  `HqScreen`, `MissionScreen` and `TaskScreen` are slice 7's (no progress panel, no replay, no XP on a
  reveal, no bonus line, no rank-up, no link to the results). In place: the catalog keys, the
  `/summary` route with its example query, the API wrappers (`ackRankUp`, `getMissionSummary`,
  `startReplay` over the generated client), and the contract stub extended with XP, bonuses, the
  placeholder ladder, rank-up / pending / ack, summaries and replay runs
  (`src/test/fake-child-backend.ts`); the slice 7 suites stayed green on the extended stub (550 of
  550). `npx tsc -b` passed (no type or import error).

## Unit (Vitest)

- **Command:** `npx vitest run`
- **Result:** 56 failed, 556 passed (612), 9 of 41 files with failures. Every failure is an assertion
  on missing behaviour: 40 `TestingLibraryElementError` (element not found) and 16 `AssertionError`
  (unexpected value). No import or compile error.

| Test file | Failed |
|---|---|
| `src/features/summary/SummaryScreen.test.tsx` | 17 of 17 |
| `src/features/hq/HqProgress.test.tsx` | 9 of 9 |
| `src/features/rank/rank.test.ts` | 6 of 6 |
| `src/features/rank/RankUp.test.tsx` | 6 of 7 ("not acknowledged" passes on the empty stub) |
| `src/features/mission/MissionScreen.test.tsx` | 6: the complete mission's replay and results, XP available, replay start / resume / failure / 409 |
| `src/features/task/TaskXp.test.tsx` | 5 of 10: "+1 XP" on a reveal, the bonus line, the mid-mission celebration and its reload, focus on "Výsledky mise" (the "+10 XP" on a correct answer, no XP on a wrong one, the stored XP after a reload, no celebration without a crossing and the fresh replay task already hold) |
| `src/features/task/TaskScreen.test.tsx` | 2: the results link after the last task and on the 204 state |
| `src/skin/denylist.test.ts` | 3 of 5 (the catalog and asset scans pass vacuously on the empty matcher; they are meaningful only with the matcher, which the other three prove) |
| `src/app/i18n-coverage.test.tsx` | 2: `/summary` renders no text and no heading |

## E2E (Playwright, chromium)

- **Command:** `CI=1 npx playwright test e2e/gamification-hq.spec.ts e2e/gamification-summary.spec.ts e2e/a11y.spec.ts --grep "rank-up celebration|summary|gamification|HQ progress|replay|rank|XP|Mise|mission" --project=chromium --retries=0 --timeout=15000`
- **Result:** 23 failed, 9 passed (32). Every new slice 8 test failed (HQ 8, summary and replay 6),
  the six celebration a11y scans (light, dark, reduced motion for HQ and the summary) and the three
  `/summary` gate scans (axe light, dark, reduced motion): 19 "element(s) not found", 12
  `toBeVisible`, 7 `toContainText` and 4 `locator.click` timeouts waiting for the missing controls;
  no compile error. The 9 passes are the existing a11y scans of other routes that the `--grep`
  also selected (`/mission`, `/admin/missions…`).

The theme spec reaches `/summary` from the registry (`e2e/screens.ts`); it ran in `qa:verify` after
the implementation.
