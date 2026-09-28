# Doučko — frontend

React · Vite · TypeScript — the child app (Czech, "hero academy" skin) and
the admin app (English) of **Doučko**, a home math tutor. UI is built from
the vendored design system in [`src/design-system/`](src/design-system/README.md).
Product contract: the docs repo (OpenSpec store `doucko`), pinned here as
the `contract/` submodule.

> Status: Phase 0 — harness installed, design system vendored, Vite + React
> scaffold in place (ADR-0003). Next: pin `contract/` once the docs repo has a remote.

```bash
npm install
npm run dev          # Vite dev server (generates the API types first)
npm run qa:verify    # full battery (writes docs/qa/automated-verification-latest.md)
npm run gate:status  # G0–G8
```

Agents and humans: start with [AGENTS.md](AGENTS.md).
