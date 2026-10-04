## 1. Contract

- [x] 1.1 Confirm the `contract/` pin (docs `4c87d67`); `npm run api:generate` provides `signIn`, `getAdminSession`, `signOut`.

## 2. Failing tests first (red)

- [x] 2.1 Unit (Vitest) `adminClient.test.ts` (store spec, CSRF; NFR-15 is backend-owned, so untraced): `X-XSRF-TOKEN` from the cookie on mutations only; admin 401s other than sign-in reach `onAdminUnauthorized`.
- [x] 2.2 Unit (Vitest) `AdminGate.test.tsx` (NFR-9): no session shows the English sign-in form with one password field; the body is `{"password":…}` only; wrong password shows the error; success shows the admin home; sign-out sends the CSRF header and returns to the form; a later admin 401 returns to the form; an unreachable server offers a retry.
- [x] 2.3 Route registry, `⟦` test and a11y list include `/admin` (NFR-9, NFR-13).
- [x] 2.4 E2E `e2e/admin-sign-in.spec.ts` (NFR-6, NFR-9): sign-in shown without a session, the keyboard-only path, wrong password, sign-in and sign-out (API stubbed without a stack).
- [x] 2.5 Run them and confirm RED on assertions. Evidence: `docs/qa/evidence/slice2-red-run.md`.

## 3. UI (green)

- [x] 3.1 `src/features/admin-access/`: `adminClient`, `session.ts`, `AdminGate`, `SignInForm`, `AdminHome`.
- [x] 3.2 Catalog keys; route `/admin`; e2e fixture stub.

## 4. Validation, review, archive

- [x] 4.1 `npm run qa:verify` green.
- [x] 4.2 `npx openspec validate implement-admin-access-ui --strict`.
- [ ] 4.3 review-gate workflow; disposition the findings in `review-findings.json`.
- [x] 4.4 Smoke against the compose stack: open `http://127.0.0.1:8081/admin`, see the sign-in form, use a wrong password and see the error, use the right one and see the admin home, then sign out and see the form. Evidence: `docs/qa/evidence/slice2-compose-smoke.md`.
- [x] 4.5 Update `docs/current-state.md`.
- [ ] 4.6 Archive; commit with `Slice: implement-admin-access-ui` + `Refs: NFR-6, NFR-9, NFR-13`.
