// @trace NFR-13
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ROUTE_PATHS } from '../src/app/route-paths';

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`axe, ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    for (const path of ROUTE_PATHS) {
      test(`${path} has no serious or critical WCAG A/AA violation`, async ({ page }) => {
        await page.goto(path);
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
      const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
      expect(running).toBe(0);
    });
  }
});
