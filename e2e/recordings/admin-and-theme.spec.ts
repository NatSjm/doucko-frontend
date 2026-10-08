// Phase 6 recordings (G6, --strict-recordings) for the FRs the per-slice recorders did not cover:
// content authoring (slices 1–5: FR-1, FR-2, FR-4, FR-6, FR-7, FR-8, FR-10, FR-11, FR-13), the skin
// and the OS theme (FR-39, FR-58) and progress-stats (slice 9: FR-40, FR-41). Each clip DRIVES the
// flow and ASSERTS the FRs it names; the video, the settled still and the manifest are produced by
// `tools/record-e2e-clips.mjs` (playwright.record.config.ts: Chromium, 1280×720, video on). Excluded
// from the e2e suite (playwright.config.ts testIgnore): the e2e specs remain the regression gate.
// Data: the contract stubs src/test/fake-admin-backend.ts / fake-child-backend.ts (self-authored).
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { findDenied, parseDenyList } from '../../src/features/skin/denylist';
import { format } from '../../src/i18n/format';
import { messages as m } from '../../src/i18n/messages';
import { makePdf, SEED } from '../../src/test/fake-admin-backend';
import { PLACEHOLDER_LADDER } from '../../src/test/fake-child-backend';
import { REPORTS } from '../../src/test/fake-progress-backend';
import { signedInAdmin } from '../fixtures/admin';
import { childBackend, expectChildContent } from '../fixtures/child';
import { expect, test } from '../fixtures/test';

const PAPER = { light: 'rgb(255, 247, 239)', dark: 'rgb(14, 19, 48)' } as const;
const field = (page: Page, name: string) => page.getByLabel(name, { exact: true });
const canvas = (page: Page, n: number) => page.getByRole('img', { name: format(m['admin.viewer.canvas'], { page: n }) });

/** Names the FRs a clip proves (read by tools/record-e2e-clips.mjs) and leaves the settled still. */
function proves(ids: string) {
  test.info().annotations.push({ type: 'proof', description: ids });
}
async function still(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(800);
  const path = test.info().outputPath('still.png');
  await page.screenshot({ path, fullPage: true });
  await test.info().attach('still', { path, contentType: 'image/png' });
}

test('rec-source-upload: upload a PDF source with title, publisher, edition, grade and subject (FR-1)', async ({ page }) => {
  proves('FR-1');
  const backend = await signedInAdmin(page, { seeded: false });
  await page.goto('/admin/sources');
  await page.getByLabel(m['admin.sources.file']).setInputFiles({ name: 'sesit.pdf', mimeType: 'application/pdf', buffer: Buffer.from(makePdf(12)) });
  await page.getByLabel(m['admin.sources.sourceTitle']).fill('Matematika 6 – pracovní sešit');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Testovací nakladatelství');
  await page.keyboard.press('Tab');
  await page.keyboard.type('1');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText(m['admin.sources.uploaded']);
  const row = page.getByRole('row', { name: /Matematika 6 – pracovní sešit/ });
  await expect(row.getByRole('cell', { name: '12', exact: true })).toBeVisible();
  await expect(row.getByRole('cell', { name: 'Testovací nakladatelství' })).toBeVisible();
  expect(backend.sources[0].source).toMatchObject({ grade: 6, subject: 'math', edition: '1', pageCount: 12, publisher: 'Testovací nakladatelství' });
  await still(page);
});

test('rec-pdf-beside-editor: the PDF viewer beside the task editor jumps to a page; the form keeps its content (FR-2)', async ({ page }) => {
  proves('FR-2');
  await signedInAdmin(page);
  await page.goto(`/admin/tasks/edit?sourceId=${SEED.sourceId}&page=57`);
  await expect(canvas(page, 57)).toBeVisible();
  await field(page, m['admin.editor.prompt']).fill('Rozepsaná úloha');
  await page.getByRole('button', { name: m['admin.viewer.next'] }).click();
  await expect(canvas(page, 58)).toBeVisible();
  await page.getByLabel(m['admin.viewer.page']).fill('30');
  await page.getByLabel(m['admin.viewer.page']).press('Enter');
  await expect(canvas(page, 30)).toBeVisible();
  expect(await canvas(page, 30).evaluate((c) => (c as HTMLCanvasElement).width > 0)).toBe(true);
  await expect(field(page, m['admin.editor.prompt'])).toHaveValue('Rozepsaná úloha');
  await still(page);
});

