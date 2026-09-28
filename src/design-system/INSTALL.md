# Installing the Doučko design system in the frontend (React + Vite + TS)

## 1. Copy the folder

Put this whole folder at `frontend/src/design-system/` and commit it. The fonts are under the SIL Open Font License, and the license files are in `fonts/`, so committing them to the public repo is fine.

## 2. Import it once

In `src/main.tsx`:

```ts
import './design-system'; // tokens, fonts, component styles
```

Optional: add an `@` alias so imports stay short (`vite.config.ts` + `tsconfig.json`):

```ts
// vite.config.ts
resolve: { alias: { '@': '/src' } }
// tsconfig.json → compilerOptions
"paths": { "@/*": ["./src/*"] }
```

## 3. Use the components

```tsx
import { Button, TaskPrompt, AnswerPart, Feedback } from '@/design-system';
```

- Look at `examples/TaskScreenExample.tsx` for a full task screen.
- Everything is typed. The components need only React 18+; there are no other dependencies.

## 4. Theme

The light theme is the default. To switch to dark, set it on the `<html>` element:

```ts
document.documentElement.dataset.theme = 'dark'; // or 'light'
```

With no `data-theme` set, the app follows the OS setting.

## 5. Styling your own screens

- Use CSS variables from `tokens.css`, never raw values:
  - colours: `var(--hero)`, `var(--ink)`
  - spacing: `var(--space-5)`
  - radii: `var(--radius-lg)`
- For text styles, use the classes `.dk-t-title`, `.dk-t-prompt`, `.dk-t-body` and so on.

## 6. Adding a subject later

1. In `tokens.json` / `tokens.css`, add `--subject-<key>: var(--mint)` (or a new hue). Check that dark ink (`--on-color`) has at least 4.5:1 contrast on it.
2. In `components/core.tsx`, add the subject to `SUBJECTS`: `{ name, icon, token }`. Add an icon path to `PATHS` if it needs a new icon.
3. That's it: SubjectTile, SubjectChip, MissionCard and TaskPrompt pick up the new subject automatically.

## 7. Updating the design system

The source of truth is the **Doučko design-system artifact** on claude.ai.

1. Ask Claude to change the design system there, then ask for a fresh copy of this folder.
2. Replace `src/design-system/` with the new copy.
3. Don't hand-edit `tokens.css` (it is generated from `tokens.json`).
