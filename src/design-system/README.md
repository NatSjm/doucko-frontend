Doučko is a home tutor for a Czech ZŠ pupil, skinned as an original **hero academy**. She is a student at a hero school: every school subject is a discipline she trains, every topic in it is a *power*, missions are training and rescue exercises, and XP from every subject raises one hero rank.

The style is **Hero Pop**, the look of a modern anime game menu:
- a warm cream ground, or deep night navy in dark mode
- a coral-red hero colour, sunny power-yellow and electric teal
- one bright colour per subject
- rounded cards, pill buttons with a 3D lip, sticker-style badges
- a heavy poster display face

It should feel stylish, confident and fun for a 12-year-old, never babyish.

**Built for many subjects.** Maths for grade 6 is only the first subject. Nothing in this system is maths-specific:
- a subject is data (a `SUBJECTS` entry plus a `subject-<key>` colour token)
- a task is a prompt plus answer parts (typed or multiple choice)
- grades are just data too

Build both the child app and the admin app from these tokens and components.

## Content fundamentals

- **Only task text is translated; the child UI is always Czech.**
  - The translation (`uk` today; `ru` and others later) sits under the Czech prompt, marked with its language code and `lang`. It never replaces the Czech.
  - The admin UI is English.
- **Talk to her as *ty*, in the feminine where Czech needs it:** “Ahoj, hrdinko!”, “Zvládla jsi to!”.
  - Short, warm, playful sentences, verb first: “Pokračovat”, “Zkus to znovu”, “Začít misi”.
  - Button labels are sentence case.
- **Wrong is never failure.** Use this copy:
  - correct: “Správně!”
  - first wrong attempt: “Skoro! Zkus to znovu.”
  - revealed: “Nevadí, příště!”
  - unreadable input: “Tohle neumím přečíst” plus the expected format, and say that the attempt doesn't count.

  Never mock, never count mistakes out loud, never use red for a wrong answer.
- **Academy words:**

  | Thing | Word in the app |
  |---|---|
  | subject | real subject name, like *Matematika* or *Český jazyk* (she knows them) |
  | topic | *síla* (“Síla: Desetinná čísla”) |
  | mission | *výcvik* or *záchranná mise* |
  | chapter test | *zkouška na hrdinskou licenci* |
  | home | *HQ* |
- **Placeholder rank ladder**, feminine, to co-design with her: Kadetka → Parťačka → Hrdinka → Legenda. The school name and mentor character are still open, so leave them out of copy.
- **IP rule.** Take only the genre: hero schools, powers, rankings. Never use a character, name, logo, catchphrase, costume or term from any existing manga or anime, and never draw anything recognisable as one.
- **Numbers are Czech:**
  - decimal comma (12,35)
  - no-break space for thousands (1 240)
  - units as the task asks (cm²)
- **No emoji in the UI.** The celebration comes from stickers, colour and the display face.

## Visual foundations

**Colour.**
- Grounds: `paper` for the page, `panel` for cards, `panel-sunk` for wells and inputs.
- Text: `ink`, and `ink-muted` for secondary text. Both meet 4.5:1 on all three grounds in both themes.
- **Brand accents:**
  - `hero` (coral red) is the brand and the single primary action per screen. `on-hero` is the text on it.
  - `volt` (power yellow) is XP, stars, pips and the +XP sticker. It is always a fill, with `on-volt` text on it.
  - `spark` (electric teal) means “power on”, i.e. correct. Its text is `spark-text` and its tint is `spark-soft`.
- **Status:**
  - correct: `spark`
  - wrong part: `almost` (orange), with its tint `almost-soft`
  - revealed: neutral, with `ink` stickers

  Each always comes with its icon and a word, and correct and wrong sit on the blue–orange axis, not red–green.
- **Subjects:**
  - Each subject has one bright fill: `subject-math` → `blue`, `subject-czech` → `pink`, `subject-english` → `violet`, `subject-biology` → `lime`, `subject-geography` → `cyan`, `subject-history` → `sand`. `mint` and `peach` are spare slots.
  - Text on a subject fill is always `on-color` (dark ink), in both themes.
  - Use the subject colour for identity only: its tile, its chip, the band on its mission cards, the top edge of its task card. Never use it for state.
