import type { ReactNode } from 'react';
import { useT } from '@/i18n';
import { format } from '@/i18n/format';
import { problemConflicts, problemMessage } from './problem';

/** How a screen names a blocking entity of a refusal: a label and the editor that fixes it. */
export interface Blocker {
  label: ReactNode;
  href: string;
}

/**
 * A refused action (content-authoring publishing and delete rules): the server's reason (`detail`,
 * else `title`) as received, and every id of `conflicts` named by `describe` and linked to its
 * editor. An id the screen cannot name is shown as the id. Without a problem body (no server, a 5xx
 * without problem+json) it says the action failed. Nothing without an error.
 */
export function ConflictAlert({ error, describe }: { error: unknown; describe: (id: string) => Blocker | null }) {
  const t = useT();
  if (!error) return null;
  const message = problemMessage(error);
  const ids = problemConflicts(error);
  return (
    <div role="alert" className="admin-alert">
      {message ? <p data-content>{message}</p> : <p>{t('admin.common.actionFailed')}</p>}
      {ids.length > 0 && (
        <>
          <p>{t('admin.conflict.blockedBy')}</p>
          <ul>
            {ids.map((id) => {
              const blocker = describe(id);
              return (
                <li key={id}>
                  {blocker ? (
                    <a className="admin-link" href={blocker.href}>
                      {blocker.label}
                    </a>
                  ) : (
                    format(t('admin.conflict.unknownItem'), { id })
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
