# Slice 1 — compose stack smoke (frontend task 4.4)

- Date: 2026-10-04 (Europe/Prague), run from `../backend` with `npm run stack:up`
- Frontend commit: `43f1267` (image built by compose from the sibling checkout); backend commit: `5bf3df9`
- Real stack: Postgres 16, backend, frontend nginx. No stub.

## Published ports (`docker compose ps`)

```text
backend | Up 22 seconds (healthy) | 8080/tcp
db | Up 25 seconds (healthy) | 5432/tcp
frontend | Up 1 second | 127.0.0.1:8081->80/tcp
```

Only the frontend is published, on loopback. The backend and the database are reachable only on the
Compose network.

## Through nginx

```text
$ curl -si http://127.0.0.1:8081/api/child/nope
HTTP/1.1 404
Server: nginx
Content-Type: application/problem+json
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
{"detail":"No API resource exists at this path.","instance":"/api/child/nope","status":404,"title":"Resource not found"}

$ curl -s -o /dev/null -w "%{http_code} %{content_type}" http://127.0.0.1:8081/
200 text/html

$ curl -s -o /dev/null -w "%{http_code}" -H "Host: evil.example" http://127.0.0.1:8081/api/child/nope
421
```

## Backend not reachable from the host; its firewall inside the network

```text
$ curl -s -m 3 http://127.0.0.1:8080/actuator/health
(no connection: port not published)

$ docker compose exec -T backend wget -qS -O- --header "Host: evil.example" http://localhost:8080/api/child/nope
HTTP/1.1 400
```

## Light and dark, every screen, three browsers

`E2E_BASE_URL=http://127.0.0.1:8081 npx playwright test` with the real-name guard configured
(`DOUCKO_CHILD_DISPLAY_NAME` from `../backend/.env`; a nickname, never printed):

```text
  12 skipped
  42 passed (1.2m)
```

The 12 skipped are the "no control switches the theme" checks on screens that have no control yet
(reported as skipped, never as passed; `src/app/theme-source.test.ts` covers them statically).
