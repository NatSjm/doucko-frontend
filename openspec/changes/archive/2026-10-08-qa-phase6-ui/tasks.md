## 1. Recordings

- [x] 1.1 `e2e/recordings/admin-and-theme.spec.ts`, `playwright.record.config.ts`, `tools/record-e2e-clips.mjs`; the e2e suite ignores `e2e/recordings/`
- [x] 1.2 Record: 11 of 11 clips asserted; `check-recordings` PASS; `check-traceability --release --strict-tests --strict-recordings` PASS

## 2. Checks

- [x] 2.1 `check-a11y` light + dark and the a11y e2e (signed-in content incl. /admin/stats, /admin/reports)
- [x] 2.2 `check-acceptance-methods --mode=artifact`, `check-eval-ratchet --update` (SKIP-planned: no MVP eval)
- [x] 2.3 vision-verify over the clips without a verdict; act on failures
- [x] 2.4 `correct.mjs --detect` records the slice-1 waiver as COR-1 (disposition is the owner's)

## 3. Verification

- [x] 3.1 Review gate over the diff; findings dispositioned in `review-findings.json`
- [x] 3.2 `npm run qa:verify`; `npm run test:e2e:stack` at the final code commit
- [x] 3.3 `docs/current-state.md` updated
