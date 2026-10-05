import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { queryParam } from '@/app/route-paths';
import { Button, Chip, Panel } from '@/design-system';
import { AdminLayout, LoadState } from '@/features/admin-access/AdminLayout';
import { ConflictAlert } from '@/features/admin-access/ConflictAlert';
import { useDescribeMission } from '@/features/missions/useDescribeMission';
import { Field, FormAlert } from '@/features/admin-access/form';
import { ApiError, fieldErrors, problemMessage } from '@/features/admin-access/problem';
import { useReference, useSources, type ReferenceData, type Source } from '@/features/sources/api';
import { parsePage } from '@/features/sources/page';
import { PdfViewer } from '@/features/sources/PdfViewer';
import { useT } from '@/i18n';
import { format } from '@/i18n/format';
import { saveTask, TASKS_KEY, useTask, type AdminTask } from './api';
import { ImagesEditor } from './ImagesEditor';
import { TaskStatusPanel } from './TaskStatusPanel';
import { GroupError, PartEditor } from './PartEditor';
import {
  changeHints,
  CHOICE_TYPES,
  clientErrors,
  emptyTaskForm,
  fromAdminTask,
  move,
  newPart,
  optionKey,
  removeOption,
  removePart,
  stickyForm,
  toTaskInput,
  type TaskForm,
  type TranslationForm,
} from './taskForm';
import './tasks.css';

/** Parts and hints per task (content-authoring "Field limits"). */
const MAX_ITEMS = 10;
const MODALITIES = ['TEXT', 'GRAPHIC'] as const;
const DIFFICULTIES = ['1', '2', '3'];
const EMPTY_TRANSLATION: TranslationForm = { prompt: '', partLabels: {}, hints: [], options: {} };

/** The form of a new task: the source and page from the query when they name a source (NFR-8). */
function initialForm(task: AdminTask | null, sources: Source[], reference: ReferenceData): TaskForm {
  if (task) return fromAdminTask(task);
  const source = sources.find((s) => s.sourceId === queryParam('sourceId'));
  const form = emptyTaskForm();
  if (!source) return { ...form, grade: String(reference.grades[0]) };
  return { ...form, sourceId: source.sourceId, grade: String(source.grade), page: String(parsePage(queryParam('page') ?? '', source.pageCount) ?? 1) };
}

type Status = { kind: 'created'; taskId: string } | { kind: 'updated' } | null;

/**
 * The task editor (FR-3, FR-6, FR-7, FR-8) beside the PDF viewer (FR-2). Keyboard-first (NFR-8):
 * Enter in a single-line field or Ctrl+Enter anywhere saves; after a new task is saved, source and
 * page stay and focus returns to the prompt. Refusals land on the field their path names.
 */
