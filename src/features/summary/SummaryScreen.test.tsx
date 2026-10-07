// @trace FR-32
// @trace FR-33
// @trace FR-36
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { messages as m } from '@/i18n';
import { format } from '@/i18n/format';
import { stubChildBackend, type StubbedBackend } from '@/test/admin-backend';
import { childRequest, completeMission, PLACEHOLDER_LADDER, PRACTICE, practise } from '@/test/fake-child-backend';
import { renderAt } from '@/test/render';
import { SummaryScreen } from './SummaryScreen';

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, '', '/');
});

const at = (missionId: string) => `/summary?missionId=${missionId}`;
const rank2 = PLACEHOLDER_LADDER[1].name;
const acks = (seen: { path: string; body: string }[]) => seen.filter((r) => r.path === '/api/child/hq/rank-up-ack').map((r) => JSON.parse(r.body));

/** Mission A: task 1 right first time (10), task 2 right on the 2nd attempt (5), task 3 revealed (1); bonus 20. */
async function finishMissionA(backend: StubbedBackend) {
  await practise(backend, PRACTICE.missionA, PRACTICE.taskSum, { a: '0,75' });
  await practise(backend, PRACTICE.missionA, PRACTICE.taskRound, { a: '3,5', b: '8' });
  await practise(backend, PRACTICE.missionA, PRACTICE.taskRound, { b: '7' });
  await practise(backend, PRACTICE.missionA, PRACTICE.taskLargest, { a: ['B'] });
  await practise(backend, PRACTICE.missionA, PRACTICE.taskLargest, { a: ['C'] });
}

describe('mission-complete screen (FR-32)', () => {
  it('shows "Mise je splněná!", the XP earned in the run and the first-try count', async () => {
    const backend = stubChildBackend();
    await finishMissionA(backend);
    renderAt(<SummaryScreen />, at(PRACTICE.missionA));
    expect(await screen.findByRole('heading', { level: 1, name: m['child.summary.title'] })).toBeInTheDocument();
    expect(screen.getByText(format(m['child.summary.xp'], { xp: 36 }))).toBeInTheDocument();
    expect(screen.getByText(format(m['child.summary.xpText'], { xp: 36 }))).toBeInTheDocument();
    expect(screen.getByText(format(m['child.summary.firstTry'], { n: 1 }))).toBeInTheDocument();
    expect(screen.getByText(format(m['child.summary.taskCount'], { n: 3 }))).toBeInTheDocument();
    expect(screen.queryByText(m['child.rankUp.kicker'])).toBeNull();
    expect(screen.getByRole('link', { name: m['child.common.backToHq'] })).toHaveAttribute('href', '/');
  });

  it('a mission completed through a revealed last task still has its summary', async () => {
    const backend = stubChildBackend();
    await practise(backend, PRACTICE.missionPerimeter, PRACTICE.taskSquare, { a: '6 cm' });
    await practise(backend, PRACTICE.missionPerimeter, PRACTICE.taskSquare, { a: '7 cm' });
    renderAt(<SummaryScreen />, at(PRACTICE.missionPerimeter));
    expect(await screen.findByText(format(m['child.summary.xp'], { xp: 21 }))).toBeInTheDocument();
    expect(screen.getByText(format(m['child.summary.firstTry'], { n: 0 }))).toBeInTheDocument();
  });

  it('shows no timer, streak or ranking against anyone and no negative XP (FR-38)', async () => {
    const backend = stubChildBackend();
    await finishMissionA(backend);
    renderAt(<SummaryScreen />, at(PRACTICE.missionA));
    await screen.findByRole('heading', { level: 1 });
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/[-−]\s*\d+\s*XP/);
    expect(text).not.toMatch(/\d+:\d\d|série|žebříč|pořadí/i);
  });

  it('a mission without a completed run says so, with a way back to HQ', async () => {
    stubChildBackend();
    renderAt(<SummaryScreen />, at(PRACTICE.missionA));
    expect(await screen.findByText(m['child.summary.notComplete'])).toBeInTheDocument();
    expect(screen.getByRole('link', { name: m['child.common.backToHq'] })).toHaveAttribute('href', '/');
  });

  it.each([
    ['a draft mission', at(PRACTICE.missionDraft)],
    ['an id that is not a UUID (400)', at('abc')],
    ['a missing mission id', '/summary'],
  ])('answers %s with "Tuhle misi jsem nenašel."', async (_, path) => {
    stubChildBackend();
    renderAt(<SummaryScreen />, path);
    expect(await screen.findByText(m['child.mission.notFound'])).toBeInTheDocument();
  });

  it('says it could not load and retries', async () => {
    const backend = stubChildBackend();
    await completeMission(backend, PRACTICE.missionPerimeter);
    backend.failWith = 500;
    renderAt(<SummaryScreen />, at(PRACTICE.missionPerimeter));
    expect(await screen.findByRole('alert')).toHaveTextContent(m['child.common.loadFailed']);
    backend.failWith = null;
    await userEvent.click(screen.getByRole('button', { name: m['child.common.retry'] }));
    expect(await screen.findByText(format(m['child.summary.xp'], { xp: 30 }))).toBeInTheDocument();
  });
});

