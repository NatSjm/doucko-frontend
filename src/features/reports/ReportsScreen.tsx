import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Button, Chip } from '@/design-system';
import { AdminLayout, LoadState } from '@/features/admin-access/AdminLayout';
import { ApiError } from '@/features/admin-access/problem';
import { STATS_KEY } from '@/features/stats/api';
import { useT } from '@/i18n';
import { format } from '@/i18n/format';
import { dismissReport, reevaluateReport, REPORTS_KEY, useReports, type ReevaluationResult, type Report, type ReportStatus, type Verdict } from './api';
import { formatTime, rawText } from './reports';
import './reports.css';

type T = ReturnType<typeof useT>;

const STATUSES: readonly ReportStatus[] = ['OPEN', 'FIXED', 'DISMISSED'];
const STATUS_TONE = { OPEN: 'hero', FIXED: 'spark', DISMISSED: 'neutral' } as const;

/** What the admin is told after a re-evaluation, naming the task (FR-41, OQ-20). */
function reevaluationText(t: T, result: ReevaluationResult): string {
  const task = result.report.taskPromptExcerpt;
  if (!result.changed) return format(t('admin.reports.unchanged'), { task });
  if (result.report.attempt?.replay) return format(t('admin.reports.fixedReplay'), { task });
  const fixed = result.xpAwarded > 0 ? format(t('admin.reports.fixedXp'), { task, xp: result.xpAwarded }) : format(t('admin.reports.fixedNoXp'), { task });
  return result.bonusXp > 0 ? `${fixed} ${format(t('admin.reports.bonus'), { xp: result.bonusXp })}` : fixed;
}

/**
 * Route `/admin/reports` (FR-41): the flag queue in the server's order (OPEN first, oldest first)
 * with a status filter. Each report shows the task (and a link to fix its answer spec), the reason,
 * the note and the attached attempt in full; an OPEN report can be re-evaluated (with an attempt)
 * or dismissed. The outcome is announced in a status line that takes focus, so it is heard even
 * when the report leaves the filtered list.
 */
export function ReportsScreen() {
  const t = useT();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ReportStatus | ''>('');
  const reports = useReports(status || null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState({ text: '', seq: 0 });
  const [error, setError] = useState<string | null>(null);
  const outcomeLine = useRef<HTMLParagraphElement>(null);
  const title = t('admin.reports.title');

  useEffect(() => {
    if (outcome.seq) outcomeLine.current?.focus();
  }, [outcome.seq]);

  async function act(report: Report, action: 'reevaluate' | 'dismiss') {
    setBusy(true);
    setError(null);
    try {
      const text =
        action === 'reevaluate'
          ? reevaluationText(t, await reevaluateReport(report.reportId))
          : (await dismissReport(report.reportId), format(t('admin.reports.dismissed'), { task: report.taskPromptExcerpt }));
      setOutcome((o) => ({ text, seq: o.seq + 1 }));
      await reload();
    } catch (e) {
      setOutcome((o) => ({ text: '', seq: o.seq }));
      if (e instanceof ApiError && e.status === 409) {
        setError(e.problem?.detail ?? t('admin.reports.alreadyHandled'));
        await reload();
      } else setError(t('admin.common.actionFailed'));
    }
    setBusy(false);
  }

  /** The queue and the stats (a re-evaluation can change a first-try rate) are read again. */
  async function reload() {
    await Promise.all([queryClient.invalidateQueries({ queryKey: REPORTS_KEY }), queryClient.invalidateQueries({ queryKey: STATS_KEY })]);
  }

  if (!reports.data)
    return (
      <AdminLayout title={title}>
        <LoadState error={reports.isError} onRetry={() => void reports.refetch()} />
      </AdminLayout>
    );

  return (
    <AdminLayout title={title}>
      <div className="admin-control report-filter">
        <label htmlFor="report-status">{t('admin.reports.filter')}</label>
        <select id="report-status" className="admin-field" value={status} onChange={(e) => setStatus(e.target.value as ReportStatus | '')}>
          <option value="">{t('admin.reports.filterAll')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`admin.reports.status.${s}`)}
            </option>
          ))}
        </select>
      </div>
      <p ref={outcomeLine} role="status" tabIndex={-1} className="admin-ok report-outcome">
        {outcome.text}
      </p>
      {error && (
        <p role="alert" className="admin-alert">
          {error}
        </p>
      )}
      {reports.data.length ? (
        <ol className="report-list" aria-label={t('admin.reports.list')}>
          {reports.data.map((report) => (
            <li key={report.reportId}>
              <ReportEntry report={report} busy={busy} onAct={(action) => void act(report, action)} />
            </li>
          ))}
        </ol>
      ) : (
        <p>{t(status ? 'admin.reports.emptyFiltered' : 'admin.reports.empty')}</p>
      )}
    </AdminLayout>
  );
}

