# Doučko — frontend — Agent Rules

React + Vite + TypeScript (strict). Two apps in one bundle: the **child app**
(Czech, no login, "hero academy" skin) and the **admin app** (English,
password-protected). One of three repos: product truth lives in the **docs
store** (`../docs`, OpenSpec store `doucko`, pinned here as the `contract/`
submodule); the API lives in `../backend`.

**This may NOT be the React / Vite / TanStack you know.** Read the docs in
`node_modules/<pkg>/` for the installed versions before using an API.

Requirements: `contract/docs/requirements.md` (until the pin exists:
`../docs/docs/requirements.md`). Which requirements THIS repo owns:
`contract/docs/mvp-capability-plan.md`, table `| Req | Slice | Repo(s) |`.

## Project Handoff Protocol

Before any substantive change read: `docs/current-state.md` (this repo), the
capability plan, the store spec(s) your change cites
(`npx openspec show <cap> --type spec --store doucko`), and
`src/design-system/README.md` for any UI work. Update `docs/current-state.md`
at every milestone (Europe/Prague; keep `Current phase: Phase <N>` /
`Last completed gate: G<N>` exact).

## Delivery harness

Adapted Project Factory — playbook `../docs/factory/PLAYBOOK.md`, gates
`../docs/factory/GATES.md`. Installed here: `scripts/` (gate scripts,
recordings, a11y, evals), `.githooks/`, `.claude/agents/`,
`.claude/workflows/`, `factory.config.json`. Never hand-edit installed files
— change `../docs/factory/` and run `npm run factory:install`.

```bash
npm run qa:verify        # battery: lint, typecheck, unit+coverage, e2e, evals, build, recordings, acceptance, OpenSpec
npm run gate:status      # G0–G8
npx openspec doctor      # reference doucko must be ok
```

The Vite scaffold must add these npm scripts (the battery names them; until
they exist they render MISSING, never PASS): `lint`, `typecheck`,
`test:run`, `test:coverage` (Vitest, `json-summary` reporter), `test:e2e`
(Playwright), `build`.

## OpenSpec here

- Changes: `openspec/changes/implement-<capability>-ui/` from
  `../docs/factory/templates/openspec/change.frontend.md`.
- Product specs are NOT copied here — `references: [doucko]`; fetch with
  `npx openspec show <spec> --type spec --store doucko`.
- An API change is a docs-store change first, then bump `contract/` and
  regenerate the client.

## Module conventions

- Feature folders `src/features/<domain>/` (child: `hq`, `mission`, `task`;
  admin: `sources`, `tasks`, `missions`, `stats`); app shell in `src/app/`.
- API only through the generated client `src/api/generated/` (from
  `contract/api/openapi.yaml`) + TanStack Query. Generated code is never
  hand-edited (NFR-12).
- All UI strings externalized (NFR-9): child UI Czech, admin UI English.

## UI and design system

- All UI is built with `src/design-system/` (Doučko "Hero Pop"). **Read
  `src/design-system/README.md` before any UI work.** It holds the voice,
  colour, type and component rules.
- Use its components first (`import { … } from '@/design-system'`). For your
  own styles, use only its CSS variables (`var(--hero)`, `var(--space-5)`,
  `var(--radius-lg)`): no raw hex, px or font values.
- It must work for many subjects. Never hardcode maths or a subject colour.
  Subjects come from `SUBJECTS` and `--subject-<key>`.
- The child UI is Czech; only task text is translated (`lang` set on the
  translated block). The admin UI is English.
- A wrong answer uses `almost` (orange) with the copy "Skoro! Zkus to
  znovu." It is never red and never mocking. Nothing may use timers or
  remove XP.
- Keep WCAG AA contrast and a visible focus ring, and respect
  `prefers-reduced-motion`. The task screen must work by keyboard, with
  Enter submitting.
- Don't change files inside `src/design-system/` as part of a feature.
  Changes to the system go to the design-system artifact first, then get
  copied in. (The harness treats it as vendored: excluded from product-code
  detection, lint hooks and trailer rules.)
- IP rule: no characters, names, logos or terms from existing manga or anime.

## Test-first

