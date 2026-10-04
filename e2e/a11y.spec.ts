// @trace NFR-13
import AxeBuilder from '@axe-core/playwright';
import { ROUTE_PATHS } from '../src/app/route-paths';
import { expect, test } from './fixtures/test';

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`axe, ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    for (const path of ROUTE_PATHS) {
      test(`${path} has no serious or critical WCAG A/AA violation`, async ({ page }) => {
        await page.goto(path);
        await expect(page.locator(`[data-route="${path}"]`)).toBeAttached();
        const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
        const severe = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
        expect(severe.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
      });
    }
  });
}

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  for (const path of ROUTE_PATHS) {
    test(`${path} runs no animation`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page.locator(`[data-route="${path}"]`)).toBeAttached();
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
