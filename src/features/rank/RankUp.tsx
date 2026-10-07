import { useEffect, useId, useRef } from 'react';
import { Button, RankBadge } from '@/design-system';
import { useT } from '@/i18n';
import { format } from '@/i18n/format';
import { ackRankUp, type Rank } from './api';
import './rank.css';

/**
 * Acknowledges a shown celebration once (`ackRankUp`), so the server never offers it again (FR-36).
 * A ref keeps React's double effects (StrictMode) from sending it twice. A failed acknowledgement is
 * not the child's problem: the celebration may then play once more on a later visit, never lost.
 */
function useAcknowledge(rank: Rank, enabled: boolean) {
  const sent = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled || sent.current === rank.index) return;
    sent.current = rank.index;
    ackRankUp(rank.index).catch(() => undefined);
  }, [enabled, rank.index]);
}

/**
 * The rank-up celebration (gamification "Rank-up celebration"): the rank medal, "Nová hodnost!" and
 * the new rank's name. The medal pops in and the speed lines turn once; under
 * `prefers-reduced-motion` nothing moves and the same text and medal are shown (NFR-13). A
 * celebration from HQ or the summary is acknowledged as soon as it is shown (`acknowledge`); one
 * carried by an attempt result is not (its response is the only carrier). `onClose` adds "Super!".
 */
export function RankUpCelebration({ rank, acknowledge = false, onClose }: { rank: Rank; acknowledge?: boolean; onClose?: () => void }) {
  const t = useT();
  const id = useId();
  useAcknowledge(rank, acknowledge);
  return (
    <section role="status" aria-labelledby={id} className="dk-panel dk-panel-hero rankup">
      <div className="rankup-medal">
        <span className="dk-speedlines rankup-lines" aria-hidden="true" />
        <span className="rankup-badge">
          <RankBadge rank={rank.name} level={rank.index + 1} size="lg" hideName />
        </span>
      </div>
      <div className="rankup-text">
        <p id={id} className="dk-kicker rankup-kicker">
          {t('child.rankUp.kicker')}
        </p>
        <p className="dk-t-title rankup-name" data-content>
          {rank.name}
        </p>
        <p className="rankup-line">{format(t('child.rankUp.text'), { rank: rank.name })}</p>
        {onClose && (
          <div>
            <Button variant="primary" onClick={onClose}>
              {t('child.rankUp.close')}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
