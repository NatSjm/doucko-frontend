// @trace FR-22
// @trace FR-26
// @trace FR-27
// @trace NFR-7
import type { Page } from '@playwright/test';
import { messages as m } from '../src/i18n/messages';
import { format } from '../src/i18n/format';
import { FORMAT_TIP } from '../src/test/fake-admin-backend';
import { PRACTICE, PROMPTS } from '../src/test/fake-child-backend';
import { childBackend } from './fixtures/child';
import { AGAINST_STACK, expect, test } from './fixtures/test';

// The task screen: parts, keyboard, attempts, reveal and format tips, against the child contract stub
// (practice-flow "Task screen", "Two attempts, then reveal", "Oversized input"; answer-checking
// UNPARSEABLE). The real backend is replayed in the slice 7 real-stack smoke (task 4.4).
test.skip(AGAINST_STACK, 'answers come from the child contract stub; the stack smoke covers the real backend');
// Firefox under a loaded machine is slow to start and close contexts: triple the time, never the assertions.
test.beforeEach(({ browserName }) => test.slow(browserName === 'firefox'));

const task = (missionId: string, taskId: string) => `/task?missionId=${missionId}&taskId=${taskId}`;
const attempts = (used: number) => format(m['child.task.attempts'], { used, total: 2 });
const part = (page: Page, key: string) => page.locator(`[data-part="${key}"]`);
const input = (page: Page, key: string) => part(page, key).getByRole('textbox');

/** Collects the bodies of the attempt submissions the page sends. */
function attemptBodies(page: Page): unknown[] {
  const bodies: unknown[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().endsWith('/attempts')) bodies.push(r.postDataJSON());
  });
  return bodies;
}

test('a task shows its prompt, its image and one labelled input per part, focus in the first (FR-26)', async ({ page }) => {
  await childBackend(page);
  await page.goto(task(PRACTICE.missionA, PRACTICE.taskSum));
  await expect(page.getByText(PROMPTS.sum)).toBeVisible();
  const image = page.getByRole('img', { name: format(m['child.task.image'], { n: 1 }) });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole('textbox', { name: 'a' })).toBeFocused();
  await expect(page.getByText(attempts(0))).toBeVisible();
});

test('keyboard only: type a, Tab, type b, Enter submits both parts as one submission (FR-26, NFR-7)', async ({ page }) => {
  await childBackend(page);
  const bodies = attemptBodies(page);
  await page.goto(task(PRACTICE.missionA, PRACTICE.taskRound));
  await expect(input(page, 'a')).toBeFocused();
  await page.keyboard.type('3,5');
  await page.keyboard.press('Tab');
  await expect(input(page, 'b')).toBeFocused();
  await page.keyboard.type('7');
  await page.keyboard.press('Enter');
  await expect(page.getByText(m['child.task.correct'])).toBeVisible();
  expect(bodies).toEqual([{ answers: { a: '3,5', b: '7' } }]);
});

test('every control is reachable with Tab and Shift+Tab, shows focus, and works with Enter or Space (NFR-7)', async ({ page }) => {
  const backend = await childBackend(page);
  await page.goto(task(PRACTICE.missionA, PRACTICE.taskSum));
  await expect(page.getByRole('textbox', { name: 'a' })).toBeFocused();
  const wanted = [m['child.task.submit'], m['child.task.hint'], m['child.task.showTranslation'], m['child.report.open']];
  const names: string[] = [];
  for (let i = 0; i < 12 && !wanted.every((w) => names.some((n) => n.includes(w))); i++) {
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    if ((await focused.count()) === 0) continue;
    names.push((await focused.getAttribute('aria-label')) ?? (await focused.innerText()).trim());
    // The DS focus ring is a box-shadow; every focused control must show one.
    expect(await focused.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none');
  }
  const reached = names.join(' | ');
  for (const control of wanted) expect(reached).toContain(control);
  // Back with Shift+Tab to the hint button, then activate it with Enter.
  for (let i = 0; i < 12 && !((await page.locator(':focus').innerText()).includes(m['child.task.hint'])); i++) await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Zapiš obě čísla na setiny.')).toBeVisible();
  // The translation toggle with Space.
  await page.getByRole('button', { name: m['child.task.showTranslation'] }).focus();
  await page.keyboard.press(' ');
  await expect(page.getByText('Додай 0,5 + 0,25.')).toBeVisible();
  expect(backend.practice.settings.secondaryTaskLocale).toBe('uk');
  // The report link with Enter opens its dialog.
  await page.getByRole('button', { name: m['child.report.open'] }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: m['child.report.title'] })).toBeVisible();
});

test('an empty part is not sent: "Vyplň prosím odpověď", 2 attempts still left (FR-26)', async ({ page }) => {
  await childBackend(page);
  const bodies = attemptBodies(page);
  await page.goto(task(PRACTICE.missionA, PRACTICE.taskRound));
  await input(page, 'a').fill('3,5');
  await page.getByRole('button', { name: m['child.task.submit'] }).click();
  await expect(part(page, 'b').getByText(m['child.task.required'])).toBeVisible();
  await expect(page.getByText(attempts(0))).toBeVisible();
  expect(bodies).toEqual([]);
});

