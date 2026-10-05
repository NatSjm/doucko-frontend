# Design — implement-authoring-missions-ui

## Goals / Non-goals

Goals: the UI half of content-authoring for slice 6 — missions (create, edit
topic, position, task list and order, publish, unpublish, delete), editing the
entities slice 5 left read-only (source metadata) and the status and delete
actions of sources and tasks, with every backend refusal shown clearly.

Non-goals: re-implementing the backend rules (publishing invariants, delete
guards) — the UI shows the server's answer; it only prevents what the contract
makes obvious (a topic change of a non-empty mission, a 51st task, a position
that is not a whole number 1–999) and still shows the server refusal if one
comes.

### Store-spec scenarios: slice 6 UI vs elsewhere

| Requirement (content-authoring) | Slice 6 UI (this change) | Elsewhere |
|---|---|---|
| Missions | Create a mission (counter `10/10 tasks`); Mission size other than 10 (no blocking message); Missing or duplicate position (inline on `position`); Task shared by two missions (picker offers every task of the topic); Task from another topic, Same task twice (picker offers only the topic's tasks not yet in the mission; a server 400 on `taskIds[i]` is shown) | backend validation |
| Field limits: Too many tasks in a mission | at 50 tasks the add buttons are disabled and "A mission can have at most 50 tasks." is shown | backend: 400 |
| Mission publishing rules | every refusal (409) shown with its detail and the blocking tasks or missions named from `conflicts`; topic select locked while the mission has tasks | backend enforces the invariant |
| Draft and published status | status chips; publish / unpublish of missions and tasks | backend: serving (slice 7) |
| Edit existing content | source metadata edit without a file field; Source grade locked (409 detail); Reorder a mission; task fields (slice 5 editor) | backend validation |
| Delete only unused content | delete with an inline confirm for missions, tasks and sources; `deletable: false` disables delete with an explanation that offers to unpublish; a 409 shows the detail and the blockers | backend guards (`ContentUsage`) |

## Screens and states

- `/admin/missions` — heading "Missions", a "New mission" link, a table
  (topic, position, tasks `n/10 tasks`, status chip, Edit link) ordered by
  topic name and position. Empty: "No missions yet." Loading / error with
  "Try again" as every admin screen.
- `/admin/missions/edit` — new: heading "New mission"; existing: "Edit
  mission" with the status chip. Form: Topic (select; disabled with the hint
  "The topic can change only while the mission has no tasks." when it has
  tasks), Position (numeric input; hint "A whole number from 1 to 999, unique
  within the topic."), the "Tasks in this mission" ordered list (number,
  prompt excerpt, status and modality chips, Move up / Move down / Remove
  buttons named with the task number, e.g. "Move task 3 up"), the counter
  "`n`/10 tasks", the "Add tasks" panel (search box, the topic's tasks not in
  the mission, each with "Add"; without a topic "Choose a topic to see its
  tasks."; at 50 the add buttons are disabled with the maximum message). Save
  mission (primary; Enter in the position field submits). After creating, the
  URL becomes `?missionId=…` (history.replaceState) and the status says
  "Mission saved as draft." For a saved mission: "Publish mission" /
  "Unpublish mission" (disabled with "Save your changes first." while the
  form differs from the stored mission), and "Delete mission" → inline
  confirm ("Delete this mission? Its tasks are kept." with "Delete" and
  "Cancel"). After delete: "Mission deleted." and a link back to missions.
- `/admin/sources/edit?sourceId=…` — "Edit source": title, publisher,
  edition, grade, subject (no file field; note "The PDF file cannot be
  replaced. To use a new file, upload a new source."), Save source, View PDF
  link, Delete source with the inline confirm. After delete: "Source
  deleted." with a link back. Unknown id: "Source not found."
- Task editor, saved task: a "Status and deletion" panel: Publish task /
  Unpublish task, "In missions:" with links (or "Not in any mission."), Delete
  task with the inline confirm; when `deletable` is false the delete button is
  disabled and "This task cannot be deleted: practice records reference it or
  a published mission holds it. Unpublish it instead." is shown. After
  delete: "Task deleted." with a link back to tasks.
- Source list: an "Edit" link per row.

Refusal alert (`ConflictAlert`): `role="alert"`, the problem `detail` (else
its title) as server content, and, when `conflicts` is not empty, "Blocked
by:" with each id resolved to a task prompt excerpt or a mission label
("Topic · Mission 2") linked to its editor; an id the screen cannot resolve is
shown as the id. A request without a problem body: "The action failed. Check
that the server is running and try again."

## Design-system mapping

`Button` (primary for Save; secondary for move / remove / add / status /
delete), `Chip` (DRAFT neutral, PUBLISHED spark, GRAPHIC volt), `Panel` for
the add-tasks, status and danger sections, the admin CSS of slice 5
(`admin-form`, `admin-row`, `admin-table`, `admin-actions`, `admin-alert`,
`admin-ok`). New CSS in `src/features/missions/missions.css` uses only tokens.

## Data flow

- Generated client through `adminClient` (CSRF, 401 → sign-in).
- Query keys: `['admin','missions']` (list), `['admin','mission',id]`,
  `['admin','tasks',{topicId}]` (mission tasks and picker share it),
  existing `['admin','task',id]`, `['admin','sources']`.
- Mutations: save / status / delete of a mission invalidate
  `['admin','missions']`, `['admin','mission',id]` and `['admin','task']`
  (membership changes `missionIds`); task status / delete invalidate
  `['admin','tasks']`, `['admin','task',id]` and `['admin','missions']`;
  source update / delete invalidate `['admin','sources']` and
  `['admin','tasks']`.
- Pure mission form model (`missionForm.ts`): form ↔ `MissionInput`, move,
  add (no duplicates, max 50), remove, position check, dirty check.

## Copy

English `admin.missions.*`, `admin.sourceEdit.*`, `admin.taskStatus.*`,
`admin.conflict.*` keys. Server text (`detail`, `errors[].message`) and admin
content (prompts, topic names, source titles) are shown as received and
marked `data-content`.

## Accessibility

Every control labelled; the task list is an ordered list whose buttons name
the task number; after a move, focus follows the moved task's same button
(or the other move button at an end); after remove, focus goes to the next
row's Remove (or the add-tasks search). Alerts `role="alert"`, results
`role="status"`. The confirm step moves focus to its Cancel button; Escape
cancels. No animation.

## Testing

- Unit (Vitest): `missionForm` model; mission list and editor screens,
  source edit screen, task editor status/delete panel, `ConflictAlert`
  against the shared fake backend.
- E2E (Playwright, chromium / msedge / firefox): `e2e/authoring-missions.spec.ts`
  (FR-9: list, create with topic and ordered tasks, keyboard reorder,
  position refusal, add/remove, counter, 50 maximum, publish refusals and
  publish, unpublish; FR-55: reorder a saved mission, delete with blocked-delete
  messaging) and `e2e/authoring-edit.spec.ts` (FR-55: source metadata edit,
  grade locked, source delete refused and allowed, task status refused while
  in a published mission, task delete).
- `⟦`, a11y and theme gates pick the new routes up from the registry.

## Risks & mitigations

- The real backend's 409 `detail` wording is unknown to the stub: the UI
  shows whatever `detail` it gets and names the blockers from `conflicts`;
  tests assert on the stub's detail only as "shown as received". The real-stack
  smoke after the merge replays the flows.
- `deletable` may be stale (a child attempt arrives after the load): a 409 on
  delete is still shown with its detail.
