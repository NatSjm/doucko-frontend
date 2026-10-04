# platform-foundation Specification

## Purpose
The frontend's platform foundation: what every later screen relies on. The theme follows the
operating system; all UI text comes from the message catalogs; every screen is accessible in both
schemes and works in Chrome, Edge and Firefox; fixtures and skin assets have recorded provenance; e2e
evidence never shows the child's real name; the API client is generated from the pinned contract; and
the image serves the app and the API behind one origin with its security headers and DNS-rebinding
guard. Product behaviour lives in the docs store (`doucko`); this spec covers this repository's part.

## Requirements

### Requirement: Theme follows the operating system

The app SHALL show the light theme when the OS asks for light and the dark
theme when it asks for dark, and SHALL offer no in-app theme toggle (FR-58;
store spec gamification, "Light and dark theme"). No app source outside the
vendored design system SHALL set `data-theme` or a colour scheme, declare or
name a CSS custom property to write it, or name a scheme (`dark`, `light`,
`theme…`) in a string literal; the message catalogs are text, not code, and
are exempt from the last rule. "Any
route" includes the not-found screen.

#### Scenario: Dark OS

- **GIVEN** the browser reports `prefers-color-scheme: dark`
- **WHEN** any route is opened
- **THEN** the page background is the dark theme's `--paper` colour

#### Scenario: Light OS

- **GIVEN** the browser reports `prefers-color-scheme: light`
- **WHEN** any route is opened
- **THEN** the page background is the light theme's `--paper` colour

#### Scenario: No toggle

- **WHEN** every button, switch, checkbox, radio, tab, option, pressed toggle, disclosure or select on a route is activated
- **THEN** no element gets `data-theme` and the background stays the OS theme's `--paper`; a route with no control reports the check as skipped, never passed, and the static source check covers it

### Requirement: Externalized UI strings

Every visible string and accessible name SHALL come from a message catalog:
Czech for the child UI and English for the admin UI (NFR-9). A lint rule
SHALL refuse literal UI text that it can see in `src/` (JSX, props, nested
collections, call arguments, callback returns, shown field values, the
document title). Text reached through a variable, another module or a state
the first render does not show is out of the rule's reach; the
pseudo-catalog render covers what the registered routes render once
settled, and each later slice's tests cover its own states.

#### Scenario: Pseudo-catalog render

- **GIVEN** a catalog in which every value is wrapped as `⟦…⟧`
- **WHEN** `App` renders every route in the route registry, and an unregistered path, with it
- **THEN** every visible text node, text attribute, shown field value and the document title consists only of whole `⟦…⟧` segments, digits and punctuation

#### Scenario: Literal text is a lint error

- **WHEN** a component in `src/` contains `<h1>Doučko</h1>`, `aria-label="Zavřít"`, `{ok ? 'Hotovo' : t('x')}`, a template literal with letters, or `<Icon label="Hotovo" />`
- **THEN** `npm run lint` reports `doucko/no-literal-ui-text` as an error

### Requirement: Accessible in light and dark

Every route, and the not-found screen, SHALL have no serious or critical
axe-core (WCAG 2 A/AA) violation in either colour scheme (NFR-13).

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
`self-authored` with an author. Every skin asset, every image, font, audio,
video, PDF, office or plain-text data file anywhere in the repository, and
every JSON, Markdown or YAML data file under `src/` (outside the vendored
design system) or `e2e/`, SHALL be listed as
`self-authored` or `licensed: <SPDX id>`, with its licence file (same
origin and author) listed beside it (NFR-4, CA-D21).

#### Scenario: Unlisted asset fails

- **GIVEN** a file under `fixtures/`, `e2e/fixtures/`, `evals/cases/`, `public/`, `src/assets/`, `src/design-system/fonts/` or `src/design-system/icons/`, or a media, document or data file anywhere else as above, that the manifest does not list (only `contract/`, which the docs store checks, and the media files a `docs/qa/**/manifest.json` lists as recordings are exempt)
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
origin, forwarding the original `Host` and the connecting client address
(never a client-supplied `X-Forwarded-For`), and SHALL find a recreated
backend container without a restart. Only `localhost` and IPv4 address hosts
SHALL be served; any other `Host` gets 421 (DNS rebinding). `/index.html` and
a trailing slash resolve to the registered route. A path that is
not a built file SHALL get the SPA, except under `/assets/`, where a missing
file is 404; the SPA shell is never cached. Every response SHALL carry `X-Content-Type-Options: nosniff`,
`Referrer-Policy: no-referrer` and a Content-Security-Policy with
`script-src 'self'`, `object-src 'none'` and `frame-ancestors 'none'`, and
no server version. Base images SHALL be pinned by digest.

#### Scenario: API through the frontend origin

- **WHEN** `/api/child/nope` is requested from the frontend port
- **THEN** the answer is the backend's 404 problem+json, with the security headers

#### Scenario: Missing asset

- **WHEN** `/assets/missing.js` is requested
- **THEN** the answer is 404, not the SPA page

#### Scenario: Foreign host name

- **WHEN** `/api/health` is requested with `Host: evil.example`
- **THEN** the answer is 421 and the backend is not reached

#### Scenario: Spoofed client address

- **WHEN** a request to `/api/` carries `X-Forwarded-For: 6.6.6.6`
- **THEN** the backend receives the connecting address, not 6.6.6.6
