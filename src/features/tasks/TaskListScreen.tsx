import { useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState, type FormEvent } from 'react';
import type { components } from '@/api/generated/schema';
import { Button, Chip, Panel } from '@/design-system';
import { AdminLayout, LoadState } from '@/features/admin-access/AdminLayout';
import { Field, FormAlert } from '@/features/admin-access/form';
import { fieldErrors } from '@/features/admin-access/problem';
import { useReference, useSources } from '@/features/sources/api';
import { useT } from '@/i18n';
import { format } from '@/i18n/format';
import { bulkPublish, TASKS_KEY, useTasks, type TaskFilters, type TaskSummary } from './api';
import './tasks.css';

type S = components['schemas'];

/** Bulk publish takes 1 to 100 tasks (OQ-32). */
const MAX_PUBLISH = 100;
const MAX_QUERY = 200;

interface FilterForm {
  grade: string;
  topicId: string;
  sourceId: string;
  page: string;
  modality: string;
  status: string;
  q: string;
}
const NO_FILTERS: FilterForm = { grade: '', topicId: '', sourceId: '', page: '', modality: '', status: '', q: '' };

/** The query of `listTasks`: only the filters that are set; a blank search applies no text filter. */
function toQuery(f: FilterForm): TaskFilters {
  const query: TaskFilters = {};
  if (f.grade) query.grade = Number(f.grade);
  if (f.topicId) query.topicId = f.topicId;
  if (f.sourceId) query.sourceId = f.sourceId;
  if (f.page.trim()) query.page = Number(f.page.trim());
  if (f.modality) query.modality = f.modality as S['Modality'];
  if (f.status) query.status = f.status as S['PublishStatus'];
  if (f.q.trim()) query.q = f.q.trim();
  return query;
}

/** Errors the filters can have before sending: a page that is not a whole number, a search over 200 characters. */
function checkFilters(f: FilterForm, t: ReturnType<typeof useT>): Record<string, string> {
  const errors: Record<string, string> = {};
  if (f.page.trim() && !/^[1-9]\d{0,8}$/.test(f.page.trim())) errors.page = t('admin.tasks.pageInvalid');
  if ([...f.q.trim()].length > MAX_QUERY) errors.q = t('admin.tasks.searchTooLong');
  return errors;
}

const MODALITIES = ['TEXT', 'GRAPHIC'] as const;
const STATUSES = ['DRAFT', 'PUBLISHED'] as const;

