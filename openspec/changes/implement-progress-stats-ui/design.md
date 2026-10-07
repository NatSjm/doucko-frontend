# Design — implement-progress-stats-ui

## Goals / Non-goals

Goals: the admin half of progress-stats — a stats page that answers "does
practice happen, and is the success metric met?" at a glance, and a flag
queue where a wrong answer key can be found, fixed in the task editor, and the
reported attempt re-evaluated or the report dismissed. English, dense admin
type, every word from the `en` catalog.

Non-goals: computing any figure. Sessions, qualifying sessions, week
boundaries (Europe/Prague), hints and reveals per week, first-try counts and
`metricMet` come from `getStats`; verdicts, XP and the report status after an
action come from `reevaluateReport` / `dismissReport`. The UI never derives
the metric verdict from the weeks it shows and never adds up XP.

### Store-spec scenarios: slice 9 UI vs elsewhere

| Requirement (store) | Slice 9 UI (this change) | Elsewhere |
|---|---|---|
| Attempt log contents | the attached attempt on a report: raw input per part exactly as served (U+00A0 kept), attempt number, replay marker, hints used, time | backend: what is logged (FR-42), UNPARSEABLE not logged |
| Attempt log is append-only | Re-evaluation keeps the original verdict: both verdicts, each with its own time, on a FIXED report | backend: never edited |
| Session definition | each week's sessions, qualifying sessions and session sizes as served (20/35/30-minute gaps, week boundary) | backend: the arithmetic |
| Weekly hint and reveal figures | hints used and revealed tasks per week as served | backend: the arithmetic |
| Practice statistics page | First-try rate per topic ("75%", "6 of 8"), Topic with no resolved tasks ("—"), Success metric met / not met (the short week marked with its 2 qualifying sessions), Current week does not count (the current week is not a metric week), Less than 4 completed weeks (not met, no error), No data yet (zeros, not met, empty-state message), a week-count choice | backend: Default week count, boundaries, 400 on 0/53/abc/٤/empty (the UI only ever sends 5, 8, 12, 26 or 52) |
| Flag queue | Report appears in the queue (task, reason, raw `0,5`, `WRONG`), Report without an attempt (dismiss, no re-evaluate), Long raw input shown in full (wrapped, no ellipsis, no page scroll), Queue order (as served), Filter by status | backend: order, 400 on `FOO`/`fixed`/empty (the UI only sends the three values) |
| Re-evaluation of a reported attempt | the outcome line: fixed with "+4 XP", fixed with a mission bonus, replay attempt fixed with no XP, nothing changed (report stays open), 409 shown with the server's reason | backend: the XP difference, mission completion, rank-up for HQ |
| Dismissing a report | Dismiss (the report becomes Dismissed), 409 shown | backend: nothing else changes |
| Report id handling | — (ids come from the server) | backend: 400 / 404 |
| Stats and flag queue are admin-only | both screens behind `AdminGate`; a 401 shows the sign-in form; the CSRF header on re-evaluate and dismiss (admin client); Child UI has no stats (no link on child screens) | backend: 401 before 400, 403 without CSRF |

## Screens and states

