import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/design-system';
import { useT } from '@/i18n';
import { AdminGate } from './AdminGate';
import { ADMIN_SESSION_KEY, signOut } from './session';
import './admin-access.css';

/** The admin home until the authoring slice adds its screens: a heading and sign-out. */
function AdminHome() {
  const t = useT();
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  /** Any failure (no server, a refused CSRF token, a 5xx) keeps the admin home and says sign-out failed. */
  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut();
      queryClient.setQueryData(ADMIN_SESSION_KEY, false);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <div className="admin-stack">
        <h1 className="dk-t-title">{t('admin.home.title')}</h1>
        <p>{t('admin.home.signedIn')}</p>
        {failed && <p role="alert">{t('admin.home.signOutFailed')}</p>}
        <Button disabled={busy} onClick={() => void handleSignOut()}>{t('admin.home.signOut')}</Button>
      </div>
    </main>
  );
}

/** Route `/admin`: the English admin app (NFR-9) behind the session gate. */
export function AdminArea() {
  return (
    <div lang="en" className="admin-area">
      <AdminGate>
        <AdminHome />
      </AdminGate>
    </div>
  );
}
