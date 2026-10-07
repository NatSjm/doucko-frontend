# Implement gamification (frontend)

## Why

Slice 8 of the capability plan (`contract/docs/mvp-capability-plan.md` §4.8).
Store spec: `gamification` (`npx openspec show gamification --type spec --store doucko`)
plus the "Mission complete screen" and "Replay completed missions"
requirements of `practice-flow`. Slice 7 gave the child HQ, the briefing and
the task screen but left XP, the rank, the mission-complete screen and replay
out. The frontend owns FR-32 (mission-complete screen, e2e + recording),
FR-33 (replay), FR-36 (rank-up celebration, vision-verify), FR-37 (HQ
progress, e2e + vision-verify), FR-38 (no negative mechanics on the child
screens) and FR-39 (theme text only in the skin, deny-list) of this slice;
FR-34 and FR-35 (XP values, bonus) are backend-only and the UI shows only
what the server awards.

## What Changes

- **HQ** (`getHq`, `ackRankUp`): a progress panel with the rank badge, the
  rank name, the total XP, an XP bar towards the next rank ("{x} z {n} XP do
  hodnosti {name}", a full bar and "Nejvyšší hodnost!" at the top rank) and
  the number of solved tasks (FR-37). A `pendingRankUp` plays the rank-up
  celebration once and is acknowledged (`ackRankUp`) as soon as it is shown
  (FR-36).
- **Mission-complete screen** — new route `/summary?missionId=…`
  (`getMissionSummary`, `ackRankUp`, `startReplay`): "Mise je splněná!", the
  XP earned in the run ("+101 XP"; a replay shows 0 XP and says why), "{n}
  na první pokus" of the mission's tasks, the rank-up celebration when
  `rankUp` is set (then acknowledged) or a static "Nová hodnost: {name}" line
  for `rankReachedDuringRun`, "Zpět na HQ" and "Zopakovat misi" (FR-32,
  FR-36). 409 (no completed run) and 404 are friendly dead ends.
- **Task screen**: when an answer completes the mission's run, "Výsledky
  mise" leads to the mission-complete screen (focus on it); a mid-mission
  `rankUp` in the attempt result plays the celebration on the feedback
  (one-shot, never after a reload); "+n XP" on a correct and on a revealed
  resolution, and a "+n XP bonus" line when the resolution completed missions
  (shared tasks). No XP amount of 0 or less and no minus sign is ever shown
  (FR-38).
- **Mission briefing**: "Můžeš získat až {n} XP" from `xpAvailable`; a
  complete mission offers "Zopakovat misi" (`startReplay`, resumes an
  unfinished replay run, FR-33) and "Výsledky mise".
- **Rank-up celebration** component: medal (design-system `RankBadge`
  medal only), "Nová hodnost!" and the rank name in the display face, a pop
  and speed-lines animation that turns off under `prefers-reduced-motion`,
  where the same text and badge are shown static (NFR-13).
- **Skin (FR-39)**: the frontend's share of the skin is the Czech child
  catalog (theme copy) and the design-system tokens; rank names come from the
  API. A unit test runs the store's deny-list
  (`contract/docs/skin/ip-denylist.txt`) over the catalog's keys and values
  and the shipped asset file names, and proves the matcher catches a
  borrowed term.
- Czech catalog keys `child.hq.rank*`, `child.hq.xp*`, `child.hq.solved`,
  `child.rankUp.*`, `child.summary.*`, `child.mission.replay*`,
  `child.mission.xpAvailable`, `child.task.bonus`, `child.task.summary`.
- `/summary` joins the route registry, so the a11y (light, dark, reduced
  motion), theme and `⟦` gates cover it; the celebration states (HQ pending,
  summary rank-up) get their own a11y scans in both themes and the
  reduced-motion check.
- The contract stub (`src/test/fake-child-backend.ts`) learns XP, bonuses,
  the placeholder ladder, rank-up / pending / ack, summaries and replay runs
  as the store spec and the contract describe them.

## Impact

- Store spec: gamification, practice-flow (summary, replay) · Contract pin: docs `0168eba` (API 0.5.1, unchanged) · Generated client regenerated: yes (unchanged contract)
- Features: `src/features/hq`, `src/features/mission`, `src/features/task`, new `src/features/summary` and `src/features/rank`; `src/app` (route); `src/i18n/cs.ts`; `src/test/fake-child-backend.ts`
- No new dependency. No contract change.
- Scope out: XP values and the ladder itself (backend, FR-34/FR-35/FR-36
  config), the in-app theme toggle (none, FR-58), achievements and other
  rewards (excluded by the store spec).
