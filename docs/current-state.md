# Current State — frontend

> Persistent handoff file for future agent windows. A quick map, not a
> replacement for source-of-truth artifacts.

## Last Updated

- **Date and time:** 2026-10-04 (Europe/Prague)
- **Current phase:** Phase 4
- **Last completed gate:** G3
- **Active change:** none. Slice 1 `implement-platform-foundation-ui` archived 2026-10-04
  (branch `slice1-platform-foundation`, not pushed or merged).
- **Contract pin:** `contract/` submodule (`url = ../docs`) at docs `4c87d67`, API 0.5.1
- **Progress:** Vite 8 / React 19 / TypeScript 5.9 scaffold (ADR-0003) plus slice 1 platform
  foundation: app shell with route registry and not-found screen, message catalogs (cs child, en
  admin) with the `doucko/no-literal-ui-text` lint rule and a pseudo-catalog render test, theme from
  the OS only (static invariants + e2e), axe and reduced-motion e2e in Chrome, Edge and Firefox,
  generated API client from the pinned contract, nginx image (one origin, security headers, DNS
  rebinding guard 421, no-cache shell), fixture/asset provenance test, real-name guard for e2e.
- **Next task:** slice 2 per the capability plan (`contract/docs/mvp-capability-plan.md`).
- **Claims:**
  - QA battery passes — evidence: `docs/qa/automated-verification-latest.md` (2026-10-04)
  - Image smoke against a stub backend, Playwright through nginx — evidence: `docs/qa/container-smoke-latest.md`
  - Real-stack smoke (task 4.4) — evidence: `docs/qa/evidence/slice1-compose-smoke.md`
  - Review gate clean after 10 rounds and the owner's sign-off — evidence:
    `openspec/changes/archive/*implement-platform-foundation-ui/review-findings.json`
  - G0, G2, G5, G8 PASS; G1 and G3 need the owner's sign-off; G4 and G6 are SKIP-planned; G7
    (release) fails until every MVP slice is archived. Evidence: `npm run gate:status`
- **Scope NOT delivered:** the child and admin feature screens (later slices); recordings and evals
  (planned with their slices); task 2.8's original RED run (waived:
  `docs/qa/waivers/slice1-task-2.8-red-run.md`).

## Validation

```bash
npm run qa:verify
npm run gate:status
npx openspec doctor
```
