// @trace FR-37
// @trace FR-36
// @trace FR-38
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { messages as m } from '@/i18n';
import { format } from '@/i18n/format';
import { stubChildBackend } from '@/test/admin-backend';
import { creditOutsideSession, PLACEHOLDER_LADDER, PRACTICE, practise } from '@/test/fake-child-backend';
import { renderAt } from '@/test/render';
import { HqScreen } from './HqScreen';

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, '', '/');
});

const [rank1, rank2, rank3, , rank5] = PLACEHOLDER_LADDER.map((r) => r.name);
const panel = () => screen.getByRole('region', { name: m['child.hq.progressTitle'] });
const bar = () => within(panel()).getByRole('progressbar', { name: m['child.hq.xpBar'] });
const acks = (seen: { path: string; body: string }[]) => seen.filter((r) => r.path === '/api/child/hq/rank-up-ack').map((r) => JSON.parse(r.body));

async function openHq(totalXp?: number) {
  const backend = stubChildBackend();
  if (totalXp !== undefined) backend.practice.totalXp = totalXp;
  return backend;
}

describe('HQ progress (FR-37)', () => {
  it('a fresh profile: the 1st rank, an empty bar at 0 of 150 XP and 0 solved tasks', async () => {
    await openHq();
    renderAt(<HqScreen />, '/');
    await screen.findByRole('region', { name: m['child.hq.progressTitle'] });
    expect(panel()).toHaveTextContent(rank1);
    expect(panel()).toHaveTextContent(format(m['child.hq.rank'], { n: 1 }));
    expect(panel()).toHaveTextContent(format(m['child.hq.xpTotal'], { xp: 0 }));
    expect(bar()).toHaveAttribute('aria-valuenow', '0');
    expect(bar()).toHaveAttribute('aria-valuemax', '150');
    expect(bar()).toHaveAttribute('aria-valuetext', format(m['child.hq.xpValue'], { have: 0, need: 150 }));
    expect(panel()).toHaveTextContent(format(m['child.hq.xpToNext'], { have: 0, need: 150, rank: rank2 }));
    expect(panel()).toHaveTextContent(format(m['child.hq.solved'], { n: 0 }));
  });

  it('275 XP: the 2nd rank and the bar at 125 of 250 XP towards the 3rd rank', async () => {
    await openHq(275);
    renderAt(<HqScreen />, '/');
    await screen.findByRole('region', { name: m['child.hq.progressTitle'] });
    expect(panel()).toHaveTextContent(rank2);
    expect(panel()).toHaveTextContent(format(m['child.hq.rank'], { n: 2 }));
    expect(bar()).toHaveAttribute('aria-valuenow', '125');
    expect(bar()).toHaveAttribute('aria-valuemax', '250');
    expect(panel()).toHaveTextContent(format(m['child.hq.xpToNext'], { have: 125, need: 250, rank: rank3 }));
  });

  it('the top rank: a full bar marked as the highest rank and no next target', async () => {
    await openHq(1600);
    renderAt(<HqScreen />, '/');
    await screen.findByRole('region', { name: m['child.hq.progressTitle'] });
    expect(panel()).toHaveTextContent(rank5);
    expect(bar().getAttribute('aria-valuenow')).toBe(bar().getAttribute('aria-valuemax'));
    expect(bar()).toHaveAttribute('aria-valuetext', m['child.hq.topRank']);
    expect(panel()).toHaveTextContent(m['child.hq.topRank']);
    expect(panel().textContent).not.toContain('do hodnosti');
    // Czech number: a no-break space groups the thousands (raw text: toHaveTextContent folds spaces).
    expect(panel().textContent).toContain(format(m['child.hq.xpTotal'], { xp: '1\u00a0600' }));
  });

  it('shows the solved-task count the server holds', async () => {
    const backend = await openHq();
    await practise(backend, PRACTICE.missionA, PRACTICE.taskSum, { a: '0,75' });
    await practise(backend, PRACTICE.missionPerimeter, PRACTICE.taskSquare, { a: '6 cm' });
    await practise(backend, PRACTICE.missionPerimeter, PRACTICE.taskSquare, { a: '7 cm' });
    renderAt(<HqScreen />, '/');
    await screen.findByRole('region', { name: m['child.hq.progressTitle'] });
    expect(panel()).toHaveTextContent(format(m['child.hq.solved'], { n: 2 }));
    // 10 for the first try, 1 for the reveal, 20 for the completed perimeter mission.
    expect(panel()).toHaveTextContent(format(m['child.hq.xpTotal'], { xp: 31 }));
  });

  it('shows no timer, streak or ranking against anyone (FR-38)', async () => {
    await openHq(275);
    renderAt(<HqScreen />, '/');
    await screen.findByRole('region', { name: m['child.hq.progressTitle'] });
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/[-−]\s*\d+\s*XP/);
    expect(text).not.toMatch(/\d+:\d\d|série|žebříč|pořadí/i);
    expect(screen.queryByRole('timer')).toBeNull();
  });
});

describe('pending rank-up on HQ (FR-36)', () => {
  it('plays the celebration naming the new rank once and acknowledges it', async () => {
    const backend = await openHq(140);
    creditOutsideSession(backend, 20);
    renderAt(<HqScreen />, '/');
    const celebration = (await screen.findByText(m['child.rankUp.kicker'])).closest('[role="status"]');
    expect(celebration).not.toBeNull();
    expect(celebration).toHaveTextContent(format(m['child.rankUp.text'], { rank: rank2 }));
    await act(async () => {});
    expect(acks(backend.seen)).toEqual([{ rankIndex: 1 }]);
    expect(backend.practice.pendingRankUp).toBeNull();
  });

  it('"Super!" closes it and focus goes to the heading', async () => {
    const backend = await openHq(140);
    creditOutsideSession(backend, 20);
    renderAt(<HqScreen />, '/');
    await userEvent.click(await screen.findByRole('button', { name: m['child.rankUp.close'] }));
    expect(screen.queryByText(m['child.rankUp.kicker'])).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
  });

  it('does not play again on the next visit', async () => {
    const backend = await openHq(140);
    creditOutsideSession(backend, 20);
    const first = renderAt(<HqScreen />, '/');
    await screen.findByText(m['child.rankUp.kicker']);
    await act(async () => {});
    first.unmount();
    renderAt(<HqScreen />, '/');
    await screen.findByRole('region', { name: m['child.hq.progressTitle'] });
    expect(screen.queryByText(m['child.rankUp.kicker'])).toBeNull();
    expect(acks(backend.seen)).toHaveLength(1);
  });

  it('without a pending rank-up there is no celebration and no acknowledgement', async () => {
    const backend = await openHq(160);
    renderAt(<HqScreen />, '/');
    await screen.findByRole('region', { name: m['child.hq.progressTitle'] });
    await act(async () => {});
    expect(screen.queryByText(m['child.rankUp.kicker'])).toBeNull();
    expect(acks(backend.seen)).toEqual([]);
  });
});
