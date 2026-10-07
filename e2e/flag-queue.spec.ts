// @trace FR-41
// Store spec progress-stats: "Flag queue" (Report appears in the queue, Report without an attempt,
// Long raw input is shown in full, Queue order, Filter by status, open the task to fix its answer
// spec), "Re-evaluation of a reported attempt" (awards the missing XP, unchanged spec changes
// nothing, replay attempt awards nothing), "Attempt log is append-only" (both verdicts with their
// times), "Dismissing a report". Reached from the admin navigation.
import type { Page } from '@playwright/test';
import { format } from '../src/i18n/format';
import { messages as m } from '../src/i18n/messages';
import { SEED } from '../src/test/fake-admin-backend';
import { LONG_RAW, NOTES, REPORTS } from '../src/test/fake-progress-backend';
import { signedInAdmin } from './fixtures/admin';
import { AGAINST_STACK, expect, test } from './fixtures/test';

test.skip(AGAINST_STACK, 'reports come from the fake admin backend; the stack smoke covers the real one');

const DECIMAL = 'Zapiš jednu polovinu jako desetinné číslo.';
const CHOICE = 'Které číslo je větší než 4?';
const PERIMETER = 'Vypočítej obvod obdélníku se stranami 3 cm a 4 cm.';

const list = (page: Page) => page.getByRole('list', { name: m['admin.reports.list'] });
const entry = (page: Page, reportId: string) => page.locator(`[data-report="${reportId}"]`);
const parts = (page: Page, reportId: string) => entry(page, reportId).getByRole('table').locator('tbody tr').first().getByRole('cell');

