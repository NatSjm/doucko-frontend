# Design — release review (frontend)

## Review shape

The whole history (`ab84763..4adba6f`, ~22k lines of product code) was too
large for one review-gate run, so it ran in three feature chunks in parallel,
each capped at $8: A platform/admin shell, B authoring/admin features, C child
features and e2e. The three runs started in the same second and wrote the same
run record; only chunk A's survived, so B and C were merged by hand from their
logs (titles of 7 visual findings were cut off). Several finders hit the $2
per-step cap and B/C verification was skipped by the total cap; the gaps are
listed in `review-findings.json` (`coverageGaps`).

## Fixes

- `AdminLayout`: a "New …" link is not the current page when the query names
  a saved item (`taskId` / `missionId`).
- `adminClient.xsrfToken`: a cookie value that `decodeURIComponent` rejects
  is sent unchanged (the server answers 403) instead of throwing.
- `FormAlert`: the layout effect is keyed by the errors' content, so a parent
  that rebuilds an equal object on each render no longer pulls the focus back.

## Rejected change

`add_header Cache-Control immutable` in `location /assets/` was tried and
reverted: a location-level `add_header` drops the inherited security headers.
