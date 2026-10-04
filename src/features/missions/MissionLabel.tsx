import { useT } from '@/i18n';
import { format } from '@/i18n/format';

/** A mission has no name in MVP (CA-D17): it is named by its topic and its position on HQ. */
export function MissionLabel({ topicName, position }: { topicName: string | undefined; position: number }) {
  const t = useT();
  return (
    <>
      <span data-content>{topicName}</span>
      {' · '}
      {format(t('admin.missions.label'), { position })}
    </>
  );
}
