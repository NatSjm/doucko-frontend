import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { I18nProvider, useT, type Messages } from '@/i18n';
import { NotFound } from './NotFound';
import { createQueryClient } from './queryClient';
import { routes } from './routes';
import './app.css';

/**
 * Renders the route registered for the current path (no client-side navigation until a slice has
 * a second route), marked with `data-route` so the e2e checks prove they reached that screen.
 * Any other path shows the not-found screen.
 */
function CurrentRoute() {
  const t = useT();
  useEffect(() => {
    document.title = t('app.name');
  }, [t]);
  const route = routes.find((r) => r.path === window.location.pathname);
  if (!route) return <NotFound />;
  return (
    <div className="app-route" data-route={route.path}>
      {route.element}
    </div>
  );
}

/** App shell: providers + the current route. Tests pass a pseudo-catalog through `messages` (NFR-9). */
export function App({ messages }: { messages?: Messages }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider messages={messages}>
        <CurrentRoute />
      </I18nProvider>
    </QueryClientProvider>
  );
}
