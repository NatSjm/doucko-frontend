# Slice 1 review-gate fixes (frontend) — red, green (2026-10-04)

Review gate `trace/workflow-runs/20261003-233104-review-gate.json` (first run with
PD-13): 23 confirmed + 10 contested findings, deduplicated into the fixes below.
Tests were written first and run before the implementation changed.

## Red — unit (Vitest, implementation unchanged)

```
src/app/App.test.tsx > App shell > renders the route registered for the current path and marks it
src/app/App.test.tsx > App shell > renders the not-found screen for an unregistered path, not the first route
src/app/App.test.tsx > App shell > sets the document title from the catalog
src/app/i18n-coverage.test.tsx > externalized UI strings (NFR-9) > route / shows only catalog text, title included
src/app/i18n-coverage.test.tsx > externalized UI strings (NFR-9) > the not-found screen shows only catalog text
src/test/container-config.test.ts > nginx.conf > hides its version and sends security headers on every response
src/test/container-config.test.ts > nginx.conf > answers a missing built asset 404, not the SPA page
src/test/container-config.test.ts > nginx.conf > proxies the API with the original host and client address
src/test/container-config.test.ts > Dockerfile > pins every base image by digest
src/test/container-config.test.ts > Dockerfile > fails the build when the pinned contract is missing, before building
src/test/container-config.test.ts > tsconfig split > keeps DOM types out of Node-side code; only e2e specs get them
src/test/lint-rule.test.ts > doucko/no-literal-ui-text > invalid > const a = <p>{ok ? "Hotovo" : t("x")}</p>;
src/test/lint-rule.test.ts > doucko/no-literal-ui-text > invalid > const a = <p>{err && "Chyba"}</p>;
src/test/lint-rule.test.ts > doucko/no-literal-ui-text > invalid > const a = <p>{label ?? "Zavřít"}</p>;
src/test/lint-rule.test.ts > doucko/no-literal-ui-text > invalid > const a = <p>{`Úroveň ${n}`}</p>;
src/test/lint-rule.test.ts > doucko/no-literal-ui-text > invalid > const a = <p>{t("a") + " bodů"}</p>;
src/test/lint-rule.test.ts > doucko/no-literal-ui-text > invalid > const a = <button aria-label={open ? "Zavřít" : "Otevřít"} />;
src/test/lint-rule.test.ts > doucko/no-literal-ui-text > invalid > const a = <div aria-description="Mise" />;
src/test/lint-rule.test.ts > doucko/no-literal-ui-text > invalid > const a = <div role="meter" aria-valuetext="Polovina" />;
src/test/lint-rule.test.ts > doucko/no-literal-ui-text > invalid > const a = <section aria-roledescription="karta" />;
src/test/lint-rule.test.ts > doucko/no-literal-ui-text > invalid > const a = <input type="submit" value="Odeslat" />;
src/test/lint-rule.test.ts > doucko/no-literal-ui-text > invalid > const a = <h1 children="Doučko" />;
src/test/lint-rule.test.ts > doucko/no-literal-ui-text > invalid > const a = <Icon name="check" label="Hotovo" />;
src/test/lint-rule.test.ts > doucko/no-literal-ui-text > invalid > const a = <Panel ariaLabel="Mise" kicker="Dnes" />;
src/test/lint-rule.test.ts > doucko/no-literal-ui-text > invalid > const a = <SubjectTile name="Matematika" meta={`${n} úloh`} />;
src/test/lint-rule.test.ts > doucko/no-literal-ui-text > invalid > const a = <AnswerPart unit="cm" placeholder="Tvoje odpověď" />;
src/test/provenance.test.ts > fixture and asset provenance (NFR-4) > this repository's fixtures and assets are all listed with an allowed origin
src/test/provenance.test.ts > fixture and asset provenance (NFR-4) > a licensed asset needs its licence file listed beside it; fixtures must be self-authored
      Tests  28 failed | 32 passed (60)
```

The two provenance cases failed for reasons the new checker found: the new
`e2e/fixtures/test.ts` was unlisted (now listed), and the licence pairing let
one font borrow another font's licence file (now paired by origin and author).
The lint wiring test passed from the start: the existing config already wires
the rule.

