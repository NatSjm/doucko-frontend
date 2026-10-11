import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { components } from '@/api/generated/schema';
import { Link } from '@/app/Link';
import { queryParam } from '@/app/route-paths';
import { Button, Icon, cx } from '@/design-system';
import { ApiError } from '@/features/admin-access/problem';
import { BackToHq, ChildDeadEnd, ChildLayout, ChildLoadState } from '@/features/child/ChildLayout';
import type { Rank } from '@/features/rank/api';
import { formatXp } from '@/features/rank/rank';
import { RankUpCelebration } from '@/features/rank/RankUp';
import { useT } from '@/i18n';
import { format } from '@/i18n/format';
import { fetchCurrentTask, fetchTask, openNextHint, saveTranslation, submitAttempt, type Answers, type ChildTask } from './api';
import { answersToSend, answerText, applyResult, clampCodePoints, emptyParts, isChoice, optionsOf, partStates, type PartState } from './practice';
import { ReportDialog } from './ReportDialog';
import { Localized } from './TaskView';
import './practice.css';

type S = components['schemas'];

/** The task locale the toggle turns on: MVP configures `uk` only (child-profile, FR-29). */
const TRANSLATION_LOCALE = 'uk';

const STATE_ICON = { correct: 'check', wrong: 'retry', revealed: 'eye' } as const;
const NUMERIC: Partial<Record<S['AnswerType'], 'decimal'>> = { INTEGER: 'decimal', DECIMAL: 'decimal', FRACTION: 'decimal', NUMBER_WITH_UNIT: 'decimal' };

type Notice = 'save' | 'hint' | 'translation' | null;

/** One answer part: a typed field (with its unit) or a group of options, with its state and notes. */
function PartField({ part, state, value, required, formatTip, onChange }: {
  part: S['PartView'];
  state: PartState;
  value: string | string[] | undefined;
  required: boolean;
  formatTip: string | undefined;
  onChange: (value: string | string[]) => void;
}) {
  const t = useT();
  const id = useId();
  const noteId = `${id}-note`;
  const { status, readOnly } = state;
  const invalid = required || !!formatTip || status === 'wrong';
  const notes = (
    <div id={noteId} className="dk-part-note task-part-notes">
      {status === 'correct' && <span className="task-part-word">{t('child.task.partCorrect')}</span>}
      {status === 'wrong' && !formatTip && !required && <span className="task-part-word">{t('child.task.partWrong')}</span>}
      {required && <span className="task-field-error">{t('child.task.required')}</span>}
      {formatTip && (
        <span className="task-format-tip" data-content>
          {formatTip}
        </span>
      )}
      {status === 'revealed' && !isChoice(part) && value && (
        <span>
          {t('child.task.yourAnswer')}{' '}
          <span data-content>{value}</span>
        </span>
      )}
      {status === 'revealed' && (
        <span>
          {t('child.task.correctAnswer')}{' '}
          <b className="task-answer" data-content>
            {answerText(part, state.revealed)}
          </b>
        </span>
      )}
    </div>
  );
  const mark = status !== 'idle' && (
    <span className="dk-part-state" aria-hidden="true">
      <Icon name={STATE_ICON[status]} size={18} strokeWidth={3} />
    </span>
  );

  if (isChoice(part)) {
    const multiple = part.type === 'CHOICE_MULTI';
    const picked = Array.isArray(value) ? value : Array.isArray(state.storedValue) ? state.storedValue : [];
    const answer = Array.isArray(state.revealed) ? state.revealed : [];
    return (
      <fieldset className={cx('dk-choices', 'task-part', `dk-part-${status}`)} data-part={part.key} disabled={readOnly} aria-describedby={noteId}>
        <legend className="dk-choices-legend">
          <Localized text={part.label} />
        </legend>
        {multiple && <div className="dk-choices-hint">{t('child.task.chooseAll')}</div>}
        {optionsOf(part).map((o) => {
          const on = picked.includes(o.key);
          return (
            <label
              key={o.key}
              className={cx('dk-choice', on ? 'is-selected' : null, on && status === 'correct' ? 'dk-choice-correct' : null, status === 'revealed' && answer.includes(o.key) ? 'dk-choice-missed' : null)}
            >
              <input
                className="dk-sr"
                type={multiple ? 'checkbox' : 'radio'}
                name={`${id}-${part.key}`}
                checked={on}
                aria-invalid={invalid || undefined}
                onChange={() => onChange(!multiple ? [o.key] : on ? picked.filter((k) => k !== o.key) : [...picked, o.key])}
              />
              <span className="dk-choice-key">{o.key}</span>
              <span className="dk-choice-label">
                <Localized text={o.text} />
              </span>
            </label>
          );
        })}
        {notes}
      </fieldset>
    );
  }

  const typed = typeof value === 'string' ? value : '';
  const shown = status === 'revealed' ? answerText(part, state.revealed) : typed || (typeof state.storedValue === 'string' ? state.storedValue : '');
  return (
    <div className={cx('dk-part', 'task-part', `dk-part-${status}`)} data-part={part.key}>
      <label className="dk-part-label" htmlFor={id}>
        <Localized text={part.label} />
      </label>
      <div className="dk-part-field">
        <input
          id={id}
          className="dk-input"
          inputMode={NUMERIC[part.type] ?? 'text'}
          autoComplete="off"
          spellCheck={false}
          placeholder={readOnly ? undefined : t('child.task.answerPlaceholder')}
          value={shown}
          readOnly={readOnly}
          aria-invalid={invalid || undefined}
          aria-describedby={noteId}
          onChange={(e) => onChange(clampCodePoints(e.target.value))}
        />
        {part.unit && (
          <span className="dk-unit" data-content>
            {part.unit}
          </span>
        )}
        {mark}
      </div>
      {notes}
    </div>
  );
}

