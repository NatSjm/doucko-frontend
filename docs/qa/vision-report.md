# Vision verification report

- Generated at (UTC): 2026-10-07 (date only; the time of day was not captured)
- Scope: 8 clip(s), `docs/qa/demo-recordings/slice8-gamification/manifest.json`
- Method: a vision judge reviewed each clip's final screenshot against the requirement it claims to prove. Verdicts are also stored per clip as `vision` in the manifest.

| clip | proves | met | readable | notes |
| --- | --- | --- | --- | --- |
| `slice8-hq-progress` | FR-37 | yes | yes | The rank card shows a red hexagon medal, 'HODNOST 2', 'Kadet' and '275 XP'. The yellow XP bar is about half full, with '125 z 250 XP do hodnosti Strážce' and 'Vyřešené úlohy: 2' below it. There is no negative XP, timer, streak or leaderboard, and all text is Czech. The small grey caption and the 'HODNOST 2' eyebrow look close to the AA limit by eye but still read clearly. |
| `slice8-hq-top-rank` | FR-37 | yes | yes | Shows 'HODNOST 5', 'Legenda', '1 600 XP' and a full XP bar with 'Nejvyšší hodnost!' under it. No 'do hodnosti' next-rank text appears. The 'Nejvyšší hodnost!' caption and the 'HODNOST 5' label are very small (about 11–12px): readable, but they would look better one size step larger. |
| `slice8-rankup-hq` | FR-36 | yes | yes | A pink celebration card shows 'NOVÁ HODNOST!', 'Kadet', 'Postoupila jsi na hodnost Kadet. Jen tak dál!' and a 'Super!' button. The medal is original art: a red hexagon with a gold star and halo, not borrowed from anime or manga. The progress card below shows the same rank (160 XP, '10 z 250 XP do hodnosti Strážce'). The small grey lines meet AA by eye. |
| `slice8-rankup-reduced-motion` | FR-36, NFR-13 | yes | yes | The banner and medal are fully rendered with a static halo. Nothing is faded, half-drawn or caught mid-animation. The small grey caption is still legible. Limitation: a single still can't show that no animation runs, only that every element is at its final, fully opaque state. |
| `slice8-rankup-task` | FR-36, FR-38 | yes | yes | The answer '0,75' is marked 'Správně', and the mint feedback panel shows 'Výborně!' with a '+10 XP' sticker. The pink rank-up card ('NOVÁ HODNOST!', 'Kadet') sits above 'Další úloha →'. There is no negative XP. The 'Správně' label, the 'zbývá 2' chip and the 'Nahlásit problém' link are small but have enough contrast. |
| `slice8-mission-complete` | FR-32 | yes | yes | Shows 'Mise je splněná!', a '+35 XP' starburst, 'Získala jsi 35 XP.', '1 na první pokus' and 'Úloh v misi: 2'. The 'Zpět na HQ' and 'Zopakovat misi' buttons are present, with no rank-up banner. The lightest text, the slate-grey 'Úloh v misi: 2' on pink, still looks above AA by eye. Nothing is clipped. |
| `slice8-mission-complete-rankup` | FR-32, FR-36 | yes | yes | Shows 'Mise je splněná!', a '+30 XP' starburst, 'Získala jsi 30 XP.' and '1 na první pokus'. The rank-up card shows 'NOVÁ HODNOST!', 'Kadet', the medal with its halo, and the congratulation sentence. The grey 'Úloh v misi: 1' line is the lightest text and is still readable. Nothing overlaps, and there is no loading or empty state. |
| `slice8-replay` | FR-33 | yes | yes | Shows 'Opakování je hotové!' and 'Získané XP: 0. Za opakování se XP nepřipisují, ty už máš z prvního průchodu.', plus '1 na první pokus' and 'Úloh v misi: 1'. The 'Zpět na HQ' and 'Zopakovat misi' buttons are present. The wording is kind and nothing is red or punishing. The grey 'Úloh v misi: 1' line has the weakest contrast but passes AA by eye. |

Summary: 8 of 8 clips met their requirement, and 8 of 8 are readable. The full verdict text for each clip is in the manifest's `vision.notes`.

## Failures

None: no clip has `met: false` or `readable: false`.

Advisories (not failures):

- `slice8-hq-top-rank`: the 'HODNOST 5' eyebrow and the 'Nejvyšší hodnost!' caption are very small (about 11–12px). One type step larger was suggested.
- `slice8-hq-progress`: the small grey caption and the eyebrow look close to the AA contrast limit by eye. An automated contrast check (a11y spec) is the authority here, not this eyeball verdict.
- `slice8-rankup-reduced-motion`: a still image can't prove that nothing moves (NFR-13). That proof rests on the e2e/a11y reduced-motion assertions.
- The judge's proof column differs from the manifest for two clips. `slice8-mission-complete` was judged for FR-32 only, but the manifest claims FR-32 and FR-38. `slice8-replay` was judged for FR-33 only, but the manifest claims FR-33 and FR-32. The extra FR in each case has no vision verdict.
