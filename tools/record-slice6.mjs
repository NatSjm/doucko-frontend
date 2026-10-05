// Slice 6 recordings (content-authoring "Missions", "Mission publishing rules", "Edit existing
// content", "Delete only unused content"): headless Chromium clips of the mission, source edit and
// task status screens. Each clip ASSERTS what it shows (FR-9, FR-55) and gets a still of the screen
// in its key state, so the visual review lens can check the slice 6 UI. The manifest uses the shape
// of scripts/record-demos.mjs, which scripts/check-recordings.mjs validates; record-demos.mjs is
// framework-owned (../docs/factory), so these project clips live here like tools/record-nfr8.mjs.
//
// The app is the production build served by `vite preview`; the admin API is answered by the shared
// contract stub src/test/fake-admin-backend.ts (no stack needed, self-authored data only, NFR-3/NFR-4).
//
// Run: `npm run build && node tools/record-slice6.mjs` (Node ≥ 22.18 or 24: imports TypeScript directly).
import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { addTask, createFakeAdminBackend, CSRF_TOKEN, SEED } from '../src/test/fake-admin-backend.ts';
import { en } from '../src/i18n/en.ts';

const PORT = 4177;
const BASE_URL = `http://localhost:${PORT}`;
const OUT_DIR = 'docs/qa/demo-recordings/slice6-authoring-missions';
const VIEWPORT = { width: 1280, height: 900 };
const PAUSE_MS = 600;
const DECIMAL = 'Zapiš jednu polovinu jako desetinné číslo.';
const CHOICE = 'Které číslo je větší než 4?';

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

