## ADDED Requirements

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

Every visible string of the source list, viewer, task list, task editor and
preview SHALL come from the message catalogs, except content the admin entered
or the server sent, which is marked as content (NFR-9).

#### Scenario: Pseudo-catalog render

- **GIVEN** a catalog in which every value is wrapped in `⟦…⟧`
- **WHEN** every authoring route is rendered signed in with example data
- **THEN** every visible text outside marked content is wrapped, and every marked content text is example data
