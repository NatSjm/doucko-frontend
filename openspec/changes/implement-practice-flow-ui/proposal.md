# Implement practice flow (frontend)

## Why

Slice 7 of the capability plan (`contract/docs/mvp-capability-plan.md` §4.7).
Store spec: `practice-flow` (`npx openspec show practice-flow --type spec --store doucko`),
with `answer-checking` (UNPARSEABLE costs nothing, format tips) and
`child-profile` (the translation setting). The child needs to open the app,
see her missions on HQ and practise their tasks: two attempts, then a
reveal, hints, the Ukrainian translation, "report a problem", and every
step saved on the server so she can stop and resume. The frontend owns
FR-22, FR-24, FR-25, FR-26, FR-27, FR-28, FR-29, FR-30, FR-31, NFR-5 (task
screen load and check round trip, e2e timing test) and NFR-7 (2 clicks to a
task, Enter submits) of this slice, plus a frontend e2e on HQ for FR-12's
child-facing scenario carried over from slice 6 (HQ lists only served
missions; FR-12 stays owned by the backend, the e2e traces the FR-25
scenario "Unpublished content is invisible").

## What Changes

- New child screens (Czech, no login), registered in the route registry:
  - `/` — **HQ** (`getHq`): greeting with the profile's display name, a
    "Pokračovat" button to the continue target (hidden when none), missions
    grouped by topic and ordered by position, each with `x/N vyřešeno` and
    its state (new, in progress, complete); an empty state; load error with
    retry. Replaces the slice 1 placeholder shell.
  - `/mission?missionId=…` — **mission briefing** (`getMissionBriefing`):
    topic, mission number, progress, the task list with states, and the
    start button ("Začít misi" / "Pokračovat v misi"); unknown or draft
    mission → "Tuhle misi jsem nenašel." with a button back to HQ.
  - `/task?missionId=…[&taskId=…]` — **task screen** (`getCurrentTask`,
    `getTask`, `submitAttempt`, `openNextHint`, `reportProblem`,
    `getProfileSettings`, `updateProfileSettings`, images through
    `getChildImage` URLs): prompt, images, one input per part (typed or
    choice), all parts submitted together with Enter or "Odeslat", empty-part
    check before sending, the attempt indicator, wrong parts in `almost` with
    "Skoro! Zkus to znovu.", locked correct parts, the reveal after the
    second wrong attempt ("Nevadí, příště!", neutral styling), format tips
    for unreadable input with the attempt kept (FR-22), "Výborně!" with
    `+n XP` when the server awards XP, "Další úloha"; hints one at a time
    with the remaining count; the "Zobrazit ukrajinsky" toggle stored in the
    profile; "Nahlásit problém" with the three reasons and the note rule;
    the state restored from the server on reload; a failed submission keeps
    the inputs and re-reads the stored state before the next send (FR-31).
- Client-side navigation between child screens (history API, `Link`), so a
  task opens without a full page load (NFR-5); admin screens keep full page
  loads.
- Czech `child.*` catalog keys; the three child routes join the a11y gate
  (light, dark, reduced motion), the theme e2e and the `⟦` render test
  against the contract stub.
- The shared contract stub (`src/test/fake-admin-backend.ts`) answers the
  child endpoints (`src/test/fake-child-backend.ts`) with a self-authored
  practice seed, the 404/409/400/413 refusals of the store spec, and hooks
  for a dropped connection and a lost response.
- E2E per FR (chromium, msedge, firefox at 1280×720), the NFR-5 timing test
  (stack-only, skips without `E2E_BASE_URL`), asserted recordings with
  stills for the visual review.

## Impact

- Store spec: practice-flow (+ answer-checking, child-profile) · Contract pin: docs `0168eba` (API 0.5.1) · Generated client regenerated: yes (unchanged contract)
- Features: `src/features/child` (new: child client, layout, navigation-aware links), `src/features/hq` (new), `src/features/mission` (new), `src/features/task` (task screen; the shared `TaskView` of the admin preview is unchanged)
- App shell: `src/app` (navigation, routes; `Shell.tsx` placeholder removed)
- No new dependency.
- Scope out: XP and rank display on HQ, the mission-complete screen and
  replay (slice 8, FR-32/FR-33); the attempt log and the tutor seam are
  backend-only (FR-42, FR-44).
