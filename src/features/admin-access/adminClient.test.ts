// Store spec admin-access, CSRF header (NFR-15 is backend-owned in the capability plan, so no @trace here).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminClient, onAdminUnauthorized } from './adminClient';
import { stubAdminBackend } from '@/test/admin-backend';

beforeEach(() => {
  document.cookie = 'XSRF-TOKEN=xsrf-123; path=/';
});

afterEach(() => {
  document.cookie = 'XSRF-TOKEN=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  vi.unstubAllGlobals();
});

describe('adminClient (NFR-15)', () => {
  it('sends the XSRF-TOKEN cookie value as X-XSRF-TOKEN on a data-changing request', async () => {
    const backend = stubAdminBackend();
    backend.signedIn = true;
    await adminClient.DELETE('/api/admin/session');
    expect(backend.seen.at(-1)?.headers.get('X-XSRF-TOKEN')).toBe('xsrf-123');
  });

  it('sends a malformed (not percent-decodable) cookie as it is instead of throwing', async () => {
    document.cookie = 'XSRF-TOKEN=bad%E0%A4%A; path=/';
    const backend = stubAdminBackend();
    backend.signedIn = true;
    await adminClient.DELETE('/api/admin/session');
    expect(backend.seen.at(-1)?.headers.get('X-XSRF-TOKEN')).toBe('bad%E0%A4%A');
  });

  it('sends no CSRF header on a read', async () => {
    const backend = stubAdminBackend();
    await adminClient.GET('/api/admin/session');
    expect(backend.seen.at(-1)?.headers.has('X-XSRF-TOKEN')).toBe(false);
  });

  it('reads the current cookie, not the one at load time', async () => {
    const backend = stubAdminBackend();
    backend.signedIn = true;
    document.cookie = 'XSRF-TOKEN=rotated-456; path=/';
    await adminClient.DELETE('/api/admin/session');
    expect(backend.seen.at(-1)?.headers.get('X-XSRF-TOKEN')).toBe('rotated-456');
  });

  it('reports an admin 401, but not a failed sign-in', async () => {
    stubAdminBackend();
    const listener = vi.fn();
    const stop = onAdminUnauthorized(listener);
    await adminClient.POST('/api/admin/session', { body: { password: 'wrong' } });
    expect(listener).not.toHaveBeenCalled();
    await adminClient.GET('/api/admin/stats');
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    await adminClient.GET('/api/admin/stats');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('posts sign-in as JSON with only the password', async () => {
    const backend = stubAdminBackend();
    await adminClient.POST('/api/admin/session', { body: { password: 'Kocka-na-plote-42' } });
    const request = backend.seen.at(-1);
    expect(request?.headers.get('Content-Type')).toMatch(/^application\/json/);
    expect(JSON.parse(request?.body ?? '')).toEqual({ password: 'Kocka-na-plote-42' });
  });
});

describe('adminClient without a CSRF cookie', () => {
  it('sends no CSRF header when there is no XSRF-TOKEN cookie (the server then refuses with 403)', async () => {
    document.cookie = 'XSRF-TOKEN=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    const backend = stubAdminBackend();
    backend.signedIn = true;
    const { response } = await adminClient.DELETE('/api/admin/session');
    expect(backend.seen.at(-1)?.headers.has('X-XSRF-TOKEN')).toBe(false);
    expect(response.status).toBe(403);
  });
});
