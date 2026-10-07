// @trace FR-32
// @trace FR-33
// @trace FR-36
import type { Page } from '@playwright/test';
import { messages as m } from '../src/i18n/messages';
import { format } from '../src/i18n/format';
import { childRequest, completeMission, createFakeBackend, PLACEHOLDER_LADDER, PRACTICE, PROMPTS, practise } from '../src/test/fake-child-backend';
import { childBackend } from './fixtures/child';
import { AGAINST_STACK, expect, test } from './fixtures/test';

// The mission-complete screen and replay, against the child contract stub (practice-flow "Mission
// complete screen", "Replay completed missions"; gamification "Rank-up celebration"). The real
// backend is replayed in the slice 8 real-stack smoke after the merge.
test.skip(AGAINST_STACK, 'answers come from the child contract stub; the stack smoke covers the real backend');
test.beforeEach(({ browserName }) => test.slow(browserName === 'firefox'));

const rank2 = PLACEHOLDER_LADDER[1].name;
const celebration = (page: Page) => page.getByRole('status').filter({ hasText: m['child.rankUp.kicker'] });

/** Types into the focused part and presses Enter (the keyboard path of the task screen). */
async function answer(page: Page, text: string) {
  await expect(page.getByRole('button', { name: m['child.task.submit'] })).toBeVisible();
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

test('the last task leads to "Mise je splněná!" with the XP earned and the first-try count (FR-32)', async ({ page }) => {
  const backend = createFakeBackend();
  // Task 1 resolved right first time earlier in this run; task 2 on its 2nd attempt now.
  await practise(backend, PRACTICE.missionB, PRACTICE.taskThousands, { a: '1250' });
  await childBackend(page, backend);
  await page.goto(`/mission?missionId=${PRACTICE.missionB}`);
  await page.getByRole('link', { name: m['child.mission.continue'] }).click();
  await expect(page.getByText(PROMPTS.multi)).toBeVisible();
  await page.getByText('0,9').click();
  await page.keyboard.press('Enter');
  await expect(page.getByText(m['child.task.almost'])).toBeVisible();
  await page.getByText('0,9').click();
  await page.getByText('1,5').click();
  await page.getByText('2', { exact: true }).click();
  await page.keyboard.press('Enter');
  await expect(page.getByText(format(m['child.task.bonus'], { xp: 20 }))).toBeVisible();
  const results = page.getByRole('link', { name: m['child.mission.results'] });
  await expect(results).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: m['child.summary.title'] })).toBeVisible();
  // 10 (first try) + 5 (second try) + 20 bonus.
  await expect(page.getByText(format(m['child.summary.xp'], { xp: 35 }))).toBeVisible();
  await expect(page.getByText(format(m['child.summary.firstTry'], { n: 1 }))).toBeVisible();
  await expect(page.getByText(format(m['child.summary.taskCount'], { n: 2 }))).toBeVisible();
  await expect(page.getByText(m['child.rankUp.kicker'])).toHaveCount(0);
});

test('a revealed last task still completes the mission (FR-32)', async ({ page }) => {
  await childBackend(page);
  await page.goto(`/task?missionId=${PRACTICE.missionPerimeter}&taskId=${PRACTICE.taskSquare}`);
  await answer(page, '6 cm');
  await expect(page.getByText(m['child.task.almost'])).toBeVisible();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('7 cm');
  await page.keyboard.press('Enter');
  await expect(page.getByText(m['child.task.revealed'])).toBeVisible();
  await page.getByRole('link', { name: m['child.mission.results'] }).click();
  await expect(page.getByRole('heading', { level: 1, name: m['child.summary.title'] })).toBeVisible();
  await expect(page.getByText(format(m['child.summary.xp'], { xp: 21 }))).toBeVisible();
});

