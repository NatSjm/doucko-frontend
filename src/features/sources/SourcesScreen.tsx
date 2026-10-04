import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { Button, Panel } from '@/design-system';
import { AdminLayout, LoadState } from '@/features/admin-access/AdminLayout';
import { Field, FormAlert } from '@/features/admin-access/form';
import { fieldErrors, problemMessage } from '@/features/admin-access/problem';
import { useT } from '@/i18n';
import { SOURCES_KEY, uploadSource, useReference, useSources, type ReferenceData, type Source, type SourceMetadata } from './api';
import { subjectKey } from './subject';
import { SubjectName } from './SubjectName';
import { checkPdfFile } from './upload-limits';
import './sources.css';

const EMPTY = { title: '', publisher: '', edition: '' };

/** The upload form (FR-1): the file is checked before sending (NFR-17), refusals land on their field. */
function UploadForm({ reference }: { reference: ReferenceData }) {
  const t = useT();
  const queryClient = useQueryClient();
  const form = useRef<HTMLFormElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<SourceMetadata>({ ...EMPTY, grade: String(reference.grades[0]), subject: reference.subjects[0] });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const set = (name: keyof SourceMetadata, value: string) => setMeta((m) => ({ ...m, [name]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setDone(false);
    setFailure(null);
    const check = file ? await checkPdfFile(file) : 'missing';
    if (check !== 'ok') {
      setErrors({ file: t(check === 'missing' ? 'admin.sources.fileRequired' : 'admin.sources.fileRule') });
      return;
    }
    setBusy(true);
    try {
      await uploadSource(meta, file as File);
      setErrors({});
      setMeta((m) => ({ ...m, ...EMPTY }));
      setFile(null);
      (fileInput.current as HTMLInputElement).value = '';
      setDone(true);
      await queryClient.invalidateQueries({ queryKey: SOURCES_KEY });
    } catch (error) {
      const fields = fieldErrors(error);
      const message = problemMessage(error);
      // A 413 or 415 names no field: its message is about the file.
      if (!Object.keys(fields).length && message) fields.file = message;
      setErrors(fields);
      if (!Object.keys(fields).length) setFailure(t('admin.common.saveFailed'));
    }
    setBusy(false);
  }

  return (
    <Panel title={t('admin.sources.uploadTitle')}>
      <form ref={form} className="admin-form" onSubmit={(e) => void submit(e)} noValidate>
        <Field label={t('admin.sources.file')} path="file" errors={errors} hint={t('admin.sources.fileHint')}>
          {(p) => (
            <input
              {...p}
              ref={fileInput}
              className="admin-field"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          )}
        </Field>
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
        <FormAlert errors={errors} failure={failure} />
        {done && (
          <p role="status" className="admin-ok">
            {t('admin.sources.uploaded')}
          </p>
        )}
        <div>
          <Button type="submit" variant="primary" disabled={busy}>
            {t('admin.sources.upload')}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

/** The source list (FR-1): metadata and page count, with the viewer and a new task from it. */
function SourceList({ sources }: { sources: Source[] }) {
  const t = useT();
  if (!sources.length) return <p>{t('admin.sources.empty')}</p>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th scope="col">{t('admin.sources.colTitle')}</th>
            <th scope="col">{t('admin.sources.colPublisher')}</th>
            <th scope="col">{t('admin.sources.colEdition')}</th>
            <th scope="col">{t('admin.sources.colGrade')}</th>
            <th scope="col">{t('admin.sources.colSubject')}</th>
            <th scope="col">{t('admin.sources.colPages')}</th>
            <th scope="col">{t('admin.sources.colActions')}</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => (
            <tr key={s.sourceId}>
              <td data-content>{s.title}</td>
              <td data-content>{s.publisher}</td>
              <td data-content>{s.edition}</td>
              <td className="admin-numeric">{s.grade}</td>
              <td>
                <SubjectName subject={s.subject} />
              </td>
              <td className="admin-numeric">{s.pageCount}</td>
              <td>
                <div className="admin-actions">
                  <a className="admin-link" href={`/admin/sources/view?sourceId=${s.sourceId}&page=1`}>
                    {t('admin.sources.view')}
                  </a>
                  <a className="admin-link" href={`/admin/tasks/edit?sourceId=${s.sourceId}&page=1`}>
                    {t('admin.sources.newTask')}
                  </a>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Route `/admin/sources`: upload a PDF source and list the sources (FR-1, NFR-17). */
export function SourcesScreen() {
  const t = useT();
  const reference = useReference();
  const sources = useSources();
  if (!reference.data || !sources.data)
    return (
      <AdminLayout title={t('admin.sources.title')}>
        <LoadState
          error={reference.isError || sources.isError}
          onRetry={() => {
            void reference.refetch();
            void sources.refetch();
          }}
        />
      </AdminLayout>
    );
  return (
    <AdminLayout title={t('admin.sources.title')}>
      <UploadForm reference={reference.data} />
      <section className="admin-section" aria-labelledby="sources-list-title">
        <h2 id="sources-list-title" className="dk-t-heading">
          {t('admin.sources.listTitle')}
        </h2>
        <SourceList sources={sources.data} />
      </section>
    </AdminLayout>
  );
}
