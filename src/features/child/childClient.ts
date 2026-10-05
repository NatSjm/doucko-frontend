import createClient from 'openapi-fetch';
import type { paths } from '@/api/generated/schema';

/**
 * The child API client: generated contract types (NFR-12), same origin, no credentials (the child
 * side has no login, practice-flow "HQ without login"). Every child feature calls the API through it.
 */
export const childClient = createClient<paths>({
  baseUrl: window.location.origin,
  // Resolved per call, not captured at load, so tests can stub `fetch`.
  fetch: (request) => globalThis.fetch(request),
});
