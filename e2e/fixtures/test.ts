import { test as base } from '@playwright/test';
import { expectNoRealName } from './profile';

/**
 * The `test` every spec imports: after each test that opened a page, the real-name guard (NFR-3)
 * runs on whatever the page shows, so no spec can forget it.
 */
export const test = base.extend<{ noRealName: void }>({
  noRealName: [
    async ({ page }, use) => {
      await use();
      if (page.url() !== 'about:blank') await expectNoRealName(page);
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
