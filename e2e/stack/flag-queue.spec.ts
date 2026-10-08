// @trace FR-30
// @trace FR-41
// @trace FR-55
// Real stack (Phase 5): the child reports a revealed task, the admin sees the report with the raw
// input and the checker's verdict in /admin/reports, re-evaluates (nothing changes), fixes the answer
// spec in the task editor, re-evaluates again and the missing XP (second try 5 − revealed 1 = +4)
// reaches the child's total. Self-authored content, unique per run.
import { format } from '../../src/i18n/format';
import { messages as m } from '../../src/i18n/messages';
import type { components } from '../../src/api/generated/schema';
import { adminApi, answer, expect, hq, publishedMission, settleRankUp, signedIn, taskUrl, test, unique } from './support';

type Report = components['schemas']['Report'];

test('report a revealed task, see it in the flag queue, fix the answer spec, re-evaluate: +4 XP and FIXED', async ({ page }) => {
  await signedIn(page);
  const prompt = unique('Kolik je 6 + 6? (e2e hlášení)');
  const { missionId, taskIds } = await publishedMission(page, [{ prompt, accepted: '12' }]);
  const taskId = taskIds[0];

  // FR-30: wrong twice (the second answer is the one the child defends), revealed, reported.
  await page.goto(taskUrl(missionId, taskId));
  await answer(page, '13');
  await expect(page.getByText(m['child.task.almost'])).toBeVisible();
  await answer(page, '14');
  await expect(page.getByText(m['child.task.revealed'])).toBeVisible();
  await page.getByRole('button', { name: m['child.report.open'] }).click();
  const dialog = page.getByRole('dialog', { name: m['child.report.title'] });
  await dialog.getByRole('radio', { name: m['child.report.reason.ANSWER_IS_CORRECT'] }).check();
  await dialog.getByRole('button', { name: m['child.report.send'] }).click();
  await expect(page.getByText(m['child.report.thanks'])).toBeVisible();

  const api = adminApi(page);
  const report = (await api.get<Report[]>('/api/admin/reports?status=OPEN')).find((r) => r.taskId === taskId);
  expect(report).toMatchObject({ reason: 'ANSWER_IS_CORRECT', status: 'OPEN', attempt: { attemptNo: 2, rawInput: { a: '14' }, verdicts: { a: 'WRONG' } } });

  // FR-41: the queue shows it with the raw input and the verdict.
  await page.goto('/admin/reports');
  const entry = page.locator(`[data-report="${report!.reportId}"]`);
  await expect(entry.getByRole('heading')).toContainText(prompt.slice(0, 20));
  await expect(entry.getByText(m['admin.reports.status.OPEN'], { exact: true })).toBeVisible();
  await expect(entry.getByText(m['admin.reports.reason.ANSWER_IS_CORRECT'])).toBeVisible();
  const cells = entry.getByRole('table').locator('tbody tr').first().getByRole('cell');
  await expect(cells).toHaveText(['a', '14', m['admin.reports.verdict.WRONG'], m['admin.reports.notReevaluated']]);

  // Under the unchanged spec, re-evaluation changes nothing and the report stays open.
  await entry.getByRole('button', { name: m['admin.reports.reevaluate'] }).click();
  await expect(page.getByText(/^Nothing changed for/)).toBeVisible();
  expect((await api.get<Report[]>('/api/admin/reports?status=OPEN')).some((r) => r.reportId === report!.reportId)).toBe(true);

  // FR-55: fix the answer spec from the report's link (14 becomes an accepted alternative).
  await entry.getByRole('link', { name: m['admin.reports.openTask'] }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/tasks/edit\\?taskId=${taskId}$`));
  await page.getByRole('button', { name: m['admin.editor.addAccepted'] }).click();
  await page.getByLabel(format(m['admin.editor.accepted'], { n: 2 })).fill('14');
  await page.getByRole('button', { name: m['admin.editor.save'] }).click();
  await expect(page.getByRole('status').filter({ hasText: m['admin.editor.updated'] })).toBeVisible();

  // Re-evaluate: second-try correct now, +4 XP for the child, the report FIXED.
  await settleRankUp(page);
  const before = await hq(page);
  await page.goto('/admin/reports');
  await entry.getByRole('button', { name: m['admin.reports.reevaluate'] }).click();
  await expect(page.getByText(/^Fixed: the attempt on .* is now correct\. \+4 XP added for the child\./)).toBeVisible();
  const fixed = (await api.get<Report[]>('/api/admin/reports?status=FIXED')).find((r) => r.reportId === report!.reportId);
  expect(fixed?.attempt?.reevaluation?.verdicts).toEqual({ a: 'CORRECT' });
  expect(fixed?.attempt?.verdicts).toEqual({ a: 'WRONG' });
  const after = await hq(page);
  expect(after.totalXp - before.totalXp).toBe(4);
  await page.reload();
  await expect(entry.getByText(m['admin.reports.status.FIXED'], { exact: true })).toBeVisible();
  await expect(entry.getByRole('button', { name: m['admin.reports.reevaluate'] })).toHaveCount(0);
});