describe('rank-up on the mission-complete screen (FR-36)', () => {
  it('plays the celebration when the completing award crossed a threshold, and acknowledges it', async () => {
    const backend = stubChildBackend();
    backend.practice.totalXp = 140;
    await completeMission(backend, PRACTICE.missionPerimeter);
    renderAt(<SummaryScreen />, at(PRACTICE.missionPerimeter));
    const kicker = await screen.findByText(m['child.rankUp.kicker']);
    expect(kicker.closest('[role="status"]')).toHaveTextContent(format(m['child.rankUp.text'], { rank: rank2 }));
    await act(async () => {});
    expect(acks(backend.seen)).toEqual([{ rankIndex: 1 }]);
  });

  it('a second visit lists the rank as a static line, without the celebration', async () => {
    const backend = stubChildBackend();
    backend.practice.totalXp = 140;
    await completeMission(backend, PRACTICE.missionPerimeter);
    const first = renderAt(<SummaryScreen />, at(PRACTICE.missionPerimeter));
    await screen.findByText(m['child.rankUp.kicker']);
    await act(async () => {});
    first.unmount();
    renderAt(<SummaryScreen />, at(PRACTICE.missionPerimeter));
    expect(await screen.findByText(format(m['child.summary.rankReached'], { rank: rank2 }))).toBeInTheDocument();
    expect(screen.queryByText(m['child.rankUp.kicker'])).toBeNull();
  });

  it('a rank-up earlier in the mission is a static line, never a second celebration', async () => {
    const backend = stubChildBackend();
    backend.practice.totalXp = 145;
    // Task 1 crosses 150 mid-mission; its celebration played on the task screen.
    await completeMission(backend, PRACTICE.missionA);
    renderAt(<SummaryScreen />, at(PRACTICE.missionA));
    expect(await screen.findByText(format(m['child.summary.rankReached'], { rank: rank2 }))).toBeInTheDocument();
    expect(screen.queryByText(m['child.rankUp.kicker'])).toBeNull();
    await act(async () => {});
    expect(acks(backend.seen)).toEqual([]);
  });

  it('a rank-up already celebrated on HQ is a static line here', async () => {
    const backend = stubChildBackend();
    backend.practice.totalXp = 140;
    await completeMission(backend, PRACTICE.missionPerimeter);
    await childRequest(backend, 'POST', '/api/child/hq/rank-up-ack', { rankIndex: 1 });
    renderAt(<SummaryScreen />, at(PRACTICE.missionPerimeter));
    expect(await screen.findByText(format(m['child.summary.rankReached'], { rank: rank2 }))).toBeInTheDocument();
    expect(screen.queryByText(m['child.rankUp.kicker'])).toBeNull();
  });

  it('no rank-up: neither a celebration nor a rank line', async () => {
    const backend = stubChildBackend();
    await completeMission(backend, PRACTICE.missionPerimeter);
    renderAt(<SummaryScreen />, at(PRACTICE.missionPerimeter));
    await screen.findByText(format(m['child.summary.xp'], { xp: 30 }));
    expect(screen.queryByText(m['child.rankUp.kicker'])).toBeNull();
    expect(screen.queryByText(new RegExp(format(m['child.summary.rankReached'], { rank: '' })))).toBeNull();
  });
});

