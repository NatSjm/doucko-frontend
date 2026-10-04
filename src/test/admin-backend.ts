import { vi } from 'vitest';

/** A request the stubbed backend saw, with its body read as text. */
export interface SeenRequest {
  method: string;
  path: string;
  headers: Headers;
  body: string;
}

const problem = (status: number, title: string) =>
  new Response(JSON.stringify({ type: 'about:blank', title, status }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });

/**
 * Stubs `fetch` with a tiny admin backend: one password, a session flag, 401 problem+json like the
 * real one. Tests flip `state.signedIn`, set `state.down` to make every request fail as a network
 * error, or `state.failWith` to answer every request with that status.
 */
export function stubAdminBackend(password = 'Kocka-na-plote-42') {
  const state = { signedIn: false, down: false, failWith: null as number | null, seen: [] as SeenRequest[] };
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const path = new URL(request.url).pathname;
    const body = await request.text();
    state.seen.push({ method: request.method, path, headers: request.headers, body });
    if (state.down) throw new TypeError('Failed to fetch');
    if (state.failWith) return problem(state.failWith, 'Server error');
    if (path === '/api/admin/session' && request.method === 'POST') {
      let submitted: unknown;
      try {
        submitted = (JSON.parse(body) as { password?: unknown }).password;
      } catch {
        submitted = undefined;
      }
      if (submitted !== password) return problem(401, 'Invalid credentials');
      state.signedIn = true;
      return new Response(null, { status: 204 });
    }
    if (!state.signedIn) return problem(401, 'Unauthorized');
    if (path === '/api/admin/session' && request.method === 'GET') return new Response(null, { status: 204 });
    if (path === '/api/admin/session' && request.method === 'DELETE') {
      if (request.headers.get('X-XSRF-TOKEN') !== 'xsrf-123') return problem(403, 'Access denied');
      state.signedIn = false;
      return new Response(null, { status: 204 });
    }
    return problem(404, 'Resource not found');
  });
  vi.stubGlobal('fetch', fetch);
  return state;
}
