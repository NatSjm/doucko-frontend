import { useState } from 'react';
import { Chip, Panel } from '@/design-system';
import { AdminLayout, LoadState } from '@/features/admin-access/AdminLayout';
import { useT } from '@/i18n';
import { format } from '@/i18n/format';
import { useStats, type Stats } from './api';
import { DEFAULT_WEEKS, firstTryPercent, formatWeek, noPractice, shortWeeks, WEEK_CHOICES, weekRows } from './stats';
import './stats.css';

/**
 * Route `/admin/stats` (FR-40): the success metric, the weekly practice table (newest week first,
 * the current week and the four metric weeks marked, short weeks flagged) and the first-try rate per
 * topic, exactly as `getStats` serves them. The week count is the admin's choice (default 5).
 */
export function StatsScreen() {
  const t = useT();
  const [weeks, setWeeks] = useState<number>(DEFAULT_WEEKS);
  const stats = useStats(weeks);
  const title = t('admin.stats.title');

  if (!stats.data)
    return (
      <AdminLayout title={title}>
        <LoadState error={stats.isError} onRetry={() => void stats.refetch()} />
      </AdminLayout>
    );

  return (
    <AdminLayout title={title}>
      <Metric stats={stats.data} />
      {noPractice(stats.data) && <p className="admin-muted">{t('admin.stats.empty')}</p>}
      <div className="admin-control stats-weeks">
        <label htmlFor="stats-weeks">{t('admin.stats.weeksShown')}</label>
        <select id="stats-weeks" className="admin-field" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
          {WEEK_CHOICES.map((n) => (
            <option key={n} value={n}>
              {format(t('admin.stats.weeksOption'), { n })}
            </option>
          ))}
        </select>
      </div>
      <WeekTable stats={stats.data} />
      <TopicTable stats={stats.data} />
    </AdminLayout>
  );
}

/** The success metric verdict (`metricMet`), its rule and, when not met, the short weeks shown. */
function Metric({ stats }: { stats: Stats }) {
  const t = useT();
  const short = shortWeeks(stats);
  const name = t('admin.stats.metricTitle');
  return (
    <Panel title={name} ariaLabel={name}>
      <div className="stats-metric">
        <p className="stats-verdict">
          {stats.metricMet ? (
            <Chip tone="spark" icon="check">
              {t('admin.stats.metricMet')}
            </Chip>
          ) : (
            <Chip tone="almost">{t('admin.stats.metricNotMet')}</Chip>
          )}
        </p>
        <p className="admin-muted">{t('admin.stats.metricRule')}</p>
        {short.length > 0 && <p>{format(t('admin.stats.shortWeeks'), { weeks: short.map(formatWeek).join(', ') })}</p>}
      </div>
    </Panel>
  );
}

function WeekTable({ stats }: { stats: Stats }) {
  const t = useT();
  return (
    <div className="admin-table-wrap">
      <table className="admin-table stats-table">
        <caption>{t('admin.stats.weeklyCaption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('admin.stats.colWeek')}</th>
            <th scope="col">{t('admin.stats.colSessions')}</th>
            <th scope="col">{t('admin.stats.colQualifying')}</th>
            <th scope="col">{t('admin.stats.colSizes')}</th>
            <th scope="col">{t('admin.stats.colHints')}</th>
            <th scope="col">{t('admin.stats.colRevealed')}</th>
          </tr>
        </thead>
        <tbody>
          {weekRows(stats).map((row) => (
            <tr key={row.weekStart}>
              <td>
                {formatWeek(row.weekStart)}
                {row.current && (
                  <Chip tone="ink" className="stats-tag">
                    {t('admin.stats.thisWeek')}
                  </Chip>
                )}
                {row.metric && <Chip className="stats-tag">{t('admin.stats.metricWeek')}</Chip>}
              </td>
              <td className="admin-numeric">{row.sessions}</td>
              <td className="admin-numeric">
                {row.qualifying}
                {row.short && (
                  <Chip tone="almost" className="stats-tag">
                    {t('admin.stats.short')}
                  </Chip>
                )}
              </td>
              <td className="admin-numeric">{row.sizes.length ? row.sizes.join(', ') : t('admin.stats.noValue')}</td>
              <td className="admin-numeric">{row.hints}</td>
              <td className="admin-numeric">{row.revealed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopicTable({ stats }: { stats: Stats }) {
  const t = useT();
  return (
    <div className="admin-table-wrap">
      <table className="admin-table stats-table">
        <caption>{t('admin.stats.topicsCaption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('admin.stats.colTopic')}</th>
            <th scope="col">{t('admin.stats.colRate')}</th>
            <th scope="col">{t('admin.stats.colResolved')}</th>
          </tr>
        </thead>
        <tbody>
          {stats.firstTryRateByTopic.map((topic) => {
            const percent = firstTryPercent(topic);
            return (
              <tr key={topic.topicId}>
                <td lang="cs" data-content>
                  {topic.topicName}
                </td>
                <td className="admin-numeric">{percent === null ? t('admin.stats.noValue') : format(t('admin.stats.rate'), { percent })}</td>
                <td>{topic.resolved ? format(t('admin.stats.resolved'), { firstTry: topic.firstTry, resolved: topic.resolved }) : t('admin.stats.noneResolved')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
