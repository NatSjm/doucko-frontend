// @trace FR-36
// @trace FR-37
// @trace FR-38
import type { Page } from '@playwright/test';
import { messages as m } from '../src/i18n/messages';
import { format } from '../src/i18n/format';
import { createFakeBackend, creditOutsideSession, PLACEHOLDER_LADDER, PRACTICE, practise } from '../src/test/fake-child-backend';
import { childBackend } from './fixtures/child';
import { AGAINST_STACK, expect, test } from './fixtures/test';

// HQ progress and the rank-up celebration, against the child contract stub (gamification "Progress
// on HQ", "Rank-up celebration", "No negative mechanics"). The real backend is replayed in the
// slice 8 real-stack smoke after the merge.
test.skip(AGAINST_STACK, 'answers come from the child contract stub; the stack smoke covers the real backend');
test.beforeEach(({ browserName }) => test.slow(browserName === 'firefox'));

const [rank1, rank2, rank3, , rank5] = PLACEHOLDER_LADDER.map((r) => r.name);
const panel = (page: Page) => page.getByRole('region', { name: m['child.hq.progressTitle'] });
const bar = (page: Page) => panel(page).getByRole('progressbar', { name: m['child.hq.xpBar'] });
const celebration = (page: Page) => page.getByRole('status').filter({ hasText: m['child.rankUp.kicker'] });

async function hqAt(page: Page, totalXp: number) {
  const backend = createFakeBackend();
  backend.practice.totalXp = totalXp;
  await childBackend(page, backend);
  await page.goto('/');
  await expect(panel(page)).toBeVisible();
  return backend;
}

test('a fresh profile: the 1st rank, an empty bar at 0 of 150 XP and 0 solved tasks (FR-37)', async ({ page }) => {
  await hqAt(page, 0);
  await expect(panel(page)).toContainText(rank1);
  await expect(bar(page)).toHaveAttribute('aria-valuenow', '0');
  await expect(bar(page)).toHaveAttribute('aria-valuemax', '150');
  await expect(panel(page)).toContainText(format(m['child.hq.xpToNext'], { have: 0, need: 150, rank: rank2 }));
  await expect(panel(page)).toContainText(format(m['child.hq.solved'], { n: 0 }));
});

test('275 XP: the 2nd rank and the bar at 125 of 250 XP towards the 3rd rank (FR-37)', async ({ page }) => {
  await hqAt(page, 275);
  await expect(panel(page)).toContainText(rank2);
  await expect(bar(page)).toHaveAttribute('aria-valuenow', '125');
  await expect(bar(page)).toHaveAttribute('aria-valuemax', '250');
  await expect(panel(page)).toContainText(format(m['child.hq.xpToNext'], { have: 125, need: 250, rank: rank3 }));
  // The bar is drawn half full.
  const fill = await panel(page).locator('.dk-xp-fill').evaluate((el) => el.getBoundingClientRect().width / (el.parentElement as HTMLElement).getBoundingClientRect().width);
  expect(fill).toBeGreaterThan(0.4);
  expect(fill).toBeLessThan(0.6);
});

test('the top rank: a full bar marked as the highest rank, no next target (FR-37)', async ({ page }) => {
  await hqAt(page, 1600);
  await expect(panel(page)).toContainText(rank5);
  await expect(panel(page)).toContainText(m['child.hq.topRank']);
  await expect(panel(page)).not.toContainText('do hodnosti');
  await expect(bar(page)).toHaveAttribute('aria-valuetext', m['child.hq.topRank']);
});

test('solved tasks are what the server counts, after practice (FR-37)', async ({ page }) => {
  const backend = createFakeBackend();
  await practise(backend, PRACTICE.missionA, PRACTICE.taskSum, { a: '0,75' });
  await practise(backend, PRACTICE.missionB, PRACTICE.taskThousands, { a: '1250' });
  await childBackend(page, backend);
  await page.goto('/');
  await expect(panel(page)).toContainText(format(m['child.hq.solved'], { n: 2 }));
  await expect(panel(page)).toContainText(format(m['child.hq.xpTotal'], { xp: 20 }));
});

