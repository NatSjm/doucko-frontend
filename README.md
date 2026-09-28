# Doučko — frontend

React · Vite · TypeScript — the child app (Czech, "hero academy" skin) and
the admin app (English) of **Doučko**, a home math tutor. UI is built from
the vendored design system in [`src/design-system/`](src/design-system/README.md).
Product contract: the docs repo (OpenSpec store `doucko`), pinned here as
the `contract/` submodule.

> Status: Phase 0 — delivery harness installed and design system vendored;
> the Vite scaffold is the next step (see `../docs/factory/PLAYBOOK.md`,
> Phase 0 step 4, and `src/design-system/INSTALL.md`).

```bash
npm install
npm run qa:verify    # full battery (writes docs/qa/automated-verification-latest.md)
npm run gate:status  # G0–G8
```

Agents and humans: start with [AGENTS.md](AGENTS.md).