- **Adding a subject:**
  1. Add a categorical hue if none is free, checking 4.5:1 for `on-color` on it.
  2. Add a `subject-<key>` alias.
  3. Add a `SUBJECTS` entry: name, icon, token.

**Type.**
- `Dela Gothic One` (display, one heavy weight) is for anything that should feel like an anime title:
  - `hero`: +XP, rank-up
  - `title`: screen titles
  - `heading`: subject names, mission titles, rank names

  Never use it for paragraphs.
- `Rubik` (sans) does all the reading:
  - `prompt` at 24/34 for task text, big on purpose
  - `prompt-alt` for the translated line
  - `answer` at 26px for what she types, with tabular digits
  - `body`, `body-strong`, `caption`
  - `label` for uppercase kickers and chips
- Both faces cover Czech and Ukrainian (Latin Extended + Cyrillic).

**Shape and depth.**
- Cards are `radius-lg` with a soft `shadow-card` and a `line-soft` hairline. Hero panels (HQ greeting, mission complete) are `radius-xl`.
- Buttons, chips, pips and the XP bar are pills (`radius-full`). Inputs and choice options are `radius-md`.
- Pressable things sit on a solid 3D lip (`lip-hero`, `lip-soft`) and drop onto it when pressed.
- **Stickers:** badges, icons in circles and the +XP burst have a `stroke-sticker` outline in `panel`.
- `glow-volt` is reserved for XP and rank moments.

**Spacing.** The base unit is 4px.
- `space-5` inside cards
- `space-6` between cards
- `space-7` screen margins at 1280px, the minimum laptop width

Layouts are desktop-only:
- the task column is 760px wide
- HQ has a row of 220px subject tiles and a 320px mission grid

**Texture.** `.dk-halftone` (dots) and `.dk-speedlines` are the manga textures, drawn in `line-soft`. Use at most one per screen, faded into a corner of a hero panel or behind a celebration. Never put them behind text she reads.

**Motion.**
- Rewards bounce: the +XP sticker pops in with a twist, the XP bar grows with an overshoot, cards lift 3px on hover, and buttons drop onto their lip.
- Nothing moves while she is thinking: no timers, no pulsing.
- All of it turns off under `prefers-reduced-motion`.

**Focus.**
- Every control shows `focus-ring`: a 2px gap, then 3px of solid `focus` (blue in light, yellow in dark), 3:1+ on every ground.
- The task screen is fully keyboard-operable, and Enter submits.

**Themes.** Light is the default and dark ("night mission") is its twin. Subject fills keep their value in both.

## Iconography

- Use the original rounded stroke icons of the `Icon` component (24px grid, 2.25 stroke, round caps). They draw in `currentColor`.
- SVG copies in ink `#1b1f3b` are in the Icons asset group.
- Put icons in a round sticker when they carry state: the correct, wrong and revealed marks, the XP bolt, the hint bulb.
- A state icon never stands alone:
  - `check` with “Správně”
  - `retry` with “Skoro!”
  - `eye` with the revealed answer
- Each subject has an icon: `math`, `book` (Czech), `chat` (English), `leaf` (biology), `globe` (geography), `temple` (history). A new subject gets a new icon in the same style.
- There is no logo or crest yet. It will be co-designed with her. Until then, set “Doučko” in the display face.
- The rank medal (`RankBadge`) is an original faceted hexagon with a sparkle, not a crest.

## Components

**Child app**
- HQ:
  - a hero panel with the greeting, RankBadge, XpBar and a large primary Pokračovat
  - a row of SubjectTiles; subjects without missions yet are `locked`
  - MissionCards for the chosen subject, grouped by power
- Task:
  - TaskPrompt (with subject, power, pips and translation)
  - HintButton / HintCard
  - AnswerPart ×n for typed answers, or ChoiceGroup for single or multiple choice
  - Feedback and a primary Odeslat

**Admin**
- Panel, Button, Chip (DRAFT / PUBLISHED / GRAPHIC), SubjectChip for subject columns and filters, and the same inputs.
- Admin screens are denser (`body` / `caption`) but use the same tokens.
