import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from '@/api/generated/schema';

/** Methods that change nothing; every other admin request carries the CSRF header (NFR-15). */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const SESSION_PATH = '/api/admin/session';

const unauthorizedListeners = new Set<() => void>();

/** The current `XSRF-TOKEN` cookie value; the backend rotates it on sign-in, so it is read per request. */
export function xsrfToken(): string | undefined {
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('XSRF-TOKEN='));
  return cookie ? decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)) : undefined;
}

/**
 * Called whenever an admin request other than sign-in is answered 401: the session is gone (signed
 * out elsewhere, or idle for 8 h), so the UI shows the sign-in form again. Returns the unsubscribe.
 */
export function onAdminUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

const sessionAndCsrf: Middleware = {
  onRequest({ request }) {
    const token = xsrfToken();
    if (!SAFE_METHODS.has(request.method) && token) request.headers.set('X-XSRF-TOKEN', token);
    return request;
  },
  onResponse({ request, response }) {
    const path = new URL(request.url).pathname;
    const signIn = request.method === 'POST' && path === SESSION_PATH;
    if (response.status === 401 && path.startsWith('/api/admin/') && !signIn) unauthorizedListeners.forEach((l) => l());
    return response;
  },
};

/**
 * The admin API client: generated contract types (NFR-12), same origin, the CSRF header on
 * mutations, and 401s reported to [onAdminUnauthorized]. Every admin feature calls the API through it.
 */
export const adminClient = createClient<paths>({
  baseUrl: window.location.origin,
  // Resolved per call, not captured at load, so tests can stub `fetch`.
  fetch: (request) => globalThis.fetch(request),
});
adminClient.use(sessionAndCsrf);
