// @trace NFR-12
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * NFR-12: the TypeScript client types come from the pinned contract (`contract/api/openapi.yaml`)
 * through `api:generate` (run by `typecheck` and `build`), never by hand.
 */
const CONTRACT = 'contract/api/openapi.yaml';
const GENERATED = 'src/api/generated/schema.d.ts';

describe('generated contract client (NFR-12)', () => {
  it('reads the pinned contract submodule', () => {
    expect(existsSync(CONTRACT)).toBe(true);
  });

  it('declares every contract path', () => {
    const paths = [...readFileSync(CONTRACT, 'utf8').matchAll(/^ {2}(\/api\/[^:\s]+):\s*$/gm)].map((m) => m[1]);
    expect(paths.length).toBeGreaterThan(30);
    const schema = readFileSync(GENERATED, 'utf8');
    expect(paths.filter((p) => !schema.includes(`"${p}"`))).toEqual([]);
  });
});
