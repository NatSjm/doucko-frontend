# Design — implement-practice-flow-ui

## Goals / Non-goals

Goals: the child half of practice-flow — HQ, the mission briefing and the
task screen with attempts, reveal, format tips, hints, the translation toggle,
report a problem, and save / resume — keyboard-first, Czech, never punishing.

Non-goals: re-implementing the backend rules. The UI shows what the server
stores and answers (verdicts, locks, states, refusals). It only prevents what
the spec puts on the client: an empty part is not sent, an input holds at most
100 code points, "Jiné" needs a note, the note holds at most 1000. XP, ranks,
the mission-complete screen and replay are slice 8; the task screen shows
`+n XP` only when the server awards it (`xpAwarded > 0`; 0 until slice 8).

### Store-spec scenarios: slice 7 UI vs elsewhere

| Requirement (practice-flow) | Slice 7 UI (this change) | Elsewhere |
|---|---|---|
| HQ without login | Open the app in a fresh browser (HQ at `/`, no login form, no profile picker) | backend: Child API needs no credentials |
| Mission list on HQ | Mission states, Revealed tasks count, Attempted but unresolved, Grouping and order, All published missions are open, Unpublished content is invisible (FR-12 carry-over), Empty HQ, Shared task counts in both missions (the UI shows the server's counts) | backend: counts, sharing, continue skips |
| Start or continue within two clicks | Continue (1 click), Most recent wins (server `continueTarget`), Start a new mission (2 clicks), Nothing to continue (button hidden) | backend: the target |
| Task screen | Multi-part task (focus in input a), Keyboard only, Every control reachable by keyboard, Empty part, Load time (stack-only e2e), Unknown or unpublished mission | — |
| Task-scoped requests are checked | a 404 on a task shows "Tuhle úlohu jsem nenašel." with a way back | backend: the 404 rules |
| Two attempts, then reveal | Correct on the first attempt, Wrong first attempt, Second attempt re-enters only wrong parts, Correct on the second attempt, Reveal (no error colour, no "Špatně"/"Chyba", no motion), Locale-formatted numbers (sent as typed), Unreadable input keeps the attempt, No third attempt (a 409 re-reads the stored state), Check round-trip time (stack-only e2e) | backend: grading, locks, 400/409 |
| Oversized input | Input field stops at the limit (100 code points); note field at most 1000 | backend: 400/413, huge integers |
| Hints on demand | Before the first attempt, in order with the counter 2 → 1 → 0, after a reveal, survive a reload, No hints left (button disabled), Task without hints (no button) | backend: recording, 409 |
| Ukrainian translation toggle | Toggle on, Toggle remembered (profile setting), No translation ("Překlad není k dispozici"), Translated hint | child-profile: the setting |
| Report a problem | after a wrong verdict, before any attempt, after a reveal, Other reason needs a note | backend: attached raw input, 400 |
| Save and resume | Resume after closing the browser, Resume skips resolved tasks, Server unreachable on submit, Response lost after the attempt was stored | backend: storage |
| Mission complete screen, Replay | the last resolution shows "Mise je splněná!" with a way back to HQ | slice 8 (FR-32, FR-33) |
| Deterministic feedback (tutor seam) | the UI reads verdicts from `parts` and the reveal from `feedback.revealedAnswers` | backend (FR-44) |

## Screens and states

Every child screen: a top bar with the "Doučko" brand (a link to HQ) and the
screen's `<main>` with one `h1`. Loading: "Načítám…" (`role="status"`). Load
error (network or 5xx): "Nepodařilo se to načíst." with "Zkusit znovu".

- `/` HQ — hero panel: `h1` "Ahoj, {name}!", intro line, and the primary
  "Pokračovat" link to `/task?missionId=…&taskId=…` when `continueTarget` is
  set (hidden otherwise). Per topic a section with `h2` "Síla: {topic}" and a
  list of mission cards (links to `/mission?missionId=…`): "Mise {position}",
  a state chip (Nová / Rozdělaná / Splněno), the segment bar and
  "{x}/{N} vyřešeno". No card is locked. Empty: "Zatím tu žádná mise není.
  Brzy nějaká přibude!" and no error.
- `/mission?missionId=…` briefing — kicker "Síla: {topic}", `h1`
  "Mise {position}", "{x}/{N} vyřešeno", the ordered task list ("Úloha n" with
  its state word), the primary start link to `/task?missionId=…` ("Začít
  misi" for a new mission, "Pokračovat v misi" in progress); a complete
  mission says "Tuhle misi máš splněnou." (replay is slice 8). 404: "Tuhle
  misi jsem nenašel." with "Zpět na HQ". Without `missionId`: the same.
- `/task?missionId=…[&taskId=…]` task screen — without `taskId` it loads
  `getCurrentTask` and writes the task id into the URL (replaceState), with it
  `getTask`. 204 from `getCurrentTask`: "Mise je splněná!" with "Zpět na HQ".
  404: "Tuhle úlohu jsem nenašel." with "Zpět na HQ".
  - Head: "Zpět na HQ" link, `h1` "Úloha {position}", the attempt indicator
    ("Použité pokusy: {used} ze 2"; no pips, whose design-system meaning is "attempts left").
  - Card (`dk-card dk-task`): the Czech prompt; the translation under it
    (`lang`) when the server sends it; images (`alt` "Obrázek n"); the answer
    form: one part per answer part. Typed parts: a labelled input (`dk-part`)
    with the unit after it; choice parts: a fieldset of options (`dk-choice`).
    Below the parts the opened hints (`dk-hint`, "Nápověda n z N"), then the
    tools row: the translation toggle and "Nahlásit problém".
  - Part states: idle; empty on submit → "Vyplň prosím odpověď" under the part
    (`aria-invalid`, nothing sent); wrong (`dk-part-wrong`, `almost`, icon
    and the word "Zkus znovu"); locked correct (`dk-part-correct`, read-only,
    "Správně"); unreadable → the server's format tip under the part; revealed
    (`dk-part-revealed`, neutral) → the correct answer in the field, "Správná odpověď: …"
    and "Tvoje odpověď: …" when the child typed one (choice keys shown with their option text); after a correct resolution every part is locked.
  - Feedback (`role="status"`, `dk-fb`): correct → `dk-fb-correct` "Výborně!"
    and "+n XP" when `xpAwarded > 0`; wrong → `dk-fb-almost` "Skoro! Zkus to
    znovu." with "Máš ještě jeden pokus."; revealed → `dk-fb-revealed`
    "Nevadí, příště!"; unreadable → `dk-fb-format` "Tohle neumím přečíst" and
    "Tenhle pokus se nepočítá."; failed save → an alert "Nepodařilo se to
    uložit. Zkus to prosím znovu."
  - Actions: the hint button "Nápověda · zbývá n" (absent without hints,
    disabled at 0), and the primary "Odeslat" (while unresolved) or "Další
    úloha" (resolved; to `/task?missionId=…`) or, when the resolution completed
    the mission, "Mise je splněná!" with "Zpět na HQ".
  - Translation toggle: `aria-pressed` follows what the screen shows (the server
    sends `LocalizedText.secondary` exactly when the setting is on), "Zobrazit ukrajinsky" / "Skrýt
    ukrajinštinu"; when the task has no translation a disabled "Překlad není
    k dispozici". A failed save keeps the old state and says "Nastavení
    překladu se nepodařilo uložit. Zkus to prosím znovu."
  - Report dialog (non-modal `role="dialog"` after the card): reasons as
    radios ("Myslím, že moje odpověď je správně", "Zadání je nejasné",
    "Jiné"), "Poznámka" (at most 1000 characters), "Odeslat hlášení",
    "Zrušit"; Escape closes. No reason → "Vyber prosím, co nesedí."; "Jiné"
    without a note → "Napiš prosím krátce, co nesedí." Sent → the dialog
    closes and "Díky, podívám se na to!" is shown; failure → "Hlášení se
    nepodařilo odeslat. Zkus to prosím znovu." (the dialog stays).

## Design-system mapping

`Button` (primary: Pokračovat, start, Odeslat, Další úloha; secondary: hint,
retry, cancel), `Chip` (Nová `hero`, Rozdělaná `volt`, Splněno `spark` +
check), `Icon`, and the DS classes `dk-card`, `dk-task`, `dk-prompt`, `dk-alt`,
`dk-part*`, `dk-input`, `dk-unit`, `dk-choices`/`dk-choice*`, `dk-fb*`,
`dk-hint*`, `dk-pips`/`dk-pip`, `dk-toggle`, `dk-link`, `dk-mission*`,
`dk-segs`/`dk-seg`, `dk-panel-hero`. The DS components that carry their own
Czech literals (`MissionCard`, `AttemptDots`, `Feedback`, `HintButton`,
`HintCard`, `AnswerPart`, `TaskPrompt`) are not used, so every string comes
from the catalog (the `⟦` test). New CSS in `src/features/child/child.css`,
`src/features/hq/hq.css`, `src/features/task/practice.css`, tokens only.
Correct sits on `spark`, wrong on `almost`, revealed on neutral `ink`/`panel`
(never `almost`, never `hero`).

## Data flow

- `childClient` (openapi-fetch over the generated `paths`, same origin, no
  session, no CSRF); errors through `unwrap` → `ApiError` (status, problem).
- Query keys: `['child','hq']`, `['child','mission',id]`,
  `['child','task',missionId,taskId|'current']`, all with `gcTime: 0` and shown
  only once fetched after mount, so a visit never shows a cached copy from
  before the last answer (review F06, and "Další úloha" after a task opened by
  mission only).
  The task screen copies the loaded `TaskView` into local state and keeps it
  in step with every server answer (attempt result → `attemptsUsed`, `state`,
  `lastFeedback`; opened hint → `hints.opened`; translation → re-read task).
- The part view is derived from `TaskView.state`, `attemptsUsed` and
  `lastFeedback` (pure model `practice.ts`), so a reload and a live answer
  render the same.
- Submission: the answers of every part that is not locked (strings as typed;
  choice parts as arrays of option keys). Network failure → the alert, inputs
  kept, `resync` set; the next submit first re-reads the task (`getTask`) and,
  if the server already stored an attempt, shows that verdict instead of
  sending; the result is applied with a functional update, so a hint or
  translation that arrived meanwhile is kept. 409 → re-read and show. 404 →
  not-found state. 400/413 → the save alert without a re-read (a refusal stores
  nothing); 5xx or no response → the alert and a re-read before the next send.
- Hints: a 409 (all open elsewhere) re-reads the task's hints; when the last
  hint opens, focus moves to it (the button is disabled).
- Load errors: 404 and 400 (an id in the URL that is not a UUID) are a dead end;
  anything else is "Nepodařilo se to načíst." with a retry. The child UI never
  shows the server's English `detail`, only Czech catalog text.
- Translation: `updateProfileSettings({secondaryTaskLocale: 'uk' | null})`
  then a re-read of the task (`LocalizedText.secondary` is set by the server);
  `getProfileSettings` is not needed on the task screen.
- Navigation: `navigate(href)` (history.pushState + an event) and `Link`
  (plain `<a href>`, intercepted for unmodified left clicks); `App` re-renders
  the current route on navigation and popstate and remounts the screen when
  path or query change.

## Copy

Czech `child.*` keys (catalog `src/i18n/cs.ts`), feminine *ty* where Czech
needs it: `child.common.*` (back to HQ, loading, load failed, retry),
`child.hq.*` (greeting, intro, continue, topic, mission, progress, states,
empty), `child.mission.*` (start, continue, complete, not found, task list and
task states), `child.task.*` (title, attempts, submit, next, required, correct,
xp, almost, revealed, correct answer, part states, format, save failed,
mission done, not found, hints left, hint failed, translation on / off /
unavailable / failed), `child.report.*` (open, title, reasons, note, send,
cancel, reason required, note required, thanks, failed). Server text (format
tips, prompts, hints, labels, option texts, topic names, the display name in
the greeting) is shown as received and content is marked `data-content`.

## Accessibility

Keyboard path on the task screen: input a (focused on load) → … → Odeslat →
hint → translation toggle → Nahlásit problém; Enter in any input (also on a
radio or checkbox) submits; Enter or Space activates buttons. After a wrong
or unreadable answer focus goes to the first part to fix, after a resolution
to "Další úloha", after an empty-part refusal to the first empty part. The
report dialog moves focus to its first reason; Escape or "Zrušit" closes it
and returns focus to "Nahlásit problém". Feedback is `role="status"`,
failures `role="alert"`. Visible focus ring from the DS on every control.
No animation (the DS motion turns off under `prefers-reduced-motion`; the
child screens add none). WCAG AA: DS tokens only; the a11y gate scans the
three child routes in light and dark.

## Testing

- Unit (Vitest): `practice.ts` (part view from a result, answers to send,
  empty parts, code-point clamp, revealed answer text), navigation and
  `Link`, HQ, briefing and task screens against the shared contract stub.
- E2E (Playwright, chromium / msedge / firefox):
  `e2e/practice-hq.spec.ts` (FR-24, FR-25, NFR-7), `e2e/practice-task.spec.ts`
  (FR-26, FR-27, FR-22, NFR-7), `e2e/practice-help.spec.ts` (FR-28, FR-29,
  FR-30), `e2e/practice-resume.spec.ts` (FR-31), `e2e/practice-timing.spec.ts`
  (NFR-5, stack-only: skips without `E2E_BASE_URL`; the graded-submission
  part also needs `E2E_PRACTICE_WRITES=1`, because it writes attempts).
- `⟦`, a11y (light, dark, reduced motion) and theme gates pick the child
  routes up from the registry, served by the contract stub.
- Recordings: `tools/record-slice7.mjs` (asserted clips with stills).

## Risks & mitigations

- The backend's exact refusal shapes are not known to the stub: the UI keys
  only on status codes (404 not found, 409 re-read, 400/5xx/no response →
  save failed) and shows server text only where the contract defines it
  (`formatTip`). The real-stack smoke after the merge replays the flows.
- The NFR-5 timing test needs a seeded stack; under `vite preview` it is
  skipped and the result is NOT claimed — the stack run is the owner's task.
- XP fields are 0 until slice 8, so "+n XP" is not visible against the real
  backend yet; the unit test covers it with a non-zero award.
