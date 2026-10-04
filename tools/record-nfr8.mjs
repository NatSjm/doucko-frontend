// NFR-8 recording (content-authoring "Timed entry of a single-part task"): a headless Chromium clip of
// the admin entering a typical single-part INTEGER task with the keyboard only, timed from the first
// keystroke to the saved status. The clip ASSERTS what it shows (FR-3 saved task, NFR-8 ≤ 60 s,
// sticky source and page) and writes the manifest shape of scripts/record-demos.mjs, which
// scripts/check-recordings.mjs validates. record-demos.mjs is framework-owned (../docs/factory), so
// this project clip lives here (design of implement-authoring-tasks-ui).
//
// The app is the production build served by `vite preview`; the admin API is answered by the shared
// contract stub src/test/fake-admin-backend.ts (no stack needed, self-authored data only, NFR-3/NFR-4).
// Typing runs at a fixed human pace (KEY_DELAY_MS per key, PAUSE_MS between fields), so the time
// measured is a conservative stand-in for a person, not the speed of a script.
//
// Run: `npm run build && node tools/record-nfr8.mjs` (Node ≥ 22.18 or 24: imports TypeScript directly).
import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFakeAdminBackend, CSRF_TOKEN, SEED } from '../src/test/fake-admin-backend.ts';
import { en } from '../src/i18n/en.ts';

const PORT = 4176;
const BASE_URL = `http://localhost:${PORT}`;
const OUT_DIR = 'docs/qa/demo-recordings/nfr8-task-entry';
const ID = 'nfr8-single-part-task-entry';
const VIEWPORT = { width: 1280, height: 800 };
const KEY_DELAY_MS = 150;
const PAUSE_MS = 700;
const LIMIT_MS = 60_000;

const assert = (cond, msg) => {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
};
const fmt = (template, vars) => template.replace(/\{(\w+)\}/g, (w, k) => (k in vars ? String(vars[k]) : w));

async function reachable(url) {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`vite preview did not answer at ${url}`);
}

function stop(child) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
  else child.kill('SIGTERM');
}

async function record(page, backend) {
  const pause = () => page.waitForTimeout(PAUSE_MS);
  await page.goto(`${BASE_URL}/admin/tasks/edit?sourceId=${SEED.sourceId}&page=57`);
  await page.getByRole('img', { name: fmt(en['admin.viewer.canvas'], { page: 57 }) }).waitFor();
  const prompt = page.getByLabel(en['admin.editor.prompt'], { exact: true });
  assert(await prompt.evaluate((el) => el === document.activeElement), 'the prompt has focus on a new task with a sticky source');
  await page.waitForTimeout(1000);

  const started = Date.now();
  await page.keyboard.type('Kolik je 7 + 5?', { delay: KEY_DELAY_MS });
  await pause();
  await page.keyboard.press('Tab'); // topic
  await page.keyboard.press('ArrowDown');
  await pause();
  await page.keyboard.press('Tab'); // task number
  await page.keyboard.type('4', { delay: KEY_DELAY_MS });
  await pause();
  await page.keyboard.press('Tab'); // sub-part (none)
  await page.keyboard.press('Tab'); // answer type (INTEGER)
  await page.keyboard.press('Tab'); // accepted answer 1
  await page.keyboard.type('12', { delay: KEY_DELAY_MS });
  await pause();
  await page.keyboard.press('Enter');
  await page.getByRole('status').filter({ hasText: en['admin.editor.created'] }).waitFor();
  const elapsedMs = Date.now() - started;

  const saved = backend.tasks.at(-1);
  assert(saved?.status === 'DRAFT', 'FR-3: the new task is stored as DRAFT');
  assert(saved.input.prompt === 'Kolik je 7 + 5?' && saved.input.topicId === SEED.topicDecimals, 'FR-3: prompt and topic as typed');
  assert(saved.input.sourceRef.sourceId === SEED.sourceId && saved.input.sourceRef.page === 57 && saved.input.sourceRef.taskNo === '4', 'FR-3: source reference');
  assert(saved.input.parts.length === 1 && saved.input.parts[0].spec.type === 'INTEGER' && saved.input.parts[0].spec.accepted[0] === '12', 'FR-6: one INTEGER part, expected 12');
  assert(elapsedMs <= LIMIT_MS, `NFR-8: saved within 60 s of the first keystroke (took ${elapsedMs} ms)`);
  assert((await page.getByLabel(en['admin.editor.page'], { exact: true }).inputValue()) === '57', 'NFR-8: the page stays filled in');
  assert(await prompt.evaluate((el) => el === document.activeElement), 'NFR-8: focus is back in the prompt for the next task');
  return elapsedMs;
}

