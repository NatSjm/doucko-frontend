// @trace NFR-1
// @trace NFR-15
// @trace NFR-6
import type { Page } from '@playwright/test';
import { messages } from '../src/i18n/messages';
import { AGAINST_STACK, expect, test } from './fixtures/test';

/** Example password from the admin-access spec; only the stubbed backend below knows it. */
const PASSWORD = 'Kocka-na-plote-42';

/** A stateful stand-in for the session endpoints (vite preview has no backend). */
async function stubSessionBackend(page: Page) {
  const state = { signedIn: false, signOutToken: null as string | null };
  await page.route('**/api/admin/session', async (route) => {
    const request = route.request();
    const problem = (status: number, title: string) =>
      route.fulfill({ status, contentType: 'application/problem+json', body: JSON.stringify({ title, status }) });
    if (request.method() === 'POST') {
      if ((request.postDataJSON() as { password?: string } | null)?.password !== PASSWORD) return problem(401, 'Invalid credentials');
      state.signedIn = true;
      return route.fulfill({ status: 204, headers: { 'Set-Cookie': 'XSRF-TOKEN=e2e-token; Path=/; SameSite=Strict' } });
    }
    if (!state.signedIn) return problem(401, 'Unauthorized');
    if (request.method() === 'DELETE') {
      state.signOutToken = request.headers()['x-xsrf-token'] ?? null;
      state.signedIn = false;
    }
    return route.fulfill({ status: 204 });
  });
  return state;
}

const signInHeading = (page: Page) => page.getByRole('heading', { level: 1, name: messages['admin.signIn.title'] });
const homeHeading = (page: Page) => page.getByRole('heading', { level: 1, name: messages['admin.home.title'], exact: true });

test('without a session /admin shows the English sign-in form with one password field', async ({ page }) => {
  await page.goto('/admin');
  await expect(signInHeading(page)).toBeVisible();
  await expect(page.locator('[data-route="/admin"] [lang="en"]')).toBeAttached();
  await expect(page.locator('[data-route="/admin"] input')).toHaveCount(1);
  await expect(page.getByLabel(messages['admin.signIn.password'])).toHaveAttribute('type', 'password');
  await expect(homeHeading(page)).toHaveCount(0);
});

test.describe('with the stubbed session backend', () => {
  test.skip(AGAINST_STACK, 'needs a known password; the stack smoke covers the real backend');

  test('a wrong password is announced and the form stays', async ({ page }) => {
    await stubSessionBackend(page);
    await page.goto('/admin');
    await page.getByLabel(messages['admin.signIn.password']).fill('Kocka-na-plote-43');
    await page.getByRole('button', { name: messages['admin.signIn.submit'] }).click();
    await expect(page.getByRole('alert')).toHaveText(messages['admin.signIn.invalid']);
    await expect(signInHeading(page)).toBeVisible();
  });

  test('keyboard only: Tab to the field, type, Enter signs in; sign-out returns to the form', async ({ page }) => {
    const backend = await stubSessionBackend(page);
    await page.goto('/admin');
    await expect(signInHeading(page)).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel(messages['admin.signIn.password'])).toBeFocused();
    await page.keyboard.type(PASSWORD);
    await page.keyboard.press('Enter');
    await expect(homeHeading(page)).toBeVisible();
    await page.getByRole('button', { name: messages['admin.home.signOut'] }).click();
    await expect(signInHeading(page)).toBeVisible();
    expect(backend.signOutToken).toBe('e2e-token');
  });
});
