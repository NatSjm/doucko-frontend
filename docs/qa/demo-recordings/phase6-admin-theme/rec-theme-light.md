# HQ and the admin stats page follow the light OS setting; no in-app toggle (FR-58)

**Proves:** FR-58

**Result:** asserted ✓

Clip `rec-theme-light: HQ and the admin stats page follow the light OS setting; no in-app toggle (FR-58)` in `e2e/recordings/admin-and-theme.spec.ts`: the steps and every assertion are the test body (Playwright `expect`). Recorded against the production build (`vite preview`) with the API answered by the contract stubs `src/test/fake-admin-backend.ts` / `src/test/fake-child-backend.ts` (self-authored data). The real-stack suite is `e2e/stack/` (docs/qa/e2e-stack-latest.md).

![still](rec-theme-light.png)
