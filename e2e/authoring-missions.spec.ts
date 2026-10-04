// @trace FR-9
// @trace FR-55
// Store spec content-authoring: "Missions", "Field limits: Too many tasks in a mission", "Mission
// publishing rules", "Draft and published status", "Edit existing content: Reorder a mission",
// "Delete only unused content" (mission deletes).
import type { Page } from '@playwright/test';
import { format } from '../src/i18n/format';
import { messages as m } from '../src/i18n/messages';
import { addTask, SEED } from '../src/test/fake-admin-backend';
import { signedInAdmin } from './fixtures/admin';
import { AGAINST_STACK, expect, test } from './fixtures/test';

test.skip(AGAINST_STACK, 'answers come from the fake admin backend; the stack smoke covers the real one');

const DECIMAL = 'Zapiš jednu polovinu jako desetinné číslo.';
const CHOICE = 'Které číslo je větší než 4?';
const label = (key: keyof typeof m, vars: Record<string, string | number> = {}) => format(m[key], vars);
const field = (page: Page, name: string) => page.getByLabel(name, { exact: true });
const taskList = (page: Page) => page.getByRole('list', { name: m['admin.missionEditor.tasks'] });
const picker = (page: Page) => page.getByRole('region', { name: m['admin.missionEditor.addTitle'] });
const addButton = (page: Page, prompt: string) => picker(page).getByRole('button', { name: `${m['admin.missionEditor.add']} ${prompt}` });
const listed = (page: Page) => taskList(page).getByRole('listitem').evaluateAll((items) => items.map((li) => li.querySelector('[data-content]')?.textContent));

