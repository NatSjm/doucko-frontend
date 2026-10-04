import { useQuery } from '@tanstack/react-query';
import type { components } from '@/api/generated/schema';
import { adminClient } from '@/features/admin-access/adminClient';
import { unwrap } from '@/features/admin-access/problem';

type S = components['schemas'];
export type Source = S['Source'];
export type ReferenceData = S['ReferenceData'];

export const SOURCES_KEY = ['admin', 'sources'] as const;

/** Configured grades, subjects and task locales, and the seeded topics (`getReferenceData`). */
export function useReference() {
  return useQuery({
    queryKey: ['admin', 'reference'],
    queryFn: async () => unwrap(await adminClient.GET('/api/admin/reference')),
    staleTime: Infinity,
  });
}

export function useSources() {
  return useQuery({ queryKey: SOURCES_KEY, queryFn: async () => unwrap(await adminClient.GET('/api/admin/sources')) });
}

/** One source; disabled without an id. An unknown id is an ApiError with status 404. */
export function useSource(sourceId: string | null) {
  return useQuery({
    queryKey: [...SOURCES_KEY, sourceId],
    queryFn: async () => unwrap(await adminClient.GET('/api/admin/sources/{sourceId}', { params: { path: { sourceId: sourceId as string } } })),
    enabled: !!sourceId,
  });
}

export interface SourceMetadata {
  title: string;
  publisher: string;
  edition: string;
  grade: string;
  subject: string;
}

/** `uploadSource`: multipart with the file and the metadata; empty optional fields are left out. */
export async function uploadSource(meta: SourceMetadata, file: File): Promise<Source> {
  const form = new FormData();
  form.set('file', file);
  for (const [name, value] of Object.entries(meta)) if (value.trim() || name === 'title') form.set(name, value);
  return unwrap(
    await adminClient.POST('/api/admin/sources', {
      body: {} as S['SourceUpload'],
      bodySerializer: () => form,
    }),
  );
}

/** The PDF bytes of a source, for the viewer (`getSourceFile`). */
export async function fetchSourceFile(sourceId: string): Promise<ArrayBuffer> {
  return unwrap(
    await adminClient.GET('/api/admin/sources/{sourceId}/file', { params: { path: { sourceId } }, parseAs: 'arrayBuffer' }),
  ) as ArrayBuffer;
}

/**
 * `updateSource`: the metadata only, never the file (CA-D3). Full replacement: an empty publisher or
 * edition is sent as null and clears it. 409 when the grade changes while tasks reference the source.
 */
export async function updateSource(sourceId: string, meta: SourceMetadata): Promise<Source> {
  const optional = (value: string) => (value.trim() ? value : null);
  return unwrap(
    await adminClient.PUT('/api/admin/sources/{sourceId}', {
      params: { path: { sourceId } },
      body: { title: meta.title, publisher: optional(meta.publisher), edition: optional(meta.edition), grade: Number(meta.grade), subject: meta.subject },
    }),
  );
}

/** `deleteSource`; 409 while any task references it (CA-D4). */
export async function deleteSource(sourceId: string): Promise<void> {
  unwrap(await adminClient.DELETE('/api/admin/sources/{sourceId}', { params: { path: { sourceId } } }));
}
