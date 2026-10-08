# Design: Phase 6 QA proof (frontend)

- Clips are Playwright tests so the assertions are the same `expect` API as
  the e2e suite; the clip id is the test title prefix (`rec-…:`), the proven
  ids a `proof` annotation, the still an attachment written to a file. The
  tool maps the JSON report to the manifest contract of
  `scripts/check-recordings.mjs` (`video`, `screenshot`, `asserted`).
- Kept out of the e2e suite (no video cost, no double run); the e2e specs
  remain the regression gate for the same FRs.
- Data: the shared contract stubs (`src/test/fake-*-backend.ts`), self-authored,
  fictional display name (NFR-3/NFR-4).
- Eval: no MVP requirement declares `eval` (only Future FR-45..FR-51), so the
  eval ratchet's SKIP-planned is the honest verdict; no eval case is invented.
