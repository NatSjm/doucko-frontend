// @trace FR-58
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * FR-58 / gamification "Light and dark theme": the OS decides the theme. The design system owns the
 * tokens and both schemes, so app code (everything outside the vendored design system) gets three
 * invariants instead of a list of known tricks:
 *   1. it never declares or names a CSS custom property to write it: no `--x:` declaration and no
 *      string that starts with `--` (a computed key, a variable holding the name, setProperty);
 *      `var(--x)` is a use, not a write;
 *   2. it never touches the colour scheme (`data-theme`, `dataset.theme`, `colorScheme`,
 *      `color-scheme`, `prefers-color-scheme`);
 *   3. no string literal in it (one line, or a template literal over many) names a scheme (`dark`,
 *      `light`, `theme…`), so no class, attribute or variable can carry one, however it is built.
 * Comments are ignored. The message catalogs are not code and are left out of (3). The e2e
 * activates every control on every screen; this covers screens and states it cannot reach.
 */
const TOKEN_WRITE = /(^|[;{\s])--[\w-]+\s*:|['"`]--/m;
const SCHEME_API = /data-theme|dataset\.theme|colorScheme|color-scheme|prefers-color-scheme/;
const QUOTED_SCHEME = /(['"])(?:(?!\1)[^\n\\]|\\.)*?\b(dark|light|theme\w*)\b(?:(?!\1)[^\n\\]|\\.)*?\1/i;
const TEMPLATE_SCHEME = /`(?:[^`\\]|\\.)*?\b(dark|light|theme\w*)\b(?:[^`\\]|\\.)*?`/i;
const CATALOGS = ['src/i18n/cs.ts', 'src/i18n/en.ts'];
/** Directories app code does not own: the vendored design system and the generated API client. */
const NOT_APP = new Set(['src/design-system', 'src/api/generated']);

/** Source without comments (a backtick or the word "theme" in a comment is not code). */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(^|[^:\\'"`])\/\/.*$/gm, '$1');
}

/** Every invariant `source` breaks; empty when it keeps all three. */
export function themeViolations(source: string, isCatalog = false): string[] {
  const text = withoutComments(source);
  return [
    TOKEN_WRITE.test(text) && 'declares or names a CSS custom property',
    SCHEME_API.test(text) && 'touches the colour scheme',
    !isCatalog && (QUOTED_SCHEME.test(text) || TEMPLATE_SCHEME.test(text)) && 'names a scheme in a string literal',
  ].filter((v): v is string => typeof v === 'string');
}

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name).replaceAll('\\', '/');
    if (statSync(p).isDirectory()) return NOT_APP.has(p) ? [] : sources(p);
    return /\.(m?[jt]sx?|css|html|svg)$/.test(p) && !/\.test\.[jt]sx?$/.test(p) ? [p] : [];
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
      "const token = '--paper'; el.style.setProperty(token, v);",
      "<div style={{ '--paper': '#000' }}>",
      '<div style={{ [`--${name}`]: v }}>',
      ':root { --paper: #000; }',
      '.wrapper { --paper: #000; }',
      'main, body { --hero: red; }',
      '@media (prefers-color-scheme: dark) { body { color: red } }',
      '<meta name="color-scheme" content="dark">',
      'const css = `\n  .x {\n    color: red;\n  }\n  .dark { color: blue; }\n`;',
    ];
    expect(forced.filter((s) => themeViolations(s).length === 0)).toEqual([]);
    const fine = [
      '<div className="app-route">',
      "classList.add('is-open')",
      'color: var(--paper);',
      "<div style={{ color: 'var(--hero)' }}>",
      '.nobody { color: var(--ink); }',
      'const darkMode = useMemo(() => x, []);',
      '/** The `light` theme comes from the OS. */ const a = 1;',
      '// light theme\nconst b = 2;',
    ];
    expect(fine.filter((s) => themeViolations(s).length > 0)).toEqual([]);
    expect(themeViolations("export const en = { 'admin.x': 'Light reading' };", true)).toEqual([]);
  });

  it('only the design system and generated client are skipped, by exact directory', () => {
    expect(NOT_APP.has('src/design-system-extras')).toBe(false);
    expect(NOT_APP.has('src/api/generated2')).toBe(false);
  });

  it('no app source, public file or index.html breaks an invariant', () => {
    const files = [...sources('src'), ...(existsSync('public') ? sources('public') : []), 'index.html'];
    expect(files.length).toBeGreaterThan(0);
    const broken = files.flatMap((f) => themeViolations(readFileSync(f, 'utf8'), CATALOGS.includes(f)).map((v) => `${f}: ${v}`));
    expect(broken).toEqual([]);
  });
});
