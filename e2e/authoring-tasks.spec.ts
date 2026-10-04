// @trace FR-2
// @trace FR-3
// @trace FR-4
// @trace FR-11
// @trace FR-13
// @trace NFR-8
// @trace NFR-17
// Store spec content-authoring: "Create a task with a source reference", "Fast keyboard-first task
// entry", "Task images", "Task list filters and search", "Bulk publish from the task list", "Task provenance".
import type { Page } from '@playwright/test';
import { format } from '../src/i18n/format';
import { messages as m } from '../src/i18n/messages';
import { makePng, SEED } from '../src/test/fake-admin-backend';
import { signedInAdmin } from './fixtures/admin';
import { AGAINST_STACK, expect, test } from './fixtures/test';

test.skip(AGAINST_STACK, 'answers come from the fake admin backend; the stack smoke covers the real one');

const label = (key: keyof typeof m, vars: Record<string, string | number> = {}) => format(m[key], vars);
const canvas = (page: Page, n: number) => page.getByRole('img', { name: label('admin.viewer.canvas', { page: n }) });
const field = (page: Page, name: string) => page.getByLabel(name, { exact: true });

test('keyboard only: a single-part task is saved with Enter; source and page stay, focus returns to the prompt (FR-3, NFR-8)', async ({ page }) => {
  const backend = await signedInAdmin(page);
  await page.goto(`/admin/tasks/edit?sourceId=${SEED.sourceId}&page=57`);
  await expect(canvas(page, 57)).toBeVisible();
  // The prompt has focus on a new task with a source; Tab walks topic, task number, sub-part, answer type, answer.
  await expect(field(page, m['admin.editor.prompt'])).toBeFocused();
  await page.keyboard.type('Kolik je 7 + 5?');
  await page.keyboard.press('Tab');
  await expect(field(page, m['admin.editor.topic'])).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Tab');
  await page.keyboard.type('4');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel(label('admin.editor.accepted', { n: 1 }))).toBeFocused();
  await page.keyboard.type('12');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText(new RegExp(m['admin.editor.created']));
  const saved = backend.tasks.at(-1);
  expect(saved?.status).toBe('DRAFT');
  expect(saved?.input).toMatchObject({
    prompt: 'Kolik je 7 + 5?',
    topicId: SEED.topicDecimals,
    sourceRef: { sourceId: SEED.sourceId, page: 57, taskNo: '4', subPart: null },
    parts: [{ label: 'a', spec: { type: 'INTEGER', accepted: ['12'] } }],
  });
  // Sticky source and page.
  await expect(field(page, m['admin.editor.source'])).toHaveValue(SEED.sourceId);
  await expect(field(page, m['admin.editor.page'])).toHaveValue('57');
  await expect(field(page, m['admin.editor.prompt'])).toBeFocused();
  await expect(field(page, m['admin.editor.prompt'])).toHaveValue('');
});

test('server refusals appear inline on their fields (Create a task, inline messages)', async ({ page }) => {
  await signedInAdmin(page);
  await page.goto(`/admin/tasks/edit?sourceId=${SEED.sourceId}&page=57`);
  await page.getByLabel(label('admin.editor.accepted', { n: 1 })).fill('12,5');
  await page.getByRole('button', { name: m['admin.editor.save'] }).click();
  await expect(field(page, m['admin.editor.prompt'])).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('12,5 is not a whole number; DECIMAL fits it.')).toBeVisible();
  await expect(field(page, m['admin.editor.prompt'])).toBeFocused();
});

test('the viewer beside the editor jumps to a page and the form keeps its content (FR-2)', async ({ page }) => {
  await signedInAdmin(page);
  await page.goto(`/admin/tasks/edit?sourceId=${SEED.sourceId}&page=57`);
  await field(page, m['admin.editor.prompt']).fill('Rozepsaná úloha');
  await page.getByLabel(m['admin.viewer.page']).fill('30');
  await page.getByLabel(m['admin.viewer.page']).press('Enter');
  await expect(canvas(page, 30)).toBeVisible();
  await expect(field(page, m['admin.editor.prompt'])).toHaveValue('Rozepsaná úloha');
});

