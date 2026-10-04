/** NFR-17: sources are PDF files of at most 50 MB; task images PNG or JPG files of at most 5 MB. */
export const MAX_PDF_BYTES = 50 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type FileCheck = 'ok' | 'type' | 'size';

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const PNG = [0x89, 0x50, 0x4e, 0x47];
const JPG = [0xff, 0xd8, 0xff];

async function head(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, 8).arrayBuffer());
}

const starts = (bytes: Uint8Array, signature: number[]) => signature.every((b, i) => bytes[i] === b);

/**
 * Checks a file before upload. The content decides the type, not the name (CA-D1), as on the
 * server, so the admin hears about a wrong file before a 50 MB upload; the server checks again.
 */
async function check(file: File, signatures: number[][], max: number): Promise<FileCheck> {
  const bytes = await head(file).catch(() => new Uint8Array());
  if (!signatures.some((s) => starts(bytes, s))) return 'type';
  return file.size > max ? 'size' : 'ok';
}

export const checkPdfFile = (file: File) => check(file, [PDF], MAX_PDF_BYTES);
export const checkImageFile = (file: File) => check(file, [PNG, JPG], MAX_IMAGE_BYTES);
