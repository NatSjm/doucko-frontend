import { useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { routePath } from '@/app/route-paths';
import { Button } from '@/design-system';
import { useT, type MessageKey } from '@/i18n';
import { endAdminSession, signOut } from './session';
import './admin-access.css';

const NAV: { href: string; label: MessageKey }[] = [
  { href: '/admin', label: 'admin.nav.home' },
  { href: '/admin/tasks', label: 'admin.nav.tasks' },
  { href: '/admin/tasks/edit', label: 'admin.nav.newTask' },
  { href: '/admin/missions', label: 'admin.nav.missions' },
  { href: '/admin/missions/edit', label: 'admin.nav.newMission' },
  { href: '/admin/sources', label: 'admin.nav.sources' },
  { href: '/admin/stats', label: 'admin.nav.stats' },
  { href: '/admin/reports', label: 'admin.nav.reports' },
];

/**
 * The frame of every signed-in admin screen: navigation (full page loads), sign-out and the
 * screen's `<main>` with its title. Sign-out returns to the sign-in form (admin-access).
 */
export function AdminLayout({ title, wide = false, children }: { title: ReactNode; wide?: boolean; children: ReactNode }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const current = routePath(window.location.pathname);

  /** Any failure (no server, a refused CSRF token, a 5xx) keeps the screen and says sign-out failed. */
  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut();
      endAdminSession(queryClient);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <span className="admin-brand dk-t-heading">{t('app.name')}</span>
        <nav aria-label={t('admin.nav.label')}>
          <ul className="admin-nav">
            {NAV.map((item) => (
              <li key={item.href}>
                <a className="admin-nav-link" href={item.href} aria-current={current === item.href ? 'page' : undefined}>
                  {t(item.label)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <Button disabled={busy} onClick={() => void handleSignOut()}>
          {t('admin.home.signOut')}
        </Button>
      </header>
      {failed && (
        <p role="alert" className="admin-banner">
          {t('admin.home.signOutFailed')}
        </p>
      )}
      <main className={wide ? 'admin-main admin-main-wide' : 'admin-main'}>
        <h1 className="dk-t-title">{title}</h1>
        {children}
      </main>
    </div>
  );
}

/** A status line while a screen loads, and an alert with a retry when it could not. */
export function LoadState({ error, onRetry }: { error: boolean; onRetry: () => void }) {
  const t = useT();
  if (!error) return <p role="status">{t('admin.common.loading')}</p>;
  return (
    <div className="admin-stack">
      <p role="alert">{t('admin.common.loadFailed')}</p>
      <div>
        <Button onClick={onRetry}>{t('admin.session.retry')}</Button>
      </div>
    </div>
  );
}
