import { expect, type Page } from '@playwright/test';

/**
 * NFR-3: the stack used for e2e runs and recordings is seeded with this fictional display name,
 * never the child's real one. Self-authored (fixtures/PROVENANCE.md).
 */
export const FICTIONAL_DISPLAY_NAME = 'Agent Nova';

/**
 * Fails the test if the page shows the real display name (DOUCKO_CHILD_DISPLAY_NAME, backend .env).
 * The name is never handed to a matcher: a failure message (and the QA report that copies it)
 * must not carry it. Against a running stack (E2E_BASE_URL) the variable is required, so the guard
 * cannot pass by having nothing to compare. Every spec gets it through `e2e/fixtures/test.ts`.
 */
export async function expectNoRealName(
  page: Page,
  realName = process.env.DOUCKO_CHILD_DISPLAY_NAME,
  againstStack = !!process.env.E2E_BASE_URL,
): Promise<void> {
  const name = realName?.trim();
  if (!name) {
    if (againstStack) throw new Error('DOUCKO_CHILD_DISPLAY_NAME must be set when e2e runs against a stack (NFR-3 real-name guard)');
    return;
  }
  const text = (await page.locator('body').innerText()).toLocaleLowerCase('cs');
  const leaked = text.includes(name.toLocaleLowerCase('cs'));
  expect(leaked, 'the real display name appeared on the page (NFR-3)').toBe(false);
}
