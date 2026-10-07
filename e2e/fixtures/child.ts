import { expect, type Page } from '@playwright/test';
import { messages } from '../../src/i18n/messages';
import { createFakeBackend, prepareChildScreen, type FakeBackend } from '../../src/test/fake-child-backend';

/**
 * Answers `/api/**` from the shared fake backend with the child API (`src/test/fake-child-backend.ts`)
 * and its self-authored practice seed. Registered after the fixture's default stub, so it wins. Pass
 * the same backend to a second page or browser context to model "the next day, another browser": the
 * practice state lives in the backend, as on the server. Returns the backend so a spec can read or
 * change its state (it runs in the Playwright process). A request the backend fails (`down`,
 * `practice.dropResponse`) is aborted as a network error. Only for runs without a stack.
 */
export async function childBackend(page: Page, backend: FakeBackend = createFakeBackend()): Promise<FakeBackend> {
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
    return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
  });
  return backend;
}

/** A child screen past loading: its heading shown, no loading line left. */
export async function expectChildContent(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText(messages['child.common.loading'])).toHaveCount(0);
}

/** A fresh stub in the state the route's example query needs (`/summary`: a completed mission). */
export async function screenBackend(path: string): Promise<FakeBackend> {
  const backend = createFakeBackend();
  await prepareChildScreen(backend, path);
  return backend;
}
