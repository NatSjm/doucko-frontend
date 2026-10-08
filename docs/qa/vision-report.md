# Vision verification report

> **Superseded for `phase6-admin-theme` (2026-10-08):** after this run the 11 `rec-*` clips were re-recorded to address review-gate findings (stronger FR-1/FR-2/FR-8/FR-11/FR-39/FR-58 assertions), which replaced their stills and dropped their `vision` verdicts from the manifest. Their rows below judge the previous stills and are NOT current; a vision-verify re-run over those 11 clips is open (not run: the session cost cap was reached). The slice6, slice7, slice8 and nfr8 verdicts are current.

- Generated at (UTC): 2026-10-08, after 18:05:07Z. The exact time of day wasn't recorded because the writer had no clock. The lower bound is the `finishedAt` of the previous vision-verify run, `trace/workflow-runs/20261008-180053-vision-verify.json`, which this re-run (round 2, args `docs/qa/workflow-args/vision-verify-phase6-r2.json`) follows.
- Scope of this run: 16 clip(s) re-judged after re-recording, from `docs/qa/demo-recordings/{phase6-admin-theme,slice6-authoring-missions}/manifest.json`.
- Method: a vision judge checked each clip's final screenshot against the requirement the clip claims to prove. Each verdict is stored as `vision` in its manifest, which `check-recordings` / `check-vision` gate on. The table notes are shortened; the full text is in `vision.notes`.
- Not re-judged in this run: the 9 clips in `nfr8-task-entry` and `slice7-practice-flow` keep their round-1 verdicts from 2026-10-08 (9/9 met and readable), and the 8 `slice8-gamification` clips keep their earlier verdicts (8/8 met and readable). Those verdicts are in their manifests.

| clip | proves | met | readable | notes |
| --- | --- | --- | --- | --- |
| `rec-source-upload` | FR-1 | yes | yes | 'Source uploaded.' banner; the row 'Matematika 6 – pracovní sešit' shows publisher, edition 1, grade 6, Math and 12 pages, plus View PDF/New task/Edit. The grey "PDF, at most 50 MB." helper is the faintest text but looks AA. |
| `rec-pdf-beside-editor` | FR-2 | yes | yes | The viewer sits left of the editor, rendered at 'Page 30 of 120', with Previous/Next and Go to page; the prompt 'Rozepsaná úloha' is kept. The editor's Page field says 57 while the viewer is on 30, which could confuse a reader. |
| `rec-task-images` | FR-4 | yes | yes | Two images fully rendered side by side in the reordered order: the green tile "2", then the blue tile "1". (Round 1 failed here because the images were ~2px specks; that is fixed.) |
| `rec-parts-hints-translations` | FR-6, FR-7, FR-8 | yes | yes | 'Task saved.'; Part 1 Decimal 0.5 'a', Part 2 Whole number 3 'b'; hints 1–3 in order; Translation (uk) has the prompt and hint 1 filled. The nav highlights 'New task' on Edit task. |
| `rec-preview-tester` | FR-10, FR-7, FR-8 | yes | yes | The Czech prompt has the Ukrainian translation below it; hint 1 of 2 is open; the tester shows 0,50 → CORRECT, 'Read as 0.5'. The translation is below, not beside, and a stray dot sits under it (cosmetic). |
| `rec-task-list-provenance` | FR-11, FR-13 | yes | yes | The PDF viewer shows 'Page 57 of 120' with the page rendered. The FR-11 filtered list and the 'Open source' click aren't in the frame, so they rest on the recording. |
| `rec-skin-hq` | FR-39 | yes | yes | Czech HQ with 'HODNOST 1 / Nováček', an original crimson hexagon medal and 0 XP → Kadet. No manga or anime terms or logos. The small grey secondary text is light but looks AA. |
| `rec-stats` | FR-40 | yes | yes | Success metric NOT MET (short week 2026-09-14); the weekly table shows tasks/session '12, 10, 11', hints 7 and revealed 3; first-try 'Desetinná čísla 75%, 6 of 8'. |
| `rec-flag-queue` | FR-41 | yes | yes | Mint banner 'Fixed: … is now correct. +4 XP added for the child.' The '0,5' entry is FIXED (WRONG → CORRECT); two entries are DISMISSED; one OPEN entry still has its actions. (Round 1 failed here because the fix banner was missing; that is fixed.) |
| `rec-theme-light` | FR-58 | yes | yes | The light theme is fully painted and there is no in-app toggle. The beige progress dots are very faint (decorative). |
| `rec-theme-dark` | FR-58 | yes | yes | The dark theme is fully painted and there is no toggle. The lavender small text looks AA. The navy-on-navy progress dots are decorative; the '0/3 vyřešeno' text says the same thing. |
| `slice6-mission-create-reorder-publish` | FR-9, FR-55 | yes | yes | The tasks are in the reordered order, every row is PUBLISHED, and the mission is PUBLISHED with 'Mission published.' (Round 1 failed here because rows still showed DRAFT; that is fixed.) The nav highlights 'New mission' on the Edit page. |
| `slice6-mission-publish-refused` | FR-9 | yes | yes | An orange (not red) refusal gives the server reason and links both DRAFT tasks; the mission stays DRAFT. The nav highlights 'New mission' on the Edit page. |
| `slice6-mission-list` | FR-9 | yes | yes | The Missions nav item is active. The table shows 'Desetinná čísla' 1, 2/10, DRAFT and 'Obvod a obsah' 1, 1/10, PUBLISHED. |
| `slice6-source-edit-delete-refused` | FR-55 | yes | yes | The form has no file field and Edition reads 2; the orange refusal lists the 3 referencing tasks. The still can't prove the edit was stored. |
| `slice6-task-status-blocked` | FR-55 | yes | yes | The refusal 'Unpublish the mission first' links the mission; Delete is disabled with an explanation; the PUBLISHED badge is ~1,600px above the panel. |

Summary: 16 of 16 re-judged clips met their requirement and 16 of 16 are readable. With the 17 clips that weren't re-judged (all met and readable), all 33 recorded clips now carry `met: true, readable: true`. These are model judgments over stills. The verdict on the gate belongs to `check-vision` / `check-recordings`, which haven't been run against these manifests yet.

## Failures

None in this run. The three round-1 failures (`rec-task-images` FR-4, `rec-flag-queue` FR-41, `slice6-mission-create-reorder-publish` FR-9/FR-55) were re-recorded, and they are now judged met.

Advisories (not failures):

- `slice6-mission-publish-refused`, `slice6-mission-create-reorder-publish`, `rec-parts-hints-translations`: the admin nav highlights 'New mission' / 'New task' on the Edit pages.
- `rec-pdf-beside-editor`: the viewer is on page 30 while the editor's Page field says 57. Confirm this is intended, or align them so the still reads clearly.
- `rec-preview-tester`: the translation sits below the Czech, not beside it, and a stray dot shows under the translation block.
- `rec-flag-queue`: the small orange 'WRONG' pill text on its pale orange fill is borderline; a slightly darker orange would help.
- `rec-theme-light` / `rec-theme-dark` / `rec-skin-hq`: the empty progress dots are low contrast (decorative; the "x/N vyřešeno" text says the same thing). A 3:1 non-text contrast check is worth doing.
- Some stills show only where the flow ends (`rec-task-list-provenance`, `slice6-source-edit-delete-refused`, `slice6-task-status-blocked`). The intermediate steps rest on the clip assertions, not on the pixels.
- The contrast calls are by eye. The automated a11y check is the authority.
