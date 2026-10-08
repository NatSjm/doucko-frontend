# Phase 6 QA proof (frontend)

## Why

PLAYBOOK Phase 6 / gate G6 asks for clips that ASSERT the FRs they show, an
a11y pass in light and dark (NFR-13), the acceptance artifacts, the eval
ratchet and a vision-verify pass by fresh judges. G7 runs
`check-traceability --release --strict-tests --strict-recordings`, which
failed: 13 frontend-owned MVP FRs (FR-1, FR-2, FR-4, FR-6, FR-7, FR-8, FR-10,
FR-11, FR-13, FR-39, FR-40, FR-41, FR-58) had no recording. The per-slice
recorders covered slices 6–8 and NFR-8 only.

## What Changes

- `e2e/recordings/admin-and-theme.spec.ts` (new): 11 clips that drive and
  assert those FRs against the contract stubs (source upload, PDF beside the
  editor, task images, answer parts / hints / translations, preview and answer
  tester, task list filters and provenance, skin deny-list on HQ, OS light and
  dark theme with no toggle, stats page, flag queue fix / re-evaluate /
  dismiss). Each leaves a settled still.
- `playwright.record.config.ts` (new): Chromium 1280×720, video on, one worker,
  `vite preview` of the build; `playwright.config.ts` ignores `e2e/recordings/`.
- `tools/record-e2e-clips.mjs` (new, `npm run qa:record-e2e-clips`): runs them
  and writes `docs/qa/demo-recordings/phase6-admin-theme/` (video, still,
  explainer, manifest in the `record-demos.mjs` shape); a failed clip is
  `asserted: false` and exits 1.
- Product fix: the mission editor refetches the topic task list after a
  publish, unpublish or refused status change (task rows showed a stale Draft;
  found by vision-verify).
- Evidence: vision-verify over every clip without a verdict, a11y report,
  OPEN correction COR-1 recorded for the slice-1 waiver (owner disposition).

## Capabilities

None changed in the specs: QA tooling and evidence, plus one fix that makes the mission editor match the existing store spec (task statuses shown current).

## Impact

- `qa:verify` unchanged (recording clips are not in the e2e suite).
- `scripts/record-demos.mjs` (installed reference template) is not run: it
  deletes `docs/qa/demo-recordings/` and targets a placeholder home clip; the
  project recorders are `tools/record-*.mjs`.
