# Phase 5 hardening (frontend)

## Why

PLAYBOOK Phase 5 / gate G5: "Playwright suites against `docker compose up`
(Postgres + backend + nginx frontend), coverage baseline. Seeds are
idempotent, self-authored, PII-free." Until now every e2e spec ran against
`page.route('**/api/**')` stubs (`e2e/fixtures`); the real backend was only
replayed by hand in the per-slice compose smokes. This change adds an
automated real-stack suite and records the coverage baseline. No product
behaviour changes.

## What Changes

- `e2e/stack/*.spec.ts` (new): Playwright journeys with no route mocks,
  through nginx, the backend and Postgres of the isolated compose project
  `doucko-e2e` (backend `tools/e2e-stack.mjs`, port 18082, fake committed
  credentials): admin sign-in and sign-out; authoring a source, a task and a
  mission in the admin UI and publishing them; the child's HQ listing it and
  the child solving it; correct, wrong-then-reveal and hint journeys with XP,
  HQ and the mission summary read back from the server; a child report fixed
  from `/admin/reports` (answer spec edited, re-evaluated, +4 XP); `/admin/stats`
  reflecting a session; the backend's seed served to the child. Each test
  authors uniquely named, self-authored content, so reruns against the same
  accumulated database pass.
- `playwright.stack.config.ts` (new, `E2E_STACK_URL`, default
  `http://127.0.0.1:18082`; one worker; chromium, msedge, firefox).
  `playwright.config.ts` ignores `e2e/stack/`; the mocked suite is unchanged.
- `tools/e2e-stack-run.mjs` (new, `npm run test:e2e:stack`): brings the stack
  up from the backend checkout (`DOUCKO_BACKEND_DIR`, default `../backend`)
  with this worktree as the frontend build context, seeds it, runs the suite,
  always takes it down, writes `docs/qa/e2e-stack-latest.md` and prints the
  qa-verify contract (`Scope:` / `Result: PASS|FAIL|NOT-EARNED`; a run that
  could not bring the stack up or skipped tests is NOT-EARNED, never PASS).
  `npm run test:e2e:stack:only` runs the suite against an already running stack.
- Coverage baseline recorded (`check-coverage-ratchet --update`).

## Capabilities

None changed: hardening only (tests, tooling, evidence). The specs the
journeys follow are the store's `admin-access`, `content-authoring`,
`practice-flow`, `gamification` and `progress-stats`.

## Impact

- `qa:verify` keeps the mocked `test:e2e` member (no Docker dependency); the
  real-stack run is a separate G5 command with its own evidence file.