- `/admin/stats` — `AdminLayout` "Practice statistics".
  - **Success metric panel** (`Panel`, region "Success metric"): a chip
    "Met" (`spark`, `check` icon) or "Not met" (`almost`), the rule "At least
    3 sessions of 10 or more tasks in each of the 4 completed weeks before this
    week.", and, when not met, "Short weeks: {weeks}" naming the metric weeks
    held in the response with fewer than 3 qualifying sessions. With the
    default 5 weeks every metric week is in the response; the UI names no
    week it does not have, and the verdict is always `metricMet`.
    With no practice recorded at all (no activity in the weeks shown and no
    resolved task in any topic) the empty-state message speaks and no week
    is singled out as short; practice older than the weeks shown is not the
    empty state (review F07).
  - **Week count** (`select`, "Weeks shown"): 5 (default), 8, 12, 26, 52.
    Changing it refetches; the previous figures stay while loading.
  - **Weekly table** (caption "Weekly practice", newest week first): Week
    ("2026-10-05", plus "This week" on the last served entry and "Metric week"
    on the four before it), Sessions, Qualifying sessions (10+ tasks), Tasks
    per session ("12, 10, 11"; "—" without sessions), Hints used, Revealed
    tasks. A metric week with fewer than 3 qualifying sessions gets a "Short"
    chip (`almost`) in its qualifying cell.
  - **First-try rate per topic** table: Topic (`data-content`, `lang="cs"`),
    First-try rate ("75%", rounded to a whole percent; "—" when `resolved` is
    0), Resolved tasks ("6 of 8 first try"; "None yet").
  - **Empty state**: when every served week has 0 sessions, 0 hints and 0
    reveals and no topic has a resolved task, "No practice recorded yet. The figures fill in as the child
    answers tasks." above the (zero) table; no error.
  - Loading / error: `LoadState` (status line; alert with "Try again").
- `/admin/reports` — `AdminLayout` "Flag queue".
  - **Filter** (`select`, "Status"): All, Open, Fixed, Dismissed (the
    contract's exact values). Changing it refetches with `?status=` (none for
    All).
  - **Outcome line** (`role="status"`, focused after an action): the result
    of the last action, naming the task excerpt.
  - **Report list** (`ol`, "Reports"), one `article` per report, labelled by
    its task excerpt: status chip (Open `hero`, Fixed `spark`, Dismissed
    `neutral`), "Reported {time}", the task excerpt (`data-content`,
    `lang="cs"`) and the link "Open the task to fix its answer"; "Reason:
    {reason}" (Answer is correct / Prompt is unclear / Other); "Note: {note}"
    (`data-content`, `lang="cs"`) when there is one. Attempt block:
    "Attempt {n}" (+ "Replay attempt" chip), "Hints used: {n}", "Submitted
    {time}", and a table per part: Part (key), Raw input (in full,
    `white-space: pre-wrap`, `overflow-wrap: anywhere`, `data-content`; a part
    locked as correct on attempt 1 has no raw input on attempt 2: "Not
    re-entered: correct on attempt 1"),
    Checker verdict (chip), Re-evaluated verdict (chip and its time, or "—").
    Without an attempt: "No attempt attached: the child reported before
    answering." Actions for an OPEN report: "Re-evaluate" (only with an
    attempt) and "Dismiss"; all actions disabled while one runs.
  - **Outcomes**: `changed` with `xpAwarded > 0` → "Fixed: the attempt is
    now correct. +{xp} XP added for the child." (and "+{bonus} XP mission
    bonus." when `bonusXp > 0`); `changed` on a replay attempt → "Fixed: the
    replay attempt is now correct. Replay attempts earn no XP."; `changed`
    otherwise with 0 XP → "Fixed: the attempt is now correct. No XP added.";
    not `changed` → "Nothing changed for “{task}”: under the current
    answer spec the re-evaluation does not improve the outcome. The report
    stays open." (neutral: `changed: false` also covers an attempt already
    correct or an outcome already as good); dismiss → "Report on “{task}”
    dismissed."; a 409 → the server's `detail` (or "This report was already
    handled.") as an alert that takes focus (the pressed button may be gone)
    and the queue reloads; other failures → the common action-failed alert,
    focused. A failed reload keeps the queue shown with "Could not refresh
    this. What is shown may be out of date." and a retry (review F01, F05).
  - Empty: "No reports." / "No reports with this status."

## Design-system mapping

`Panel`, `Button`, `Chip` from `@/design-system`; admin classes
`admin-table`, `admin-table-wrap`, `admin-actions`, `admin-field`,
`admin-control`, `admin-muted`, `admin-alert`, `admin-ok`, `admin-numeric`.
New CSS in `src/features/stats/stats.css` and
`src/features/reports/reports.css`, tokens only. Verdicts follow the status
palette: correct `spark` with `check`, wrong `almost` with `retry`, always
icon plus word, never red.

## Data flow

