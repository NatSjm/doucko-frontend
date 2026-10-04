import type { PdfDocument } from '@/features/sources/pdf';

/**
 * Stands in for `src/features/sources/pdf.ts` in jsdom (no canvas): the page count is read from the
 * PDF bytes, and "rendering" records the page on the canvas. Use with
 * `vi.mock('@/features/sources/pdf', () => import('@/test/pdf-mock'))`.
 */
export const rendered: number[] = [];
/** Set to a pending promise to hold every render until it settles (a render still running). */
/** `fail` makes renders reject; `maxConcurrent` and `destroyed` record how the viewer used the document. */
export const control = { hold: null as Promise<void> | null, fail: false, running: 0, maxConcurrent: 0, destroyed: 0 };

export async function loadPdf(data: ArrayBuffer): Promise<PdfDocument> {
  const text = new TextDecoder('latin1').decode(data);
  if (!text.startsWith('%PDF-')) throw new Error('not a PDF');
  const numPages = (text.match(/\/Type\s*\/Page\b(?!s)/g) ?? []).length;
  return {
    numPages,
    async renderPage(page: number) {
      control.running += 1;
      control.maxConcurrent = Math.max(control.maxConcurrent, control.running);
      try {
        if (control.hold) await control.hold;
        if (control.fail) throw new Error('render failed');
        rendered.push(page);
      } finally {
        control.running -= 1;
      }
    },
    destroy() {
      control.destroyed += 1;
    },
  };
}
