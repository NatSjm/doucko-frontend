// Slice 7 recordings (practice-flow "HQ without login", "Mission list on HQ", "Start or continue
// within two clicks", "Task screen", "Two attempts, then reveal", "Hints on demand", "Ukrainian
// translation toggle", "Report a problem", "Save and resume"; answer-checking UNPARSEABLE): headless
// Chromium clips of the child screens at 1280×720. Each clip ASSERTS what it shows and gets a still
// of the screen in its key state, so the visual review lens can check the slice 7 UI. The manifest
// uses the shape of scripts/record-demos.mjs, which scripts/check-recordings.mjs validates;
// record-demos.mjs is framework-owned (../docs/factory), so these project clips live here like
// tools/record-slice6.mjs.
//
// The app is the production build served by `vite preview`; the child API is answered by the shared
// contract stub src/test/fake-child-backend.ts (no stack needed, self-authored practice seed, the
// fictional display name: NFR-3/NFR-4).
//
// Run: `npm run build && node tools/record-slice7.mjs` (Node ≥ 22.18 or 24: imports TypeScript directly).
import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFakeBackend, PRACTICE, PROMPTS, practise } from '../src/test/fake-child-backend.ts';
import { FORMAT_TIP } from '../src/test/fake-admin-backend.ts';
import { cs } from '../src/i18n/cs.ts';

const PORT = 4178;
const BASE_URL = `http://localhost:${PORT}`;
const OUT_DIR = 'docs/qa/demo-recordings/slice7-practice-flow';
const VIEWPORT = { width: 1280, height: 720 };
const PAUSE_MS = 700;

const assert = (cond, msg) => {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
};
const fmt = (template, vars) => template.replace(/\{(\w+)\}/g, (w, k) => (k in vars ? String(vars[k]) : w));
const task = (missionId, taskId) => `${BASE_URL}/task?missionId=${missionId}&taskId=${taskId}`;
const part = (page, key) => page.locator(`[data-part="${key}"]`);
/** The task screen is ready for typing: the first part input has focus. */
const focusedInput = (page) => page.waitForFunction(() => document.activeElement?.tagName === 'INPUT');
const isFocused = (locator) => locator.evaluate((el) => el === document.activeElement);

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

