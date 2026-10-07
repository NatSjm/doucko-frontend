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
- [ ] 3.7 Recordings: `tools/record-slice8.mjs`, asserted clips with stills in `docs/qa/demo-recordings/slice8-gamification/`; vision-verify over their stills (FR-36, FR-37).

## 4. Validation, review, archive

- [ ] 4.1 `CI=1 npm run qa:verify` green.
- [ ] 4.2 `npx openspec validate implement-gamification-ui --strict`
- [ ] 4.3 review-gate workflow; findings dispositioned in `review-findings.json` (clean:true).
- [ ] 4.4 Real-stack smoke after the merge (coordinator).
- [ ] 4.5 Update `docs/current-state.md`.
- [ ] 4.6 Archive: `npx openspec archive implement-gamification-ui --yes`; commit with `Slice: implement-gamification-ui` + `Refs: FR-32, FR-33, FR-36, FR-37, FR-38, FR-39`.
