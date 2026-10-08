## 1. Coverage baseline

- [x] 1.1 `npm run test:coverage` and `node scripts/check-coverage-ratchet.mjs` (100% on every metric, PASS); record with `--update`

## 2. Real-stack suite

- [x] 2.1 `playwright.stack.config.ts`, `e2e/stack/support.ts`, `npm run test:e2e:stack` / `test:e2e:stack:only`; the mocked suite ignores `e2e/stack/`
- [x] 2.2 Journeys: admin session; authoring to practice; practice (correct, reveal, hint, summary); flag queue fix and re-evaluate; stats; seed
- [x] 2.3 `tools/e2e-stack-run.mjs`: up, seed, run, always down, evidence `docs/qa/e2e-stack-latest.md`, NOT-EARNED when not run

## 3. Verification

- [x] 3.1 Two wrapper runs green in chromium, msedge and firefox (the second against the accumulated state of the first)
- [x] 3.2 `npm run qa:verify`
- [x] 3.3 Review gate over the diff; findings dispositioned in `review-findings.json`
- [x] 3.4 `docs/current-state.md` updated
