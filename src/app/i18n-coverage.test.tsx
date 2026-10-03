// @trace NFR-9
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { I18nProvider, messages, type Messages } from '@/i18n';
import { routes } from './routes';

/** Every catalog value prefixed with ⟦, so any string that bypasses the catalog shows up unprefixed. */
const pseudo = Object.fromEntries(Object.entries(messages).map(([k, v]) => [k, `⟦${v}`])) as Messages;

function visibleTexts(root: HTMLElement): string[] {
  const texts: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim();
    if (text) texts.push(text);
  }
  for (const el of root.querySelectorAll('[aria-label],[title],[alt],[placeholder]')) {
    for (const attr of ['aria-label', 'title', 'alt', 'placeholder']) {
      const value = el.getAttribute(attr)?.trim();
      if (value) texts.push(value);
    }
  }
  return texts;
}

describe('externalized UI strings (NFR-9)', () => {
  it('the route registry is not empty', () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it.each(routes.map((r) => [r.path, r] as const))('route %s shows only catalog text', (_path, route) => {
    const { container } = render(<I18nProvider messages={pseudo}>{route.element}</I18nProvider>);
    const texts = visibleTexts(container);
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.filter((t) => !t.startsWith('⟦'))).toEqual([]);
  });
});
