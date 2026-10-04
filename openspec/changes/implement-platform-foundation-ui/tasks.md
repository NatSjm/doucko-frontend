## 1. Contract

- [x] 1.1 Confirm the `contract/` pin (docs `4c87d67`, API 0.5.1); `api:generate` regenerates the client.

## 2. Failing tests first (red)

- [x] 2.1 `src/app/i18n-coverage.test.tsx` (NFR-9): every route and the not-found screen, rendered with a `⟦…⟧` pseudo-catalog and settled, show only text wrapped in `⟦…⟧` (separators and numbers allowed) in text nodes, text attributes, shown field values and the document title; the cs and en catalogs share no key.
- [x] 2.2 `src/test/lint-rule.test.ts` (NFR-9): the `doucko/no-literal-ui-text` rule reports literal UI text in JSX, text attributes and props (nested collections, call arguments, callback returns, shown field values) and in `document.title`, and accepts catalog calls.
- [x] 2.3 `src/test/provenance.test.ts` (NFR-4): every fixture and skin asset is listed with an allowed origin, and every listed file exists.
- [x] 2.4 `src/api/contract-client.test.ts` (NFR-12): the generated `paths` type has exactly the pinned contract's paths.
- [x] 2.5 `e2e/theme.spec.ts` (FR-58): dark OS → dark tokens, light OS → light tokens; no theme toggle on any route.
- [x] 2.6 `e2e/a11y.spec.ts` (NFR-13): axe serious/critical = 0 on every route in light and dark; no running animation under reduced motion.
- [x] 2.7 `e2e/app-shell.spec.ts` (NFR-3, NFR-6): smoke in chromium, msedge and firefox at 1280×720; the real display name never appears.
- [ ] 2.8 Run them and confirm RED on assertions. **Open:** no recorded RED run for the original tests; the review-fix tests have one (`docs/qa/evidence/slice1-review-fixes.md`).

## 3. Implementation (green)

- [x] 3.1 `src/i18n/` catalogs + provider + `useT`; the shell uses them.
- [x] 3.2 `src/app/routes.tsx` route registry.
- [x] 3.3 `eslint-rules/no-literal-ui-text.js` wired into `eslint.config.js`.
- [x] 3.4 `playwright.config.ts` projects; `npx playwright install firefox`; `@axe-core/playwright`.
- [x] 3.5 `fixtures/PROVENANCE.md`; `e2e/fixtures/profile.ts` + `expectNoRealName`.
- [x] 3.6 `Dockerfile`, `nginx.conf`, `.dockerignore`.

## 4. Validation, review, archive

- [x] 4.1 `npm run qa:verify` green.
- [x] 4.2 `npx openspec validate implement-platform-foundation-ui --strict`.
- [ ] 4.3 review-gate workflow; fix confirmed findings; `review-findings.json` (clean: true).
- [ ] 4.4 Smoke against the compose stack: `npm run stack:up` in backend; open `http://127.0.0.1:8081/` in light and dark; `/api/child/nope` through nginx is 404 problem+json.
  - Partly automated: `npm run test:container` checks the image over HTTP against a stub backend (all PASS 2026-10-04); its e2e-through-nginx step and this real-stack smoke wait for `DOUCKO_CHILD_DISPLAY_NAME` in `../backend/.env`.
- [ ] 4.5 Update `docs/current-state.md`.
- [ ] 4.6 Archive; commit with `Slice: implement-platform-foundation-ui` + `Refs: FR-58, NFR-3, NFR-4, NFR-6, NFR-9, NFR-12, NFR-13`.
