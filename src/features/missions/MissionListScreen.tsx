import { Chip } from '@/design-system';
import { AdminLayout, LoadState } from '@/features/admin-access/AdminLayout';
import { useReference } from '@/features/sources/api';
import { useT } from '@/i18n';
import { format } from '@/i18n/format';
import { useMissions } from './api';
import './missions.css';

/** Route `/admin/missions`: every mission by topic and position, with its counter and status (FR-9). */
export function MissionListScreen() {
  const t = useT();
  const reference = useReference();
  const missions = useMissions();
  const title = t('admin.missions.title');

  if (!reference.data || !missions.data)
    return (
      <AdminLayout title={title}>
        <LoadState
          error={reference.isError || missions.isError}
          onRetry={() => {
            void reference.refetch();
            void missions.refetch();
          }}
        />
      </AdminLayout>
    );

  const topicName = new Map(reference.data.topics.map((tp) => [tp.topicId, tp.name]));
  const name = (topicId: string) => topicName.get(topicId) ?? '';
  const sorted = [...missions.data].sort((a, b) => name(a.topicId).localeCompare(name(b.topicId), 'cs') || a.position - b.position);

  return (
    <AdminLayout title={title}>
      <div className="admin-actions">
        <a className="admin-link" href="/admin/missions/edit">
          {t('admin.missions.new')}
        </a>
      </div>
      {!sorted.length ? (
        <p>{t('admin.missions.empty')}</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">{t('admin.missions.colTopic')}</th>
                <th scope="col">{t('admin.missions.colPosition')}</th>
                <th scope="col">{t('admin.missions.colTasks')}</th>
                <th scope="col">{t('admin.missions.colStatus')}</th>
                <th scope="col">{t('admin.missions.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((mission) => (
                <tr key={mission.missionId}>
                  <td data-content>{name(mission.topicId)}</td>
                  <td className="admin-numeric">{mission.position}</td>
                  <td className="admin-numeric">{format(t('admin.missions.counter'), { count: mission.taskIds.length })}</td>
                  <td>
                    <Chip tone={mission.status === 'PUBLISHED' ? 'spark' : 'neutral'}>{t(`admin.status.${mission.status}` as const)}</Chip>
                  </td>
                  <td>
                    <a className="admin-link" href={`/admin/missions/edit?missionId=${mission.missionId}`}>
                      {t('admin.missions.edit')}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
