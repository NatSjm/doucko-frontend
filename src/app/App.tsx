import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { I18nProvider } from '@/i18n';
import { createQueryClient } from './queryClient';
import { routes } from './routes';
import './app.css';

/** App shell: providers + the only route so far (no router until a slice has a second route). */
export function App() {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>{routes[0].element}</I18nProvider>
    </QueryClientProvider>
  );
}
