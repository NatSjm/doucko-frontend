## 1. Contract

- [x] 1.1 Confirm the `contract/` pin (docs `4c87d67`, API 0.5.1); `npm run api:generate` provides the admin sources, tasks, images, preview, check, publish and reference operations.

## 2. Failing tests first (red)

- [x] 2.1 Unit (Vitest): problem mapping, upload checks (NFR-17), page parsing (FR-2), task form model (FR-3, FR-6, FR-7, FR-8), `format()`.
- [x] 2.2 Unit (Vitest): screens against the shared fake backend — sources (FR-1, FR-2, NFR-17), task editor (FR-3, FR-4, FR-6, FR-7, FR-8, NFR-8 sticky fields), task list (FR-11, FR-13, bulk publish), preview and tester (FR-10, FR-8), child task view.
- [x] 2.3 Route registry, example queries, `⟦` test (signed in, `data-content` rule) and a11y/theme screens include the six admin routes (NFR-9, NFR-13).
- [x] 2.4 E2E (Playwright): `e2e/authoring-sources.spec.ts` (FR-1, FR-2, NFR-17), `e2e/authoring-tasks.spec.ts` (FR-3, FR-4, FR-11, FR-13, NFR-8 sticky), `e2e/authoring-preview.spec.ts` (FR-10, FR-8), keyboard paths included.
- [x] 2.5 Eval case for admin copy tone: left planned (evals are SKIP-planned and need a judge this run cannot call).
- [x] 2.6 Run them against compile-only stubs and confirm RED on assertions. Evidence: `docs/qa/evidence/slice5-red-run.md`.

## 3. UI (green)

- [x] 3.1 `src/features/admin-access/`: `AdminLayout`, problem helper, blob fetch hook.
- [x] 3.2 `src/features/sources/`: upload form, list, `PdfViewer` (pdf.js), viewer screen.
- [x] 3.3 `src/features/tasks/`: task form (parts, specs, hints, translations, images), editor screen, list screen with filters and bulk publish, preview screen with the tester.
- [x] 3.4 `src/features/task/TaskView.tsx`: the child task view (Czech catalog text).
- [x] 3.5 Catalog keys (en admin, cs child task); routes registered with example queries.
- [x] 3.6 NFR-8 recording tool and clip (`docs/qa/demo-recordings/nfr8-task-entry/`).

## 4. Validation, review, archive

- [x] 4.1 `npm run qa:verify` — `Overall result: Pass`.
- [x] 4.2 `npx openspec validate implement-authoring-tasks-ui --strict`
- [x] 4.3 review-gate workflow; fix confirmed findings; persist `review-findings.json` (clean:true). 2026-10-04: 6 majors and 11 minors fixed in `45350dc`, 5 minors waived with reasons; qa:verify re-run PASS.
- [x] 4.4 Smoke against the compose stack after the slice 5 merge: PASS after the merge (2026-10-04) — evidence: `docs/qa/evidence/slice5-compose-smoke.md`.
- [x] 4.5 Update `docs/current-state.md`.
- [x] 4.6 Archive: `npx openspec archive implement-authoring-tasks-ui --yes`; commit with `Slice: implement-authoring-tasks-ui` + `Refs: FR-1, FR-2, FR-3, FR-4, FR-6, FR-7, FR-8, FR-10, FR-11, FR-13, NFR-8, NFR-17`.
