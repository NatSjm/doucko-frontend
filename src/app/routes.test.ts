// @trace NFR-13
import { describe, expect, it } from 'vitest';
import { ROUTE_PATHS } from './route-paths';
import { routes } from './routes';

describe('route registry', () => {
  it('lists exactly the paths the e2e a11y and theme checks iterate', () => {
    expect(routes.map((r) => r.path)).toEqual([...ROUTE_PATHS]);
  });
});
