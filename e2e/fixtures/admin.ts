import { expect, type Page } from '@playwright/test';
import { messages } from '../../src/i18n/messages';
import { createFakeAdminBackend, CSRF_TOKEN, type FakeAdminBackend } from '../../src/test/fake-admin-backend';

/**
 * Answers `/api/**` from the shared fake admin backend (`src/test/fake-admin-backend.ts`), signed in
 * and seeded, and sets the `XSRF-TOKEN` cookie the admin client copies into its header. Registered
 * after the fixture's default stub, so it wins. Returns the backend so a spec can read or change its
 * state (it runs in the Playwright process, not in the page). Only for runs without a stack.
 */
export async function signedInAdmin(page: Page, options: { seeded?: boolean } = {}): Promise<FakeAdminBackend> {
  const backend = createFakeAdminBackend({ signedIn: true, seeded: options.seeded ?? true });
  // `vite preview` serves on localhost (any port shares the cookie).
  await page.context().addCookies([{ name: 'XSRF-TOKEN', value: CSRF_TOKEN, domain: 'localhost', path: '/', sameSite: 'Strict' }]);
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const body = request.postDataBuffer();
    const forwarded = new Request(request.url(), {
      method: request.method(),
      headers: request.headers(),
      body: body && !['GET', 'HEAD'].includes(request.method()) ? new Uint8Array(body) : undefined,
    });
    let response: Response;
    try {
      response = await backend.handle(forwarded);
    } catch {
      return route.abort('failed');
    }
    return route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: Buffer.from(await response.arrayBuffer()),
    });
  });
  return backend;
}

/** A signed-in admin screen past loading: the admin navigation shown, no loading line left. */
export async function expectSignedInContent(page: Page): Promise<void> {
  await expect(page.getByRole('navigation', { name: messages['admin.nav.label'] })).toBeVisible();
  await expect(page.getByText(messages['admin.common.loading'])).toHaveCount(0);
  await expect(page.getByText(messages['admin.viewer.loading'])).toHaveCount(0);
}
