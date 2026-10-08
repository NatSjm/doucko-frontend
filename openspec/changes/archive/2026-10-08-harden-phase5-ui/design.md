# Design — Phase 5 hardening (frontend)

## Where the suite lives

`e2e/stack/` (not a new top-level folder) so the harness's existing globs cover
it: `tests.dirs` (traceability counts its `@trace` tags), the pre-commit eslint
rule `^(src|e2e|evals)/`, and `tsconfig.e2e.json`. `playwright.config.ts`
ignores `stack/**`, so the mocked suite and `npm run test:e2e` are unchanged.

## Stack and target

The backend checkout owns the isolated compose project `doucko-e2e`
(`tools/e2e-stack.mjs up|seed|down`, port 18082, fake committed admin password
and child name; interface `../scratch/phase5-e2e-stack.md`). The frontend
image is built from this worktree (`DOUCKO_FRONTEND_DIR`). A global pre-flight
(`e2e/stack/preflight.ts`) reads `GET /api/child/hq` and aborts the run unless
the child is the fake test child, so neither `E2E_STACK_URL` nor
`test:e2e:stack:only` can write to the owner's stack. The name is never
printed.

## Order independence and reruns

One child profile and one database: the config runs one worker, and journeys
assert deltas (XP, solved count, stats week, topic first-try counts) read from
the API before and after, never absolute totals. Each test authors its own
content through the admin API or UI with a run-unique suffix: a fresh source,
published INTEGER tasks, a mission at the next free position of the topic. A
pending rank-up from an earlier run is acknowledged before HQ assertions.
The seed spec is read-only. The stats spec treats a run across Monday midnight
as a new, empty week.

## Verdict honesty

`tools/e2e-stack-run.mjs` prints `Scope:` and `Result:`. PASS needs n > 0
tests with none failed, flaky, skipped or interrupted and a successful `down`.
A run that could not start the stack is NOT-EARNED. Narrowed (`-- <args>`) or
`--keep` runs write `test-results-stack/e2e-stack-run.md`, never the G5
evidence `docs/qa/e2e-stack-latest.md`, which records both commits.

## F12 (resolved by PD-16)

Resolved by the factory change PD-16 (docs f04f481, installed as 28478f9): gate-status G5 key `e2eStack` and battery member `e2e-stack-evidence` read the evidence without Docker. Original note:

The gate machinery does not yet read the real-stack verdict: gate-status G5
checks coverage only and the battery's `browser-e2e-tests` is the mocked
suite. Both are factory files (`../docs/factory/`, integrity-locked); the
proposal is in `../scratch/phase5-frontend-blockers.md`. `qa:verify` keeps no
Docker dependency, as the existing pattern (`tools/container-smoke.mjs` is
outside the battery).
