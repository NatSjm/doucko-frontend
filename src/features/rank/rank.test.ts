// @trace FR-37
import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_LADDER } from '@/test/fake-child-backend';
import { formatXp, xpProgress } from './rank';

const [r1, r2, r3, , r5] = PLACEHOLDER_LADDER;

describe('XP bar towards the next rank (FR-37)', () => {
  it('275 XP under the placeholder ladder: 125 of 250 XP towards the 3rd rank', () => {
    expect(xpProgress({ totalXp: 275, rank: r2, nextRank: r3 })).toEqual({ have: 125, need: 250, percent: 50, top: false });
  });

  it('a fresh profile: an empty bar at 0 of 150 XP', () => {
    expect(xpProgress({ totalXp: 0, rank: r1, nextRank: r2 })).toEqual({ have: 0, need: 150, percent: 0, top: false });
  });

  it('right at a threshold the bar starts empty again', () => {
    expect(xpProgress({ totalXp: 150, rank: r2, nextRank: r3 })).toMatchObject({ have: 0, need: 250, percent: 0 });
  });

  it('the top rank: a full bar marked as the highest rank, no next target', () => {
    expect(xpProgress({ totalXp: 1600, rank: r5, nextRank: null })).toEqual({ have: 100, need: 100, percent: 100, top: true });
  });

  it('never leaves 0–100 %, whatever the server sends', () => {
    expect(xpProgress({ totalXp: 100, rank: r2, nextRank: r3 }).percent).toBe(0);
    expect(xpProgress({ totalXp: 900, rank: r2, nextRank: r3 }).percent).toBe(100);
  });
});

describe('Czech XP numbers', () => {
  it('groups thousands with a no-break space', () => {
    expect(formatXp(1240)).toBe('1\u00a0240');
    expect(formatXp(1600)).toBe('1\u00a0600');
    expect(formatXp(275)).toBe('275');
    expect(formatXp(0)).toBe('0');
  });
});
