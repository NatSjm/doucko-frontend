// @trace FR-40
// Real stack (Phase 5): /admin/stats reflects a practice session. A fresh mission is practised (one
// hint, one revealed task); this week's row and the topic's first-try figures grow by exactly that,
// read from the backend and shown in the UI. Self-authored content, unique per run.
import { format } from '../../src/i18n/format';
import { messages as m } from '../../src/i18n/messages';
import { answer, expect, publishedMission, signedIn, stats, taskUrl, test, unique } from './support';

test('a practice session with one hint and one reveal shows up in this week of /admin/stats', async ({ page }) => {
  await signedIn(page);
  const { missionId, taskIds, topic } = await publishedMission(page, [
    { prompt: unique('Kolik je 2 + 2? (e2e statistika)'), accepted: '4', hints: [unique('Počítej na prstech.')] },
    { prompt: unique('Kolik je 5 + 5? (e2e statistika)'), accepted: '10' },
  ]);
  const before = await stats(page);
  const topicBefore = before.firstTryRateByTopic.find((t) => t.topicId === topic.topicId);

  await page.goto(taskUrl(missionId, taskIds[0]));
  await page.getByRole('button', { name: m['child.task.hint'] }).click();
  await answer(page, '4');
  await expect(page.getByText(m['child.task.correct'])).toBeVisible();
  await page.getByRole('link', { name: m['child.task.next'] }).click();
  await answer(page, '11');
  await expect(page.getByText(m['child.task.almost'])).toBeVisible();
  await answer(page, '12');
  await expect(page.getByText(m['child.task.revealed'])).toBeVisible();

  const after = await stats(page);
  const [weekBefore, weekAfter] = [before.weeks.at(-1)!, after.weeks.at(-1)!];
  expect(weekAfter.weekStart).toBe(weekBefore.weekStart);
  expect(weekAfter.hintsUsed).toBe(weekBefore.hintsUsed + 1);
  expect(weekAfter.revealed).toBe(weekBefore.revealed + 1);
  expect(weekAfter.sessions).toBeGreaterThanOrEqual(Math.max(1, weekBefore.sessions));
  const topicAfter = after.firstTryRateByTopic.find((t) => t.topicId === topic.topicId);
  expect(topicAfter?.resolved).toBe((topicBefore?.resolved ?? 0) + 2);
  expect(topicAfter?.firstTry).toBe((topicBefore?.firstTry ?? 0) + 1);

  // The screen shows the served figures: this week first (newest first), the topic's rate.
  await page.goto('/admin/stats');
  await expect(page.getByRole('heading', { level: 1, name: m['admin.stats.title'] })).toBeVisible();
  const weekly = page.getByRole('table', { name: m['admin.stats.weeklyCaption'] });
  const thisWeek = weekly.locator('tbody tr').first();
  await expect(thisWeek).toContainText(m['admin.stats.thisWeek']);
  const cells = thisWeek.getByRole('cell');
  await expect(cells.nth(1)).toHaveText(String(weekAfter.sessions));
  await expect(cells.nth(4)).toHaveText(String(weekAfter.hintsUsed));
  await expect(cells.nth(5)).toHaveText(String(weekAfter.revealed));
  const topicRow = page.getByRole('table', { name: m['admin.stats.topicsCaption'] }).getByRole('row', { name: new RegExp(topic.name) });
  await expect(topicRow).toContainText(format(m['admin.stats.resolved'], { firstTry: topicAfter!.firstTry, resolved: topicAfter!.resolved }));
});
