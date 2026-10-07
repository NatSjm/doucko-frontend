// Slice 8 recordings (gamification "Progress on HQ", "Rank-up celebration", "No negative mechanics";
// practice-flow "Mission complete screen", "Replay completed missions"): headless Chromium clips of
// the child screens at 1280×720. Each clip ASSERTS what it shows and gets a still of the screen in
// its key state, so the vision-verify workflow can judge FR-36 (the celebration) and FR-37 (HQ). The
// manifest uses the shape of scripts/record-demos.mjs, which scripts/check-recordings.mjs validates;
// record-demos.mjs is framework-owned (../docs/factory), so these project clips live here like
// tools/record-slice7.mjs.
//
// The app is the production build served by `vite preview`; the child API is answered by the shared
// contract stub src/test/fake-child-backend.ts (no stack needed, self-authored practice seed, the
// fictional display name: NFR-3/NFR-4).
//
// Run: `npm run build && node tools/record-slice8.mjs` (Node ≥ 22.18 or 24: imports TypeScript directly).
import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { childRequest, completeMission, createFakeBackend, creditOutsideSession, PLACEHOLDER_LADDER, PRACTICE, PROMPTS, practise } from '../src/test/fake-child-backend.ts';
import { cs } from '../src/i18n/cs.ts';

const PORT = 4179;
const BASE_URL = `http://localhost:${PORT}`;
const OUT_DIR = 'docs/qa/demo-recordings/slice8-gamification';
const VIEWPORT = { width: 1280, height: 720 };
const PAUSE_MS = 700;
const [, RANK2, RANK3, , RANK5] = PLACEHOLDER_LADDER.map((r) => r.name);

const assert = (cond, msg) => {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
};
const fmt = (template, vars) => template.replace(/\{(\w+)\}/g, (w, k) => (k in vars ? String(vars[k]) : w));
const panel = (page) => page.getByRole('region', { name: cs['child.hq.progressTitle'] });
const celebration = (page) => page.getByRole('status').filter({ hasText: cs['child.rankUp.kicker'] });
const isFocused = (locator) => locator.evaluate((el) => el === document.activeElement);
/** Animations of the celebration, running or played (CSS keeps their end state). */
const celebrationAnimations = (page) =>
  page.evaluate(() => document.getAnimations().filter((a) => a.effect?.target?.closest('[role="status"]') && Number(a.effect?.getComputedTiming().duration ?? 0) > 1).length);

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

/**
 * Earlier practice behind the HQ clips, so XP, solved tasks and mission states agree: missions 1 and
 * the perimeter mission complete, task 1 of mission 2 solved (5 tasks, 90 XP). The seed has only 6
 * tasks, so XP beyond that comes as a credit outside a session (an admin re-evaluation or a
 * publish-time bonus in the spec); `ackRank` marks its rank-up as already celebrated.
 */
async function earlierPractice(backend, credit = 0, ackRank = null) {
  await completeMission(backend, PRACTICE.missionA);
  await completeMission(backend, PRACTICE.missionPerimeter);
  await practise(backend, PRACTICE.missionB, PRACTICE.taskThousands, { a: '1250' });
  if (credit) creditOutsideSession(backend, credit);
  if (ackRank !== null) await childRequest(backend, 'POST', '/api/child/hq/rank-up-ack', { rankIndex: ackRank });
}