test('a rank-up by the completing answer plays on the summary, once, and not on HQ afterwards (FR-36)', async ({ page }) => {
  const backend = createFakeBackend();
  backend.practice.totalXp = 140;
  await childBackend(page, backend);
  await page.goto(`/task?missionId=${PRACTICE.missionPerimeter}&taskId=${PRACTICE.taskSquare}`);
  await answer(page, '8 cm');
  await expect(page.getByText(m['child.rankUp.kicker'])).toHaveCount(0);
  await page.getByRole('link', { name: m['child.mission.results'] }).click();
  await expect(celebration(page)).toContainText(format(m['child.rankUp.text'], { rank: rank2 }));
  await expect.poll(() => backend.practice.acks).toEqual([1]);
  await page.reload();
  await expect(page.getByText(format(m['child.summary.rankReached'], { rank: rank2 }))).toBeVisible();
  await expect(page.getByText(m['child.rankUp.kicker'])).toHaveCount(0);
  await page.goto('/');
  await expect(page.getByRole('region', { name: m['child.hq.progressTitle'] })).toContainText(rank2);
  await expect(page.getByText(m['child.rankUp.kicker'])).toHaveCount(0);
});

test('a completing rank-up whose summary was never shown plays on HQ; the summary then lists it statically (FR-36)', async ({ page }) => {
  const backend = createFakeBackend();
  backend.practice.totalXp = 140;
  // The browser closed before the mission-complete screen was shown.
  await completeMission(backend, PRACTICE.missionPerimeter);
  await childBackend(page, backend);
  await page.goto('/');
  await expect(celebration(page)).toContainText(rank2);
  await expect.poll(() => backend.practice.acks).toEqual([1]);
  await page.goto(`/summary?missionId=${PRACTICE.missionPerimeter}`);
  await expect(page.getByText(format(m['child.summary.rankReached'], { rank: rank2 }))).toBeVisible();
  await expect(page.getByText(m['child.rankUp.kicker'])).toHaveCount(0);
});

test('replay: starts fresh from the briefing, earns no XP, and HQ keeps the mission complete (FR-33)', async ({ page }) => {
  const backend = createFakeBackend();
  await completeMission(backend, PRACTICE.missionPerimeter);
  const total = backend.practice.totalXp;
  await childBackend(page, backend);
  await page.goto(`/mission?missionId=${PRACTICE.missionPerimeter}`);
  await page.getByRole('button', { name: m['child.mission.replay'] }).click();
  await expect(page.getByText(PROMPTS.square)).toBeVisible();
  await expect(page.getByText(format(m['child.task.attempts'], { used: 0, total: 2 }))).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'a' })).toHaveValue('');
  await answer(page, '8 cm');
  await expect(page.getByText(m['child.task.correct'])).toBeVisible();
  await expect(page.locator('main')).not.toContainText('XP');
  await page.getByRole('link', { name: m['child.mission.results'] }).click();
  await expect(page.getByRole('heading', { level: 1, name: m['child.summary.replayTitle'] })).toBeVisible();
  await expect(page.getByText(format(m['child.summary.replayText'], { xp: 0 }))).toBeVisible();
  expect(backend.practice.totalXp).toBe(total);
  expect(backend.practice.replayAttempts).toHaveLength(1);
  await page.getByRole('link', { name: m['child.common.backToHq'] }).click();
  const card = page.getByRole('region', { name: format(m['child.hq.topic'], { name: 'Obvod a obsah' }) }).getByRole('link');
  await expect(card).toContainText(m['child.hq.state.COMPLETE']);
  await expect(page.getByRole('link', { name: m['child.hq.continue'] })).toHaveCount(0);
});

test('an unfinished replay resumes from the briefing; HQ offers no "Pokračovat" to it (FR-33)', async ({ page }) => {
  const backend = createFakeBackend();
  await completeMission(backend, PRACTICE.missionB);
  await childRequest(backend, 'POST', `/api/child/missions/${PRACTICE.missionB}/replay`);
  await practise(backend, PRACTICE.missionB, PRACTICE.taskThousands, { a: '1250' });
  await childBackend(page, backend);
  await page.goto('/');
  await expect(page.getByRole('link', { name: m['child.hq.continue'] })).toHaveCount(0);
  await page.getByRole('link', { name: new RegExp(format(m['child.hq.mission'], { n: 2 })) }).click();
  await page.getByRole('button', { name: m['child.mission.replay'] }).click();
  await expect(page.getByText(PROMPTS.multi)).toBeVisible();
  expect(new URL(page.url()).searchParams.get('taskId')).toBe(PRACTICE.taskMulti);
});
