import type { PdfDocument } from '@/features/sources/pdf';

/**
 * Stands in for `src/features/sources/pdf.ts` in jsdom (no canvas): the page count is read from the
 * PDF bytes, and "rendering" records the page on the canvas. Use with
 * `vi.mock('@/features/sources/pdf', () => import('@/test/pdf-mock'))`.
 */
export const rendered: number[] = [];
/** Set to a pending promise to hold every render until it settles (a render still running). */
export const control: { hold: Promise<void> | null } = { hold: null };

export async function loadPdf(data: ArrayBuffer): Promise<PdfDocument> {
  const text = new TextDecoder('latin1').decode(data);
  if (!text.startsWith('%PDF-')) throw new Error('not a PDF');
  const numPages = (text.match(/\/Type\s*\/Page\b(?!s)/g) ?? []).length;
  return {
    numPages,
    async renderPage(page: number) {
      if (control.hold) await control.hold;
      rendered.push(page);
    },
    destroy() {},
  };
}
