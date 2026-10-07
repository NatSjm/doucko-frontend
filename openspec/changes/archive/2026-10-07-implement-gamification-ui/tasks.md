## 1. Contract

- [x] 1.1 Confirm the `contract/` pin (docs `0168eba`, API 0.5.1, unchanged); `npm run api:generate` provides `getHq`, `ackRankUp`, `getMissionSummary`, `startReplay`, `getMissionBriefing`, `submitAttempt` (never hand-edited).

## 2. Failing tests first (red)

- [x] 2.1 Contract stub: XP, bonuses, the placeholder ladder, rank-up / pending / ack, summaries and replay runs in `src/test/fake-child-backend.ts` (aligned with the backend half's notes `scratch/slice8-backend-behaviour.md`: ladder names, `xpAvailable`, summary 404/409).
- [x] 2.2 Unit (Vitest): rank maths and Czech numbers, the celebration and its ack, HQ progress, the summary screen, briefing replay, task-screen XP / bonus / rank-up / summary link, the deny-list matcher and catalog scan (FR-32, FR-33, FR-36, FR-37, FR-38, FR-39).
- [x] 2.3 Route registry, example query and `⟦` / a11y / theme gates include `/summary`; a11y scans of the celebration states in light, dark and reduced motion (NFR-13, FR-36).
- [x] 2.4 E2E (Playwright): `e2e/gamification-hq.spec.ts` (FR-36, FR-37, FR-38) and `e2e/gamification-summary.spec.ts` (FR-32, FR-33, FR-36).
- [x] 2.5 Disposition recorded — eval case for the celebration copy tone NOT delivered, deferred (evals are PLANNED in the battery, scope 0, as in slice 7; the copy is the catalog's and reviewed by the vision judge and the review gate).
- [x] 2.6 Run them against compile-only stubs and confirm RED on assertions. Evidence: `docs/qa/evidence/slice8-red-run.md`.

## 3. UI (green)

- [x] 3.1 `src/features/rank/`: rank maths, `RankUpCelebration` with its acknowledgement, `RankPanel`, `RankLine`.
- [x] 3.2 `src/features/hq/`: progress panel in the hero and the pending celebration.
- [x] 3.3 `src/features/summary/`: mission-complete screen, registered at `/summary`.
- [x] 3.4 `src/features/mission/`: XP available, replay and results on a complete mission.
- [x] 3.5 `src/features/task/`: XP on correct and revealed, bonus line, mid-mission celebration, "Výsledky mise".
- [x] 3.6 Catalog keys (cs child); `src/features/skin/` deny-list check.
- [x] 3.7 Recordings: `tools/record-slice8.mjs`, asserted clips with stills in `docs/qa/demo-recordings/slice8-gamification/`; vision-verify over their stills (FR-36, FR-37): 8 of 8 clips asserted, 8 of 8 met and readable — evidence: `docs/qa/demo-recordings/slice8-gamification/manifest.json`, `docs/qa/vision-report.md`, `trace/workflow-runs/20261007-101043-vision-verify.json`.

## 4. Validation, review, archive

- [x] 4.1 `CI=1 npm run qa:verify` — `Overall result: Pass (1 member(s) PLANNED, not yet due: eval-ratchet)`: 616 unit tests (coverage 100%), e2e 552 passed, 1 flaky (firefox `practice-timing.spec.ts` round trip against the stub under machine load, passed on the CI retry), 23 skipped (stack-only NFR-5 and theme screens without controls) in chromium, msedge and firefox — evidence: `docs/qa/automated-verification-latest.md` (2026-10-07, after the review fixes). An earlier full run of `3c666a7` failed on Firefox browser crashes/timeouts in the a11y scan of `/mission` (6 more flaky) under machine load; the same scans passed when run on their own.
- [x] 4.2 `npx openspec validate implement-gamification-ui --strict`
- [x] 4.3 review-gate workflow (`trace/workflow-runs/20261007-095548-review-gate.json`, $14.28): 2 majors (F01/F04, the same "+0 XP" on a first-run summary) and 8 minors, all fixed in `79f9993`, none waived; clips re-recorded and re-judged (8/8); qa:verify re-run PASS; `review-findings.json` clean:true.
- [x] 4.4 Handed to the coordinator — real-stack smoke NOT run in this change (the owner's stack runs `main`); after merging both slice 8 halves: open `/` → HQ shows the rank "Nováček", 0 XP, the bar at 0 of 150 and "Vyřešené úlohy: 0" → open a mission, note "Můžeš získat až {n} XP" → solve every task (one wrong then right, one revealed: "+1 XP") → "Výsledky mise" → "Mise je splněná!" with the run's XP and the first-try count (a rank-up celebration if a threshold was crossed, acknowledged: reload shows the static line) → "Zpět na HQ": XP, rank and solved count updated, no celebration → briefing "Zopakovat misi" → task 1 with 0 of 2 attempts → finish → "Opakování je hotové!" with 0 XP, HQ total unchanged, the mission still complete and no "Pokračovat" to it.
- [x] 4.5 Update `docs/current-state.md`.
- [x] 4.6 Archive: `npx openspec archive implement-gamification-ui --yes`; commit with `Slice: implement-gamification-ui` + `Refs: FR-32, FR-33, FR-36, FR-37, FR-38, FR-39`.
