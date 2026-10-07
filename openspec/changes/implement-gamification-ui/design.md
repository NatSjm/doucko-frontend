# Design — implement-gamification-ui

## Goals / Non-goals

Goals: the child half of gamification — HQ progress (rank, XP bar, solved
tasks), the rank-up celebration (one-shot, acknowledged, reduced-motion
variant), the mission-complete screen, replay, and XP on the task feedback —
with every word from the Czech catalog and nothing that punishes.

Non-goals: computing XP, ranks or bonuses. The UI shows what the server
answers (`HqView`, `AttemptResult`, `MissionSummary`, `MissionBriefing`):
it never adds up XP, never derives a rank from a ladder and never decides
whether a celebration is due. Ladder and XP configuration validation are
backend concerns (FR-34, FR-35, FR-36 config).

### Store-spec scenarios: slice 8 UI vs elsewhere

| Requirement (store) | Slice 8 UI (this change) | Elsewhere |
|---|---|---|
| gamification: XP per task | "+n XP" on a correct or revealed first resolution exactly as `xpAwarded` (Revealed answer still earns XP: "+1 XP"); nothing when 0 | backend: award table, hints, OQ-15, config |
| gamification: XP configuration is validated | — | backend |
| gamification: XP is granted only by the server | the client never sends XP, rank or counts | backend: 405 on HQ writes, ignored fields |
| gamification: Mission completion bonus | "+n XP bonus" line when `bonusXp > 0`; the summary's `xpEarned` | backend: once per mission, shared tasks, publish-time |
| gamification: Rank ladder | rank names, indices and thresholds shown as served | backend: ladder, validation |
| gamification: Rank-up celebration | Rank-up on a task award (task feedback), Bonus crosses two thresholds (one celebration naming the highest rank, as served), No celebration without a rank-up, Celebration does not repeat (ack + server state), Unshown mission-complete rank-up plays on HQ (pending), Rank-up outside a session (pending on HQ), Reduced motion (static variant, same text) | backend: when `rankUp`/`pendingRankUp` are set and cleared |
| gamification: Progress on HQ | XP bar (275 → 125 of 250 towards rank 3), Fresh profile (0 of 150, 0 solved), Top rank (full bar, "Nejvyšší hodnost!", no target), Solved tasks counted once (shows `solvedTasks`) | backend: counts |
| gamification: No negative mechanics | no minus sign and no "+0 XP" on the task screen (Wrong answers cost nothing), No timers, streaks or leaderboards on HQ, briefing, task and summary; Long break (HQ shows what the server holds) | backend: append-only history |
| gamification: Swappable skin | No borrowed IP (deny-list over the Czech catalog and asset names), Deny-list catches a borrowed term (matcher test); No theme text outside the skin (the frontend names no school or mentor; rank names come from the API) | backend: ladder and skin loading, Incomplete skin |
| gamification: Light and dark theme | `/summary` and the celebration states in the a11y gate (light, dark) and the theme e2e | — |
| practice-flow: Mission complete screen | Mission summary ("7 na první pokus", 101 XP), Shared task earns nothing (the server's numbers), Last task revealed still completes, Rank-up on completion (celebration + ack), Rank-up earlier in the mission (static line), No rank-up | backend: run sums |
| practice-flow: Replay completed missions | Replay earns no XP (summary shows 0 XP, the replay note), Replay starts fresh (task 1 with 2 attempts, empty inputs), HQ during a replay (mission stays complete, no "Pokračovat" to it), Resume an unfinished replay ("Zopakovat misi" resumes) | backend: 409 for an unfinished mission, same run returned |

## Screens and states

- `/` HQ — slice 7's hero panel (now a padded `dk-panel dk-panel-hero`) holds
  a **progress card** (`RankPanel`, a region "Tvůj postup") left of the intro
  and "Pokračovat": `RankBadge` medal (size md, name hidden), kicker
  "Hodnost {n}", the rank name (`dk-rank-name`, display face), the total "{xp}
  XP" (`dk-xp-total`), the XP bar (`dk-xp-track` / `dk-xp-fill`,
  `role="progressbar"`, `aria-valuemin` = 0, `aria-valuemax` = the rank's span,
  `aria-valuenow` = XP into the rank, `aria-valuetext` "{x} z {n} XP") with
  "{x} z {n} XP do hodnosti {next}" under it, and "Vyřešené úlohy: {n}". At
  the top rank (`nextRank` null) the bar is full, `aria-valuetext`
  "Nejvyšší hodnost!" and the line says "Nejvyšší hodnost!" (no target).
  With `pendingRankUp` the **celebration** is shown above the panel and
  acknowledged once; "Super!" closes it and focus goes to the `h1`.
