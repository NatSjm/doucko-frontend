import type { components } from '@/api/generated/schema';
import { childClient } from '@/features/child/childClient';
import { unwrap } from '@/features/admin-access/problem';

export type Rank = components['schemas']['Rank'];

/** Marks a shown celebration as played (`ackRankUp`, 204), so it never plays again (FR-36). */
export async function ackRankUp(rankIndex: number): Promise<void> {
  unwrap(await childClient.POST('/api/child/hq/rank-up-ack', { body: { rankIndex } }));
}
