// @trace FR-58
import { expect, test } from '@playwright/test';
import { ROUTE_PATHS } from '../src/app/route-paths';

// --paper from src/design-system/tokens.css: light #fff7ef, dark #0e1330.
const PAPER = { light: 'rgb(255, 247, 239)', dark: 'rgb(14, 19, 48)' } as const;

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} OS`, () => {
    test.use({ colorScheme: scheme });
    for (const path of ROUTE_PATHS) {
      test(`${path} uses the ${scheme} theme`, async ({ page }) => {
        await page.goto(path);
        await expect(page.locator('body')).toHaveCSS('background-color', PAPER[scheme]);
        await expect(page.locator('html')).not.toHaveAttribute('data-theme');
      });
    }
  });
}

for (const path of ROUTE_PATHS) {
  test(`${path} offers no theme toggle`, async ({ page }) => {
    await page.goto(path);
    const toggles = page.getByRole('switch').or(page.getByRole('button', { name: /theme|motiv|tmav|světl|dark|light/i }));
    await expect(toggles).toHaveCount(0);
  });
}
