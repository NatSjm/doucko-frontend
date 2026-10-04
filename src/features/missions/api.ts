import { useQuery } from '@tanstack/react-query';
import type { components } from '@/api/generated/schema';
import { adminClient } from '@/features/admin-access/adminClient';
import { unwrap } from '@/features/admin-access/problem';

type S = components['schemas'];
export type AdminMission = S['AdminMission'];
export type MissionInput = S['MissionInput'];
export type PublishStatus = S['PublishStatus'];

export const MISSIONS_KEY = ['admin', 'missions'] as const;
export const missionKey = (missionId: string) => ['admin', 'mission', missionId] as const;

/** Every mission (`listMissions`). */
export function useMissions() {
  return useQuery({ queryKey: MISSIONS_KEY, queryFn: async () => unwrap(await adminClient.GET('/api/admin/missions')) });
}

/** One mission; disabled without an id. An unknown id is an ApiError with status 404. */
export function useMission(missionId: string | null) {
  return useQuery({
    queryKey: missionKey(missionId as string),
    queryFn: async () => unwrap(await adminClient.GET('/api/admin/missions/{missionId}', { params: { path: { missionId: missionId as string } } })),
    enabled: !!missionId,
  });
}

/** `createMission` without an id (a new mission is DRAFT), `updateMission` with one. */
export async function saveMission(missionId: string | null, body: MissionInput): Promise<AdminMission> {
  if (!missionId) return unwrap(await adminClient.POST('/api/admin/missions', { body }));
  return unwrap(await adminClient.PUT('/api/admin/missions/{missionId}', { params: { path: { missionId } }, body }));
}

/** Publish or unpublish (`setMissionStatus`); 409 when a task is not a published text task (FR-57). */
export async function setMissionStatus(missionId: string, status: PublishStatus): Promise<AdminMission> {
  return unwrap(await adminClient.PUT('/api/admin/missions/{missionId}/status', { params: { path: { missionId } }, body: { status } }));
}

/** `deleteMission`; 409 when practice records reference one of its tasks (FR-56, CA-D22). */
export async function deleteMission(missionId: string): Promise<void> {
  unwrap(await adminClient.DELETE('/api/admin/missions/{missionId}', { params: { path: { missionId } } }));
}
