// @trace NFR-12
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * NFR-12: the TypeScript client types come from the pinned contract (`contract/api/openapi.yaml`)
 * through `api:generate` (run by `typecheck` and `build`), never by hand.
 */
const CONTRACT = 'contract/api/openapi.yaml';
const GENERATED = 'src/api/generated/schema.d.ts';

/** Keys of the contract's top-level `paths:` map (two-space indented, up to the next top-level key). */
function contractPaths(yaml: string): string[] {
  const block = /^paths:\s*\n([\s\S]*?)(?=^\S)/m.exec(yaml)?.[1] ?? '';
  return [...block.matchAll(/^ {2}(\/[^:\s]*):\s*$/gm)].map((m) => m[1]);
}

/** Keys of the generated `paths` interface. */
function generatedPaths(dts: string): string[] {
  const block = /^export interface paths \{\n([\s\S]*?)^\}/m.exec(dts)?.[1] ?? '';
  return [...block.matchAll(/^ {4}"(\/[^"]*)": \{/gm)].map((m) => m[1]);
}

describe('generated contract client (NFR-12)', () => {
  it('reads the pinned contract submodule', () => {
    expect(existsSync(CONTRACT)).toBe(true);
  });

  it('the generated paths type has exactly the contract paths', () => {
    expect(existsSync(GENERATED), `${GENERATED} is missing: run npm run api:generate (typecheck and build run it)`).toBe(true);
    const contract = contractPaths(readFileSync(CONTRACT, 'utf8'));
    expect(contract.length).toBeGreaterThan(30);
    expect(generatedPaths(readFileSync(GENERATED, 'utf8')).sort()).toEqual([...contract].sort());
  });
});
