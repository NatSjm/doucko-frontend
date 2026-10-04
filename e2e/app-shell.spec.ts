// @trace NFR-6
// @trace NFR-3
import { expectNoRealName, FICTIONAL_DISPLAY_NAME } from './fixtures/profile';
import { expect, test } from './fixtures/test';

test('app shell loads in Czech at 1280×720 with the design system applied', async ({ page }) => {
  await page.goto('/');
  expect(page.viewportSize()).toEqual({ width: 1280, height: 720 });
  await expect(page.locator('html')).toHaveAttribute('lang', 'cs');
  await expect(page.locator('[data-route="/"]')).toBeAttached();
  const heading = page.getByRole('heading', { level: 1, name: 'Doučko' });
  await expect(heading).toBeVisible();
  // The display font comes from the vendored design system, not the browser default.
  await expect(heading).toHaveCSS('font-family', /Dela Gothic One/);
  await expect(page).toHaveTitle('Doučko');
});

test('the e2e display name is fictional and distinct', () => {
  expect(FICTIONAL_DISPLAY_NAME).toMatch(/\S/);
  expect(FICTIONAL_DISPLAY_NAME).not.toBe(process.env.DOUCKO_CHILD_DISPLAY_NAME);
});

test('a page showing the real display name fails the guard without echoing the name', async ({ page }) => {
  await page.setContent('<main><h1>Ahoj, Testovací Hrdinka!</h1></main>');
  const error = await expectNoRealName(page, 'Testovací Hrdinka', false).then(
    () => null,
    (e: Error) => e,
  );
  expect(error).not.toBeNull();
  expect(error?.message.toLocaleLowerCase('cs')).not.toContain('hrdinka');
  await expectNoRealName(page, 'Někdo Jiný', false);
});

test('against a stack, the guard fails when the real name is not configured', async ({ page }) => {
  await page.setContent('<main></main>');
  await expect(expectNoRealName(page, '', true)).rejects.toThrow(/DOUCKO_CHILD_DISPLAY_NAME/);
  await expectNoRealName(page, '', false);
});
