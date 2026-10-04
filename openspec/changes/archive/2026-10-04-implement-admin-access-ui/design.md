# Design — implement-admin-access-ui

## Goals / Non-goals

Goals: the admin-access scenario "Admin UI shows sign-in without a session",
plus the UI half of sign-in, sign-out, CSRF and idle expiry ("the admin UI
shows the sign-in form" after a 401). Non-goals: any admin feature screen
(slices 5, 6, 9), and returning to the originally requested admin page (the
spec's non-normative note).

## Screens and states

`/admin` → `AdminGate`:
- **checking**: a polite status line ("Checking your session…").
- **signed out** (401): `SignInForm`. The heading is "Admin sign-in", with one
  labelled password field, "Sign in" as the submit button, and Enter submits.
  - On 401: "That password is not correct." in a `role="alert"` line. The
    field keeps focus and is cleared. Each failed attempt renders a new alert
    node, so a repeated identical message is announced again.
  - On another failure: "Sign-in failed. Check that the server is running and
    try again."
- **signed in** (204): `AdminHome`. The heading is "Admin", with the line
  "You are signed in." and a "Sign out" button. The button is disabled while
  the request runs.
  - Sign-out answered 401: the session had already ended, so the form is shown.
  - Any other failure (no server, a refused CSRF token, a 5xx): the home stays,
    with the alert "Sign-out failed. Reload the page and try again."
- **unreachable** (network error or unexpected status): an alert with
  "Could not reach the server." and a "Try again" button.

## Design-system mapping

`Button` (`primary` for submit, `secondary` for sign-out and retry),
`.dk-input` for the field, `.dk-t-title` for headings, and `.app-shell` for
the layout. No raw colours.

## Data flow

- `adminClient = createClient<paths>({ baseUrl: window.location.origin })`
  with middleware. On a request whose method is not GET or HEAD, it copies the
  `XSRF-TOKEN` cookie into `X-XSRF-TOKEN`. On a 401 from `/api/admin/` other
  than sign-in, it notifies the subscribers of `onAdminUnauthorized`.
- TanStack Query key `['admin', 'session']`: `true`, `false` or an error. A
  sign-in success or a sign-out sets the key. An admin 401 sets it to `false`.

## Copy

English, `admin.*` keys in `src/i18n/en.ts`, sentence case.

## Accessibility

The admin subtree carries `lang="en"`. The field has a visible `<label>` and
`autocomplete="current-password"`. Errors use `role="alert"`. The
keyboard-only path is Tab to the field, type, then Enter. The surface stays in
the a11y gate in light and dark, and reduced motion adds no animation.

## Risks and mitigations

- No backend under `vite preview`: the e2e fixture stubs `/api/` when
  `E2E_BASE_URL` is unset (session 401). Against a stack, the real backend
  answers.
