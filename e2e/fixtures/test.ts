import { test as base, type Page } from '@playwright/test';
import { expectNoRealName } from './profile';

/** True when the specs run against a real stack (E2E_BASE_URL), false under `vite preview`. */
export const AGAINST_STACK = !!process.env.E2E_BASE_URL;

/**
 * Without a stack, `vite preview` has no backend and would answer `/api/` with index.html. This
 * stands in for a backend with no admin session: `GET /api/admin/session` is 401, any other API
 * call 404, both as problem+json. A spec that needs more registers its own routes, which win.
 */
async function stubApiWithoutSession(page: Page) {
  await page.route('**/api/**', (route) => {
    const unauthorized = new URL(route.request().url()).pathname.startsWith('/api/admin/');
    const status = unauthorized ? 401 : 404;
    return route.fulfill({
      status,
      contentType: 'application/problem+json',
      body: JSON.stringify({ type: 'about:blank', title: unauthorized ? 'Unauthorized' : 'Resource not found', status }),
    });
  });
}

/**
 * The `test` every spec imports: after each test that opened a page, the real-name guard (NFR-3)
 * runs on whatever the page shows, so no spec can forget it. Without a stack, the API is stubbed.
 */
export const test = base.extend<{ noRealName: void; apiStub: void }>({
  apiStub: [
    async ({ page }, use) => {
      if (!AGAINST_STACK) await stubApiWithoutSession(page);
      await use();
    },
    { auto: true },
  ],
  noRealName: [
    async ({ page }, use) => {
      await use();
      if (page.url() !== 'about:blank') await expectNoRealName(page);
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
