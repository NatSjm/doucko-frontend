import { ADMIN_ROUTES, CHILD_ROUTES, ROUTE_EXAMPLES, ROUTE_PATHS } from '../src/app/route-paths';

/**
 * Every screen the app serves, with the marker that proves it rendered: each registered route (with
 * its example query, so a screen that takes an id shows content), and the not-found screen any
 * other path gets. Admin screens are opened signed in (`admin: true`) and child screens with the
 * child contract stub and its practice seed (`child: true`) when no stack runs, so the a11y and theme
 * e2e check the real screens, not the sign-in form or a load error. The a11y and theme e2e iterate it.
 */
export const SCREENS = [
  ...ROUTE_PATHS.map((path) => ({
    name: path,
    path: path + (ROUTE_EXAMPLES[path] ?? ''),
    marker: `[data-route="${path}"]`,
    admin: ADMIN_ROUTES.includes(path),
    child: CHILD_ROUTES.includes(path),
  })),
  { name: 'not found', path: '/no-such-screen', marker: '[data-route="not-found"]', admin: false, child: false },
];
