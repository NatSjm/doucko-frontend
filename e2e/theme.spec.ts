// @trace FR-58
import { SCREENS } from './screens';
import { expectSignedInContent, signedInAdmin } from './fixtures/admin';
import { childBackend, expectChildContent, screenBackend } from './fixtures/child';
import { AGAINST_STACK, expect, test } from './fixtures/test';

// --paper from src/design-system/tokens.css: light #fff7ef, dark #0e1330.
const PAPER = { light: 'rgb(255, 247, 239)', dark: 'rgb(14, 19, 48)' } as const;

/** Every control a user could flip: buttons, switches, checkboxes, radios, selects, menu toggles, the DS toggle. */
const CONTROLS =
  'button, [role=button], [role=switch], [role=checkbox], [role=radio], [role=menuitemcheckbox], [role=menuitemradio], ' +
  '[role=tab], [role=option], [aria-pressed], summary, input[type=checkbox], input[type=radio], input[type=button], ' +
  'input[type=submit], input[type=reset], select, [role=combobox], .dk-toggle';

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} OS`, () => {
    test.use({ colorScheme: scheme });
    for (const screen of SCREENS) {
      test(`${screen.name} uses the ${scheme} theme`, async ({ page }) => {
        if (screen.admin && !AGAINST_STACK) await signedInAdmin(page);
        if (screen.child && !AGAINST_STACK) await childBackend(page, await screenBackend(screen.name));
        await page.goto(screen.path);
        await expect(page.locator(screen.marker)).toBeAttached();
        await expect(page.locator('body')).toHaveCSS('background-color', PAPER[scheme]);
        await expect(page.locator('[data-theme]')).toHaveCount(0);
      });

      test(`${screen.name}: no control switches away from the ${scheme} theme`, async ({ page }) => {
        // Signed in, the authoring screens (and the task screen) have many controls; triple the time, never the assertions.
        test.slow(screen.admin || screen.child);
        if (screen.admin && !AGAINST_STACK) await signedInAdmin(page);
        if (screen.child && !AGAINST_STACK) await childBackend(page, await screenBackend(screen.name));
        await page.goto(screen.path);
        await expect(page.locator(screen.marker)).toBeAttached();
        if (screen.admin && !AGAINST_STACK) await expectSignedInContent(page);
        if (screen.child && !AGAINST_STACK) await expectChildContent(page);
        const controls = page.locator(CONTROLS);
        let activated = 0;
        for (let i = 0; i < (await controls.count()); i++) {
          const control = controls.nth(i);
          if (!(await control.isVisible()) || !(await control.isEnabled())) continue;
          // A native select (a theme picker built as one) is switched to each of its options; anything
          // else is clicked. A control that cannot be operated fails the test.
          const isSelect = await control.evaluate((el) => el instanceof HTMLSelectElement);
          const choices = isSelect
            ? await control.locator('option:not([disabled])').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value))
            : [null];
          for (const choice of choices) {
            if (choice === null) await control.click({ timeout: 2_000 });
            else await control.selectOption(choice, { timeout: 2_000 });
            activated += 1;
            // Let a switch that applies asynchronously (effect, timer, transition) land before checking.
            await page.waitForTimeout(300);
            await expect(page.locator('[data-theme]')).toHaveCount(0);
            await expect(page.locator('body')).toHaveCSS('background-color', PAPER[scheme]);
            // An option or control that navigated away: come back and carry on (the locator re-resolves).
            if (new URL(page.url()).pathname !== new URL(screen.path, page.url()).pathname) {
              await page.goto(screen.path);
              await expect(page.locator(screen.marker)).toBeAttached();
            }
          }
        }
        // A screen without controls has nothing to activate: that is a skip, never a vacuous pass.
        // src/app/theme-source.test.ts covers it statically.
        test.skip(activated === 0, 'no control on this screen; covered by src/app/theme-source.test.ts');
      });
    }
  });
}
