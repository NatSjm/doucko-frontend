import { queryParam } from '@/app/route-paths';
import { Link } from '@/app/Link';
import { Button, Icon, cx } from '@/design-system';
import { ApiError } from '@/features/admin-access/problem';
import { BackToHq, ChildDeadEnd, ChildLayout, ChildLoadState } from '@/features/child/ChildLayout';
import { useT } from '@/i18n';
import { format } from '@/i18n/format';
import { formatXp } from '@/features/rank/rank';
import { useBriefing } from './api';
import { useReplay } from './useReplay';
import './mission.css';

/**
 * The mission briefing (practice-flow "Start or continue within two clicks"): topic, number,
 * progress, the tasks with their states, and the start button that opens the first unresolved task
 * — the second click from HQ (NFR-7), and the XP still to earn. A complete mission offers its replay
 * ("Zopakovat misi", which also resumes an unfinished replay, FR-33) and its results. An unknown or
 * draft mission answers 404: a friendly dead end.
 */
export function MissionScreen() {
  const t = useT();
  const missionId = queryParam('missionId');
  const briefing = useBriefing(missionId);
  const replay = useReplay(missionId ?? '', () => void briefing.refetch());
  // 404: not served; 400: a mission id that is not a UUID (refused before any lookup).
  const missing = !missionId || (briefing.error instanceof ApiError && [400, 404].includes(briefing.error.status));
  if (missing)
    return (
      <ChildLayout title={t('app.name')} focusHeading={false}>
        <ChildDeadEnd message={t('child.mission.notFound')} />
      </ChildLayout>
    );
  const mission = briefing.isFetchedAfterMount ? briefing.data : undefined;
  if (!mission)
    return (
      <ChildLayout title={t('app.name')} focusHeading={false}>
        <ChildLoadState error={briefing.isError} onRetry={() => void briefing.refetch()} />
      </ChildLayout>
    );
  const resolved = mission.tasks.filter((task) => task.state !== 'UNRESOLVED').length;



  return (
    <ChildLayout
      kicker={format(t('child.hq.topic'), { name: mission.topicName })}
      title={format(t('child.hq.mission'), { n: mission.position })}
      aside={<BackToHq />}
    >
      <section className="dk-card mission-card">
        <p className="dk-t-body-strong">{format(t('child.hq.progress'), { resolved, total: mission.tasks.length })}</p>
        {mission.xpAvailable > 0 && (
          <p className="mission-xp">
            <Icon name="bolt" size={16} strokeWidth={2.5} />
            {format(t('child.mission.xpAvailable'), { xp: formatXp(mission.xpAvailable) })}
          </p>
        )}
        <ol className="mission-tasks" aria-label={t('child.mission.tasks')}>
          {mission.tasks.map((task) => (
            <li key={task.taskId} className={cx('mission-task', task.state !== 'UNRESOLVED' ? 'is-done' : null)}>
              <span className="mission-task-mark" aria-hidden="true">
                <Icon name={task.state === 'UNRESOLVED' ? 'bolt' : task.state === 'REVEALED' ? 'eye' : 'check'} size={16} strokeWidth={2.5} />
              </span>
              <span className="mission-task-name">{format(t('child.mission.task'), { n: task.position })}</span>
              <span className="mission-task-state">{t(`child.mission.taskState.${task.state}` as const)}</span>
            </li>
          ))}
        </ol>
        {mission.state === 'COMPLETE' ? (
          <>
            <p className="mission-complete">{t('child.mission.complete')}</p>
            {replay.failed && <p role="alert">{t('child.mission.replayFailed')}</p>}
            <div className="mission-actions">
              <Button variant="primary" size="lg" icon="retry" disabled={replay.starting} onClick={() => void replay.start()}>
                {t('child.mission.replay')}
              </Button>
              <Link className="dk-btn dk-btn-secondary" href={`/summary?missionId=${mission.missionId}`}>
                {t('child.mission.results')}
              </Link>
            </div>
          </>
        ) : (
          <div>
            <Link className="dk-btn dk-btn-primary dk-btn-lg" href={`/task?missionId=${mission.missionId}`}>
              {t(mission.state === 'NEW' ? 'child.mission.start' : 'child.mission.continue')}
              <Icon name="arrow" size={20} strokeWidth={2.5} />
            </Link>
          </div>
        )}
      </section>
    </ChildLayout>
  );
}
