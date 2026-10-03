import { useT } from '@/i18n';

/** The app shell until the first feature slice adds its screens: the product name as page heading. */
export function Shell() {
  const t = useT();
  return (
    <main className="app-shell">
      <h1 className="dk-t-title">{t('app.name')}</h1>
    </main>
  );
}
