import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Button, Panel } from '@/design-system';
import { fieldErrors, problemMessage } from '@/features/admin-access/problem';
import { useObjectUrl } from '@/features/admin-access/useObjectUrl';
import { checkImageFile } from '@/features/sources/upload-limits';
import { useT } from '@/i18n';
import { format } from '@/i18n/format';
import { addImage, deleteImage, fetchImage, reorderImages, type AdminTask } from './api';
import { move } from './taskForm';

/** A thumbnail of a task image, fetched through the admin client. */
function Thumbnail({ taskId, imageId, n }: { taskId: string; imageId: string; n: number }) {
  const t = useT();
  const src = useObjectUrl(['admin', 'image', imageId], () => fetchImage(taskId, imageId));
  return <img src={src} alt={format(t('admin.images.alt'), { n })} data-image-id={imageId} />;
}

/**
 * The images of a saved task (FR-4): attach PNG or JPG files of at most 5 MB (checked before
 * upload, NFR-17), move one earlier or later, remove one. The order is the one the child sees.
 */
export function ImagesEditor({ task, onChanged }: { task: AdminTask; onChanged: () => Promise<unknown> }) {
  const t = useT();
  const id = useId();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const ids = task.images.map((i) => i.imageId);

  async function run(action: () => Promise<unknown>, done: string | null) {
    setBusy(true);
    try {
      await action();
      setMessage(done ? { ok: true, text: done } : null);
      await onChanged();
      await queryClient.invalidateQueries({ queryKey: ['admin', 'preview', task.taskId] });
    } catch (error) {
      const text = fieldErrors(error).file ?? problemMessage(error) ?? t('admin.images.failed');
      setMessage({ ok: false, text });
    }
    setBusy(false);
  }

  async function attach(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if ((await checkImageFile(file)) !== 'ok') return setMessage({ ok: false, text: t('admin.images.rule') });
    await run(() => addImage(task.taskId, file), t('admin.images.attached'));
  }

  return (
    <Panel title={t('admin.images.title')} ariaLabel={t('admin.images.title')}>
      {ids.length ? (
        <ol className="editor-images">
          {ids.map((imageId, i) => (
            <li key={imageId}>
              <Thumbnail taskId={task.taskId} imageId={imageId} n={i + 1} />
              <Button variant="ghost" disabled={busy || i === 0} onClick={() => void run(() => reorderImages(task.taskId, move(ids, i, -1)), null)}>
                {format(t('admin.images.moveEarlier'), { n: i + 1 })}
              </Button>
              <Button
                variant="ghost"
                disabled={busy || i === ids.length - 1}
                onClick={() => void run(() => reorderImages(task.taskId, move(ids, i, 1)), null)}
              >
                {format(t('admin.images.moveLater'), { n: i + 1 })}
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => void run(() => deleteImage(task.taskId, imageId), null)}>
                {format(t('admin.images.remove'), { n: i + 1 })}
              </Button>
            </li>
          ))}
        </ol>
      ) : (
        <p>{t('admin.images.empty')}</p>
      )}
      <div className="admin-control">
        <label htmlFor={id}>{t('admin.images.add')}</label>
        <input
          id={id}
          className="admin-field"
          type="file"
          accept="image/png,image/jpeg"
          disabled={busy}
          aria-describedby={`${id}-rule`}
          onChange={(e) => void attach(e.target)}
        />
        <p id={`${id}-rule`} className="admin-hint">
          {t('admin.images.hint')}
        </p>
      </div>
      {message &&
        (message.ok ? (
          <p role="status" className="admin-ok">
            {message.text}
          </p>
        ) : (
          <p role="alert" className="admin-alert" data-content>
            {message.text}
          </p>
        ))}
    </Panel>
  );
}
