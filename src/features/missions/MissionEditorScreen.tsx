import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { queryParam } from '@/app/route-paths';
import { Button, Chip, Panel } from '@/design-system';
import { AdminLayout, LoadState } from '@/features/admin-access/AdminLayout';
import { ConflictAlert, type Blocker } from '@/features/admin-access/ConflictAlert';
import { DeleteControl } from '@/features/admin-access/DeleteControl';
import { Field, FormAlert } from '@/features/admin-access/form';
import { ApiError, fieldErrors } from '@/features/admin-access/problem';
import { useReference, type ReferenceData } from '@/features/sources/api';
import { TASKS_KEY, useTasks, type TaskSummary } from '@/features/tasks/api';
import { useT } from '@/i18n';
import { format } from '@/i18n/format';
import { deleteMission, MISSIONS_KEY, missionKey, saveMission, setMissionStatus, useMission, type AdminMission } from './api';
import { addTask, emptyMissionForm, fromAdminMission, isDirty, MAX_TASKS, moveTask, parsePosition, removeTask, toMissionInput, type MissionForm } from './missionForm';
import './missions.css';

/** Search ignores case and diacritics, like the task list search (content-authoring). */
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('cs');

/** Where focus goes after the task list changed: the moved task's button, a row's Remove, or the picker. */
type FocusTarget = { kind: 'up' | 'down' | 'remove'; taskId: string } | { kind: 'add'; index: number } | { kind: 'search' } | null;

function TaskChips({ task }: { task: TaskSummary | undefined }) {
  const t = useT();
  if (!task) return null;
  return (
    <>
      <Chip tone={task.status === 'PUBLISHED' ? 'spark' : 'neutral'}>{t(`admin.status.${task.status}` as const)}</Chip>
      <Chip tone={task.modality === 'GRAPHIC' ? 'volt' : 'neutral'}>{t(`admin.modality.${task.modality}` as const)}</Chip>
    </>
  );
}

/**
 * The mission editor (FR-9, FR-55): topic, position and the ordered task list, built from the
 * topic's tasks; publish, unpublish and delete for a saved mission. Refusals land on their field
 * (`position`, `taskIds[i]`) or in an alert naming the blockers (publishing and delete rules).
 */