- Query keys: `['admin','stats',weeks]` (`getStats` with `weeks` as the
  string the contract declares), `['admin','reports',status|'ALL']`
  (`listReports`).
- `reevaluateReport` / `dismissReport`: POST through the admin client (CSRF
  header); then invalidate `['admin','reports']` and `['admin','stats']` (a
  re-evaluation can change the first-try rate). The page keeps the outcome
  line in local state.
- A 401 anywhere returns to the sign-in form (admin client, slice 2).
- Dates are numeric ISO 8601 (`src/i18n/format.ts`: `adminDate`,
  `adminDateTime`): week starts (`format: date`) as served, never shifted;
  times "2026-10-05 16:20" in Europe/Prague (the spec's week zone), 24 h. They
  read the same in every browser (no "Sep"/"Sept" drift) and carry no words
  outside the catalog, so the `⟦` gate needs no exception.

## Assumed backend behaviour

The contract defines the shapes; the UI relies on: `weeks` oldest first with
the current week last (contract); `metricMet` independent of `weeks`;
`tasksPerSession.length === sessions`; `firstTryRateByTopic` lists every
topic with a published task (`resolved` 0 → "—"); reports already ordered
(OPEN first, oldest first), so the UI does not re-sort; `rawInput` values are
strings or string arrays (choice) per part key, and `verdicts` /
`reevaluation.verdicts` use the same keys; a part locked as correct on attempt 1 is absent from attempt 2's `rawInput` but has its verdict
(backend note, 2026-10-07); `changed: false` leaves the report
OPEN and the response's `report` is the current report; a 409 carries a
`detail`. The contract stub follows the same rules. The backend half's notes
(`scratch/slice9-backend-behaviour.md`, 2026-10-07) confirm each of them and
add: `weeks` absent is 4 and anything but ASCII 1–52 is 400 (the UI sends
only its choices); FIXED and DISMISSED reports follow the OPEN ones mixed,
oldest first; `taskPromptExcerpt` is the first 80 code points of the current
prompt plus "…"; `firstTryRateByTopic` lists topics with a published TEXT
task (the stub lists every reference topic — the UI renders whatever is
served); a 409 for a handled report or a report without an attempt. Later
differences found in the backend half's notes (`scratch/slice9-backend-behaviour.md`) are folded in
before the review gate and listed in current-state Claims.

## Copy

English keys (catalog `src/i18n/en.ts`): `admin.nav.stats`,
`admin.nav.reports`, `admin.stats.*`, `admin.reports.*`. Child content (task
excerpts, notes, raw input, topic names) is server data, marked
`data-content`, and `lang="cs"` where it is Czech text.

## Accessibility

Keyboard: the selects and buttons are native controls; after an action focus
moves to the outcome line (`tabIndex=-1`, `role="status"`), so the result is
announced even when the report leaves the filtered list. Tables have
captions and `scope="col"` headers; the metric chip carries a word, never
colour alone. Raw input wraps inside the entry (no horizontal page scroll at
1280×720). Reduced motion: nothing animates. Both routes run through the
a11y gate in light and dark and the reduced-motion check.

## Testing

- Unit (Vitest): `stats.ts` view model (short weeks, empty, percent, week
  labels), `StatsScreen` (metric met / not met / too little history, week
  count, empty, error), `ReportsScreen` (entries with and without attempts,
  long raw input, both verdicts, filter, re-evaluate outcomes, dismiss, 409),
  the navigation entries — against the shared fake admin backend.
- E2E (Playwright, chromium / msedge / firefox at 1280×720):
  `e2e/progress-stats.spec.ts` (FR-40), `e2e/flag-queue.spec.ts` (FR-41,
  including the fix-the-spec path through the task editor), and both routes
  in the a11y, theme and `⟦` gates (NFR-13, NFR-9).

## Risks & mitigations

- The backend half runs in parallel: the stub follows the store spec and the
  contract; the backend's notes are re-read before the review gate.
- Short weeks are shown only for weeks the response holds; the default (5
  weeks) holds all four metric weeks, so the view never invents a figure.
