import type { components } from '@/api/generated/schema';
import { adminDate } from '@/i18n/format';

type Stats = components['schemas']['Stats'];

/** The week counts the page offers; every one holds the four metric weeks. */
export const WEEK_CHOICES = [5, 8, 12, 26, 52] as const;
/** The current week plus the four completed weeks the success metric reads (progress-stats). */
export const DEFAULT_WEEKS = 5;
/** Weeks before the current one that the success metric reads. */
const METRIC_WEEKS = 4;
/** Qualifying sessions a metric week needs. */
const METRIC_SESSIONS = 3;

/** One row of the weekly table: the served figures plus where the week stands for the metric. */
export interface WeekRow {
  weekStart: string;
  /** The last served entry (contract: the current week is last). */
  current: boolean;
  /** One of the 4 completed weeks before the current one. */
  metric: boolean;
  /** A metric week with fewer than 3 qualifying sessions while the metric is not met (never in the empty state). */
  short: boolean;
  sessions: number;
  qualifying: number;
  sizes: number[];
  hints: number;
  revealed: number;
}

/** The served weeks newest first, each marked current / metric / short. */
export function weekRows(stats: Stats): WeekRow[] {
  const last = stats.weeks.length - 1;
  // With no practice at all the empty state speaks; no week is singled out.
  const empty = noPractice(stats);
  return stats.weeks
    .map((w, i) => {
      const age = last - i;
      const metric = age >= 1 && age <= METRIC_WEEKS;
      return {
        weekStart: w.weekStart,
        current: age === 0,
        metric,
        short: metric && !stats.metricMet && !empty && w.qualifyingSessions < METRIC_SESSIONS,
        sessions: w.sessions,
        qualifying: w.qualifyingSessions,
        sizes: w.tasksPerSession,
        hints: w.hintsUsed,
        revealed: w.revealed,
      };
    })
    .reverse();
}

/** The week starts of the short metric weeks, oldest first; empty when the metric is met. */
export function shortWeeks(stats: Stats): string[] {
  return weekRows(stats)
    .filter((r) => r.short)
    .map((r) => r.weekStart)
    .reverse();
}

/**
 * True when no practice is recorded at all (the empty state): no served week has a session, an
 * opened hint or a reveal, and no topic has a resolved task (practice older than the shown weeks
 * would have resolved one, review F07).
 */
export function noPractice(stats: Stats): boolean {
  return (
    stats.weeks.every((w) => w.sessions === 0 && w.hintsUsed === 0 && w.revealed === 0) && stats.firstTryRateByTopic.every((topic) => topic.resolved === 0)
  );
}

/** The first-try rate as a whole percent, or null when nothing is resolved (shown as —). */
export function firstTryPercent(topic: { resolved: number; firstTry: number }): number | null {
  return topic.resolved === 0 ? null : Math.round((topic.firstTry * 100) / topic.resolved);
}

/** A week start (`YYYY-MM-DD`, a calendar date) as the admin reads it, "2026-10-05" (ISO), never shifted. */
export function formatWeek(date: string): string {
  return adminDate(date);
}