/** Each clip: a fresh seeded backend, a flow that asserts its FRs, and the still it ends on. */
const CLIPS = [
  {
    id: 'slice6-mission-create-reorder-publish',
    title: 'Create a mission, reorder it and publish it (FR-9, FR-55)',
    proof: 'FR-9, FR-55',
    steps:
      'Open New mission, choose the topic, type position 2, add three tasks of the topic, move the third to the first ' +
      'place with the keyboard, save; publish is refused with the draft tasks named; the tasks get published; publish ' +
      'again. Asserted: the stored mission is DRAFT with the tasks in the new order and the counter 3/10 tasks, the ' +
      'refusal names the blocking tasks, and the mission ends PUBLISHED. The still shows the published mission editor.',
    async run(page, backend) {
      const pause = () => page.waitForTimeout(PAUSE_MS);
      const third = addTask(backend, { topicId: SEED.topicDecimals, prompt: 'Zaokrouhli 3,46 na desetiny.' }).taskId;
      await page.goto(`${BASE_URL}/admin/missions/edit`);
      await page.getByLabel(en['admin.missionEditor.topic'], { exact: true }).selectOption({ label: 'Desetinná čísla' });
      await pause();
      await page.getByLabel(en['admin.missionEditor.position'], { exact: true }).fill('2');
      const picker = page.getByRole('region', { name: en['admin.missionEditor.addTitle'] });
      for (const prompt of [DECIMAL, CHOICE, 'Zaokrouhli 3,46 na desetiny.']) {
        await picker.getByRole('button', { name: `${en['admin.missionEditor.add']} ${prompt}` }).click();
        await pause();
      }
      const list = page.getByRole('list', { name: en['admin.missionEditor.tasks'] });
      await list.getByRole('button', { name: fmt(en['admin.missionEditor.moveUp'], { n: 3 }) }).focus();
      await page.keyboard.press('Enter');
      await pause();
      await page.keyboard.press('Enter');
      await pause();
      await page.getByRole('button', { name: en['admin.missionEditor.save'] }).click();
      await page.getByRole('status').filter({ hasText: en['admin.missionEditor.created'] }).waitFor();
      const mission = backend.missions.at(-1);
      assert(mission?.status === 'DRAFT' && mission.position === 2, 'FR-9: the new mission is DRAFT at position 2');
      assert(mission.taskIds.join() === [third, SEED.taskDecimal, SEED.taskChoice].join(), 'FR-9/FR-55: the tasks are stored in the chosen order');
      assert(await page.getByText(fmt(en['admin.missions.counter'], { count: 3 })).isVisible(), 'FR-9: the counter shows 3/10 tasks');
      await pause();
      await page.getByRole('button', { name: en['admin.missionEditor.publish'] }).click();
      const alert = page.getByRole('alert');
      await alert.waitFor();
      assert(await alert.getByRole('link', { name: DECIMAL }).isVisible(), 'FR-57 shown: the refusal names the draft task');
      assert(backend.missions.at(-1).status === 'DRAFT', 'the refused mission stays DRAFT');
      await page.waitForTimeout(1500);
      backend.tasks.forEach((t) => (t.status = 'PUBLISHED'));
      await page.getByRole('button', { name: en['admin.missionEditor.publish'] }).click();
      await page.getByRole('status').filter({ hasText: en['admin.missionEditor.published'] }).waitFor();
      assert(backend.missions.at(-1).status === 'PUBLISHED', 'FR-9: the mission is published');
    },
  },
  {
    id: 'slice6-mission-publish-refused',
    title: 'A refused mission publish names the blocking tasks (FR-9)',
    proof: 'FR-9',
    steps:
      'Open the seeded draft mission whose two tasks are drafts and publish it. Asserted: the alert shows the server ' +
      'reason and links both draft tasks; the mission stays DRAFT. The still shows the refusal next to the task list.',
    async run(page, backend) {
      await page.goto(`${BASE_URL}/admin/missions/edit?missionId=${SEED.missionDecimals}`);
      await page.getByRole('list', { name: en['admin.missionEditor.tasks'] }).getByText(DECIMAL).waitFor();
      await page.waitForTimeout(PAUSE_MS);
      await page.getByRole('button', { name: en['admin.missionEditor.publish'] }).click();
      const alert = page.getByRole('alert');
      await alert.waitFor();
      assert(await alert.getByRole('link', { name: DECIMAL }).isVisible(), 'the refusal names the first draft task');
      assert(await alert.getByRole('link', { name: CHOICE }).isVisible(), 'the refusal names the second draft task');
      assert(backend.missions[0].status === 'DRAFT', 'the mission stays DRAFT');
    },
  },
  {
    id: 'slice6-mission-list',
    title: 'Mission list by topic and position with counter and status (FR-9)',
    proof: 'FR-9',
    steps:
      'With a draft and a published mission, open Missions from the admin navigation. Asserted: both are listed ' +
      'with topic, position, counter and status. The still shows the list.',
    async run(page, backend) {
      backend.missions.push({ missionId: 'ffffffff-ffff-4fff-8fff-0000000000d1', topicId: SEED.topicPerimeter, position: 1, taskIds: [SEED.taskPerimeter], status: 'PUBLISHED' });
      await page.goto(`${BASE_URL}/admin`);
      await page.getByRole('navigation', { name: en['admin.nav.label'] }).getByRole('link', { name: en['admin.nav.missions'], exact: true }).click();
      await page.getByRole('table').waitFor();
      const rows = page.locator('tbody tr');
      assert((await rows.count()) === 2, 'FR-9: both missions are listed');
      assert(await rows.nth(0).getByText(fmt(en['admin.missions.counter'], { count: 2 })).isVisible(), 'FR-9: the counter of the first mission');
      assert(await rows.nth(1).getByText(en['admin.status.PUBLISHED']).isVisible(), 'the published mission shows its status');
    },
  },
  {
    id: 'slice6-source-edit-delete-refused',
    title: 'Edit a source; a referenced source cannot be deleted (FR-55)',
    proof: 'FR-55',
    steps:
      'From the source list choose Edit, change the edition to 2 and press Enter, then delete the source and confirm. ' +
      'Asserted: there is no file field, the edition is stored, and the delete is refused with its reason and the three ' +
      'referencing tasks named. The still shows the refusal under the edit form.',
    async run(page, backend) {
      await page.goto(`${BASE_URL}/admin/sources`);
      await page.getByRole('row', { name: /Matematika 6 – pracovní sešit/ }).getByRole('link', { name: en['admin.sources.edit'] }).click();
      const edition = page.getByLabel(en['admin.sources.edition'], { exact: true });
      await edition.waitFor();
      assert((await page.locator('input[type="file"]').count()) === 0, 'FR-55/CA-D3: the edit form offers no file field');
      await edition.fill('2');
      await edition.press('Enter');
      await page.getByRole('status').filter({ hasText: en['admin.sourceEdit.saved'] }).waitFor();
      assert(backend.sources[0].source.edition === '2', 'FR-55: the new edition is stored');
      await page.waitForTimeout(PAUSE_MS);
      await page.getByRole('button', { name: en['admin.sourceEdit.delete'] }).click();
      await page.waitForTimeout(PAUSE_MS);
      await page.getByRole('button', { name: en['admin.common.delete'], exact: true }).click();
      const alert = page.getByRole('alert');
      await alert.waitFor();
      assert((await alert.getByRole('link').count()) === 3, 'the refusal names the three referencing tasks');
      assert(backend.sources.length === 2, 'the source is kept');
    },
  },
  {
    id: 'slice6-task-status-blocked',
    title: 'A task in a published mission: unpublish refused, delete blocked (FR-55)',
    proof: 'FR-55',
    steps:
      'With the seeded mission and its tasks published, open the task editor and unpublish the task. Asserted: the ' +
      'refusal names the mission with a link, the task stays PUBLISHED, and delete is disabled with the explanation ' +
      'offering to unpublish instead. The still shows the status and deletion panel.',
    async run(page, backend) {
      backend.tasks.forEach((t) => (t.status = 'PUBLISHED'));
      backend.missions[0].status = 'PUBLISHED';
      await page.goto(`${BASE_URL}/admin/tasks/edit?taskId=${SEED.taskDecimal}`);
      const panel = page.getByRole('region', { name: en['admin.taskStatus.title'] });
      await panel.getByRole('button', { name: en['admin.taskStatus.unpublish'] }).waitFor();
      await page.waitForTimeout(PAUSE_MS);
      await panel.getByRole('button', { name: en['admin.taskStatus.unpublish'] }).click();
      const alert = panel.getByRole('alert');
      await alert.waitFor();
      assert(await alert.getByRole('link', { name: /Desetinná čísla/ }).isVisible(), 'the refusal names the published mission');
      assert(backend.tasks[0].status === 'PUBLISHED', 'the task stays PUBLISHED');
      assert(await panel.getByRole('button', { name: en['admin.taskStatus.delete'] }).isDisabled(), 'delete is disabled while a published mission holds the task');
      assert(await panel.getByText(en['admin.taskStatus.notDeletable']).isVisible(), 'the explanation offers to unpublish instead');
      await panel.scrollIntoViewIfNeeded();
    },
  },
];

