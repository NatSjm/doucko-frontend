import { useQuery } from '@tanstack/react-query';
import type { components } from '@/api/generated/schema';
import { childClient } from '@/features/child/childClient';
import { unwrap } from '@/features/admin-access/problem';

export type MissionBriefing = components['schemas']['MissionBriefing'];

/**
 * Starts a replay of a completed mission, or returns its unfinished replay run unchanged
 * (`startReplay`, FR-33): the first unresolved task of that run. 409 when the mission is not complete.
 */
export async function startReplay(missionId: string): Promise<components['schemas']['TaskView']> {
  return unwrap(await childClient.POST('/api/child/missions/{missionId}/replay', { params: { path: { missionId } } }));
}

/** The mission briefing (`getMissionBriefing`); disabled without an id. Unknown or draft → ApiError 404. */
export function useBriefing(missionId: string | null) {
  return useQuery({
    queryKey: ['child', 'mission', missionId as string],
    queryFn: async () => unwrap(await childClient.GET('/api/child/missions/{missionId}', { params: { path: { missionId: missionId as string } } })),
    enabled: !!missionId,
    // Read afresh on every visit, never a cached copy: task states change with every answer.
    gcTime: 0,
    retry: false,
  });
}
