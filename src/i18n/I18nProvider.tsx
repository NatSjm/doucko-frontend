import type { ReactNode } from 'react';
import { messages, MessagesContext, type Messages } from './messages';

/**
 * Supplies the catalog. The app uses the real one; tests inject a pseudo-catalog (every value
 * prefixed with ⟦) to prove that no visible string bypasses it (NFR-9).
 */
export function I18nProvider({ messages: catalog = messages, children }: { messages?: Messages; children: ReactNode }) {
  return <MessagesContext.Provider value={catalog}>{children}</MessagesContext.Provider>;
}
