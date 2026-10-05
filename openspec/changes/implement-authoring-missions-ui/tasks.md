## 1. Contract

- [x] 1.1 Confirm the `contract/` pin (docs `4c87d67`, API 0.5.1); `npm run api:generate` provides `listMissions`, `createMission`, `getAdminMission`, `updateMission`, `deleteMission`, `setMissionStatus`, `updateSource`, `deleteSource`, `setTaskStatus`, `deleteTask` (never hand-edited).

## 2. Failing tests first (red)

- [x] 2.1 Unit (Vitest): mission form model (FR-9, FR-55), conflict alert.
- [x] 2.2 Unit (Vitest): mission list and editor, source edit, task status and delete against the shared fake backend (FR-9, FR-55).
- [x] 2.3 Route registry, example queries, `⟦` test and the a11y/theme screens include the three new admin routes (NFR-9, NFR-13).
- [x] 2.4 E2E (Playwright): `e2e/authoring-missions.spec.ts` (FR-9, FR-55) and `e2e/authoring-edit.spec.ts` (FR-55), keyboard paths included.
- [ ] 2.5 Eval case for admin copy tone: deferred, not done (evals are PLANNED in the battery, scope 0, and need a judge this run cannot call).
- [x] 2.6 Run them against compile-only stubs and confirm RED on assertions. Evidence: `docs/qa/evidence/slice6-red-run.md`.

## 3. UI (green)

- [x] 3.1 `src/features/missions/`: API hooks, form model, list screen, editor screen.
- [x] 3.2 `src/features/sources/`: source edit screen (no file field) with delete; "Edit" link in the source list.
- [x] 3.3 `src/features/tasks/`: status and delete panel in the task editor.
- [x] 3.4 `src/features/admin-access/`: navigation entries, `ConflictAlert`, inline confirm.
- [x] 3.5 Catalog keys (en admin); routes registered with example queries.

## 4. Validation, review, archive

- [x] 4.1 `npm run qa:verify` — `Overall result: Pass (1 member(s) PLANNED, not yet due: eval-ratchet)` — evidence: `docs/qa/automated-verification-latest.md`.
- [x] 4.2 `npx openspec validate implement-authoring-missions-ui --strict`
- [ ] 4.3 review-gate workflow; fix confirmed findings; persist `review-findings.json` (clean:true).
- [ ] 4.4 Smoke against the compose stack after the slice 6 merge (owner): sign in → Missions → New mission → topic, position 1, add three tasks, move the third first, save → publish (refused, the draft task named) → publish the tasks → publish the mission → in the task editor, unpublish one of its tasks (refused, the mission named) → unpublish the mission → delete it (tasks kept); Sources → Edit → change the edition → save; delete a referenced source (refused, its tasks named).
- [ ] 4.5 Update `docs/current-state.md`.
- [ ] 4.6 Archive: `npx openspec archive implement-authoring-missions-ui --yes`; commit with `Slice: implement-authoring-missions-ui` + `Refs: FR-9, FR-55`.
