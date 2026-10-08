# a report lists task, raw input and verdict; dismiss one, fix the spec and re-evaluate another (+4 XP) (FR-41)

**Proves:** FR-41

**Result:** asserted ✓

Clip `rec-flag-queue: a report lists task, raw input and verdict; dismiss one, fix the spec and re-evaluate another (+4 XP) (FR-41)` in `e2e/recordings/admin-and-theme.spec.ts`: the steps and every assertion are the test body (Playwright `expect`). Recorded against the production build (`vite preview`) with the API answered by the contract stubs `src/test/fake-admin-backend.ts` / `src/test/fake-child-backend.ts` (self-authored data). The real-stack suite is `e2e/stack/` (docs/qa/e2e-stack-latest.md).

![still](rec-flag-queue.png)
