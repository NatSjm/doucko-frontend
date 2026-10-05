// @trace NFR-5
import type { APIRequestContext, Page } from '@playwright/test';
import type { components } from '../src/api/generated/schema';
import { messages as m } from '../src/i18n/messages';
import { PRACTICE } from '../src/test/fake-child-backend';
import { childBackend } from './fixtures/child';
import { AGAINST_STACK, expect, test } from './fixtures/test';

// NFR-5 timing (practice-flow "Task screen: Load time", "Two attempts, then reveal: Check round-trip
// time"), measured against the Docker Compose stack (TC-5) with the seeded fixture content, on the
// machine that runs the check. Without a stack (`vite preview` + the contract stub) those two tests
// SKIP — a skip is never reported as a pass — and a third test measures only the FRONTEND SHARE of
// the load budget (navigation, rendering, image decode against the stub's instant answers). That
// bound is not the NFR-5 acceptance; it catches a UI that alone would eat the budget.
//
//   E2E_BASE_URL=http://127.0.0.1:8081 DOUCKO_CHILD_DISPLAY_NAME=… npx playwright test e2e/practice-timing.spec.ts
//
// The round-trip test writes ~220 graded attempts (and replays) into the stack's profile, so it also
// needs E2E_PRACTICE_WRITES=1: never run it against a stack holding a real child's progress.
const NO_STACK = 'NFR-5 is measured against the Docker Compose stack (set E2E_BASE_URL); the contract stub has no server timing to measure';

type S = components['schemas'];
const LOAD_BUDGET_MS = 1500;
const CHECK_P95_BUDGET_MS = 300;

/** A published mission with a start button: not complete, its first task holding an image when one exists. */
async function startableMission(request: APIRequestContext): Promise<string | null> {
  const preferred = process.env.E2E_TIMING_MISSION_ID;
  if (preferred) return preferred;
  const hq = (await (await request.get('/api/child/hq')).json()) as S['HqView'];
  const open = hq.topics.flatMap((t) => t.missions).filter((mission) => mission.state !== 'COMPLETE');
  for (const mission of open) {
    const res = await request.get(`/api/child/missions/${mission.missionId}/current-task`);
    if (res.status() === 200 && ((await res.json()) as S['TaskView']).images.length > 0) return mission.missionId;
  }
  return open[0]?.missionId ?? null;
}

/** Milliseconds from the click on the start button to prompt, every image (decoded) and every input rendered. */
async function timedStart(page: Page, missionId: string): Promise<number> {
  await page.goto('/');
  await page.locator(`a[href="/mission?missionId=${missionId}"]`).click();
  const start = page.getByRole('link', { name: new RegExp(`^(${m['child.mission.start']}|${m['child.mission.continue']})$`) });
  await expect(start).toBeVisible();
  await page.evaluate(() => {
    document.addEventListener('click', () => ((window as unknown as { t0: number }).t0 = performance.now()), { capture: true, once: true });
  });
  await start.click();
  const handle = await page.waitForFunction(
    () => {
      const screen = document.querySelector('[data-route="/task"]');
      const prompt = screen?.querySelector('.dk-prompt');
      const images = [...(screen?.querySelectorAll('img') ?? [])];
      const inputs = screen?.querySelectorAll('[data-part] input') ?? [];
      if (!prompt?.textContent?.trim() || inputs.length === 0 || images.some((img) => !img.complete || img.naturalWidth === 0)) return false;
      return performance.now() - (window as unknown as { t0: number }).t0;
    },
    undefined,
    { polling: 'raf', timeout: 10_000 },
  );
  return (await handle.jsonValue()) as number;
}