describe('replay from the mission-complete screen (FR-33)', () => {
  it('"Zopakovat misi" starts a replay and opens its first task', async () => {
    const backend = stubChildBackend();
    await completeMission(backend, PRACTICE.missionB);
    renderAt(<SummaryScreen />, at(PRACTICE.missionB));
    await userEvent.click(await screen.findByRole('button', { name: m['child.mission.replay'] }));
    await waitFor(() => expect(window.location.pathname + window.location.search).toBe(`/task?missionId=${PRACTICE.missionB}&taskId=${PRACTICE.taskThousands}`));
    expect(backend.practice.runs.get(PRACTICE.missionB)?.replay).toBe(true);
  });

  it('a replay that could not start says so and stays', async () => {
    const backend = stubChildBackend();
    await completeMission(backend, PRACTICE.missionB);
    renderAt(<SummaryScreen />, at(PRACTICE.missionB));
    const button = await screen.findByRole('button', { name: m['child.mission.replay'] });
    backend.down = true;
    await userEvent.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent(m['child.mission.replayFailed']);
    expect(window.location.pathname).toBe('/summary');
  });

  it('a finished replay shows 0 XP earned and says why; the total XP is unchanged', async () => {
    const backend = stubChildBackend();
    await completeMission(backend, PRACTICE.missionB);
    const total = backend.practice.totalXp;
    await childRequest(backend, 'POST', `/api/child/missions/${PRACTICE.missionB}/replay`);
    await completeMission(backend, PRACTICE.missionB);
    expect(backend.practice.totalXp).toBe(total);
    renderAt(<SummaryScreen />, at(PRACTICE.missionB));
    expect(await screen.findByRole('heading', { level: 1, name: m['child.summary.replayTitle'] })).toBeInTheDocument();
    expect(screen.getByText(format(m['child.summary.replayText'], { xp: 0 }))).toBeInTheDocument();
    expect(screen.queryByText(/^\+\d+ XP$/)).toBeNull();
    expect(screen.getByText(format(m['child.summary.firstTry'], { n: 2 }))).toBeInTheDocument();
  });

  it('while a replay is unfinished, the summary still shows the last completed run', async () => {
    const backend = stubChildBackend();
    await completeMission(backend, PRACTICE.missionB);
    await childRequest(backend, 'POST', `/api/child/missions/${PRACTICE.missionB}/replay`);
    renderAt(<SummaryScreen />, at(PRACTICE.missionB));
    expect(await screen.findByRole('heading', { level: 1, name: m['child.summary.title'] })).toBeInTheDocument();
    expect(screen.getByText(format(m['child.summary.xp'], { xp: 40 }))).toBeInTheDocument();
  });
});

describe('review findings F01, F02 (slice 8 review gate)', () => {
  it('a first run that earned no XP (every task resolved in other missions) shows no "+0 XP" and no XP figure (FR-38)', async () => {
    const backend = stubChildBackend();
    await completeMission(backend, PRACTICE.missionPerimeter);
    backend.override = {
      match: (method, path) => method === 'GET' && path.endsWith('/summary'),
      status: 200,
      body: { missionId: PRACTICE.missionPerimeter, xpEarned: 0, firstTryCount: 0, taskCount: 1, replay: false, rankUp: null, rankReachedDuringRun: null },
    };
    renderAt(<SummaryScreen />, at(PRACTICE.missionPerimeter));
    expect(await screen.findByText(m['child.summary.noXpText'])).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: m['child.summary.title'] })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\+\s*0\s*XP|[-−]\s*\d+\s*XP/);
    expect(screen.queryByText(format(m['child.summary.xpText'], { xp: 0 }))).toBeNull();
  });

  it('a 409 on "Zopakovat misi" (the mission is no longer complete) opens its briefing instead of an error', async () => {
    const backend = stubChildBackend();
    await completeMission(backend, PRACTICE.missionB);
    renderAt(<SummaryScreen />, at(PRACTICE.missionB));
    const button = await screen.findByRole('button', { name: m['child.mission.replay'] });
    backend.override = { match: (method, path) => method === 'POST' && path.endsWith('/replay'), status: 409, body: {} };
    await userEvent.click(button);
    await waitFor(() => expect(window.location.pathname + window.location.search).toBe(`/mission?missionId=${PRACTICE.missionB}`));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a retry after a failed replay clears the alert and starts the replay', async () => {
    const backend = stubChildBackend();
    await completeMission(backend, PRACTICE.missionB);
    renderAt(<SummaryScreen />, at(PRACTICE.missionB));
    const button = await screen.findByRole('button', { name: m['child.mission.replay'] });
    backend.down = true;
    await userEvent.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent(m['child.mission.replayFailed']);
    backend.down = false;
    await userEvent.click(button);
    await waitFor(() => expect(window.location.pathname).toBe('/task'));
  });
});
