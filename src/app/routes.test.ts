// @trace NFR-13
import { describe, expect, it } from 'vitest';
import { SEED } from '@/test/fake-admin-backend';
import { PRACTICE } from '@/test/fake-child-backend';
import { ADMIN_ROUTES, CHILD_ROUTES, queryParam, ROUTE_EXAMPLES, ROUTE_PATHS } from './route-paths';
import { routes } from './routes';

describe('route registry', () => {
  it('lists exactly the paths the e2e a11y and theme checks iterate', () => {
    expect(routes.map((r) => r.path)).toEqual([...ROUTE_PATHS]);
  });

  it('marks every /admin path as an admin route', () => {
    expect(ADMIN_ROUTES).toEqual(ROUTE_PATHS.filter((p) => p.startsWith('/admin')));
    expect(ADMIN_ROUTES).toContain('/admin/tasks/edit');
  });

  it('marks every other path as a child route', () => {
    expect(CHILD_ROUTES).toEqual(['/', '/mission', '/task', '/summary']);
  });

  it('example queries name ids of the fake backend seeds, so the checks reach content', () => {
    const ids = new Set<string>([...Object.values(SEED), ...Object.values(PRACTICE)]);
    for (const query of Object.values(ROUTE_EXAMPLES)) {
      const params = new URLSearchParams(query);
      for (const key of ['taskId', 'sourceId', 'missionId']) if (params.has(key)) expect(ids.has(params.get(key) as string)).toBe(true);
    }
  });

  it('reads a query parameter of the current URL', () => {
    window.history.pushState({}, '', '/admin/tasks/edit?taskId=abc&page=3');
    expect(queryParam('taskId')).toBe('abc');
    expect(queryParam('missing')).toBeNull();
    window.history.pushState({}, '', '/');
  });
});