test('the task screen loads in under 1.5 s, 20 times from HQ via the start button, cold then warm (NFR-5)', async ({ page }) => {
  test.skip(!AGAINST_STACK, NO_STACK);
  test.setTimeout(180_000);
  const missionId = await startableMission(page.request);
  test.skip(!missionId, 'no published mission with a start button on this stack: seed the NFR-5 fixture content');
  const loads: number[] = [];
  for (let i = 0; i < 20; i++) loads.push(await timedStart(page, missionId as string));
  test.info().annotations.push({ type: 'NFR-5 task screen loads (ms)', description: loads.map((ms) => ms.toFixed(0)).join(', ') });
  expect(loads.filter((ms) => ms >= LOAD_BUDGET_MS), `loads over ${LOAD_BUDGET_MS} ms`).toEqual([]);
});

/** A readable answer that is very likely wrong, so a task without known answers is graded, not refused. */
function guess(part: S['PartView']): string | string[] {
  switch (part.type) {
    case 'CHOICE_SINGLE':
    case 'CHOICE_MULTI':
      return [part.options?.[0]?.key ?? 'A'];
    case 'FRACTION':
      return '987654/1';
    case 'NUMBER_WITH_UNIT':
      return `987654 ${part.unit ?? 'cm'}`;
    case 'TEXT':
      return 'zzzz';
    default:
      return '987654';
  }
}

test('the answer check round trip is under 300 ms at p95 over 200 graded submissions (NFR-5)', async ({ request }) => {
  test.skip(!AGAINST_STACK, NO_STACK);
  test.skip(process.env.E2E_PRACTICE_WRITES !== '1', 'writes attempts into the stack profile: set E2E_PRACTICE_WRITES=1 on a seeded test stack only');
  test.setTimeout(600_000);
  const hq = (await (await request.get('/api/child/hq')).json()) as S['HqView'];
  const missions = hq.topics.flatMap((t) => t.missions.map((mission) => mission.missionId));
  const known = new Map<string, Record<string, string | string[]>>();
  const times: number[] = [];
  let graded = 0;
  for (let round = 0; graded < 220 && round < 2000; round++) {
    const missionId = missions[round % missions.length];
    let res = await request.get(`/api/child/missions/${missionId}/current-task`);
    if (res.status() === 204) res = await request.post(`/api/child/missions/${missionId}/replay`);
    if (res.status() !== 200) continue;
    const task = (await res.json()) as S['TaskView'];
    const answers = known.get(task.taskId) ?? Object.fromEntries(task.parts.map((p) => [p.key, guess(p)]));
    const t0 = performance.now();
    const response = await request.post(`/api/child/missions/${missionId}/tasks/${task.taskId}/attempts`, { data: { answers } });
    const ms = performance.now() - t0;
    expect(response.status(), 'an attempt on a task with an attempt left is answered 200').toBe(200);
    const result = (await response.json()) as S['AttemptResult'];
    if (result.status !== 'GRADED') continue;
    graded += 1;
    if (graded > 20) times.push(ms);
    const revealed = result.feedback?.revealedAnswers;
    if (revealed) known.set(task.taskId, Object.fromEntries(revealed.map((r) => [r.key, r.answer])));
  }
  expect(times.length, 'at least 200 measured graded submissions (seed ≥ 10 tasks; replays give fresh runs)').toBeGreaterThanOrEqual(200);
  const sorted = [...times].sort((a, b) => a - b);
  const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1];
  test.info().annotations.push({ type: 'NFR-5 check round trip p95 (ms)', description: p95.toFixed(1) });
  expect(p95).toBeLessThan(CHECK_P95_BUDGET_MS);
});

test('frontend share of the load budget: 20 task loads from HQ via the start button against the contract stub, each under 1.5 s', async ({ page }) => {
  test.skip(AGAINST_STACK, 'against a stack the full NFR-5 measurement above runs instead');
  test.setTimeout(180_000);
  await childBackend(page);
  const loads: number[] = [];
  for (let i = 0; i < 20; i++) loads.push(await timedStart(page, PRACTICE.missionA));
  test.info().annotations.push({ type: 'frontend share of the task screen load (ms, contract stub)', description: loads.map((ms) => ms.toFixed(0)).join(', ') });
  expect(loads.filter((ms) => ms >= LOAD_BUDGET_MS), `loads over ${LOAD_BUDGET_MS} ms`).toEqual([]);
});