## Red — e2e (chromium, current build served by `vite preview`)

```
  1) [chromium] › e2e\a11y.spec.ts:10:7 › axe, light › / has no serious or critical WCAG A/AA violation 
  2) [chromium] › e2e\a11y.spec.ts:10:7 › axe, dark › / has no serious or critical WCAG A/AA violation 
  3) [chromium] › e2e\a11y.spec.ts:24:5 › reduced motion › / runs no animation ────────────────────
  4) [chromium] › e2e\app-shell.spec.ts:6:1 › app shell loads in Czech at 1280×720 with the design system applied 
  5) [chromium] › e2e\app-shell.spec.ts:34:1 › against a stack, the guard fails when the real name is not configured 
  6) [chromium] › e2e\theme.spec.ts:17:7 › light OS › / uses the light theme ──────────────────────
  7) [chromium] › e2e\theme.spec.ts:24:7 › light OS › /: no control switches away from the light theme 
  8) [chromium] › e2e\theme.spec.ts:17:7 › dark OS › / uses the dark theme ────────────────────────
  9) [chromium] › e2e\theme.spec.ts:24:7 › dark OS › /: no control switches away from the dark theme 
  -> 1–4, 6–9: expect(locator).toBeAttached() — [data-route="/"] not found (App ignored the URL)
```

Failure 5 was a bug in the test, not the guard: passing `undefined` re-applied
the env default, so the "missing name" case now passes `''`.

The guard's no-echo test, run against the original `profile.ts` from git:

```
Error: expect(received).not.toContain(expected)
Expected substring: not "hrdinka"
received string: "... expected substring: not \"testovací hrdinka\" received string: \"ahoj, testovací hrdinka!\""
```

## Green

`npm run qa:verify`: Overall Pass (trajectory, recordings, eval-ratchet
PLANNED); Vitest 60/60, coverage 100 %; Playwright 33/33 in chromium, msedge
and firefox; lint and typecheck clean.

## Fix map

| Finding | Fix | Test |
|---|---|---|
| Lint rule misses literals in expressions, other aria-* / value / children, component text props | rule walks conditional/logical/template/`+`; DOM text attributes; any component prop except identifier props | `lint-rule.test.ts` (+ wiring through `eslint.config.js`) |
| Pseudo-catalog test is prefix-only, container-only, few attributes | `⟦…⟧` full-coverage check over `document.body`, aria-*, input values, `document.title`; renders `App` | `i18n-coverage.test.tsx` |
| App ignores the URL; e2e could pass on the wrong screen | route by `location.pathname`, `data-route` marker, not-found screen; e2e waits for the marker | `App.test.tsx`, all e2e specs |
| `index.html` / document title bypass the catalog | title set from the catalog; `index.html` kept equal by test | `App.test.tsx`, `i18n-coverage.test.tsx` |
| Provenance roots too narrow; licence pairing unenforced | all media/fonts/PDFs in git + fixture and asset roots; licence file of same origin and author | `provenance.test.ts` |
| Real-name guard echoes the name; silent when unset; specs forget it | boolean check, fail-closed against a stack, auto fixture for every test | `app-shell.spec.ts` |
| No-toggle check is a name heuristic | activates every control, checks `data-theme` and background | `theme.spec.ts` |
| Reduced motion sampled once at load | after network idle and 500 ms later, running or pending | `a11y.spec.ts` |
| nginx: no security headers, version shown, missing asset → SPA, proxy drops host/client | `server_tokens off`, nosniff, Referrer-Policy, CSP; `/assets/` 404; `$http_host`, X-Forwarded-For | `container-config.test.ts` + compose smoke |
| Floating base images, old nginx line; build without contract | digest-pinned node 22 / nginx stable 1.30; build stops without `contract/api/openapi.yaml` | `container-config.test.ts` |
| DOM types leak into Node-side tsconfig | `tsconfig.e2e.json` for specs only | `container-config.test.ts` |
| NFR-12 and serving had no requirement | spec delta: two requirements, reduced-motion and licence scenarios | `openspec validate --strict` |
| Design-system defaults in Czech bypass the catalog | out of scope (vendored); recorded in design.md as a known gap | — |
