// @trace NFR-1
// @trace NFR-15
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, messages } from '@/i18n';
import { AdminArea } from './AdminArea';
import { adminClient } from './adminClient';
import { stubAdminBackend } from '@/test/admin-backend';

const PASSWORD = 'Kocka-na-plote-42';

function renderArea() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AdminArea />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

const signInHeading = () => screen.findByRole('heading', { level: 1, name: messages['admin.signIn.title'] });
const passwordField = () => screen.getByLabelText(messages['admin.signIn.password']);
const submit = () => screen.getByRole('button', { name: messages['admin.signIn.submit'] });

beforeEach(() => {
  document.cookie = 'XSRF-TOKEN=xsrf-123; path=/';
});

afterEach(() => {
  document.cookie = 'XSRF-TOKEN=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  vi.unstubAllGlobals();
});

describe('admin area without a session', () => {
  it('shows the English sign-in form with a single password field', async () => {
    stubAdminBackend();
    const { container } = renderArea();
    await signInHeading();
    expect(container.querySelector('[lang="en"]')).not.toBeNull();
    const fields = container.querySelectorAll('input');
    expect(fields).toHaveLength(1);
    expect(fields[0]).toHaveAttribute('type', 'password');
    expect(fields[0]).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.queryByRole('heading', { name: messages['admin.home.title'] })).toBeNull();
  });

  it('a wrong password shows an alert and keeps the form', async () => {
    stubAdminBackend();
    renderArea();
    await signInHeading();
    await userEvent.type(passwordField(), 'Kocka-na-plote-43{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(messages['admin.signIn.invalid']);
    expect(passwordField()).toHaveValue('');
    expect(passwordField()).toHaveFocus();
  });

  it('the right password, submitted with Enter, opens the admin home', async () => {
    const backend = stubAdminBackend();
    renderArea();
    await signInHeading();
    await userEvent.type(passwordField(), `${PASSWORD}{Enter}`);
    expect(await screen.findByRole('heading', { level: 1, name: messages['admin.home.title'] })).toBeInTheDocument();
    const post = backend.seen.find((r) => r.method === 'POST');
    expect(JSON.parse(post?.body ?? '')).toEqual({ password: PASSWORD });
  });

  it('the submit button signs in too', async () => {
    stubAdminBackend();
    renderArea();
    await signInHeading();
    await userEvent.type(passwordField(), PASSWORD);
    await userEvent.click(submit());
    expect(await screen.findByRole('heading', { level: 1, name: messages['admin.home.title'] })).toBeInTheDocument();
  });

  it('a server error on sign-in says so without claiming a wrong password', async () => {
    const backend = stubAdminBackend();
    renderArea();
    await signInHeading();
    backend.down = true;
    await userEvent.type(passwordField(), `${PASSWORD}{Enter}`);
    expect(await screen.findByRole('alert')).toHaveTextContent(messages['admin.signIn.failed']);
  });
});

describe('admin area with a session', () => {
  it('shows the admin home directly', async () => {
    const backend = stubAdminBackend();
    backend.signedIn = true;
    renderArea();
    expect(await screen.findByRole('heading', { level: 1, name: messages['admin.home.title'] })).toBeInTheDocument();
  });

  it('sign-out sends the CSRF header and returns to the sign-in form', async () => {
    const backend = stubAdminBackend();
    backend.signedIn = true;
    renderArea();
    await userEvent.click(await screen.findByRole('button', { name: messages['admin.home.signOut'] }));
    await signInHeading();
    const del = backend.seen.find((r) => r.method === 'DELETE');
    expect(del?.headers.get('X-XSRF-TOKEN')).toBe('xsrf-123');
    expect(backend.signedIn).toBe(false);
  });

  it('a later admin 401 (idle expiry) brings back the sign-in form', async () => {
    const backend = stubAdminBackend();
    backend.signedIn = true;
    renderArea();
    await screen.findByRole('heading', { level: 1, name: messages['admin.home.title'] });
    backend.signedIn = false;
    await act(async () => {
      await adminClient.GET('/api/admin/stats');
    });
    await signInHeading();
  });
});

describe('admin area when the server cannot be reached', () => {
  it('says so and retries on request', async () => {
    const backend = stubAdminBackend();
    backend.down = true;
    renderArea();
    expect(await screen.findByRole('alert')).toHaveTextContent(messages['admin.session.unreachable']);
    backend.down = false;
    await userEvent.click(screen.getByRole('button', { name: messages['admin.session.retry'] }));
    await signInHeading();
  });
});

describe('unexpected answers from the backend', () => {
  it('a 500 on the session check offers a retry', async () => {
    const backend = stubAdminBackend();
    backend.failWith = 500;
    renderArea();
    expect(await screen.findByRole('alert')).toHaveTextContent(messages['admin.session.unreachable']);
  });

  it('a 500 on sign-in is a failure, not a wrong password', async () => {
    const backend = stubAdminBackend();
    renderArea();
    await signInHeading();
    backend.failWith = 500;
    await userEvent.type(passwordField(), `${PASSWORD}{Enter}`);
    expect(await screen.findByRole('alert')).toHaveTextContent(messages['admin.signIn.failed']);
    expect(passwordField()).toHaveValue(PASSWORD);
  });

  it('a failed sign-out keeps the admin home and says the server could not be reached', async () => {
    const backend = stubAdminBackend();
    backend.signedIn = true;
    renderArea();
    const signOutButton = await screen.findByRole('button', { name: messages['admin.home.signOut'] });
    backend.failWith = 500;
    await userEvent.click(signOutButton);
    expect(await screen.findByRole('alert')).toHaveTextContent(messages['admin.session.unreachable']);
    expect(screen.getByRole('heading', { level: 1, name: messages['admin.home.title'] })).toBeInTheDocument();
  });

  it('a sign-out answered 401 (session already ended) shows the sign-in form', async () => {
    const backend = stubAdminBackend();
    backend.signedIn = true;
    renderArea();
    const signOutButton = await screen.findByRole('button', { name: messages['admin.home.signOut'] });
    backend.signedIn = false;
    await userEvent.click(signOutButton);
    await signInHeading();
  });
});
