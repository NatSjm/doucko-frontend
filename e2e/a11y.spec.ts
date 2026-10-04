// @trace NFR-13
import AxeBuilder from '@axe-core/playwright';
import { SCREENS } from './screens';
import { expect, test } from './fixtures/test';

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`axe, ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    for (const screen of SCREENS) {
      test(`${screen.name} has no serious or critical WCAG A/AA violation`, async ({ page, browserName }) => {
        // An axe scan in Firefox takes 10–25 s and passed the 30 s limit under load; triple the time,
        // never the assertions.
        test.slow(browserName === 'firefox');
        await page.goto(screen.path);
        await expect(page.locator(screen.marker)).toBeAttached();
        const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
        const severe = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
        expect(severe.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
      });
    }
  });
}

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  for (const screen of SCREENS) {
    test(`${screen.name} runs no animation`, async ({ page }) => {
      await page.goto(screen.path);
      await page.waitForLoadState('networkidle');
      await expect(page.locator(screen.marker)).toBeAttached();
      // Sampled after load and again later, counting animations that are pending (delayed) as well
      // as running, so motion started after hydration or by a delay is seen too.
      for (const waitMs of [0, 500]) {
        await page.waitForTimeout(waitMs);
        const moving = await page.evaluate(
          () =>
            document
              .getAnimations()
              .filter((a) => a.playState === 'running' || a.pending)
              .filter((a) => Number(a.effect?.getComputedTiming().duration ?? 0) > 1).length,
        );
        expect(moving).toBe(0);
      }
    });
  }
});
