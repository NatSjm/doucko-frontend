# Implement authoring tasks (frontend)

## Why

Slice 5 of the capability plan (`contract/docs/mvp-capability-plan.md` §4.5).
Store spec: `content-authoring`. The parent has to get workbook tasks into the
app before the child can practise anything: upload a PDF source, type tasks
next to the PDF, try them in a preview, and publish them. The frontend owns
FR-1, FR-2, FR-3, FR-4, FR-6, FR-7, FR-8, FR-10, FR-11 and FR-13 of this slice
(FR-5 is backend only), NFR-8 (a typical single-part task in ≤ 60 s, proven by a
timed recording), the frontend side of NFR-17 (upload limits), and the
content-authoring "Externalized admin strings" scenario (NFR-9, admin half
inside authoring).

## What Changes

- Admin screens behind `AdminGate` (English, `lang="en"`), with a shared
  admin header (navigation and sign-out):
  - `/admin`: admin home with links to tasks, a new task and sources.
  - `/admin/sources`: upload a PDF source with metadata (FR-1), client-side
    PDF type and 50 MB check before upload and server refusals inline
    (NFR-17), the source list with page counts.
  - `/admin/sources/view?sourceId=…&page=…`: the PDF viewer on its own, opened
    at a page (FR-2, FR-13).
  - `/admin/tasks`: task list with filters (grade, topic, source, page,
    modality, status) and prompt search (FR-11), provenance on every row with
    "Open source" at the task's page (FR-13), bulk publish of 1–100 selected
    tasks with a per-task result (OQ-32).
  - `/admin/tasks/edit[?taskId=…][&sourceId=…&page=…]`: the task editor next
    to the PDF viewer (FR-2, FR-3): prompt, topic, grade, difficulty,
    modality, source reference with sticky source and page (NFR-8), answer
    parts with every answer spec type (FR-6), ordered hints (FR-7),
    translations per configured task locale (FR-8), and, for a saved task,
    images with type and size limits and reorder (FR-4, NFR-17).
  - `/admin/tasks/preview?taskId=…`: the task as the child sees it, rendered
    by the child task view `src/features/task/TaskView.tsx`, with the
    translation toggle, and the answer tester beside it (FR-10).
- Field errors from `application/problem+json` `errors[].field` paths shown
  inline on the matching input.
- PDF rendering with `pdfjs-dist` (new dependency, Apache-2.0), loaded lazily
  on the viewer screens only.
- English `admin.*` and Czech `child.task.*` catalog entries.
- Route registry: six admin paths, each with an example query that reaches
  its content state; the a11y gate (light, dark, reduced motion), the theme
  e2e and the `⟦` render test reach every authoring screen signed in.
- A shared contract stub (`src/test/fake-admin-backend.ts`) answers the
  admin API in unit tests and, through `page.route`, in e2e and the
  recording when no stack runs.
- NFR-8 recording: `tools/record-nfr8.mjs` writes a timed, asserted clip
  under `docs/qa/demo-recordings/nfr8-task-entry/`.

## Impact

- Store spec: content-authoring · Contract pin: docs `4c87d67` (API 0.5.1) · Generated client regenerated: yes (unchanged contract)
- Features: `src/features/admin-access` (layout, problem helper),
  `src/features/sources`, `src/features/tasks`, `src/features/task`
- New runtime dependency: `pdfjs-dist` 6.4.299.
- Scope out: missions and the mission publishing rules (slice 6), task and
  source delete and source metadata edit (FR-55/FR-56, slice 6).
