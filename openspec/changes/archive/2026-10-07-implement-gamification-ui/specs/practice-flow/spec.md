## ADDED Requirements

### Requirement: Mission-complete screen

`/summary?missionId=…` SHALL show "Mise je splněná!", the XP earned in the
run ("+{xp} XP" and "Získala jsi {xp} XP."), "{n} na první pokus", the
number of the mission's tasks, and the rank-up: the celebration when the
server's summary carries `rankUp`, or the static line "Nová hodnost: {name}"
for `rankReachedDuringRun`, or nothing (FR-32, FR-36). When an answer on the
task screen completes the mission's run, the screen SHALL offer "Výsledky
mise" (focused), which opens it. A mission without a completed run SHALL show
"Tahle mise ještě není splněná." with a way back to HQ.

#### Scenario: Summary after the last task

- **GIVEN** a mission whose last task the child resolves
- **WHEN** the child presses "Výsledky mise"
- **THEN** "Mise je splněná!", the server's XP earned and "{n} na první pokus" are shown

#### Scenario: Last task revealed

- **GIVEN** a mission with one unresolved task
- **WHEN** that task is revealed after two wrong attempts
- **THEN** "Výsledky mise" is offered and opens the mission-complete screen

#### Scenario: Rank-up earlier in the mission

- **GIVEN** a run whose rank-up already played on a task
- **WHEN** the mission-complete screen opens
- **THEN** "Nová hodnost: {name}" is shown as a static line and no celebration

### Requirement: Replay from the briefing and the summary

A complete mission's briefing SHALL offer "Zopakovat misi" and "Výsledky
mise"; the mission-complete screen SHALL offer "Zopakovat misi" (FR-33).
"Zopakovat misi" starts or resumes the replay run (`startReplay`) and opens
its first unresolved task. A replay's mission-complete screen SHALL say
"Opakování je hotové!" and that a replay earns no XP. HQ keeps the mission
complete and offers no "Pokračovat" to a replay.

#### Scenario: Replay starts fresh

- **GIVEN** a completed mission
- **WHEN** the child presses "Zopakovat misi"
- **THEN** its first task opens with 0 of 2 attempts used and empty inputs

#### Scenario: Replay earns no XP

- **WHEN** the child finishes a replay
- **THEN** the mission-complete screen shows 0 XP earned and says that a replay earns no XP, and HQ's total XP is unchanged

#### Scenario: Resume an unfinished replay

- **GIVEN** a replay left after its first task
- **WHEN** the child opens the mission from HQ and presses "Zopakovat misi"
- **THEN** the replay's second task opens

### Requirement: XP still to earn on the briefing

The mission briefing SHALL show "Můžeš získat až {n} XP" with the server's
`MissionBriefing.xpAvailable` when it is above 0, and no XP figure when it is
0 (a complete mission), so the child sees what a mission can still bring and
never a "0 XP" promise (FR-33, FR-38).

#### Scenario: New mission

- **GIVEN** a new mission of 3 tasks whose bonus was never paid
- **WHEN** the child opens its briefing
- **THEN** "Můžeš získat až 50 XP" is shown (as the server counts it)

#### Scenario: Complete mission

- **GIVEN** a complete mission
- **WHEN** the child opens its briefing
- **THEN** no XP figure is shown, and "Zopakovat misi" and "Výsledky mise" are offered
