import type { components } from '@/api/generated/schema';
import { childClient } from '@/features/child/childClient';
import { unwrap } from '@/features/admin-access/problem';

type S = components['schemas'];
export type ChildTask = S['TaskView'];
export type AttemptResult = S['AttemptResult'];
export type Answers = Record<string, string | string[]>;
export type ReportReason = S['ReportReason'];
export type ProfileSettings = S['ProfileSettings'];

/** The task to continue with (`getCurrentTask`), or null when every task of the run is resolved (204). */
export async function fetchCurrentTask(missionId: string): Promise<ChildTask | null> {
  const result = await childClient.GET('/api/child/missions/{missionId}/current-task', { params: { path: { missionId } } });
  if (result.response.status === 204) return null;
  return unwrap(result);
}

/** One task of the mission's current run (`getTask`); 404 when it is not served there. */
export async function fetchTask(missionId: string, taskId: string): Promise<ChildTask> {
  return unwrap(await childClient.GET('/api/child/missions/{missionId}/tasks/{taskId}', { params: { path: { missionId, taskId } } }));
}

/** Submits the parts that are not locked (`submitAttempt`); UNPARSEABLE is a 200 that costs nothing. */
export async function submitAttempt(missionId: string, taskId: string, answers: Answers): Promise<AttemptResult> {
  return unwrap(await childClient.POST('/api/child/missions/{missionId}/tasks/{taskId}/attempts', { params: { path: { missionId, taskId } }, body: { answers } }));
}

/** Opens the next hint (`openNextHint`); 409 when none is left. */
export async function openNextHint(missionId: string, taskId: string): Promise<S['OpenedHint']> {
  return unwrap(await childClient.POST('/api/child/missions/{missionId}/tasks/{taskId}/hints', { params: { path: { missionId, taskId } } }));
}

/** Reports a problem (`reportProblem`); the server attaches the latest raw attempt. */
export async function reportProblem(missionId: string, taskId: string, reason: ReportReason, note: string): Promise<void> {
  const body = note.trim() ? { reason, note } : { reason };
  unwrap(await childClient.POST('/api/child/missions/{missionId}/tasks/{taskId}/reports', { params: { path: { missionId, taskId } }, body }));
}

/** Turns the task translation on (`'uk'`) or off (`null`) in the profile (`updateProfileSettings`). */
export async function saveTranslation(locale: string | null): Promise<ProfileSettings> {
  return unwrap(await childClient.PATCH('/api/child/profile/settings', { body: { secondaryTaskLocale: locale } }));
}
