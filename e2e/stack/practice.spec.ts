// @trace FR-26
// @trace FR-27
// @trace FR-28
// @trace FR-32
// @trace FR-37
// Real stack (Phase 5): the child's practice flow against the backend's checker and XP ledger. A
// fresh three-task mission (authored through the admin API, unique per run): correct first try,
// wrong then revealed, a hint then correct; XP, HQ and the mission summary come back from Postgres.
import { format } from '../../src/i18n/format';
import { messages as m } from '../../src/i18n/messages';
import type { components } from '../../src/api/generated/schema';
import { answer, expect, hq, publishedMission, settleRankUp, signedIn, taskUrl, test, unique } from './support';

type AttemptResult = components['schemas']['AttemptResult'];
const attempts = (used: number) => format(m['child.task.attempts'], { used, total: 2 });

test('correct, wrong-then-reveal and hint-then-correct: verdicts, XP per the ladder, HQ totals and the summary', async ({ page }) => {
  await signedIn(page);
  const hint = unique('Sečti nejdřív desítky.');
  const prompts = [unique('Kolik je 3 + 4? (e2e)'), unique('Kolik je 9 − 2? (e2e)'), unique('Kolik je 20 + 13? (e2e)')];
  const { missionId, taskIds } = await publishedMission(page, [
    { prompt: prompts[0], accepted: '7' },
    { prompt: prompts[1], accepted: '7' },
    { prompt: prompts[2], accepted: '33', hints: [hint] },
  ]);
  await settleRankUp(page);
  const before = await hq(page);
  const results: AttemptResult[] = [];
  page.on('response', async (r) => {
    if (r.request().method() === 'POST' && r.url().endsWith('/attempts')) results.push((await r.json()) as AttemptResult);
  });

  // Task 1: correct on the first attempt (+10).
  await page.goto(taskUrl(missionId, taskIds[0]));
  await expect(page.getByText(prompts[0])).toBeVisible();
  await expect(page.getByText(attempts(0))).toBeVisible();
  await answer(page, '7');
  await expect(page.getByText(m['child.task.correct'])).toBeVisible();
  await expect(page.getByText(format(m['child.task.xp'], { xp: 10 }), { exact: true })).toBeVisible();

  // Task 2: wrong twice, then revealed neutrally (+1, effort counts).
  await page.getByRole('link', { name: m['child.task.next'] }).click();
  await expect(page.getByText(prompts[1])).toBeVisible();
  await answer(page, '8');
  await expect(page.getByText(m['child.task.almost'])).toBeVisible();
  await expect(page.getByText(attempts(1))).toBeVisible();
  await answer(page, '6');
  await expect(page.getByText(m['child.task.revealed'])).toBeVisible();
  await expect(page.locator('[data-part="a"]')).toContainText('7');
  await expect(page.getByText(format(m['child.task.xp'], { xp: 1 }), { exact: true })).toBeVisible();

  // Task 3: open the hint, then correct first try (10 − 2 = +8) and the mission completes.
  await page.getByRole('link', { name: m['child.task.next'] }).click();
  await expect(page.getByText(prompts[2])).toBeVisible();
  await page.getByRole('button', { name: m['child.task.hint'] }).click();
  await expect(page.getByText(hint)).toBeVisible();
  await answer(page, '33');
  await expect(page.getByText(m['child.task.correct'])).toBeVisible();
  await expect(page.getByText(format(m['child.task.xp'], { xp: 8 }), { exact: true })).toBeVisible();

  await expect.poll(() => results.length).toBe(4);
  expect(results.map((r) => [r.taskState, r.xpAwarded])).toEqual([
    ['CORRECT_FIRST_TRY', 10],
    ['UNRESOLVED', 0],
    ['REVEALED', 1],
    ['CORRECT_FIRST_TRY', 8],
  ]);
  // FR-27: after the first wrong attempt the answer key is not sent, only after the reveal.
  expect(results[1].parts[0].verdict).toBe('WRONG');
  expect(results[1].feedback?.revealedAnswers ?? null).toBeNull();
  expect(results[2].feedback?.revealedAnswers).toEqual([{ key: 'a', answer: '7' }]);
  expect(results[3].missionComplete).toBe(true);
  const bonus = results[3].bonusXp;
  expect(bonus).toBeGreaterThan(0); // completion bonus (configurable, so not pinned here)

  // FR-32: the mission-complete screen.
  await page.locator('a[data-next]').click();
  await expect(page).toHaveURL(new RegExp(`/summary\\?missionId=${missionId}`));
  const summary = page.locator('[data-route="/summary"]');
  await expect(summary.getByRole('heading', { level: 1, name: m['child.summary.title'] })).toBeVisible();
  await expect(summary).toContainText(format(m['child.summary.xp'], { xp: 19 + bonus }));
  await expect(summary).toContainText(format(m['child.summary.firstTry'], { n: 2 }));
  await expect(summary).toContainText(format(m['child.summary.taskCount'], { n: 3 }));

  // FR-37: totals on HQ from the server.
  const after = await hq(page);
  expect(after.totalXp - before.totalXp).toBe(19 + bonus);
  expect(after.solvedTasks).toBe(before.solvedTasks + 3);
  await settleRankUp(page);
  await page.goto('/');
  await expect(page.getByRole('region', { name: m['child.hq.progressTitle'] })).toContainText(format(m['child.hq.solved'], { n: after.solvedTasks }));
});
