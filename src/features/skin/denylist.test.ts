// @trace FR-39
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cs } from '@/i18n/cs';
import { findDenied, parseDenyList } from './denylist';

/** The store's deny-list at the pinned contract version (gamification "Swappable skin"). */
const DENYLIST = readFileSync('contract/docs/skin/ip-denylist.txt', 'utf8');
const ASSET = /\.(svg|png|jpe?g|webp|gif|avif|woff2?|ttf|otf|ico|mp3|ogg|wav)$/i;

/** Every shipped asset file name under `src/` and `public/` (the frontend's share of the skin's art and fonts). */
function assetNames(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? assetNames(path) : ASSET.test(name) ? [name] : [];
  });
}

describe('IP deny-list (FR-39)', () => {
  const terms = parseDenyList(DENYLIST);

  it('reads the terms of the pinned deny-list, skipping comments and blank lines', () => {
    expect(terms).toContain('Plus Ultra');
    expect(terms).toContain('My Hero Academia');
    expect(terms.some((t) => t.startsWith('#') || t.trim() === '')).toBe(false);
    expect(terms.length).toBeGreaterThan(40);
  });

  it('the Czech child catalog (theme copy), keys and values, uses no deny-listed term', () => {
    const text = [...Object.keys(cs), ...Object.values(cs)].join('\n');
    expect(findDenied(text, terms)).toEqual([]);
  });

  it('no shipped asset file name uses a deny-listed term', () => {
    const names = [...assetNames('src'), ...assetNames('public')];
    expect(names.length).toBeGreaterThan(0);
    expect(findDenied(names.join('\n'), terms)).toEqual([]);
  });

  it('catches a borrowed term in a test skin: "Akademie Plus Ultra"', () => {
    expect(findDenied('Akademie Plus Ultra', terms)).toEqual(['Plus Ultra']);
  });

  it('matches case-insensitively, as a whole word or phrase only, without folding diacritics', () => {
    expect(findDenied('akademie plus ultra!', ['Plus Ultra'])).toEqual(['Plus Ultra']);
    expect(findDenied('PLUS ULTRA', ['Plus Ultra'])).toEqual(['Plus Ultra']);
    expect(findDenied('Quirky', ['Quirk'])).toEqual([]);
    expect(findDenied('superquirk', ['Quirk'])).toEqual([]);
    expect(findDenied('Quirk2', ['Quirk'])).toEqual([]);
    expect(findDenied('(Quirk)', ['Quirk'])).toEqual(['Quirk']);
    expect(findDenied('U.A.', ['U.A.'])).toEqual(['U.A.']);
    expect(findDenied('Erika', ['Eri'])).toEqual([]);
    expect(findDenied('Erí', ['Eri'])).toEqual([]);
    expect(findDenied('Nováček, Kadet, Strážce, Hrdina, Legenda', terms)).toEqual([]);
  });
});
