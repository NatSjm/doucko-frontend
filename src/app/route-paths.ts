/**
 * Every route the app serves. Plain data (no JSX, no aliases) so Playwright specs can import it:
 * the a11y and theme e2e iterate it, and `routes.test.ts` keeps it equal to `routes.tsx`.
 */
export const ROUTE_PATHS = ['/'] as const;