test('attach two PNG images, move the second first; the preview shows the new order (FR-4)', async ({ page }) => {
  const backend = await signedInAdmin(page);
  const task = backend.tasks.find((t) => t.taskId === SEED.taskChoice);
  await page.goto(`/admin/tasks/edit?taskId=${SEED.taskChoice}`);
  const images = page.getByRole('region', { name: m['admin.images.title'] });
  await expect(images.getByText(m['admin.images.empty'])).toBeVisible();
  const png = (name: string) => ({ name, mimeType: 'image/png', buffer: Buffer.from(makePng()) });
  await images.getByLabel(m['admin.images.add']).setInputFiles(png('prvni.png'));
  await expect(images.getByRole('img', { name: label('admin.images.alt', { n: 1 }) })).toBeVisible();
  await images.getByLabel(m['admin.images.add']).setInputFiles(png('druhy.png'));
  await expect(images.getByRole('img', { name: label('admin.images.alt', { n: 2 }) })).toBeVisible();
  const [first, second] = task?.images.map((i) => i.imageId) ?? [];
  await images.getByRole('button', { name: label('admin.images.moveEarlier', { n: 2 }) }).click();
  await expect.poll(() => task?.images.map((i) => i.imageId)).toEqual([second, first]);
  await page.goto(`/admin/tasks/preview?taskId=${SEED.taskChoice}`);
  const shown = page.locator('[data-image-id]');
  await expect(shown).toHaveCount(2);
  expect(await shown.evaluateAll((els) => els.map((e) => e.getAttribute('data-image-id')))).toEqual([second, first]);
});

test('a GIF is refused before upload and the images stay unchanged (Rejected image, NFR-17)', async ({ page }) => {
  const backend = await signedInAdmin(page);
  await page.goto(`/admin/tasks/edit?taskId=${SEED.taskDecimal}`);
  const images = page.getByRole('region', { name: m['admin.images.title'] });
  await images.getByLabel(m['admin.images.add']).setInputFiles({ name: 'a.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a....') });
  await expect(images.getByText(m['admin.images.rule'])).toBeVisible();
  expect(backend.tasks[0].images).toHaveLength(1);
});

test.describe('task list (FR-11, FR-13)', () => {
  test('combined filters, search without diacritics and the empty result', async ({ page }) => {
    const backend = await signedInAdmin(page);
    await page.goto('/admin/tasks');
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(4);
    await field(page, m['admin.tasks.source']).selectOption({ label: 'Matematika 6 – pracovní sešit' });
    await field(page, m['admin.tasks.status']).selectOption({ label: m['admin.status.DRAFT'] });
    await field(page, m['admin.tasks.page']).fill('57');
    await field(page, m['admin.tasks.page']).press('Enter');
    await expect(rows).toHaveCount(2);
    await page.goto('/admin/tasks');
    await field(page, m['admin.tasks.search']).fill('obdelnik');
    await field(page, m['admin.tasks.search']).press('Enter');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('obvod obdélníku');
    backend.tasks = backend.tasks.filter((t) => t.input.modality !== 'GRAPHIC');
    await page.goto('/admin/tasks');
    await field(page, m['admin.tasks.modality']).selectOption({ label: m['admin.modality.GRAPHIC'] });
    await expect(page.getByText(m['admin.tasks.empty'])).toBeVisible();
  });

  test('"Open source" opens the PDF viewer at the task page (Open the source at the task page)', async ({ page }) => {
    await signedInAdmin(page);
    await page.goto('/admin/tasks');
    const row = page.getByRole('row', { name: /Zapiš jednu polovinu/ });
    await expect(row.getByText('Matematika 6 – pracovní sešit')).toBeVisible();
    await row.getByRole('link', { name: m['admin.tasks.openSource'] }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/sources/view\\?sourceId=${SEED.sourceId}&page=57$`));
    await expect(canvas(page, 57)).toBeVisible();
  });

  test('bulk publish of selected tasks lists each as published', async ({ page }) => {
    const backend = await signedInAdmin(page);
    await page.goto('/admin/tasks');
    await page.getByRole('checkbox', { name: m['admin.tasks.selectAll'] }).check();
    await page.getByRole('button', { name: label('admin.tasks.publishSelected', { count: 4 }) }).click();
    const result = page.getByRole('region', { name: m['admin.tasks.publishResult'] });
    await expect(result.getByText(m['admin.tasks.published'], { exact: true })).toHaveCount(4);
    expect(backend.tasks.every((t) => t.status === 'PUBLISHED')).toBe(true);
  });
});
