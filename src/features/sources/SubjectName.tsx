import { useT } from '@/i18n';
import { subjectKey } from './subject';

/** A subject by its catalog name, or by its configured key when the catalog has none. */
export function SubjectName({ subject }: { subject: string }) {
  const t = useT();
  const key = subjectKey(subject);
  return key ? <>{t(key)}</> : <span data-content>{subject}</span>;
}
