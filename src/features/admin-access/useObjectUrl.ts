import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

/**
 * Fetches a binary admin resource (a task image) through `fetchBlob` — the admin client, so the
 * session and 401 handling apply — and returns an object URL for it, revoked when it changes.
 */
export function useObjectUrl(key: readonly unknown[], fetchBlob: () => Promise<Blob>): string | undefined {
  const query = useQuery({ queryKey: key, queryFn: fetchBlob, staleTime: Infinity });
  const url = useMemo(() => (query.data ? URL.createObjectURL(query.data) : undefined), [query.data]);
  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url]);
  return url;
}
