# Phase 5 real-stack E2E: two consecutive runs (rerun tolerance)

Frontend `c0d0c7c` (clean apart from `docs/qa`, `trace`), backend worktree
`backend-phase5-hardening` at `81c0fbd`, 2026-10-08 (Europe/Prague), holding
`../scratch/qa-lock`. Suite `e2e/stack/` (7 tests) in chromium, msedge and
firefox, one worker, no route mocks, against compose project `doucko-e2e` on
http://127.0.0.1:18082.

| Run | Command | Stack | Seed | Tests | Result |
|---|---|---|---|---|---|
| 1 | `node tools/e2e-stack-run.mjs --keep` | fresh volumes | created source, 3 tasks, mission | 21 passed, 0 failed, 0 flaky, 0 skipped (2.8 min) | PASS (stack kept up) |
| 2 | `node tools/e2e-stack-run.mjs` | same volumes: run 1's content, attempts, XP and reports still there | every item "exists (PUBLISHED)", same ids | 21 passed, 0 failed, 0 flaky, 0 skipped (1.7 min) | PASS, stack taken down |

Run 2's own record: `docs/qa/e2e-stack-latest.md`. Between the runs the
pre-flight guard was checked against the kept stack: with a different expected
child name it aborted before any test ("is not the isolated e2e stack …
refusing to write to it"), and against a closed port it aborted on the
connection. After run 2 no `doucko-e2e` container was left; the owner's
project `doucko` (containers `doucko-backend-1`, `doucko-db-1`,
`doucko-frontend-1`) was not touched.

Earlier, before the review-gate fixes (`dc49cd2` + working tree), the suite ran
five times against one stack and twice through the wrapper: all green except
one Firefox sign-in that timed out under machine load (the POST answered 204 in
184 ms; the bundle took 4 s to load); the specs now give Firefox triple time and
the sign-in heading 15 s.