/** The XP sticker: only an award the server made, never 0 or less (FR-38). */
function XpSticker({ xp }: { xp: number }) {
  const t = useT();
  return xp > 0 ? <span className="task-xp">{format(t('child.task.xp'), { xp: formatXp(xp) })}</span> : null;
}

/**
 * The feedback after a server answer: correct, almost, revealed, or unreadable (FR-22, FR-27), with
 * the XP the server awarded on a correct or revealed first resolution (FR-38: "+1 XP" for a reveal).
 */
function TaskFeedback({ task, unreadable }: { task: ChildTask; unreadable: boolean }) {
  const t = useT();
  const xp = task.lastFeedback?.xpAwarded ?? 0;
  if (unreadable)
    return (
      <div className="dk-fb dk-fb-format">
        <span className="dk-fb-icon">
          <Icon name="hint" size={22} strokeWidth={3} />
        </span>
        <div className="dk-fb-body">
          <div className="dk-fb-title">{t('child.task.format')}</div>
          <div className="dk-fb-text">{t('child.task.formatText')}</div>
        </div>
      </div>
    );
  if (task.state === 'CORRECT_FIRST_TRY' || task.state === 'CORRECT_SECOND_TRY')
    return (
      <div className="dk-fb dk-fb-correct">
        <span className="dk-fb-icon">
          <Icon name="check" size={22} strokeWidth={3} />
        </span>
        <div className="dk-fb-body">
          <div className="dk-fb-title">{t('child.task.correct')}</div>
        </div>
        <XpSticker xp={xp} />
      </div>
    );
  if (task.state === 'REVEALED')
    return (
      <div className="dk-fb dk-fb-revealed">
        <span className="dk-fb-icon">
          <Icon name="eye" size={22} strokeWidth={3} />
        </span>
        <div className="dk-fb-body">
          <div className="dk-fb-title">{t('child.task.revealed')}</div>
          <div className="dk-fb-text">{t('child.task.revealedText')}</div>
        </div>
        <XpSticker xp={xp} />
      </div>
    );
  if (task.attemptsUsed > 0 && task.lastFeedback)
    return (
      <div className="dk-fb dk-fb-almost">
        <span className="dk-fb-icon">
          <Icon name="retry" size={22} strokeWidth={3} />
        </span>
        <div className="dk-fb-body">
          <div className="dk-fb-title">{t('child.task.almost')}</div>
          <div className="dk-fb-text">{t('child.task.almostText')}</div>
        </div>
      </div>
    );
  return null;
}

