// @trace NFR-9
import { act, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_ROUTES, CHILD_ROUTES, ROUTE_EXAMPLES, type RoutePath } from './route-paths';
import { messages, type Messages } from '@/i18n';
import { cs } from '@/i18n/cs';
import { en } from '@/i18n/en';
import { App } from './App';
import { routes } from './routes';
import { stubAdminBackend, stubChildBackend, stubSignedInAdmin } from '@/test/admin-backend';
import { allSeedStrings as seedStrings } from '@/test/fake-child-backend';

vi.mock('@/features/sources/pdf', () => import('@/test/pdf-mock'));

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

/** Input types whose value is not shown as text (as in the lint rule). */
const NON_TEXT_INPUT_TYPES = ['hidden', 'checkbox', 'radio', 'range', 'color', 'file', 'image'];

/**
 * Visible text nodes, text attributes, visible field values and the document title. Text inside a
 * `[data-content]` element is content the admin entered or the server sent (content-authoring
 * "No hard-coded admin strings": task content excepted); it goes to `content` instead.
 */
function collectTexts(root: HTMLElement): { texts: string[]; content: string[] } {
  const texts: string[] = [];
  const content: string[] = [];
  const add = (el: Element | null | undefined, text: string | undefined) => {
    const value = text?.trim();
    if (value) (el?.closest('[data-content]') ? content : texts).push(value);
  };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest('script,style')) continue;
    add(node.parentElement, node.textContent ?? undefined);
  }
  for (const el of root.querySelectorAll('*')) {
    for (const attr of TEXT_ATTRIBUTES) add(el, el.getAttribute(attr) ?? undefined);
    // A field's value is a DOM property, not a text node: read it from every field that shows it.
    const shown =
      el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !NON_TEXT_INPUT_TYPES.includes(el.type));
    if (shown) add(el, el.value);
  }
  texts.push(document.title.trim());
  return { texts, content };
}

const uiTexts = (root: HTMLElement) => collectTexts(root).texts;

const uncovered = (texts: string[]) => texts.filter((t) => !COVERED.test(t) && !NO_WORDS.test(t));

/**
 * Renders App with the pseudo-catalog and lets effects and pending work settle before reading. Admin
 * routes are opened signed in, with their example query, against the shared fake backend and its
 * seed, so the authoring screens show their real content; child routes get the child contract stub
 * with its practice seed; any other path a backend with no session.
 */
async function renderSettled(path: string) {
  const admin = (ADMIN_ROUTES as readonly string[]).includes(path);
  if (admin) stubSignedInAdmin();
  else if ((CHILD_ROUTES as readonly string[]).includes(path)) stubChildBackend();
  else stubAdminBackend();
  window.history.pushState({}, '', path + (ROUTE_EXAMPLES[path as RoutePath] ?? ''));
  render(<App messages={pseudo} />);
  for (let i = 0; i < 10; i++)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

afterEach(() => {
  window.history.pushState({}, '', '/');
  document.title = '';
  vi.unstubAllGlobals();
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

  it('the coverage check reads the value shown in text fields', () => {
    const { container } = render(
      <form>
        <input readOnly value="Ahoj" />
        <textarea readOnly value="Čau" />
        <input type="checkbox" readOnly value="yes" />
      </form>,
    );
    // React also writes a textarea's value as its text node, so it may be seen twice.
    expect([...new Set(uncovered(uiTexts(container)))].sort()).toEqual(['Ahoj', 'Čau']);
  });

  it.each(routes.map((r) => [r.path] as const))('route %s shows only catalog text, title included', async (path) => {
    await renderSettled(path);
    const { texts, content } = collectTexts(document.body);
    expect(texts.length).toBeGreaterThan(1);
    expect(uncovered(texts)).toEqual([]);
    // Marked content is example data only, so nothing hides behind the marker.
    const data = seedStrings();
    expect(content.filter((t) => !data.has(t) && !NO_WORDS.test(t))).toEqual([]);
  });

  it.each(ADMIN_ROUTES.map((p) => [p] as const))('admin route %s is checked signed in, past loading', async (path) => {
    await renderSettled(path);
    expect(document.body.textContent).not.toContain(pseudo['admin.signIn.title']);
    expect(document.body.textContent).not.toContain(pseudo['admin.common.loading']);
    expect(document.body.textContent).not.toContain(pseudo['admin.session.checking']);
    if (path !== '/admin') expect(document.querySelectorAll('[data-content]').length).toBeGreaterThan(0);
  });

  it.each(CHILD_ROUTES.map((p) => [p] as const))('child route %s is checked with content, past loading', async (path) => {
    await renderSettled(path);
    expect(document.body.textContent).not.toContain(pseudo['child.common.loading']);
    expect(document.body.textContent).not.toContain(pseudo['child.common.loadFailed']);
    expect(document.body.textContent).not.toContain(pseudo['child.mission.notFound']);
    expect(document.body.textContent).not.toContain(pseudo['child.task.notFound']);
    expect(document.querySelectorAll('h1').length).toBe(1);
    if (path === '/task') expect(document.querySelectorAll('[data-content]').length).toBeGreaterThan(0);
  });

  it('the content marker only accepts example data', () => {
    const { container } = render(
      <div>
        <span data-content>Matematika 6 – pracovní sešit</span>
        <span data-content>Ahoj</span>
      </div>,
    );
    const data = seedStrings();
    expect(collectTexts(container).content.filter((t) => !data.has(t))).toEqual(['Ahoj']);
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
