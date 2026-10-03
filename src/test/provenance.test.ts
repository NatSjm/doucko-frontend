// @trace NFR-4
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * CA-D21 (content-authoring "Copyright-safe content"): every fixture is self-authored, every skin
 * asset is self-authored or openly licensed with its licence file listed; listed files exist.
 */
const MANIFEST = 'fixtures/PROVENANCE.md';
const FIXTURE_ROOTS = ['fixtures', 'e2e/fixtures'];
const ASSET_ROOTS = ['src/design-system/fonts', 'src/design-system/icons'];

interface Entry {
  path: string;
  origin: string;
  author: string;
}

function entries(): Entry[] {
  return readFileSync(MANIFEST, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('| `'))
    .map((row) => {
      const cells = row.replace(/^\||\|$/g, '').split('|').map((c) => c.trim().replace(/`/g, ''));
      return { path: cells[0], origin: cells[1] ?? '', author: cells[2] ?? '' };
    });
}

function files(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root).flatMap((name) => {
    const p = `${root}/${name}`;
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

const isFixture = (p: string) => FIXTURE_ROOTS.some((r) => p.startsWith(`${r}/`));
const ignored = (p: string) => p === MANIFEST || p.endsWith('/.gitkeep');

describe('fixture and asset provenance (NFR-4)', () => {
  it('lists every fixture and skin asset', () => {
    const listed = new Set(entries().map((e) => e.path));
    const all = [...FIXTURE_ROOTS, ...ASSET_ROOTS].flatMap(files).filter((p) => !ignored(p));
    expect(all.filter((p) => !listed.has(p))).toEqual([]);
  });

  it('every entry exists, has an author and an allowed origin', () => {
    const bad = entries().filter((e) => {
      const licensed = /^licensed: [A-Za-z0-9.+-]+$/.test(e.origin) && !isFixture(e.path);
      return !(existsSync(join(e.path)) && e.author !== '' && (e.origin === 'self-authored' || licensed));
    });
    expect(bad).toEqual([]);
  });
});
