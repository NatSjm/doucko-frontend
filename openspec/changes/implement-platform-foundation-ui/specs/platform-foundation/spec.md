## ADDED Requirements

### Requirement: Theme follows the operating system

The app SHALL show the light theme when the OS asks for light and the dark
theme when it asks for dark, and SHALL offer no in-app theme toggle (FR-58;
store spec gamification, "Light and dark theme").

#### Scenario: Dark OS

- **GIVEN** the browser reports `prefers-color-scheme: dark`
- **WHEN** any route is opened
- **THEN** the page background is the dark theme's `--paper` colour

#### Scenario: Light OS

- **GIVEN** the browser reports `prefers-color-scheme: light`
- **WHEN** any route is opened
- **THEN** the page background is the light theme's `--paper` colour

#### Scenario: No toggle

- **WHEN** every button, switch, checkbox, radio, select or menu toggle on a route is activated
- **THEN** `<html>` never gets `data-theme` and the background stays the OS theme's `--paper`

### Requirement: Externalized UI strings

Every visible string and accessible name SHALL come from a message catalog:
Czech for the child UI and English for the admin UI (NFR-9). A lint rule
SHALL refuse literal UI text in `src/`.

#### Scenario: Pseudo-catalog render

- **GIVEN** a catalog in which every value is wrapped as `⟦…⟧`
- **WHEN** `App` renders every route in the route registry, and an unregistered path, with it
- **THEN** every visible text node, text attribute and the document title consists only of whole `⟦…⟧` segments (with whitespace, digits or punctuation between them)

#### Scenario: Literal text is a lint error

- **WHEN** a component in `src/` contains `<h1>Doučko</h1>`, `aria-label="Zavřít"`, `{ok ? 'Hotovo' : t('x')}`, a template literal with letters, or `<Icon label="Hotovo" />`
- **THEN** `npm run lint` reports `doucko/no-literal-ui-text` as an error

### Requirement: Accessible in light and dark

Every route SHALL have no serious or critical axe-core (WCAG 2 A/AA)
violation in either colour scheme (NFR-13).

#### Scenario: axe on every route

- **WHEN** the a11y e2e runs on each route in light and in dark
- **THEN** it reports zero serious or critical violations

#### Scenario: Reduced motion

- **GIVEN** the browser reports `prefers-reduced-motion: reduce`
- **WHEN** a route has loaded (network idle) and again 500 ms later
- **THEN** no animation with a duration is running or pending

### Requirement: Supported browsers

The e2e suite SHALL run in Chrome, Edge and Firefox at a 1280×720 viewport (NFR-6).

#### Scenario: Smoke in three browsers

- **WHEN** `npm run test:e2e` runs
- **THEN** the shell smoke passes in the `chromium`, `msedge` and `firefox` projects

### Requirement: Provenance of fixtures and skin assets

Every fixture file SHALL be listed in `fixtures/PROVENANCE.md` as
`self-authored` with an author. Every skin asset, and every image, font,
audio, video or PDF file anywhere in the repository, SHALL be listed as
`self-authored` or `licensed: <SPDX id>`, with its licence file (same
origin and author) listed beside it (NFR-4, CA-D21).

#### Scenario: Unlisted asset fails

- **GIVEN** a file under `fixtures/`, `e2e/fixtures/`, `evals/cases/`, `public/`, `src/assets/`, `src/design-system/fonts/` or `src/design-system/icons/`, or a media or PDF file anywhere else, that the manifest does not list
- **WHEN** the provenance test runs
- **THEN** it fails and names the file

#### Scenario: Licensed asset without its licence

- **GIVEN** a `licensed:` asset with no licence file of the same origin and author listed beside it
- **WHEN** the provenance test runs
- **THEN** it fails and names the asset

### Requirement: No real name in e2e evidence

E2E runs and recordings SHALL use a fictional display name, and a page that
shows the real one (`DOUCKO_CHILD_DISPLAY_NAME`) SHALL fail the run without
the failure message repeating it (NFR-3). The guard SHALL run after every
e2e test, and against a running stack the variable SHALL be required.

#### Scenario: Real name on a page

- **GIVEN** `DOUCKO_CHILD_DISPLAY_NAME` is set
- **WHEN** an e2e page's text contains that value
- **THEN** `expectNoRealName` fails the test, and the error does not contain the name

#### Scenario: Guard not configured against a stack

- **GIVEN** `E2E_BASE_URL` is set and `DOUCKO_CHILD_DISPLAY_NAME` is not
- **WHEN** the guard runs
- **THEN** it fails the test

### Requirement: Client generated from the pinned contract

The API types SHALL be generated from the pinned `contract/api/openapi.yaml`
by `typecheck` and `build`, never edited by hand, and the image build SHALL
stop when the pinned contract is missing (NFR-12).

#### Scenario: Every contract path is generated

- **WHEN** the contract-client test runs
- **THEN** every path of the pinned contract is a key of the generated `paths` type

#### Scenario: Image build without the contract

- **GIVEN** a build context without `contract/api/openapi.yaml`
- **WHEN** the frontend image is built
- **THEN** the build fails before `npm run build`

### Requirement: Served behind one origin

The image SHALL serve the SPA and proxy `/api/` to the backend on the same
origin, forwarding the original `Host` and client address. A path that is
not a built file SHALL get the SPA, except under `/assets/`, where a missing
file is 404. Every response SHALL carry `X-Content-Type-Options: nosniff`,
`Referrer-Policy: no-referrer` and a Content-Security-Policy with
`script-src 'self'`, `object-src 'none'` and `frame-ancestors 'none'`, and
no server version. Base images SHALL be pinned by digest.

#### Scenario: API through the frontend origin

- **WHEN** `/api/child/nope` is requested from the frontend port
- **THEN** the answer is the backend's 404 problem+json, with the security headers

#### Scenario: Missing asset

- **WHEN** `/assets/missing.js` is requested
- **THEN** the answer is 404, not the SPA page