async function main() {
  if (!existsSync('dist/index.html')) throw new Error('dist/ is missing: run `npm run build` first');
  const server = spawn(`npx vite preview --port ${PORT} --strictPort`, { shell: true, stdio: 'ignore' });
  let exitCode = 0;
  try {
    await reachable(BASE_URL);
    if (existsSync(OUT_DIR)) await rm(OUT_DIR, { recursive: true, force: true });
    await mkdir(join(OUT_DIR, 'raw'), { recursive: true });
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: VIEWPORT, recordVideo: { dir: join(OUT_DIR, 'raw'), size: VIEWPORT } });
    await context.addCookies([{ name: 'XSRF-TOKEN', value: CSRF_TOKEN, domain: 'localhost', path: '/', sameSite: 'Strict' }]);
    const backend = createFakeAdminBackend({ signedIn: true });
    const page = await context.newPage();
    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const body = request.postDataBuffer();
      const response = await backend.handle(
        new Request(request.url(), {
          method: request.method(),
          headers: request.headers(),
          body: body && !['GET', 'HEAD'].includes(request.method()) ? new Uint8Array(body) : undefined,
        }),
      );
      await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
    });

    let elapsedMs = null;
    let error = null;
    try {
      elapsedMs = await record(page, backend);
      await page.waitForTimeout(1500);
    } catch (e) {
      error = e.message;
      exitCode = 1;
    }
    const screenshot = join(OUT_DIR, `${ID}.png`).replaceAll('\\', '/');
    await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
    const video = page.video();
    await page.close();
    await context.close();
    const videoPath = join(OUT_DIR, `${ID}.webm`).replaceAll('\\', '/');
    if (video) await video.saveAs(videoPath);
    await browser.close();
    await rm(join(OUT_DIR, 'raw'), { recursive: true, force: true });

    const asserted = error === null;
    const seconds = elapsedMs === null ? null : (elapsedMs / 1000).toFixed(1);
    const explainer = join(OUT_DIR, `${ID}.md`).replaceAll('\\', '/');
    await writeFile(
      explainer,
      `# Typical single-part task entered with the keyboard\n\n` +
        `**Proves:** NFR-8, FR-3\n\n` +
        `**Result:** ${asserted ? `asserted ✓ — saved ${seconds} s after the first keystroke (limit 60 s)` : `FAILED — ${error}`}\n\n` +
        `Steps (keyboard only, ${KEY_DELAY_MS} ms per key, ${PAUSE_MS} ms between fields): the editor opens with the sticky ` +
        `source and page 57 and focus in the prompt; type the prompt, Tab to the topic and pick it with an arrow key, Tab ` +
        `to the task number and type it, Tab past the sub-part and the answer type, type the expected value, press Enter. ` +
        `Asserted: the task is stored as DRAFT with that source reference and one INTEGER part, the time is within 60 s, ` +
        `the page stays 57 and focus returns to the prompt.\n\n` +
        `Recorded against the production build (\`vite preview\`) with the admin API answered by the contract stub ` +
        `\`src/test/fake-admin-backend.ts\` (self-authored data). The real-stack click path is ` +
        `\`docs/qa/evidence/slice5-compose-smoke.md\`.\n\n![still](${ID}.png)\n`,
    );
    const result = { id: ID, title: 'Typical single-part task entered with the keyboard (NFR-8)', proof: 'NFR-8, FR-3', video: videoPath, screenshot, explainer, asserted, elapsedMs, keyDelayMs: KEY_DELAY_MS, pauseMs: PAUSE_MS };
    await writeFile(join(OUT_DIR, 'manifest.json'), `${JSON.stringify({ kind: 'demo', results: [result] }, null, 2)}\n`);
    console.log(`${asserted ? '✓' : '✗'} ${ID} (NFR-8, FR-3)${seconds ? ` — ${seconds} s` : ''}${error ? ` — ${error}` : ''}`);
  } finally {
    stop(server);
  }
  process.exit(exitCode);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
