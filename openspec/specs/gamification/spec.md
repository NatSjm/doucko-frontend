# gamification Specification

## Purpose
The child-facing side of gamification (store spec `gamification`, FR-36..FR-39): HQ progress, the rank-up celebration, no negative mechanics on the child screens, and theme text kept in the skin. XP, ranks and the ladder come from the server.

## Requirements

### Requirement: HQ progress panel

HQ SHALL show the current rank (medal, "Hodnost {n}" and the rank name), the
total XP, an XP bar towards the next rank with "{x} z {n} XP do hodnosti
{name}", and "Vyřešené úlohy: {n}", all as the server's `HqView` holds them
(FR-37). At the top rank the bar SHALL be full and say "Nejvyšší hodnost!"
with no next-rank target. The bar SHALL be a progress bar with a Czech
accessible name and value text.

#### Scenario: Bar inside a rank

- **GIVEN** a total of 275 XP under the placeholder ladder
- **WHEN** HQ opens
- **THEN** the 2nd rank's name is shown, the bar is at 125 of 250 XP and "125 z 250 XP do hodnosti {3rd rank}" is shown

#### Scenario: Fresh profile

- **GIVEN** 0 XP and no resolved task
- **WHEN** HQ opens
- **THEN** the 1st rank, an empty bar at 0 of 150 XP and "Vyřešené úlohy: 0" are shown

#### Scenario: Top rank

- **GIVEN** a total of 1600 XP
- **WHEN** HQ opens
- **THEN** the 5th rank, a full bar and "Nejvyšší hodnost!" are shown and no "do hodnosti" target

### Requirement: Rank-up celebration on the child screens

When the server reports a rank-up — `AttemptResult.rankUp` on the task
screen, `MissionSummary.rankUp` on the mission-complete screen, or
`HqView.pendingRankUp` on HQ — the screen SHALL show the celebration naming
that rank ("Nová hodnost!", the rank name, "Postoupila jsi na hodnost
{name}.") with the rank medal (FR-36). A celebration from the summary or HQ
SHALL be acknowledged (`ackRankUp` with its rank index) once it is shown, so
it never plays again. Under `prefers-reduced-motion` the celebration SHALL
run no animation and show the same text and medal (NFR-13). Without a
rank-up no celebration is shown.

#### Scenario: Task award crosses a threshold

- **GIVEN** 145 XP under the placeholder ladder
- **WHEN** a task awards 10 XP in the middle of a mission
- **THEN** the task feedback shows the celebration naming the 2nd rank, and a reload of the task does not show it again

#### Scenario: Pending rank-up on HQ plays once

- **GIVEN** a rank-up credited outside a child session
- **WHEN** the child opens HQ, then reloads it
- **THEN** the celebration naming the new rank is shown once and acknowledged, and after the reload it is not shown

#### Scenario: Reduced motion

- **GIVEN** the OS asks for reduced motion
- **WHEN** a celebration is shown
- **THEN** no animation runs and the same text and medal are shown

### Requirement: No negative mechanics on the child screens

No child screen SHALL show a negative XP amount, a minus sign next to XP or
an XP change of 0 or less after an answer; XP SHALL be shown only as the
server awards it ("+n XP" for `xpAwarded > 0`, "+n XP bonus za splněnou
misi" for `bonusXp > 0`). HQ, the briefing, the task screen and the
mission-complete screen SHALL show no timer, elapsed time, streak or
comparison with other people (FR-38).

#### Scenario: Wrong answer shows no XP change

- **GIVEN** a task on its 1st attempt
- **WHEN** the attempt is wrong
- **THEN** the task screen shows no XP amount, no "+0 XP" and no minus sign next to XP

#### Scenario: Revealed answer shows +1 XP

- **GIVEN** a never-resolved task on its 2nd attempt without hints
- **WHEN** the attempt is wrong and the answer is revealed
- **THEN** "+1 XP" is shown with "Nevadí, příště!"

### Requirement: Theme text only in the skin

The frontend SHALL hold its theme copy only in the Czech child catalog and
take rank names from the API; it SHALL name no school or mentor character.
The catalog's keys and values and the shipped asset file names SHALL contain
no term of the store's IP deny-list (`docs/skin/ip-denylist.txt`), matched
case-insensitively as a whole word or phrase (FR-39).

#### Scenario: No borrowed IP

- **GIVEN** the Czech catalog and the shipped asset file names
- **WHEN** every deny-list term is searched for with the file's matching rule
- **THEN** no term matches

#### Scenario: The check catches a borrowed term

- **GIVEN** a test text "Akademie Plus Ultra"
- **WHEN** the same search runs on it
- **THEN** it reports "Plus Ultra"
