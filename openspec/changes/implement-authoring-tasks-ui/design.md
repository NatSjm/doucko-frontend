# Design — implement-authoring-tasks-ui

## Goals / Non-goals

Goals: the UI half of content-authoring for slice 5 — sources (upload, list,
viewer with page jump), tasks (create with sticky source and page, edit for
images and every field, parts and answer specs, hints, translations), the task
list (filters, search, provenance, bulk publish), and the preview with the
answer tester. NFR-8 is designed in (keyboard-first form, sticky fields) and
proven by a timed recording.

Non-goals: missions and mission publishing rules (slice 6), deleting tasks or
sources and editing source metadata (FR-55/FR-56 delete and source rules,
slice 6), the child task screen itself (slice 7; this slice builds the shared
task view it will reuse), backend validation (every server rule is shown, not
re-implemented).

### Store-spec scenarios: slice 5 UI vs elsewhere

| Requirement (content-authoring) | Slice 5 UI (this change) | Elsewhere |
|---|---|---|
| Authoring requires an admin session | every route behind `AdminGate` | backend: 401/403 |
| Field limits | server refusals inline on the named field | backend enforces the limits |
| Upload a PDF source | Upload a source; Optional metadata omitted; Missing required metadata; Invalid grade or subject (inline, values offered from reference data) | backend validation |
| Upload limits and storage | Wrong file type; Oversized PDF (checked before upload); Renamed file, Damaged PDF (server message inline); Rejected image (checked before upload) | backend: storage outside repos |
| PDF viewer beside the editor | Page through; Jump to a page; Page out of range | — |
| Create a task with a source reference | Create a task; refusals inline (difficulty, page, grade, topic) | backend validation |
| Fast keyboard-first task entry | Sticky source and page; Timed entry (recording) | — |
| Task images | Attach and reorder images; Task without images | — |
| Answer modality | Graphic task is stored and filterable | backend: modality required (UI defaults to TEXT, so only the API can omit it) |
| Graphic tasks are never served in MVP | — | backend |
| Answer parts / Answer spec authoring | every spec type editable; refusals inline on `parts[i]…` paths; normalized interpretation shown after save | backend parses and validates |
| Hints | Ordered hints (reorder); Task without hints (no hint control); Empty hint (inline) | — |
| Translations | Add a Ukrainian translation; Partial translation; New locale by configuration (editor offers `ReferenceData.taskLocales`) | backend: unsupported locale |
| Externalized admin strings | source list, task editor, preview (the `⟦` test); mission editor | mission editor: slice 6 |
| Missions, Mission publishing rules | — | slice 6 |
| Preview and answer tester | Preview of a draft task; tester verdicts (CORRECT, WRONG, UNPARSEABLE with the Czech tip); Preview hides the source reference | "Preview matches the child task screen" pixel comparison needs the child screen (slice 7) |
| Task list filters and search | Combined filters; Text search; Empty query; No match | backend: matching rules |
| Draft and published status | status chip per task | backend |
| Bulk publish from the task list | Publish several drafts at once; per-task result | backend: limits, unknown ids |
| Task provenance | Open the source at the task's page | backend: never sent to the child |
| Edit existing content | task fields re-saved through `updateTask` (images need a saved task) | source edit, mission reorder: slice 6 |
| Delete only unused content, Topics from configuration, No workbook content | topic choices from reference data | slice 6; backend; repo checks |

## Screens and states

All admin screens render inside `AdminArea` (`lang="en"`, `AdminGate`) and a
shared `AdminLayout`: a header with the product name, links (Tasks, New task,
Sources) and Sign out, then the screen's `<main>`. Each screen has a loading
status line, an error alert with "Try again", and its content.

- `/admin` — home: heading "Admin", "You are signed in.", links.
- `/admin/sources` — upload form (file, title, publisher, edition, grade,
  subject; Upload source) and the source table (title, publisher, edition,
  grade, subject, pages, "View PDF", "New task"). Empty list: "No sources yet."
  Success: status "Source uploaded."
- `/admin/sources/view?sourceId&page` — heading with the source title, the
  PDF viewer at that page. Unknown or missing id: "Source not found." with a
  link back to sources.
- `/admin/tasks` — filter form, the task table (select, prompt excerpt, topic,
  status, modality, provenance, Edit / Preview / Open source), the bulk
  publish bar ("Publish selected (n)") and its result list. No match: "No tasks
  match."
- `/admin/tasks/edit` — two columns: PDF viewer (left, once a source is chosen)
  and the task form (right). New task: after a save the status "Task saved as
  draft." with "Edit saved task" and "Preview" links, the form resets but keeps
  source, page, topic, grade, difficulty and modality, and focus returns to the
  prompt. Existing task (`taskId`): the same form filled in, the status chip,
  provenance, the images section, "Task saved."
- `/admin/tasks/preview?taskId` — the child task view (Czech, `lang="cs"`)
  inside a framed "Child view" panel, and the "Answer tester" panel beside it.