test('rec-task-images: attach two PNG images and reorder them; the child preview shows them in order (FR-4)', async ({ page }) => {
  proves('FR-4');
  const backend = await signedInAdmin(page);
  const task = backend.tasks.find((t) => t.taskId === SEED.taskChoice);
  await page.goto(`/admin/tasks/edit?taskId=${SEED.taskChoice}`);
  const images = page.getByRole('region', { name: m['admin.images.title'] });
  // Visible, distinguishable self-authored images (a 1-px PNG would not show the order in the still).
  const png = async (name: string, label: string, colour: string) => {
    const painter = await page.context().newPage();
    await painter.setContent(`<div style="width:240px;height:160px;background:${colour};color:#fff;font:bold 96px sans-serif;display:grid;place-items:center">${label}</div>`);
    const buffer = await painter.locator('div').screenshot();
    await painter.close();
    return { name, mimeType: 'image/png', buffer };
  };
  await images.getByLabel(m['admin.images.add']).setInputFiles(await png('prvni.png', '1', '#1d4ed8'));
  await expect(images.getByRole('img', { name: format(m['admin.images.alt'], { n: 1 }) })).toBeVisible();
  await images.getByLabel(m['admin.images.add']).setInputFiles(await png('druhy.png', '2', '#047857'));
  await expect(images.getByRole('img', { name: format(m['admin.images.alt'], { n: 2 }) })).toBeVisible();
  const [first, second] = task?.images.map((i) => i.imageId) ?? [];
  await images.getByRole('button', { name: format(m['admin.images.moveEarlier'], { n: 2 }) }).click();
  await expect.poll(() => task?.images.map((i) => i.imageId)).toEqual([second, first]);
  await page.goto(`/admin/tasks/preview?taskId=${SEED.taskChoice}`);
  const shown = page.locator('[data-image-id]');
  await expect(shown).toHaveCount(2);
  expect(await shown.evaluateAll((els) => els.map((e) => e.getAttribute('data-image-id')))).toEqual([second, first]);
  await still(page);
});

test('rec-parts-hints-translations: a task with two answer parts, ordered hints and a Ukrainian translation is saved (FR-6, FR-7, FR-8)', async ({ page }) => {
  proves('FR-6, FR-7, FR-8');
  const backend = await signedInAdmin(page);
  await page.goto(`/admin/tasks/edit?taskId=${SEED.taskDecimal}`);
  const parts = page.getByRole('group', { name: m['admin.editor.parts'] }).or(page.getByRole('region', { name: m['admin.editor.parts'] }));
  await page.getByRole('button', { name: m['admin.editor.addPart'] }).click();
  await field(page, format(m['admin.editor.accepted'], { n: 1 })).last().fill('3');
  await page.getByRole('button', { name: m['admin.editor.addHint'] }).click();
  await field(page, format(m['admin.editor.hint'], { n: 3 })).fill('Desetina je jedna děleno deseti.');
  await field(page, format(m['admin.editor.trHint'], { n: 1, locale: 'uk' })).fill('Половина — це один поділити на два.');
  await page.getByRole('button', { name: m['admin.editor.save'] }).click();
  await expect(page.getByText(m['admin.editor.updated'])).toBeVisible();
  const saved = backend.tasks.find((t) => t.taskId === SEED.taskDecimal)!.input;
  // FR-6: two parts, each with its own label and answer spec.
  expect(saved.parts).toHaveLength(2);
  expect(saved.parts[0].spec.accepted).toEqual(['0.5']);
  expect(saved.parts[1].spec.accepted).toEqual(['3']);
  expect(saved.parts.map((p) => p.label).every((l) => l.length > 0)).toBe(true);
  // FR-7: three hints in order.
  expect(saved.hints).toEqual(['Polovina je jedna děleno dvěma.', 'Kolik je pět desetin?', 'Desetina je jedna děleno deseti.']);
  // FR-8: the uk translation of prompt and hint 1.
  expect(saved.translations?.uk?.prompt).toBe('Запиши одну половину як десятковий дріб.');
  expect(saved.translations?.uk?.hints?.[0]).toBe('Половина — це один поділити на два.');
  await expect(parts.first()).toBeVisible();
  await still(page);
});

