import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { Button } from '@/design-system';
import { useT } from '@/i18n';
import { onAdminUnauthorized } from './adminClient';
import { ADMIN_SESSION_KEY, checkAdminSession, endAdminSession } from './session';
import { SignInForm } from './SignInForm';

/**
 * Shows [children] only with an admin session (store spec admin-access, NFR-1). Without one, or as
 * soon as any admin request is answered 401 (idle expiry, NFR-15), it shows the sign-in form instead.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const t = useT();
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: ADMIN_SESSION_KEY, queryFn: checkAdminSession });

  useEffect(() => onAdminUnauthorized(() => endAdminSession(queryClient)), [queryClient]);

  if (session.data === undefined) {
    return (
      <main className="app-shell">
        {session.isError ? (
          <div className="admin-stack">
            <p role="alert">{t('admin.session.unreachable')}</p>
            <Button onClick={() => void session.refetch()}>{t('admin.session.retry')}</Button>
          </div>
        ) : (
          <p role="status">{t('admin.session.checking')}</p>
        )}
      </main>
    );
  }
  if (!session.data) return <SignInForm onSignedIn={() => queryClient.setQueryData(ADMIN_SESSION_KEY, true)} />;
  return children;
}
