# Current State — frontend

> Persistent handoff file for future agent windows. A quick map, not a
> replacement for source-of-truth artifacts.

## Last Updated

- **Date and time:** 2026-09-28 (Europe/Prague)
- **Current phase:** Phase 0
- **Last completed gate:** none
- **Active change:** none
- **Contract pin:** none yet — gates read the sibling `../docs` (UNPINNED warning) until `contract/` is added
- **Progress:** Harness installed; design system vendored at `src/design-system/`. Vite 8 +
  React 19 + TypeScript 5.9 strict scaffold (ADR-0003): `@` alias, app shell `src/app/` with a
  TanStack Query provider, ESLint 10 flat config (ignores the design system, generated client and
  harness dirs), Vitest 5 + Testing Library (jsdom, v8 coverage with `json-summary`), Playwright
  (chromium; `E2E_BASE_URL` or a built `vite preview`). API types: `npm run api:generate` →
  openapi-typescript → gitignored `src/api/generated/schema.d.ts` (SKIP-pending until
  `api/openapi.yaml` exists); runtime client openapi-fetch + openapi-react-query.
- **Next task:** Phase 0 step 5, pin `contract/` once the docs repo has a remote. Then Phase 1 in docs.
- **Claims:**
  - Harness installed and not drifted — evidence: `npm run factory:check`
  - Battery scripts exist and pass on the scaffold: `npm run lint`, `typecheck`, `test:run`,
    `test:coverage`, `test:e2e` (1 Playwright smoke), `build`. All exited 0 on 2026-09-28.
  - G0 PASS, G1+ not started. Evidence: `npm run gate:status`
- **Scope NOT delivered:** `contract/` submodule, routes/child and admin apps, i18n setup (NFR-9,
  first UI slice), e2e against docker compose (Phase 5).

## Validation

```bash
npm run qa:verify
npm run gate:status
npx openspec doctor
```