/** Each clip: a fresh seeded backend (optionally prepared), a flow that asserts its FRs, and the still it ends on. */
const CLIPS = [
  {
    id: 'slice8-hq-progress',
    title: 'HQ progress: rank, XP bar towards the next rank and solved tasks (FR-37)',
    proof: 'FR-37',
    steps:
      'After 5 solved tasks (90 XP) and a 185 XP credit already celebrated (275 XP), open HQ. Asserted: the progress panel shows the 2nd rank "' +
      RANK2 +
      '" (Hodnost 2), 275 XP, the bar at 125 of 250 XP with "125 z 250 XP do hodnosti ' +
      RANK3 +
      '", and "Vyřešené úlohy: 5"; no minus sign, timer or streak. The still shows HQ.',
    async prepare(backend) {
      await earlierPractice(backend, 185, 1);
    },
    async run(page) {
      await page.goto(`${BASE_URL}/`);
      await panel(page).waitFor();
      const text = await panel(page).textContent(); // the DOM text: the kicker is shown upper-case
      assert(text.includes(RANK2), 'FR-37: the 2nd rank is shown');
      assert(text.includes(fmt(cs['child.hq.rank'], { n: 2 })), 'FR-37: "Hodnost 2"');
      assert(text.includes(fmt(cs['child.hq.xpToNext'], { have: 125, need: 250, rank: RANK3 })), 'FR-37: 125 of 250 XP towards the 3rd rank');
      assert(text.includes(fmt(cs['child.hq.solved'], { n: 5 })), 'FR-37: 5 solved tasks');
      const bar = panel(page).getByRole('progressbar', { name: cs['child.hq.xpBar'] });
      assert((await bar.getAttribute('aria-valuenow')) === '125' && (await bar.getAttribute('aria-valuemax')) === '250', 'FR-37: the bar is at 125 of 250');
      const fill = await panel(page).locator('.dk-xp-fill').evaluate((el) => el.getBoundingClientRect().width / el.parentElement.getBoundingClientRect().width);
      assert(fill > 0.4 && fill < 0.6, 'FR-37: the bar is drawn half full');
      assert(!/[-−]\s*\d+\s*XP/.test(await page.locator('main').innerText()), 'FR-38: no negative XP');
    },
  },
  {
    id: 'slice8-hq-top-rank',
    title: 'HQ at the top rank: a full bar marked "Nejvyšší hodnost!" with no next target (FR-37)',
    proof: 'FR-37',
    steps:
      'After 5 solved tasks (90 XP) and a 1510 XP credit already celebrated (1600 XP), open HQ. Asserted: the 5th rank "' +
      RANK5 +
      '", "1 600 XP" with a no-break space, a full bar, "Nejvyšší hodnost!" and no "do hodnosti" target. The still shows HQ.',
    async prepare(backend) {
      await earlierPractice(backend, 1510, 4);
    },
    async run(page) {
      await page.goto(`${BASE_URL}/`);
      await panel(page).waitFor();
      const text = await panel(page).innerText();
      assert(text.includes(RANK5), 'FR-37: the 5th rank');
      assert(text.includes(cs['child.hq.topRank']) && !text.includes('do hodnosti'), 'FR-37: highest rank, no next target');
      assert((await panel(page).textContent()).includes('1 600 XP'), 'Czech number with a no-break space');
      const fill = await panel(page).locator('.dk-xp-fill').evaluate((el) => el.getBoundingClientRect().width / el.parentElement.getBoundingClientRect().width);
      assert(fill > 0.95, 'FR-37: the bar is full');
    },
  },
  {
    id: 'slice8-rankup-hq',
    title: 'A rank-up credited outside a session is celebrated once on HQ and acknowledged (FR-36)',
    proof: 'FR-36',
    steps:
      'After 5 solved tasks (90 XP), a 60 XP credit outside a child session takes the total to 150 XP; open HQ. Asserted: the celebration names the new ' +
      'rank "' +
      RANK2 +
      '" with the medal and "Nová hodnost!", it animates, the client acknowledges rank 1 exactly once, and a reload shows ' +
      'no celebration. The still is the celebration on HQ, taken before the reload.',
    async prepare(backend) {
      await earlierPractice(backend, 60);
    },
    async run(page, backend, still) {
      await page.goto(`${BASE_URL}/`);
      await celebration(page).waitFor();
      assert((await celebration(page).innerText()).includes(fmt(cs['child.rankUp.text'], { rank: RANK2 })), 'FR-36: names the new rank');
      assert(await celebration(page).locator('svg.dk-rank-medal').isVisible(), 'FR-36: the rank medal');
      assert((await celebrationAnimations(page)) > 0, 'FR-36: the celebration animates');
      await page.waitForTimeout(1500);
      assert(JSON.stringify(backend.practice.acks) === '[1]', 'FR-36: acknowledged once');
      await still();
      await page.reload();
      await panel(page).waitFor();
      assert((await page.getByText(cs['child.rankUp.kicker']).count()) === 0, 'FR-36: never plays again');
    },
  },
  {
    id: 'slice8-rankup-reduced-motion',
    title: 'The rank-up celebration under reduced motion: same text and medal, nothing moves (FR-36, NFR-13)',
    proof: 'FR-36, NFR-13',
    reducedMotion: 'reduce',
    steps:
      'The same pending rank-up, with the OS asking for reduced motion. Asserted: the celebration shows the same text ' +
      '("Nová hodnost!", the rank name, the sentence) and the medal, and no animation exists on the page. The still shows it.',
    async prepare(backend) {
      await earlierPractice(backend, 60);
    },
    async run(page) {
      await page.goto(`${BASE_URL}/`);
      await celebration(page).waitFor();
      assert((await celebration(page).innerText()).includes(fmt(cs['child.rankUp.text'], { rank: RANK2 })), 'FR-36: same text');
      assert(await celebration(page).locator('svg.dk-rank-medal').isVisible(), 'FR-36: the medal');
      assert((await celebrationAnimations(page)) === 0, 'NFR-13: no animation under reduced motion');
      const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
      assert(running === 0, 'NFR-13: nothing moves on the page');
    },
  },
  {
    id: 'slice8-rankup-task',
    title: 'A task award crossing a threshold mid-mission celebrates on the feedback with "+10 XP" (FR-36, FR-38)',
    proof: 'FR-36, FR-38',
    steps:
      'With 145 XP, answer task 1 of mission 1 correctly with the keyboard. Asserted: "Výborně!" with "+10 XP", the ' +
      'celebration naming "' +
      RANK2 +
      '" under the feedback, focus on "Další úloha", no acknowledgement needed (the answer carried it). The still shows the task.',
    async prepare(backend) {
      backend.practice.totalXp = 145;
    },
    async run(page, backend) {
      await page.goto(`${BASE_URL}/task?missionId=${PRACTICE.missionA}&taskId=${PRACTICE.taskSum}`);
      await page.waitForFunction(() => document.activeElement?.tagName === 'INPUT');
      await page.keyboard.type('0,75', { delay: 80 });
      await page.keyboard.press('Enter');
      await celebration(page).waitFor();
      assert(await page.getByText(fmt(cs['child.task.xp'], { xp: 10 })).isVisible(), 'FR-38: +10 XP shown');
      assert((await celebration(page).innerText()).includes(RANK2), 'FR-36: names the new rank');
      assert(await isFocused(page.getByRole('link', { name: cs['child.task.next'] })), 'focus on "Další úloha"');
      assert(backend.practice.acks.length === 0, 'FR-36: an attempt rank-up needs no acknowledgement');
    },
  },
  {
    id: 'slice8-mission-complete',
    title: 'Mission complete: XP earned in the run, first-try count, from the last task by keyboard (FR-32)',
    proof: 'FR-32, FR-38',
    steps:
      'Mission 2 with task 1 solved first time; answer task 2 wrong, then right. Asserted: "+5 XP" and "+20 XP bonus za ' +
      'splněnou misi", focus on "Výsledky mise"; Enter opens "Mise je splněná!" with "+35 XP", "Získala jsi 35 XP.", ' +
      '"1 na první pokus" and "Úloh v misi: 2", and no celebration. The still shows the mission-complete screen.',
    async prepare(backend) {
      await practise(backend, PRACTICE.missionB, PRACTICE.taskThousands, { a: '1250' });
    },
    async run(page) {
      await page.goto(`${BASE_URL}/task?missionId=${PRACTICE.missionB}&taskId=${PRACTICE.taskMulti}`);
      await page.getByText(PROMPTS.multi).waitFor();
      await page.getByText('0,9').click();
      await page.keyboard.press('Enter');
      await page.getByText(cs['child.task.almost']).waitFor();
      await page.waitForTimeout(PAUSE_MS);
      await page.getByText('0,9').click();
      await page.getByText('1,5').click();
      await page.getByText('2', { exact: true }).click();
      await page.keyboard.press('Enter');
      await page.getByText(fmt(cs['child.task.bonus'], { xp: 20 })).waitFor();
      assert(await page.getByText(fmt(cs['child.task.xp'], { xp: 5 })).isVisible(), 'FR-38: +5 XP on the 2nd attempt');
      const results = page.getByRole('link', { name: cs['child.mission.results'] });
      assert(await isFocused(results), 'focus on "Výsledky mise"');
      await page.waitForTimeout(PAUSE_MS);
      await page.keyboard.press('Enter');
      await page.getByRole('heading', { level: 1, name: cs['child.summary.title'] }).waitFor();
      assert(await page.getByText(fmt(cs['child.summary.xp'], { xp: 35 })).isVisible(), 'FR-32: +35 XP earned');
      assert(await page.getByText(fmt(cs['child.summary.firstTry'], { n: 1 })).isVisible(), 'FR-32: 1 na první pokus');
      assert(await page.getByText(fmt(cs['child.summary.taskCount'], { n: 2 })).isVisible(), 'FR-32: 2 tasks');
      assert((await page.getByText(cs['child.rankUp.kicker']).count()) === 0, 'FR-36: no rank-up, no celebration');
    },
  },
  {
    id: 'slice8-mission-complete-rankup',
    title: 'Mission complete with a rank-up: the celebration on the summary, then a static line on return (FR-32, FR-36)',
    proof: 'FR-32, FR-36',
    steps:
      'With 140 XP, solve the only task of the perimeter mission (10 XP + 20 XP bonus). Asserted: the task screen shows no ' +
      'celebration; "Výsledky mise" opens the summary with "+30 XP" and the celebration naming "' +
      RANK2 +
      '", acknowledged once. The still shows the summary with the celebration; afterwards a reload lists ' +
      '"Nová hodnost: ' +
      RANK2 +
      '" statically.',
    async prepare(backend) {
      backend.practice.totalXp = 140;
    },
    async run(page, backend, still) {
      await page.goto(`${BASE_URL}/task?missionId=${PRACTICE.missionPerimeter}&taskId=${PRACTICE.taskSquare}`);
      await page.waitForFunction(() => document.activeElement?.tagName === 'INPUT');
      await page.keyboard.type('8 cm', { delay: 80 });
      await page.keyboard.press('Enter');
      await page.getByRole('link', { name: cs['child.mission.results'] }).waitFor();
      assert((await page.getByText(cs['child.rankUp.kicker']).count()) === 0, 'FR-36: the completing rank-up waits for the summary');
      await page.waitForTimeout(PAUSE_MS);
      await page.keyboard.press('Enter');
      await celebration(page).waitFor();
      assert(await page.getByText(fmt(cs['child.summary.xp'], { xp: 30 })).isVisible(), 'FR-32: +30 XP');
      assert((await celebration(page).innerText()).includes(RANK2), 'FR-36: names the new rank');
      await page.waitForTimeout(1500);
      assert(JSON.stringify(backend.practice.acks) === '[1]', 'FR-36: acknowledged once');
      await still();
      await page.reload();
      await page.getByText(fmt(cs['child.summary.rankReached'], { rank: RANK2 })).waitFor();
      assert((await page.getByText(cs['child.rankUp.kicker']).count()) === 0, 'FR-36: no second celebration');
    },
  },
  {
    id: 'slice8-replay',
    title: 'Replay a completed mission: fresh attempts, no XP, mission stays complete on HQ (FR-33)',
    proof: 'FR-33, FR-32',
    steps:
      'With the perimeter mission completed, open its briefing and press "Zopakovat misi". Asserted: the task opens with ' +
      '0 of 2 attempts used and an empty input; a correct answer shows no XP; "Výsledky mise" opens "Opakování je hotové!" ' +
      'with the replay note (0 XP); the total XP is unchanged. The still shows the replay summary.',
    async prepare(backend) {
      await completeMission(backend, PRACTICE.missionPerimeter);
    },
    async run(page, backend) {
      const total = backend.practice.totalXp;
      await page.goto(`${BASE_URL}/mission?missionId=${PRACTICE.missionPerimeter}`);
      await page.getByRole('button', { name: cs['child.mission.replay'] }).waitFor();
      await page.waitForTimeout(PAUSE_MS);
      await page.getByRole('button', { name: cs['child.mission.replay'] }).click();
      await page.getByText(PROMPTS.square).waitFor();
      assert(await page.getByText(fmt(cs['child.task.attempts'], { used: 0, total: 2 })).isVisible(), 'FR-33: 0 of 2 attempts used');
      assert((await page.getByRole('textbox', { name: 'a' }).inputValue()) === '', 'FR-33: empty input');
      await page.keyboard.type('8 cm', { delay: 80 });
      await page.keyboard.press('Enter');
      await page.getByText(cs['child.task.correct']).waitFor();
      assert(!(await page.locator('main').innerText()).includes('XP'), 'FR-33: a replay earns no XP');
      await page.getByRole('link', { name: cs['child.mission.results'] }).click();
      await page.getByRole('heading', { level: 1, name: cs['child.summary.replayTitle'] }).waitFor();
      assert(await page.getByText(fmt(cs['child.summary.replayText'], { xp: 0 })).isVisible(), 'FR-33: the replay note (0 XP)');
      assert(backend.practice.totalXp === total, 'FR-33: total XP unchanged');
      assert(backend.practice.replayAttempts.length === 1, 'FR-33: the replay attempt is logged');
    },
  },
];

