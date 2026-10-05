# Current State — frontend

> Persistent handoff file for future agent windows. A quick map, not a
> replacement for source-of-truth artifacts.

## Last Updated

- **Date and time:** 2026-10-05 (Europe/Prague)
- **Current phase:** Phase 4
- **Last completed gate:** G3
- **Active change:** none. Slice 6 `implement-authoring-missions-ui` archived 2026-10-05 (branch `slice6-authoring-missions`, not pushed or merged); slice 5 archived 2026-10-04.
- **Contract pin:** `contract/` submodule (`url = ../docs`) at docs `4c87d67`, API 0.5.1
- **Progress:** Vite 8 / React 19 / TypeScript 5.9 scaffold (ADR-0003) plus slice 1 platform
  foundation: app shell with route registry and not-found screen, message catalogs (cs child, en
  admin) with the `doucko/no-literal-ui-text` lint rule and a pseudo-catalog render test, theme from
  the OS only (static invariants + e2e), axe and reduced-motion e2e in Chrome, Edge and Firefox,
  generated API client from the pinned contract, nginx image (one origin, security headers, DNS
  rebinding guard 421, no-cache shell), fixture/asset provenance test, real-name guard for e2e.
- **Next task:** slice 7 (practice-flow) per the capability plan; before it, the owner merges both slice 6 halves and runs the real-stack smoke (task 4.4 of the archived slice 6 change).
- **Claims:**
  - Slice 6 mission and edit screens (`/admin/missions`, `/admin/missions/edit`, `/admin/sources/edit`, task status and delete in `/admin/tasks/edit`): QA battery passes (444 unit tests, coverage 100%, 321 e2e passed and 12 stack-only skipped in chromium, msedge and firefox, incl. the new routes signed in in the a11y and theme gates and the `⟦` test) — evidence: `docs/qa/automated-verification-latest.md` (2026-10-05). Under heavy machine load some Firefox runs flaked on timeouts (they pass serially), so the passing battery was run with `CI=1` (1 retry).
  - Slice 6 review gate clean (2 majors and 6 minors fixed in `fcaf268`, 1 minor waived) — evidence: `openspec/changes/archive/2026-10-05-implement-authoring-missions-ui/review-findings.json`, `trace/workflow-runs/20261004-203224-review-gate.json`
  - Slice 6 RED run — evidence: `docs/qa/evidence/slice6-red-run.md`; five asserted clips with stills (FR-9, FR-55, against the contract stub) — evidence: `docs/qa/demo-recordings/slice6-authoring-missions/manifest.json`
  - Slice 5 real-stack smoke PASS after the merge (2026-10-04) — evidence: `docs/qa/evidence/slice5-compose-smoke.md`
  - Slice 5 authoring screens (`/admin/sources`, `/admin/sources/view`, `/admin/tasks`, `/admin/tasks/edit`, `/admin/tasks/preview`): QA battery passes (347 unit tests, coverage 100%, 219 e2e in chromium, msedge and firefox incl. the authoring routes signed in in the a11y and theme gates, `⟦` test signed in) — evidence: `docs/qa/automated-verification-latest.md` (2026-10-04)
  - Slice 5 review gate clean (6 majors and 11 minors fixed in `37534ca`, 5 minors waived) — evidence: `openspec/changes/archive/2026-10-04-implement-authoring-tasks-ui/review-findings.json`
  - Slice 5 RED run — evidence: `docs/qa/evidence/slice5-red-run.md`; NFR-8 recording (asserted, 8.6 s against the contract stub) — evidence: `docs/qa/demo-recordings/nfr8-task-entry/manifest.json`
  - Slice 2 QA battery passes (unit, coverage at 100%, e2e in chromium, msedge and firefox incl. `/admin` in the a11y gate) — evidence: `docs/qa/automated-verification-latest.md` (2026-10-04)
  - Slice 2 RED run — evidence: `docs/qa/evidence/slice2-red-run.md`; real-stack smoke — evidence: `docs/qa/evidence/slice2-compose-smoke.md`
  - QA battery passes — evidence: `docs/qa/automated-verification-latest.md` (2026-10-04)
  - Image smoke against a stub backend, Playwright through nginx — evidence: `docs/qa/container-smoke-latest.md`
  - Real-stack smoke (task 4.4) — evidence: `docs/qa/evidence/slice1-compose-smoke.md`
  - Review gate clean after 10 rounds and the owner's sign-off — evidence:
    `openspec/changes/archive/*implement-platform-foundation-ui/review-findings.json`
  - G0, G2, G4, G5, G8 PASS (G4 audits the archived slice); G1 and G3 need the owner's sign-off; G6 is SKIP-planned; G7
    (release) fails until every MVP slice is archived. Evidence: `npm run gate:status`
- **Scope NOT delivered:** the preview-vs-child-screen pixel comparison (needs the slice 7 child task screen); the slice 6 real-stack smoke (owner, after the merge); admin screens of slice 9; eval cases for the sign-in copy (evals SKIP-planned); the child and admin feature screens (later slices); recordings and evals
  (planned with their slices); task 2.8's original RED run (waived:
  `docs/qa/waivers/slice1-task-2.8-red-run.md`).

## Validation

```bash
npm run qa:verify
npm run gate:status
npx openspec doctor
```
