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

- **WHEN** any route is rendered
- **THEN** no control on it switches between light and dark

### Requirement: Externalized UI strings

Every visible string and accessible name SHALL come from a message catalog:
Czech for the child UI and English for the admin UI (NFR-9). A lint rule
SHALL refuse literal UI text in `src/`.

#### Scenario: Pseudo-catalog render

- **GIVEN** a catalog in which every value is prefixed with `⟦`
- **WHEN** every route in the route registry is rendered with it
- **THEN** every visible text node and accessible name starts with `⟦`

#### Scenario: Literal text is a lint error

- **WHEN** a component in `src/` contains `<h1>Doučko</h1>` or `aria-label="Zavřít"`
- **THEN** `npm run lint` reports `doucko/no-literal-ui-text`

### Requirement: Accessible in light and dark

Every route SHALL have no serious or critical axe-core (WCAG 2 A/AA)
violation in either colour scheme (NFR-13).

#### Scenario: axe on every route

- **WHEN** the a11y e2e runs on each route in light and in dark
- **THEN** it reports zero serious or critical violations

### Requirement: Supported browsers

The e2e suite SHALL run in Chrome, Edge and Firefox at a 1280×720 viewport (NFR-6).

#### Scenario: Smoke in three browsers

- **WHEN** `npm run test:e2e` runs
- **THEN** the shell smoke passes in the `chromium`, `msedge` and `firefox` projects

### Requirement: Provenance of fixtures and skin assets

Every fixture file SHALL be listed in `fixtures/PROVENANCE.md` as
`self-authored` with an author. Every skin asset SHALL be listed as
`self-authored` or `licensed: <SPDX id>`, with its licence file listed too
(NFR-4, CA-D21).

#### Scenario: Unlisted asset fails

- **GIVEN** a file under `fixtures/`, `e2e/fixtures/`, `src/design-system/fonts/` or `src/design-system/icons/` that the manifest does not list
- **WHEN** the provenance test runs
- **THEN** it fails and names the file

### Requirement: No real name in e2e evidence

E2E runs and recordings SHALL use a fictional display name, and a page that
shows the real one (`DOUCKO_CHILD_DISPLAY_NAME`) SHALL fail the run (NFR-3).

#### Scenario: Real name on a page

- **GIVEN** `DOUCKO_CHILD_DISPLAY_NAME` is set
- **WHEN** an e2e page's text contains that value
- **THEN** `expectNoRealName` fails the test
