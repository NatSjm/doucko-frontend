import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Panel } from '@/design-system';
import { ConflictAlert } from '@/features/admin-access/ConflictAlert';
import { DeleteControl } from '@/features/admin-access/DeleteControl';
import { MISSIONS_KEY } from '@/features/missions/api';
import { useDescribeMission } from '@/features/missions/useDescribeMission';
import { useT } from '@/i18n';
import { format } from '@/i18n/format';
import { deleteTask, setTaskStatus, TASKS_KEY, type AdminTask } from './api';

/**
 * A saved task's status and deletion (FR-55): publish or unpublish (`setTaskStatus`), the missions
 * that hold it, and delete after a confirmation. A refusal (a published mission holds the task, or
 * practice records reference it) shows the server's reason and names the missions.
 */
export function TaskStatusPanel({
  task,
  dirty,
  saving,
  onDeleted,
}: {
  task: AdminTask;
  /** The editor's form differs from the stored task: publishing would act on the stored copy. */
  dirty: boolean;
  /** The editor is saving: no status change or delete may race it. */
  saving: boolean;
  onDeleted: () => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const describeMission = useDescribeMission();
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState<'published' | 'unpublished' | null>(null);
  const [busy, setBusy] = useState(false);
  const title = t('admin.taskStatus.title');

  async function changeStatus() {
    setError(null);
    setDone(null);
    const next = task.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    setBusy(true);
    try {
      const result = await setTaskStatus(task.taskId, next);
      queryClient.setQueryData(['admin', 'task', task.taskId], result);
      setDone(next === 'PUBLISHED' ? 'published' : 'unpublished');
      await queryClient.invalidateQueries({ queryKey: TASKS_KEY });
    } catch (e) {
      setError(e);
    }
    setBusy(false);
  }

  async function destroy() {
    setError(null);
    setDone(null);
    setBusy(true);
    try {
      await deleteTask(task.taskId);
      onDeleted();
      queryClient.removeQueries({ queryKey: ['admin', 'task', task.taskId] });
      await queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      await queryClient.invalidateQueries({ queryKey: MISSIONS_KEY });
    } catch (e) {
      setError(e);
    }
    setBusy(false);
  }

  return (
    <Panel title={title} ariaLabel={title}>
      <div className="admin-form">
        <div className="admin-actions">
          <Button disabled={busy || saving || dirty} onClick={() => void changeStatus()}>
            {t(task.status === 'PUBLISHED' ? 'admin.taskStatus.unpublish' : 'admin.taskStatus.publish')}
          </Button>
          {dirty && <span className="admin-muted">{t('admin.taskStatus.saveFirst')}</span>}
        </div>
        {task.missionIds.length ? (
          <div>
            <p>{t('admin.taskStatus.inMissions')}</p>
            <ul>
              {task.missionIds.map((missionId) => {
                const mission = describeMission(missionId);
                return (
                  <li key={missionId}>
                    <a className="admin-link" href={`/admin/missions/edit?missionId=${missionId}`}>
                      {mission?.label ?? format(t('admin.conflict.unknownItem'), { id: missionId })}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p>{t('admin.taskStatus.noMissions')}</p>
        )}
        <ConflictAlert
          error={error}
          describe={(id) => (id === task.taskId ? { label: t('admin.conflict.thisTask'), href: `/admin/tasks/edit?taskId=${id}` } : describeMission(id))}
        />
        {done && (
          <p role="status" className="admin-ok">
            {t(done === 'published' ? 'admin.taskStatus.published' : 'admin.taskStatus.unpublished')}
          </p>
        )}
        {!task.deletable && <p>{t('admin.taskStatus.notDeletable')}</p>}
        <DeleteControl
          label={t('admin.taskStatus.delete')}
          question={t('admin.taskStatus.confirmDelete')}
          disabled={!task.deletable || busy || saving}
          onConfirm={destroy}
        />
      </div>
    </Panel>
  );
}
