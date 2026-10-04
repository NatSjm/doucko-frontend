import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { I18nProvider, type Messages } from '@/i18n';

/** Renders `ui` with a fresh query client (no retries) and the catalog, at `path` (query included). */
export function renderAt(ui: ReactElement, path = '/', messages?: Messages) {
  window.history.pushState({}, '', path);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider messages={messages}>{ui}</I18nProvider>
    </QueryClientProvider>,
  );
}
