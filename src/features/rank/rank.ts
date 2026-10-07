import type { Rank } from './api';

export interface XpProgress {
  /** XP gathered inside the current rank. */
  have: number;
  /** XP the current rank spans up to the next one (the bar's maximum). */
  need: number;
  /** How full the bar is, 0–100. */
  percent: number;
  /** True at the top rank: the bar is full and there is no next target. */
  top: boolean;
}

/**
 * The XP bar towards the next rank, from the server's HQ view (gamification "Progress on HQ"). The
 * UI never derives a rank: it only measures the distance between the ranks the server names. At the
 * top rank (no next rank) the bar is full, on a 0–100 scale.
 */
export function xpProgress({ totalXp, rank, nextRank }: { totalXp: number; rank: Rank; nextRank: Rank | null }): XpProgress {
  if (!nextRank) return { have: 100, need: 100, percent: 100, top: true };
  const need = nextRank.minXp - rank.minXp;
  const have = Math.min(need, Math.max(0, totalXp - rank.minXp));
  return { have, need, percent: Math.round((have / need) * 100), top: false };
}

/** An XP amount in Czech: a no-break space groups the thousands (1 240). */
export function formatXp(n: number): string {
  return n.toLocaleString('cs-CZ', { useGrouping: true }).replace(/\s/g, '\u00a0');
}
