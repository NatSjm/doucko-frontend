# Fixture and asset provenance (NFR-4, CA-D21)

Every fixture file (`fixtures/**`, `e2e/fixtures/**`, `evals/cases/**`), every
skin asset (`public/**`, `src/assets/**`, `src/design-system/fonts/**`,
`src/design-system/icons/**`) and every image, font, audio, video or PDF file
anywhere in the repository is listed here (generated QA evidence under
`docs/qa/` and the pinned `contract/` excepted). Workbook content (text,
images, answer keys, PDFs) is never committed. Fixtures must be
`self-authored`. A skin asset may also be `licensed: <SPDX id>`, with its
licence file (same origin and author) listed beside it.
`src/test/provenance.test.ts` fails on an unlisted file, a disallowed origin,
a missing author, a missing licence file, a listed file that does not exist,
or a row that does not have the shape below.

| Path | Origin | Author | What it is |
|---|---|---|---|
| `e2e/fixtures/profile.ts` | self-authored | Doučko project | Fictional e2e display name and the real-name guard (NFR-3) |
| `e2e/fixtures/test.ts` | self-authored | Doučko project | Playwright `test` that runs the real-name guard after every test (NFR-3) |
| `e2e/fixtures/admin.ts` | self-authored | Doučko project | Playwright helper answering the admin API from the shared fake backend (contract stub, self-authored seed; since slice 9 also the stats history and the flag-queue reports, notes and raw inputs of `src/test/fake-progress-backend.ts`) |
| `e2e/fixtures/child.ts` | self-authored | Doučko project | Playwright helper answering the child API from the shared fake backend (contract stub, self-authored practice seed, fictional display name) |
| `src/design-system/fonts/DelaGothicOne-Regular.woff2` | licensed: OFL-1.1 | The Dela Gothic Project Authors | Display font |
| `src/design-system/fonts/DelaGothicOne-OFL.txt` | licensed: OFL-1.1 | The Dela Gothic Project Authors | Its SIL Open Font License |
| `src/design-system/fonts/Rubik-Variable.woff2` | licensed: OFL-1.1 | The Rubik Project Authors | Text font |
| `src/design-system/fonts/Rubik-OFL.txt` | licensed: OFL-1.1 | The Rubik Project Authors | Its SIL Open Font License |
| `src/design-system/icons/README.md` | self-authored | Doučko design system | Icon set notes |
| `src/design-system/icons/arrow.svg` | self-authored | Doučko design system | Original 24×24 stroke icon (arrow) |
| `src/design-system/icons/bolt.svg` | self-authored | Doučko design system | Original 24×24 stroke icon (bolt) |
| `src/design-system/icons/book.svg` | self-authored | Doučko design system | Original 24×24 stroke icon (book) |
| `src/design-system/icons/chat.svg` | self-authored | Doučko design system | Original 24×24 stroke icon (chat) |
| `src/design-system/icons/check.svg` | self-authored | Doučko design system | Original 24×24 stroke icon (check) |
| `src/design-system/icons/eye.svg` | self-authored | Doučko design system | Original 24×24 stroke icon (eye) |
| `src/design-system/icons/flag.svg` | self-authored | Doučko design system | Original 24×24 stroke icon (flag) |
| `src/design-system/icons/globe.svg` | self-authored | Doučko design system | Original 24×24 stroke icon (globe) |
| `src/design-system/icons/hint.svg` | self-authored | Doučko design system | Original 24×24 stroke icon (hint) |
| `src/design-system/icons/leaf.svg` | self-authored | Doučko design system | Original 24×24 stroke icon (leaf) |
| `src/design-system/icons/lock.svg` | self-authored | Doučko design system | Original 24×24 stroke icon (lock) |
| `src/design-system/icons/math.svg` | self-authored | Doučko design system | Original 24×24 stroke icon (math) |
| `src/design-system/icons/retry.svg` | self-authored | Doučko design system | Original 24×24 stroke icon (retry) |
| `src/design-system/icons/sparkle.svg` | self-authored | Doučko design system | Original 24×24 stroke icon (sparkle) |
| `src/design-system/icons/star.svg` | self-authored | Doučko design system | Original 24×24 stroke icon (star) |
| `src/design-system/icons/temple.svg` | self-authored | Doučko design system | Original 24×24 stroke icon (temple) |
| `src/design-system/icons/translate.svg` | self-authored | Doučko design system | Original 24×24 stroke icon (translate) |
