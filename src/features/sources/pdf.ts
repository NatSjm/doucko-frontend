import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/** A loaded PDF: its page count and a way to draw one page into a canvas. */
export interface PdfDocument {
  numPages: number;
  renderPage(page: number, canvas: HTMLCanvasElement): Promise<void>;
  destroy(): void;
}

/** Scale of the rendered page: an A4 page is then about 900 px wide, readable beside the form. */
const SCALE = 1.5;

/**
 * Opens PDF bytes with pdf.js. The worker is a same-origin built asset (CSP `script-src 'self'`);
 * the page is drawn into a canvas, because the CSP forbids framing the PDF (`frame-ancestors`).
 */
export async function loadPdf(data: ArrayBuffer): Promise<PdfDocument> {
  GlobalWorkerOptions.workerSrc = workerUrl;
  const task = getDocument({ data: new Uint8Array(data) });
  const doc = await task.promise;
  return {
    numPages: doc.numPages,
    async renderPage(page, canvas) {
      const pdfPage = await doc.getPage(page);
      const viewport = pdfPage.getViewport({ scale: SCALE });
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await pdfPage.render({ canvas, viewport }).promise;
    },
    destroy() {
      void task.destroy();
    },
  };
}
