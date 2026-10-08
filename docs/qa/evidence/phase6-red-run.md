# Phase 6 RED run (qa-phase6-ui)

Test added from the vision-verify failure of `slice6-mission-create-reorder-publish` (a published mission editor still showing its tasks as Draft), run before the fix in `src/features/missions/MissionEditorScreen.tsx` (2026-10-08, Europe/Prague):

```text
npx vitest run src/features/missions/MissionEditorScreen.test.tsx -t "stale Draft"
     × after a publish, the task rows show the tasks published meanwhile, not a stale Draft (vision-verify phase 6) 1717ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/features/missions/MissionEditorScreen.test.tsx > publishing (FR-9, store rules FR-57) > after a publish, the task rows show the tasks published meanwhile, not a stale Draft (vision-verify phase 6)
AssertionError: expected [ <span …(1)></span>, …(1) ] to have a length of +0 but got 2
      Tests  1 failed | 33 skipped (34)
```

RED on the assertion (2 rows still Draft after the successful publish), not on setup.

## Review F08: the refused-status refetch

Test added for review finding F08 (the catch branch), run with that branch removed (2026-10-08), then restored (60/60 pass):

```text
     × after a refused publish, the task rows show a task published meanwhile (review F08) 1467ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected [ <span …(1)></span>, …(1) ] to have a length of 1 but got 2
      Tests  1 failed | 34 skipped (35)
```
