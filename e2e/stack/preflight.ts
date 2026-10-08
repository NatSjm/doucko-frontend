import { request, type FullConfig } from '@playwright/test';
import { CHILD_NAME } from './support';

/**
 * Global setup of the real-stack suite: before any spec writes anything, the target must be the
 * isolated e2e stack. Its child is the fake test child; any other display name (the owner's stack on
 * 8081, a mistyped E2E_STACK_URL) aborts the whole run before the first test.
 */
export default async function preflight(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  const api = await request.newContext({ baseURL });
  try {
    const response = await api.get('/api/child/hq');
    if (!response.ok()) throw new Error(`pre-flight: GET ${baseURL}/api/child/hq answered ${response.status()}; is the e2e stack up?`);
    const { displayName } = (await response.json()) as { displayName?: string };
    if (displayName !== CHILD_NAME) {
      // The name itself is never printed: it may be the real child's (NFR-3).
      throw new Error(`pre-flight: ${baseURL} is not the isolated e2e stack (unexpected child display name); refusing to write to it`);
    }
  } finally {
    await api.dispose();
  }
}