test('correct on the first attempt: "Výborně!" and "Další úloha" to the next unresolved task (FR-27)', async ({ page }) => {
  await childBackend(page);
  await page.goto(task(PRACTICE.missionA, PRACTICE.taskSum));
  await expect(page.getByRole('textbox', { name: 'a' })).toBeFocused();
  await page.keyboard.type('0,75');
  await page.keyboard.press('Enter');
  await expect(page.getByText(m['child.task.correct'])).toBeVisible();
  const next = page.getByRole('link', { name: m['child.task.next'] });
  await expect(next).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText(PROMPTS.round)).toBeVisible();
});

test('wrong, then revealed: the wrong part in "almost", the right one locked, then every answer shown neutrally (FR-27)', async ({ page }) => {
  await childBackend(page);
  const bodies = attemptBodies(page);
  await page.goto(task(PRACTICE.missionA, PRACTICE.taskRound));
  await input(page, 'a').fill('3,5');
  await input(page, 'b').fill('7,1');
  await page.keyboard.press('Enter');
  await expect(page.getByText(m['child.task.almost'])).toBeVisible();
  await expect(part(page, 'b')).toHaveClass(/dk-part-wrong/);
  await expect(part(page, 'b').getByText(m['child.task.partWrong'])).toBeVisible();
  await expect(input(page, 'a')).toHaveAttribute('readonly', '');
  await expect(part(page, 'a')).toHaveClass(/dk-part-correct/);
  await expect(page.getByText(attempts(1))).toBeVisible();
  // The correct value of b (7) is nowhere on screen.
  await expect(page.getByText(m['child.task.correctAnswer'])).toHaveCount(0);
  // Attempt 2 re-enters only b.
  await input(page, 'b').fill('7,2');
  await page.keyboard.press('Enter');
  await expect(page.getByText(m['child.task.revealed'])).toBeVisible();
  expect(bodies).toEqual([{ answers: { a: '3,5', b: '7,1' } }, { answers: { b: '7,2' } }]);
  await expect(part(page, 'b')).toHaveClass(/dk-part-revealed/);
  await expect(part(page, 'b').getByText('7', { exact: true })).toBeVisible();
  await expect(input(page, 'b')).toHaveAttribute('readonly', '');
  await expect(page.getByText(attempts(2))).toBeVisible();
  // Neither the revealed values nor the message use the wrong-answer colour role, and nothing says "Špatně" or "Chyba".
  const almost = await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--almost)';
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
  for (const el of [page.locator('.dk-fb'), part(page, 'b').locator('.dk-part-note'), input(page, 'b')]) {
    for (const prop of ['color', 'background-color', 'border-top-color'])
      expect(await el.first().evaluate((e, p) => getComputedStyle(e).getPropertyValue(p), prop)).not.toBe(almost);
  }
  await expect(page.locator('body')).not.toContainText(/Špatně|Chyba/);
  expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)).toBe(0);
});

test('Czech-formatted numbers are graded: a decimal comma and a no-break thousands space (FR-27)', async ({ page }) => {
  await childBackend(page);
  await page.goto(task(PRACTICE.missionB, PRACTICE.taskThousands));
  await expect(page.getByRole('textbox', { name: 'a' })).toBeFocused();
  await page.keyboard.type('1\u00a0250');
  await page.keyboard.press('Enter');
  await expect(page.getByText(m['child.task.correct'])).toBeVisible();
});

test('unreadable input shows a format tip, keeps the typed text and costs no attempt (FR-22)', async ({ page }) => {
  const backend = await childBackend(page);
  await page.goto(task(PRACTICE.missionA, PRACTICE.taskRound));
  await input(page, 'a').fill('3,5');
  await input(page, 'b').fill('7,1');
  await page.keyboard.press('Enter');
  await expect(page.getByText(attempts(1))).toBeVisible();
  await input(page, 'b').fill('5,,2');
  await page.keyboard.press('Enter');
  await expect(page.getByText(m['child.task.format'])).toBeVisible();
  await expect(part(page, 'b').getByText(FORMAT_TIP)).toBeVisible();
  await expect(input(page, 'b')).toHaveValue('5,,2');
  await expect(input(page, 'a')).toHaveAttribute('readonly', '');
  await expect(page.getByText(attempts(1))).toBeVisible();
  expect(backend.practice.progress.get(PRACTICE.taskRound)?.attemptsUsed).toBe(1);
});

test('an input stops at 100 characters when 150 are typed or pasted', async ({ page }) => {
  await childBackend(page);
  await page.goto(task(PRACTICE.missionA, PRACTICE.taskSum));
  await input(page, 'a').fill('1'.repeat(150));
  expect((await input(page, 'a').inputValue()).length).toBe(100);
});
