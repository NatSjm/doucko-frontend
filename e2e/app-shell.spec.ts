// @trace NFR-6
// @trace NFR-3
import { expect, test } from '@playwright/test';
import { expectNoRealName, FICTIONAL_DISPLAY_NAME } from './fixtures/profile';

test('app shell loads in Czech at 1280×720 with the design system applied', async ({ page }) => {
  await page.goto('/');
  expect(page.viewportSize()).toEqual({ width: 1280, height: 720 });
  await expect(page.locator('html')).toHaveAttribute('lang', 'cs');
  const heading = page.getByRole('heading', { level: 1, name: 'Doučko' });
  await expect(heading).toBeVisible();
  // The display font comes from the vendored design system, not the browser default.
  await expect(heading).toHaveCSS('font-family', /Dela Gothic One/);
  await expectNoRealName(page);
});

test('the e2e display name is fictional and distinct', () => {
  expect(FICTIONAL_DISPLAY_NAME).toMatch(/\S/);
  expect(FICTIONAL_DISPLAY_NAME).not.toBe(process.env.DOUCKO_CHILD_DISPLAY_NAME);
});

test('a page showing the real display name fails the guard', async ({ page }) => {
  await page.setContent('<main><h1>Ahoj, Testovací Hrdinka!</h1></main>');
  await expect(expectNoRealName(page, 'Testovací Hrdinka')).rejects.toThrow();
  await expectNoRealName(page, 'Někdo Jiný');
});