test('rec-preview-tester: preview as the child sees it, hints one by one, the translation, then the answer tester (FR-10, FR-7, FR-8)', async ({ page }) => {
  proves('FR-10, FR-7, FR-8');
  await signedInAdmin(page);
  await page.goto(`/admin/tasks/preview?taskId=${SEED.taskDecimal}`);
  const view = page.getByRole('region', { name: m['admin.preview.childView'] });
  await expect(view.getByText('Zapiš jednu polovinu jako desetinné číslo.')).toBeVisible();
  await expect(page.getByText('Matematika 6 – pracovní sešit')).toHaveCount(0);
  await view.getByRole('button', { name: new RegExp(m['child.task.hint']) }).click();
  await expect(view.getByText('Polovina je jedna děleno dvěma.')).toBeVisible();
  await view.getByRole('button', { name: m['child.task.showTranslation'] }).click();
  await expect(view.locator('[lang="uk"]').getByText('Запиши одну половину як десятковий дріб.')).toBeVisible();
  const tester = page.getByRole('region', { name: m['admin.preview.tester'] });
  const answer = tester.getByLabel(format(m['admin.preview.answerFor'], { label: 'a' }));
  const result = tester.getByRole('group', { name: format(m['admin.preview.result'], { label: 'a' }) });
  await answer.fill('0,4');
  await answer.press('Enter');
  await expect(result.getByText(m['admin.verdict.WRONG'])).toBeVisible();
  await answer.fill('0,50');
  await answer.press('Enter');
  await expect(result.getByText(m['admin.verdict.CORRECT'])).toBeVisible();
  await expect(result.getByText('0.5', { exact: true })).toBeVisible();
  await still(page);
});

