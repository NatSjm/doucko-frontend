# practice-flow Specification

## Purpose
UI half of the store spec practice-flow in this repo: the child screens (HQ, mission briefing, task screen with attempts, reveal, format tips, hints, the Ukrainian translation toggle, report a problem, and save and resume), their externalized Czech strings, and the keyboard path. Product rules live in the store spec (`npx openspec show practice-flow --type spec --store doucko`).

## Requirements

### Requirement: HQ screen

The app root `/` SHALL be HQ for the single profile, with no login form and no
profile picker (FR-24). HQ SHALL greet the profile by its display name, show a
"Pokračovat" button to the server's continue target only when there is one
(NFR-7), and list the published missions under "Síla: {topic}" headings in
the server's order, each as a link with "Mise {position}", its state (Nová,
Rozdělaná, Splněno) and "{x}/{N} vyřešeno" (FR-25). No mission is shown as
locked. Without missions HQ SHALL show an empty-state message and no error.

#### Scenario: Fresh browser lands on HQ

- **GIVEN** a browser with no cookies or local storage for the app
- **WHEN** the child opens `/`
- **THEN** HQ greets the profile and no password field or profile choice is shown

#### Scenario: Missions with their states

- **GIVEN** published missions that are new, in progress and complete
- **WHEN** HQ opens
- **THEN** each card shows its state and its "x/N vyřešeno" under its topic heading, position 1 before position 2

#### Scenario: Draft mission not listed

- **GIVEN** a draft mission and a published mission
- **WHEN** HQ opens
- **THEN** only the published mission has a card

#### Scenario: Continue in one click

- **GIVEN** a continue target on HQ
- **WHEN** the child clicks "Pokračovat"
- **THEN** that task opens; without a target no "Pokračovat" button is shown

### Requirement: Mission briefing screen

`/mission?missionId=…` SHALL show the mission's topic, number, progress and
task states and a start button that opens the first unresolved task, so a new
mission starts in 2 clicks from HQ (NFR-7, FR-25). An unknown or unpublished
mission SHALL show "Tuhle misi jsem nenašel." with a button back to HQ.

#### Scenario: Start in two clicks

- **GIVEN** a new mission on HQ
- **WHEN** the child clicks its card and then "Začít misi"
- **THEN** the first task of that mission opens

#### Scenario: Unknown mission

- **WHEN** the child opens the briefing URL of a draft or unknown mission
- **THEN** "Tuhle misi jsem nenašel." and "Zpět na HQ" are shown

### Requirement: Task screen practice

`/task?missionId=…` SHALL show the task's prompt, images and one input per
part with focus in the first input, and submit all editable parts together
with Enter or "Odeslat" (FR-26, NFR-7). An empty part SHALL be refused on the
screen with "Vyplň prosím odpověď" and nothing sent. Inputs SHALL hold at most
100 code points. After a wrong attempt wrong parts SHALL show "Skoro! Zkus to
znovu." in the `almost` role, correct parts SHALL be locked and the indicator
SHALL show the attempts used; the second attempt sends only the parts that are
not locked; after the second wrong attempt every part SHALL show its correct
answer with "Nevadí, příště!" in neutral styling and read-only inputs; a
correct resolution shows "Výborně!" (with "+n XP" when awarded) and "Další
úloha" (FR-27). An unreadable answer SHALL show the server's format tip on
the part, keep every typed input and the attempt count (FR-22).

#### Scenario: Keyboard-only submission

- **GIVEN** a two-part task
- **WHEN** the child types into input a, presses Tab, types into input b and presses Enter
- **THEN** one submission carries both parts

#### Scenario: Wrong, then revealed

- **GIVEN** a two-part task
- **WHEN** attempt 1 has a correct and b wrong, and attempt 2 has b wrong again
- **THEN** after attempt 1 b is marked "Zkus znovu", a is read-only and correct, and "Použité pokusy: 1 ze 2" is shown; after attempt 2 the correct values of a and b and "Nevadí, příště!" are shown without the `almost` colour and without the words "Špatně" or "Chyba"

#### Scenario: Unreadable input costs nothing

- **WHEN** the child submits `5,,2` into a decimal part
- **THEN** the format tip is shown on that part, the typed `5,,2` stays, and the attempt indicator is unchanged

### Requirement: Hints, translation and reports on the task screen

The hint button SHALL open the next hint and show how many remain, be absent
for a task without hints and disabled when none remain; opened hints SHALL be
shown after a reload (FR-28). The "Zobrazit ukrajinsky" toggle SHALL store the
profile setting and show the server's Ukrainian text next to the Czech one,
and show "Překlad není k dispozici" for a task without a translation (FR-29).
"Nahlásit problém" SHALL send one of the three reasons, require a note for
"Jiné" ("Napiš prosím krátce, co nesedí.") and confirm with "Díky, podívám se
na to!" without changing the task (FR-30).

#### Scenario: Hints in order

- **GIVEN** a task with 2 hints
- **WHEN** the child opens a hint twice
- **THEN** hint 1 and hint 2 are shown, the button goes from 2 to 1 to 0 remaining and ends disabled

#### Scenario: Toggle remembered

- **GIVEN** the child turned the toggle on
- **WHEN** another translated task opens in a new browser context
- **THEN** its Ukrainian prompt is shown without touching the toggle

#### Scenario: Other needs a note

- **WHEN** the child chooses "Jiné" and sends without a note
- **THEN** nothing is sent and "Napiš prosím krátce, co nesedí." is shown

### Requirement: Save and resume on the task screen

A verdict SHALL be shown only from a server answer, and a reload SHALL show
the stored state (attempts used, wrong and locked parts, reveal, opened
hints) (FR-31). When a submission gets no response the screen SHALL keep the
inputs and show "Nepodařilo se to uložit. Zkus to prosím znovu.", and before
the next send it SHALL re-read the task, showing an attempt that was stored
instead of sending it again.

#### Scenario: Server unreachable, then back

- **GIVEN** the backend is unreachable
- **WHEN** the child submits, the backend comes back and the child submits again
- **THEN** the first submit shows the failure and keeps the inputs, and the second is graded as attempt 1

#### Scenario: Lost response

- **GIVEN** the server stored attempt 1 as wrong but the response was lost
- **WHEN** the child submits again
- **THEN** the stored verdict of attempt 1 is shown with 1 of 2 attempts used, and no second attempt is sent

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
