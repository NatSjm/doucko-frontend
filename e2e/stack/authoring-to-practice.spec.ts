// @trace FR-1
// @trace FR-3
// @trace FR-9
// @trace FR-24
// @trace FR-25
// @trace FR-26
// @trace FR-27
// @trace FR-37
// Real stack (Phase 5): the admin authors a source, a task and a mission through the UI and
// publishes them; the child's HQ lists the new mission and the child solves it on the first try, the
// XP and solved count coming back from Postgres. Self-authored content, unique per run.
import type { Page } from '@playwright/test';
import { format } from '../../src/i18n/format';
import { messages as m } from '../../src/i18n/messages';
import { makePdf } from '../../src/test/fake-admin-backend';
import type { components } from '../../src/api/generated/schema';
import { adminApi, CHILD_NAME, expect, firstTopic, freePosition, hq, settleRankUp, signedIn, test, unique } from './support';

const field = (page: Page, name: string) => page.getByLabel(name, { exact: true });

test('author and publish a source, task and mission in the admin UI; the child sees it on HQ and solves it first try', async ({ page }) => {
  await signedIn(page);
  const api = adminApi(page);
  const title = unique('E2E pracovní sešit');
  const prompt = unique('Kolik je 7 + 5? (e2e)');

  // FR-1: upload a self-authored blank PDF with metadata.
  await page.goto('/admin/sources');
  await page.getByLabel(m['admin.sources.file']).setInputFiles({ name: 'e2e-blank.pdf', mimeType: 'application/pdf', buffer: Buffer.from(makePdf(2)) });
  await page.getByLabel(m['admin.sources.sourceTitle']).fill(title);
  await page.getByRole('button', { name: m['admin.sources.upload'] }).click();
  await expect(page.getByRole('status')).toHaveText(m['admin.sources.uploaded']);
  const row = page.getByRole('row', { name: new RegExp(title) });
  await expect(row.getByRole('cell', { name: '2', exact: true })).toBeVisible();
  const source = (await api.get<components['schemas']['Source'][]>('/api/admin/sources')).find((s) => s.title === title);
  expect(source).toBeDefined();
  const topic = await firstTopic(api, source!.grade);

  // FR-3: a task with its source reference, saved as a draft.
  await page.goto(`/admin/tasks/edit?sourceId=${source!.sourceId}&page=1`);
  await field(page, m['admin.editor.prompt']).fill(prompt);
  await field(page, m['admin.editor.topic']).selectOption({ label: topic.name });
  await field(page, m['admin.editor.taskNo']).fill('1');
  await page.getByLabel(format(m['admin.editor.accepted'], { n: 1 })).fill('12');
  await page.getByRole('button', { name: m['admin.editor.save'] }).click();
  await expect(page.getByRole('status')).toHaveText(new RegExp(m['admin.editor.created']));
  const listed = await api.get<components['schemas']['TaskSummary'][]>(`/api/admin/tasks?sourceId=${source!.sourceId}`);
  expect(listed).toHaveLength(1);
  const task = listed[0];
  expect(task?.status).toBe('DRAFT');
  expect(task?.provenance).toMatchObject({ sourceTitle: title, page: 1, taskNo: '1' });

  // Publish the task.
  await page.goto(`/admin/tasks/edit?taskId=${task!.taskId}`);
  await page.getByRole('button', { name: m['admin.taskStatus.publish'] }).click();
  await expect(page.getByText(m['admin.taskStatus.published'])).toBeVisible();

  // FR-9: a mission of the topic at a free position, holding the task, then published.
  const position = await freePosition(api, topic.topicId);
  await page.goto('/admin/missions/edit');
  await field(page, m['admin.missionEditor.topic']).selectOption({ label: topic.name });
  await field(page, m['admin.missionEditor.position']).fill(String(position));
  await page.getByLabel(m['admin.missionEditor.search']).fill(prompt);
  await page.getByRole('region', { name: m['admin.missionEditor.addTitle'] }).getByRole('button', { name: `${m['admin.missionEditor.add']} ${prompt}` }).click();
  await page.getByRole('button', { name: m['admin.missionEditor.save'] }).click();
  await expect(page.getByRole('status').filter({ hasText: m['admin.missionEditor.created'] })).toBeVisible();
  await expect(page).toHaveURL(/missionId=[0-9a-f-]{36}$/);
  const missionId = new URL(page.url()).searchParams.get('missionId')!;
  await page.getByRole('button', { name: m['admin.missionEditor.publish'] }).click();
  await expect(page.getByText(m['admin.missionEditor.published'])).toBeVisible();

  // FR-24, FR-25: the child's HQ (no login) lists the published mission as new, 0/1.
  await settleRankUp(page);
  const before = await hq(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: format(m['child.hq.greeting'], { name: CHILD_NAME }) })).toBeVisible();
  const card = page.getByRole('region', { name: format(m['child.hq.topic'], { name: topic.name }) }).locator(`a[href="/mission?missionId=${missionId}"]`);
  await expect(card).toContainText(format(m['child.hq.mission'], { n: position }));
  await expect(card).toContainText(format(m['child.hq.progress'], { resolved: 0, total: 1 }));
  await expect(card).toContainText(m['child.hq.state.NEW']);

  // FR-26, FR-27: start the mission and answer right on the first attempt.
  await card.click();
  await page.getByRole('link', { name: m['child.mission.start'] }).click();
  await expect(page.getByText(prompt)).toBeVisible();
  const attempt = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/attempts'));
  await page.getByRole('textbox', { name: 'a' }).fill('12');
  await page.keyboard.press('Enter');
  const result = (await (await attempt).json()) as components['schemas']['AttemptResult'];
  await expect(page.getByText(m['child.task.correct'])).toBeVisible();
  expect(result).toMatchObject({ taskState: 'CORRECT_FIRST_TRY', xpAwarded: 10, missionComplete: true, completedMissionIds: [missionId] });
  await expect(page.getByText(format(m['child.task.xp'], { xp: 10 }), { exact: true })).toBeVisible();

  // FR-37: HQ reads the new totals back from the server.
  const after = await hq(page);
  expect(after.totalXp - before.totalXp).toBe(result.xpAwarded + result.bonusXp);
  expect(after.solvedTasks).toBe(before.solvedTasks + 1);
  await page.goto('/');
  const progress = page.getByRole('region', { name: m['child.hq.progressTitle'] });
  await expect(progress).toContainText(format(m['child.hq.solved'], { n: after.solvedTasks }));
  await expect(progress).toContainText(after.rank.name);
  await expect(card).toContainText(format(m['child.hq.progress'], { resolved: 1, total: 1 }));
  await expect(card).toContainText(m['child.hq.state.COMPLETE']);
});
