// @trace FR-58
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * FR-58 / gamification "Light and dark theme": the OS decides the theme. No app source outside the
 * vendored design system sets `data-theme` or a colour scheme, so no control added later can switch
 * it. (The e2e activates every control on every screen; this covers screens and states it cannot reach.)
 */
/**
 * data-theme, a colour-scheme declaration or meta, a theme class set through classList or className
 * (literal or built), a `prefers-color-scheme` override, or a design token rewritten at runtime.
 */
const THEME_WRITE = new RegExp(
  [
    'data-theme',
    'dataset\\.theme',
    'colorScheme',
    'color-scheme',
    'prefers-color-scheme',
    // classList.add('dark'), classList.toggle(`theme-${x}`), className = 'dark', className={`… theme-${x}`}
    'classList\\.\\w+\\([^)]*\\b(dark|light|theme)',
    'className\\s*=\\s*[{"\'`][^\\n]*\\b(dark|light|theme)\\b',
    // style.setProperty('--paper', …) or a :root/html rule redefining a token
    'setProperty\\(\\s*[\'"`]--',
    '(:root|html)\\s*\\{[^}]*--[\\w-]+\\s*:',
  ].join('|'),
);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name).replaceAll('\\', '/');
    if (statSync(p).isDirectory()) return p.startsWith('src/design-system') || p.startsWith('src/api/generated') ? [] : sources(p);
    return /\.(tsx?|css)$/.test(p) && !/\.test\.tsx?$/.test(p) ? [p] : [];
  });
}

describe('theme follows the OS (FR-58)', () => {
  it('the guard recognises the ways a theme can be forced', () => {
    const forced = [
      "document.documentElement.dataset.theme = 'dark'",
      "root.classList.toggle(`theme-${mode}`)",
      "<div className={`app ${dark ? 'dark' : ''}`}>",
      "el.style.setProperty('--paper', '#000')",
      ':root { --paper: #000; }',
      '@media (prefers-color-scheme: dark) { body { color: red } }',
      '<meta name="color-scheme" content="dark">',
    ];
    expect(forced.filter((s) => !THEME_WRITE.test(s))).toEqual([]);
    expect(['<div className="app-route">', "classList.add('is-open')", 'color: var(--paper);'].filter((s) => THEME_WRITE.test(s))).toEqual([]);
  });

  it('no app source sets data-theme or a colour scheme', () => {
    const files = [...sources('src'), 'index.html'];
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((f) => THEME_WRITE.test(readFileSync(f, 'utf8')))).toEqual([]);
  });
});
