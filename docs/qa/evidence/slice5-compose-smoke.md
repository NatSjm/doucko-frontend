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