/**
 * The answer parts of an attempt: every part with a verdict, then any other typed part. A part
 * locked as correct on attempt 1 has a verdict but no raw input on attempt 2 (it was not re-entered).
 */
function partKeys(attempt: NonNullable<Report['attempt']>): string[] {
  return [...new Set([...Object.keys(attempt.verdicts), ...Object.keys(attempt.rawInput)])];
}

/** A checker verdict: correct in `spark` with its check, anything else in `almost` (logged verdicts are only CORRECT or WRONG). */
function VerdictChip({ verdict }: { verdict: Verdict }) {
  const t = useT();
  const correct = verdict === 'CORRECT';
  return (
    <Chip tone={correct ? 'spark' : 'almost'} icon={correct ? 'check' : 'retry'}>
      {t(`admin.reports.verdict.${verdict}`)}
    </Chip>
  );
}

/** One report: status, time, task, reason, note, the attached attempt and the actions of an OPEN report. */
function ReportEntry({ report, busy, onAct }: { report: Report; busy: boolean; onAct: (action: 'reevaluate' | 'dismiss') => void }) {
  const t = useT();
  const attempt = report.attempt;
  const headingId = `report-${report.reportId}`;
  return (
    <article className="dk-panel report-entry" data-report={report.reportId} aria-labelledby={headingId}>
      <div className="report-meta">
        <Chip tone={STATUS_TONE[report.status]}>{t(`admin.reports.status.${report.status}`)}</Chip>
        <span className="admin-muted">{format(t('admin.reports.reported'), { time: formatTime(report.createdAt) })}</span>
      </div>
      <h2 id={headingId} className="report-task" lang="cs" data-content>
        {report.taskPromptExcerpt}
      </h2>
      <div>
        <a className="admin-link" href={`/admin/tasks/edit?taskId=${report.taskId}`}>
          {t('admin.reports.openTask')}
        </a>
      </div>
      <dl className="report-facts">
        <dt>{t('admin.reports.reason')}</dt>
        <dd>{t(`admin.reports.reason.${report.reason}`)}</dd>
        {report.note && (
          <>
            <dt>{t('admin.reports.note')}</dt>
            <dd lang="cs" data-content>
              {report.note}
            </dd>
          </>
        )}
      </dl>
      {attempt ? (
        <div className="report-attempt">
          <p className="report-meta">
            <span className="report-strong">{format(t('admin.reports.attempt'), { n: attempt.attemptNo })}</span>
            {attempt.replay && <Chip tone="ink">{t('admin.reports.replay')}</Chip>}
            <span>{format(t('admin.reports.hintsUsed'), { n: attempt.hintsUsed })}</span>
            <span className="admin-muted">{format(t('admin.reports.submitted'), { time: formatTime(attempt.createdAt) })}</span>
          </p>
          <table className="admin-table report-parts">
            <caption className="dk-sr">{format(t('admin.reports.partsCaption'), { n: attempt.attemptNo })}</caption>
            <thead>
              <tr>
                <th scope="col">{t('admin.reports.colPart')}</th>
                <th scope="col">{t('admin.reports.colRaw')}</th>
                <th scope="col">{t('admin.reports.colVerdict')}</th>
                <th scope="col">{t('admin.reports.colReevaluated')}</th>
              </tr>
            </thead>
            <tbody>
              {partKeys(attempt).map((key) => {
                const value = attempt.rawInput[key];
                const verdict = attempt.verdicts[key];
                const again = attempt.reevaluation?.verdicts[key];
                return (
                  <tr key={key}>
                    <td data-content>{key}</td>
                    <td>
                      {value === undefined ? (
                        <span className="admin-muted">{t('admin.reports.lockedPart')}</span>
                      ) : (
                        <span className="report-raw" data-content>
                          {rawText(value)}
                        </span>
                      )}
                    </td>
                    <td>{verdict && <VerdictChip verdict={verdict} />}</td>
                    <td>
                      {again && attempt.reevaluation ? (
                        <>
                          <VerdictChip verdict={again} />
                          <span className="admin-muted report-when">{format(t('admin.reports.reevaluatedAt'), { time: formatTime(attempt.reevaluation.reevaluatedAt) })}</span>
                        </>
                      ) : (
                        t('admin.reports.notReevaluated')
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="admin-muted">{t('admin.reports.noAttempt')}</p>
      )}
      {report.status === 'OPEN' && (
        <div className="admin-actions">
          {attempt && (
            <Button disabled={busy} onClick={() => onAct('reevaluate')}>
              {t('admin.reports.reevaluate')}
            </Button>
          )}
          <Button disabled={busy} onClick={() => onAct('dismiss')}>
            {t('admin.reports.dismiss')}
          </Button>
        </div>
      )}
    </article>
  );
}
