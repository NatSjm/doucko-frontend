# Release review RED run (frontend, 2026-10-09)

Tests written from the release-review findings before the fix, run with `npx vitest run src/features/admin-access`:

```
     × sends a malformed (not percent-decodable) cookie as it is instead of throwing 40ms
     × does not take the focus back on a re-render with the same errors 731ms
     × does not mark "New task" or "New mission" as the current page while an existing item is edited 100ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯
      Tests  3 failed (+1 pdf test, finding refuted and dropped) | 45 passed (49)
```

GREEN after the fix commit: 48 passed.
