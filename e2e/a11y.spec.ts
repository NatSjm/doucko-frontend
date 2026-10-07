// @trace NFR-13
// @trace FR-36
import AxeBuilder from '@axe-core/playwright';
import { SCREENS } from './screens';
import { expectSignedInContent, signedInAdmin } from './fixtures/admin';
import { childBackend, expectChildContent, screenBackend } from './fixtures/child';
import { AGAINST_STACK, expect, test } from './fixtures/test';
import { messages } from '../src/i18n/messages';
import { completeMission, createFakeBackend, creditOutsideSession, PLACEHOLDER_LADDER, PRACTICE } from '../src/test/fake-child-backend';

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`axe, ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    for (const screen of SCREENS) {
      test(`${screen.name} has no serious or critical WCAG A/AA violation`, async ({ page, browserName }) => {
        // An axe scan in Firefox takes 10–25 s and passed the 30 s limit under load; triple the time,
        // never the assertions.
        test.slow(browserName === 'firefox');
        // Admin screens are scanned signed in, with content (the stack smoke covers the real backend).
        if (screen.admin && !AGAINST_STACK) await signedInAdmin(page);
        if (screen.child && !AGAINST_STACK) await childBackend(page, await screenBackend(screen.name));
        await page.goto(screen.path);
        await expect(page.locator(screen.marker)).toBeAttached();
        if (screen.admin && !AGAINST_STACK) await expectSignedInContent(page);
        if (screen.child && !AGAINST_STACK) await expectChildContent(page);
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
      if (screen.admin && !AGAINST_STACK) await signedInAdmin(page);
      if (screen.child && !AGAINST_STACK) await childBackend(page, await screenBackend(screen.name));
      await page.goto(screen.path);
      await page.waitForLoadState('networkidle');
      await expect(page.locator(screen.marker)).toBeAttached();
      if (screen.admin && !AGAINST_STACK) await expectSignedInContent(page);
      if (screen.child && !AGAINST_STACK) await expectChildContent(page);
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

// The rank-up celebration states (FR-36): HQ with a pending rank-up and the mission-complete screen
// with a completing rank-up, scanned in both themes and checked still under reduced motion.
const CELEBRATIONS = [
  {
    name: 'HQ with a pending rank-up',
    path: '/',
    setup: async () => {
      const backend = createFakeBackend();
      backend.practice.totalXp = 140;
      creditOutsideSession(backend, 20);
      return backend;
    },
  },
  {
    name: 'mission complete with a rank-up',
    path: `/summary?missionId=${PRACTICE.missionPerimeter}`,
    setup: async () => {
      const backend = createFakeBackend();
      backend.practice.totalXp = 140;
      await completeMission(backend, PRACTICE.missionPerimeter);
      return backend;
    },
  },
];

test.describe('rank-up celebration', () => {
  test.skip(AGAINST_STACK, 'the celebration states come from the child contract stub');
  for (const state of CELEBRATIONS) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${state.name}, ${scheme}: no serious or critical WCAG A/AA violation`, async ({ page, browserName }) => {
        test.slow(browserName === 'firefox');
        await page.emulateMedia({ colorScheme: scheme });
        await childBackend(page, await state.setup());
        await page.goto(state.path);
        await expect(page.getByText(messages['child.rankUp.kicker'])).toBeVisible();
        // Let the entrance animation settle, so the scan sees the final colours.
        await page.waitForTimeout(1_000);
        const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
        const severe = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
        expect(severe.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
      });
    }

    test(`${state.name}, reduced motion: the same text and medal, no animation`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await childBackend(page, await state.setup());
      await page.goto(state.path);
      const status = page.getByRole('status').filter({ hasText: messages['child.rankUp.kicker'] });
      await expect(status).toContainText(PLACEHOLDER_LADDER[1].name);
      await expect(status.locator('svg.dk-rank-medal')).toBeVisible();
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