function TaskEditor({
  task,
  sources,
  reference,
  onDeleted,
}: {
  task: AdminTask | null;
  sources: Source[];
  reference: ReferenceData;
  onDeleted: () => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const describeMission = useDescribeMission();
  /** A state refusal (409: the task is in a mission), shown with the missions it names. */
  const [conflict, setConflict] = useState<unknown>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [form, setForm] = useState<TaskForm>(() => initialForm(task, sources, reference));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  /** The stored task as a form: publishing acts on it, so it waits while the form differs. */
  const stored = useMemo(() => (task ? JSON.stringify(fromAdminTask(task)) : null), [task]);
  const dirty = stored !== null && JSON.stringify(form) !== stored;
  const source = sources.find((s) => s.sourceId === form.sourceId);
  const topics = reference.topics.filter((tp) => String(tp.grade) === form.grade);

  useEffect(() => {
    if (status?.kind === 'created') promptRef.current?.focus();
  }, [status]);

  const set = (patch: Partial<TaskForm>) => setForm((f) => ({ ...f, ...patch }));
  /** A structural change (add, move, remove): errors keyed by index no longer point at the right row. */
  const restructure = (change: (f: TaskForm) => TaskForm) => {
    setErrors({});
    setForm(change);
  };
  const setTranslation = (locale: string, patch: Partial<TranslationForm>) =>
    setForm((f) => ({ ...f, translations: { ...f.translations, [locale]: { ...EMPTY_TRANSLATION, ...f.translations[locale], ...patch } } }));

  async function save(event?: FormEvent) {
    event?.preventDefault();
    setStatus(null);
    setFailure(null);
    setConflict(null);
    const local = clientErrors(form, source ? source.pageCount : null, {
      page: format(t('admin.editor.pageRange'), { count: source ? source.pageCount : 0 }),
      exactDecimals: t('admin.editor.exactDecimalsInvalid'),
    });
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    const submitted = form;
    setBusy(true);
    try {
      const saved = await saveTask(task?.taskId ?? null, toTaskInput(form));
      setErrors({});
      await queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      if (task) {
        queryClient.setQueryData(['admin', 'task', saved.taskId], saved);
        await queryClient.invalidateQueries({ queryKey: ['admin', 'preview', saved.taskId] });
        // Edits typed while the save ran are kept; only an unchanged form takes the saved state.
        setForm((f) => (f === submitted ? fromAdminTask(saved) : f));
        setStatus({ kind: 'updated' });
      } else {
        setForm((f) => (f === submitted ? stickyForm(f) : f));
        setStatus({ kind: 'created', taskId: saved.taskId });
      }
    } catch (error) {
      const fields = fieldErrors(error);
      setErrors(fields);
      if (error instanceof ApiError && error.status === 409) setConflict(error);
      else if (!Object.keys(fields).length) setFailure(problemMessage(error) ?? t('admin.common.saveFailed'));
    }
    setBusy(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  const setPart = (i: number, part: TaskForm['parts'][number]) => set({ parts: form.parts.map((p, k) => (k === i ? part : p)) });

  return (
    <div className="editor-grid">
      <div className="editor-viewer">
        {source ? (
          <PdfViewer key={source.sourceId} sourceId={source.sourceId} pageCount={source.pageCount} initialPage={parsePage(form.page, source.pageCount) ?? 1} />
        ) : (
          <p>{t('admin.viewer.empty')}</p>
        )}
      </div>
      <div className="admin-form">
        {task && (
          <div className="admin-actions">
            <Chip tone={task.status === 'PUBLISHED' ? 'spark' : 'neutral'}>{t(`admin.status.${task.status}` as const)}</Chip>
            <a className="admin-link" href={`/admin/tasks/preview?taskId=${task.taskId}`}>
              {t('admin.editor.preview')}
            </a>
          </div>
        )}
        <form ref={formRef} className="admin-form" onSubmit={(e) => void save(e)} onKeyDown={onKeyDown} noValidate>
          <p className="admin-muted">{t('admin.editor.shortcut')}</p>
          <div className="admin-row">
            <Field label={t('admin.editor.source')} path="sourceRef.sourceId" errors={errors}>
              {(p) => (
                <select
                  {...p}
                  data-content={undefined}
                  className="admin-field"
                  value={form.sourceId}
                  onChange={(e) => {
                    const next = sources.find((s) => s.sourceId === e.target.value) as Source;
                    set({ sourceId: next.sourceId, grade: String(next.grade), page: '1' });
                  }}
                >
                  <option value="" disabled>
                    {t('admin.common.choose')}
                  </option>
                  {sources.map((s) => (
                    <option key={s.sourceId} value={s.sourceId} data-content>
                      {s.title}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={t('admin.editor.page')} path="sourceRef.page" errors={errors}>
              {(p) => <input {...p} className="admin-field" inputMode="numeric" value={form.page} onChange={(e) => set({ page: e.target.value })} />}
            </Field>
          </div>
          <Field label={t('admin.editor.prompt')} path="prompt" errors={errors}>
            {(p) => (
              <textarea
                {...p}
                ref={promptRef}
                className="admin-field"
                lang="cs"
                autoFocus={!task && !!source}
                value={form.prompt}
                onChange={(e) => set({ prompt: e.target.value })}
              />
            )}
          </Field>
          <Field label={t('admin.editor.topic')} path="topicId" errors={errors}>
            {(p) => (
              <select {...p} data-content={undefined} className="admin-field" value={form.topicId} onChange={(e) => set({ topicId: e.target.value })}>
                <option value="">{t('admin.common.choose')}</option>
                {topics.map((tp) => (
                  <option key={tp.topicId} value={tp.topicId} data-content>
                    {tp.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <div className="admin-row">
            <Field label={t('admin.editor.taskNo')} path="sourceRef.taskNo" errors={errors}>
              {(p) => <input {...p} className="admin-field" value={form.taskNo} onChange={(e) => set({ taskNo: e.target.value })} />}
            </Field>
            <Field label={t('admin.editor.subPart')} path="sourceRef.subPart" errors={errors}>
              {(p) => <input {...p} className="admin-field" value={form.subPart} onChange={(e) => set({ subPart: e.target.value })} />}
            </Field>
          </div>

          <section className="admin-section" aria-labelledby="editor-parts">
            <h2 id="editor-parts" className="dk-t-heading">
              {t('admin.editor.parts')}
            </h2>
            {!form.parts.length && <p>{t('admin.editor.noParts')}</p>}
            {form.parts.map((part, i) => (
              <PartEditor
                key={part.key}
                part={part}
                index={i}
                count={form.parts.length}
                errors={errors}
                onChange={(next) => setPart(i, next)}
                onMove={(delta) => restructure((f) => ({ ...f, parts: move(f.parts, i, delta) }))}
                onRemove={() => restructure((f) => removePart(f, i))}
                onRemoveOption={(j) => restructure((f) => removeOption(f, i, j))}
              />
            ))}
            <GroupError path="parts" errors={errors} />
            <div>
              <Button disabled={form.parts.length >= MAX_ITEMS} onClick={() => restructure((f) => ({ ...f, parts: [...f.parts, newPart(f.parts)] }))}>
                {t('admin.editor.addPart')}
              </Button>
            </div>
          </section>

          <div className="admin-row">
            <Field label={t('admin.editor.difficulty')} path="difficulty" errors={errors}>
              {(p) => (
                <select {...p} data-content={undefined} className="admin-field" value={form.difficulty} onChange={(e) => set({ difficulty: e.target.value })}>
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={t('admin.editor.grade')} path="grade" errors={errors}>
              {(p) => (
                <select {...p} data-content={undefined} className="admin-field" value={form.grade} onChange={(e) => set({ grade: e.target.value, topicId: '' })}>
                  {reference.grades.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <fieldset className="admin-fieldset">
            <legend className="admin-legend">{t('admin.editor.modality')}</legend>
            {MODALITIES.map((modality) => (
              <label key={modality} className="admin-check">
                <input type="radio" name="modality" value={modality} checked={form.modality === modality} onChange={() => set({ modality })} />
                {t(modality === 'TEXT' ? 'admin.editor.modalityText' : 'admin.editor.modalityGraphic')}
              </label>
            ))}
            <GroupError path="modality" errors={errors} />
          </fieldset>

          <section className="admin-section" aria-labelledby="editor-hints">
            <h2 id="editor-hints" className="dk-t-heading">
              {t('admin.editor.hints')}
            </h2>
            {!form.hints.length && <p>{t('admin.editor.noHints')}</p>}
            {form.hints.map((hint, i) => (
              <div key={i} className="admin-row">
                <Field label={format(t('admin.editor.hint'), { n: i + 1 })} path={`hints[${i}]`} errors={errors}>
                  {(p) => (
                    <textarea
                      {...p}
                      className="admin-field"
                      lang="cs"
                      value={hint}
                      onChange={(e) => set({ hints: form.hints.map((h, k) => (k === i ? e.target.value : h)) })}
                    />
                  )}
                </Field>
                <div className="admin-actions">
                  <Button disabled={i === 0} onClick={() => restructure((f) => changeHints(f, (h) => move(h, i, -1)))}>
                    {format(t('admin.editor.moveHintUp'), { n: i + 1 })}
                  </Button>
                  <Button disabled={i === form.hints.length - 1} onClick={() => restructure((f) => changeHints(f, (h) => move(h, i, 1)))}>
                    {format(t('admin.editor.moveHintDown'), { n: i + 1 })}
                  </Button>
                  <Button onClick={() => restructure((f) => changeHints(f, (h) => h.filter((_, k) => k !== i)))}>
                    {format(t('admin.editor.removeHint'), { n: i + 1 })}
                  </Button>
                </div>
              </div>
            ))}
            <div>
              <Button disabled={form.hints.length >= MAX_ITEMS} onClick={() => restructure((f) => ({ ...f, hints: [...f.hints, ''] }))}>
                {t('admin.editor.addHint')}
              </Button>
            </div>
          </section>

          <section className="admin-section" aria-labelledby="editor-translations">
            <h2 id="editor-translations" className="dk-t-heading">
              {t('admin.editor.translations')}
            </h2>
            {reference.taskLocales.map((locale) => {
              const tr = { ...EMPTY_TRANSLATION, ...form.translations[locale] };
              const base = `translations.${locale}`;
              return (
                <fieldset key={locale} className="admin-fieldset">
                  <legend className="admin-legend">{format(t('admin.editor.translation'), { locale })}</legend>
                  <Field label={format(t('admin.editor.trPrompt'), { locale })} path={`${base}.prompt`} errors={errors}>
                    {(p) => <textarea {...p} className="admin-field" lang={locale} value={tr.prompt} onChange={(e) => setTranslation(locale, { prompt: e.target.value })} />}
                  </Field>
                  {form.parts.map((part, i) => (
                    <div key={part.key} className="admin-row">
                      <Field
                        label={format(t('admin.editor.trPartLabel'), { n: i + 1, locale })}
                        path={`${base}.partLabels.${part.key}`}
                        errors={errors}
                      >
                        {(p) => (
                          <input
                            {...p}
                            className="admin-field"
                            lang={locale}
                            value={tr.partLabels[part.key] ?? ''}
                            onChange={(e) => setTranslation(locale, { partLabels: { ...tr.partLabels, [part.key]: e.target.value } })}
                          />
                        )}
                      </Field>
                      {CHOICE_TYPES.includes(part.type) &&
                        part.options.map((_, j) => {
                          const key = `${part.key}.${optionKey(j)}`;
                          return (
                            <Field
                              key={key}
                              label={format(t('admin.editor.trOption'), { key: optionKey(j), n: i + 1, locale })}
                              path={`${base}.options.${key}`}
                              errors={errors}
                            >
                              {(p) => (
                                <input
                                  {...p}
                                  className="admin-field"
                                  lang={locale}
                                  value={tr.options[key] ?? ''}
                                  onChange={(e) => setTranslation(locale, { options: { ...tr.options, [key]: e.target.value } })}
                                />
                              )}
                            </Field>
                          );
                        })}
                    </div>
                  ))}
                  {form.hints.map((_, i) => (
                    <Field key={i} label={format(t('admin.editor.trHint'), { n: i + 1, locale })} path={`${base}.hints[${i}]`} errors={errors}>
                      {(p) => (
                        <textarea
                          {...p}
                          className="admin-field"
                          lang={locale}
                          value={tr.hints[i] ?? ''}
                          onChange={(e) => {
                            const hints = form.hints.map((__, k) => (k === i ? e.target.value : (tr.hints[k] ?? '')));
                            setTranslation(locale, { hints });
                          }}
                        />
                      )}
                    </Field>
                  ))}
                </fieldset>
              );
            })}
          </section>

          <FormAlert errors={errors} failure={failure} />
          <ConflictAlert error={conflict} describe={describeMission} />
          {status && (
            <div role="status" className="admin-ok">
              <p>{t(status.kind === 'created' ? 'admin.editor.created' : 'admin.editor.updated')}</p>
              {status.kind === 'created' && (
                <p className="admin-actions">
                  <a className="admin-link" href={`/admin/tasks/edit?taskId=${status.taskId}`}>
                    {t('admin.editor.openSaved')}
                  </a>
                  <a className="admin-link" href={`/admin/tasks/preview?taskId=${status.taskId}`}>
                    {t('admin.editor.preview')}
                  </a>
                </p>
              )}
            </div>
          )}
          <div>
            <Button type="submit" variant="primary" disabled={busy}>
              {t('admin.editor.save')}
            </Button>
          </div>
        </form>
        {task ? (
          <>
            <ImagesEditor task={task} onChanged={() => queryClient.invalidateQueries({ queryKey: ['admin', 'task', task.taskId] })} />
            <TaskStatusPanel task={task} dirty={dirty} saving={busy} onDeleted={onDeleted} />
          </>
        ) : (
          <Panel title={t('admin.images.title')} ariaLabel={t('admin.images.title')}>
            <p>{t('admin.images.saveFirst')}</p>
          </Panel>
        )}
      </div>
    </div>
  );
}

/** Route `/admin/tasks/edit[?taskId=…][&sourceId=…&page=…]`: a new task, or a saved one. */
export function TaskEditorScreen() {
  const t = useT();
  const taskId = queryParam('taskId');
  const reference = useReference();
  const sources = useSources();
  const task = useTask(taskId);
  const [deleted, setDeleted] = useState(false);
  const title = t(taskId ? 'admin.editor.editTitle' : 'admin.editor.newTitle');

  if (deleted)
    return (
      <AdminLayout title={title}>
        <p role="status" className="admin-ok">
          {t('admin.taskStatus.deleted')}
        </p>
        <p>
          <a className="admin-link" href="/admin/tasks">
            {t('admin.taskStatus.back')}
          </a>
        </p>
      </AdminLayout>
    );

  if (task.error instanceof ApiError && task.error.status === 404)
    return (
      <AdminLayout title={title}>
        <p role="alert">{t('admin.editor.notFound')}</p>
      </AdminLayout>
    );
  if (!reference.data || !sources.data || (taskId && !task.data))
    return (
      <AdminLayout title={title}>
        <LoadState
          error={reference.isError || sources.isError || task.isError}
          onRetry={() => {
            void reference.refetch();
            void sources.refetch();
            if (taskId) void task.refetch();
          }}
        />
      </AdminLayout>
    );
  return (
    <AdminLayout title={title} wide>
      <TaskEditor task={task.data ?? null} sources={sources.data} reference={reference.data} onDeleted={() => setDeleted(true)} />
    </AdminLayout>
  );
}
