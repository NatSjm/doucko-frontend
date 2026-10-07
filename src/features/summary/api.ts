import { useQuery } from '@tanstack/react-query';
import type { components } from '@/api/generated/schema';
import { childClient } from '@/features/child/childClient';
import { unwrap } from '@/features/admin-access/problem';

export type MissionSummary = components['schemas']['MissionSummary'];

/** The summary of the mission's latest completed run (`getMissionSummary`); 409 while none is complete. */
export function useSummary(missionId: string | null) {
  return useQuery({
    queryKey: ['child', 'summary', missionId as string],
    queryFn: async () => unwrap(await childClient.GET('/api/child/missions/{missionId}/summary', { params: { path: { missionId: missionId as string } } })),
    enabled: !!missionId,
    // Read afresh on every visit: the rank-up it carries clears once acknowledged.
    gcTime: 0,
    retry: false,
  });
}