function MissionEditor({ initial, reference }: { initial: AdminMission | null; reference: ReferenceData }) {
  const t = useT();
  const id = useId();
  const queryClient = useQueryClient();
  const root = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState<AdminMission | null>(initial);
  const [form, setForm] = useState<MissionForm>(() => (initial ? fromAdminMission(initial) : emptyMissionForm()));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<unknown>(null);
  const [saveStatus, setSaveStatus] = useState<'created' | 'updated' | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [actionStatus, setActionStatus] = useState<'published' | 'unpublished' | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [search, setSearch] = useState('');
  const focusAfter = useRef<FocusTarget>(null);
  const tasks = useTasks({ topicId: form.topicId }, !!form.topicId);

  const byId = new Map((tasks.data ?? []).map((task) => [task.taskId, task]));
  const full = form.taskIds.length >= MAX_TASKS;
  const dirty = isDirty(form, saved);
  const query = fold(search.trim());
  const available = (tasks.data ?? []).filter((task) => !form.taskIds.includes(task.taskId) && fold(task.promptExcerpt).includes(query));

  useEffect(() => {
    const target = focusAfter.current;
    focusAfter.current = null;
    const scope = root.current as HTMLDivElement;
    const find = (selector: string) => scope.querySelector<HTMLButtonElement>(selector);
    if (!target) return;
    if (target.kind === 'search') return find('[data-search]')?.focus();
    if (target.kind === 'add') {
      const adds = [...scope.querySelectorAll<HTMLButtonElement>('[data-add]')];
      return (adds[target.index] ?? adds[target.index - 1] ?? find('[data-search]'))?.focus();
    }
    const button = find(`[data-task="${target.taskId}"][data-kind="${target.kind}"]`);
    const other = find(`[data-task="${target.taskId}"][data-kind="${target.kind === 'up' ? 'down' : 'up'}"]`);
    (button && !button.disabled ? button : other)?.focus();
  }, [form.taskIds]);

  /** A structural change of the task list: errors keyed by index no longer point at the right row. */
  const changeTasks = (taskIds: string[], focus: FocusTarget) => {
    focusAfter.current = focus;
    setErrors({});
    setForm((f) => ({ ...f, taskIds }));
  };
  const move = (i: number, delta: number) => changeTasks(moveTask(form.taskIds, i, delta), { kind: delta < 0 ? 'up' : 'down', taskId: form.taskIds[i] });
  const remove = (i: number) => {
    const next = removeTask(form.taskIds, i);
    const neighbour = next[i] ?? next[i - 1];
    changeTasks(next, neighbour ? { kind: 'remove', taskId: neighbour } : { kind: 'search' });
  };
  const add = (taskId: string, index: number) => changeTasks(addTask(form.taskIds, taskId), { kind: 'add', index });

  const describeTask = (taskId: string): Blocker | null => {
    const task = byId.get(taskId);
    return task ? { label: <span data-content>{task.promptExcerpt}</span>, href: `/admin/tasks/edit?taskId=${taskId}` } : null;
  };

  async function refresh(result: AdminMission) {
    queryClient.setQueryData(missionKey(result.missionId), result);
    // Membership shows on each task (`missionIds`), and the list shows the counter and status.
    await queryClient.invalidateQueries({ queryKey: MISSIONS_KEY });
    await queryClient.invalidateQueries({ queryKey: ['admin', 'task'] });
    await refreshTaskRows();
  }

  /** The rows show each task's status: tasks published or unpublished elsewhere must not stay stale. */
  async function refreshTaskRows() {
    await queryClient.invalidateQueries({ queryKey: TASKS_KEY });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaveStatus(null);
    setSaveError(null);
    setActionStatus(null);
    setActionError(null);
    if (parsePosition(form.position) === null) {
      setErrors({ position: t('admin.missionEditor.positionInvalid') });
      return;
    }
    const submitted = form;
    setBusy(true);
    try {
      const result = await saveMission(saved?.missionId ?? null, toMissionInput(form));
      setErrors({});
      // The new mission is now the one being edited: a reload keeps it.
      if (!saved) window.history.replaceState(null, '', `/admin/missions/edit?missionId=${result.missionId}`);
      setSaveStatus(saved ? 'updated' : 'created');
      setSaved(result);
      setForm((f) => (f === submitted ? fromAdminMission(result) : f));
      await refresh(result);
    } catch (error) {
      const fields = fieldErrors(error);
      setErrors(fields);
      if (!Object.keys(fields).length) setSaveError(error);
    }
    setBusy(false);
  }

  /** A new action replaces every earlier outcome on screen. */
  function clearOutcomes() {
    setSaveStatus(null);
    setSaveError(null);
    setErrors({});
    setActionStatus(null);
    setActionError(null);
  }

  async function changeStatus(mission: AdminMission) {
    clearOutcomes();
    const next = mission.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    setBusy(true);
    try {
      const result = await setMissionStatus(mission.missionId, next);
      setSaved(result);
      setActionStatus(next === 'PUBLISHED' ? 'published' : 'unpublished');
      await refresh(result);
    } catch (error) {
      setActionError(error);
      await refreshTaskRows();
    }
    setBusy(false);
  }

  async function destroy(mission: AdminMission) {
    clearOutcomes();
    setBusy(true);
    try {
      await deleteMission(mission.missionId);
      queryClient.removeQueries({ queryKey: missionKey(mission.missionId) });
      setDeleted(true);
      await queryClient.invalidateQueries({ queryKey: MISSIONS_KEY });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'task'] });
    } catch (error) {
      setActionError(error);
    }
    setBusy(false);
  }

  if (deleted)
    return (
      <AdminLayout title={t('admin.missionEditor.editTitle')}>
        <p role="status" className="admin-ok">
          {t('admin.missionEditor.deleted')}
        </p>
        <p>
          <a className="admin-link" href="/admin/missions">
            {t('admin.missionEditor.back')}
          </a>
        </p>
      </AdminLayout>
    );

  const listTitle = `${id}-tasks`;
  return (
    <AdminLayout title={t(saved ? 'admin.missionEditor.editTitle' : 'admin.missionEditor.newTitle')}>
      <div ref={root} className="admin-form">
        <form className="admin-form" onSubmit={(e) => void save(e)} noValidate>
          <div className="admin-row">
            <Field
              label={t('admin.missionEditor.topic')}
              path="topicId"
              errors={errors}
              hint={form.taskIds.length ? t('admin.missionEditor.topicLocked') : undefined}
            >
              {(p) => (
                <select
                  {...p}
                  data-content={undefined}
                  className="admin-field"
                  value={form.topicId}
                  disabled={form.taskIds.length > 0}
                  onChange={(e) => {
                    setSearch('');
                    setForm((f) => ({ ...f, topicId: e.target.value }));
                  }}
                >
                  <option value="">{t('admin.common.choose')}</option>
                  {reference.topics.map((tp) => (
                    <option key={tp.topicId} value={tp.topicId} data-content>
                      {tp.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={t('admin.missionEditor.position')} path="position" errors={errors} hint={t('admin.missionEditor.positionHint')}>
              {(p) => (
                <input {...p} className="admin-field" inputMode="numeric" value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} />
              )}
            </Field>
          </div>

          <section className="admin-section" aria-labelledby={listTitle}>
            <h2 id={listTitle} className="dk-t-heading">
              {t('admin.missionEditor.tasks')}
            </h2>
            <p className="mission-counter" aria-live="polite">
              {format(t('admin.missions.counter'), { count: form.taskIds.length })}
            </p>
            {!form.taskIds.length && <p>{t('admin.missionEditor.noTasks')}</p>}
            <ol className="mission-tasks" aria-labelledby={listTitle}>
              {form.taskIds.map((taskId, i) => {
                const task = byId.get(taskId);
                const path = `taskIds[${i}]`;
                const errorId = `${id}-error-${i}`;
                const n = i + 1;
                return (
                  <li key={taskId} data-field={path}>
                    <span className="mission-num">{n}.</span>
                    <span className="mission-task-text">
                      {task ? <span data-content>{task.promptExcerpt}</span> : <span>{format(t('admin.conflict.unknownItem'), { id: taskId })}</span>}
                      <TaskChips task={task} />
                    </span>
                    <span className="admin-actions">
                      <Button data-task={taskId} data-kind="up" disabled={i === 0} onClick={() => move(i, -1)}>
                        {format(t('admin.missionEditor.moveUp'), { n })}
                      </Button>
                      <Button data-task={taskId} data-kind="down" disabled={i === form.taskIds.length - 1} onClick={() => move(i, 1)}>
                        {format(t('admin.missionEditor.moveDown'), { n })}
                      </Button>
                      <Button
                        data-task={taskId}
                        data-kind="remove"
                        aria-describedby={errors[path] ? errorId : undefined}
                        onClick={() => remove(i)}
                      >
                        {format(t('admin.missionEditor.remove'), { n })}
                      </Button>
                    </span>
                    {errors[path] && (
                      <p id={errorId} className="admin-error" data-content>
                        {errors[path]}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>

          <FormAlert errors={errors} failure={saveError && !(saveError instanceof ApiError && saveError.problem) ? t('admin.common.saveFailed') : null} />
          {saveError instanceof ApiError && saveError.problem && <ConflictAlert error={saveError} describe={describeTask} />}
          {saveStatus && (
            <p role="status" className="admin-ok">
              {t(saveStatus === 'created' ? 'admin.missionEditor.created' : 'admin.missionEditor.updated')}
            </p>
          )}
          <div>
            <Button type="submit" variant="primary" disabled={busy}>
              {t('admin.missionEditor.save')}
            </Button>
          </div>
        </form>

        <Panel title={t('admin.missionEditor.addTitle')} ariaLabel={t('admin.missionEditor.addTitle')}>
          {!form.topicId ? (
            <p>{t('admin.missionEditor.chooseTopic')}</p>
          ) : (
            <div className="admin-form">
              <Field label={t('admin.missionEditor.search')} path="q" errors={{}}>
                {(p) => <input {...p} data-search className="admin-field" type="search" value={search} onChange={(e) => setSearch(e.target.value)} />}
              </Field>
              {full && <p className="admin-alert">{t('admin.missionEditor.max')}</p>}
              {!tasks.data ? (
                <LoadState error={tasks.isError} onRetry={() => void tasks.refetch()} />
              ) : !available.length ? (
                <p>{t('admin.missionEditor.noneToAdd')}</p>
              ) : (
                <ul className="mission-picker mission-picker-list">
                  {available.map((task, index) => {
                    const promptId = `${id}-pick-${task.taskId}`;
                    const buttonId = `${id}-add-${task.taskId}`;
                    return (
                      <li key={task.taskId}>
                        <span className="mission-task-text">
                          <span id={promptId} data-content>
                            {task.promptExcerpt}
                          </span>
                          <TaskChips task={task} />
                        </span>
                        <Button id={buttonId} data-add aria-labelledby={`${buttonId} ${promptId}`} disabled={full} onClick={() => add(task.taskId, index)}>
                          {t('admin.missionEditor.add')}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </Panel>

        {saved && (
          <Panel title={t('admin.missionEditor.statusTitle')} ariaLabel={t('admin.missionEditor.statusTitle')}>
            <div className="admin-form">
              <div className="admin-actions">
                <Chip tone={saved.status === 'PUBLISHED' ? 'spark' : 'neutral'}>{t(`admin.status.${saved.status}` as const)}</Chip>
              </div>
              <div className="admin-actions">
                <Button disabled={busy || dirty} onClick={() => void changeStatus(saved)}>
                  {t(saved.status === 'PUBLISHED' ? 'admin.missionEditor.unpublish' : 'admin.missionEditor.publish')}
                </Button>
                {dirty && <span className="admin-muted">{t('admin.missionEditor.saveFirst')}</span>}
              </div>
              <ConflictAlert error={actionError} describe={describeTask} />
              {actionStatus && (
                <p role="status" className="admin-ok">
                  {t(actionStatus === 'published' ? 'admin.missionEditor.published' : 'admin.missionEditor.unpublished')}
                </p>
              )}
              {!saved.deletable && <p>{t('admin.missionEditor.notDeletable')}</p>}
              <DeleteControl
                label={t('admin.missionEditor.delete')}
                question={t('admin.missionEditor.confirmDelete')}
                disabled={!saved.deletable || busy}
                onConfirm={() => destroy(saved)}
              />
            </div>
          </Panel>
        )}
      </div>
    </AdminLayout>
  );
}

/** Route `/admin/missions/edit[?missionId=…]`: a new mission, or a saved one. */
export function MissionEditorScreen() {
  const t = useT();
  const missionId = queryParam('missionId');
  const reference = useReference();
  const mission = useMission(missionId);
  const title = t(missionId ? 'admin.missionEditor.editTitle' : 'admin.missionEditor.newTitle');

  if (mission.error instanceof ApiError && mission.error.status === 404)
    return (
      <AdminLayout title={title}>
        <p role="alert">{t('admin.missionEditor.notFound')}</p>
        <p>
          <a className="admin-link" href="/admin/missions">
            {t('admin.missionEditor.back')}
          </a>
        </p>
      </AdminLayout>
    );
  if (!reference.data || (missionId && !mission.data))
    return (
      <AdminLayout title={title}>
        <LoadState
          error={reference.isError || mission.isError}
          onRetry={() => {
            void reference.refetch();
            if (missionId) void mission.refetch();
          }}
        />
      </AdminLayout>
    );
  return <MissionEditor initial={mission.data ?? null} reference={reference.data} />;
}
