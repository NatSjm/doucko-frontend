import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { createQueryClient } from './queryClient';
import './app.css';

/** App shell: providers + placeholder until the first UI slice adds the child and admin routes. */
export function App() {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <main className="app-shell">
        <h1 className="dk-t-title">Doučko</h1>
      </main>
    </QueryClientProvider>
  );
}
