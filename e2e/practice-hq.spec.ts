// @trace FR-24
// @trace FR-25
// @trace NFR-7
import { messages as m } from '../src/i18n/messages';
import { format } from '../src/i18n/format';
import { createFakeBackend, PRACTICE, PROMPTS, practise } from '../src/test/fake-child-backend';
import { childBackend } from './fixtures/child';
import { FICTIONAL_DISPLAY_NAME } from './fixtures/profile';
import { AGAINST_STACK, expect, test } from './fixtures/test';

// HQ, the mission list and the 2-click start, against the child contract stub (practice-flow "HQ
// without login", "Mission list on HQ", "Start or continue within two clicks"). The real backend is
// replayed in the slice 7 real-stack smoke (task 4.4).
test.skip(AGAINST_STACK, 'answers come from the child contract stub; the stack smoke covers the real backend');
// Firefox under a loaded machine is slow to start and close contexts: triple the time, never the assertions.
test.beforeEach(({ browserName }) => test.slow(browserName === 'firefox'));

const topic = (name: string) => format(m['child.hq.topic'], { name });
const progress = (resolved: number, total: number) => format(m['child.hq.progress'], { resolved, total });

test('a fresh browser lands on HQ directly: no login form, no profile picker (FR-24)', async ({ page, context }) => {
  expect(await context.cookies()).toEqual([]);
  await childBackend(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: format(m['child.hq.greeting'], { name: FICTIONAL_DISPLAY_NAME }) })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(page.getByRole('combobox')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});

test('missions are grouped by topic, ordered by position, with x/N vyřešeno and their state (FR-25)', async ({ page }) => {
  const backend = createFakeBackend();
  // In progress: one task of mission A resolved. Complete: the only task of the perimeter mission revealed.
  await practise(backend, PRACTICE.missionA, PRACTICE.taskSum, { a: '0,75' });
  await practise(backend, PRACTICE.missionPerimeter, PRACTICE.taskSquare, { a: '6 cm' });
  await practise(backend, PRACTICE.missionPerimeter, PRACTICE.taskSquare, { a: '7 cm' });
  await childBackend(page, backend);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText([topic('Desetinná čísla'), topic('Obvod a obsah')]);
  const decimals = page.getByRole('region', { name: topic('Desetinná čísla') }).getByRole('link');
  await expect(decimals).toHaveCount(2);
  await expect(decimals.nth(0)).toContainText(format(m['child.hq.mission'], { n: 1 }));
  await expect(decimals.nth(0)).toContainText(progress(1, 3));
  await expect(decimals.nth(0)).toContainText(m['child.hq.state.IN_PROGRESS']);
  await expect(decimals.nth(1)).toContainText(format(m['child.hq.mission'], { n: 2 }));
  await expect(decimals.nth(1)).toContainText(progress(0, 2));
  await expect(decimals.nth(1)).toContainText(m['child.hq.state.NEW']);
  const perimeter = page.getByRole('region', { name: topic('Obvod a obsah') }).getByRole('link');
  await expect(perimeter).toHaveCount(1);
  await expect(perimeter).toContainText(progress(1, 1));
  await expect(perimeter).toContainText(m['child.hq.state.COMPLETE']);
});

test('an attempted but unresolved task leaves the mission at 0/N, in progress (FR-25)', async ({ page }) => {
  const backend = createFakeBackend();
  await practise(backend, PRACTICE.missionB, PRACTICE.taskThousands, { a: '1200' });
  await childBackend(page, backend);
  await page.goto('/');
  const card = page.getByRole('region', { name: topic('Desetinná čísla') }).getByRole('link').nth(1);
  await expect(card).toContainText(progress(0, 2));
  await expect(card).toContainText(m['child.hq.state.IN_PROGRESS']);
});

// FR-12's child-facing scenario carried over from slice 6 (owned by the backend): HQ lists only
// served missions. The perimeter topic holds a published and a draft mission with a published task.
test('a draft mission is not listed on HQ, only the published one (FR-25 "Unpublished content is invisible")', async ({ page }) => {
  await childBackend(page);
  await page.goto('/');
  const perimeter = page.getByRole('region', { name: topic('Obvod a obsah') });
  await expect(perimeter.getByRole('link')).toHaveCount(1);
  await expect(perimeter.getByRole('link')).toHaveAttribute('href', `/mission?missionId=${PRACTICE.missionPerimeter}`);
  await expect(page.locator(`a[href*="${PRACTICE.missionDraft}"]`)).toHaveCount(0);
  await expect(page.getByText(PROMPTS.hidden)).toHaveCount(0);
});

test('with no published mission HQ shows an empty-state message and no error (FR-25)', async ({ page }) => {
  await childBackend(page, createFakeBackend({ practice: false }));
  await page.goto('/');
  await expect(page.getByText(m['child.hq.empty'])).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(0);
});

test('every published mission is open: mission 2 starts in 2 clicks at its first task (FR-25, NFR-7)', async ({ page }) => {
  await childBackend(page);
  await page.goto('/');
  await expect(page.locator('.is-locked, [aria-disabled="true"]')).toHaveCount(0);
  let clicks = 0;
  await page.getByRole('link', { name: new RegExp(format(m['child.hq.mission'], { n: 2 })) }).click();
  clicks += 1;
  await page.getByRole('link', { name: m['child.mission.start'] }).click();
  clicks += 1;
  await expect(page.getByText(PROMPTS.thousands)).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: format(m['child.task.title'], { n: 1 }) })).toBeVisible();
  expect(clicks).toBeLessThanOrEqual(2);
});

test('"Pokračovat" opens the first unresolved task of the latest mission in progress in one click (NFR-7)', async ({ page }) => {
  const backend = createFakeBackend();
  await practise(backend, PRACTICE.missionB, PRACTICE.taskThousands, { a: '1250' });
  await practise(backend, PRACTICE.missionA, PRACTICE.taskSum, { a: '0,75' });
  await childBackend(page, backend);
  await page.goto('/');
  await page.getByRole('link', { name: m['child.hq.continue'] }).click();
  await expect(page.getByText(PROMPTS.round)).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: format(m['child.task.title'], { n: 2 }) })).toBeVisible();
});

test('nothing in progress: no "Pokračovat" button (NFR-7)', async ({ page }) => {
  const backend = createFakeBackend();
  await practise(backend, PRACTICE.missionPerimeter, PRACTICE.taskSquare, { a: '8 cm' });
  await childBackend(page, backend);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: m['child.hq.continue'] })).toHaveCount(0);
});

test('the URL of a draft mission says "Tuhle misi jsem nenašel." and leads back to HQ', async ({ page }) => {
  let missionStatus = 0;
  page.on('response', (r) => {
    if (r.url().endsWith(`/api/child/missions/${PRACTICE.missionDraft}`)) missionStatus = r.status();
  });
  await childBackend(page);
  await page.goto(`/mission?missionId=${PRACTICE.missionDraft}`);
  await expect(page.getByText(m['child.mission.notFound'])).toBeVisible();
  expect(missionStatus).toBe(404);
  await page.getByRole('link', { name: m['child.common.backToHq'] }).click();
  await expect(page.getByRole('heading', { level: 1, name: format(m['child.hq.greeting'], { name: FICTIONAL_DISPLAY_NAME }) })).toBeVisible();
});