- `/summary?missionId=…` mission-complete screen — `h1` "Mise je splněná!"
  (a replay: "Opakování je hotové!"); a hero panel (`dk-panel dk-panel-hero`,
  `radius-xl`, no texture: the celebration's speed lines are the screen's
  one) with the XP sticker (`dk-burst`, "+{xp} XP") and "Získala jsi {xp}
  XP." — a replay shows "Získané XP: 0. Za opakování se XP nepřipisují, ty už
  máš z prvního průchodu." and no sticker; the
  stats "{n} na první pokus" and "Úloh v misi: {n}"; then the celebration
  (`rankUp` set) or the static line "Nová hodnost: {name}" with a small medal
  (`rankReachedDuringRun` set) or nothing. Actions: primary "Zpět na HQ",
  secondary "Zopakovat misi". 409 → "Tahle mise ještě není splněná." with
  "Zpět na HQ"; 404/400/no id → "Tuhle misi jsem nenašel."; other errors →
  the load error with retry.
- `/task` task screen — the feedback block: correct → "Výborně!" + the XP
  sticker "+n XP" when `xpAwarded > 0`; revealed → "Nevadí, příště!" + "+n
  XP" when `xpAwarded > 0` (a reveal earns 1); `bonusXp > 0` → a line "+{n}
  XP bonus za splněnou misi". A `rankUp` in the live result → the
  celebration under the feedback (never from `lastFeedback`, which the
  server sends with `rankUp` null). When `missionComplete`: primary
  "Výsledky mise" (`/summary?missionId=…`, focused) instead of "Další úloha".
  The 204 state of `getCurrentTask` ("Mise je splněná!") gets "Výsledky
  mise" as its primary action, "Zpět na HQ" stays.
- `/mission` briefing — "Můžeš získat až {n} XP" when `xpAvailable > 0`; a
  complete mission: "Tuhle misi máš splněnou. Výborně!", primary "Zopakovat
  misi" (POST `startReplay`, then `/task?missionId=…&taskId=…` of the returned
  task), secondary "Výsledky mise". Replay 409 (the mission is no longer
  complete) re-reads the briefing; other failures: "Opakování se nepodařilo
  spustit. Zkus to prosím znovu." (`role="alert"`).

### Rank-up celebration (`src/features/rank/RankUp.tsx`)

A `role="status"` section with `aria-labelledby` its kicker: speed-lines
texture behind the medal only (never behind text), the `RankBadge` medal
(lg), kicker "Nová hodnost!", the rank name (display face, `hero` size),
"Postoupila jsi na hodnost {name}. Jen tak dál!", and (where closable)
"Super!". Motion: the medal pops in with a twist and the speed lines turn
once (CSS keyframes, `glow-volt` on the medal). Under
`prefers-reduced-motion: reduce` every animation is `none` — the same text
and badge, static (NFR-13, gamification "Reduced motion").