test('the admin navigation leads to the flag queue: open reports first, each with the task, reason, raw input and verdict', async ({ page }) => {
  await signedInAdmin(page);
  await page.goto('/admin');
  await page.getByRole('navigation', { name: m['admin.nav.label'] }).getByRole('link', { name: m['admin.nav.reports'], exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/reports$/);
  await expect(page.getByRole('heading', { level: 1, name: m['admin.reports.title'] })).toBeVisible();
  // Queue order: open reports oldest first (Mon, Tue, Wed), then the handled ones.
  await expect(list(page).getByRole('article').getByRole('heading')).toHaveText([DECIMAL, PERIMETER, CHOICE, PERIMETER, CHOICE]);
  const first = entry(page, REPORTS.openRevealed);
  await expect(first.getByText(m['admin.reports.status.OPEN'], { exact: true })).toBeVisible();
  await expect(first.getByText(m['admin.reports.reason.ANSWER_IS_CORRECT'])).toBeVisible();
  await expect(first.getByText(NOTES.half)).toBeVisible();
  await expect(parts(page, REPORTS.openRevealed)).toHaveText(['a', '0,5', m['admin.reports.verdict.WRONG'], m['admin.reports.notReevaluated']]);
  await expect(first.getByRole('button', { name: m['admin.reports.reevaluate'] })).toBeVisible();
  await expect(first.getByRole('button', { name: m['admin.reports.dismiss'] })).toBeVisible();
  // Report without an attempt: dismiss, no re-evaluate.
  const noAttempt = entry(page, REPORTS.openNoAttempt);
  await expect(noAttempt.getByText(m['admin.reports.noAttempt'])).toBeVisible();
  await expect(noAttempt.getByRole('button', { name: m['admin.reports.reevaluate'] })).toHaveCount(0);
  await expect(noAttempt.getByRole('button', { name: m['admin.reports.dismiss'] })).toBeVisible();
});

test('fix the answer spec from the report, then re-evaluate: nothing changes first, then +4 XP and the report is fixed with both verdicts', async ({ page }) => {
  const backend = await signedInAdmin(page);
  // The answer key wrongly expects 0.05; the child's attempt 2 was 0,5 (Re-evaluation awards the missing XP).
  const task = backend.tasks.find((t) => t.taskId === SEED.taskDecimal);
  if (task) task.input.parts[0].spec.accepted = ['0.05'];
  await page.goto('/admin/reports');
  await entry(page, REPORTS.openRevealed).getByRole('button', { name: m['admin.reports.reevaluate'] }).click();
  await expect(page.getByRole('status')).toHaveText(format(m['admin.reports.unchanged'], { task: DECIMAL }));
  await expect(page.getByRole('status')).toBeFocused();
  await expect(entry(page, REPORTS.openRevealed).getByText(m['admin.reports.status.OPEN'], { exact: true })).toBeVisible();
  expect(backend.progress.awards).toEqual([]);

  // Open the task from the report and correct the accepted answer.
  await entry(page, REPORTS.openRevealed).getByRole('link', { name: m['admin.reports.openTask'] }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/tasks/edit\\?taskId=${SEED.taskDecimal}$`));
  const accepted = page.getByLabel(format(m['admin.editor.accepted'], { n: 1 }), { exact: true });
  await expect(accepted).toHaveValue('0.05');
  await accepted.fill('0.5');
  await page.getByRole('button', { name: m['admin.editor.save'] }).click();
  await expect(page.getByText(m['admin.editor.updated'])).toBeVisible();

  // Back to the queue by the navigation; re-evaluate again.
  await page.getByRole('navigation', { name: m['admin.nav.label'] }).getByRole('link', { name: m['admin.nav.reports'], exact: true }).click();
  await entry(page, REPORTS.openRevealed).getByRole('button', { name: m['admin.reports.reevaluate'] }).click();
  await expect(page.getByRole('status')).toHaveText(format(m['admin.reports.fixedXp'], { task: DECIMAL, xp: 4 }));
  await expect(page.getByRole('status')).toBeFocused();
  expect(backend.progress.awards).toEqual([{ reportId: REPORTS.openRevealed, xp: 4, bonus: 0 }]);
  await expect(entry(page, REPORTS.openRevealed).getByText(m['admin.reports.status.FIXED'], { exact: true })).toBeVisible();
  await expect(entry(page, REPORTS.openRevealed).getByRole('button')).toHaveCount(0);

  // Filter by Fixed: both verdicts, each with its own time.
  await page.getByLabel(m['admin.reports.filter']).selectOption('FIXED');
  await expect(list(page).getByRole('article')).toHaveCount(2);
  await expect(parts(page, REPORTS.openRevealed)).toHaveText([
    'a',
    '0,5',
    m['admin.reports.verdict.WRONG'],
    `${m['admin.reports.verdict.CORRECT']}${format(m['admin.reports.reevaluatedAt'], { time: '2026-10-07 18:00' })}`,
  ]);
  await expect(entry(page, REPORTS.openRevealed).getByText(format(m['admin.reports.submitted'], { time: '2026-10-05 16:18' }))).toBeVisible();
});

test('a replay attempt is fixed without XP (Re-evaluating a replay attempt awards nothing)', async ({ page }) => {
  const backend = await signedInAdmin(page);
  await page.goto('/admin/reports');
  const replay = entry(page, REPORTS.openReplay);
  await expect(replay.getByText(m['admin.reports.replay'], { exact: true })).toBeVisible();
  await replay.getByRole('button', { name: m['admin.reports.reevaluate'] }).click();
  await expect(page.getByRole('status')).toHaveText(format(m['admin.reports.fixedReplay'], { task: PERIMETER }));
  await expect(replay.getByText(m['admin.reports.status.FIXED'], { exact: true })).toBeVisible();
  expect(backend.progress.awards).toEqual([]);
});

test('keyboard: dismiss a report without an attempt; the outcome is announced and focused', async ({ page }) => {
  const backend = await signedInAdmin(page);
  await page.goto('/admin/reports');
  const dismiss = entry(page, REPORTS.openNoAttempt).getByRole('button', { name: m['admin.reports.dismiss'] });
  await dismiss.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText(format(m['admin.reports.dismissed'], { task: CHOICE }));
  await expect(page.getByRole('status')).toBeFocused();
  await expect(entry(page, REPORTS.openNoAttempt).getByText(m['admin.reports.status.DISMISSED'], { exact: true })).toBeVisible();
  await expect(entry(page, REPORTS.openNoAttempt).getByRole('button')).toHaveCount(0);
  expect(backend.progress.reports.find((r) => r.report.reportId === REPORTS.openNoAttempt)?.report.status).toBe('DISMISSED');
});

test('a 100-code-point raw input is shown in full, wrapped within its entry, with no horizontal page scroll', async ({ page }) => {
  await signedInAdmin(page);
  await page.goto('/admin/reports');
  const long = entry(page, REPORTS.dismissedLong);
  const raw = long.getByText(LONG_RAW, { exact: true });
  await expect(raw).toBeVisible();
  expect(await raw.textContent()).toBe(LONG_RAW);
  expect(await raw.evaluate((el) => getComputedStyle(el).textOverflow)).not.toBe('ellipsis');
  const [rawBox, entryBox] = [await raw.boundingBox(), await long.boundingBox()];
  expect(rawBox && entryBox && rawBox.x + rawBox.width <= entryBox.x + entryBox.width + 0.5).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  // The text wraps: the cell is taller than one line of it.
  expect(await raw.evaluate((el) => el.getClientRects().length > 1 || el.scrollWidth <= el.clientWidth)).toBe(true);
});

test('filter by status lists only that status; All lists every report again', async ({ page }) => {
  await signedInAdmin(page);
  await page.goto('/admin/reports');
  const filter = page.getByLabel(m['admin.reports.filter']);
  await filter.selectOption('DISMISSED');
  await expect(list(page).getByRole('article')).toHaveCount(1);
  await expect(entry(page, REPORTS.dismissedLong)).toBeVisible();
  await filter.selectOption('OPEN');
  await expect(list(page).getByRole('article')).toHaveCount(3);
  await filter.selectOption('');
  await expect(list(page).getByRole('article')).toHaveCount(5);
});
