/**
 * Every route the app serves. Plain data (no JSX, no aliases) so Playwright specs can import it:
 * the a11y and theme e2e iterate it, and `routes.test.ts` keeps it equal to `routes.tsx`.
 */
export const ROUTE_PATHS = ['/'] as const;

/** The registered path a pathname means: `/index.html` is the root; a trailing slash is ignored. */
export function routePath(pathname: string): string {
  const path = pathname.replace(/\/index\.html$/, '/');
  return path.length > 1 ? path.replace(/\/+$/, '') || '/' : path;
}
