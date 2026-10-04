# Slice 5 (implement-authoring-tasks-ui) — real-stack smoke, task 4.4

- **Status:** NOT RUN.
- **Why:** the running Compose stack (project `doucko`, port 8081) is the owner's, started from the
  main checkouts, and has no slice 5 backend (`implement-authoring-tasks-api` is built in parallel in
  its own worktree). It must not be restarted or replaced from this worktree (`stack:up` not run).
- **When:** after both slice 5 halves are merged and the stack is rebuilt from `main`.

## Click path (http://127.0.0.1:8081, a self-authored PDF from `fixtures/self-authored/`)

1. `/admin` → sign in. The header shows Admin home, Tasks, New task, Sources.
2. Sources: choose a `.docx` → "Only PDF files up to 50 MB are allowed.", nothing sent. Choose a
   self-authored 12-page PDF, title, publisher, edition 1, grade 6, subject Math, Enter → "Source
   uploaded."; the row shows 12 pages. A truncated PDF → "The PDF could not be read. It may be
   damaged or password-protected." on the file field.
3. "View PDF" → page 1 drawn; Next page → 2; type `7`, Enter → page 7; `13` → range message, page stays.
4. "New task" on the row → editor with the source and page 1, PDF beside, focus in the prompt. Type a
   prompt, Tab, arrow to a topic, Tab, task number, Tab ×3, expected `12`, Enter → "Task saved as
   draft.", source and page stay, focus in the prompt (NFR-8; time it, ≤ 60 s).
5. Save once with `12,5` as an INTEGER answer → the server message sits under that answer.
6. "Edit saved task" → attach two PNGs, move the second earlier; a GIF is refused before upload.
   Add a hint and a `uk` prompt, save → "Task saved."; "Read as" shows the normalized value.
7. Preview: Czech prompt, images in the new order, hint opens, "Zobrazit překlad" shows the `uk`
   prompt; no source title or page. Tester: `0,50` on a DECIMAL 0.5 part → CORRECT, read as 0.5;
   `5,,2` → UNPARSEABLE with the Czech tip.
8. Tasks: filter by the source, page 1, status Draft → the task; search `obdelnik` (diacritics-free)
   finds a prompt with "obdélník"; "Open source" opens the viewer at the task page; select the task,
   "Publish selected (1)" → listed as published, status chip Published.
9. Sign out → sign-in form.


## Run after the merge (2026-10-04, backend `main` at `b80321a`, frontend `main` at `6b7df30`)

**Result: PASS.** `npm run stack:up` rebuilt the stack from `main` (migration V2 applied, volume
`doucko-storage` created). Every request went through nginx on `127.0.0.1:8081`. Files were
self-generated: a blank 3-page and a blank 12-page PDF, and a 1×1 PNG (NFR-4). The admin password
came from `.env` and was never printed.

### UI (built-in browser, signed in with the real password)

| Step | Result |
|---|---|
| `/admin/sources` lists the uploaded 12-page source (uploaded through the API: the browser pane cannot drive a file picker) | 12 pages shown, with View PDF and New task |
| Viewer opened at page 7 | "Page 7 of 12", page drawn by pdf.js on a canvas (CSP holds) |
| Next page; then page 13 typed | Page 8; "Enter a whole page number in the range 1–12.", page stays 8 |
| Editor from source and page 1, keyboard only (prompt, Tab, Arrow for topic, Tab, task no, Tab ×3, answer, Enter) | Focus started in the prompt; three Tabs reached "Accepted answer 1" |
| Save with `12,5` on an INTEGER part | Refused: "This value is not a whole number. Use the DECIMAL type for it." |
| Corrected to `14`, Enter | "Task saved as draft." 15.8 s after the first keystroke, refusal detour included (NFR-8 limit 60 s); prompt cleared, source and page kept, focus back in the prompt |
| Preview | Czech child view, no source title or page |
| Tester `14` / `14,,2` | CORRECT, "Read as 14" / UNPARSEABLE, tip "Tohle číslo neumím přečíst. Napiš celé číslo, třeba 4827." |
| Tasks: status Draft, search `obdelnik` | Finds the "obdélník" prompt; row shows "UI smoke sešit, Page 1 · Task 1" and "Open source" at page 1 |
| Select the task, "Publish selected (1)" | Publish result "…: Published"; the Draft filter then shows 0 tasks |
| Sign out | Sign-in form |

Not covered in the browser: the client-side file-type and size refusals, and image attach/reorder
(the pane cannot choose files). Unit and e2e tests cover them.

Clean-up: the smoke task and source were deleted through the API (204, 204). Sources and tasks lists
are empty again, and `/var/lib/doucko/storage` holds no files. The admin password appears 0 times in
`docker compose logs backend`. The stack was left running.

### API (scripted, Node `fetch`)

| Step | Expected | Got | OK |
|---|---|---|---|
| sign in | 204 | 204 | yes |
| reference data | 200, grades [6], 9 topics, taskLocales [uk] | 200, grades [6], 9 topics, taskLocales ["uk"] | yes |
| upload source | 201, pageCount 3 | 201, pageCount 3 | yes |
| source with grade 7 refused | 400 | 400 | yes |
| PNG as source refused | 415 | 415 | yes |
| upload without CSRF header | 403 | 403 | yes |
| source file served | 200 | 200 | yes |
| create task | 201, DRAFT | 201, DRAFT | yes |
| add image | 201 | 201 | yes |
| preview | 200, no source info | 200, no source info | yes |
| answer tester "12" | CORRECT | CORRECT | yes |
| answer tester "dvanáct" | UNPARSEABLE | UNPARSEABLE | yes |
| search finds the task | true | true | yes |
| bulk publish (1 real, 1 unknown) | 200 with a per-task result | 200 [{"taskId":"f25ca15d-da1d-495d-a75a-4d69cef26122","published":true,"reason":null},{"taskId":"00000000-0000-4000-8000-000000000000","published":false,"reason":"n | yes |
| files on the doucko-storage volume | source .pdf and image .png | /var/lib/doucko/storage: images sources /var/lib/doucko/storage/images: 559b282f-06b2-455c-83cb-cb41d82737de.png /var/lib/doucko/storage/sources: f8b5da25-a45c-4c3e-9f55-f88a637ab3f2.pdf | yes |
| delete task | 204 | 204 | yes |
| delete source | 204 | 204 | yes |
| files removed with source and task | no smoke files left | none left | yes |
| migrations applied | 1, 2 | 1, 2 | yes |
| admin password in backend log | 0 | 0 | yes |
| sign out | 204 | 204 | yes |

An earlier run of the same script failed from step 7 on because the script read `id` instead of the
contract's `sourceId` / `taskId` (a script bug, not an app fault). Its leftover source was deleted
before the passing run.
