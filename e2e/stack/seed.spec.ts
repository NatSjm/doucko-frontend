// @trace FR-24
// @trace FR-25
// @trace FR-26
// Real stack (Phase 5): the backend's idempotent seed (`tools/e2e-stack.mjs seed`: "E2E Seed
// Mission" = topic Přirozená čísla, position 1, three published tasks) is served through nginx to
// the child's HQ and screens. Read-only, so it holds on any rerun whatever the child did before.
import { format } from '../../src/i18n/format';
import { messages as m } from '../../src/i18n/messages';
import { CHILD_NAME, expect, hq, test } from './support';

const TOPIC = 'Přirozená čísla';
const PROMPTS = ['E2E Seed: Kolik je 6 · 7?', 'E2E Seed: Kolik je 1,5 + 2,25?', 'E2E Seed: Které číslo je sudé?'];

test('HQ greets the fake test child and lists the seed mission; its three tasks render, the choice task with its options', async ({ page }) => {
  const view = await hq(page);
  expect(view.displayName).toBe(CHILD_NAME);
  const seed = view.topics.find((t) => t.name === TOPIC)?.missions.find((x) => x.position === 1);
  expect(seed?.taskCount).toBe(3);

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: format(m['child.hq.greeting'], { name: CHILD_NAME }) })).toBeVisible();
  const card = page.getByRole('region', { name: format(m['child.hq.topic'], { name: TOPIC }) }).locator(`a[href="/mission?missionId=${seed!.missionId}"]`);
  await expect(card).toContainText(format(m['child.hq.mission'], { n: 1 }));
  await expect(card).toContainText(format(m['child.hq.progress'], { resolved: seed!.resolvedCount, total: 3 }));

  await card.click();
  const tasks = page.getByRole('list', { name: m['child.mission.tasks'] }).getByRole('listitem');
  await expect(tasks).toHaveCount(3);
  const briefing = (await (await page.request.get(`/api/child/missions/${seed!.missionId}`)).json()) as { tasks: { taskId: string }[] };
  for (const [i, { taskId }] of briefing.tasks.entries()) {
    await page.goto(`/task?missionId=${seed!.missionId}&taskId=${taskId}`);
    await expect(page.getByText(PROMPTS[i])).toBeVisible();
  }
  for (const option of ['7', '8', '9']) await expect(page.getByRole('radio', { name: option })).toBeVisible();
});
