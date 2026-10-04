import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { queryParam } from '@/app/route-paths';
import { Button, Panel } from '@/design-system';
import { AdminLayout, LoadState } from '@/features/admin-access/AdminLayout';
import { ConflictAlert, type Blocker } from '@/features/admin-access/ConflictAlert';
import { DeleteControl } from '@/features/admin-access/DeleteControl';
import { Field, FormAlert } from '@/features/admin-access/form';
import { ApiError, fieldErrors } from '@/features/admin-access/problem';
import { TASKS_KEY, useTasks } from '@/features/tasks/api';
import { useT } from '@/i18n';
import { deleteSource, SOURCES_KEY, updateSource, useReference, useSource, type ReferenceData, type Source, type SourceMetadata } from './api';
import { subjectKey } from './subject';
import './sources.css';

const toMeta = (s: Source): SourceMetadata => ({
  title: s.title,
  publisher: s.publisher ?? '',
  edition: s.edition ?? '',
  grade: String(s.grade),
  subject: s.subject,
});

/** A refusal with a problem body goes to the conflict alert; without one, "saving failed". */
const hasProblem = (error: unknown) => error instanceof ApiError && !!error.problem;

/**
 * The metadata form of a stored source (FR-55): no file field, the PDF cannot be replaced (CA-D3).
 * Field refusals land on their field; a state refusal (grade locked while tasks reference the source)
 * and a refused delete name the referencing tasks.
 */
function SourceEditForm({ source, reference, onDeleted }: { source: Source; reference: ReferenceData; onDeleted: () => void }) {
  const t = useT();
  const queryClient = useQueryClient();
  const tasks = useTasks({ sourceId: source.sourceId });
  const [meta, setMeta] = useState<SourceMetadata>(() => toMeta(source));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<unknown>(null);
  const [deleteError, setDeleteError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (name: keyof SourceMetadata, value: string) => setMeta((m) => ({ ...m, [name]: value }));
  const describeTask = (taskId: string): Blocker | null => {
    const task = tasks.data?.find((x) => x.taskId === taskId);
    return task ? { label: <span data-content>{task.promptExcerpt}</span>, href: `/admin/tasks/edit?taskId=${taskId}` } : null;
  };

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    setSaveError(null);
    setDeleteError(null);
    setBusy(true);
    try {
      // The form keeps what the admin typed (also anything typed while the save ran).
      await updateSource(source.sourceId, meta);
      setErrors({});
      setSaved(true);
      // Provenance on every task of the source shows the new title and edition.
      await queryClient.invalidateQueries({ queryKey: SOURCES_KEY });
      await queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'task'] });
    } catch (error) {
      const fields = fieldErrors(error);
      setErrors(fields);
      if (!Object.keys(fields).length) setSaveError(error);
    }
    setBusy(false);
  }

  async function destroy() {
    setSaved(false);
    setSaveError(null);
    setDeleteError(null);
    try {
      await deleteSource(source.sourceId);
      onDeleted();
      queryClient.removeQueries({ queryKey: [...SOURCES_KEY, source.sourceId] });
      await queryClient.invalidateQueries({ queryKey: SOURCES_KEY });
    } catch (error) {
      setDeleteError(error);
    }
  }

  return (
    <>
      <form className="admin-form" onSubmit={(e) => void save(e)} noValidate>
        <p className="admin-muted">{t('admin.sourceEdit.noFile')}</p>
        <Field label={t('admin.sources.sourceTitle')} path="title" errors={errors}>
          {(p) => <input {...p} className="admin-field" value={meta.title} onChange={(e) => set('title', e.target.value)} />}
        </Field>
        <div className="admin-row">
          <Field label={t('admin.sources.publisher')} path="publisher" errors={errors}>
            {(p) => <input {...p} className="admin-field" value={meta.publisher} onChange={(e) => set('publisher', e.target.value)} />}
          </Field>
          <Field label={t('admin.sources.edition')} path="edition" errors={errors}>
            {(p) => <input {...p} className="admin-field" value={meta.edition} onChange={(e) => set('edition', e.target.value)} />}
          </Field>
          <Field label={t('admin.sources.grade')} path="grade" errors={errors}>
            {(p) => (
              <select {...p} data-content={undefined} className="admin-field" value={meta.grade} onChange={(e) => set('grade', e.target.value)}>
                {reference.grades.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t('admin.sources.subject')} path="subject" errors={errors}>
            {(p) => (
              <select {...p} data-content={undefined} className="admin-field" value={meta.subject} onChange={(e) => set('subject', e.target.value)}>
                {reference.subjects.map((s) => {
                  const key = subjectKey(s);
                  return key ? (
                    <option key={s} value={s}>
                      {t(key)}
                    </option>
                  ) : (
                    <option key={s} value={s} data-content>
                      {s}
                    </option>
                  );
                })}
              </select>
            )}
          </Field>
        </div>
        <FormAlert errors={errors} failure={saveError && !hasProblem(saveError) ? t('admin.common.saveFailed') : null} />
        {hasProblem(saveError) && <ConflictAlert error={saveError} describe={describeTask} />}
        {saved && (
          <p role="status" className="admin-ok">
            {t('admin.sourceEdit.saved')}
          </p>
        )}
        <div className="admin-actions">
          <Button type="submit" variant="primary" disabled={busy}>
            {t('admin.sourceEdit.save')}
          </Button>
          <a className="admin-link" href={`/admin/sources/view?sourceId=${source.sourceId}&page=1`}>
            {t('admin.sources.view')}
          </a>
        </div>
      </form>
      <Panel title={t('admin.sourceEdit.deleteTitle')} ariaLabel={t('admin.sourceEdit.deleteTitle')}>
        <div className="admin-form">
          <ConflictAlert error={deleteError} describe={describeTask} />
          <DeleteControl label={t('admin.sourceEdit.delete')} question={t('admin.sourceEdit.confirmDelete')} onConfirm={destroy} />
        </div>
      </Panel>
    </>
  );
}

/** Route `/admin/sources/edit?sourceId=…`: edit a source's metadata, or delete it (FR-55). */
export function SourceEditScreen() {
  const t = useT();
  const sourceId = queryParam('sourceId');
  const reference = useReference();
  const source = useSource(sourceId);
  const [deleted, setDeleted] = useState(false);
  const title = t('admin.sourceEdit.title');
  const back = (
    <p>
      <a className="admin-link" href="/admin/sources">
        {t('admin.sources.back')}
      </a>
    </p>
  );

  if (deleted)
    return (
      <AdminLayout title={title}>
        <p role="status" className="admin-ok">
          {t('admin.sourceEdit.deleted')}
        </p>
        {back}
      </AdminLayout>
    );
  if (!sourceId || (source.error instanceof ApiError && source.error.status === 404))
    return (
      <AdminLayout title={title}>
        <p role="alert">{t('admin.sources.notFound')}</p>
        {back}
      </AdminLayout>
    );
  if (!reference.data || !source.data)
    return (
      <AdminLayout title={title}>
        <LoadState
          error={reference.isError || source.isError}
          onRetry={() => {
            void reference.refetch();
            void source.refetch();
          }}
        />
      </AdminLayout>
    );
  return (
    <AdminLayout title={title}>
      <SourceEditForm source={source.data} reference={reference.data} onDeleted={() => setDeleted(true)} />
    </AdminLayout>
  );
}
