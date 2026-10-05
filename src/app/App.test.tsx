// @trace FR-24
// @trace NFR-7
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { messages } from '@/i18n';
import { format } from '@/i18n/format';
import { stubChildBackend } from '@/test/admin-backend';
import { CHILD_DISPLAY_NAME, PRACTICE, PROMPTS, practise } from '@/test/fake-child-backend';
import { App } from './App';
import { routePath } from './route-paths';

afterEach(() => {
  window.history.pushState({}, '', '/');
  document.title = '';
  vi.unstubAllGlobals();
});

describe('App shell', () => {
  it('opens HQ at the root with the product name as the brand (FR-24)', async () => {
    stubChildBackend();
    const { container } = render(<App />);
    expect(container.querySelector('[data-route="/"]')).not.toBeNull();
    expect(screen.getByRole('link', { name: messages['app.name'] })).toHaveAttribute('href', '/');
    expect(await screen.findByRole('heading', { level: 1, name: format(messages['child.hq.greeting'], { name: CHILD_DISPLAY_NAME }) })).toBeInTheDocument();
  });

  it('renders the not-found screen for an unregistered path, not the first route', () => {
    window.history.pushState({}, '', '/no-such-route');
    const { container } = render(<App />);
    expect(messages['app.notFound']).toBeTruthy();
    expect(container.querySelector('[data-route="not-found"]')).not.toBeNull();
    expect(container.querySelector('[data-route="/"]')).toBeNull();
    expect(screen.queryByRole('heading', { level: 1, name: messages['app.name'] })).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: messages['app.notFound'] })).toBeInTheDocument();
  });

  it('sets the document title from the catalog', () => {
    stubChildBackend();
    render(<App />);
    expect(document.title).toBe(messages['app.name']);
  });
});

describe('two clicks from HQ to a task (NFR-7)', () => {
  it('a new mission: its card, then the start button, opens its first task without a page load', async () => {
    stubChildBackend();
    const { container } = render(<App />);
    await userEvent.click(await screen.findByRole('link', { name: new RegExp(format(messages['child.hq.mission'], { n: 2 })) }));
    expect(container.querySelector('[data-route="/mission"]')).not.toBeNull();
    expect(await screen.findByRole('heading', { level: 1, name: format(messages['child.hq.mission'], { n: 2 }) })).toHaveFocus();
    await userEvent.click(screen.getByRole('link', { name: messages['child.mission.start'] }));
    expect(container.querySelector('[data-route="/task"]')).not.toBeNull();
    expect(await screen.findByText(PROMPTS.thousands)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'a' })).toHaveFocus();
  });

  it('"Pokračovat" opens the task to continue with one click, and back to HQ with one more', async () => {
    const backend = stubChildBackend();
    await practise(backend, PRACTICE.missionA, PRACTICE.taskSum, { a: '0,75' });
    render(<App />);
    await userEvent.click(await screen.findByRole('link', { name: messages['child.hq.continue'] }));
    expect(await screen.findByText(PROMPTS.round)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: messages['child.common.backToHq'] }));
    expect(await screen.findByRole('link', { name: messages['child.hq.continue'] })).toBeInTheDocument();
  });

  it('"Další úloha" opens the next unresolved task of the mission', async () => {
    stubChildBackend();
    window.history.pushState({}, '', `/task?missionId=${PRACTICE.missionA}&taskId=${PRACTICE.taskSum}`);
    render(<App />);
    await screen.findByText(PROMPTS.sum);
    await userEvent.keyboard('0,75{Enter}');
    await userEvent.click(await screen.findByRole('link', { name: messages['child.task.next'] }));
    expect(await screen.findByText(PROMPTS.round)).toBeInTheDocument();
    expect(window.location.search).toBe(`?missionId=${PRACTICE.missionA}&taskId=${PRACTICE.taskRound}`);
  });
});

describe('a task opened twice is read afresh', () => {
  it('"Další úloha" after a task opened by mission only shows the next task, not the cached one', async () => {
    stubChildBackend();
    window.history.pushState({}, '', `/task?missionId=${PRACTICE.missionA}`);
    render(<App />);
    await screen.findByText(PROMPTS.sum);
    await userEvent.keyboard('0,75{Enter}');
    await userEvent.click(await screen.findByRole('link', { name: messages['child.task.next'] }));
    expect(await screen.findByText(PROMPTS.round)).toBeInTheDocument();
    expect(screen.queryByText(PROMPTS.sum)).toBeNull();
  });
});

describe('routePath', () => {
  it.each([
    ['/', '/'],
    ['/index.html', '/'],
    ['//', '/'],
    ['/admin/', '/admin'],
    ['/admin//', '/admin'],
    ['/admin/index.html', '/admin'],
    ['/no-such-route', '/no-such-route'],
  ])('%s resolves as %s', (input, expected) => {
    expect(routePath(input)).toBe(expected);
  });
});
