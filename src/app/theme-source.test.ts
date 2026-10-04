// @trace FR-58
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * FR-58 / gamification "Light and dark theme": the OS decides the theme. The design system owns the
 * tokens and both schemes, so app code (everything outside the vendored design system) gets three
 * invariants instead of a list of known tricks:
 *   1. it never declares or sets a CSS custom property (no `--x:` in any rule or style object, no
 *      `setProperty('--…')`): a theme cannot be forced by overriding tokens, on any element;
 *   2. it never touches the colour scheme (`data-theme`, `dataset.theme`, `colorScheme`,
 *      `color-scheme`, `prefers-color-scheme`);
 *   3. no string literal in it names a scheme (`dark`, `light`, `theme…`), so no class, attribute or
 *      variable can carry one, however it is built or applied.
 * The message catalogs are not code and are left out of (3). The e2e activates every control on
 * every screen; this covers screens and states it cannot reach.
 */
const TOKEN_WRITE = /--[\w-]+['"`]?\s*:|setProperty\(\s*['"`]--/;
const SCHEME_API = /data-theme|dataset\.theme|colorScheme|color-scheme|prefers-color-scheme/;
const SCHEME_WORD = /(['"`])(?:(?!\1)[^\n\\]|\\.)*?\b(dark|light|theme\w*)\b(?:(?!\1)[^\n\\]|\\.)*?\1/i;
const CATALOGS = ['src/i18n/cs.ts', 'src/i18n/en.ts'];

/** Every invariant `text` breaks; empty when it keeps all three. */
export function themeViolations(text: string, isCatalog = false): string[] {
  return [
    TOKEN_WRITE.test(text) && 'declares or sets a CSS custom property',
    SCHEME_API.test(text) && 'touches the colour scheme',
    !isCatalog && SCHEME_WORD.test(text) && 'names a scheme in a string literal',
  ].filter((v): v is string => typeof v === 'string');
}

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name).replaceAll('\\', '/');
    if (statSync(p).isDirectory()) return p.startsWith('src/design-system') || p.startsWith('src/api/generated') ? [] : sources(p);
    return /\.(tsx?|css)$/.test(p) && !/\.test\.tsx?$/.test(p) ? [p] : [];
  });
}

describe('theme follows the OS (FR-58)', () => {
  it('the invariants catch the ways a theme can be forced', () => {
    const forced = [
      "document.documentElement.dataset.theme = 'dark'",
      'root.classList.toggle(`theme-${mode}`)',
      "<div className={`app ${dark ? 'dark' : ''}`}>",
      "el.setAttribute('class', 'x dark')",
      "const cls = 'light'; root.className = cls;",
      "el.style.setProperty('--paper', '#000')",
      "<div style={{ '--paper': '#000' }}>",
      ':root { --paper: #000; }',
      '.wrapper { --paper: #000; }',
      'main, body { --hero: red; }',
      '@media (prefers-color-scheme: dark) { body { color: red } }',
      '<meta name="color-scheme" content="dark">',
    ];
    expect(forced.filter((s) => themeViolations(s).length === 0)).toEqual([]);
    const fine = [
      '<div className="app-route">',
      "classList.add('is-open')",
      'color: var(--paper);',
      '.nobody { color: var(--ink); }',
      'const darkMode = useMemo(() => x, []);',
    ];
    expect(fine.filter((s) => themeViolations(s).length > 0)).toEqual([]);
    expect(themeViolations("export const en = { 'admin.x': 'Light reading' };", true)).toEqual([]);
  });

  it('no app source or index.html breaks an invariant', () => {
    const files = [...sources('src'), 'index.html'];
    expect(files.length).toBeGreaterThan(0);
    const broken = files.flatMap((f) => themeViolations(readFileSync(f, 'utf8'), CATALOGS.includes(f)).map((v) => `${f}: ${v}`));
    expect(broken).toEqual([]);
  });
});
