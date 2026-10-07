import type { ReactElement } from 'react';
import { AdminArea } from '@/features/admin-access/AdminArea';
import { HqScreen } from '@/features/hq/HqScreen';
import { MissionScreen } from '@/features/mission/MissionScreen';
import { MissionEditorScreen } from '@/features/missions/MissionEditorScreen';
import { MissionListScreen } from '@/features/missions/MissionListScreen';
import { SourceEditScreen } from '@/features/sources/SourceEditScreen';
import { SourcesScreen } from '@/features/sources/SourcesScreen';
import { SourceViewerScreen } from '@/features/sources/SourceViewerScreen';
import { SummaryScreen } from '@/features/summary/SummaryScreen';
import { TaskScreen } from '@/features/task/TaskScreen';
import { PreviewScreen } from '@/features/tasks/PreviewScreen';
import { TaskEditorScreen } from '@/features/tasks/TaskEditorScreen';
import { TaskListScreen } from '@/features/tasks/TaskListScreen';
import type { RoutePath } from './route-paths';

/**
 * Route registry. The a11y and theme e2e and the i18n pseudo-catalog test iterate it, so every
 * screen a slice adds must be registered here (and its path in `route-paths.ts`). Screens read their
 * ids from the query string. Child screens move between each other without a page load
 * (`navigate`); admin screens use full page loads (design of implement-authoring-tasks-ui).
 */
export interface AppRoute {
  path: RoutePath;
  element: ReactElement;
}

export const routes: AppRoute[] = [
  { path: '/', element: <HqScreen /> },
  { path: '/mission', element: <MissionScreen /> },
  { path: '/task', element: <TaskScreen /> },
  { path: '/summary', element: <SummaryScreen /> },
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
