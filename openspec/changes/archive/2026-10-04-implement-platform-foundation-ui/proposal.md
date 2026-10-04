# Implement platform foundation (frontend)

## Why

Slice 1 of the capability plan (`contract/docs/mvp-capability-plan.md` §4.1
and §2.1). The frontend owns FR-58 (the theme follows the OS, no toggle) and
the mechanisms every later UI slice must keep green: PII-free e2e evidence
(NFR-3), asset and fixture provenance (NFR-4, CA-D21), Chrome, Edge and
Firefox at 1280×720 (NFR-6), externalized UI strings (NFR-9), the generated
contract client (NFR-12), and WCAG AA in light and dark (NFR-13). Store
specs: `gamification` ("Light and dark theme"), `content-authoring` (CA-D21).

## What Changes

- `src/i18n/`: message catalogs (`cs` child, `en` admin), `I18nProvider`,
  `useT()`. The app shell takes every string from the catalog.
- `src/app/routes.tsx`: the route registry that the a11y and i18n checks
  iterate. Today it holds only the shell (`/`); every later UI slice adds its
  routes there.
- ESLint rule `doucko/no-literal-ui-text`: no literal JSX text and no literal
  `aria-label`, `title`, `alt` or `placeholder` in `src/`.
- Playwright projects `chromium`, `msedge` and `firefox` at 1280×720; an
  axe-core e2e spec over every route in light and dark; FR-58 e2e.
- `fixtures/PROVENANCE.md` + a Vitest check over fixtures and skin assets.
- e2e fixture with a fictional display name and a guard against the real
  one appearing on a page.
- `Dockerfile` + `nginx.conf` for the Compose `frontend` service (decision D-P1).

No API operation is consumed yet.

## Impact

- Store specs: gamification, content-authoring · Contract pin: docs `4c87d67` (API 0.5.1) · Generated client regenerated: yes (`api:generate`, gitignored)
- Features: `src/app`, `src/i18n` (no `src/features/*` yet)
- New dev dependency: `@axe-core/playwright` (already imported by the
  installed `scripts/check-a11y.mjs`, but never installed). Playwright Firefox
  browser.
