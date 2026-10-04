// Live smoke of the frontend image (task 4.4): builds it, runs it on a private Docker network beside a
// stub `backend` that echoes the request, and checks over HTTP what container-config.test.ts can only
// read in nginx.conf: API proxying (Host, overwritten X-Forwarded-For, X-Forwarded-Proto), the
// security headers once each (backend copies hidden), the SPA fallback and no-cache shell, /assets/
// 404, /api 404 and the DNS-rebinding Host guard. With --e2e it then runs the Playwright suite
// against the container (E2E_BASE_URL), so the e2e goes through nginx and its CSP.
//
//   node tools/container-smoke.mjs [--e2e]
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 18081;
const NET = 'doucko-smoke';
const IMAGE = 'doucko-frontend:smoke';
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const quiet = (...args) => spawnSync('docker', args, { stdio: 'ignore' });

// The stub answers every /api/ request with the headers nginx forwarded, and sends its own copies of
// the security headers so the test can prove nginx drops them.
const STUB = `server {
  listen 8080;
  location / {
    default_type text/plain;
    add_header X-Content-Type-Options "backend" always;
    add_header Referrer-Policy "backend" always;
    add_header Content-Security-Policy "backend" always;
    return 200 "host=$http_host xff=$http_x_forwarded_for proto=$http_x_forwarded_proto";
  }
}
`;

const failures = [];
const results = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : `: ${detail}`}`);
  results.push({ name, ok, detail: ok ? '' : String(detail ?? '') });
  if (!ok) failures.push(name);
};
const startedAt = new Date().toISOString();

/** GET over node:http (fetch silently drops a custom Host header, which the rebinding check needs). */
function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: PORT, path, headers }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: new Headers(Object.entries(res.headers).map(([k, v]) => [k, String(v)])), body }));
    });
    req.on('error', reject);
    req.end();
  });
}

/** A value from ../backend/.env, or undefined. */
function backendEnv(key) {
  try {
    const line = readFileSync('../backend/.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
    return line?.slice(key.length + 1).trim().replace(/^(['"])(.*)\1$/, '$2') || undefined;
  } catch {
    return undefined;
  }
}

function cleanup() {
  quiet('rm', '-f', 'doucko-smoke-frontend', 'doucko-smoke-backend');
  quiet('network', 'rm', NET);
}

async function waitReady() {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await get('/')).status === 200) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('frontend container did not answer on / within 10 s');
}

cleanup();
try {
  console.log('building the frontend image (Dockerfile, contract submodule)…');
  docker('build', '-q', '-t', IMAGE, '.');
  docker('network', 'create', NET);
  const stubDir = mkdtempSync(join(tmpdir(), 'doucko-stub-'));
  writeFileSync(join(stubDir, 'default.conf'), STUB);
  docker('run', '-d', '--name', 'doucko-smoke-backend', '--network', NET, '--network-alias', 'backend',
    '-v', `${stubDir}:/etc/nginx/conf.d:ro`, 'nginx:stable-alpine');
  docker('run', '-d', '--name', 'doucko-smoke-frontend', '--network', NET, '-p', `127.0.0.1:${PORT}:80`, IMAGE);
  await waitReady();

  const shell = await get('/');
  check('/ serves the SPA shell', shell.status === 200 && shell.body.includes('<div id="root">'), String(shell.status));
  check('the shell is not cached', /no-cache/.test(shell.headers.get('cache-control') ?? ''), shell.headers.get('cache-control'));
  const deep = await get('/some/client/route');
  check('an unknown path falls back to the shell', deep.status === 200 && deep.body === shell.body, String(deep.status));
  check('a missing /assets/ file is 404', (await get('/assets/missing-0000.js')).status === 404);
  check('/api without the slash is 404', (await get('/api')).status === 404);

  const api = await get('/api/health', { 'X-Forwarded-For': '6.6.6.6' });
  check('/api/ reaches the backend', api.status === 200 && api.body.startsWith('host='), `${api.status} ${api.body}`);
  check('the original Host is forwarded', api.body.includes(`host=127.0.0.1:${PORT}`), api.body);
  check('a client X-Forwarded-For is overwritten', !api.body.includes('6.6.6.6') && /xff=\d+\.\d+\.\d+\.\d+ /.test(api.body), api.body);
  check('X-Forwarded-Proto is set', api.body.includes('proto=http'), api.body);
  for (const h of ['x-content-type-options', 'referrer-policy', 'content-security-policy']) {
    const value = api.headers.get(h) ?? '';
    check(`${h} is nginx's, once`, value !== '' && !value.includes('backend') && !value.includes(','), value);
  }
  check('the server version is hidden', (shell.headers.get('server') ?? '') === 'nginx', shell.headers.get('server'));

  check('localhost is served', (await get('/', { Host: 'localhost' })).status === 200);
  check('a LAN address is served', (await get('/', { Host: '192.168.1.20' })).status === 200);
  const foreign = await get('/api/health', { Host: 'evil.example' });
  check('a foreign host name is refused (DNS rebinding)', foreign.status === 421, String(foreign.status));
  check('the refusal carries the security headers',
    ['x-content-type-options', 'referrer-policy', 'content-security-policy'].every((h) => foreign.headers.get(h)),
    JSON.stringify(Object.fromEntries(foreign.headers)));

  if (failures.length === 0 && process.argv.includes('--e2e')) {
    // Against a stack the NFR-3 real-name guard needs the real name to compare with. It comes from the
    // environment or ../backend/.env, as for the real stack, and is never printed.
    const realName = process.env.DOUCKO_CHILD_DISPLAY_NAME?.trim() || backendEnv('DOUCKO_CHILD_DISPLAY_NAME');
    if (!realName) {
      check('Playwright e2e through nginx', false,
        'NOT RUN: set DOUCKO_CHILD_DISPLAY_NAME in ../backend/.env (the real-name guard needs it against a stack)');
    } else {
      const e2e = spawnSync('npx', ['playwright', 'test'], {
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, E2E_BASE_URL: `http://localhost:${PORT}`, DOUCKO_CHILD_DISPLAY_NAME: realName },
      });
      check('Playwright e2e through nginx', e2e.status === 0, `exit ${e2e.status}`);
    }
  }
} catch (err) {
  failures.push(String(err.message ?? err));
  console.error(err.stderr?.toString() || err.message);
} finally {
  cleanup();
}

// Evidence for task 4.4: every check with its result, so a PASS claim points at a file.
const e2eRan = results.some((r) => r.name === 'Playwright e2e through nginx');
writeFileSync(
  'docs/qa/container-smoke-latest.md',
  [
    '# Container Smoke Latest',
    '',
    'Generated by `node tools/container-smoke.mjs` (`npm run test:container`).',
    '',
    `- Started: ${startedAt}`,
    `- Finished: ${new Date().toISOString()}`,
    `- Scope: ${results.length} check(s)${e2eRan ? ', Playwright through nginx included' : ', Playwright through nginx NOT included'}`,
    `- Result: ${failures.length ? `FAIL (${failures.length})` : results.length ? 'PASS' : 'NOT-EARNED (no check ran)'}`,
    '',
    '| Check | Result | Detail |',
    '|---|---|---|',
    ...results.map((r) => `| ${r.name} | ${r.ok ? 'PASS' : 'FAIL'} | ${r.detail.replace(/\|/g, '\\|').slice(0, 200)} |`),
    '',
  ].join('\n'),
);
console.log(failures.length ? `container smoke: FAIL (${failures.length})` : 'container smoke: PASS');
process.exit(failures.length ? 1 : 0);
