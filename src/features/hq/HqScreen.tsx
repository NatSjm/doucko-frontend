import { useId, useRef, useState } from 'react';
import type { components } from '@/api/generated/schema';
import { Link } from '@/app/Link';
import { Chip, Icon, cx, resolveSubject } from '@/design-system';
import { ChildLayout, ChildLoadState } from '@/features/child/ChildLayout';
import { RankPanel } from '@/features/rank/RankPanel';
import { RankUpCelebration } from '@/features/rank/RankUp';
import { useT } from '@/i18n';
import { format } from '@/i18n/format';
import { useHq } from './api';
import './hq.css';

type S = components['schemas'];

const STATE_TONE = { NEW: 'hero', IN_PROGRESS: 'volt', COMPLETE: 'spark' } as const;
/** The HQ API names no subject yet: the design system's default accent colours the cards (identity only, never state). */
const ACCENT = resolveSubject().style;
const STATE_CLASS = { NEW: 'new', IN_PROGRESS: 'in-progress', COMPLETE: 'complete' } as const;

/** One mission of a topic: a link to its briefing with its number, state and progress (FR-25). Never locked (OQ-16). */
function MissionLink({ mission }: { mission: S['MissionCard'] }) {
  const t = useT();
  const segments = Array.from({ length: mission.taskCount }, (_, i) => <span key={i} className={cx('dk-seg', i < mission.resolvedCount ? 'is-on' : null)} />);
  return (
    <li>
      <Link className={cx('dk-mission', `dk-mission-${STATE_CLASS[mission.state]}`, 'hq-mission')} style={ACCENT} href={`/mission?missionId=${mission.missionId}`}>
        <span className="dk-mission-band">
          <span className="dk-mission-icon">
            <Icon name="bolt" size={18} strokeWidth={2.5} />
          </span>
          <span className="dk-mission-power">{format(t('child.hq.mission'), { n: mission.position })}</span>
          <Chip tone={STATE_TONE[mission.state]} icon={mission.state === 'COMPLETE' ? 'check' : undefined}>
            {t(`child.hq.state.${mission.state}` as const)}
          </Chip>
        </span>
        <span className="dk-mission-body">
          <span className="dk-mission-progress">
            <span className="dk-segs" aria-hidden="true">
              {segments}
            </span>
            <span className="dk-mission-count">{format(t('child.hq.progress'), { resolved: mission.resolvedCount, total: mission.taskCount })}</span>
          </span>
        </span>
      </Link>
    </li>
  );
}

/** A topic ("Síla: …") with its published missions in the server's order (position ascending). */
function Topic({ topic }: { topic: S['HqView']['topics'][number] }) {
  const t = useT();
  const id = useId();
  return (
    <section className="hq-topic" aria-labelledby={id}>
      <h2 id={id} className="dk-t-heading">
        {format(t('child.hq.topic'), { name: topic.name })}
      </h2>
      <ul className="hq-missions">
        {topic.missions.map((mission) => (
          <MissionLink key={mission.missionId} mission={mission} />
        ))}
      </ul>
    </section>
  );
}

/**
 * HQ (practice-flow "HQ without login", "Mission list on HQ", "Start or continue within two clicks"):
 * the greeting, "Pokračovat" to the server's continue target (hidden without one, NFR-7), and the
 * published missions by topic; the rank, XP bar and solved tasks (gamification "Progress on HQ"), and
 * a rank-up the child has not seen yet, celebrated once and acknowledged (gamification "Rank-up
 * celebration": outside a session, or a mission-complete screen never shown).
 */
export function HqScreen() {
  const t = useT();
  const hq = useHq();
  const data = hq.isFetchedAfterMount ? hq.data : undefined;
  const [celebrationClosed, setCelebrationClosed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  if (!data)
    return (
      <ChildLayout title={t('app.name')} focusHeading={false}>
        <ChildLoadState error={hq.isError} onRetry={() => void hq.refetch()} />
      </ChildLayout>
    );
  const { displayName, continueTarget, topics, pendingRankUp } = data;
  return (
    <ChildLayout title={format(t('child.hq.greeting'), { name: displayName })} wide>
      {pendingRankUp && !celebrationClosed && (
        <div ref={root}>
          <RankUpCelebration
            rank={pendingRankUp}
            acknowledge
            onClose={() => {
              // Focus would be lost with the closed celebration: the screen's heading takes it.
              const heading = root.current?.closest('main')?.querySelector<HTMLElement>('h1');
              setCelebrationClosed(true);
              heading?.focus();
            }}
          />
        </div>
      )}
      <div className="dk-panel dk-panel-hero hq-hero">
        <RankPanel totalXp={data.totalXp} solvedTasks={data.solvedTasks} rank={data.rank} nextRank={data.nextRank} label={t('child.hq.progressTitle')} />
        <div className="hq-hero-go">
          <p className="hq-intro">{t('child.hq.intro')}</p>
          {continueTarget && (
            <Link className="dk-btn dk-btn-primary dk-btn-lg" href={`/task?missionId=${continueTarget.missionId}&taskId=${continueTarget.taskId}`}>
              {t('child.hq.continue')}
              <Icon name="arrow" size={20} strokeWidth={2.5} />
            </Link>
          )}
        </div>
      </div>
      {topics.length === 0 ? (
        <p className="hq-empty">{t('child.hq.empty')}</p>
      ) : (
        topics.map((topic) => <Topic key={topic.topicId} topic={topic} />)
      )}
    </ChildLayout>
  );
}
