import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';
import { messages as m } from '../../src/i18n/messages';
import type { components } from '../../src/api/generated/schema';
import { makePdf } from '../../src/test/fake-admin-backend';

// Real-stack support: no route mocks. The admin password and the child's display name are the fake,
// committed test values of the isolated `doucko-e2e` stack (backend tools/e2e-stack.mjs), never the
// owner's. Every value a spec authors is self-authored and unique per run (`unique()`), so reruns
// against the same accumulated database never collide.

type S = components['schemas'];
export type HqView = S['HqView'];
export type Stats = S['Stats'];
export type TaskInput = S['TaskInput'];

export const ADMIN_PASSWORD = process.env.E2E_STACK_ADMIN_PASSWORD ?? 'e2e-admin-password-not-secret';
export const CHILD_NAME = process.env.E2E_STACK_CHILD_NAME ?? 'Testovací žák';

/** A short run-unique tag, so content titles and prompts never collide across reruns. */
export const unique = (label: string) => `${label} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * The `test` every stack spec imports. After each test the page must not show the owner's stack's
 * data: the child greeting on this stack is the fake name, so any HQ visit is checked against it.
 */
export const test = base.extend<{ isolation: void }>({
  isolation: [
    async ({ page, browserName }, use, testInfo) => {
      // Firefox on a loaded machine is slow to load the bundle: triple the time, never the assertions.
      if (browserName === 'firefox') testInfo.slow();
      await use();
      if (new URL(page.url()).pathname === '/' && page.url() !== 'about:blank') {
        await expect(page.getByRole('heading', { level: 1 })).toContainText(CHILD_NAME);
      }
    },
    { auto: true },
  ],
});
export { expect };

// ---------------------------------------------------------------------------------------------
// Admin session: through the UI, so the browser and page.request share the SESSION cookie.

export async function signInUi(page: Page, password = ADMIN_PASSWORD): Promise<void> {
  await page.goto('/admin');
  await page.getByLabel(m['admin.signIn.password']).fill(password);
  await page.getByRole('button', { name: m['admin.signIn.submit'] }).click();
}

export async function signedIn(page: Page): Promise<void> {
  await signInUi(page);
  await expect(page.getByRole('heading', { level: 1, name: m['admin.home.title'], exact: true })).toBeVisible({ timeout: 15_000 });
}

async function xsrf(page: Page): Promise<string> {
  const cookie = (await page.context().cookies()).find((c) => c.name === 'XSRF-TOKEN');
  if (!cookie) throw new Error('no XSRF-TOKEN cookie: sign in first');
  return decodeURIComponent(cookie.value);
}

async function json<T>(response: Awaited<ReturnType<APIRequestContext['get']>>, what: string): Promise<T> {
  if (!response.ok()) throw new Error(`${what}: HTTP ${response.status()} ${await response.text()}`);
  return (response.status() === 204 ? undefined : await response.json()) as T;
}

/** The admin API as the signed-in page (cookies shared with the browser context). */
export function adminApi(page: Page) {
  const write = async <T>(method: 'post' | 'put', path: string, data: unknown): Promise<T> => {
    const response = await page.request[method](path, { data, headers: { 'X-XSRF-TOKEN': await xsrf(page) } });
    return json<T>(response, `${method.toUpperCase()} ${path}`);
  };
  return {
    get: async <T>(path: string) => json<T>(await page.request.get(path), `GET ${path}`),
    post: <T>(path: string, data: unknown) => write<T>('post', path, data),
    put: <T>(path: string, data: unknown) => write<T>('put', path, data),
    async upload(title: string, pages = 3): Promise<S['Source']> {
      const reference = await this.get<S['ReferenceData']>('/api/admin/reference');
      const response = await page.request.post('/api/admin/sources', {
        headers: { 'X-XSRF-TOKEN': await xsrf(page) },
        multipart: {
          title,
          grade: String(reference.grades[0]),
          subject: reference.subjects[0],
          file: { name: 'e2e-blank.pdf', mimeType: 'application/pdf', buffer: Buffer.from(makePdf(pages)) },
        },
      });
      return json<S['Source']>(response, 'POST /api/admin/sources');
    },
  };
}
export type AdminApi = ReturnType<typeof adminApi>;

/** The first configured topic of the source's grade. */
export async function firstTopic(api: AdminApi, grade: number): Promise<{ topicId: string; name: string }> {
  const reference = await api.get<S['ReferenceData']>('/api/admin/reference');
  const topic = reference.topics.find((t) => t.grade === grade);
  if (!topic) throw new Error(`no topic for grade ${grade}`);
  return topic;
}

/** A free mission position in the topic (positions are unique per topic and accumulate over reruns). */
export async function freePosition(api: AdminApi, topicId: string): Promise<number> {
  const missions = await api.get<S['AdminMission'][]>('/api/admin/missions');
  const taken = missions.filter((x) => x.topicId === topicId).map((x) => x.position);
  const position = Math.max(0, ...taken) + 1;
  if (position > 999) throw new Error('the e2e stack ran out of mission positions: reset it (tools/e2e-stack-run.mjs takes it down)');
  return position;
}

export type TaskSpec = { prompt: string; accepted: string; hints?: string[] };

/**
 * Authors a published mission through the admin API: a fresh source, one published INTEGER task per
 * spec, a mission at a free position, published. Returns the ids the child journeys need.
 */
export async function publishedMission(page: Page, tasks: TaskSpec[]) {
  const api = adminApi(page);
  const source = await api.upload(unique('E2E sešit'));
  const topic = await firstTopic(api, source.grade);
  const taskIds: string[] = [];
  for (const [i, spec] of tasks.entries()) {
    const input: TaskInput = {
      prompt: spec.prompt,
      topicId: topic.topicId,
      grade: source.grade,
      difficulty: 1,
      modality: 'TEXT',
      sourceRef: { sourceId: source.sourceId, page: 1, taskNo: String(i + 1), subPart: null },
      parts: [{ key: 'a', label: 'a', spec: { type: 'INTEGER', accepted: [spec.accepted], allowEquivalent: true, requireLowestTerms: false, unitRequired: true, diacriticsStrict: false } }],
      hints: spec.hints ?? [],
    };
    const task = await api.post<S['AdminTask']>('/api/admin/tasks', input);
    await api.put('/api/admin/tasks/' + task.taskId + '/status', { status: 'PUBLISHED' });
    taskIds.push(task.taskId);
  }
  const position = await freePosition(api, topic.topicId);
  const mission = await api.post<S['AdminMission']>('/api/admin/missions', { topicId: topic.topicId, position, taskIds });
  await api.put('/api/admin/missions/' + mission.missionId + '/status', { status: 'PUBLISHED' });
  return { missionId: mission.missionId, taskIds, topic, position, sourceId: source.sourceId };
}

// ---------------------------------------------------------------------------------------------
// Child side (no login).

export const hq = async (page: Page) => json<HqView>(await page.request.get('/api/child/hq'), 'GET /api/child/hq');
export const stats = async (page: Page) => json<Stats>(await page.request.get('/api/admin/stats?weeks=5'), 'GET /api/admin/stats');

export const taskUrl = (missionId: string, taskId: string) => `/task?missionId=${missionId}&taskId=${taskId}`;
export const answerBox = (page: Page) => page.locator('[data-part="a"]').getByRole('textbox');

/** Types an answer into part a and submits it with Enter. */
export async function answer(page: Page, value: string): Promise<void> {
  await answerBox(page).fill(value);
  await answerBox(page).press('Enter');
}

/** Acknowledges any pending rank-up, so an earlier run's celebration does not cover the screen. */
export async function settleRankUp(page: Page): Promise<void> {
  const view = await hq(page);
  if (view.pendingRankUp) await page.request.post('/api/child/hq/rank-up-ack', { data: { rankIndex: view.pendingRankUp.index } });
}
