import type { Blocker } from '@/features/admin-access/ConflictAlert';
import { useReference } from '@/features/sources/api';
import { useMissions } from './api';
import { MissionLabel } from './MissionLabel';

/** Names a mission by topic and position, linked to its editor (missions have no name, CA-D17). */
export function useDescribeMission(): (missionId: string) => Blocker | null {
  const missions = useMissions();
  const reference = useReference();
  return (missionId) => {
    const mission = missions.data?.find((m) => m.missionId === missionId);
    if (!mission) return null;
    const topicName = reference.data?.topics.find((tp) => tp.topicId === mission.topicId)?.name;
    return { label: <MissionLabel topicName={topicName} position={mission.position} />, href: `/admin/missions/edit?missionId=${missionId}` };
  };
}
