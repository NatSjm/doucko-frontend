// @trace FR-25
// @trace NFR-7
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { messages as m } from '@/i18n';
import { format } from '@/i18n/format';
import { stubChildBackend } from '@/test/admin-backend';
import { PRACTICE, practise } from '@/test/fake-child-backend';
import { renderAt } from '@/test/render';
import { MissionScreen } from './MissionScreen';

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, '', '/');
});

const at = (missionId: string) => `/mission?missionId=${missionId}`;

describe('mission briefing (FR-25, NFR-7)', () => {
  it('shows topic, number, progress and the tasks, and starts a new mission at its first task', async () => {
    stubChildBackend();
    renderAt(<MissionScreen />, at(PRACTICE.missionA));
    expect(await screen.findByRole('heading', { level: 1, name: format(m['child.hq.mission'], { n: 1 }) })).toBeInTheDocument();
    expect(screen.getByText(format(m['child.hq.topic'], { name: 'Desetinná čísla' }))).toBeInTheDocument();
    expect(screen.getByText(format(m['child.hq.progress'], { resolved: 0, total: 3 }))).toBeInTheDocument();
    const tasks = within(screen.getByRole('list', { name: m['child.mission.tasks'] })).getAllByRole('listitem');
    expect(tasks).toHaveLength(3);
    expect(tasks[0]).toHaveTextContent(format(m['child.mission.task'], { n: 1 }));
    expect(tasks[0]).toHaveTextContent(m['child.mission.taskState.UNRESOLVED']);
    expect(screen.getByRole('link', { name: m['child.mission.start'] })).toHaveAttribute('href', `/task?missionId=${PRACTICE.missionA}`);
  });

  it('offers to continue a mission in progress and shows each task state', async () => {
    const backend = stubChildBackend();
    await practise(backend, PRACTICE.missionA, PRACTICE.taskSum, { a: '0,75' });
    await practise(backend, PRACTICE.missionA, PRACTICE.taskRound, { a: '3,5', b: '7,1' });
    await practise(backend, PRACTICE.missionA, PRACTICE.taskRound, { b: '7,2' });
    renderAt(<MissionScreen />, at(PRACTICE.missionA));
    expect(await screen.findByRole('link', { name: m['child.mission.continue'] })).toHaveAttribute('href', `/task?missionId=${PRACTICE.missionA}`);
    const tasks = within(screen.getByRole('list', { name: m['child.mission.tasks'] })).getAllByRole('listitem');
    expect(tasks[0]).toHaveTextContent(m['child.mission.taskState.CORRECT_FIRST_TRY']);
    expect(tasks[1]).toHaveTextContent(m['child.mission.taskState.REVEALED']);
    expect(screen.getByText(format(m['child.hq.progress'], { resolved: 2, total: 3 }))).toBeInTheDocument();
  });

  it('says a complete mission is done and offers no start (replay is slice 8)', async () => {
    const backend = stubChildBackend();
    await practise(backend, PRACTICE.missionPerimeter, PRACTICE.taskSquare, { a: '8 cm' });
    renderAt(<MissionScreen />, at(PRACTICE.missionPerimeter));
    expect(await screen.findByText(m['child.mission.complete'])).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: m['child.mission.start'] })).toBeNull();
    expect(screen.getByRole('listitem')).toHaveTextContent(m['child.mission.taskState.CORRECT_FIRST_TRY']);
  });

  it.each([
    ['a draft mission', PRACTICE.missionDraft],
    ['an unknown mission', 'ffffffff-ffff-4fff-8fff-0000000009ff'],
  ])('answers %s with "Tuhle misi jsem nenašel." and a way back to HQ', async (_, missionId) => {
    stubChildBackend();
    renderAt(<MissionScreen />, at(missionId));
    expect(await screen.findByText(m['child.mission.notFound'])).toBeInTheDocument();
    expect(screen.getByRole('link', { name: m['child.common.backToHq'] })).toHaveAttribute('href', '/');
  });

  it('without a mission id it is the same dead end', async () => {
    stubChildBackend();
    renderAt(<MissionScreen />, '/mission');
    expect(await screen.findByText(m['child.mission.notFound'])).toBeInTheDocument();
  });

  it('says it could not load and retries', async () => {
    const backend = stubChildBackend();
    backend.failWith = 503;
    renderAt(<MissionScreen />, at(PRACTICE.missionA));
    expect(await screen.findByText(m['child.common.loadFailed'])).toBeInTheDocument();
    backend.failWith = null;
    await userEvent.click(screen.getByRole('button', { name: m['child.common.retry'] }));
    expect(await screen.findByRole('link', { name: m['child.mission.start'] })).toBeInTheDocument();
  });
});
