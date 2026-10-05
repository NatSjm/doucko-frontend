# content-authoring Specification

## Purpose
UI half of the store spec content-authoring in this repo: the admin authoring screens (source upload and list, PDF viewer, task editor, task list with filters and bulk publish, preview and answer tester), their externalized English strings, and the client-side upload checks. Product rules live in the store spec (`npx openspec show content-authoring --type spec --store doucko`).

## Requirements

### Requirement: Source upload screen

The `/admin/sources` screen SHALL let the signed-in admin upload a PDF source
with title, publisher, edition, grade and subject, offering the grades and
subjects of `getReferenceData` (FR-1). Before sending, it SHALL refuse a file
that does not start with the PDF signature or is larger than 50 MB with the
message "Only PDF files up to 50 MB are allowed." and send nothing (NFR-17).
Server refusals SHALL be shown inline on the field named by
`errors[].field`. The screen SHALL list every source with its metadata and
page count.

#### Scenario: Upload a source

- **GIVEN** the admin is signed in
- **WHEN** they choose a PDF, enter title, publisher, edition, grade `6` and subject math, and press Enter
- **THEN** the source list shows that source with its metadata and page count

#### Scenario: Wrong file type refused before upload

- **WHEN** the admin chooses a `.docx` file and submits
- **THEN** "Only PDF files up to 50 MB are allowed." is shown on the file field and no request is sent

#### Scenario: Server refusal inline

- **WHEN** the upload is answered 400 with `errors[].field = title`
- **THEN** the message is shown under the title field, which is marked invalid

### Requirement: PDF viewer with page jump

The PDF viewer SHALL show one page of a source at a time with previous and
next page controls and a page field (FR-2). A page that is not a whole number
from 1 to the page count SHALL keep the current page and show the valid range.
Changing the page SHALL NOT change the task form next to it.

#### Scenario: Jump to a page keeps the form

- **GIVEN** a 120-page source open beside a half-filled task form
- **WHEN** the admin enters page `57` and presses Enter
- **THEN** the viewer shows "Page 57 of 120" and the form keeps its content

#### Scenario: Invalid page

- **GIVEN** the viewer on page 10 of 120
- **WHEN** the admin enters `130`, `0`, `abc` or `5,5`
- **THEN** the viewer stays on page 10 and shows the range `1–120`

### Requirement: Keyboard-first task editor

The task editor SHALL create a task with prompt, topic, grade, difficulty,
modality, source reference, answer parts with their specs, hints and
translations (FR-3, FR-6, FR-7, FR-8) through `createTask`, and update it
through `updateTask`. Enter in a single-line field and Ctrl+Enter anywhere in
the form SHALL save. After a new task is saved, the source and page SHALL stay
filled in and focus SHALL be in the prompt (NFR-8). Topic choices SHALL be the
seeded topics of the selected grade. Translation fields SHALL be offered for
every configured task locale. Field errors SHALL be shown inline on the field
the problem's path names.

#### Scenario: Sticky source and page

- **GIVEN** the admin just saved a task from page 57 of a source
- **WHEN** the form is ready for the next task
- **THEN** that source and page 57 are filled in and the prompt field has focus

#### Scenario: Part error inline

- **WHEN** a save is answered 400 with `errors[].field = parts[0].spec.accepted[0]`
- **THEN** the message is shown under the first accepted answer of the first part

#### Scenario: Timed single-part entry

- **GIVEN** an empty task form with sticky source and page
- **WHEN** the admin types a prompt, chooses a topic, types a task number and an INTEGER expected value with the keyboard only and presses Enter
- **THEN** the task is saved within 60 seconds of the first keystroke (recorded clip)

### Requirement: Task images in the editor

For a saved task the editor SHALL attach PNG or JPG images, refuse other types
and files over 5 MB before upload with "Only PNG or JPG files up to 5 MB are
allowed.", show server refusals, and move an image earlier or later
(`reorderTaskImages`) (FR-4, NFR-17).

#### Scenario: Attach and reorder

- **GIVEN** a saved task with no images
- **WHEN** the admin attaches two PNG images and moves the second one first
- **THEN** the editor and the preview list both images in the new order

### Requirement: Task list with filters, provenance and bulk publish

The `/admin/tasks` screen SHALL filter by grade, topic, source, page,
modality and status and search the prompt (FR-11), show each task's source
title, edition, page, task number and sub-part with an "Open source" link to
the viewer at that page (FR-13), and publish 1 to 100 selected tasks in one
step, listing the result of each (OQ-32). A search query over 200 characters
SHALL be refused inline before sending.

#### Scenario: Combined filters

- **WHEN** the admin filters by a source, page 57 and status DRAFT
- **THEN** the request carries those filters and only the matching tasks are listed

#### Scenario: No match

- **WHEN** no task matches the filters
- **THEN** "No tasks match." is shown

#### Scenario: Open source at the task's page

- **GIVEN** a task from page 57
- **WHEN** the admin chooses "Open source" on its row
- **THEN** the viewer opens that source at page 57

#### Scenario: Bulk publish

- **GIVEN** three draft tasks and one published task selected
- **WHEN** the admin chooses "Publish selected"
- **THEN** each of the four is listed as published

### Requirement: Preview and answer tester screen

The preview SHALL render the task through the child task view with Czech
copy, images in order, parts, hints and the translation toggle, and SHALL show
no source reference (FR-10). The answer tester SHALL send the typed answers to
`testAnswers` and show, per part, the verdict, the normalized value and, for
UNPARSEABLE, the Czech format tip (FR-10).

#### Scenario: Tester verdict

- **GIVEN** a DECIMAL part expecting `0.5`
- **WHEN** the admin types `0,50` in the tester and checks
- **THEN** the tester shows CORRECT with the normalized value `0.5`

#### Scenario: Translation toggle

- **GIVEN** a task with a `uk` prompt
- **WHEN** the admin turns the translation on in the preview
- **THEN** the Ukrainian prompt is shown under the Czech one, marked `lang="uk"`

#### Scenario: No hint control without hints

- **GIVEN** a task without hints
- **WHEN** it is previewed
- **THEN** no hint control is shown

### Requirement: Externalized authoring strings

Every visible string of the source list, source edit screen, viewer, task
list, task editor, preview, mission list and mission editor SHALL come from
the message catalogs, except content the admin entered or the server sent,
which is marked as content (NFR-9).

#### Scenario: Pseudo-catalog render

- **GIVEN** a catalog in which every value is wrapped in `⟦…⟧`
- **WHEN** every authoring route is rendered signed in with example data
- **THEN** every visible text outside marked content is wrapped, and every marked content text is example data

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
