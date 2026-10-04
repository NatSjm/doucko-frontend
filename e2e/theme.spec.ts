// @trace FR-58
import { SCREENS } from './screens';
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
    for (const screen of SCREENS) {
      test(`${screen.name} uses the ${scheme} theme`, async ({ page }) => {
        await page.goto(screen.path);
        await expect(page.locator(screen.marker)).toBeAttached();
        await expect(page.locator('body')).toHaveCSS('background-color', PAPER[scheme]);
        await expect(page.locator('[data-theme]')).toHaveCount(0);
      });

      test(`${screen.name}: no control switches away from the ${scheme} theme`, async ({ page }) => {
        await page.goto(screen.path);
        await expect(page.locator(screen.marker)).toBeAttached();
        const controls = page.locator(CONTROLS);
        let activated = 0;
        for (let i = 0; i < (await controls.count()); i++) {
          const control = controls.nth(i);
          if (!(await control.isVisible()) || !(await control.isEnabled())) continue;
          await control.click({ timeout: 2_000 }); // a control that cannot be clicked fails the test
          activated += 1;
          if (new URL(page.url()).pathname !== new URL(screen.path, page.url()).pathname) await page.goto(screen.path);
          await expect(page.locator('[data-theme]')).toHaveCount(0);
          await expect(page.locator('body')).toHaveCSS('background-color', PAPER[scheme]);
        }
        // Zero controls is reported, not hidden; src/app/theme-source.test.ts covers screens without any.
        test.info().annotations.push({ type: 'controls activated', description: String(activated) });
      });
    }
  });
}
