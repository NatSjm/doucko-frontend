// @trace FR-58
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * FR-58 / gamification "Light and dark theme": the OS decides the theme. No app source outside the
 * vendored design system sets `data-theme` or a colour scheme, so no control added later can switch
 * it. (The e2e activates every control on every screen; this covers screens and states it cannot reach.)
 */
/** data-theme, a colour-scheme declaration or meta, or a theme class toggled on an element. */
const THEME_WRITE = /data-theme|dataset\.theme|colorScheme|color-scheme|classList\.\w+\(\s*['"`](dark|light|theme)/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name).replaceAll('\\', '/');
    if (statSync(p).isDirectory()) return p.startsWith('src/design-system') || p.startsWith('src/api/generated') ? [] : sources(p);
    return /\.(tsx?|css)$/.test(p) && !/\.test\.tsx?$/.test(p) ? [p] : [];
  });
}

describe('theme follows the OS (FR-58)', () => {
  it('no app source sets data-theme or a colour scheme', () => {
    const files = [...sources('src'), 'index.html'];
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((f) => THEME_WRITE.test(readFileSync(f, 'utf8')))).toEqual([]);
  });
});
