## 1. Contract

- [x] 1.1 Confirm the `contract/` pin (docs `0168eba`, API 0.5.1, unchanged); `npm run api:generate` provides `getStats`, `listReports`, `reevaluateReport`, `dismissReport` (never hand-edited).

## 2. Failing tests first (red)

- [x] 2.1 Contract stub: stats (weekly history, first-try counts, the metric over the four completed weeks, `weeks` validation) and the flag queue (reports in every status, order, `status` validation, re-evaluation against the current answer spec with the XP difference, replay attempts, dismiss, 409/404/400) in `src/test/fake-progress-backend.ts`, wired into `src/test/fake-admin-backend.ts` (aligned with the backend half's notes `scratch/slice9-backend-behaviour.md`, 2026-10-07: locked parts absent from `rawInput`, 409 for handled reports and reports without an attempt).
- [x] 2.2 Unit (Vitest): the stats view model, the stats screen, the flag-queue screen and the navigation entries (FR-40, FR-41).
- [x] 2.3 Route registry, example queries and the `⟦` / a11y / theme gates include `/admin/stats` and `/admin/reports` (NFR-9, NFR-13).
- [x] 2.4 E2E (Playwright): `e2e/progress-stats.spec.ts` (FR-40) and `e2e/flag-queue.spec.ts` (FR-41), keyboard paths included.
- [x] 2.5 Disposition recorded — eval case for the admin copy NOT delivered, deferred (evals are PLANNED in the battery, scope 0, as in slices 6–8).
- [x] 2.6 Run them against compile-only stubs and confirm RED on assertions. Evidence: `docs/qa/evidence/slice9-red-run.md`.

## 3. UI (green)

- [x] 3.1 `src/features/stats/`: API hook, view model, stats screen.
- [x] 3.2 `src/features/reports/`: API hooks, flag-queue screen with re-evaluate and dismiss.
- [x] 3.3 `src/features/admin-access/`: navigation entries ("Stats", "Flag queue"); `src/i18n/format.ts`: numeric admin dates (Europe/Prague times).
- [x] 3.4 Catalog keys (en admin); routes registered; provenance row for the stub's seed.

## 4. Validation, review, archive

- [x] 4.1 `CI=1 PW_WORKERS=2 npm run qa:verify` — `Overall result: Pass (1 member(s) PLANNED, not yet due: eval-ratchet)`: 673 unit tests (coverage 100%), e2e 636 passed, 0 flaky, 24 skipped (stack-only NFR-5 and theme screens without controls) in chromium, msedge and firefox, incl. `/admin/stats` and `/admin/reports` in the a11y (light, dark, reduced motion), theme and `⟦` gates — evidence: `docs/qa/automated-verification-latest.md` (2026-10-07, after the review fixes; log `../scratch/s9-frontend-qaverify-6.log`). Earlier full runs with Playwright's default 4 workers failed on Firefox browser timeouts under machine load (`newPage` / `page.evaluate` / `browserContext.close` timeouts, mostly on routes this slice does not touch; they passed when re-run with fewer workers), so `playwright.config.ts` gained an opt-in `PW_WORKERS` cap (default unchanged).
- [x] 4.2 `npx openspec validate implement-progress-stats-ui --strict`
- [x] 4.3 review-gate workflow (`trace/workflow-runs/20261007-195534-review-gate.json`, $11.59): 4 majors (F01/F08 focus after a 409, F07 empty state from the shown weeks only, F09 vacuous wrap e2e) and 9 minors fixed in `bd732c8` (+ test `8a40a4e`), 1 minor waived (F14, stub topic list / replay rule; the excerpt part fixed); qa:verify re-run PASS; `review-findings.json` clean:true.
- [x] 4.4 Handed to the coordinator — real-stack smoke NOT run in this change (the owner's stack runs `main`); after merging both slice 9 halves: sign in → Stats (navigation) → the metric verdict and 5 weekly rows (the current week last-served, shown first and marked "This week") render from the stack, the topic table lists each topic with a published task ("—" with nothing resolved) → choose 12 weeks → 12 rows; author a task whose accepted answer is wrong (e.g. expects `0.05`), publish it in a mission; child: answer `0,5` twice (revealed) and report "Myslím, že moje odpověď je správně" → admin: Flag queue → the Open entry shows the task, the reason, raw `0,5` and "Wrong" → Re-evaluate → "Nothing changed …" → "Open the task to fix its answer" → accepted answer `0.5` → Save task → Flag queue → Re-evaluate → "Fixed … +4 XP added for the child." → filter Fixed → "Wrong" and "Correct" each with a time → child HQ shows the total 4 XP higher; Stats → that topic's first-try rate unchanged by the fix to the 2nd attempt; dismiss another Open report → Dismissed, no actions.
- [x] 4.5 Update `docs/current-state.md`.
- [x] 4.6 Archive: `npx openspec archive implement-progress-stats-ui --yes`; commit with `Slice: implement-progress-stats-ui` + `Refs: FR-40, FR-41`.
