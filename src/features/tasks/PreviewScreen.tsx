import { useState, type FormEvent } from 'react';
import type { components } from '@/api/generated/schema';
import { queryParam } from '@/app/route-paths';
import { Button, Chip, Panel } from '@/design-system';
import { AdminLayout, LoadState } from '@/features/admin-access/AdminLayout';
import { Field } from '@/features/admin-access/form';
import { ApiError, problemMessage } from '@/features/admin-access/problem';
import { useObjectUrl } from '@/features/admin-access/useObjectUrl';
import { useReference } from '@/features/sources/api';
import { TaskView, type TaskViewData } from '@/features/task/TaskView';
import { useT } from '@/i18n';
import { format } from '@/i18n/format';
import { fetchImage, testAnswers, usePreview } from './api';
import './tasks.css';

type S = components['schemas'];

const NO_ERRORS: Record<string, string> = {};
const VERDICT_TONE = { CORRECT: 'spark', WRONG: 'almost', UNPARSEABLE: 'ink' } as const;

/** A task image of the preview, fetched through the admin client. */
function PreviewImage({ taskId, imageId, n }: { taskId: string; imageId: string; n: number }) {
  const t = useT();
  const src = useObjectUrl(['admin', 'image', imageId], () => fetchImage(taskId, imageId));
  return <img src={src} alt={format(t('child.task.image'), { n })} data-image-id={imageId} />;
}

/** The answer tester (FR-10): the admin's answers go to `testAnswers`; nothing is recorded. */
function AnswerTester({ task }: { task: TaskViewData }) {
  const t = useT();
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [results, setResults] = useState<S['PartResult'][]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const labels = Object.fromEntries(task.parts.map((p) => [p.key, p.label.cs]));

  async function check(event: FormEvent) {
    event.preventDefault();
    const body = Object.fromEntries(task.parts.map((p) => [p.key, answers[p.key] ?? (p.options ? [] : '')]));
    try {
      setResults(await testAnswers(task.taskId, body));
      setFailed(null);
    } catch (error) {
      setResults([]);
      setFailed(problemMessage(error) ?? t('admin.preview.checkFailed'));
    }
  }

  if (!task.parts.length) return <p>{t('admin.preview.noParts')}</p>;
  return (
    <form className="admin-form" onSubmit={(e) => void check(e)} noValidate>
      <p className="admin-muted">{t('admin.preview.testerIntro')}</p>
      {task.parts.map((part, i) => {
        const label = format(t('admin.preview.answerFor'), { label: part.label.cs });
        if (part.options) {
          const picked = (answers[part.key] as string[] | undefined) ?? [];
          return (
            <fieldset key={part.key} className="admin-fieldset">
              <legend className="admin-legend">{label}</legend>
              {part.options.map((o) => (
                <div key={o.key} className="admin-actions">
                  <label className="admin-check">
                    <input
                      type={part.type === 'CHOICE_SINGLE' ? 'radio' : 'checkbox'}
                      name={`tester-${part.key}`}
                      checked={picked.includes(o.key)}
                      onChange={(e) =>
                        setAnswers({
                          ...answers,
                          [part.key]: part.type === 'CHOICE_SINGLE' ? [o.key] : e.target.checked ? [...picked, o.key] : picked.filter((k) => k !== o.key),
                        })
                      }
                    />
                    {o.key}
                  </label>
                  <span data-content>{o.text.cs}</span>
                </div>
              ))}
            </fieldset>
          );
        }
        return (
          <Field key={part.key} label={label} path={`answers.${part.key}`} errors={NO_ERRORS}>
            {(p) => (
              <input
                {...p}
                className="admin-field"
                autoComplete="off"
                autoFocus={i === 0}
                value={(answers[part.key] as string | undefined) ?? ''}
                onChange={(e) => setAnswers({ ...answers, [part.key]: e.target.value })}
              />
            )}
          </Field>
        );
      })}
      <div>
        <Button type="submit" variant="primary">
          {t('admin.preview.check')}
        </Button>
      </div>
      {failed && (
        <p role="alert" data-content>
          {failed}
        </p>
      )}
      {results.map((r) => (
        <div key={r.key} role="group" aria-label={format(t('admin.preview.result'), { label: labels[r.key] })} className="tester-result">
          <Chip tone={VERDICT_TONE[r.verdict]}>{t(`admin.verdict.${r.verdict}` as const)}</Chip>
          {r.normalized !== null && (
            <span>
              {t('admin.preview.normalized')}{' '}
              <span className="admin-numeric" data-content>
                {r.normalized}
              </span>
            </span>
          )}
          {r.formatTip && (
            <span>
              {t('admin.preview.formatTip')}{' '}
              <span lang="cs" data-content>
                {r.formatTip}
              </span>
            </span>
          )}
        </div>
      ))}
    </form>
  );
}

/** Route `/admin/tasks/preview?taskId=…`: the child view of a task and the answer tester (FR-10). */
export function PreviewScreen() {
  const t = useT();
  const taskId = queryParam('taskId');
  const reference = useReference();
  /** The secondary task locale shown beside the Czech, or null while the translation is off. */
  const [locale, setLocale] = useState<string | null>(null);
  const preview = usePreview(taskId, locale);
  const title = t('admin.preview.title');

  if (!taskId || (preview.error instanceof ApiError && preview.error.status === 404))
    return (
      <AdminLayout title={title}>
        <p role="alert">{t('admin.editor.notFound')}</p>
      </AdminLayout>
    );
  if (!preview.data || !reference.data)
    return (
      <AdminLayout title={title}>
        <LoadState
          error={preview.isError || reference.isError}
          onRetry={() => {
            void preview.refetch();
            void reference.refetch();
          }}
        />
      </AdminLayout>
    );
  const task = preview.data;
  const firstLocale = reference.data.taskLocales[0];
  return (
    <AdminLayout title={title} wide>
      <p>
        <a className="admin-link" href={`/admin/tasks/edit?taskId=${task.taskId}`}>
          {t('admin.preview.edit')}
        </a>
      </p>
      <div className="preview-grid">
        <Panel title={t('admin.preview.childView')} ariaLabel={t('admin.preview.childView')}>
          <TaskView
            task={task}
            showTranslation={locale !== null}
            onToggleTranslation={() => setLocale(locale === null ? firstLocale : null)}
            renderImage={(image, i) => <PreviewImage key={image.imageId} taskId={task.taskId} imageId={image.imageId} n={i + 1} />}
          />
        </Panel>
        <Panel title={t('admin.preview.tester')} ariaLabel={t('admin.preview.tester')}>
          <AnswerTester task={task} />
        </Panel>
      </div>
    </AdminLayout>
  );
}