Tests are written from the spec and seen RED before implementation, then made
GREEN; never weakened. Annotate with `// @trace FR-x` (only ids this repo
owns); regressions `// @trace BUG-n`. Unit: Vitest `*.test.ts(x)` next to
code. E2E: Playwright `e2e/*.spec.ts` against `docker compose up`. Evals:
`evals/cases/*.eval.ts` (rubric-graded by a fresh judge). Recordings:
`scripts/record-demos.mjs` — every clip asserts the FRs it shows.

## Never commit

Workbook content — text, images, answer keys, PDFs (NFR-4); the child's name,
photos or PII (NFR-3) in code, fixtures, screenshots or recordings; `.env`
files or secrets (every `VITE_*` variable is public). Self-authored PDF
fixtures go under `fixtures/self-authored/`.

## Environment notes

- Windows dev machine (PowerShell / Git Bash); Node ≥ 20.
- Commits touching `src/` (outside `src/design-system/`) need a
  `Slice: <change-id>` or `Refs: FR-x` trailer (commit-msg hook).

<!-- BEGIN-FACTORY-LESSONS -->
<!--
  Managed region: `npm run factory:install` upserts cross-project lesson
  blocks here (BEGIN-LESSON-<id> / END-LESSON-<id>). Manual edits inside a
  lesson block are preserved. Do not remove these outer markers.
-->
<!-- BEGIN-LESSON-vacuous-pass-not-earned -->
### Lesson: a PASS over zero evidence is NOT-EARNED (vacuous-pass-not-earned, v1)

- Never report a gate or check as PASS when its evidence scope is 0 ("Scope: 0
  clip(s)", empty archive, no eval results) while product code exists (Doučko:
  `factory.config.json` productCode — backend `src/main/`, frontend `src/`
  minus `src/design-system/`). Render it **NOT-EARNED**
  and exit non-zero.
- Before product code exists, an empty scope is **SKIP-pending**: print it
  explicitly; it is visible and never counted as PASS.
- Never fold SKIP / 0-scope results into an overall "Pass" summary
  (`qa-verify`, `gate-status`). Field evidence: `worst()` folded SKIP into
  PASS and G4–G8 rendered green over literally nothing
  (2026-07-02-pixel-perfect-forensics.md, RC2).
<!-- END-LESSON-vacuous-pass-not-earned -->
<!-- BEGIN-LESSON-declared-method-needs-mechanism -->
### Lesson: a declared acceptance method needs an executable mechanism (declared-method-needs-mechanism, v1)

- Every FR/NFR that declares a verification method (pixel-diff, e2e,
  recording, a11y, eval, ...) must resolve to a real, executable, non-stub
  mechanism BEFORE the build phase starts: an installed check script, or a
  package.json script whose body does not match
  `/^echo |^true$|not yet configured/i`.
- A spec file that restates the requirement is NOT a mechanism. Field
  evidence: NFR-19 encoded "≥ 99% pixel match" while no pixel-diff tool
  existed anywhere and `test:e2e` was an echo stub exiting 0
  (2026-07-02-pixel-perfect-forensics.md, RC1).
- If a declared method has no mechanism, do not proceed: implement the check,
  or record an explicit human waiver — never let the declaration float
  unverifiable into the build.
<!-- END-LESSON-declared-method-needs-mechanism -->
<!-- BEGIN-LESSON-done-claims-need-evidence -->
### Lesson: done-claims need evidence pointers (done-claims-need-evidence, v1)

- Never write strong completion language ("Convergence reached", "all gates
  pass", "verification-only", "Overall result: Pass", "ready for release /
  sign-off", "done", "complete") into current-state.md, PR bodies, or handoff
  docs unless the same line carries a resolvable evidence pointer — a path
  that exists on disk (e.g. `docs/qa/automated-verification-latest.md`) and
  is fresh — or an explicit "Scope NOT delivered" section.
- The verdict belongs to exit-coded checks, not narrative. Field evidence:
  "Convergence reached … verification-only" was written while the same file
  admitted the formal acceptance was never run
  (2026-07-02-pixel-perfect-forensics.md, RC6).
- When you catch an unbacked claim, treat it as a correction event: file it,
  do not silently rewrite it.
<!-- END-LESSON-done-claims-need-evidence -->
<!-- END-FACTORY-LESSONS -->
