import { ROUTE_PATHS } from '../src/app/route-paths';

/**
 * Every screen the app serves, with the marker that proves it rendered: each registered route, and
 * the not-found screen any other path gets. The a11y and theme e2e iterate this list.
 */
export const SCREENS = [
  ...ROUTE_PATHS.map((path) => ({ name: path, path, marker: `[data-route="${path}"]` })),
  { name: 'not found', path: '/no-such-screen', marker: '[data-route="not-found"]' },
];
