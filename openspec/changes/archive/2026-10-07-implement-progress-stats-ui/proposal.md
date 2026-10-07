# Implement progress stats (frontend)

## Why

Slice 9 of the capability plan (`contract/docs/mvp-capability-plan.md` §4.9),
the last MVP slice. Store spec: `progress-stats`
(`npx openspec show progress-stats --type spec --store doucko`). The parent
needs to see whether practice actually happens (the success metric: ≥ 3
sessions of ≥ 10 tasks per week, for 4 weeks) and needs a place to act on the
child's problem reports when the checker was wrong. The frontend owns FR-40
(stats page) and FR-41 (flag queue: fix the answer spec, re-evaluate,
dismiss) of this slice; FR-42 (the attempt log) and the session, week and XP
arithmetic are backend-only, and the UI shows exactly what the server answers.

## What Changes

- New admin screens behind `AdminGate` (English), linked from the admin
  navigation ("Stats", "Flag queue"):
  - `/admin/stats` (`getStats`): the success metric (met / not met, with the
    four completed weeks it reads and the weeks that fell short), a weekly
    table (week starting Monday, sessions, qualifying sessions, answered tasks
    of each session, hints used, revealed tasks; the current week marked), a
    week-count choice (5, 8, 12, 26 or 52 weeks; the default 5 shows the
    current week and all four metric weeks), the first-try rate per topic
    ("75%", "6 of 8 resolved tasks"; "—" when nothing is resolved) and an
    empty state when no practice is recorded.
  - `/admin/reports` (`listReports`, `reevaluateReport`, `dismissReport`): the
    flag queue in the server's order (OPEN first, oldest first) with a status
    filter (All, Open, Fixed, Dismissed). Each report shows the task excerpt
    (link "Open the task to fix its answer" → `/admin/tasks/edit?taskId=…`),
    the reason, the child's note, its status and time and, when an attempt is
    attached, the attempt number (replay marked), hints used, and per answer
    part the raw input in full (wrapped, never truncated), the checker's
    verdict and the re-evaluated verdict with its time. An OPEN report offers
    "Re-evaluate" (only with an attempt) and "Dismiss". The outcome is
    announced: fixed with the XP added (and a mission bonus), fixed on a
    replay attempt with no XP, or nothing changed; a 409 shows the server's
    reason and reloads the queue.
- English catalog keys `admin.nav.stats`, `admin.nav.reports`,
  `admin.stats.*`, `admin.reports.*`.
- Both routes join the route registry, so the a11y (light, dark, reduced
  motion), theme and `⟦` gates cover them signed in with content.
- The shared admin contract stub (`src/test/fake-admin-backend.ts`, with the
  new `src/test/fake-progress-backend.ts`) learns the stats (per-week history,
  first-try counts, the metric over the four completed weeks, `weeks`
  validation) and the flag queue (self-authored reports in every status,
  order, `status` validation, re-evaluation against the task's current answer
  spec with the XP difference, replay attempts awarding nothing, dismiss, the
  409 / 404 / 400 refusals).

## Impact

- Store spec: progress-stats · Contract pin: docs `0168eba` (API 0.5.1, unchanged) · Generated client regenerated: yes (unchanged contract)
- Features: new `src/features/stats` (stats page) and `src/features/reports` (flag queue); `src/features/admin-access` (navigation); `src/i18n/format.ts` (admin dates); `src/app` (routes); `src/i18n/en.ts`; `src/test/fake-admin-backend.ts`, new `src/test/fake-progress-backend.ts`
- No new dependency. No contract change.
- Scope out: the attempt log itself and every figure's arithmetic (backend,
  FR-42, FR-40 rules), charts and exports (excluded by the store spec), admin
  notifications.
