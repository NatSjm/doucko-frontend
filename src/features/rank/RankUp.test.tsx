// @trace FR-36
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { messages as m } from '@/i18n';
import { format } from '@/i18n/format';
import { stubChildBackend } from '@/test/admin-backend';
import { PLACEHOLDER_LADDER } from '@/test/fake-child-backend';
import { renderAt } from '@/test/render';
import { RankUpCelebration } from './RankUp';

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, '', '/');
});

const partner = PLACEHOLDER_LADDER[1];
const acks = (seen: { path: string; body: string }[]) => seen.filter((r) => r.path === '/api/child/hq/rank-up-ack').map((r) => JSON.parse(r.body));

describe('rank-up celebration (FR-36)', () => {
  it('names the new rank with the medal and the Czech copy', () => {
    stubChildBackend();
    renderAt(<RankUpCelebration rank={partner} />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(m['child.rankUp.kicker']);
    expect(status).toHaveTextContent(partner.name);
    expect(status).toHaveTextContent(format(m['child.rankUp.text'], { rank: partner.name }));
    expect(status.querySelector('svg.dk-rank-medal')).not.toBeNull();
  });

  it('acknowledges the rank it shows exactly once, also under StrictMode double effects', async () => {
    const backend = stubChildBackend();
    renderAt(
      <StrictMode>
        <RankUpCelebration rank={partner} acknowledge />
      </StrictMode>,
    );
    await act(async () => {});
    expect(acks(backend.seen)).toEqual([{ rankIndex: 1 }]);
  });

  it('a celebration carried by an attempt result is not acknowledged (the response is its only carrier)', async () => {
    const backend = stubChildBackend();
    renderAt(<RankUpCelebration rank={partner} />);
    await act(async () => {});
    expect(acks(backend.seen)).toEqual([]);
  });

  it('"Super!" closes it when the screen lets it close; otherwise there is no button', async () => {
    stubChildBackend();
    const onClose = vi.fn();
    const { unmount } = renderAt(<RankUpCelebration rank={partner} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: m['child.rankUp.close'] }));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    renderAt(<RankUpCelebration rank={partner} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('a failed acknowledgement is not shown to the child', async () => {
    const backend = stubChildBackend();
    backend.down = true;
    renderAt(<RankUpCelebration rank={partner} acknowledge />);
    await act(async () => {});
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(partner.name);
  });
});

describe('reduced motion (NFR-13, FR-36 "Reduced motion")', () => {
  const css = readFileSync('src/features/rank/rank.css', 'utf8');

  it('the celebration animates by default', () => {
    expect(css).toMatch(/\.rankup[\w-]*[^{]*\{[^}]*animation:\s*rankup-/);
  });

  it('turns every celebration animation off under prefers-reduced-motion, leaving the same text and medal', () => {
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced.length).toBeGreaterThan(0);
    expect(reduced).toMatch(/animation:\s*none/);
    for (const cls of css.matchAll(/(\.rankup[\w-]*)[^{]*\{[^}]*animation:\s*rankup-/g)) expect(reduced).toContain(cls[1]);
  });
});
