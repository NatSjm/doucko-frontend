// @trace FR-28
// @trace FR-29
// @trace FR-30
import type { Page } from '@playwright/test';
import { messages as m } from '../src/i18n/messages';
import { format } from '../src/i18n/format';
import { createFakeBackend, PRACTICE, PROMPTS, practise } from '../src/test/fake-child-backend';
import { childBackend } from './fixtures/child';
import { AGAINST_STACK, expect, test } from './fixtures/test';

// Hints, the Ukrainian translation toggle and "Nahlásit problém" on the task screen, against the child
// contract stub (practice-flow "Hints on demand", "Ukrainian translation toggle", "Report a problem").
test.skip(AGAINST_STACK, 'answers come from the child contract stub; the stack smoke covers the real backend');
// Firefox under a loaded machine is slow to start and close contexts: triple the time, never the assertions.
test.beforeEach(({ browserName }) => test.slow(browserName === 'firefox'));

const task = (missionId: string, taskId: string) => `/task?missionId=${missionId}&taskId=${taskId}`;
const hintButton = (page: Page) => page.getByRole('button', { name: new RegExp(`^${m['child.task.hint']}`) });
const left = (n: number) => format(m['child.task.hintsLeft'], { n });
const dialog = (page: Page) => page.getByRole('dialog', { name: m['child.report.title'] });

