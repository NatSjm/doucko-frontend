import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Button } from '@/design-system';
import { useT } from '@/i18n';
import { reportProblem, type ReportReason } from './api';
import { clampCodePoints } from './practice';

const REASONS: ReportReason[] = ['ANSWER_IS_CORRECT', 'UNCLEAR_PROMPT', 'OTHER'];
/** `ReportRequest.note` holds at most 1000 code points (practice-flow "Report note too long"). */
const MAX_NOTE = 1000;

/**
 * "Nahlásit problém" (practice-flow "Report a problem", FR-30): one of three reasons, a note that
 * "Jiné" requires. The server attaches the latest raw attempt and changes nothing about the task.
 * A non-modal dialog: focus starts on the first reason, Escape or "Zrušit" closes it.
 */
export function ReportDialog({ missionId, taskId, onClose }: { missionId: string; taskId: string; onClose: (sent: boolean) => void }) {
  const t = useT();
  const titleId = useId();
  const noteId = useId();
  const noteHintId = useId();
  const reasonErrorId = useId();
  const first = useRef<HTMLInputElement>(null);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<'reason' | 'note' | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    first.current?.focus();
  }, []);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!reason) return setError('reason');
    if (reason === 'OTHER' && !note.trim()) return setError('note');
    setError(null);
    setBusy(true);
    try {
      await reportProblem(missionId, taskId, reason, note);
      onClose(true);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose(false);
    }
  }

  return (
    <section role="dialog" aria-modal="false" aria-labelledby={titleId} className="dk-card task-report" onKeyDown={onKeyDown}>
      <h2 id={titleId} className="dk-t-heading">
        {t('child.report.title')}
      </h2>
      <form className="task-report-form" onSubmit={(e) => void send(e)} noValidate>
        <fieldset className="task-report-reasons" aria-describedby={error === 'reason' ? reasonErrorId : undefined}>
          <legend className="dk-t-body-strong">{t('child.report.reason')}</legend>
          {REASONS.map((r, i) => (
            <label key={r} className="task-report-reason">
              <input
                ref={i === 0 ? first : undefined}
                type="radio"
                name={`${titleId}-reason`}
                checked={reason === r}
                onChange={() => {
                  setReason(r);
                  setError(null);
                }}
              />
              {t(`child.report.reason.${r}` as const)}
            </label>
          ))}
          {error === 'reason' && (
            <p id={reasonErrorId} className="task-field-error">
              {t('child.report.reasonRequired')}
            </p>
          )}
        </fieldset>
        <div className="task-report-note">
          <label htmlFor={noteId} className="dk-t-body-strong">
            {t('child.report.note')}
          </label>
          <p id={noteHintId} className="dk-t-caption task-muted">
            {t('child.report.noteHint')}
          </p>
          <textarea
            id={noteId}
            className="task-report-text"
            rows={3}
            maxLength={MAX_NOTE}
            value={note}
            aria-invalid={error === 'note' ? true : undefined}
            aria-describedby={error === 'note' ? `${noteHintId} ${noteId}-error` : noteHintId}
            onChange={(e) => {
              setNote(clampCodePoints(e.target.value, MAX_NOTE));
              if (error === 'note') setError(null);
            }}
          />
          {error === 'note' && (
            <p id={`${noteId}-error`} className="task-field-error">
              {t('child.report.noteRequired')}
            </p>
          )}
        </div>
        {failed && (
          <p role="alert" className="task-alert">
            {t('child.report.failed')}
          </p>
        )}
        <div className="task-report-actions">
          <Button variant="primary" type="submit" disabled={busy}>
            {t('child.report.send')}
          </Button>
          <Button onClick={() => onClose(false)}>{t('child.report.cancel')}</Button>
        </div>
      </form>
    </section>
  );
}