async function recordClip(browser, clip) {
  const context = await browser.newContext({ viewport: VIEWPORT, reducedMotion: clip.reducedMotion ?? 'no-preference', recordVideo: { dir: join(OUT_DIR, 'raw'), size: VIEWPORT } });
  const backend = createFakeBackend();
  if (clip.prepare) await clip.prepare(backend);
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const body = request.postDataBuffer();
    let response;
    try {
      response = await backend.handle(
        new Request(request.url(), {
          method: request.method(),
          headers: request.headers(),
          body: body && !['GET', 'HEAD'].includes(request.method()) ? new Uint8Array(body) : undefined,
        }),
      );
    } catch {
      return route.abort('failed');
    }
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
  });
  const screenshot = join(OUT_DIR, `${clip.id}.png`).replaceAll('\\', '/');
  let taken = false;
  /** The clip's key state: a clip may take its still before a final check that changes the screen. */
  const still = async () => {
    await page.screenshot({ path: screenshot, fullPage: true });
    taken = true;
  };
  let error = null;
  try {
    await clip.run(page, backend, still);
    await page.waitForTimeout(1500);
  } catch (e) {
    error = e.message;
  }
  if (!taken) await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
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
      `Recorded at 1280×720 against the production build (\`vite preview\`) with the child API answered by the contract ` +
      `stub \`src/test/fake-child-backend.ts\` (self-authored practice seed, placeholder rank ladder, fictional display ` +
      `name). The real-stack click path is task 4.4 of implement-gamification-ui (after the slice 8 merge).\n\n![still](${clip.id}.png)\n`,
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