test.describe('hints (FR-28)', () => {
  test('open one at a time, in order, before any attempt; the counter goes 2 → 1 → 0', async ({ page }) => {
    const backend = await childBackend(page);
    await page.goto(task(PRACTICE.missionA, PRACTICE.taskSum));
    await expect(hintButton(page)).toContainText(left(2));
    await hintButton(page).click();
    await expect(page.getByText('Zapiš obě čísla na setiny.')).toBeVisible();
    await expect(page.getByText('Sečti 50 setin a 25 setin.')).toHaveCount(0);
    await expect(hintButton(page)).toContainText(left(1));
    await hintButton(page).click();
    await expect(page.getByText('Sečti 50 setin a 25 setin.')).toBeVisible();
    await expect(hintButton(page)).toContainText(left(0));
    await expect(hintButton(page)).toBeDisabled();
    expect(backend.practice.hintsOpened.get(PRACTICE.taskSum)).toBe(2);
  });

  test('an opened hint is still shown after a reload and counts once', async ({ page }) => {
    const backend = await childBackend(page);
    await page.goto(task(PRACTICE.missionA, PRACTICE.taskSum));
    await hintButton(page).click();
    await expect(page.getByText('Zapiš obě čísla na setiny.')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Zapiš obě čísla na setiny.')).toBeVisible();
    await expect(hintButton(page)).toContainText(left(1));
    expect(backend.practice.hintsOpened.get(PRACTICE.taskSum)).toBe(1);
  });

  test('a hint after a reveal leaves the task revealed', async ({ page }) => {
    const backend = createFakeBackend();
    await practise(backend, PRACTICE.missionPerimeter, PRACTICE.taskSquare, { a: '6 cm' });
    await practise(backend, PRACTICE.missionPerimeter, PRACTICE.taskSquare, { a: '7 cm' });
    await childBackend(page, backend);
    await page.goto(task(PRACTICE.missionPerimeter, PRACTICE.taskSquare));
    await hintButton(page).click();
    await expect(page.getByText('Čtverec má čtyři stejné strany.')).toBeVisible();
    await expect(page.getByText(m['child.task.revealed'])).toBeVisible();
    expect(backend.practice.progress.get(PRACTICE.taskSquare)?.state).toBe('REVEALED');
  });

  test('a task without hints has no hint button', async ({ page }) => {
    await childBackend(page);
    await page.goto(task(PRACTICE.missionA, PRACTICE.taskRound));
    await expect(page.getByText(PROMPTS.round)).toBeVisible();
    await expect(hintButton(page)).toHaveCount(0);
  });
});

test.describe('translation toggle (FR-29)', () => {
  test('"Zobrazit ukrajinsky" shows the Ukrainian prompt next to the Czech; the UI stays Czech', async ({ page }) => {
    const backend = await childBackend(page);
    await page.goto(task(PRACTICE.missionA, PRACTICE.taskSum));
    await page.getByRole('button', { name: m['child.task.showTranslation'] }).click();
    const uk = page.getByText('Додай 0,5 + 0,25.');
    await expect(uk).toBeVisible();
    await expect(page.locator('[lang="uk"]').filter({ hasText: 'Додай 0,5 + 0,25.' })).toHaveCount(1);
    await expect(page.getByText(PROMPTS.sum)).toBeVisible();
    await expect(page.getByRole('button', { name: m['child.task.submit'] })).toBeVisible();
    await expect(page.getByRole('button', { name: m['child.task.hideTranslation'] })).toHaveAttribute('aria-pressed', 'true');
    expect(backend.practice.settings.secondaryTaskLocale).toBe('uk');
  });

  test('the toggle is remembered in the profile: another browser the next day shows the translation at once', async ({ page, browser }) => {
    const backend = await childBackend(page);
    await page.goto(task(PRACTICE.missionA, PRACTICE.taskSum));
    await page.getByRole('button', { name: m['child.task.showTranslation'] }).click();
    await expect(page.getByText('Додай 0,5 + 0,25.')).toBeVisible();
    await page.goto('about:blank'); // the first browser is done (kept open for the after-test real-name guard)
    const other = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const next = await other.newPage();
    await childBackend(next, backend);
    await next.goto(task(PRACTICE.missionB, PRACTICE.taskThousands));
    await expect(next.getByText('Скільки буде 1 000 + 250?')).toBeVisible();
    await expect(next.getByRole('button', { name: m['child.task.hideTranslation'] })).toHaveAttribute('aria-pressed', 'true');
    await other.close();
  });

  test('a task without a translation shows "Překlad není k dispozici" and only Czech', async ({ page }) => {
    const backend = createFakeBackend();
    backend.practice.settings.secondaryTaskLocale = 'uk';
    await childBackend(page, backend);
    await page.goto(task(PRACTICE.missionA, PRACTICE.taskRound));
    await expect(page.getByRole('button', { name: m['child.task.translationUnavailable'] })).toBeDisabled();
    await expect(page.locator('[lang="uk"]')).toHaveCount(0);
  });

  test('a translated hint shows in Czech with the Ukrainian text next to it', async ({ page }) => {
    const backend = createFakeBackend();
    backend.practice.settings.secondaryTaskLocale = 'uk';
    await childBackend(page, backend);
    await page.goto(task(PRACTICE.missionA, PRACTICE.taskSum));
    await hintButton(page).click();
    await expect(page.getByText('Zapiš obě čísla na setiny.')).toBeVisible();
    await expect(page.locator('[lang="uk"]').filter({ hasText: 'Запиши обидва числа в сотих.' })).toBeVisible();
  });
});

test.describe('report a problem (FR-30)', () => {
  test('after a wrong verdict: the report carries that attempt, "Díky, podívám se na to!", 1 attempt still left', async ({ page }) => {
    const backend = await childBackend(page);
    await page.goto(task(PRACTICE.missionA, PRACTICE.taskSum));
    await expect(page.getByRole('textbox', { name: 'a' })).toBeFocused();
    await page.keyboard.type('0,7');
    await page.keyboard.press('Enter');
    await expect(page.getByText(format(m['child.task.attempts'], { used: 1, total: 2 }))).toBeVisible();
    await page.getByRole('button', { name: m['child.report.open'] }).click();
    await dialog(page).getByRole('radio', { name: m['child.report.reason.ANSWER_IS_CORRECT'] }).check();
    await dialog(page).getByRole('button', { name: m['child.report.send'] }).click();
    await expect(page.getByText(m['child.report.thanks'])).toBeVisible();
    await expect(dialog(page)).toHaveCount(0);
    expect(backend.practice.reports).toEqual([{ missionId: PRACTICE.missionA, taskId: PRACTICE.taskSum, reason: 'ANSWER_IS_CORRECT', note: null, attempt: { a: '0,7' } }]);
    await expect(page.getByText(format(m['child.task.attempts'], { used: 1, total: 2 }))).toBeVisible();
    expect(backend.practice.progress.get(PRACTICE.taskSum)?.attemptsUsed).toBe(1);
  });

  test('before any attempt: stored without an attempt', async ({ page }) => {
    const backend = await childBackend(page);
    await page.goto(task(PRACTICE.missionA, PRACTICE.taskSum));
    await page.getByRole('button', { name: m['child.report.open'] }).click();
    await dialog(page).getByRole('radio', { name: m['child.report.reason.UNCLEAR_PROMPT'] }).check();
    await dialog(page).getByRole('button', { name: m['child.report.send'] }).click();
    await expect(page.getByText(m['child.report.thanks'])).toBeVisible();
    expect(backend.practice.reports).toMatchObject([{ reason: 'UNCLEAR_PROMPT', attempt: null }]);
  });

  test('after a reveal: the report carries attempt 2 and the task stays revealed', async ({ page }) => {
    const backend = createFakeBackend();
    await practise(backend, PRACTICE.missionPerimeter, PRACTICE.taskSquare, { a: '6 cm' });
    await practise(backend, PRACTICE.missionPerimeter, PRACTICE.taskSquare, { a: '7 cm' });
    await childBackend(page, backend);
    await page.goto(task(PRACTICE.missionPerimeter, PRACTICE.taskSquare));
    await page.getByRole('button', { name: m['child.report.open'] }).click();
    await dialog(page).getByRole('radio', { name: m['child.report.reason.ANSWER_IS_CORRECT'] }).check();
    await dialog(page).getByRole('button', { name: m['child.report.send'] }).click();
    await expect(page.getByText(m['child.report.thanks'])).toBeVisible();
    expect(backend.practice.reports).toMatchObject([{ attempt: { a: '7 cm' } }]);
    await expect(page.getByText(m['child.task.revealed'])).toBeVisible();
  });

  test('"Jiné" without a note is not sent and asks for one; the note holds at most 1000 characters', async ({ page }) => {
    const backend = await childBackend(page);
    await page.goto(task(PRACTICE.missionA, PRACTICE.taskSum));
    await page.getByRole('button', { name: m['child.report.open'] }).click();
    await dialog(page).getByRole('radio', { name: m['child.report.reason.OTHER'] }).check();
    await dialog(page).getByRole('button', { name: m['child.report.send'] }).click();
    await expect(dialog(page).getByText(m['child.report.noteRequired'])).toBeVisible();
    expect(backend.practice.reports).toEqual([]);
    const note = dialog(page).getByRole('textbox', { name: m['child.report.note'] });
    await note.fill('x'.repeat(1001));
    expect((await note.inputValue()).length).toBe(1000);
    await note.fill('Obrázek se nenačetl.');
    await dialog(page).getByRole('button', { name: m['child.report.send'] }).click();
    await expect(page.getByText(m['child.report.thanks'])).toBeVisible();
    expect(backend.practice.reports).toMatchObject([{ reason: 'OTHER', note: 'Obrázek se nenačetl.' }]);
  });
});
