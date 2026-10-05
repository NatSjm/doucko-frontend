import type { ReactElement } from 'react';
import { AdminArea } from '@/features/admin-access/AdminArea';
import { MissionEditorScreen } from '@/features/missions/MissionEditorScreen';
import { MissionListScreen } from '@/features/missions/MissionListScreen';
import { SourceEditScreen } from '@/features/sources/SourceEditScreen';
import { SourcesScreen } from '@/features/sources/SourcesScreen';
import { SourceViewerScreen } from '@/features/sources/SourceViewerScreen';
import { PreviewScreen } from '@/features/tasks/PreviewScreen';
import { TaskEditorScreen } from '@/features/tasks/TaskEditorScreen';
import { TaskListScreen } from '@/features/tasks/TaskListScreen';
import type { RoutePath } from './route-paths';
import { Shell } from './Shell';

/**
 * Route registry. The a11y and theme e2e and the i18n pseudo-catalog test iterate it, so every
 * screen a slice adds must be registered here (and its path in `route-paths.ts`). Routes are full
 * page loads; screens read their ids from the query string (design of implement-authoring-tasks-ui).
 */
export interface AppRoute {
  path: RoutePath;
  element: ReactElement;
}

export const routes: AppRoute[] = [
  { path: '/', element: <Shell /> },
  { path: '/admin', element: <AdminArea /> },
  { path: '/admin/sources', element: <AdminArea><SourcesScreen /></AdminArea> },
  { path: '/admin/sources/view', element: <AdminArea><SourceViewerScreen /></AdminArea> },
  { path: '/admin/sources/edit', element: <AdminArea><SourceEditScreen /></AdminArea> },
  { path: '/admin/tasks', element: <AdminArea><TaskListScreen /></AdminArea> },
  { path: '/admin/tasks/edit', element: <AdminArea><TaskEditorScreen /></AdminArea> },
  { path: '/admin/tasks/preview', element: <AdminArea><PreviewScreen /></AdminArea> },
  { path: '/admin/missions', element: <AdminArea><MissionListScreen /></AdminArea> },
  { path: '/admin/missions/edit', element: <AdminArea><MissionEditorScreen /></AdminArea> },
];