PDF viewer: Previous page / Next page buttons, a "Page" number field with "Go"
(Enter submits), status "Page 57 of 120". An invalid entry (not a whole number
1..pageCount) keeps the page and shows "Enter a whole page number from 1 to
120." The page renders into a `<canvas>` with an accessible name
("PDF page 57").

## Design-system mapping

`Button` (primary for the one main action per screen: Upload source, Save task,
Publish selected, Check answers), `Chip` (DRAFT neutral, PUBLISHED spark,
GRAPHIC volt; tester verdicts: CORRECT spark, WRONG almost, UNPARSEABLE ink),
`Panel` for sections, `.dk-t-*` type classes, `.dk-card`, the child task
classes (`dk-task`, `dk-prompt`, `dk-part`, `dk-choice`, `dk-hint`, `dk-toggle`,
`dk-alt`). The design system's practice components carry Czech literals
(`Tvoje odpověď`, `Nápověda`, toggle wording), so `TaskView` uses their CSS
classes with catalog text instead of the components. Admin CSS
(`src/features/*/**.css`) uses only tokens (`var(--space-*)`,
`var(--radius-*)`, colour tokens); dense admin inputs use `.dk-t-body` sizing.

## Data flow

- Every request goes through `adminClient` (CSRF header, 401 → sign-in). PDF
  bytes and task images are fetched through it as blobs (`parseAs: 'blob'`)
  and shown from object URLs; the nginx CSP allows `blob:` images, and the
  PDF is drawn by pdf.js into a canvas (no frame: the CSP forbids framing).
- TanStack Query keys: `['admin','reference']`, `['admin','sources']`,
  `['admin','source',id]`, `['admin','source-file',id]`,
  `['admin','tasks',filters]`, `['admin','task',id]`,
  `['admin','preview',id,locale]`, `['admin','image',url]`. Mutations
  invalidate `['admin','tasks']`, `['admin','task',id]`,
  `['admin','preview',id]` and `['admin','sources']` as they change them.
- Problems: `ApiError` carries the status and `Problem`; `fieldErrors()` maps
  `errors[].field` to messages. Each input declares its path (`prompt`,
  `sourceRef.page`, `parts[1].spec.accepted[0]`, `translations.uk.hints[0]`,
  `file`, `q`), shows the message under itself, sets `aria-invalid` and
  `aria-describedby`; errors on paths no input shows are listed in a form
  alert. Focus moves to the first invalid input.
- No router library: every screen is a full page load and dynamic data rides
  in the query string (`taskId`, `sourceId`, `page`). Nothing needs in-app
  navigation state that survives a load, so the decision of slice 1 stands.

## Copy

English admin text under `admin.*` in `src/i18n/en.ts`; Czech child task text
under `child.task.*` in `src/i18n/cs.ts` (placeholder "Tvoje odpověď", hint
"Nápověda", translation toggle). Placeholders in catalog strings
(`{page}`, `{count}`) are filled by `format()`. Server messages (problem
`detail` and `errors[].message`, the tester's Czech `formatTip`) are shown as
received and marked `data-content`, like everything the admin typed.

## Accessibility

Every input has a visible `<label>`; groups use `fieldset`/`legend`; tables
use `<th scope>`; row checkboxes are labelled by the row's prompt excerpt
(`aria-labelledby`). Errors use `role="alert"` (form level) and
`aria-describedby` (field level); statuses use `role="status"`. Enter submits
every form; Ctrl+Enter submits the task form from a multi-line field. The
admin subtree is `lang="en"`, the child view `lang="cs"`, a translation
`lang="<locale>"`. Focus ring from `.dk-input`/`.dk-btn` and the admin CSS
(`box-shadow: var(--focus-ring)`). No animation is added.

## Testing

- Unit (Vitest, jsdom): each screen against `stubAdminBackend()` (now backed
  by the shared fake), pure modules (form model, problem mapping, upload
  checks, page parsing, format). pdf.js is replaced by a module mock.
- `⟦` test: routes are rendered signed in with their example query; text
  inside `[data-content]` must be one of the fake backend's data strings.
- E2E: one spec per screen family, keyboard paths included, API answered by
  the shared fake through `page.route` (skipped against a stack, like
  slice 2); a11y and theme specs reach admin screens signed in.
- NFR-8: `tools/record-nfr8.mjs` (the installed `record-demos.mjs` is
  framework-owned and its clip list cannot be extended without editing it)
  serves the build with `vite preview`, answers the API with the shared fake,
  types a single-part INTEGER task with the keyboard at a human pace (a fixed
  per-key delay), asserts the saved status and the elapsed time ≤ 60 s, and
  writes the `record-demos` manifest shape that `check-recordings` reads.

## Risks & mitigations

- pdf.js weight: dynamic `import()` keeps it out of the main bundle; the worker
  is a same-origin asset (CSP `script-src 'self'`).
- The fake backend could drift from the contract: it is typed with the
  generated `components['schemas']`, and the real-stack smoke after the merge
  replays the click path against the slice 5 backend.
- Recording against the fake, not the real backend: recorded as such in the
  manifest explainer; the post-merge smoke repeats the flow on the stack.
