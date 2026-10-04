import { useQuery } from '@tanstack/react-query';
import type { components, operations } from '@/api/generated/schema';
import { adminClient } from '@/features/admin-access/adminClient';
import { unwrap } from '@/features/admin-access/problem';

type S = components['schemas'];
export type AdminTask = S['AdminTask'];
export type TaskSummary = S['TaskSummary'];
export type TaskFilters = NonNullable<operations['listTasks']['parameters']['query']>;

export const TASKS_KEY = ['admin', 'tasks'] as const;
const taskKey = (taskId: string) => ['admin', 'task', taskId] as const;

export function useTasks(filters: TaskFilters) {
  return useQuery({
    queryKey: [...TASKS_KEY, filters],
    queryFn: async () => unwrap(await adminClient.GET('/api/admin/tasks', { params: { query: filters } })),
  });
}

/** One task with its specs and provenance; disabled without an id. */
export function useTask(taskId: string | null) {
  return useQuery({
    queryKey: taskKey(taskId as string),
    queryFn: async () => unwrap(await adminClient.GET('/api/admin/tasks/{taskId}', { params: { path: { taskId: taskId as string } } })),
    enabled: !!taskId,
  });
}

/** `createTask` without an id, `updateTask` with one. */
export async function saveTask(taskId: string | null, body: S['TaskInput']): Promise<AdminTask> {
  if (!taskId) return unwrap(await adminClient.POST('/api/admin/tasks', { body }));
  return unwrap(await adminClient.PUT('/api/admin/tasks/{taskId}', { params: { path: { taskId } }, body }));
}

export async function bulkPublish(taskIds: string[]): Promise<S['PublishResult'][]> {
  return unwrap(await adminClient.POST('/api/admin/tasks/publish', { body: { taskIds } }));
}

export async function addImage(taskId: string, file: File): Promise<S['TaskImage']> {
  const form = new FormData();
  form.set('file', file);
  return unwrap(
    await adminClient.POST('/api/admin/tasks/{taskId}/images', {
      params: { path: { taskId } },
      body: {} as { file: string },
      bodySerializer: () => form,
    }),
  );
}

export async function reorderImages(taskId: string, imageIds: string[]): Promise<S['TaskImage'][]> {
  return unwrap(await adminClient.PUT('/api/admin/tasks/{taskId}/images', { params: { path: { taskId } }, body: { imageIds } }));
}

export async function deleteImage(taskId: string, imageId: string): Promise<void> {
  unwrap(await adminClient.DELETE('/api/admin/tasks/{taskId}/images/{imageId}', { params: { path: { taskId, imageId } } }));
}

/** The bytes of a task image (`getAdminImage`). */
export async function fetchImage(taskId: string, imageId: string): Promise<Blob> {
  return unwrap(
    await adminClient.GET('/api/admin/tasks/{taskId}/images/{imageId}', { params: { path: { taskId, imageId } }, parseAs: 'blob' }),
  ) as Blob;
}

/** The task as the child sees it (`previewTask`), with the secondary locale when one is chosen. */
export function usePreview(taskId: string | null, locale: string | null) {
  return useQuery({
    queryKey: ['admin', 'preview', taskId, locale],
    queryFn: async () =>
      unwrap(
        await adminClient.GET('/api/admin/tasks/{taskId}/preview', {
          params: { path: { taskId: taskId as string }, query: locale ? { locale } : {} },
        }),
      ),
    enabled: !!taskId,
    placeholderData: (previous) => previous,
  });
}

/** The answer tester (`testAnswers`): verdicts only, nothing is recorded (FR-10). */
export async function testAnswers(taskId: string, answers: Record<string, string | string[]>): Promise<S['PartResult'][]> {
  return unwrap(await adminClient.POST('/api/admin/tasks/{taskId}/check', { params: { path: { taskId } }, body: { answers } }));
}