/** A filter choice; "Any" applies no filter. Choosing applies the filters at once. */
function FilterSelect({
  path,
  label,
  value,
  errors,
  options,
  onChoose,
}: {
  path: keyof FilterForm;
  label: string;
  value: string;
  errors: Record<string, string>;
  options: { value: string; label: string; content?: boolean }[];
  onChoose: (name: keyof FilterForm, value: string) => void;
}) {
  const t = useT();
  return (
    <Field label={label} path={path} errors={errors}>
      {(p) => (
        <select {...p} data-content={undefined} className="admin-field" value={value} onChange={(e) => onChoose(path, e.target.value)}>
          <option value="">{t('admin.common.any')}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value} data-content={o.content || undefined}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

/** Source title, edition, page, task number and sub-part, with "Open source" at that page (FR-13). */
function Provenance({ task }: { task: TaskSummary }) {
  const t = useT();
  const p = task.provenance;
  return (
    <div className="task-prov">
      <span data-content>{p.sourceTitle}</span>
      <span>
        {p.edition && (
          <>
            {t('admin.prov.edition')} <span data-content>{p.edition}</span>
            {' · '}
          </>
        )}
        {t('admin.prov.page')} <span className="admin-numeric">{p.page}</span>
        {' · '}
        {t('admin.prov.taskNo')} <span data-content>{p.taskNo}</span>
        {p.subPart && (
          <>
            {' · '}
            {t('admin.prov.subPart')} <span data-content>{p.subPart}</span>
          </>
        )}
      </span>
      <a className="admin-link" href={`/admin/sources/view?sourceId=${p.sourceId}&page=${p.page}`}>
        {t('admin.tasks.openSource')}
      </a>
    </div>
  );
}

/** Route `/admin/tasks`: filters and search (FR-11), provenance (FR-13), bulk publish (OQ-32). */
export function TaskListScreen() {
  const t = useT();
  const id = useId();
  const queryClient = useQueryClient();
  const reference = useReference();
  const sources = useSources();
  const form = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState<FilterForm>(NO_FILTERS);
  const [filters, setFilters] = useState<TaskFilters>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [publishError, setPublishError] = useState<'tooMany' | 'failed' | null>(null);
  const [results, setResults] = useState<S['PublishResult'][] | null>(null);
  /** Prompts of the tasks sent to publish (selected tasks are always shown ones), so the result names them whatever the list shows next. */
  const [sentPrompts, setSentPrompts] = useState<Map<string, string>>(new Map());
  const tasks = useTasks(filters);

  /** Applies `next` (or the current draft): checked first, then sent as the list query. */
  function apply(next: FilterForm) {
    setDraft(next);
    const problems = checkFilters(next, t);
    setErrors(problems);
    if (Object.keys(problems).length) return;
    // Only shown tasks stay selectable: a hidden task is never published by mistake.
    setSelected([]);
    setFilters(toQuery(next));
  }
  const choose = (name: keyof FilterForm, value: string) => apply({ ...draft, [name]: value });

  function submit(event: FormEvent) {
    event.preventDefault();
    apply(draft);
  }

  async function publish() {
    setResults(null);
    if (selected.length > MAX_PUBLISH) return setPublishError('tooMany');
    setSentPrompts(new Map(selected.map((id) => [id, prompts.get(id) as string])));
    try {
      setResults(await bulkPublish(selected));
      setPublishError(null);
      setSelected([]);
      await queryClient.invalidateQueries({ queryKey: TASKS_KEY });
    } catch {
      setPublishError('failed');
    }
  }

  if (!reference.data || !sources.data)
    return (
      <AdminLayout title={t('admin.tasks.title')}>
        <LoadState
          error={reference.isError || sources.isError}
          onRetry={() => {
            void reference.refetch();
            void sources.refetch();
            void tasks.refetch();
          }}
        />
      </AdminLayout>
    );

  const topicName = new Map(reference.data.topics.map((tp) => [tp.topicId, tp.name]));
  const list = tasks.data ?? [];
  const serverErrors = fieldErrors(tasks.error);
  const allSelected = list.length > 0 && list.every((task) => selected.includes(task.taskId));
  const prompts = new Map(list.map((task) => [task.taskId, task.promptExcerpt]));

  const allErrors = { ...serverErrors, ...errors };

  return (
    <AdminLayout title={t('admin.tasks.title')} wide>
      <Panel title={t('admin.tasks.filters')}>
        <form ref={form} className="task-filters" onSubmit={submit} noValidate>
          <FilterSelect
            path="grade"
            label={t('admin.tasks.grade')}
            value={draft.grade}
            errors={allErrors}
            onChoose={choose}
            options={reference.data.grades.map((g) => ({ value: String(g), label: String(g) }))}
          />
          <FilterSelect
            path="topicId"
            label={t('admin.tasks.topic')}
            value={draft.topicId}
            errors={allErrors}
            onChoose={choose}
            options={reference.data.topics.map((tp) => ({ value: tp.topicId, label: tp.name, content: true }))}
          />
          <FilterSelect
            path="sourceId"
            label={t('admin.tasks.source')}
            value={draft.sourceId}
            errors={allErrors}
            onChoose={choose}
            options={sources.data.map((src) => ({ value: src.sourceId, label: src.title, content: true }))}
          />
          <Field label={t('admin.tasks.page')} path="page" errors={allErrors}>
            {(p) => <input {...p} className="admin-field" inputMode="numeric" value={draft.page} onChange={(e) => setDraft({ ...draft, page: e.target.value })} />}
          </Field>
          <FilterSelect
            path="modality"
            label={t('admin.tasks.modality')}
            value={draft.modality}
            errors={allErrors}
            onChoose={choose}
            options={MODALITIES.map((value) => ({ value, label: t(`admin.modality.${value}` as const) }))}
          />
          <FilterSelect
            path="status"
            label={t('admin.tasks.status')}
            value={draft.status}
            errors={allErrors}
            onChoose={choose}
            options={STATUSES.map((value) => ({ value, label: t(`admin.status.${value}` as const) }))}
          />
          <Field label={t('admin.tasks.search')} path="q" errors={allErrors}>
            {(p) => <input {...p} className="admin-field" type="search" value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />}
          </Field>
          <div>
            <Button type="submit">{t('admin.tasks.apply')}</Button>
          </div>
          <FormAlert errors={errors} failure={null} />
        </form>
      </Panel>

      <div className="admin-actions">
        <Button variant="primary" disabled={!selected.length} onClick={() => void publish()}>
          {format(t('admin.tasks.publishSelected'), { count: selected.length })}
        </Button>
        {tasks.data && <span>{format(t('admin.tasks.count'), { count: list.length })}</span>}
      </div>
      {publishError && <p role="alert">{t(publishError === 'tooMany' ? 'admin.tasks.tooMany' : 'admin.tasks.publishFailed')}</p>}
      {results && (
        <Panel title={t('admin.tasks.publishResult')} ariaLabel={t('admin.tasks.publishResult')}>
          <ul>
            {results.map((r) => (
              <li key={r.taskId}>
                <span data-content>{sentPrompts.get(r.taskId) ?? r.taskId}</span>
                {': '}
                {r.published ? (
                  <span>{t('admin.tasks.published')}</span>
                ) : (
                  <>
                    <span>{t('admin.tasks.notPublished')}</span> <span data-content>{r.reason}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {!tasks.data && !Object.keys(serverErrors).length && <LoadState error={tasks.isError} onRetry={() => void tasks.refetch()} />}
      {tasks.data && !list.length && <p>{t('admin.tasks.empty')}</p>}
      {list.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">
                  <label className="admin-check">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      aria-label={t('admin.tasks.selectAll')}
                      onChange={() => setSelected(allSelected ? [] : list.map((task) => task.taskId))}
                    />
                  </label>
                </th>
                <th scope="col">{t('admin.tasks.colPrompt')}</th>
                <th scope="col">{t('admin.tasks.colTopic')}</th>
                <th scope="col">{t('admin.tasks.colStatus')}</th>
                <th scope="col">{t('admin.tasks.colModality')}</th>
                <th scope="col">{t('admin.tasks.colSource')}</th>
                <th scope="col">{t('admin.tasks.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((task) => {
                const promptId = `${id}-${task.taskId}`;
                const on = selected.includes(task.taskId);
                return (
                  <tr key={task.taskId}>
                    <td>
                      <input
                        className="admin-check-input"
                        type="checkbox"
                        checked={on}
                        aria-labelledby={promptId}
                        onChange={() => setSelected(on ? selected.filter((x) => x !== task.taskId) : [...selected, task.taskId])}
                      />
                    </td>
                    <td id={promptId} data-content>
                      {task.promptExcerpt}
                    </td>
                    <td data-content>{topicName.get(task.topicId)}</td>
                    <td>
                      <Chip tone={task.status === 'PUBLISHED' ? 'spark' : 'neutral'}>{t(`admin.status.${task.status}` as const)}</Chip>
                    </td>
                    <td>
                      <Chip tone={task.modality === 'GRAPHIC' ? 'volt' : 'neutral'}>{t(`admin.modality.${task.modality}` as const)}</Chip>
                    </td>
                    <td>
                      <Provenance task={task} />
                    </td>
                    <td>
                      <div className="admin-actions">
                        <a className="admin-link" href={`/admin/tasks/edit?taskId=${task.taskId}`}>
                          {t('admin.tasks.edit')}
                        </a>
                        <a className="admin-link" href={`/admin/tasks/preview?taskId=${task.taskId}`}>
                          {t('admin.tasks.preview')}
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