An internal `useAcknowledge(rank)` posts `ackRankUp({ rankIndex })` once per shown rank
(a ref guards React's double effects); a failed ack is not shown to the child
(the celebration may then play once more — never lost, never repeated after a
successful ack).

## Design-system mapping

`RankBadge` (medal only: `hideName`, so no DS literal reaches the page),
`Button`, `Icon`, `Chip`; DS classes `dk-rank-*`, `dk-xp-*`, `dk-burst*`,
`dk-panel`, `dk-panel-hero`, `dk-speedlines`, `dk-kicker`, `dk-t-*`,
`dk-fb*`. `XpBar`, `Feedback` and `MissionCard` of the DS carry Czech
literals, so their markup is rebuilt from the DS classes with catalog text.
New CSS in `src/features/rank/rank.css`, `src/features/summary/summary.css`
and the existing feature CSS, tokens only. `volt` is XP (bar, sticker),
`glow-volt` only on the rank and XP moments.

## Data flow

- Query keys: `['child','hq']` (slice 7), `['child','summary',missionId]`
  (`gcTime: 0`, shown only once fetched after mount, `retry: false`).
- `ackRankUp`: `POST /api/child/hq/rank-up-ack` `{ rankIndex }` (204) — a
  mutation without invalidation: the shown celebration stays until closed,
  and the next visit reads the cleared state from the server.
- `startReplay`: `POST /api/child/missions/{id}/replay` → `TaskView` →
  `navigate('/task?missionId=…&taskId=…')`.
- The task screen keeps the live `AttemptResult.rankUp` and `bonusXp` in
  local state next to the task (they are not part of `TaskView`).
- Numbers in Czech format (`toLocaleString('cs-CZ')`: no-break space for
  thousands).

## Assumed backend behaviour

The contract defines the shapes; the UI relies on: `pendingRankUp` and
`MissionSummary.rankUp` describe the same unacknowledged crossing and both
clear on `ackRankUp` with an index at or above it; `AttemptResult.rankUp` is
the only carrier of a mid-mission crossing; `getMissionSummary` answers 409
while the mission has no completed run and returns the latest completed run
(also while a replay is unfinished); `startReplay` answers 409 for a mission
that is not complete and returns the unfinished replay run unchanged;
`getCurrentTask` and `getTask` serve the replay run while it is unfinished.
The contract stub follows the same rules. The backend half's notes
(`scratch/slice8-backend-behaviour.md`, 2026-10-05) confirm each of them and
add: the ladder (names and thresholds) is the backend's
(`gamification.json`: Nováček 0, Kadet 150, Strážce 400, Hrdina 800, Legenda
1500 — the stub uses the same names, the UI always shows `Rank.name`);
`AttemptResult.rankUp` is marked celebrated by the backend itself (no ack);
`ackRankUp` answers 204 for any valid body and clamps an index above the
current rank; `lastFeedback` carries the stored `xpAwarded` / `bonusXp`;
`xpAvailable` is 0 for a complete mission; a summary is 404 for a mission
that is not served and 409 without a completed run.

## Copy

Czech keys (catalog `src/i18n/cs.ts`), feminine *ty*: `child.hq.rank`,
`child.hq.xpTotal`, `child.hq.xpToNext`, `child.hq.xpBar`, `child.hq.xpValue`,
`child.hq.topRank`, `child.hq.solved`, `child.hq.progressTitle`,
`child.rankUp.kicker`, `child.rankUp.text`, `child.rankUp.close`,
`child.summary.title`, `child.summary.replayTitle`, `child.summary.xp`,
`child.summary.xpText`, `child.summary.replayText`, `child.summary.firstTry`,
`child.summary.taskCount`, `child.summary.rankReached`,
`child.summary.notComplete`, `child.mission.replay`,
`child.mission.replayFailed`, `child.mission.results`,
`child.mission.xpAvailable`, `child.task.bonus`, `child.task.bonusMany` (one answer completing several
missions), `child.summary.noXpText` (a first run that earned no XP: no XP
figure, never "+0 XP"). Rank names come from the
server and are marked `data-content`. No school or mentor name appears in
the frontend (design-system README: still open).

## Accessibility

Keyboard: HQ celebration → "Super!" (Enter/Space) → focus to the `h1`; task
screen → after a completing answer focus on "Výsledky mise"; summary →
"Zpět na HQ", "Zopakovat misi". The celebration is `role="status"` so it is
announced. XP bar: `role="progressbar"` with a Czech `aria-label` and
`aria-valuetext`. Reduced motion: no animation anywhere (DS + feature CSS).
WCAG AA with tokens only; `/summary` and the celebration states run through
the a11y gate in light and dark.

## Testing

- Unit (Vitest): `rank.ts` (bar maths, Czech numbers), `RankUp` (ack once,
  static under reduced motion is CSS), HQ progress, summary screen, briefing
  replay, task screen XP/bonus/rank-up/summary link, deny-list matcher and
  the catalog scan — against the contract stub.
- E2E (Playwright, chromium / msedge / firefox): `e2e/gamification-hq.spec.ts`
  (FR-37, FR-36, FR-38), `e2e/gamification-summary.spec.ts` (FR-32, FR-36,
  FR-33), a11y celebration scans in `e2e/a11y.spec.ts` (NFR-13).
- Recordings: `tools/record-slice8.mjs` (asserted clips with stills: FR-32
  summary, FR-36 celebration, FR-37 HQ), then the vision-verify workflow over
  their stills.

## Risks & mitigations

- The backend half runs in parallel: the stub follows the store spec and the
  contract; differences found in the backend's notes are folded in before the
  review gate and listed in current-state Claims.
- A celebration that plays while the ack fails plays once more next time —
  acceptable (never lost), noted in the design above.
