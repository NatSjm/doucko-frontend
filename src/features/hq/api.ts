import { useQuery } from '@tanstack/react-query';
import type { components } from '@/api/generated/schema';
import { childClient } from '@/features/child/childClient';
import { unwrap } from '@/features/admin-access/problem';

export type HqView = components['schemas']['HqView'];

export const HQ_KEY = ['child', 'hq'] as const;

/** HQ (`getHq`), read afresh on every visit: progress changes with every answer. */
export function useHq() {
  return useQuery({ queryKey: HQ_KEY, queryFn: async () => unwrap(await childClient.GET('/api/child/hq')), staleTime: 0 });
}
