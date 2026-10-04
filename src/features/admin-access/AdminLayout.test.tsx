// @trace NFR-9
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { messages } from '@/i18n';
import { stubSignedInAdmin } from '@/test/admin-backend';
import { renderAt } from '@/test/render';
import { AdminArea } from './AdminArea';
import { AdminLayout } from './AdminLayout';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('admin layout', () => {
  it('shows the screen title and English navigation to every authoring area', async () => {
    stubSignedInAdmin();
    renderAt(
      <AdminArea>
        <AdminLayout title={messages['admin.tasks.title']}>
          <p>content</p>
        </AdminLayout>
      </AdminArea>,
      '/admin/tasks',
    );
    expect(await screen.findByRole('heading', { level: 1, name: messages['admin.tasks.title'] })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: messages['admin.nav.label'] });
    expect(nav.closest('[lang]')).toHaveAttribute('lang', 'en');
    const link = (name: string) => screen.getByRole('link', { name });
    expect(link(messages['admin.nav.home'])).toHaveAttribute('href', '/admin');
    expect(link(messages['admin.nav.tasks'])).toHaveAttribute('href', '/admin/tasks');
    expect(link(messages['admin.nav.tasks'])).toHaveAttribute('aria-current', 'page');
    expect(link(messages['admin.nav.newTask'])).toHaveAttribute('href', '/admin/tasks/edit');
    expect(link(messages['admin.nav.sources'])).toHaveAttribute('href', '/admin/sources');
    expect(link(messages['admin.nav.sources'])).not.toHaveAttribute('aria-current');
  });

  it('signs out from any admin screen', async () => {
    const backend = stubSignedInAdmin();
    renderAt(
      <AdminArea>
        <AdminLayout title={messages['admin.sources.title']}>
          <p>content</p>
        </AdminLayout>
      </AdminArea>,
      '/admin/sources',
    );
    await userEvent.click(await screen.findByRole('button', { name: messages['admin.home.signOut'] }));
    expect(await screen.findByRole('heading', { level: 1, name: messages['admin.signIn.title'] })).toBeInTheDocument();
    expect(backend.signedIn).toBe(false);
  });

  it('the admin home links to the authoring areas', async () => {
    stubSignedInAdmin();
    renderAt(<AdminArea />, '/admin');
    expect(await screen.findByRole('heading', { level: 1, name: messages['admin.home.title'] })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: messages['admin.nav.home'] })).toHaveAttribute('aria-current', 'page');
  });
});

describe('sign-out forgets admin data (review F12)', () => {
  it('drops cached admin answers but keeps the session flag', async () => {
    const { QueryClient } = await import('@tanstack/react-query');
    const { endAdminSession, ADMIN_SESSION_KEY } = await import('./session');
    const client = new QueryClient();
    client.setQueryData(['admin', 'task', 'x'], { prompt: 'p' });
    client.setQueryData(['other'], 1);
    endAdminSession(client);
    expect(client.getQueryData(['admin', 'task', 'x'])).toBeUndefined();
    expect(client.getQueryData(['other'])).toBe(1);
    expect(client.getQueryData(ADMIN_SESSION_KEY)).toBe(false);
  });
});
