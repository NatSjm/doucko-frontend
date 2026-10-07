// @trace FR-25
// @trace NFR-7
// @trace FR-33
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { messages as m } from '@/i18n';
import { format } from '@/i18n/format';
import { stubChildBackend } from '@/test/admin-backend';
import { childRequest, completeMission, PRACTICE, practise } from '@/test/fake-child-backend';
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

  it('says a complete mission is done and offers its replay and results instead of a start (FR-33)', async () => {
    const backend = stubChildBackend();
    await practise(backend, PRACTICE.missionPerimeter, PRACTICE.taskSquare, { a: '8 cm' });
    renderAt(<MissionScreen />, at(PRACTICE.missionPerimeter));
    expect(await screen.findByText(m['child.mission.complete'])).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: m['child.mission.start'] })).toBeNull();
    expect(screen.getByRole('button', { name: m['child.mission.replay'] })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: m['child.mission.results'] })).toHaveAttribute('href', `/summary?missionId=${PRACTICE.missionPerimeter}`);
    expect(screen.getByRole('listitem')).toHaveTextContent(m['child.mission.taskState.CORRECT_FIRST_TRY']);
  });

  it.each([
    ['a draft mission', PRACTICE.missionDraft],
    ['an unknown mission', 'ffffffff-ffff-4fff-8fff-0000000009ff'],
    ['a mission id that is not a UUID (400)', 'not-a-uuid'],
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

describe('XP and replay on the briefing (FR-33)', () => {
  const here = () => window.location.pathname + window.location.search;

  it('shows the XP the mission can still earn', async () => {
    stubChildBackend();
    renderAt(<MissionScreen />, at(PRACTICE.missionA));
    // 3 unresolved tasks at 10 XP plus the 20 XP completion bonus, as the server counts it.
    expect(await screen.findByText(format(m['child.mission.xpAvailable'], { xp: 50 }))).toBeInTheDocument();
  });

  it('a complete mission names no XP to earn', async () => {
    const backend = stubChildBackend();
    await completeMission(backend, PRACTICE.missionPerimeter);
    renderAt(<MissionScreen />, at(PRACTICE.missionPerimeter));
    await screen.findByText(m['child.mission.complete']);
    expect(screen.queryByText(/XP/)).toBeNull();
  });

  it('"Zopakovat misi" starts a fresh run at task 1 with no attempt used', async () => {
    const backend = stubChildBackend();
    await completeMission(backend, PRACTICE.missionB);
    renderAt(<MissionScreen />, at(PRACTICE.missionB));
    await userEvent.click(await screen.findByRole('button', { name: m['child.mission.replay'] }));
    await waitFor(() => expect(here()).toBe(`/task?missionId=${PRACTICE.missionB}&taskId=${PRACTICE.taskThousands}`));
    const task = await (await childRequest(backend, 'GET', `/api/child/missions/${PRACTICE.missionB}/tasks/${PRACTICE.taskThousands}`)).json();
    expect(task).toMatchObject({ attemptsUsed: 0, state: 'UNRESOLVED' });
  });

  it('"Zopakovat misi" resumes an unfinished replay at its first unresolved task', async () => {
    const backend = stubChildBackend();
    await completeMission(backend, PRACTICE.missionB);
    await childRequest(backend, 'POST', `/api/child/missions/${PRACTICE.missionB}/replay`);
    await practise(backend, PRACTICE.missionB, PRACTICE.taskThousands, { a: '1250' });
    renderAt(<MissionScreen />, at(PRACTICE.missionB));
    await userEvent.click(await screen.findByRole('button', { name: m['child.mission.replay'] }));
    await waitFor(() => expect(here()).toBe(`/task?missionId=${PRACTICE.missionB}&taskId=${PRACTICE.taskMulti}`));
  });

  it('a replay that could not start says so and stays on the briefing', async () => {
    const backend = stubChildBackend();
    await completeMission(backend, PRACTICE.missionB);
    renderAt(<MissionScreen />, at(PRACTICE.missionB));
    const button = await screen.findByRole('button', { name: m['child.mission.replay'] });
    backend.down = true;
    await userEvent.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent(m['child.mission.replayFailed']);
    expect(window.location.pathname).toBe('/mission');
  });

  it('a 409 (the mission is no longer complete) re-reads the briefing', async () => {
    const backend = stubChildBackend();
    await completeMission(backend, PRACTICE.missionB);
    renderAt(<MissionScreen />, at(PRACTICE.missionB));
    const button = await screen.findByRole('button', { name: m['child.mission.replay'] });
    backend.override = { match: (method, path) => method === 'POST' && path.endsWith('/replay'), status: 409, body: {} };
    await userEvent.click(button);
    await waitFor(() => expect(backend.seen.filter((r) => r.method === 'GET' && r.path === `/api/child/missions/${PRACTICE.missionB}`)).toHaveLength(2));
    expect(window.location.pathname).toBe('/mission');
  });
});
