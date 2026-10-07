# Vision verification report

- Generated at (UTC): 2026-10-07, after 10:02:52Z (exact time of day not captured: no clock was available to the writer; lower bound is the last `trace/ledger.jsonl` entry, the review-gate run)
- Scope: 8 clip(s), `docs/qa/demo-recordings/slice8-gamification/manifest.json`
- Method: a vision judge reviewed each clip's final screenshot against the requirement it claims to prove. Verdicts are also stored per clip as `vision` in the manifest.

| clip | proves | met | readable | notes |
| --- | --- | --- | --- | --- |
| `slice8-hq-progress` | FR-37 | yes | yes | The rank card shows a red hexagon medal, 'HODNOST 2', 'Kadet' and '275 XP'. The yellow XP bar is about half full, with '125 z 250 XP do hodnosti Strážce' and 'Vyřešené úlohy: 5' below it. There is no negative XP, timer, streak or leaderboard, and the UI is Czech. The small grey 'HODNOST 2' label and bar caption look adequate by eye; worth confirming with an AA contrast check. |
| `slice8-hq-top-rank` | FR-37 | yes | yes | Shows 'HODNOST 5', 'Legenda', '1 600 XP' and a full XP bar with 'Nejvyšší hodnost!' under it. No 'do hodnosti' next-rank text appears, and the mission cards rendered fully. The 'Nejvyšší hodnost!' caption is very small mid-grey type; it probably passes AA, but as the key words for this requirement it would read better larger or bolder. |
| `slice8-rankup-hq` | FR-36 | yes | yes | A pink rank-up card shows 'NOVÁ HODNOST!', 'Kadet', 'Postoupila jsi na hodnost Kadet. Jen tak dál!', an original crimson hexagon medal with a gold star and sunburst halo, and a 'Super!' button. The progress card below matches ('HODNOST 2 / Kadet', '150 XP', 'Vyřešené úlohy: 5', '0 z 250 XP do hodnosti Strážce'). The small grey caption is legible; nothing is clipped or overlapping. |
| `slice8-rankup-reduced-motion` | FR-36, NFR-13 | yes | yes | The banner is fully shown: 'NOVÁ HODNOST!', 'Kadet', the congratulation line, and a fully drawn medal with a static gold halo. Nothing is faded, clipped or caught mid-animation. 'Super!' and 'Pokračovat' are white on red and meet AA. The smallest grey caption is still legible. |
| `slice8-rankup-task` | FR-36, FR-38 | yes | yes | The answer '0,75' is marked 'Správně'; the mint feedback card shows 'Výborně!' with a '+10 XP' sticker, and the pink 'NOVÁ HODNOST!' / 'Kadet' card sits above 'Další úloha →'. No negative XP. The focus ring on 'Další úloha' is visible. Minor: 'Správně' and the 'zbývá 2' chip are quite small, and 'Postoupila jsi' assumes a feminine gender (confirm intended). |
| `slice8-mission-complete` | FR-32, FR-38 | yes | yes | Shows 'Mise je splněná!', a '+35 XP' star sticker, 'Získala jsi 35 XP.', '☆ 1 na první pokus' and 'Úloh v misi: 2', with 'Zpět na HQ' and 'Zopakovat misi' buttons. No rank-up element, and no negative XP, minus sign or '+0 XP'. The grey 'Úloh v misi: 2' line has the lowest contrast but looks AA by eye. |
| `slice8-mission-complete-rankup` | FR-32, FR-36 | yes | yes | Shows 'Mise je splněná!', a '+30 XP' star badge, 'Získala jsi 30 XP.', '☆ 1 na první pokus' and 'Úloh v misi: 1'. The second card has the medal with its halo, 'NOVÁ HODNOST!', 'Kadet' and the congratulation sentence. The grey 'Úloh v misi: 1' is the faintest text but looks AA; nothing is clipped, overlapping or mid-animation. |
| `slice8-replay` | FR-33, FR-32 | yes | yes | Shows 'Opakování je hotové!' and a card with 'Získané XP: 0. Za opakování se XP nepřipisují, ty už máš z prvního průchodu.' (kind, not punishing), '1 na první pokus' and 'Úloh v misi: 1', plus 'Zpět na HQ' and 'Zopakovat misi' buttons. The grey 'Úloh v misi: 1' line is close to the AA minimum but passes by eye. |

Summary: 8 of 8 clips met their requirement, and 8 of 8 are readable. The full verdict text for each clip is in the manifest's `vision.notes`.

## Failures

None: no clip has `met: false` or `readable: false`.

Advisories (not failures):

- `slice8-hq-top-rank`: the 'Nejvyšší hodnost!' caption is very small mid-grey type. It carries the top-rank state, so a larger or bolder style was suggested.
- `slice8-hq-progress` (and the grey captions on the summary screens): the small grey text looks close to the AA contrast limit by eye. An automated contrast check (a11y spec) is the authority here, not this eyeball verdict.
- `slice8-rankup-task`: the copy 'Postoupila jsi' (also on the HQ and summary rank-up cards, and 'Získala jsi' on the summary) assumes a feminine gender. Confirm this is intended.
- `slice8-rankup-reduced-motion`: a still image can't prove that nothing moves (NFR-13). That proof rests on the e2e/a11y reduced-motion assertions.
