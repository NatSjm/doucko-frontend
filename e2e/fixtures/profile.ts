import { expect, type Page } from '@playwright/test';

/**
 * NFR-3: the stack used for e2e runs and recordings is seeded with this fictional display name,
 * never the child's real one. Self-authored (fixtures/PROVENANCE.md).
 */
export const FICTIONAL_DISPLAY_NAME = 'Agent Nova';

/**
 * Fails the test if the page shows the real display name. On the laptop the real name is set in
 * DOUCKO_CHILD_DISPLAY_NAME (backend .env); every e2e spec that renders child screens calls this.
 */
export async function expectNoRealName(page: Page, realName = process.env.DOUCKO_CHILD_DISPLAY_NAME): Promise<void> {
  if (!realName?.trim()) return;
  const text = await page.locator('body').innerText();
  expect(text.toLocaleLowerCase('cs'), 'the real display name must never appear in e2e evidence (NFR-3)').not.toContain(
    realName.trim().toLocaleLowerCase('cs'),
  );
}