test('rec-task-list-provenance: filter and search the task list, see the source of a task and open the PDF at its page (FR-11, FR-13)', async ({ page }) => {
  proves('FR-11, FR-13');
  await signedInAdmin(page);
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
  await page.goto('/admin/tasks');
  const row = page.getByRole('row', { name: /Zapiš jednu polovinu/ });
  await expect(row.getByText('Matematika 6 – pracovní sešit')).toBeVisible();
  await expect(row).toContainText('Edition 1 · Page 57 · Task 4');
  await row.getByRole('link', { name: m['admin.tasks.openSource'] }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/sources/view\\?sourceId=${SEED.sourceId}&page=57$`));
  await expect(canvas(page, 57)).toBeVisible();
  await still(page);
});

test('rec-skin-hq: HQ shows the rank from the server ladder and no deny-listed term anywhere on the child screen (FR-39)', async ({ page }) => {
  proves('FR-39');
  await childBackend(page);
  await page.goto('/');
  await expectChildContent(page);
  const panel = page.getByRole('region', { name: m['child.hq.progressTitle'] });
  await expect(panel.getByText(PLACEHOLDER_LADDER[0].name, { exact: true })).toBeVisible();
  const terms = parseDenyList(readFileSync('contract/docs/skin/ip-denylist.txt', 'utf8'));
  expect(terms.length).toBeGreaterThan(0);
  expect(findDenied(await page.locator('body').innerText(), terms)).toEqual([]);
  await still(page);
});

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} OS`, () => {
    test.use({ colorScheme: scheme });
    test(`rec-theme-${scheme}: HQ and the admin stats page follow the ${scheme} OS setting; no in-app toggle (FR-58)`, async ({ page }) => {
      proves('FR-58');
      await signedInAdmin(page);
      await page.goto('/admin/stats');
      await expect(page.getByRole('heading', { level: 1, name: m['admin.stats.title'] })).toBeVisible();
      await expect(page.locator('body')).toHaveCSS('background-color', PAPER[scheme]);
      await expect(page.locator('[data-theme], .dk-toggle, [role=switch]')).toHaveCount(0);
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await childBackend(page);
      await page.goto('/');
      await expectChildContent(page);
      await expect(page.locator('body')).toHaveCSS('background-color', PAPER[scheme]);
      await expect(page.locator('[data-theme], .dk-toggle, [role=switch]')).toHaveCount(0);
      await still(page);
    });
  });
}

test('rec-stats: the stats page shows sessions per week, tasks per session, first-try rate per topic, hints and revealed tasks (FR-40)', async ({ page }) => {
  proves('FR-40');
  await signedInAdmin(page);
  await page.goto('/admin');
  await page.getByRole('navigation', { name: m['admin.nav.label'] }).getByRole('link', { name: m['admin.nav.stats'], exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/stats$/);
  const weekRows = page.getByRole('table', { name: m['admin.stats.weeklyCaption'] }).locator('tbody tr');
  await expect(weekRows).toHaveCount(5);
  await expect(weekRows.nth(1).getByRole('cell')).toHaveText([`2026-09-28${m['admin.stats.metricWeek']}`, '3', '3', '12, 10, 11', '7', '3']);
  const metric = page.getByRole('region', { name: m['admin.stats.metricTitle'] });
  await expect(metric.getByText(m['admin.stats.metricNotMet'], { exact: true })).toBeVisible();
  const topics = page.getByRole('table', { name: m['admin.stats.topicsCaption'] });
  await expect(topics.getByRole('row', { name: /Desetinná čísla/ }).getByRole('cell')).toHaveText([
    'Desetinná čísla',
    format(m['admin.stats.rate'], { percent: 75 }),
    format(m['admin.stats.resolved'], { firstTry: 6, resolved: 8 }),
  ]);
  await still(page);
});

test('rec-flag-queue: a report lists task, raw input and verdict; dismiss one, fix the spec and re-evaluate another (+4 XP) (FR-41)', async ({ page }) => {
  proves('FR-41');
  const backend = await signedInAdmin(page);
  const task = backend.tasks.find((t) => t.taskId === SEED.taskDecimal);
  if (task) task.input.parts[0].spec.accepted = ['0.05'];
  await page.goto('/admin');
  await page.getByRole('navigation', { name: m['admin.nav.label'] }).getByRole('link', { name: m['admin.nav.reports'], exact: true }).click();
  const entry = (id: string) => page.locator(`[data-report="${id}"]`);
  await entry(REPORTS.openNoAttempt).getByRole('button', { name: m['admin.reports.dismiss'] }).click();
  await expect(entry(REPORTS.openNoAttempt).getByText(m['admin.reports.status.DISMISSED'], { exact: true })).toBeVisible();
  const first = entry(REPORTS.openRevealed);
  await expect(first.getByRole('heading')).toHaveText('Zapiš jednu polovinu jako desetinné číslo.');
  await expect(first.getByRole('table').locator('tbody tr').first().getByRole('cell')).toHaveText(['a', '0,5', m['admin.reports.verdict.WRONG'], m['admin.reports.notReevaluated']]);
  await first.getByRole('link', { name: m['admin.reports.openTask'] }).click();
  const accepted = page.getByLabel(format(m['admin.editor.accepted'], { n: 1 }), { exact: true });
  await accepted.fill('0.5');
  await page.getByRole('button', { name: m['admin.editor.save'] }).click();
  await expect(page.getByText(m['admin.editor.updated'])).toBeVisible();
  await page.getByRole('navigation', { name: m['admin.nav.label'] }).getByRole('link', { name: m['admin.nav.reports'], exact: true }).click();
  await entry(REPORTS.openRevealed).getByRole('button', { name: m['admin.reports.reevaluate'] }).click();
  await expect(page.getByRole('status')).toHaveText(format(m['admin.reports.fixedXp'], { task: 'Zapiš jednu polovinu jako desetinné číslo.', xp: 4 }));
  expect(backend.progress.awards).toEqual([{ reportId: REPORTS.openRevealed, xp: 4, bonus: 0 }]);
  await expect(entry(REPORTS.openRevealed).getByText(m['admin.reports.status.FIXED'], { exact: true })).toBeVisible();
  await entry(REPORTS.openRevealed).scrollIntoViewIfNeeded();
  await still(page);
});
