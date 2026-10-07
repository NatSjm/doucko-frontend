import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { components } from '@/api/generated/schema';
import { adminClient } from '@/features/admin-access/adminClient';
import { unwrap } from '@/features/admin-access/problem';

export type Stats = components['schemas']['Stats'];

export const STATS_KEY = ['admin', 'stats'] as const;

/**
 * Weekly practice statistics and the success metric (`getStats`, FR-40) for the `weeks` most recent
 * weeks. The contract declares `weeks` as a digit string; the page only sends its own choices. The
 * previous figures stay on screen while another week count loads.
 */
export function useStats(weeks: number) {
  return useQuery({
    queryKey: [...STATS_KEY, weeks],
    queryFn: async () => unwrap(await adminClient.GET('/api/admin/stats', { params: { query: { weeks: String(weeks) } } })),
    placeholderData: keepPreviousData,
  });
}
