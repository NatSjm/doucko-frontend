import { messages, type MessageKey } from '@/i18n';

/**
 * The catalog key of a configured subject's English name (`admin.subject.<key>`), or null for a key
 * the catalog does not know yet: subjects are configuration, so the caller then shows the key as data.
 */
export function subjectKey(subject: string): MessageKey | null {
  const key = `admin.subject.${subject}`;
  return key in messages ? (key as MessageKey) : null;
}
