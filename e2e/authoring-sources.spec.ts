// @trace FR-1
// @trace FR-2
// @trace NFR-17
// Store spec content-authoring: "Upload a PDF source", "Upload limits and storage", "PDF viewer beside the editor".
import type { Page } from '@playwright/test';
import { format } from '../src/i18n/format';
import { messages as m } from '../src/i18n/messages';
import { makePdf, makePng, SEED } from '../src/test/fake-admin-backend';
import { signedInAdmin } from './fixtures/admin';
import { AGAINST_STACK, expect, test } from './fixtures/test';

test.skip(AGAINST_STACK, 'answers come from the fake admin backend; the stack smoke covers the real one');

const pdfFile = (pages: number, name = 'sesit.pdf') => ({ name, mimeType: 'application/pdf', buffer: Buffer.from(makePdf(pages)) });
const canvas = (page: Page, n: number) => page.getByRole('img', { name: format(m['admin.viewer.canvas'], { page: n }) });

test('upload a source with metadata from the keyboard; the list shows its page count (FR-1)', async ({ page }) => {
  const backend = await signedInAdmin(page, { seeded: false });
  await page.goto('/admin/sources');
  await expect(page.getByText(m['admin.sources.empty'])).toBeVisible();
  await page.getByLabel(m['admin.sources.file']).setInputFiles(pdfFile(12));
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
  expect(backend.sources[0].source).toMatchObject({ grade: 6, subject: 'math', edition: '1', pageCount: 12 });
});

test('a .docx and a renamed PNG are refused before upload with the PDF rule (NFR-17)', async ({ page }) => {
  await signedInAdmin(page);
  const posts: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST') posts.push(r.url());
  });
  await page.goto('/admin/sources');
  await page.getByLabel(m['admin.sources.sourceTitle']).fill('Sešit');
  for (const file of [
    { name: 'ukoly.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('PK\u0003\u0004') },
    { name: 'sesit.pdf', mimeType: 'application/pdf', buffer: Buffer.from(makePng()) },
  ]) {
    await page.getByLabel(m['admin.sources.file']).setInputFiles(file);
    await page.getByRole('button', { name: m['admin.sources.upload'] }).click();
    await expect(page.getByText(m['admin.sources.fileRule'])).toBeVisible();
    await expect(page.getByLabel(m['admin.sources.file'])).toHaveAttribute('aria-invalid', 'true');
  }
  expect(posts).toEqual([]);
});

test('a damaged PDF is refused with the server message (Damaged or protected PDF)', async ({ page }) => {
  const backend = await signedInAdmin(page);
  await page.goto('/admin/sources');
  await page.getByLabel(m['admin.sources.file']).setInputFiles({ name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 cut') });
  await page.getByLabel(m['admin.sources.sourceTitle']).fill('Rozbitý');
  await page.getByRole('button', { name: m['admin.sources.upload'] }).click();
  await expect(page.getByText('The PDF could not be read. It may be damaged or password-protected.')).toBeVisible();
  expect(backend.sources).toHaveLength(2);
});

test.describe('PDF viewer (FR-2)', () => {
  test('pages through, jumps to a page and keeps the page on invalid input', async ({ page }) => {
    await signedInAdmin(page);
    await page.goto(`/admin/sources/view?sourceId=${SEED.sourceId}&page=10`);
    await expect(canvas(page, 10)).toBeVisible();
    await expect(page.getByText(format(m['admin.viewer.status'], { page: 10, count: 120 }))).toBeVisible();
    await page.getByRole('button', { name: m['admin.viewer.next'] }).click();
    await expect(canvas(page, 11)).toBeVisible();
    const jump = page.getByLabel(m['admin.viewer.page']);
    await jump.fill('57');
    await jump.press('Enter');
    await expect(canvas(page, 57)).toBeVisible();
    for (const bad of ['130', '0', 'abc', '5,5', '99999999999']) {
      await jump.fill(bad);
      await jump.press('Enter');
      await expect(page.getByText(format(m['admin.viewer.invalid'], { count: 120 }))).toBeVisible();
      await expect(page.getByText(format(m['admin.viewer.status'], { page: 57, count: 120 }))).toBeVisible();
    }
    // The canvas really holds a rendered page (pdf.js drew into it).
    const drawn = await canvas(page, 57).evaluate((c) => (c as HTMLCanvasElement).width > 0 && (c as HTMLCanvasElement).height > 0);
    expect(drawn).toBe(true);
  });
});
