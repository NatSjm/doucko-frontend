<!-- Paste this section into frontend/AGENTS.md -->
## UI and design system

- All UI is built with `src/design-system/` (Doučko "Hero Pop"). **Read `src/design-system/README.md` before any UI work.** It holds the voice, colour, type and component rules.
- Use its components first (`import { … } from '@/design-system'`). For your own styles, use only its CSS variables (`var(--hero)`, `var(--space-5)`, `var(--radius-lg)`): no raw hex, px or font values.
- It must work for many subjects. Never hardcode maths or a subject colour. Subjects come from `SUBJECTS` and `--subject-<key>`.
- The child UI is Czech; only task text is translated (`lang` set on the translated block). The admin UI is English.
- A wrong answer uses `almost` (orange) with the copy "Skoro! Zkus to znovu." It is never red and never mocking. Nothing may use timers or remove XP.
- Keep WCAG AA contrast and a visible focus ring, and respect `prefers-reduced-motion`. The task screen must work by keyboard, with Enter submitting.
- Don't change files inside `src/design-system/` as part of a feature. Changes to the system go to the design-system artifact first, then get copied in.
- IP rule: no characters, names, logos or terms from existing manga or anime.
