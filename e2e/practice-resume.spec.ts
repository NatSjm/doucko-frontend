// @trace FR-31
import type { Page } from '@playwright/test';
import { messages as m } from '../src/i18n/messages';
import { format } from '../src/i18n/format';
import { createFakeBackend, PRACTICE, PROMPTS, practise } from '../src/test/fake-child-backend';
import { childBackend } from './fixtures/child';
import { AGAINST_STACK, expect, test } from './fixtures/test';

// Save and resume (practice-flow "Save and resume"), against the child contract stub: the practice
// state lives in the stub, as on the server, so a new browser context is "the browser reopened".
test.skip(AGAINST_STACK, 'answers come from the child contract stub; the stack smoke covers the real backend');
// Firefox under a loaded machine is slow to start and close contexts: triple the time, never the assertions.
test.beforeEach(({ browserName }) => test.slow(browserName === 'firefox'));

const task = (missionId: string, taskId: string) => `/task?missionId=${missionId}&taskId=${taskId}`;
const attempts = (used: number) => format(m['child.task.attempts'], { used, total: 2 });
const part = (page: Page, key: string) => page.locator(`[data-part="${key}"]`);

test('closing the browser mid-mission and coming back resumes at the first unresolved task with its attempt counted', async ({ page, browser }) => {
  const backend = await childBackend(page);
  await page.goto('/');
  await page.getByRole('link', { name: new RegExp(format(m['child.hq.mission'], { n: 1 })) }).first().click();
  await page.getByRole('link', { name: m['child.mission.start'] }).click();
  await expect(page.getByText(PROMPTS.sum)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'a' })).toBeFocused();
  await page.keyboard.type('0,75');
  await page.keyboard.press('Enter');
  await page.getByRole('link', { name: m['child.task.next'] }).click();
  await expect(page.getByText(PROMPTS.round)).toBeVisible();
  await part(page, 'a').getByRole('textbox').fill('3,5');
  await part(page, 'b').getByRole('textbox').fill('7,1');
  await page.keyboard.press('Enter');
  await expect(page.getByText(attempts(1))).toBeVisible();
  await page.goto('about:blank'); // the first browser is done (kept open for the after-test real-name guard)

  const reopened = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const again = await reopened.newPage();
  await childBackend(again, backend);
  await again.goto('/');
  await again.getByRole('link', { name: m['child.hq.continue'] }).click();
  await expect(again.getByText(PROMPTS.round)).toBeVisible();
  await expect(again.getByText(attempts(1))).toBeVisible();
  await expect(part(again, 'b')).toHaveClass(/dk-part-wrong/);
  await expect(part(again, 'a').getByRole('textbox')).toHaveAttribute('readonly', '');
  await reopened.close();
});

test('continuing skips resolved tasks: with tasks 1 and 3 resolved, task 2 opens', async ({ page }) => {
  const backend = createFakeBackend();
  await practise(backend, PRACTICE.missionA, PRACTICE.taskSum, { a: '0,75' });
  await practise(backend, PRACTICE.missionA, PRACTICE.taskLargest, { a: ['A'] });
  await childBackend(page, backend);
  await page.goto(`/mission?missionId=${PRACTICE.missionA}`);
  await page.getByRole('link', { name: m['child.mission.continue'] }).click();
  await expect(page.getByText(PROMPTS.round)).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: format(m['child.task.title'], { n: 2 }) })).toBeVisible();
});

test('server unreachable on submit: no verdict, inputs kept, the message shown; once back the same answer is attempt 1', async ({ page }) => {
  const backend = await childBackend(page);
  await page.goto(task(PRACTICE.missionA, PRACTICE.taskSum));
  await expect(page.getByText(PROMPTS.sum)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'a' })).toBeFocused();
  backend.down = true;
  await page.keyboard.type('0,7');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toHaveText(m['child.task.saveFailed']);
  await expect(page.getByRole('textbox', { name: 'a' })).toHaveValue('0,7');
  await expect(page.getByText(m['child.task.almost'])).toHaveCount(0);
  expect(backend.practice.attempts).toEqual([]);
  backend.down = false;
  await page.getByRole('button', { name: m['child.task.submit'] }).click();
  await expect(page.getByText(m['child.task.almost'])).toBeVisible();
  await expect(page.getByText(attempts(1))).toBeVisible();
  expect(backend.practice.attempts).toEqual([{ missionId: PRACTICE.missionA, taskId: PRACTICE.taskSum, attemptNo: 1, answers: { a: '0,7' } }]);
});

test('response lost after the attempt was stored: submitting again shows the stored verdict, the log keeps one attempt', async ({ page }) => {
  const backend = await childBackend(page);
  await page.goto(task(PRACTICE.missionA, PRACTICE.taskSum));
  await expect(page.getByText(PROMPTS.sum)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'a' })).toBeFocused();
  backend.practice.dropResponse = (method, path) => method === 'POST' && path.endsWith('/attempts');
  await page.keyboard.type('0,7');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toHaveText(m['child.task.saveFailed']);
  await page.getByRole('button', { name: m['child.task.submit'] }).click();
  await expect(page.getByText(m['child.task.almost'])).toBeVisible();
  await expect(page.getByText(attempts(1))).toBeVisible();
  expect(backend.practice.attempts).toHaveLength(1);
});
