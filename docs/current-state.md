# Current State — frontend

> Persistent handoff file for future agent windows. A quick map, not a
> replacement for source-of-truth artifacts.

## Last Updated

- **Date and time:** 2026-09-28 (Europe/Prague)
- **Current phase:** Phase 0
- **Last completed gate:** none
- **Active change:** none
- **Contract pin:** none yet — gates read the sibling `../docs` (UNPINNED warning) until `contract/` is added
- **Progress:** Delivery harness installed (`scripts/`, `.githooks/`, `.claude/`,
  `factory.config.json`); OpenSpec root initialized with `references: [doucko]`;
  Doučko design system vendored at `src/design-system/` (excluded from
  product-code detection). No application code yet.
- **Next task:** Scaffold Vite (react-ts) around the vendored design system
  (`src/design-system/INSTALL.md`): ESLint, Vitest (json-summary coverage),
  Playwright, API client generator, npm scripts `lint`, `typecheck`, `test:run`,
  `test:coverage`, `test:e2e`, `build`. Then seal the integrity lock.
- **Claims:**
  - Harness installed and not drifted — evidence: `npm run factory:check`

## Validation

```bash
npm run qa:verify
npm run gate:status
npx openspec doctor
```
