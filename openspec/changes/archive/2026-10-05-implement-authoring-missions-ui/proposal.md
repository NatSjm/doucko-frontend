# Implement authoring missions (frontend)

## Why

Slice 6 of the capability plan (`contract/docs/mvp-capability-plan.md` §4.6).
Store spec: `content-authoring` ("Missions", "Mission publishing rules",
"Draft and published status", "Field limits: Too many tasks in a mission",
"Edit existing content", "Delete only unused content"). Tasks are only served
to the child inside a published mission, so the parent needs to group tasks
into ordered missions per topic, publish them, and fix or remove content later.
The frontend owns FR-9 (missions) and FR-55 (edit every entity) of this slice;
FR-12, FR-56 and FR-57 are backend rules whose refusals the UI must show
clearly (problem+json `detail` and the blocking ids in `conflicts`).

## What Changes

- New admin screens behind `AdminGate` (English), linked from the admin
  navigation ("Missions", "New mission"):
  - `/admin/missions`: every mission with its topic, position, task counter
    (`<n>/10 tasks`) and status, ordered by topic and position (`listMissions`).
  - `/admin/missions/edit[?missionId=…]`: the mission editor (`createMission`,
    `getAdminMission`, `updateMission`): topic (from reference data, locked
    while the mission has tasks), position 1–999, the ordered task list with
    move up / move down / remove buttons (keyboard, focus follows the moved
    task), the counter, a picker of the topic's tasks with a search box, and
    the 50-task maximum. For a saved mission: publish / unpublish
    (`setMissionStatus`) and delete (`deleteMission`, with an inline confirm
    step).
  - `/admin/sources/edit?sourceId=…`: source metadata edit without a file
    field (`updateSource`, CA-D3) and source delete (`deleteSource`).
- Task editor (`/admin/tasks/edit?taskId=…`): publish / unpublish the task
  (`setTaskStatus`), the missions that hold it, and delete (`deleteTask`).
- Refusals: 400 `errors[].field` inline on the field (`position`,
  `taskIds[i]`, `title`, …); 409 as an alert with the server `detail` and the
  blocking entities named from `conflicts` (task prompts, mission labels),
  each linked to its editor. `deletable: false` disables delete and explains
  why, offering to unpublish instead (FR-56).
- English `admin.*` catalog entries; the three new routes join the route
  registry with example queries, so the a11y gate (light, dark, reduced
  motion), the theme e2e and the `⟦` render test reach them signed in.
- The shared contract stub (`src/test/fake-admin-backend.ts`) gains missions,
  source update and delete, task status and delete, and the publishing and
  delete rules of the store spec (self-authored seed data).

## Impact

- Store spec: content-authoring · Contract pin: docs `4c87d67` (API 0.5.1) · Generated client regenerated: yes (unchanged contract)
- Features: `src/features/missions` (new), `src/features/sources`,
  `src/features/tasks`, `src/features/admin-access` (navigation, conflict alert)
- No new dependency.
- Scope out: child-side serving of published missions (slice 7), mission
  names (none in MVP, CA-D17).
