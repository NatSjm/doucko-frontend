import { useQuery } from '@tanstack/react-query';

/** One object URL per fetched blob, so a remount (StrictMode included) reuses a live URL. */
const urls = new WeakMap<Blob, string>();

function urlOf(blob: Blob): string {
  const known = urls.get(blob);
  if (known) return known;
  const url = URL.createObjectURL(blob);
  urls.set(blob, url);
  return url;
}

/**
 * Fetches a binary admin resource (a task image) through `fetchBlob` — the admin client, so the
 * session and 401 handling apply — and returns an object URL for it. URLs are not revoked: a task
 * has at most 10 images, and a URL revoked under a still mounted image would break it.
 */
export function useObjectUrl(key: readonly unknown[], fetchBlob: () => Promise<Blob>): string | undefined {
  const query = useQuery({ queryKey: key, queryFn: fetchBlob, staleTime: Infinity });
  return query.data ? urlOf(query.data) : undefined;
}
