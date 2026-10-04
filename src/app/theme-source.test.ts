// @trace FR-58
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
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
/**
 * A scheme word as a word or as a part of an identifier-like name: `dark`, `is-dark`, `mode_dark`,
 * `darkMode`, `isDark`, `lightTheme`, `THEME`. Not inside another word (`highlight`, `darken`).
 */
const SCHEME = [
  // theme, themes, themed, theme-x, themeMode, isTheme: any word or name part starting with theme
  String.raw`(?<![A-Za-z])(?:theme|Theme|THEME)`,
  String.raw`(?<=[a-z0-9])Theme`,
  // dark/light alone or run together in lowercase with a flag-style prefix and a scheme suffix,
  // plural included (isdark, appdark, darkmode, lightthemes). A free prefix would also match words
  // that only end in "light" (highlight, flight), so the prefixes are the usual flag and owner words.
  String.raw`(?<![A-Za-z])(?:is|has|use|set|get|no|app|ui|my|to|on)?(?:dark|light|Dark|Light|DARK|LIGHT)(?:mode|theme|scheme|ui|bg)?s?(?![a-z])`,
  String.raw`(?<=[a-z0-9])(?:Dark|Light)(?![a-z])`,
]
  .map((alt) => `(?:${alt})`)
  .join('|')
  .replace(/^(.*)$/, '(?:$1)');
const QUOTED_SCHEME = new RegExp(String.raw`(['"])(?:(?!\1)[^\n\\]|\\.)*?${SCHEME}(?:(?!\1)[^\n\\]|\\.)*?\1`);
const TEMPLATE_SCHEME = new RegExp(String.raw`${'`'}(?:[^${'`'}\\]|\\.)*?${SCHEME}(?:[^${'`'}\\]|\\.)*?${'`'}`);
const CATALOGS = ['src/i18n/cs.ts', 'src/i18n/en.ts'];
/** Directories app code does not own: the vendored design system and the generated API client. */
const NOT_APP = new Set(['src/design-system', 'src/api/generated']);

/**
 * Source without comments (a backtick or the word "theme" in a comment is not code). Script files go
 * through the TypeScript printer, which knows that `/*` or `//` inside a string is text; CSS, HTML and
 * SVG (no such strings in practice) through patterns.
 */
function withoutComments(source: string, file = 'snippet.css'): string {
  if (/\.m?[jt]sx?$/.test(file)) {
    const kind = /x$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false, kind);
    return ts.createPrinter({ removeComments: true }).printFile(sf);
  }
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(^|[^:\\'"`])\/\/.*$/gm, '$1');
}

/** Every invariant `source` (of `file`, which picks the comment syntax) breaks; empty when it keeps all three. */
export function themeViolations(source: string, isCatalog = false, file?: string): string[] {
  const text = withoutComments(source, file);
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
    // Script cases go through the TypeScript-printer path real .tsx files take; style and markup
    // cases through the pattern path real .css/.html files take.
    const forcedScript = [
      "document.documentElement.dataset.theme = 'dark';",
      'root.classList.toggle(`theme-${mode}`);',
      "const a = <div className={`app ${dark ? 'dark' : ''}`} />;",
      "el.setAttribute('class', 'x dark');",
      "const cls = 'light'; root.className = cls;",
      "el.style.setProperty('--paper', '#000');",
      "const token = '--paper'; el.style.setProperty(token, v);",
      "const a = <div style={{ '--paper': '#000' }} />;",
      'const a = <div style={{ [`--${name}`]: v }} />;',
      'const css = `\n  .x {\n    color: red;\n  }\n  .dark { color: blue; }\n`;',
    ];
    const forcedStyle = [
      ':root { --paper: #000; }',
      '.wrapper { --paper: #000; }',
      'main, body { --hero: red; }',
      '@media (prefers-color-scheme: dark) { body { color: red } }',
      '<meta name="color-scheme" content="dark">',
    ];
    expect(forcedScript.filter((s) => themeViolations(s, false, 'a.tsx').length === 0)).toEqual([]);
    expect(forcedStyle.filter((s) => themeViolations(s, false, 'a.css').length === 0)).toEqual([]);
    const fineScript = [
      'const a = <div className="app-route" />;',
      "classList.add('is-open');",
      "const a = <div style={{ color: 'var(--hero)' }} />;",
      'const darkMode = useMemo(() => x, []);',
      '/** The `light` theme comes from the OS. */ const a = 1;',
      '// light theme\nconst b = 2;',
    ];
    const fineStyle = ['.x { color: var(--paper); }', '.nobody { color: var(--ink); }', '/* the light theme */ .y { margin: 0; }'];
    expect(fineScript.filter((s) => themeViolations(s, false, 'a.tsx').length > 0)).toEqual([]);
    expect(fineStyle.filter((s) => themeViolations(s, false, 'a.css').length > 0)).toEqual([]);
    expect(themeViolations("export const en = { 'admin.x': 'Light reading' };", true)).toEqual([]);
    // camelCase and underscored scheme names are scheme names; words that only contain one are not
    const named = [
      "root.className = 'darkMode'",
      "cls('isLight')",
      "el.classList.add('mode_dark')",
      "const a = <div className=\"app lightTheme\" />;",
      "cls('darkmode')",
      "cls('lighttheme')",
      "cls('themed')",
      "cls('themes-x')",
      "cls('isdark')",
      "cls('appdark')",
      "cls('nodark')",
      "cls('darkmodes')",
      "cls('lightthemes')",
    ];
    expect(named.filter((s) => themeViolations(s, false, 'a.tsx').length === 0)).toEqual([]);
    expect(["<mark className=\"highlight\">", "const c = 'darken-on-hover';", "cls('flight spotlight delight')", "cls('nolightbox')"].filter((s) => themeViolations(s, false, 'a.tsx').length > 0)).toEqual([]);
    // '/*' or '//' inside a string is not a comment: the code after it is still checked
    const slashStar = ['const a = <input accept="image/*" />;', "const b = 'dark';", "const c = '*/';"].join('\n');
    expect(themeViolations(slashStar, false, 'a.tsx')).toEqual([
      'names a scheme in a string literal',
    ]);
    expect(themeViolations("const u = 'https://x.cz'; const d = 'dark';", false, 'a.ts')).toEqual(['names a scheme in a string literal']);
  });

  it('only the design system and generated client are skipped, by exact directory', () => {
    expect(NOT_APP.has('src/design-system-extras')).toBe(false);
    expect(NOT_APP.has('src/api/generated2')).toBe(false);
  });

  it('no app source, public file or index.html breaks an invariant', () => {
    const files = [...sources('src'), ...(existsSync('public') ? sources('public') : []), 'index.html'];
    expect(files.length).toBeGreaterThan(0);
    const broken = files.flatMap((f) => themeViolations(readFileSync(f, 'utf8'), CATALOGS.includes(f), f).map((v) => `${f}: ${v}`));
    expect(broken).toEqual([]);
  });
});
