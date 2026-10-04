// @trace FR-58
import { ROUTE_PATHS } from '../src/app/route-paths';
import { expect, test } from './fixtures/test';

// --paper from src/design-system/tokens.css: light #fff7ef, dark #0e1330.
const PAPER = { light: 'rgb(255, 247, 239)', dark: 'rgb(14, 19, 48)' } as const;

/** Every control a user could flip: buttons, switches, checkboxes, radios, selects, menu toggles, the DS toggle. */
const CONTROLS =
  'button, [role=button], [role=switch], [role=checkbox], [role=radio], [role=menuitemcheckbox], [role=menuitemradio], ' +
  'input[type=checkbox], input[type=radio], select, [role=combobox], .dk-toggle';

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} OS`, () => {
    test.use({ colorScheme: scheme });
    for (const path of ROUTE_PATHS) {
      test(`${path} uses the ${scheme} theme`, async ({ page }) => {
        await page.goto(path);
        await expect(page.locator(`[data-route="${path}"]`)).toBeAttached();
        await expect(page.locator('body')).toHaveCSS('background-color', PAPER[scheme]);
        await expect(page.locator('html')).not.toHaveAttribute('data-theme');
      });

      test(`${path}: no control switches away from the ${scheme} theme`, async ({ page }) => {
        await page.goto(path);
        await expect(page.locator(`[data-route="${path}"]`)).toBeAttached();
        const controls = page.locator(CONTROLS);
        for (let i = 0; i < (await controls.count()); i++) {
          const control = controls.nth(i);
          if (!(await control.isVisible()) || !(await control.isEnabled())) continue;
          await control.click({ trial: false, timeout: 2_000 }).catch(() => undefined);
          if (new URL(page.url()).pathname !== path) await page.goto(path);
          await expect(page.locator('html')).not.toHaveAttribute('data-theme');
          await expect(page.locator('body')).toHaveCSS('background-color', PAPER[scheme]);
        }
      });
    }
  });
}
