import type { QueryClient } from '@tanstack/react-query';
import { adminClient } from './adminClient';

/** TanStack Query key of "is there an admin session": `true`, `false`, or an error when unreachable. */
export const ADMIN_SESSION_KEY = ['admin', 'session'] as const;

/** Signed out: forgets every cached admin answer (specs, PDFs, images) and records "no session". */
export function endAdminSession(queryClient: QueryClient): void {
  queryClient.removeQueries({ predicate: (q) => q.queryKey[0] === 'admin' && q.queryKey[1] !== 'session' });
  queryClient.setQueryData(ADMIN_SESSION_KEY, false);
}

class UnexpectedStatus extends Error {
  constructor(status: number) {
    super(`unexpected status ${status}`);
  }
}

/** `getAdminSession`: 204 signed in, 401 not; anything else is an error. */
export async function checkAdminSession(): Promise<boolean> {
  const { response } = await adminClient.GET('/api/admin/session');
  if (response.status === 204) return true;
  if (response.status === 401) return false;
  throw new UnexpectedStatus(response.status);
}

/** `signIn` with only the password: `true` on 204, `false` on 401 (wrong password); else an error. */
export async function signIn(password: string): Promise<boolean> {
  const { response } = await adminClient.POST('/api/admin/session', { body: { password } });
  if (response.status === 204) return true;
  if (response.status === 401) return false;
  throw new UnexpectedStatus(response.status);
}

/** `signOut`; a 401 means the session had already ended, which is the same outcome. */
export async function signOut(): Promise<void> {
  const { response } = await adminClient.DELETE('/api/admin/session');
  if (response.status !== 204 && response.status !== 401) throw new UnexpectedStatus(response.status);
}
