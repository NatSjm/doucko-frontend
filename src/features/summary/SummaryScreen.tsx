import { navigate } from '@/app/navigation';
import { Link } from '@/app/Link';
import { queryParam } from '@/app/route-paths';
import { Button, Icon } from '@/design-system';
import { ApiError } from '@/features/admin-access/problem';
import { ChildDeadEnd, ChildLayout, ChildLoadState } from '@/features/child/ChildLayout';
import { useReplay } from '@/features/mission/useReplay';
import { formatXp } from '@/features/rank/rank';
import { RankLine } from '@/features/rank/RankPanel';
import { RankUpCelebration } from '@/features/rank/RankUp';
import { useT } from '@/i18n';
import { format } from '@/i18n/format';
import { useSummary } from './api';
import './summary.css';

/** The +XP sticker of the design system (`dk-burst`), with catalog text. */
function XpBurst({ xp }: { xp: number }) {
  const t = useT();
  const star = 'M60 8l10 20 21-10-4 23 23 4-16 17 16 17-23 4 4 23-21-10-10 20-10-20-21 10 4-23-23-4 16-17L10 45l23-4-4-23 21 10z';
  return (
    <div className="dk-burst summary-burst">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <path className="dk-burst-sticker" d={star} />
        <path className="dk-burst-face" d={star} />
      </svg>
      <span className="dk-burst-num">{format(t('child.summary.xp'), { xp: formatXp(xp) })}</span>
      <Icon name="sparkle" size={16} className="dk-burst-s1" />
      <Icon name="sparkle" size={12} className="dk-burst-s2" />
    </div>
  );
}

/**
 * The mission-complete screen (practice-flow "Mission complete screen", FR-32): the XP earned in the
 * run, the tasks solved on the first try, and the rank-up — the celebration while the server still
 * offers it (then acknowledged), or a static line for a rank already celebrated (FR-36). A replay's
 * summary says it earned no XP (FR-33); a first run that earned none (every task resolved in other
 * missions) shows no XP figure at all, never "+0 XP" (FR-38). "Zopakovat misi" starts or resumes a replay.
 */
export function SummaryScreen() {
  const t = useT();
  const missionId = queryParam('missionId');
  const summary = useSummary(missionId);
  // 409: the mission is no longer complete (content changed): its briefing shows where it stands.
  const replay = useReplay(missionId ?? '', () => navigate(`/mission?missionId=${missionId}`));
  const status = summary.error instanceof ApiError ? summary.error.status : null;
  // 404: not served; 400: a mission id that is not a UUID (refused before any lookup).
  if (!missionId || status === 404 || status === 400)
    return (
      <ChildLayout title={t('app.name')} focusHeading={false}>
        <ChildDeadEnd message={t('child.mission.notFound')} />
      </ChildLayout>
    );
  // 409: the mission has no completed run yet.
  if (status === 409)
    return (
      <ChildLayout title={t('app.name')} focusHeading={false}>
        <ChildDeadEnd message={t('child.summary.notComplete')} />
      </ChildLayout>
    );
  const data = summary.isFetchedAfterMount ? summary.data : undefined;
  if (!data)
    return (
      <ChildLayout title={t('app.name')} focusHeading={false}>
        <ChildLoadState error={summary.isError} onRetry={() => void summary.refetch()} />
      </ChildLayout>
    );



  return (
    <ChildLayout title={t(data.replay ? 'child.summary.replayTitle' : 'child.summary.title')}>
      <section className="dk-panel dk-panel-hero summary-hero">
        {!data.replay && data.xpEarned > 0 && <XpBurst xp={data.xpEarned} />}
        <div className="summary-stats">
          <p className="dk-t-body-strong">{format(t(data.replay ? 'child.summary.replayText' : data.xpEarned > 0 ? 'child.summary.xpText' : 'child.summary.noXpText'), { xp: formatXp(data.xpEarned) })}</p>
          <p className="summary-first-try">
            <Icon name="star" size={20} strokeWidth={2.5} />
            <span>{format(t('child.summary.firstTry'), { n: data.firstTryCount })}</span>
          </p>
          <p className="summary-count">{format(t('child.summary.taskCount'), { n: data.taskCount })}</p>
        </div>
      </section>
      {data.rankUp ? <RankUpCelebration rank={data.rankUp} acknowledge /> : data.rankReachedDuringRun && <RankLine rank={data.rankReachedDuringRun} />}
      {replay.failed && (
        <p role="alert" className="summary-alert">
          {t('child.mission.replayFailed')}
        </p>
      )}
      <div className="summary-actions">
        <Link className="dk-btn dk-btn-primary dk-btn-lg" href="/">
          {t('child.common.backToHq')}
        </Link>
        <Button icon="retry" disabled={replay.starting} onClick={() => void replay.start()}>
          {t('child.mission.replay')}
        </Button>
      </div>
    </ChildLayout>
  );
}
