/**
 * Every route the app serves. Plain data (no JSX, no aliases) so Playwright specs can import it:
 * the a11y and theme e2e iterate it, and `routes.test.ts` keeps it equal to `routes.tsx`.
 */
export const ROUTE_PATHS = [
  '/',
  '/mission',
  '/task',
  '/summary',
  '/admin',
  '/admin/sources',
  '/admin/sources/view',
  '/admin/sources/edit',
  '/admin/tasks',
  '/admin/tasks/edit',
  '/admin/tasks/preview',
  '/admin/missions',
  '/admin/missions/edit',
] as const;

export type RoutePath = (typeof ROUTE_PATHS)[number];

/**
 * Admin routes behind the session gate: the a11y, theme and `⟦` checks open them signed in against
 * the shared fake admin backend (`src/test/fake-admin-backend.ts`, whose seed the ids below name).
 */
export const ADMIN_ROUTES: readonly RoutePath[] = ROUTE_PATHS.filter((p) => p.startsWith('/admin'));

/**
 * Child routes (no login): the a11y, theme and `⟦` checks open them against the child contract stub
 * (`src/test/fake-child-backend.ts`, whose practice seed the ids below name).
 */
export const CHILD_ROUTES: readonly RoutePath[] = ROUTE_PATHS.filter((p) => !p.startsWith('/admin'));

/** The query that brings a route to its content state for those checks (screens take ids by query). */
export const ROUTE_EXAMPLES: Partial<Record<RoutePath, string>> = {
  '/mission': '?missionId=ffffffff-ffff-4fff-8fff-000000000101',
  '/task': '?missionId=ffffffff-ffff-4fff-8fff-000000000101&taskId=aaaaaaaa-aaaa-4aaa-8aaa-000000000101',
  // The perimeter mission, completed by `prepareChildScreen` before the check opens it.
  '/summary': '?missionId=ffffffff-ffff-4fff-8fff-000000000103',
  '/admin/sources/view': '?sourceId=11111111-1111-4111-8111-111111111111&page=57',
  '/admin/sources/edit': '?sourceId=11111111-1111-4111-8111-111111111111',
  '/admin/tasks/edit': '?taskId=aaaaaaaa-aaaa-4aaa-8aaa-000000000001',
  '/admin/tasks/preview': '?taskId=aaaaaaaa-aaaa-4aaa-8aaa-000000000001',
  '/admin/missions/edit': '?missionId=ffffffff-ffff-4fff-8fff-000000000001',
};

/** The registered path a pathname means: `/index.html` is the root; a trailing slash is ignored. */
export function routePath(pathname: string): string {
  const path = pathname.replace(/\/index\.html$/, '/');
  return path.length > 1 ? path.replace(/\/+$/, '') || '/' : path;
}

/** The current query parameter `name`, or null. Screens read their ids from the query string. */
export function queryParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}
