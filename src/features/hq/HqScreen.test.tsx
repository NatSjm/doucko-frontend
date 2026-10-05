// @trace FR-24
// @trace FR-25
// @trace NFR-7
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { messages as m } from '@/i18n';
import { format } from '@/i18n/format';
import { stubChildBackend } from '@/test/admin-backend';
import { CHILD_DISPLAY_NAME, PRACTICE, practise } from '@/test/fake-child-backend';
import { renderAt } from '@/test/render';
import { HqScreen } from './HqScreen';

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, '', '/');
});

const progress = (resolved: number, total: number) => format(m['child.hq.progress'], { resolved, total });
const card = (n: number, topic: string) =>
  within(screen.getByRole('region', { name: format(m['child.hq.topic'], { name: topic }) })).getByRole('link', { name: new RegExp(format(m['child.hq.mission'], { n })) });

describe('HQ (FR-24, FR-25)', () => {
  it('greets the single profile with no login form and no profile choice', async () => {
    stubChildBackend();
    renderAt(<HqScreen />, '/');
    expect(await screen.findByRole('heading', { level: 1, name: format(m['child.hq.greeting'], { name: CHILD_DISPLAY_NAME }) })).toBeInTheDocument();
    expect(screen.getByText(m['child.hq.intro'])).toBeInTheDocument();
    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('groups published missions under their topic, position 1 before position 2, all new and open', async () => {
    stubChildBackend();
    renderAt(<HqScreen />, '/');
    const topics = await screen.findAllByRole('heading', { level: 2 });
    expect(topics.map((h) => h.textContent)).toEqual([
      format(m['child.hq.topic'], { name: 'Desetinná čísla' }),
      format(m['child.hq.topic'], { name: 'Obvod a obsah' }),
    ]);
    const decimals = within(screen.getByRole('region', { name: topics[0].textContent as string })).getAllByRole('link');
    expect(decimals.map((a) => a.getAttribute('href'))).toEqual([`/mission?missionId=${PRACTICE.missionA}`, `/mission?missionId=${PRACTICE.missionB}`]);
    expect(decimals[0]).toHaveTextContent(format(m['child.hq.mission'], { n: 1 }));
    expect(decimals[0]).toHaveTextContent(progress(0, 3));
    expect(decimals[0]).toHaveTextContent(m['child.hq.state.NEW']);
    expect(decimals[1]).toHaveTextContent(progress(0, 2));
  });

  it('lists only published missions: the draft mission of a topic has no card', async () => {
    stubChildBackend();
    renderAt(<HqScreen />, '/');
    const perimeter = await screen.findByRole('region', { name: format(m['child.hq.topic'], { name: 'Obvod a obsah' }) });
    expect(within(perimeter).getAllByRole('link')).toHaveLength(1);
    expect(within(perimeter).getAllByRole('link')[0]).toHaveAttribute('href', `/mission?missionId=${PRACTICE.missionPerimeter}`);
  });

  it('shows new, in progress and complete with their x/N, a wrong attempt alone counting as in progress', async () => {
    const backend = stubChildBackend();
    await practise(backend, PRACTICE.missionA, PRACTICE.taskSum, { a: '0,5' });
    await practise(backend, PRACTICE.missionPerimeter, PRACTICE.taskSquare, { a: '8 cm' });
    renderAt(<HqScreen />, '/');
    await screen.findAllByRole('heading', { level: 2 });
    const a = card(1, 'Desetinná čísla');
    expect(a).toHaveTextContent(progress(0, 3));
    expect(a).toHaveTextContent(m['child.hq.state.IN_PROGRESS']);
    expect(card(2, 'Desetinná čísla')).toHaveTextContent(m['child.hq.state.NEW']);
    const done = card(1, 'Obvod a obsah');
    expect(done).toHaveTextContent(progress(1, 1));
    expect(done).toHaveTextContent(m['child.hq.state.COMPLETE']);
  });

  it('a revealed task counts as resolved', async () => {
    const backend = stubChildBackend();
    await practise(backend, PRACTICE.missionPerimeter, PRACTICE.taskSquare, { a: '6 cm' });
    await practise(backend, PRACTICE.missionPerimeter, PRACTICE.taskSquare, { a: '7 cm' });
    renderAt(<HqScreen />, '/');
    await screen.findAllByRole('heading', { level: 2 });
    expect(card(1, 'Obvod a obsah')).toHaveTextContent(progress(1, 1));
    expect(card(1, 'Obvod a obsah')).toHaveTextContent(m['child.hq.state.COMPLETE']);
  });

  it('hides "Pokračovat" when nothing is in progress (NFR-7)', async () => {
    stubChildBackend();
    renderAt(<HqScreen />, '/');
    await screen.findAllByRole('heading', { level: 2 });
    expect(screen.queryByRole('link', { name: m['child.hq.continue'] })).toBeNull();
  });

  it('"Pokračovat" points at the first unresolved task of the latest mission in progress (NFR-7)', async () => {
    const backend = stubChildBackend();
    await practise(backend, PRACTICE.missionB, PRACTICE.taskThousands, { a: '1250' });
    await practise(backend, PRACTICE.missionA, PRACTICE.taskSum, { a: '0,75' });
    renderAt(<HqScreen />, '/');
    const go = await screen.findByRole('link', { name: m['child.hq.continue'] });
    expect(go).toHaveAttribute('href', `/task?missionId=${PRACTICE.missionA}&taskId=${PRACTICE.taskRound}`);
  });

  it('shows an empty-state message and no error when no mission is published', async () => {
    stubChildBackend({ practice: false });
    renderAt(<HqScreen />, '/');
    expect(await screen.findByText(m['child.hq.empty'])).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0);
  });

  it('says it could not load and retries', async () => {
    const backend = stubChildBackend();
    backend.failWith = 500;
    renderAt(<HqScreen />, '/');
    expect(await screen.findByRole('alert')).toHaveTextContent(m['child.common.loadFailed']);
    backend.failWith = null;
    await userEvent.click(screen.getByRole('button', { name: m['child.common.retry'] }));
    await waitFor(() => expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2));
  });
});
