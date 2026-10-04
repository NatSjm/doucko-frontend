// @trace NFR-9
import { act, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { messages, type Messages } from '@/i18n';
import { cs } from '@/i18n/cs';
import { en } from '@/i18n/en';
import { App } from './App';
import { routes } from './routes';

/**
 * Every catalog value wrapped in ⟦…⟧. A text is covered only if it consists of whole wrapped
 * segments (plus whitespace, digits and punctuation between them), so a literal concatenated to
 * catalog text (`t('a') + ' bodů'`) is caught as well as a bare literal.
 */
const pseudo = Object.fromEntries(Object.entries(messages).map(([k, v]) => [k, `⟦${v}⟧`])) as Messages;
const COVERED = /^(?:[\s\d\p{P}\p{S}]*⟦[^⟦⟧]*⟧)+[\s\d\p{P}\p{S}]*$/u;
/** Separators and numbers carry no words; the lint rule allows them too. */
const NO_WORDS = /^[\s\d\p{P}\p{S}]*$/u;
const TEXT_ATTRIBUTES = [
  'aria-label',
  'aria-description',
  'aria-roledescription',
  'aria-valuetext',
  'aria-placeholder',
  'aria-braillelabel',
  'title',
  'alt',
  'placeholder',
  'label',
];

/** Visible text nodes, text attributes, visible input values and the document title. */
function uiTexts(root: HTMLElement): string[] {
  const texts: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest('script,style')) continue;
    const text = node.textContent?.trim();
    if (text) texts.push(text);
  }
  for (const el of root.querySelectorAll('*')) {
    for (const attr of TEXT_ATTRIBUTES) {
      const value = el.getAttribute(attr)?.trim();
      if (value) texts.push(value);
    }
    if (el instanceof HTMLInputElement && ['submit', 'button', 'reset'].includes(el.type) && el.value.trim()) texts.push(el.value.trim());
  }
  texts.push(document.title.trim());
  return texts;
}

const uncovered = (texts: string[]) => texts.filter((t) => !COVERED.test(t) && !NO_WORDS.test(t));

/** Renders App with the pseudo-catalog and lets effects and pending work settle before reading. */
async function renderSettled(path: string) {
  window.history.pushState({}, '', path);
  render(<App messages={pseudo} />);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

afterEach(() => {
  window.history.pushState({}, '', '/');
  document.title = '';
});

describe('externalized UI strings (NFR-9)', () => {
  it('the route registry is not empty', () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it('the coverage check catches literal text concatenated to catalog text', () => {
    expect(uncovered(['⟦Doučko⟧', '⟦a⟧ · ⟦b⟧', '3 × ⟦úloha⟧', '⟦Úroveň⟧ 3.'])).toEqual([]);
    expect(uncovered(['⟦Doučko⟧ navíc', 'Ahoj', '⟦a⟧ – Ahoj', '⟦a'])).toEqual(['⟦Doučko⟧ navíc', 'Ahoj', '⟦a⟧ – Ahoj', '⟦a']);
    expect(uncovered([' · ', '3', '12 / 20', '—'])).toEqual([]);
  });

  it.each(routes.map((r) => [r.path] as const))('route %s shows only catalog text, title included', async (path) => {
    await renderSettled(path);
    const texts = uiTexts(document.body);
    expect(texts.length).toBeGreaterThan(1);
    expect(uncovered(texts)).toEqual([]);
  });

  it('the not-found screen shows only catalog text', async () => {
    await renderSettled('/no-such-route');
    expect(uncovered(uiTexts(document.body))).toEqual([]);
  });

  it('child (cs) and admin (en) catalogs share no key and keep their namespaces', () => {
    const csKeys = Object.keys(cs);
    const enKeys = Object.keys(en);
    expect(csKeys.filter((k) => enKeys.includes(k))).toEqual([]);
    expect(csKeys.filter((k) => !/^(app|child)\./.test(k))).toEqual([]);
    expect(enKeys.filter((k) => !k.startsWith('admin.'))).toEqual([]);
  });

  it("index.html's pre-load title is the catalog's app name", () => {
    expect(readFileSync('index.html', 'utf8')).toContain(`<title>${messages['app.name']}</title>`);
  });
});
