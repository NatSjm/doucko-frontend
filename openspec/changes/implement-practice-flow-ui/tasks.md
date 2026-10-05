## 1. Contract

- [x] 1.1 Confirm the `contract/` pin (docs `0168eba`, API 0.5.1); `npm run api:generate` provides `getHq`, `getMissionBriefing`, `getCurrentTask`, `getTask`, `submitAttempt`, `openNextHint`, `reportProblem`, `getChildImage`, `getProfileSettings`, `updateProfileSettings` (never hand-edited).

## 2. Failing tests first (red)

- [x] 2.1 Unit (Vitest): practice model (`practice.ts`), navigation and `Link` (FR-26, FR-27, FR-22, NFR-7).
- [x] 2.2 Unit (Vitest): HQ, briefing and task screens against the shared contract stub (FR-22, FR-24..FR-31, NFR-7).
- [x] 2.3 Route registry, example queries, `⟦` test and the a11y/theme screens include the three child routes served by the stub (NFR-9, NFR-13).
- [x] 2.4 E2E (Playwright): `e2e/practice-hq.spec.ts`, `e2e/practice-task.spec.ts`, `e2e/practice-help.spec.ts`, `e2e/practice-resume.spec.ts` (FR-22, FR-24..FR-31, NFR-7, FR-12's HQ scenario under FR-25) and `e2e/practice-timing.spec.ts` (NFR-5, stack-only).
- [x] 2.5 Disposition recorded — eval case for child copy tone NOT delivered, deferred (evals are PLANNED in the battery, scope 0, and need a judge this run cannot call).
- [x] 2.6 Run them against compile-only stubs and confirm RED on assertions. Evidence: `docs/qa/evidence/slice7-red-run.md`.

## 3. UI (green)

- [x] 3.1 `src/app/`: client-side navigation (`navigate`, `Link`, route re-render); `/` becomes HQ.
- [x] 3.2 `src/features/child/`: child client, layout, load and not-found states.
- [x] 3.3 `src/features/hq/`: HQ screen.
- [x] 3.4 `src/features/mission/`: briefing screen.
- [x] 3.5 `src/features/task/`: task screen, practice model, hints, translation toggle, report dialog, save/resume.
- [x] 3.6 Catalog keys (cs child); routes registered with example queries.
- [x] 3.7 Recordings: `tools/record-slice7.mjs`, asserted clips with stills in `docs/qa/demo-recordings/slice7-practice-flow/`.

## 4. Validation, review, archive

- [x] 4.1 `CI=1 npm run qa:verify` — `Overall result: Pass (1 member(s) PLANNED, not yet due: eval-ratchet)`: 542 unit tests (coverage 100%), e2e 449 passed, 10 flaky (passed on the CI retry: admin a11y/authoring specs in msedge and firefox under machine load), 24 skipped (6 NFR-5 stack-only, 18 theme screens without controls) — evidence: `docs/qa/automated-verification-latest.md`. NFR-5 itself is NOT measured in this change (no seeded slice 7 stack; the owner's stack runs `main`): only the frontend share of the load budget is (`e2e/practice-timing.spec.ts`, against the contract stub); the stack measurement is task 4.4.
- [x] 4.2 `npx openspec validate implement-practice-flow-ui --strict`
- [ ] 4.3 review-gate workflow; fix confirmed findings; `review-findings.json` clean:true.
- [ ] 4.4 Handed to the owner — real-stack smoke after merging both slice 7 halves: open `/` → HQ greets the fictional name, lists only published missions → click a new mission → "Začít misi" → task screen with focus in input a → type a wrong answer, Enter → "Skoro! Zkus to znovu.", 1 of 2 → type `5,,2`, Enter → format tip, still 1 of 2 → wrong again → "Nevadí, příště!" with the answers → "Nápověda" opens hint 1 → "Zobrazit ukrajinsky" → "Nahlásit problém" "Jiné" without a note (refused), with a note (thanks) → "Další úloha" → close the browser, reopen → "Pokračovat" opens that task; with the stack seeded run `E2E_BASE_URL=… npx playwright test e2e/practice-timing.spec.ts` (NFR-5).
- [ ] 4.5 Update `docs/current-state.md`.
- [ ] 4.6 Archive: `npx openspec archive implement-practice-flow-ui --yes`; commit with `Slice: implement-practice-flow-ui` + `Refs: FR-22, FR-24, FR-25, FR-26, FR-27, FR-28, FR-29, FR-30, FR-31, NFR-5, NFR-7`.