test('the admin navigation leads to the mission list, which shows topic, position, counter and status (FR-9)', async ({ page }) => {
  await signedInAdmin(page);
  await page.goto('/admin');
  await page.getByRole('navigation', { name: m['admin.nav.label'] }).getByRole('link', { name: m['admin.nav.missions'], exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/missions$/);
  const row = page.getByRole('row', { name: /Desetinná čísla/ });
  await expect(row.getByRole('cell', { name: '1', exact: true })).toBeVisible();
  await expect(row.getByText(label('admin.missions.counter', { count: 2 }))).toBeVisible();
  await expect(row.getByText(m['admin.status.DRAFT'])).toBeVisible();
  await row.getByRole('link', { name: m['admin.missions.edit'] }).click();
  await expect(page).toHaveURL(new RegExp(`missionId=${SEED.missionDecimals}$`));
  await expect(taskList(page).getByText(DECIMAL)).toBeVisible();
});

test('keyboard: create a mission with a topic, a position and three tasks, the third moved first (Create a mission, FR-9)', async ({ page }) => {
  const backend = await signedInAdmin(page);
  const third = addTask(backend, { topicId: SEED.topicDecimals, prompt: 'Zaokrouhli 3,46 na desetiny.' }).taskId;
  await page.goto('/admin/missions/edit');
  await field(page, m['admin.missionEditor.topic']).selectOption({ label: 'Desetinná čísla' });
  await field(page, m['admin.missionEditor.position']).fill('2');
  for (const prompt of [DECIMAL, CHOICE, 'Zaokrouhli 3,46 na desetiny.']) {
    await addButton(page, prompt).focus();
    await page.keyboard.press('Enter');
  }
  await expect(page.getByText(label('admin.missions.counter', { count: 3 }))).toBeVisible();
  // A task in the mission is not offered again (Same task twice).
  await expect(addButton(page, DECIMAL)).toHaveCount(0);
  await taskList(page).getByRole('button', { name: label('admin.missionEditor.moveUp', { n: 3 }) }).focus();
  await page.keyboard.press('Enter');
  await expect(taskList(page).getByRole('button', { name: label('admin.missionEditor.moveUp', { n: 2 }) })).toBeFocused();
  await page.keyboard.press('Enter');
  expect(await listed(page)).toEqual(['Zaokrouhli 3,46 na desetiny.', DECIMAL, CHOICE]);
  await field(page, m['admin.missionEditor.position']).press('Enter');
  await expect(page.getByRole('status').filter({ hasText: m['admin.missionEditor.created'] })).toBeVisible();
  expect(backend.missions.at(-1)).toMatchObject({ topicId: SEED.topicDecimals, position: 2, status: 'DRAFT', taskIds: [third, SEED.taskDecimal, SEED.taskChoice] });
  await expect(page).toHaveURL(new RegExp(`missionId=${backend.missions.at(-1)?.missionId}$`));
  // After a reload, the stored mission shows the same order.
  await page.reload();
  await expect(taskList(page).getByText(CHOICE)).toBeVisible();
  expect(await listed(page)).toEqual(['Zaokrouhli 3,46 na desetiny.', DECIMAL, CHOICE]);
});

test('a missing, malformed or taken position is refused on the position field (Missing or duplicate position, FR-9)', async ({ page }) => {
  const backend = await signedInAdmin(page);
  await page.goto('/admin/missions/edit');
  await field(page, m['admin.missionEditor.topic']).selectOption({ label: 'Desetinná čísla' });
  await field(page, m['admin.missionEditor.position']).fill('1,5');
  await page.getByRole('button', { name: m['admin.missionEditor.save'] }).click();
  await expect(page.getByText(m['admin.missionEditor.positionInvalid'])).toBeVisible();
  await expect(field(page, m['admin.missionEditor.position'])).toHaveAttribute('aria-invalid', 'true');
  await field(page, m['admin.missionEditor.position']).fill('1');
  await field(page, m['admin.missionEditor.position']).press('Enter');
  await expect(page.getByText('Position 1 is already taken in this topic.')).toBeVisible();
  await expect(field(page, m['admin.missionEditor.position'])).toBeFocused();
  expect(backend.missions).toHaveLength(1);
});

test('at 50 tasks no further task can be added; removing one frees a place (Too many tasks in a mission, FR-9)', async ({ page }) => {
  const backend = await signedInAdmin(page);
  const ids = Array.from({ length: 51 }, () => addTask(backend, { topicId: SEED.topicPerimeter }).taskId);
  backend.missions[0] = { ...backend.missions[0], topicId: SEED.topicPerimeter, taskIds: ids.slice(0, 50) };
  await page.goto(`/admin/missions/edit?missionId=${SEED.missionDecimals}`);
  await expect(page.getByText(label('admin.missions.counter', { count: 50 }))).toBeVisible();
  await expect(picker(page).getByText(m['admin.missionEditor.max'])).toBeVisible();
  const add = picker(page).getByRole('button', { name: new RegExp(`^${m['admin.missionEditor.add']} `) });
  // 51 added + 2 seed tasks of the topic, 50 of them in the mission: 3 offered, none addable.
  await expect(add).toHaveCount(3);
  for (let i = 0; i < 3; i++) await expect(add.nth(i)).toBeDisabled();
  await taskList(page).getByRole('button', { name: label('admin.missionEditor.remove', { n: 50 }) }).click();
  await expect(page.getByText(label('admin.missions.counter', { count: 49 }))).toBeVisible();
  await expect(picker(page).getByText(m['admin.missionEditor.max'])).toHaveCount(0);
  await expect(add.first()).toBeEnabled();
});

test('publishing: refused with the draft tasks named, then published once they are, then unpublished (Mission publishing rules, FR-9)', async ({ page }) => {
  const backend = await signedInAdmin(page);
  await page.goto(`/admin/missions/edit?missionId=${SEED.missionDecimals}`);
  await page.getByRole('button', { name: m['admin.missionEditor.publish'] }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Only published text tasks can be in a published mission: 2 tasks block publishing.');
  await expect(alert.getByRole('link', { name: DECIMAL })).toHaveAttribute('href', `/admin/tasks/edit?taskId=${SEED.taskDecimal}`);
  await expect(alert.getByRole('link', { name: CHOICE })).toBeVisible();
  expect(backend.missions[0].status).toBe('DRAFT');
  backend.tasks.forEach((t) => (t.status = 'PUBLISHED'));
  await page.getByRole('button', { name: m['admin.missionEditor.publish'] }).click();
  await expect(page.getByText(m['admin.missionEditor.published'])).toBeVisible();
  await expect(page.getByRole('region', { name: m['admin.missionEditor.statusTitle'] }).getByText(m['admin.status.PUBLISHED'], { exact: true })).toBeVisible();
  expect(backend.missions[0].status).toBe('PUBLISHED');
  await page.getByRole('button', { name: m['admin.missionEditor.unpublish'] }).click();
  await expect(page.getByText(m['admin.missionEditor.unpublished'])).toBeVisible();
  expect(backend.missions[0].status).toBe('DRAFT');
});

test('a published mission refuses a draft task; the refusal names it and the mission is unchanged (Adding a draft task to a published mission, FR-9)', async ({ page }) => {
  const backend = await signedInAdmin(page);
  backend.tasks.forEach((t) => (t.status = 'PUBLISHED'));
  backend.missions[0].status = 'PUBLISHED';
  addTask(backend, { topicId: SEED.topicDecimals, status: 'DRAFT', prompt: 'Rozepsaná úloha o desetinách.' });
  await page.goto(`/admin/missions/edit?missionId=${SEED.missionDecimals}`);
  await addButton(page, 'Rozepsaná úloha o desetinách.').click();
  await page.getByRole('button', { name: m['admin.missionEditor.save'] }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Only published text tasks can join a published mission.');
  await expect(alert.getByRole('link', { name: 'Rozepsaná úloha o desetinách.' })).toBeVisible();
  expect(backend.missions[0].taskIds).toEqual([SEED.taskDecimal, SEED.taskChoice]);
});

test('reorder a saved mission: moved, saved and listed in the new order (Reorder a mission, FR-55)', async ({ page }) => {
  const backend = await signedInAdmin(page);
  await page.goto(`/admin/missions/edit?missionId=${SEED.missionDecimals}`);
  await taskList(page).getByRole('button', { name: label('admin.missionEditor.moveUp', { n: 2 }) }).click();
  expect(await listed(page)).toEqual([CHOICE, DECIMAL]);
  // Unsaved changes: publishing waits for the save.
  await expect(page.getByRole('button', { name: m['admin.missionEditor.publish'] })).toBeDisabled();
  await page.getByRole('button', { name: m['admin.missionEditor.save'] }).click();
  await expect(page.getByText(m['admin.missionEditor.updated'])).toBeVisible();
  expect(backend.missions[0].taskIds).toEqual([SEED.taskChoice, SEED.taskDecimal]);
  await expect(page.getByRole('button', { name: m['admin.missionEditor.publish'] })).toBeEnabled();
});

test('delete: blocked by practice records with an offer to unpublish, allowed when unused and the tasks stay (Delete only unused content, FR-55)', async ({ page }) => {
  const backend = await signedInAdmin(page);
  backend.usage.add(SEED.taskChoice);
  await page.goto(`/admin/missions/edit?missionId=${SEED.missionDecimals}`);
  await expect(page.getByRole('button', { name: m['admin.missionEditor.delete'] })).toBeDisabled();
  await expect(page.getByText(m['admin.missionEditor.notDeletable'])).toBeVisible();
  backend.usage.clear();
  await page.reload();
  await page.getByRole('button', { name: m['admin.missionEditor.delete'] }).click();
  await expect(page.getByText(m['admin.missionEditor.confirmDelete'])).toBeVisible();
  await expect(page.getByRole('button', { name: m['admin.common.cancel'] })).toBeFocused();
  await page.getByRole('button', { name: m['admin.common.delete'], exact: true }).click();
  await expect(page.getByText(m['admin.missionEditor.deleted'])).toBeVisible();
  expect(backend.missions).toHaveLength(0);
  expect(backend.tasks.map((t) => t.taskId)).toEqual(expect.arrayContaining([SEED.taskDecimal, SEED.taskChoice]));
  await page.getByRole('link', { name: m['admin.missionEditor.back'] }).click();
  await expect(page.getByText(m['admin.missions.empty'])).toBeVisible();
});