test('a rank-up credited outside a session plays once on HQ and never after a reload (FR-36)', async ({ page }) => {
  const backend = createFakeBackend();
  backend.practice.totalXp = 140;
  creditOutsideSession(backend, 20);
  await childBackend(page, backend);
  await page.goto('/');
  await expect(celebration(page)).toContainText(format(m['child.rankUp.text'], { rank: rank2 }));
  await expect.poll(() => backend.practice.acks).toEqual([1]);
  await page.getByRole('button', { name: m['child.rankUp.close'] }).click();
  await expect(celebration(page)).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await page.reload();
  await expect(panel(page)).toContainText(rank2);
  await expect(page.getByText(m['child.rankUp.kicker'])).toHaveCount(0);
  expect(backend.practice.acks).toEqual([1]);
});

test('the celebration animates, and runs no animation under reduced motion with the same text and medal (FR-36, NFR-13)', async ({ browser }) => {
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    const context = await browser.newContext({ reducedMotion });
    const page = await context.newPage();
    const backend = createFakeBackend();
    backend.practice.totalXp = 140;
    creditOutsideSession(backend, 20);
    await childBackend(page, backend);
    await page.goto('/');
    await expect(celebration(page)).toContainText(format(m['child.rankUp.text'], { rank: rank2 }));
    await expect(celebration(page).locator('svg.dk-rank-medal')).toBeVisible();
    // The celebration's own animations, running or already played (they keep their end state).
    const animations = await page.evaluate(
      () => document.getAnimations().filter((a) => (a.effect as KeyframeEffect | null)?.target?.closest('[role="status"]') && Number(a.effect?.getComputedTiming().duration ?? 0) > 1).length,
    );
    if (reducedMotion === 'reduce') expect(animations).toBe(0);
    else expect(animations).toBeGreaterThan(0);
    await context.close();
  }
});

test('a task award that crosses a threshold mid-mission celebrates on the feedback, once (FR-36)', async ({ page }) => {
  const backend = createFakeBackend();
  backend.practice.totalXp = 145;
  await childBackend(page, backend);
  await page.goto(`/task?missionId=${PRACTICE.missionA}&taskId=${PRACTICE.taskSum}`);
  await page.getByRole('textbox', { name: 'a' }).fill('0,75');
  await page.keyboard.press('Enter');
  await expect(celebration(page)).toContainText(rank2);
  await expect(page.getByText(format(m['child.task.xp'], { xp: 10 }))).toBeVisible();
  await page.reload();
  await expect(page.getByText(m['child.task.correct'])).toBeVisible();
  await expect(page.getByText(m['child.rankUp.kicker'])).toHaveCount(0);
});

test('wrong answers cost nothing and a reveal still shows "+1 XP"; no minus sign anywhere (FR-38)', async ({ page }) => {
  const backend = createFakeBackend();
  backend.practice.totalXp = 50;
  await childBackend(page, backend);
  await page.goto(`/task?missionId=${PRACTICE.missionA}&taskId=${PRACTICE.taskSum}`);
  const input = page.getByRole('textbox', { name: 'a' });
  await input.fill('0,7');
  await page.keyboard.press('Enter');
  await expect(page.getByText(m['child.task.almost'])).toBeVisible();
  await expect(page.locator('main')).not.toContainText('XP');
  expect(backend.practice.totalXp).toBe(50);
  await input.fill('0,6');
  await page.keyboard.press('Enter');
  await expect(page.getByText(m['child.task.revealed'])).toBeVisible();
  await expect(page.getByText(format(m['child.task.xp'], { xp: 1 }))).toBeVisible();
  await expect(page.locator('main')).not.toContainText(/[-−]\s*\d+\s*XP/);
  await page.goto('/');
  await expect(panel(page)).toContainText(format(m['child.hq.xpTotal'], { xp: 51 }));
});
