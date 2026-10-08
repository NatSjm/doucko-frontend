// @trace NFR-6
// @trace NFR-9
// Real stack (Phase 5): admin-access sign-in and sign-out through nginx and the backend's session
// (store spec admin-access). The password is the fake committed one of the isolated e2e stack.
import { messages as m } from '../../src/i18n/messages';
import { ADMIN_PASSWORD, expect, signInUi, test } from './support';

const signInHeading = m['admin.signIn.title'];

test('a wrong password is refused by the backend and the form stays', async ({ page }) => {
  await signInUi(page, `${ADMIN_PASSWORD}-wrong`);
  await expect(page.getByRole('alert')).toHaveText(m['admin.signIn.invalid']);
  await expect(page.getByRole('heading', { level: 1, name: signInHeading })).toBeVisible();
  expect((await page.request.get('/api/admin/session')).status()).toBe(401);
});

test('sign in, the session survives a reload, sign out ends it on the server', async ({ page }) => {
  await signInUi(page);
  const home = page.getByRole('heading', { level: 1, name: m['admin.home.title'], exact: true });
  await expect(home).toBeVisible();
  await page.reload();
  await expect(home).toBeVisible();
  expect((await page.request.get('/api/admin/session')).status()).toBe(204);
  await page.getByRole('button', { name: m['admin.home.signOut'] }).click();
  await expect(page.getByRole('heading', { level: 1, name: signInHeading })).toBeVisible();
  expect((await page.request.get('/api/admin/session')).status()).toBe(401);
  // Without the session the admin API refuses reads too (backend-owned NFR-1, seen through nginx).
  expect((await page.request.get('/api/admin/tasks')).status()).toBe(401);
  await page.goto('/admin/tasks');
  await expect(page.getByRole('heading', { level: 1, name: signInHeading })).toBeVisible();
});