async function recordClip(browser, clip) {
  const context = await browser.newContext({ viewport: VIEWPORT, recordVideo: { dir: join(OUT_DIR, 'raw'), size: VIEWPORT } });
  await context.addCookies([{ name: 'XSRF-TOKEN', value: CSRF_TOKEN, domain: 'localhost', path: '/', sameSite: 'Strict' }]);
  const backend = createFakeAdminBackend({ signedIn: true });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
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
  let error = null;
  try {
    await clip.run(page, backend);
    await page.waitForTimeout(1500);
  } catch (e) {
    error = e.message;
  }
  const screenshot = join(OUT_DIR, `${clip.id}.png`).replaceAll('\\', '/');
  await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
  const video = page.video();
  await page.close();
  await context.close();
  const videoPath = join(OUT_DIR, `${clip.id}.webm`).replaceAll('\\', '/');
  if (video) await video.saveAs(videoPath);
  const asserted = error === null;
  const explainer = join(OUT_DIR, `${clip.id}.md`).replaceAll('\\', '/');
  await writeFile(
    explainer,
    `# ${clip.title}\n\n**Proves:** ${clip.proof}\n\n**Result:** ${asserted ? 'asserted ✓' : `FAILED — ${error}`}\n\n${clip.steps}\n\n` +
      `Recorded against the production build (\`vite preview\`) with the admin API answered by the contract stub ` +
      `\`src/test/fake-admin-backend.ts\` (self-authored data). The real-stack click path is task 4.4 of ` +
      `implement-authoring-missions-ui (after the slice 6 merge).\n\n![still](${clip.id}.png)\n`,
  );
  console.log(`${asserted ? '✓' : '✗'} ${clip.id} (${clip.proof})${error ? ` — ${error}` : ''}`);
  return { id: clip.id, title: clip.title, proof: clip.proof, video: videoPath, screenshot, explainer, asserted };
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
    const results = [];
    for (const clip of CLIPS) results.push(await recordClip(browser, clip));
    await browser.close();
    await rm(join(OUT_DIR, 'raw'), { recursive: true, force: true });
    await writeFile(join(OUT_DIR, 'manifest.json'), `${JSON.stringify({ kind: 'demo', results }, null, 2)}\n`);
    if (results.some((r) => !r.asserted)) exitCode = 1;
  } finally {
    stop(server);
  }
  process.exit(exitCode);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
