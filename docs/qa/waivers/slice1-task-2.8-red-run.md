# Waiver: slice 1 frontend, task 2.8 (recorded RED run of the original tests)

Status: closed (slice 1 archived 2026-10-04)
Scope: process step only. It waives no requirement and no acceptance method; this file deliberately
names no requirement id, because an open waiver suppresses the ids it names.
Change: `implement-platform-foundation-ui`, task 2.8 "Run them and confirm RED on assertions".
Granted by: project owner (project owner), 2026-10-04 (Europe/Prague), in the Claude Code session.

## What is waived

The test-first rule requires each test to be seen failing on its assertions before the code that
makes it pass. For the original slice-1 frontend tests (tasks 2.1–2.7) no failing run was recorded.
It cannot be recorded truthfully now that the implementation exists; a re-run with the code removed
would be a re-enactment, not the original evidence.

## Why it is acceptable

- The tests added for the first review round's fixes were run RED before the fixes
  (`docs/qa/evidence/slice1-review-fixes.md`). Tests added in later rounds were not all recorded RED;
  most carry known-bad cases that fail without the fix, which is the same proof in the test itself.
- The original tests have been green, reviewed and strengthened over ten review rounds, and several
  carry negative controls that prove they can fail (for example the coverage check's own
  uncovered-text cases, the lint rule's invalid cases, the theme guard's known-bad cases).
- `npm run qa:verify` passes (`docs/qa/automated-verification-latest.md`).

## Follow-up

From slice 2 on, the RED run is recorded at the time (task "confirm RED on assertions" with its output
saved under `docs/qa/evidence/`). This waiver stays specific to slice 1 and is closed when the slice
is archived.
