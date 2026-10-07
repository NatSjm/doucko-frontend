import { Icon, RankBadge } from '@/design-system';
import { useT } from '@/i18n';
import { format } from '@/i18n/format';
import type { Rank } from './api';
import { formatXp, xpProgress } from './rank';
import './rank.css';

/**
 * HQ's progress (gamification "Progress on HQ", FR-37): the rank medal, "Hodnost {n}" and the rank
 * name, the total XP, the bar towards the next rank, and the solved tasks — exactly as the server's
 * HQ view holds them. At the top rank the bar is full and says so, with no next target.
 */
export function RankPanel({ totalXp, solvedTasks, rank, nextRank, label }: { totalXp: number; solvedTasks: number; rank: Rank; nextRank: Rank | null; label: string }) {
  const t = useT();
  const bar = xpProgress({ totalXp, rank, nextRank });
  const value = bar.top ? t('child.hq.topRank') : format(t('child.hq.xpValue'), { have: formatXp(bar.have), need: formatXp(bar.need) });
  return (
    <section className="dk-panel rank-panel" aria-label={label}>
      <RankBadge rank={rank.name} level={rank.index + 1} size="md" hideName />
      <div className="rank-panel-main">
        <div className="rank-panel-row">
          <div>
            <p className="dk-kicker">{format(t('child.hq.rank'), { n: rank.index + 1 })}</p>
            <p className="dk-rank-name" data-content>
              {rank.name}
            </p>
          </div>
          <span className="dk-xp-total">{format(t('child.hq.xpTotal'), { xp: formatXp(totalXp) })}</span>
        </div>
        <div className="dk-xp">
          <span className="dk-xp-bolt" aria-hidden="true">
            <Icon name="bolt" size={22} strokeWidth={2.5} />
          </span>
          <div className="dk-xp-main">
            <div
              className="dk-xp-track"
              role="progressbar"
              aria-label={t('child.hq.xpBar')}
              aria-valuemin={0}
              aria-valuemax={bar.need}
              aria-valuenow={bar.have}
              aria-valuetext={value}
            >
              <div className="dk-xp-fill" style={{ width: `${bar.percent}%` }} />
            </div>
            <p className="dk-xp-next">
              {nextRank ? format(t('child.hq.xpToNext'), { have: formatXp(bar.have), need: formatXp(bar.need), rank: nextRank.name }) : t('child.hq.topRank')}
            </p>
          </div>
        </div>
        <p className="rank-panel-solved">{format(t('child.hq.solved'), { n: formatXp(solvedTasks) })}</p>
      </div>
    </section>
  );
}

/** A rank reached earlier in a run, as one static line with a small medal (no celebration). */
export function RankLine({ rank }: { rank: Rank }) {
  const t = useT();
  return (
    <p className="rank-line">
      {/* The small badge would print the name itself; the medal alone, the name in the catalog line. */}
      <RankBadge rank={rank.name} level={rank.index + 1} size="md" hideName />
      <span>{format(t('child.summary.rankReached'), { rank: rank.name })}</span>
    </p>
  );
}