/** The part an unresolved task asks for first: the first wrong one, else the first open one (there always is one). */
function firstOpen(task: ChildTask): string {
  const states = partStates(task);
  return ((task.parts.find((p) => states[p.key].status === 'wrong') ?? task.parts.find((p) => !states[p.key].readOnly)) as S['PartView']).key;
}

/**
 * Practising one task (practice-flow "Task screen", "Two attempts, then reveal", "Hints on demand",
 * "Ukrainian translation toggle", "Report a problem", "Save and resume"). The loaded `TaskView` is kept
 * in step with every server answer; part states are derived from it, so a reload looks the same.
 */
function TaskPractice({ initial, missionId }: { initial: ChildTask; missionId: string }) {
  const t = useT();
  const formId = useId();
  const root = useRef<HTMLDivElement>(null);
  const reportButton = useRef<HTMLButtonElement>(null);
  const [task, setTask] = useState(initial);
  const [values, setValues] = useState<Answers>({});
  const [required, setRequired] = useState<string[]>([]);
  const [formatTips, setFormatTips] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [hintBusy, setHintBusy] = useState(false);
  const [toggleBusy, setToggleBusy] = useState(false);
  /** A submission got no answer: re-read the stored state before sending again (FR-31). */
  const [resync, setResync] = useState(false);
  const [gone, setGone] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  /** A rank-up carried by the live attempt result (mid-mission); never from a reload (FR-36). */
  const [rankUp, setRankUp] = useState<Rank | null>(null);
  const [thanks, setThanks] = useState(false);
  /** Where focus goes after the next render; a new object per request, so the same target can be asked twice. */
  const [focusRequest, setFocusRequest] = useState<{ target: string }>(() => ({ target: initial.state === 'UNRESOLVED' ? `part:${firstOpen(initial)}` : 'next' }));
  const setFocusTarget = (target: string) => setFocusRequest({ target });

  useEffect(() => {
    const focusTarget = focusRequest.target;
    const el =
      focusTarget === 'next'
        ? root.current?.querySelector<HTMLElement>('[data-next]')
        : focusTarget.startsWith('hint:')
          ? root.current?.querySelector<HTMLElement>(`[data-hint="${focusTarget.slice(5)}"]`)
          : focusTarget === 'report'
          ? reportButton.current
          : root.current?.querySelector<HTMLElement>(`[data-part="${focusTarget.slice(5)}"] input:not([disabled])`);
    el?.focus();
  }, [focusRequest]);

  if (gone)
    return (
      <ChildLayout title={t('app.name')} focusHeading={false}>
        <ChildDeadEnd message={t('child.task.notFound')} />
      </ChildLayout>
    );

  const states = partStates(task);
  const resolved = task.state !== 'UNRESOLVED';
  const missionDone = resolved && !!task.lastFeedback?.missionComplete;
  // Bonuses paid by the latest answer (only a resolving answer pays one).
  const bonusXp = task.lastFeedback?.bonusXp ?? 0;
  // One answer can complete several missions sharing the task (OQ-28): the copy says so.
  const manyBonuses = (task.lastFeedback?.completedMissionIds.length ?? 0) > 1;
  const unreadable = Object.keys(formatTips).length > 0;
  // The toggle shows what the screen shows: the server sends the translation exactly when the profile setting is on.
  const translationOn = task.prompt.secondary !== null;
  const hintsLeft = task.hints.total - task.hints.opened.length;

  /** Takes the server's stored state of the task (after a re-read) as it is. */
  function adopt(stored: ChildTask) {
    setTask(stored);
    setFormatTips({});
    setRequired([]);
    setNotice(null);
    setFocusTarget(stored.state === 'UNRESOLVED' ? `part:${firstOpen(stored)}` : 'next');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || resolved) return;
    const empty = emptyParts(task, values);
    setRequired(empty);
    if (empty.length) return setFocusTarget(`part:${empty[0]}`);
    setBusy(true);
    try {
      if (resync) {
        const stored = await fetchTask(missionId, task.taskId);
        setResync(false);
        if (stored.attemptsUsed !== task.attemptsUsed || stored.state !== task.state) return adopt(stored);
      }
      const result = await submitAttempt(missionId, task.taskId, answersToSend(task, values));
      setNotice(null);
      if (result.status === 'UNPARSEABLE') {
        // UNPARSEABLE carries only the unreadable parts, each with its Czech format tip (contract).
        setFormatTips(Object.fromEntries(result.parts.map((p) => [p.key, p.formatTip as string])));
        return setFocusTarget(`part:${result.parts[0].key}`);
      }
      setFormatTips({});
      setRankUp(result.rankUp);
      // A functional update: a hint or translation that arrived during the request is kept.
      setTask((cur) => applyResult(cur, result));
      setFocusTarget(result.taskState === 'UNRESOLVED' ? `part:${firstOpen(applyResult(task, result))}` : 'next');
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return setGone(true);
      if (error instanceof ApiError && error.status === 409) {
        try {
          return adopt(await fetchTask(missionId, task.taskId));
        } catch {
          // fall through: the state could not be re-read either
        }
      }
      setNotice('save');
      // No answer at all, or a server error: the attempt may have been stored, so re-read before sending again.
      // A 400 or 413 is a refusal that stored nothing.
      if (!(error instanceof ApiError) || error.status >= 500) setResync(true);
    } finally {
      setBusy(false);
    }
  }

  /** Enter on an option submits too (NFR-7: Enter submits); buttons keep their own Enter. */
  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    const target = event.target as HTMLInputElement;
    if (event.key === 'Enter' && (target.type === 'radio' || target.type === 'checkbox')) {
      event.preventDefault();
      event.currentTarget.requestSubmit();
    }
  }

  async function openHint() {
    // Where focus was when the hint was asked for (the hint button, or nowhere).
    const askedFrom = document.activeElement;
    setHintBusy(true);
    try {
      const hint = await openNextHint(missionId, task.taskId);
      setTask((cur) => ({ ...cur, hints: { ...cur.hints, opened: [...cur.hints.opened.filter((h) => h.index !== hint.index), hint] } }));
      setNotice(null);
      // The button is disabled now: focus moves to the hint just opened instead of being lost,
      // unless the child has moved on meanwhile (e.g. is typing an answer): that focus stays.
      const active = document.activeElement;
      if (hint.remaining === 0 && (active === askedFrom || active === document.body)) setFocusTarget(`hint:${hint.index}`);
    } catch (error) {
      setNotice('hint');
      // 409: every hint is already open (another tab); show what the server holds.
      if (error instanceof ApiError && error.status === 409) {
        try {
          const stored = await fetchTask(missionId, task.taskId);
          setTask((cur) => ({ ...cur, hints: stored.hints }));
        } catch {
          // the generic message stays
        }
      }
    } finally {
      setHintBusy(false);
    }
  }

  async function toggleTranslation() {
    setToggleBusy(true);
    try {
      await saveTranslation(translationOn ? null : TRANSLATION_LOCALE);
      const fresh = await fetchTask(missionId, task.taskId);
      // Only the texts change with the setting; the practice state stays as this screen holds it.
      setTask((cur) => ({ ...cur, prompt: fresh.prompt, parts: fresh.parts, hints: fresh.hints }));
      setNotice(null);
    } catch {
      setNotice('translation');
    } finally {
      setToggleBusy(false);
    }
  }

  function setValue(key: string, value: string | string[]) {
    setValues((cur) => ({ ...cur, [key]: value }));
    if (required.includes(key)) setRequired(required.filter((k) => k !== key));
    if (key in formatTips) setFormatTips(Object.fromEntries(Object.entries(formatTips).filter(([k]) => k !== key)));
  }

  const nextHref = `/task?missionId=${missionId}`;
  return (
    <ChildLayout
      title={format(t('child.task.title'), { n: task.position })}
      focusHeading={false}
      aside={
        <div className="task-head-aside">
          <span className="task-attempts">
            <span>{format(t('child.task.attempts'), { used: task.attemptsUsed, total: task.maxAttempts })}</span>
          </span>
          <BackToHq />
        </div>
      }
    >
      <div ref={root} className="task-column">
        <section className="dk-card dk-task task-card" lang="cs">
          <div className="dk-prompt" data-content>
            {task.prompt.cs}
          </div>
          {task.prompt.secondary && (
            <div className="dk-alt" lang={task.prompt.secondary.locale}>
              <div className="dk-alt-text" data-content>
                {task.prompt.secondary.text}
              </div>
            </div>
          )}
          {task.images.length > 0 && (
            <div className="task-images">
              {task.images.map((image, i) => (
                <img key={image.imageId} src={image.url} alt={format(t('child.task.image'), { n: i + 1 })} />
              ))}
            </div>
          )}
          {task.hints.opened.length > 0 && (
            <div className="task-hints">
              {task.hints.opened.map((hint) => (
                <div key={hint.index} className="dk-hint task-hint" data-hint={hint.index} tabIndex={-1}>
                  <span className="dk-hint-icon">
                    <Icon name="hint" size={20} strokeWidth={2.5} />
                  </span>
                  <div>
                    <div className="dk-kicker">{format(t('child.task.hintOf'), { n: hint.index, total: task.hints.total })}</div>
                    <div className="dk-hint-text">
                      <Localized text={hint.text} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <form id={formId} className="task-form" aria-label={t('child.task.answers')} onSubmit={(e) => void submit(e)} onKeyDown={onKeyDown} noValidate>
            {task.parts.map((part) => (
              <PartField
                key={part.key}
                part={part}
                state={states[part.key]}
                value={values[part.key]}
                required={required.includes(part.key)}
                formatTip={formatTips[part.key]}
                onChange={(v) => setValue(part.key, v)}
              />
            ))}
            <div role="status" className="task-feedback">
              <TaskFeedback task={task} unreadable={unreadable} />
              {bonusXp > 0 && (
                <p className="task-bonus">
                  <Icon name="bolt" size={18} strokeWidth={2.5} />
                  {format(t(manyBonuses ? 'child.task.bonusMany' : 'child.task.bonus'), { xp: formatXp(bonusXp) })}
                </p>
              )}
              {missionDone && (
                <div className="dk-fb dk-fb-correct">
                  <span className="dk-fb-icon">
                    <Icon name="sparkle" size={22} strokeWidth={3} />
                  </span>
                  <div className="dk-fb-body">
                    <div className="dk-fb-title">{t('child.task.missionDone')}</div>
                    <div className="dk-fb-text">{t('child.task.missionDoneText')}</div>
                  </div>
                </div>
              )}
            </div>
            {rankUp && <RankUpCelebration rank={rankUp} />}
            {notice && (
              <p role="alert" className="task-alert">
                {t(notice === 'save' ? 'child.task.saveFailed' : notice === 'hint' ? 'child.task.hintFailed' : 'child.task.translationFailed')}
              </p>
            )}
            <div className="task-actions">
              {task.hints.total > 0 ? (
                <Button icon="hint" disabled={hintsLeft <= 0 || hintBusy} onClick={() => void openHint()}>
                  {t('child.task.hint')} <span className="dk-count">{format(t('child.task.hintsLeft'), { n: hintsLeft })}</span>
                </Button>
              ) : (
                <span />
              )}
              {!resolved && (
                <Button variant="primary" size="lg" type="submit" iconAfter="arrow" disabled={busy}>
                  {t('child.task.submit')}
                </Button>
              )}
              {resolved && !missionDone && (
                <Link className="dk-btn dk-btn-primary dk-btn-lg" href={nextHref} data-next="">
                  {t('child.task.next')}
                  <Icon name="arrow" size={20} strokeWidth={2.5} />
                </Link>
              )}
              {missionDone && (
                <Link className="dk-btn dk-btn-primary dk-btn-lg" href={`/summary?missionId=${missionId}`} data-next="">
                  {t('child.mission.results')}
                  <Icon name="arrow" size={20} strokeWidth={2.5} />
                </Link>
              )}
            </div>
          </form>
          <footer className="dk-task-tools">
            {task.translationAvailable ? (
              <button type="button" className={cx('dk-toggle', translationOn ? 'is-on' : null)} aria-pressed={translationOn} disabled={toggleBusy} onClick={() => void toggleTranslation()}>
                <Icon name="translate" size={18} strokeWidth={2.25} />
                {t(translationOn ? 'child.task.hideTranslation' : 'child.task.showTranslation')}
              </button>
            ) : (
              <button type="button" className="dk-toggle" disabled>
                <Icon name="translate" size={18} strokeWidth={2.25} />
                {t('child.task.translationUnavailable')}
              </button>
            )}
            <button
              ref={reportButton}
              type="button"
              className="dk-link"
              aria-expanded={reportOpen}
              onClick={() => {
                setThanks(false);
                setReportOpen(!reportOpen);
              }}
            >
              <Icon name="flag" size={16} />
              {t('child.report.open')}
            </button>
          </footer>
          {thanks && (
            <p role="status" className="task-thanks">
              {t('child.report.thanks')}
            </p>
          )}
        </section>
        {reportOpen && (
          <ReportDialog
            missionId={missionId}
            taskId={task.taskId}
            onClose={(sent) => {
              setReportOpen(false);
              setThanks(sent);
              setFocusTarget('report');
            }}
          />
        )}
      </div>
    </ChildLayout>
  );
}

/**
 * `/task?missionId=…[&taskId=…]`: without a task id the mission's current task (`getCurrentTask`),
 * whose id is then written into the URL; with one, that task (`getTask`). 404 → "Tuhle úlohu jsem
 * nenašel."; nothing left → the mission is done.
 */
export function TaskScreen() {
  const t = useT();
  const missionId = queryParam('missionId');
  const taskId = queryParam('taskId');
  const query = useQuery({
    queryKey: ['child', 'task', missionId, taskId ?? 'current'],
    queryFn: () => (taskId ? fetchTask(missionId as string, taskId) : fetchCurrentTask(missionId as string)),
    enabled: !!missionId,
    retry: false,
    // Practice state changes with every answer: each visit reads the server afresh, never a cached task.
    gcTime: 0,
  });
  const loaded = query.isFetchedAfterMount ? query.data : undefined;
  useEffect(() => {
    if (loaded && !taskId) window.history.replaceState(window.history.state, '', `/task?missionId=${missionId}&taskId=${loaded.taskId}`);
  }, [loaded, taskId, missionId]);

  // 404: not served; 400: an id in the URL that is not a UUID (refused before any lookup). Both are a dead end.
  if (!missionId || (query.error instanceof ApiError && [400, 404].includes(query.error.status)))
    return (
      <ChildLayout title={t('app.name')} focusHeading={false}>
        <ChildDeadEnd message={t('child.task.notFound')} />
      </ChildLayout>
    );
  if (loaded === null)
    return (
      <ChildLayout title={t('child.task.missionDone')}>
        <div className="child-stack">
          <p>{t('child.task.missionDoneText')}</p>
          <div className="task-done-actions">
            <Link className="dk-btn dk-btn-primary" href={`/summary?missionId=${missionId}`}>
              {t('child.mission.results')}
            </Link>
            <Link className="dk-btn dk-btn-secondary" href="/">
              {t('child.common.backToHq')}
            </Link>
          </div>
        </div>
      </ChildLayout>
    );
  if (!loaded)
    return (
      <ChildLayout title={t('app.name')} focusHeading={false}>
        <ChildLoadState error={query.isError} onRetry={() => void query.refetch()} />
      </ChildLayout>
    );
  return <TaskPractice initial={loaded} missionId={missionId} />;
}
