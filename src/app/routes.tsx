import type { ReactElement } from 'react';
import { ROUTE_PATHS } from './route-paths';
import { Shell } from './Shell';

/**
 * Route registry. The a11y and theme e2e and the i18n pseudo-catalog test iterate it, so every
 * screen a slice adds must be registered here (and its path in `route-paths.ts`). The first slice
 * with a second route (admin-access) wires these into the chosen router.
 */
export interface AppRoute {
  path: (typeof ROUTE_PATHS)[number];
  element: ReactElement;
}

export const routes: AppRoute[] = [{ path: '/', element: <Shell /> }];
