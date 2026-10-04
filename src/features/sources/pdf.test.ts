// @trace FR-2
import { describe, expect, it, vi } from 'vitest';

const render = vi.fn(() => ({ promise: Promise.resolve() }));
const getPage = vi.fn(async () => ({
  getViewport: ({ scale }: { scale: number }) => ({ width: 595 * scale, height: 842 * scale, scale }),
  render,
}));
const destroy = vi.fn();
const getDocument = vi.fn(() => ({ promise: Promise.resolve({ numPages: 3, getPage }), destroy }));
const GlobalWorkerOptions = { workerSrc: '' };

vi.mock('pdfjs-dist', () => ({ getDocument, GlobalWorkerOptions }));
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: '/assets/pdf.worker.js' }));

const { loadPdf } = await import('./pdf');

describe('loadPdf (pdf.js adapter)', () => {
  it('opens the bytes with a same-origin worker and reports the page count', async () => {
    const data = new ArrayBuffer(8);
    const doc = await loadPdf(data);
    expect(GlobalWorkerOptions.workerSrc).toBe('/assets/pdf.worker.js');
    expect(getDocument).toHaveBeenCalledWith(expect.objectContaining({ data: new Uint8Array(data) }));
    expect(doc.numPages).toBe(3);
  });

  it('renders a page into the canvas at a readable scale', async () => {
    const doc = await loadPdf(new ArrayBuffer(8));
    const canvas = document.createElement('canvas');
    await doc.renderPage(2, canvas);
    expect(getPage).toHaveBeenCalledWith(2);
    expect(canvas.width).toBe(Math.round(595 * 1.5));
    expect(canvas.height).toBe(Math.round(842 * 1.5));
    expect(render).toHaveBeenCalledWith(expect.objectContaining({ canvas }));
  });

  it('releases the document (its loading task)', async () => {
    const doc = await loadPdf(new ArrayBuffer(8));
    doc.destroy();
    expect(destroy).toHaveBeenCalled();
  });
});
