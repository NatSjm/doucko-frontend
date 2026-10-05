import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { I18nProvider, useT, type Messages } from '@/i18n';
import { useNavigationCount } from './navigation';
import { NotFound } from './NotFound';
import { createQueryClient } from './queryClient';
import { routePath } from './route-paths';
import { routes } from './routes';
import './app.css';

/**
 * Renders the route registered for the current path, marked with `data-route` so the e2e checks
 * prove they reached that screen. Child screens navigate without a page load (`navigate`); every
 * navigation remounts the screen, so it reads its query afresh. Any other path shows the not-found
 * screen, marked `data-route="not-found"`.
 */
function CurrentRoute() {
  const t = useT();
  const navigation = useNavigationCount();
  useEffect(() => {
    document.title = t('app.name');
  }, [t]);
  const path = routePath(window.location.pathname);
  const route = routes.find((r) => r.path === path);
  if (!route)
    return (
      <div className="app-route" data-route="not-found">
        <NotFound />
      </div>
    );
  return (
    <div key={navigation} className="app-route" data-route={route.path}>
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
