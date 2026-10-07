// @trace FR-40
// Store spec progress-stats: "Practice statistics page" (the week table, the success metric over the
// 4 completed weeks before the current one, first-try rate, "—" for a topic with nothing resolved,
// the empty state). The figures are the server's; this is only how the page lays them out.
import { describe, expect, it } from 'vitest';
import type { components } from '@/api/generated/schema';
import { DEFAULT_WEEKS, firstTryPercent, formatWeek, noPractice, shortWeeks, WEEK_CHOICES, weekRows } from './stats';

type Stats = components['schemas']['Stats'];
type Week = components['schemas']['WeekStats'];

const week = (weekStart: string, sizes: number[], hintsUsed = 0, revealed = 0): Week => ({
  weekStart,
  sessions: sizes.length,
  qualifyingSessions: sizes.filter((n) => n >= 10).length,
  tasksPerSession: sizes,
  hintsUsed,
  revealed,
});

/** Oldest first, the current week last (contract `Stats.weeks`). */
const stats = (weeks: Week[], metricMet = false): Stats => ({ weeks, firstTryRateByTopic: [], metricMet });

const FIVE = [
  week('2026-09-07', [10, 10, 12, 5], 3),
  week('2026-09-14', [10, 6, 12], 5, 2),
  week('2026-09-21', [11, 10, 10, 6], 4, 1),
  week('2026-09-28', [12, 10, 11], 7, 3),
  week('2026-10-05', [4], 2),
];

describe('week choices', () => {
  it('defaults to 5 weeks, so the current week and all four metric weeks are shown, and offers up to 52', () => {
    expect(DEFAULT_WEEKS).toBe(5);
    expect([...WEEK_CHOICES]).toEqual([5, 8, 12, 26, 52]);
  });
});

describe('week rows', () => {
  it('lists the newest week first and marks the current week and the four metric weeks', () => {
    const rows = weekRows(stats(FIVE));
    expect(rows.map((r) => r.weekStart)).toEqual(['2026-10-05', '2026-09-28', '2026-09-21', '2026-09-14', '2026-09-07']);
    expect(rows.map((r) => r.current)).toEqual([true, false, false, false, false]);
    expect(rows.map((r) => r.metric)).toEqual([false, true, true, true, true]);
    expect(rows[1]).toMatchObject({ sessions: 3, qualifying: 3, sizes: [12, 10, 11], hints: 7, revealed: 3 });
  });

  it('marks a metric week with fewer than 3 qualifying sessions as short, never the current week', () => {
    const rows = weekRows(stats([...FIVE.slice(0, 4), week('2026-10-05', [])]));
    expect(rows.map((r) => r.short)).toEqual([false, false, false, true, false]);
  });

  it('marks no week short when the metric is met', () => {
    expect(weekRows(stats(FIVE, true)).some((r) => r.short)).toBe(false);
  });

  it('marks only the weeks it has: one served week is the current week, nothing else', () => {
    const rows = weekRows(stats([week('2026-10-05', [])]));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ current: true, metric: false, short: false });
  });
});

describe('short weeks', () => {
  it('names the metric weeks that fell short when the metric is not met, oldest first', () => {
    expect(shortWeeks(stats(FIVE))).toEqual(['2026-09-14']);
  });

  it('names weeks with no practice too when there is too little history', () => {
    const little = [week('2026-09-07', []), week('2026-09-14', []), week('2026-09-21', [10, 10, 10, 10, 10]), week('2026-09-28', [10, 10, 10, 10, 10]), week('2026-10-05', [])];
    expect(shortWeeks(stats(little))).toEqual(['2026-09-07', '2026-09-14']);
  });

  it('names nothing in the empty state, where the empty-state message speaks', () => {
    expect(shortWeeks(stats([week('2026-09-28', []), week('2026-10-05', [])]))).toEqual([]);
    expect(weekRows(stats([week('2026-09-28', []), week('2026-10-05', [])])).some((r) => r.short)).toBe(false);
  });

  it('names nothing when the metric is met', () => {
    expect(shortWeeks(stats(FIVE, true))).toEqual([]);
  });
});

describe('empty state', () => {
  it('is shown only when no week has a session, a hint or a reveal', () => {
    expect(noPractice(stats([week('2026-09-28', []), week('2026-10-05', [])]))).toBe(true);
    expect(noPractice(stats([week('2026-09-28', [], 1), week('2026-10-05', [])]))).toBe(false);
    expect(noPractice(stats([week('2026-09-28', [], 0, 1), week('2026-10-05', [])]))).toBe(false);
    expect(noPractice(stats(FIVE))).toBe(false);
  });
});

describe('first-try rate', () => {
  it('is the share of first tries among resolved tasks, as a whole percent', () => {
    expect(firstTryPercent({ resolved: 8, firstTry: 6 })).toBe(75);
    expect(firstTryPercent({ resolved: 3, firstTry: 2 })).toBe(67);
    expect(firstTryPercent({ resolved: 4, firstTry: 0 })).toBe(0);
  });

  it('has no value when nothing is resolved (shown as —, never 0 %)', () => {
    expect(firstTryPercent({ resolved: 0, firstTry: 0 })).toBeNull();
  });
});

describe('week labels', () => {
  it('shows a week start as a calendar date, never shifted by the time zone', () => {
    expect(formatWeek('2026-10-05')).toBe('2026-10-05');
    expect(formatWeek('2026-03-30')).toBe('2026-03-30');
    expect(formatWeek('2026-09-14')).toBe('2026-09-14');
  });
});
