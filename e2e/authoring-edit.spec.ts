// @trace FR-55
// Store spec content-authoring: "Edit existing content" (Edit source metadata, Source grade locked
// while referenced, Source file cannot be replaced), "Mission publishing rules" (Task in a published
// mission cannot return to draft) and "Delete only unused content" (sources and tasks).
import { messages as m } from '../src/i18n/messages';
import { SEED } from '../src/test/fake-admin-backend';
import { signedInAdmin } from './fixtures/admin';
import { AGAINST_STACK, expect, test } from './fixtures/test';

test.skip(AGAINST_STACK, 'answers come from the fake admin backend; the stack smoke covers the real one');

const DECIMAL = 'Zapiš jednu polovinu jako desetinné číslo.';

test('edit a source from the list: the new edition shows in task provenance; no file field (Edit source metadata)', async ({ page }) => {
  const backend = await signedInAdmin(page);
  await page.goto('/admin/sources');
  await page.getByRole('row', { name: /Matematika 6 – pracovní sešit/ }).getByRole('link', { name: m['admin.sources.edit'] }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/sources/edit\\?sourceId=${SEED.sourceId}$`));
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(page.getByText(m['admin.sourceEdit.noFile'])).toBeVisible();
  const edition = page.getByLabel(m['admin.sources.edition'], { exact: true });
  await edition.fill('2');
  await edition.press('Enter');
  await expect(page.getByText(m['admin.sourceEdit.saved'])).toBeVisible();
  expect(backend.sources[0].source.edition).toBe('2');
  await page.goto('/admin/tasks');
  await expect(page.getByRole('row', { name: new RegExp(DECIMAL) }).getByText('2', { exact: true })).toBeVisible();
});

test('a referenced source keeps its grade and cannot be deleted; the refusals name the reason and the tasks (FR-55, FR-56 messaging)', async ({ page }) => {
  const backend = await signedInAdmin(page);
  backend.reference.grades = [6, 7];
  await page.goto(`/admin/sources/edit?sourceId=${SEED.smallSourceId}`);
  await page.getByLabel(m['admin.sources.grade'], { exact: true }).selectOption('7');
  await page.getByRole('button', { name: m['admin.sourceEdit.save'] }).click();
  await expect(page.getByRole('alert')).toContainText('The grade cannot change: 1 task references this source.');
  expect(backend.sources[1].source.grade).toBe(6);
  await page.getByRole('button', { name: m['admin.sourceEdit.delete'] }).click();
  await page.getByRole('button', { name: m['admin.common.delete'], exact: true }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('1 task references this source. Delete or move those tasks first.');
  await expect(alert.getByRole('link', { name: 'Narýsuj čtverec o straně 5 cm.' })).toHaveAttribute('href', `/admin/tasks/edit?taskId=${SEED.taskGraphic}`);
  expect(backend.sources).toHaveLength(2);
});

test('an unused source is deleted after confirming (Delete an unused source)', async ({ page }) => {
  const backend = await signedInAdmin(page);
  backend.tasks = backend.tasks.filter((t) => t.input.sourceRef.sourceId !== SEED.smallSourceId);
  await page.goto(`/admin/sources/edit?sourceId=${SEED.smallSourceId}`);
  await page.getByRole('button', { name: m['admin.sourceEdit.delete'] }).click();
  await page.getByRole('button', { name: m['admin.common.delete'], exact: true }).click();
  await expect(page.getByText(m['admin.sourceEdit.deleted'])).toBeVisible();
  await page.getByRole('link', { name: m['admin.sources.back'] }).click();
  await expect(page.getByText('Sbírka úloh 6')).toHaveCount(0);
});

test('a task in a published mission cannot return to draft; the refusal links the mission to unpublish first (FR-55, FR-57 messaging)', async ({ page }) => {
  const backend = await signedInAdmin(page);
  backend.tasks.forEach((t) => (t.status = 'PUBLISHED'));
  backend.missions[0].status = 'PUBLISHED';
  await page.goto(`/admin/tasks/edit?taskId=${SEED.taskDecimal}`);
  const panel = page.getByRole('region', { name: m['admin.taskStatus.title'] });
  await panel.getByRole('button', { name: m['admin.taskStatus.unpublish'] }).click();
  const alert = panel.getByRole('alert');
  await expect(alert).toContainText('The task is in a published mission. Unpublish the mission first.');
  expect(backend.tasks[0].status).toBe('PUBLISHED');
  await alert.getByRole('link', { name: /Desetinná čísla/ }).click();
  await expect(page).toHaveURL(new RegExp(`missionId=${SEED.missionDecimals}$`));
  await page.getByRole('button', { name: m['admin.missionEditor.unpublish'] }).click();
  await expect(page.getByText(m['admin.missionEditor.unpublished'])).toBeVisible();
  await page.goto(`/admin/tasks/edit?taskId=${SEED.taskDecimal}`);
  await panel.getByRole('button', { name: m['admin.taskStatus.unpublish'] }).click();
  await expect(panel.getByText(m['admin.taskStatus.unpublished'])).toBeVisible();
  expect(backend.tasks[0].status).toBe('DRAFT');
});

test('delete a draft task: blocked with an offer to unpublish while practice records exist, then deleted and gone from its mission (FR-55)', async ({ page }) => {
  const backend = await signedInAdmin(page);
  backend.usage.add(SEED.taskDecimal);
  await page.goto(`/admin/tasks/edit?taskId=${SEED.taskDecimal}`);
  const panel = page.getByRole('region', { name: m['admin.taskStatus.title'] });
  await expect(panel.getByRole('button', { name: m['admin.taskStatus.delete'] })).toBeDisabled();
  await expect(panel.getByText(m['admin.taskStatus.notDeletable'])).toBeVisible();
  backend.usage.clear();
  await page.reload();
  await panel.getByRole('button', { name: m['admin.taskStatus.delete'] }).click();
  await panel.getByRole('button', { name: m['admin.common.delete'], exact: true }).click();
  await expect(page.getByText(m['admin.taskStatus.deleted'])).toBeVisible();
  expect(backend.tasks.some((t) => t.taskId === SEED.taskDecimal)).toBe(false);
  expect(backend.missions[0].taskIds).toEqual([SEED.taskChoice]);
});
