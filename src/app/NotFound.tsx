import { useT } from '@/i18n';

/** Shown for any path that is not in the route registry. */
export function NotFound() {
  const t = useT();
  return (
    <main className="app-shell">
      <h1 className="dk-t-title">{t('app.notFound')}</h1>
    </main>
  );
}