/** Each clip: a fresh seeded backend (optionally prepared), a flow that asserts its FRs, and the still it ends on. */
const CLIPS = [
  {
    id: 'slice7-hq-missions',
    title: 'HQ without login: missions by topic with x/N vyřešeno and their states (FR-24, FR-25, NFR-7)',
    proof: 'FR-24, FR-25, NFR-7',
    steps:
      'With one task of mission 1 resolved and the perimeter mission revealed, open the app. Asserted: HQ greets the ' +
      'fictional profile with no login form, the topics are grouped with mission 1 before mission 2, the cards show ' +
      '1/3 in progress, 0/2 new and 1/1 complete, the draft mission has no card, and "Pokračovat" is offered. The still shows HQ.',
    async prepare(backend) {
      await practise(backend, PRACTICE.missionA, PRACTICE.taskSum, { a: '0,75' });
      await practise(backend, PRACTICE.missionPerimeter, PRACTICE.taskSquare, { a: '6 cm' });
      await practise(backend, PRACTICE.missionPerimeter, PRACTICE.taskSquare, { a: '7 cm' });
    },
    async run(page) {
      await page.goto(`${BASE_URL}/`);
      await page.getByRole('heading', { level: 1, name: fmt(cs['child.hq.greeting'], { name: 'Agent Nova' }) }).waitFor();
      assert((await page.locator('input[type="password"]').count()) === 0, 'FR-24: no login form');
      const topics = await page.getByRole('heading', { level: 2 }).allInnerTexts();
      assert(
        topics.join('|') === [fmt(cs['child.hq.topic'], { name: 'Desetinná čísla' }), fmt(cs['child.hq.topic'], { name: 'Obvod a obsah' })].join('|'),
        'FR-25: grouped by topic',
      );
      const cards = page.getByRole('region', { name: fmt(cs['child.hq.topic'], { name: 'Desetinná čísla' }) }).getByRole('link');
      assert((await cards.nth(0).textContent()).includes(fmt(cs['child.hq.progress'], { resolved: 1, total: 3 })), 'FR-25: mission 1 shows 1/3 vyřešeno');
      assert((await cards.nth(0).textContent()).includes(cs['child.hq.state.IN_PROGRESS']), 'FR-25: mission 1 in progress');
      assert((await cards.nth(1).textContent()).includes(cs['child.hq.state.NEW']), 'FR-25: mission 2 new');
      const perimeter = page.getByRole('region', { name: fmt(cs['child.hq.topic'], { name: 'Obvod a obsah' }) }).getByRole('link');
      assert((await perimeter.count()) === 1, 'FR-25: the draft mission has no card');
      assert((await perimeter.textContent()).includes(cs['child.hq.state.COMPLETE']), 'FR-25: the revealed mission is complete');
      assert(await page.getByRole('link', { name: cs['child.hq.continue'] }).isVisible(), 'NFR-7: "Pokračovat" is offered');
    },
  },
  {
    id: 'slice7-start-two-clicks',
    title: 'Start a new mission in two clicks: card, then "Začít misi" (FR-25, FR-26, NFR-7)',
    proof: 'FR-25, FR-26, NFR-7',
    steps:
      'On HQ click mission 2, see its briefing, click "Začít misi". Asserted: two clicks open task 1 of mission 2 with ' +
      'its prompt and focus in input a. The still shows the task screen.',
    async run(page) {
      await page.goto(`${BASE_URL}/`);
      await page.getByRole('link', { name: new RegExp(fmt(cs['child.hq.mission'], { n: 2 })) }).click();
      await page.getByRole('link', { name: cs['child.mission.start'] }).waitFor();
      await page.waitForTimeout(PAUSE_MS);
      await page.getByRole('link', { name: cs['child.mission.start'] }).click();
      await page.getByText(PROMPTS.thousands).waitFor();
      assert(await isFocused(page.getByRole('textbox', { name: 'a' })), 'FR-26: focus in input a');
    },
  },
  {
    id: 'slice7-correct-next',
    title: 'Correct on the first attempt: "Výborně!" and "Další úloha" (FR-26, FR-27, NFR-7)',
    proof: 'FR-26, FR-27, NFR-7',
    steps:
      'On the task with an image, type 0,75 and press Enter. Asserted: the image is shown, the answer is graded correct, ' +
      'the part locks and "Další úloha" takes focus. The still shows the solved task.',
    async run(page) {
      await page.goto(task(PRACTICE.missionA, PRACTICE.taskSum));
      await focusedInput(page);
      await page.getByRole('img', { name: fmt(cs['child.task.image'], { n: 1 }) }).waitFor();
      await page.keyboard.type('0,75', { delay: 80 });
      await page.keyboard.press('Enter');
      await page.getByText(cs['child.task.correct']).waitFor();
      assert(await isFocused(page.getByRole('link', { name: cs['child.task.next'] })), 'NFR-7: "Další úloha" focused');
      assert((await page.getByRole('textbox', { name: 'a' }).getAttribute('readonly')) !== null, 'FR-27: the part locks');
    },
  },
  {
    id: 'slice7-wrong-then-reveal',
    title: 'Two attempts, then the reveal: wrong part in "almost", right part locked, answers shown neutrally (FR-27)',
    proof: 'FR-27',
    steps:
      'On the two-part task answer a right and b wrong, then b wrong again. Asserted: after attempt 1 b shows "Zkus znovu", a ' +
      'is locked and 1 of 2 attempts is used, without the correct value of b; after attempt 2 "Nevadí, příště!" and the ' +
      'correct answers are shown, the inputs are read-only and nothing says "Špatně" or "Chyba". The still shows the reveal.',
    async run(page, backend) {
      await page.goto(task(PRACTICE.missionA, PRACTICE.taskRound));
      await focusedInput(page);
      await page.keyboard.type('3,5', { delay: 80 });
      await page.keyboard.press('Tab');
      await page.keyboard.type('7,1', { delay: 80 });
      await page.keyboard.press('Enter');
      await page.getByText(cs['child.task.almost']).waitFor();
      assert(await part(page, 'b').getByText(cs['child.task.partWrong']).isVisible(), 'FR-27: b marked wrong');
      assert(await page.getByText(fmt(cs['child.task.attempts'], { used: 1, total: 2 })).isVisible(), 'FR-27: 1 of 2 used');
      assert((await page.getByText(cs['child.task.correctAnswer']).count()) === 0, 'FR-27: no correct value after attempt 1');
      await page.waitForTimeout(1500);
      await part(page, 'b').getByRole('textbox').fill('7,2');
      await page.keyboard.press('Enter');
      await page.getByText(cs['child.task.revealed']).waitFor();
      assert(backend.practice.progress.get(PRACTICE.taskRound)?.state === 'REVEALED', 'FR-27: the task is REVEALED');
      assert(await part(page, 'b').getByText('7', { exact: true }).isVisible(), 'FR-27: the answer of b is revealed');
      assert(!/Špatně|Chyba/.test(await page.locator('body').innerText()), 'FR-27: never "Špatně" or "Chyba"');
    },
  },
  {
    id: 'slice7-unparseable',
    title: 'Unreadable input: a format tip, the typed text kept, no attempt used (FR-22)',
    proof: 'FR-22',
    steps:
      'On the two-part task type 3,5 and 5,,2 and press Enter. Asserted: b shows the format tip, keeps 5,,2, and the ' +
      'indicator still shows 0 of 2 attempts used; no attempt is stored. The still shows the tip.',
    async run(page, backend) {
      await page.goto(task(PRACTICE.missionA, PRACTICE.taskRound));
      await focusedInput(page);
      await page.keyboard.type('3,5', { delay: 80 });
      await page.keyboard.press('Tab');
      await page.keyboard.type('5,,2', { delay: 80 });
      await page.keyboard.press('Enter');
      await page.getByText(cs['child.task.format']).waitFor();
      assert(await part(page, 'b').getByText(FORMAT_TIP).isVisible(), 'FR-22: the format tip on b');
      assert((await part(page, 'b').getByRole('textbox').inputValue()) === '5,,2', 'FR-22: the typed text stays');
      assert(await page.getByText(fmt(cs['child.task.attempts'], { used: 0, total: 2 })).isVisible(), 'FR-22: no attempt used');
      assert(backend.practice.attempts.length === 0, 'FR-22: nothing stored');
    },
  },
  {
    id: 'slice7-hints-translation',
    title: 'Hints in order and the Ukrainian translation next to the Czech (FR-28, FR-29)',
    proof: 'FR-28, FR-29',
    steps:
      'Open both hints one at a time, then turn on "Zobrazit ukrajinsky". Asserted: the hint counter goes 2 → 1 → 0 and the ' +
      'button ends disabled, both hints are recorded, the profile setting is uk and the Ukrainian prompt and hint 1 show ' +
      'next to the Czech while the buttons stay Czech. The still shows the translated task with its hints.',
    async run(page, backend) {
      await page.goto(task(PRACTICE.missionA, PRACTICE.taskSum));
      await focusedInput(page);
      const hint = page.getByRole('button', { name: new RegExp(`^${cs['child.task.hint']}`) });
      await hint.waitFor();
      assert((await hint.innerText()).includes(fmt(cs['child.task.hintsLeft'], { n: 2 })), 'FR-28: 2 hints left');
      await hint.click();
      await page.getByText('Zapiš obě čísla na setiny.').waitFor();
      await page.waitForTimeout(PAUSE_MS);
      await hint.click();
      await page.getByText('Sečti 50 setin a 25 setin.').waitFor();
      assert(await hint.isDisabled(), 'FR-28: no hint left, button disabled');
      assert(backend.practice.hintsOpened.get(PRACTICE.taskSum) === 2, 'FR-28: two hints recorded');
      await page.waitForTimeout(PAUSE_MS);
      await page.getByRole('button', { name: cs['child.task.showTranslation'] }).click();
      await page.getByText('Додай 0,5 + 0,25.').waitFor();
      assert(backend.practice.settings.secondaryTaskLocale === 'uk', 'FR-29: the toggle is stored in the profile');
      assert(await page.locator('[lang="uk"]').filter({ hasText: 'Запиши обидва числа в сотих.' }).isVisible(), 'FR-29: the translated hint');
      assert(await page.getByRole('button', { name: cs['child.task.submit'] }).isVisible(), 'FR-29: the UI stays Czech');
    },
  },
  {
    id: 'slice7-report',
    title: '"Nahlásit problém": the attempt attached, thanks, attempts unchanged; "Jiné" needs a note (FR-30)',
    proof: 'FR-30',
    steps:
      'After a wrong attempt report "Myslím, že moje odpověď je správně", then open the dialog again and send "Jiné" ' +
      'without a note. Asserted: the first report is stored with the raw attempt, "Díky, podívám se na to!" is shown and ' +
      '1 attempt is still left; the second is refused with "Napiš prosím krátce, co nesedí." The still shows the dialog.',
    async run(page, backend) {
      await page.goto(task(PRACTICE.missionA, PRACTICE.taskSum));
      await focusedInput(page);
      await page.keyboard.type('0,7', { delay: 80 });
      await page.keyboard.press('Enter');
      await page.getByText(cs['child.task.almost']).waitFor();
      await page.getByRole('button', { name: cs['child.report.open'] }).click();
      const dialog = page.getByRole('dialog', { name: cs['child.report.title'] });
      await dialog.getByRole('radio', { name: cs['child.report.reason.ANSWER_IS_CORRECT'] }).check();
      await page.waitForTimeout(PAUSE_MS);
      await dialog.getByRole('button', { name: cs['child.report.send'] }).click();
      await page.getByText(cs['child.report.thanks']).waitFor();
      assert(backend.practice.reports.length === 1 && backend.practice.reports[0].attempt?.a === '0,7', 'FR-30: the report carries the raw attempt');
      assert(backend.practice.progress.get(PRACTICE.taskSum)?.attemptsUsed === 1, 'FR-30: attempts unchanged');
      await page.waitForTimeout(1200);
      await page.getByRole('button', { name: cs['child.report.open'] }).click();
      await dialog.getByRole('radio', { name: cs['child.report.reason.OTHER'] }).check();
      await dialog.getByRole('button', { name: cs['child.report.send'] }).click();
      await dialog.getByText(cs['child.report.noteRequired']).waitFor();
      assert(backend.practice.reports.length === 1, 'FR-30: "Jiné" without a note is not sent');
      await dialog.scrollIntoViewIfNeeded();
    },
  },
  {
    id: 'slice7-save-resume',
    title: 'Save and resume: a failed save keeps the input; reopening continues at the stored attempt (FR-31)',
    proof: 'FR-31',
    steps:
      'With the backend unreachable submit 7,1 on the two-part task; with it back submit again; then open the app afresh ' +
      'and press "Pokračovat". Asserted: the failure message shows and nothing is stored, the retry is graded as attempt 1 ' +
      '(one attempt in the log), and the reopened app lands on that task with 1 of 2 used and b marked. The still shows the resumed task.',
    async prepare(backend) {
      await practise(backend, PRACTICE.missionA, PRACTICE.taskSum, { a: '0,75' });
    },
    async run(page, backend) {
      await page.goto(task(PRACTICE.missionA, PRACTICE.taskRound));
      await focusedInput(page);
      await page.keyboard.type('3,5', { delay: 80 });
      await page.keyboard.press('Tab');
      await page.keyboard.type('7,1', { delay: 80 });
      backend.down = true;
      await page.keyboard.press('Enter');
      await page.getByRole('alert').filter({ hasText: cs['child.task.saveFailed'] }).waitFor();
      assert(backend.practice.attempts.length === 1, 'FR-31: the failed submission stored nothing (only the earlier task 1)');
      await page.waitForTimeout(1500);
      backend.down = false;
      await page.getByRole('button', { name: cs['child.task.submit'] }).click();
      await page.getByText(cs['child.task.almost']).waitFor();
      assert(backend.practice.attempts.filter((a) => a.taskId === PRACTICE.taskRound).length === 1, 'FR-31: exactly one attempt stored');
      await page.waitForTimeout(PAUSE_MS);
      await page.goto(`${BASE_URL}/`);
      await page.getByRole('link', { name: cs['child.hq.continue'] }).click();
      await page.getByText(PROMPTS.round).waitFor();
      assert(await page.getByText(fmt(cs['child.task.attempts'], { used: 1, total: 2 })).isVisible(), 'FR-31: 1 of 2 used after reopening');
      assert(/dk-part-wrong/.test((await part(page, 'b').getAttribute('class')) ?? ''), 'FR-31: b still marked');
    },
  },
];

async function recordClip(browser, clip) {
  const context = await browser.newContext({ viewport: VIEWPORT, recordVideo: { dir: join(OUT_DIR, 'raw'), size: VIEWPORT } });
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
      `Recorded at 1280×720 against the production build (\`vite preview\`) with the child API answered by the contract ` +
      `stub \`src/test/fake-child-backend.ts\` (self-authored practice seed, fictional display name). The real-stack click ` +
      `path is task 4.4 of implement-practice-flow-ui (after the slice 7 merge).\n\n![still](${clip.id}.png)\n`,
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
