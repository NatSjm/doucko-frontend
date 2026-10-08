// Phase 5 (G5): runs the real-stack Playwright suite (e2e/stack/, playwright.stack.config.ts) against
// the isolated compose project `doucko-e2e` (Postgres + backend + this repo's nginx frontend image).
// The backend checkout owns the stack: `node tools/e2e-stack.mjs up|seed|down` there. This wrapper
// brings it up from THIS worktree's frontend (DOUCKO_FRONTEND_DIR), seeds it (idempotent), runs the
// suite, and always takes the stack down again: on success, failure, and on SIGINT, SIGTERM, SIGHUP
// or SIGBREAK. It never touches the owner's compose project and never reads the backend's .env.
//
//   node tools/e2e-stack-run.mjs [--keep] [-- <playwright args>]     e.g. -- --project=chromium
//
// Env: DOUCKO_BACKEND_DIR (default ../backend), E2E_STACK_URL (default http://127.0.0.1:18082).
// Prints the qa-verify contract: "Scope: <n> test(s)" and "Result: PASS|FAIL|NOT-EARNED". A full run
// writes the G5 evidence docs/qa/e2e-stack-latest.md; a narrowed run (Playwright args) or a --keep
// run writes test-results-stack/e2e-stack-run.md instead, so it can never stand in for the full suite.
// PASS needs every test passed: none failed, flaky, skipped or not run, and the stack taken down.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = process.cwd();
const backendDir = resolve(root, process.env.DOUCKO_BACKEND_DIR ?? '../backend');
const baseUrl = process.env.E2E_STACK_URL ?? 'http://127.0.0.1:18082';
const argv = process.argv.slice(2);
const dashdash = argv.indexOf('--');
const ownArgs = dashdash >= 0 ? argv.slice(0, dashdash) : argv;
const pwArgs = dashdash >= 0 ? argv.slice(dashdash + 1) : [];
const keep = ownArgs.includes('--keep');
const env = { ...process.env, DOUCKO_FRONTEND_DIR: root, E2E_STACK_URL: baseUrl };
const startedAt = new Date();
const log = [];

let child = null;
let interrupted = null;
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
  process.on(signal, () => {
    interrupted ??= signal;
    child?.kill();
  });
}

/** Runs `node <args>` in `cwd` (no shell: arguments are never re-parsed); resolves its exit code. */
function run(args, cwd) {
  const line = `$ node ${args.join(' ')}  (in ${cwd})`;
  console.log(line);
  log.push(line);
  return new Promise((done) => {
    child = spawn(process.execPath, args, { cwd, env, stdio: 'inherit' });
    child.on('error', () => done(1));
    child.on('close', (code) => {
      child = null;
      log.push(`  exit ${code ?? 'signal'}`);
      done(code ?? 1);
    });
  });
}

const git = (cwd, ...args) => spawnSync('git', args, { cwd, encoding: 'utf8' });
function revision(cwd, excludes = []) {
  const head = git(cwd, 'rev-parse', '--short', 'HEAD');
  if (head.status !== 0) return 'unknown';
  const st = git(cwd, 'status', '--porcelain', '--', '.', ...excludes.map((e) => `:!${e}`));
  return `${head.stdout.trim()}${st.status !== 0 || st.stdout.trim() !== '' ? ' (working tree dirty)' : ''}`;
}

const stackTool = join(backendDir, 'tools', 'e2e-stack.mjs');
const stack = (verb) => run(['tools/e2e-stack.mjs', verb], backendDir);
const report = join(root, 'test-results-stack', 'results.json');

let result = 'NOT-EARNED';
let reason = '';
let scope = 0;
let counts = null;
let up = false;

try {
  if (!existsSync(stackTool)) {
    reason = `the backend's e2e stack tool is missing: ${stackTool} (set DOUCKO_BACKEND_DIR)`;
  } else {
    up = true;
    if ((await stack('up')) !== 0) reason = 'e2e-stack up failed';
    else if (interrupted) reason = `interrupted (${interrupted})`;
    else if ((await stack('seed')) !== 0) reason = 'e2e-stack seed failed';
    else if (interrupted) reason = `interrupted (${interrupted})`;
    else {
      rmSync(report, { force: true });
      mkdirSync(dirname(report), { recursive: true });
      env.PLAYWRIGHT_JSON_OUTPUT_NAME = report;
      const cli = join(root, 'node_modules', '@playwright', 'test', 'cli.js');
      const status = await run([cli, 'test', '-c', 'playwright.stack.config.ts', '--reporter=list,json', ...pwArgs], root);
      try {
        const stats = JSON.parse(readFileSync(report, 'utf8')).stats;
        counts = { passed: stats.expected, failed: stats.unexpected, flaky: stats.flaky, skipped: stats.skipped };
        scope = stats.expected + stats.unexpected + stats.flaky;
      } catch {
        counts = null;
      }
      if (interrupted) reason = `interrupted (${interrupted})`;
      else if (status !== 0) [result, reason] = ['FAIL', `playwright exited ${status}`];
      else if (!counts || !scope) reason = 'no test ran';
      else if (counts.skipped) reason = `${counts.skipped} test(s) skipped: a skipped stack run is not evidence`;
      else if (counts.flaky) [result, reason] = ['FAIL', `${counts.flaky} test(s) passed only on retry`];
      else result = 'PASS';
    }
  }
} finally {
  if (up && !keep) {
    log.push('(teardown)');
    if ((await stack('down')) !== 0) {
      if (result === 'PASS') result = 'FAIL';
      reason = `${reason ? `${reason}; ` : ''}e2e-stack down failed: doucko-e2e may still be running`;
    }
  }
}

const full = pwArgs.length === 0 && !keep;
const finishedAt = new Date();
const md = `# Real-stack E2E ${full ? 'latest' : 'run (narrowed or kept: not G5 evidence)'}

Generated by \`node tools/e2e-stack-run.mjs\` (Phase 5, G5): Playwright \`e2e/stack/\` against the
isolated compose project \`doucko-e2e\` (Postgres + backend + nginx frontend) at ${baseUrl}, no route mocks.

- Started: ${startedAt.toISOString()}
- Finished: ${finishedAt.toISOString()}
- Frontend commit: ${revision(root, ['docs/qa', 'trace'])}
- Backend checkout: ${backendDir} at ${revision(backendDir, ['docs/qa', 'trace'])}
- Playwright args: ${pwArgs.join(' ') || '(none: every project, every spec)'}
- Stack: ${keep ? 'kept running (--keep)' : 'taken down'}
- Tests: ${counts ? `${counts.passed} passed, ${counts.failed} failed, ${counts.flaky} flaky, ${counts.skipped} skipped` : 'not run'}
- Result: ${result}${reason ? ` (${reason})` : ''}

\`\`\`text
${log.join('\n')}
\`\`\`
`;
const evidence = full ? join(root, 'docs', 'qa', 'e2e-stack-latest.md') : join(root, 'test-results-stack', 'e2e-stack-run.md');
mkdirSync(dirname(evidence), { recursive: true });
writeFileSync(evidence, md, 'utf8');
console.log(`\nWrote ${evidence}`);
console.log(`Scope: ${scope} test(s)`);
console.log(`Result: ${result}${reason ? ` — ${reason}` : ''}`);
process.exitCode = result === 'PASS' ? 0 : 1;
