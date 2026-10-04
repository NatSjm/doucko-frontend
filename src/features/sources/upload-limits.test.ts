// @trace NFR-17
import { describe, expect, it } from 'vitest';
import { makePdf, makePng } from '@/test/fake-admin-backend';
import { checkImageFile, checkPdfFile, MAX_IMAGE_BYTES, MAX_PDF_BYTES } from './upload-limits';

const file = (bytes: Uint8Array | string, name: string, type = '') => new File([bytes as BlobPart], name, { type });
/** A file of `size` bytes that starts with `head` (the rest zeros). */
const sized = (head: Uint8Array, size: number, name: string) => {
  const bytes = new Uint8Array(size);
  bytes.set(head);
  return file(bytes, name);
};

describe('PDF sources (NFR-17: PDF only, at most 50 MB; content decides, CA-D1)', () => {
  it('accepts a PDF by its signature', async () => {
    expect(await checkPdfFile(file(makePdf(2), 'sesit.pdf', 'application/pdf'))).toBe('ok');
  });

  it('refuses a .docx, and a PNG renamed to .pdf', async () => {
    expect(await checkPdfFile(file('PK\u0003\u0004 word', 'ukoly.docx'))).toBe('type');
    expect(await checkPdfFile(file(makePng(), 'sesit.pdf', 'application/pdf'))).toBe('type');
  });

  it('accepts exactly 50 MB and refuses 50 MB + 1 byte', async () => {
    expect(MAX_PDF_BYTES).toBe(50 * 1024 * 1024);
    expect(await checkPdfFile(sized(makePdf(1), MAX_PDF_BYTES, 'a.pdf'))).toBe('ok');
    expect(await checkPdfFile(sized(makePdf(1), MAX_PDF_BYTES + 1, 'a.pdf'))).toBe('size');
  });

  it('refuses an empty file as not a PDF', async () => {
    expect(await checkPdfFile(file('', 'empty.pdf'))).toBe('type');
  });
});

describe('task images (NFR-17: PNG or JPG, at most 5 MB)', () => {
  it('accepts PNG and JPG by signature', async () => {
    expect(await checkImageFile(file(makePng(), 'a.png'))).toBe('ok');
    expect(await checkImageFile(file(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]), 'a.jpg'))).toBe('ok');
  });

  it('refuses a GIF and a PDF renamed to .png', async () => {
    expect(await checkImageFile(file('GIF89a....', 'a.gif'))).toBe('type');
    expect(await checkImageFile(file(makePdf(1), 'a.png'))).toBe('type');
  });

  it('accepts exactly 5 MB and refuses a 6 MB JPG', async () => {
    expect(MAX_IMAGE_BYTES).toBe(5 * 1024 * 1024);
    expect(await checkImageFile(sized(makePng(), MAX_IMAGE_BYTES, 'a.png'))).toBe('ok');
    expect(await checkImageFile(sized(new Uint8Array([0xff, 0xd8, 0xff]), 6 * 1024 * 1024, 'a.jpg'))).toBe('size');
  });
});

describe('a file that cannot be read (review F11)', () => {
  it('counts as the wrong type instead of failing', async () => {
    const broken = new File(['x'], 'x.pdf');
    Object.defineProperty(broken, 'slice', { value: () => ({ arrayBuffer: () => Promise.reject(new Error('gone')) }) });
    expect(await checkPdfFile(broken)).toBe('type');
  });
});
