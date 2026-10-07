// @trace FR-40
// Store spec progress-stats: "Practice statistics page" (weekly figures, Success metric met / not
// met, Current week does not count, Less than 4 completed weeks of history, No data yet, First-try
// rate per topic, Topic with no resolved tasks), reached from the admin navigation.
import type { Page } from '@playwright/test';
import { format } from '../src/i18n/format';
import { messages as m } from '../src/i18n/messages';
import { signedInAdmin } from './fixtures/admin';
import { AGAINST_STACK, expect, test } from './fixtures/test';

test.skip(AGAINST_STACK, 'figures come from the fake admin backend; the stack smoke covers the real one');

const weekly = (page: Page) => page.getByRole('table', { name: m['admin.stats.weeklyCaption'] });
const weekRows = (page: Page) => weekly(page).locator('tbody tr');
const metric = (page: Page) => page.getByRole('region', { name: m['admin.stats.metricTitle'] });
const cells = (page: Page, i: number) => weekRows(page).nth(i).getByRole('cell').allTextContents();

test('the admin navigation leads to the stats page: weekly figures newest first, the metric not met and the short week marked', async ({ page }) => {
  await signedInAdmin(page);
  await page.goto('/admin');
  await page.getByRole('navigation', { name: m['admin.nav.label'] }).getByRole('link', { name: m['admin.nav.stats'], exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/stats$/);
  await expect(page.getByRole('heading', { level: 1, name: m['admin.stats.title'] })).toBeVisible();
  await expect(weekRows(page)).toHaveCount(5);
  // The current week first; it is not a metric week.
  expect(await cells(page, 0)).toEqual([`2026-10-05${m['admin.stats.thisWeek']}`, '1', '0', '4', '2', '0']);
  // Sessions of 12, 10 and 11 answered tasks, 7 hints used, 3 revealed tasks.
  expect(await cells(page, 1)).toEqual([`2026-09-28${m['admin.stats.metricWeek']}`, '3', '3', '12, 10, 11', '7', '3']);
  // 3 of the 4 completed weeks have 3 qualifying sessions, one has 2: not met, that week marked short.
  await expect(metric(page).getByText(m['admin.stats.metricNotMet'], { exact: true })).toBeVisible();
  await expect(metric(page).getByText(format(m['admin.stats.shortWeeks'], { weeks: '2026-09-14' }))).toBeVisible();
  const short = weekRows(page).filter({ hasText: m['admin.stats.short'] });
  await expect(short).toHaveCount(1);
  await expect(short.getByRole('cell').nth(0)).toContainText('2026-09-14');
  await expect(short.getByRole('cell').nth(2)).toHaveText(`2${m['admin.stats.short']}`);
});

test('first-try rate per topic: 75% for 6 of 8, — for a topic with nothing resolved', async ({ page }) => {
  await signedInAdmin(page);
  await page.goto('/admin/stats');
  const topics = page.getByRole('table', { name: m['admin.stats.topicsCaption'] });
  await expect(topics.getByRole('row', { name: /Desetinná čísla/ }).getByRole('cell')).toHaveText([
    'Desetinná čísla',
    format(m['admin.stats.rate'], { percent: 75 }),
    format(m['admin.stats.resolved'], { firstTry: 6, resolved: 8 }),
  ]);
  await expect(topics.getByRole('row', { name: /Obvod a obsah/ }).getByRole('cell')).toHaveText(['Obvod a obsah', m['admin.stats.noValue'], m['admin.stats.noneResolved']]);
});

test('the metric is met with 3 qualifying sessions in each completed week, though the current week has none', async ({ page }) => {
  const backend = await signedInAdmin(page);
  backend.progress.history[3] = { tasksPerSession: [10, 11, 12], hintsUsed: 0, revealed: 0 };
  backend.progress.history[0] = { tasksPerSession: [], hintsUsed: 0, revealed: 0 };
  await page.goto('/admin/stats');
  await expect(metric(page).getByText(m['admin.stats.metricMet'], { exact: true })).toBeVisible();
  await expect(weekRows(page).filter({ hasText: m['admin.stats.short'] })).toHaveCount(0);
  expect((await cells(page, 0)).slice(1)).toEqual(['0', '0', m['admin.stats.noValue'], '0', '0']);
});

test('keyboard: choose 12 weeks; the table shows 12 weeks and the metric does not change', async ({ page }) => {
  const backend = await signedInAdmin(page);
  const asked: string[] = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (url.pathname === '/api/admin/stats') asked.push(url.search);
  });
  await page.goto('/admin/stats');
  await expect(weekRows(page)).toHaveCount(5);
  const select = page.getByLabel(m['admin.stats.weeksShown']);
  await select.focus();
  await expect(select).toBeFocused();
  await select.selectOption('12');
  await expect(weekRows(page)).toHaveCount(12);
  await expect(weekRows(page).nth(11).getByRole('cell').first()).toHaveText('2026-07-20');
  await expect(metric(page).getByText(m['admin.stats.metricNotMet'], { exact: true })).toBeVisible();
  expect(asked).toEqual(['?weeks=5', '?weeks=12']);
  expect(backend.progress.history).toHaveLength(5);
});

test('with less than 4 completed weeks of history the metric is not met, and no error is shown', async ({ page }) => {
  const backend = await signedInAdmin(page);
  const five = { tasksPerSession: [10, 10, 10, 10, 10], hintsUsed: 0, revealed: 0 };
  backend.progress.history = [{ tasksPerSession: [], hintsUsed: 0, revealed: 0 }, five, five];
  await page.goto('/admin/stats');
  await expect(metric(page).getByText(m['admin.stats.metricNotMet'], { exact: true })).toBeVisible();
  await expect(metric(page).getByText(format(m['admin.stats.shortWeeks'], { weeks: '2026-09-07, 2026-09-14' }))).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('no practice yet: every week shows zeros, the metric is not met and the empty-state message is shown, no error (No data yet)', async ({ page }) => {
  await signedInAdmin(page, { seeded: false });
  await page.goto('/admin/stats');
  await expect(page.getByText(m['admin.stats.empty'])).toBeVisible();
  await expect(weekRows(page)).toHaveCount(5);
  for (let i = 0; i < 5; i++) expect((await cells(page, i)).slice(1)).toEqual(['0', '0', m['admin.stats.noValue'], '0', '0']);
  await expect(metric(page).getByText(m['admin.stats.metricNotMet'], { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
