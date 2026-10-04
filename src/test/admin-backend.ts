import { vi } from 'vitest';
import { createFakeAdminBackend, type FakeAdminBackend } from './fake-admin-backend';

/** A request the stubbed backend saw, with its body read as text. */
export interface SeenRequest {
  method: string;
  path: string;
  search: string;
  headers: Headers;
  body: string;
}

export type StubbedAdminBackend = FakeAdminBackend & { seen: SeenRequest[] };

/**
 * Stubs `fetch` with the shared fake admin backend (`fake-admin-backend.ts`): one password, a
 * session flag, the seed data, and 401/403/4xx problem+json like the real one. Tests flip
 * `signedIn`, set `down` to make every request fail as a network error, `failWith` to answer every
 * request with that status, or `override` for one answer. `seen` lists every request.
 */
export function stubAdminBackend(password = 'Kocka-na-plote-42', options: { signedIn?: boolean; seeded?: boolean } = {}): StubbedAdminBackend {
  const backend = Object.assign(createFakeAdminBackend(options), { seen: [] as SeenRequest[] });
  backend.password = password;
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const body = request.headers.get('Content-Type')?.startsWith('multipart/') ? '' : await request.clone().text();
    backend.seen.push({ method: request.method, path: url.pathname, search: url.search, headers: request.headers, body });
    return backend.handle(request);
  });
  vi.stubGlobal('fetch', fetch);
  return backend;
}

/** A signed-in backend with the seed data and the session cookie the admin client sends. */
export function stubSignedInAdmin(options: { seeded?: boolean } = {}): StubbedAdminBackend {
  document.cookie = 'XSRF-TOKEN=xsrf-123; path=/';
  return stubAdminBackend(undefined, { signedIn: true, ...options });
}
