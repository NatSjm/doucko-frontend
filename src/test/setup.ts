import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';
import { afterEach } from 'vitest';

/**
 * jsdom brings its own FormData, File and Blob, which Node's fetch `Request` (used by openapi-fetch
 * and the stubbed backend) cannot serialize. Multipart uploads therefore use Node's classes; the
 * FormData class is taken from a Node `Response`, the only public way to reach it.
 */
const nodeFormData = (await new Response('a=1', { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }).formData()).constructor;
for (const [name, value] of Object.entries({ FormData: nodeFormData, File: NodeFile, Blob: NodeBlob }))
  Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });

afterEach(() => {
  cleanup();
});

/** jsdom has no object URLs; images and PDFs fetched as blobs get a stable fake one. */
let objectUrls = 0;
if (!URL.createObjectURL) URL.createObjectURL = () => `blob:test/${++objectUrls}`;
if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {};
