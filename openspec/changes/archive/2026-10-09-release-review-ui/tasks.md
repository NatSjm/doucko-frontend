## 1. Release review

- [x] 1.1 Bump the `contract/` pin to docs `8908669`
- [x] 1.2 Review gate over the whole history (three chunks); findings dispositioned in `review-findings.json`
- [x] 1.3 Trajectory-eval over the archived slices; act on it

## 2. Release checks

- [x] 2.1 G7 commands pass (`qa:verify`, traceability `--release --strict-tests --strict-recordings`, `--check-fresh`, trajectory, process ratchet, factory integrity, corrections)
- [x] 2.2 Real-stack e2e (`npm run test:e2e:stack`) at the final code commit

## 3. Notes

- Trajectory-eval (`trace/workflow-runs/20261009-173537-trajectory-eval.json`): budget-capped after 6 of 36 judgements (2 of 9 slices; artifacts step skipped). 5 of 6 pass (threshold 70); dimensions process-order 74.5, test-integrity 87, in-scope 78, craft 82. The one fail, `implement-platform-foundation-ui` process-order 65, is the slice-1 task 2.8 RED run, already waived by the owner (COR-1, `docs/qa/waivers/slice1-task-2.8-red-run.md`); no new action.
- Review gate: 22 findings, all minor; 4 fixed (`ab782c1`, one by npm audit), 18 waived with reasons. Coverage gaps are listed in `review-findings.json`.
