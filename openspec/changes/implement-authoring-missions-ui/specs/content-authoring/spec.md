## ADDED Requirements

### Requirement: Mission list screen

The `/admin/missions` screen SHALL list every mission with its topic,
position, task counter in the form `<n>/10 tasks` and status, ordered by topic
and position, with a link to edit each and to create a new one (FR-9).

#### Scenario: Missions listed

- **GIVEN** a draft mission at position 1 of topic `Desetinná čísla` with 2 tasks
- **WHEN** the admin opens `/admin/missions`
- **THEN** the mission is listed with that topic, position 1, `2/10 tasks` and the status Draft

#### Scenario: No missions

- **GIVEN** no mission exists
- **WHEN** the admin opens `/admin/missions`
- **THEN** "No missions yet." is shown with the link to a new mission

### Requirement: Mission editor

The mission editor SHALL create a mission (`createMission`) and edit a saved
one (`updateMission`): topic from the seeded topics, position, and an ordered
task list built from the tasks of that topic, with a counter `<n>/10 tasks`
(FR-9, CA-D18). Every task row SHALL have keyboard-operable move up, move down
and remove buttons, and focus SHALL follow a moved task. A task already in the
mission SHALL NOT be offered again (CA-D12). At 50 tasks the editor SHALL
offer no further task and state the maximum of 50. The topic SHALL be locked
while the mission has tasks (CA-D10). The picker SHALL filter the topic's tasks
by a search that ignores case and diacritics. A position that is not a whole number
from 1 to 999 SHALL be refused inline before sending; server refusals SHALL be
shown inline on the field their path names (`position`, `taskIds[i]`).

#### Scenario: Create a mission with ordered tasks

- **GIVEN** tasks of topic `Desetinná čísla`
- **WHEN** the admin chooses that topic, position 2, adds three of its tasks, moves the third to the first place with the keyboard and saves
- **THEN** a DRAFT mission is stored with those tasks in the new order, and the counter shows `3/10 tasks`

#### Scenario: Counter is a target, not a limit

- **GIVEN** a mission editor with 12 tasks
- **WHEN** the admin saves
- **THEN** the mission is saved and the counter shows `12/10 tasks` with no error

#### Scenario: Position refused inline

- **WHEN** the admin saves with position `0`, `abc` or `1,5`, or the server answers 400 on `position`
- **THEN** the message is shown under the position field, which is marked invalid, and no mission is created

#### Scenario: The 50-task maximum

- **GIVEN** a mission editor with 50 tasks
- **WHEN** the admin looks for a 51st task to add
- **THEN** no task can be added and the message states the maximum of 50

#### Scenario: Search the topic's tasks

- **GIVEN** the picker lists the tasks of topic `Desetinná čísla`
- **WHEN** the admin types `vetsi`
- **THEN** only tasks whose prompt contains `větší` are offered

#### Scenario: Reorder a saved mission

- **GIVEN** a saved mission with tasks T1, T2, T3
- **WHEN** the admin moves T3 to the first place and saves
- **THEN** the mission lists T3, T1, T2

### Requirement: Publishing and deleting with clear refusals

For a saved mission the editor SHALL offer publish or unpublish
(`setMissionStatus`) and delete (`deleteMission`) after an inline
confirmation. The task editor SHALL offer publish or unpublish
(`setTaskStatus`), list the missions that hold the task, and offer delete
(`deleteTask`). The source edit screen SHALL offer delete (`deleteSource`).
Publishing acts on the stored mission or task, so publish and unpublish SHALL
wait (disabled, with "Save your changes first.") while the form differs from
the stored item. A 409 refusal, also of a task or mission save, SHALL be shown as an alert with the problem's `detail` and every
id of `conflicts` named as the blocking task (prompt excerpt) or mission
(topic and position) with a link to its editor. When `deletable` is false the
delete action SHALL be disabled with an explanation that offers to unpublish
instead (the server rule of FR-56, shown under FR-55).

#### Scenario: Publish refused for a draft task

- **GIVEN** a draft mission that holds a draft task
- **WHEN** the admin publishes the mission
- **THEN** an alert shows the server's reason and names the draft task, and the mission stays Draft

#### Scenario: Publish a valid mission

- **GIVEN** a mission whose tasks are all published text tasks
- **WHEN** the admin publishes it
- **THEN** the status shows Published and the action becomes "Unpublish mission"

#### Scenario: Task unpublish refused by a published mission

- **GIVEN** a published task inside a published mission
- **WHEN** the admin unpublishes the task in the task editor
- **THEN** an alert shows the server's reason and names the mission with a link to it

#### Scenario: Save before publishing

- **GIVEN** a saved mission or task whose form has unsaved changes
- **WHEN** the admin looks at publish
- **THEN** it is disabled with "Save your changes first." until the changes are saved

#### Scenario: Task save refused while the task is in a mission

- **GIVEN** a task in a mission
- **WHEN** the admin changes its topic and saves
- **THEN** an alert shows the server's reason and names the mission with a link to it

#### Scenario: Blocked delete

- **GIVEN** a mission one of whose tasks has practice records
- **WHEN** the admin opens it
- **THEN** delete is disabled and the explanation offers to unpublish instead

#### Scenario: Delete an unused mission

- **GIVEN** an unused draft mission
- **WHEN** the admin deletes it and confirms
- **THEN** "Mission deleted." is shown and its tasks still exist

### Requirement: Source metadata edit

The `/admin/sources/edit` screen SHALL edit a source's title, publisher,
edition, grade and subject (`updateSource`) and SHALL offer no file field
(CA-D3, FR-55). Field refusals SHALL be inline; a 409 refusal (grade locked
while tasks reference the source) SHALL be shown with its detail.

#### Scenario: Edit the edition

- **GIVEN** a source with edition `1`
- **WHEN** the admin changes the edition to `2` and saves
- **THEN** "Source saved." is shown and the tasks of that source show edition `2` in their provenance

#### Scenario: No file field

- **WHEN** the admin opens the source edit screen
- **THEN** no file input is offered and the note says a new file needs a new source

#### Scenario: Source delete refused

- **GIVEN** a source referenced by tasks
- **WHEN** the admin deletes it and confirms
- **THEN** an alert shows the server's reason and names the referencing tasks

## MODIFIED Requirements

### Requirement: Externalized authoring strings

Every visible string of the source list, source edit screen, viewer, task
list, task editor, preview, mission list and mission editor SHALL come from
the message catalogs, except content the admin entered or the server sent,
which is marked as content (NFR-9).

#### Scenario: Pseudo-catalog render

- **GIVEN** a catalog in which every value is wrapped in `⟦…⟧`
- **WHEN** every authoring route is rendered signed in with example data
- **THEN** every visible text outside marked content is wrapped, and every marked content text is example data
