import { expect, test } from '@playwright/test';

test('app shell loads in Czech with the design system applied', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'cs');
  const heading = page.getByRole('heading', { level: 1, name: 'Doučko' });
  await expect(heading).toBeVisible();
  // The display font comes from the vendored design system, not the browser default.
  await expect(heading).toHaveCSS('font-family', /Dela Gothic One/);
});
