// @trace FR-36
// @trace FR-38
// @trace FR-33
import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { messages as m } from '@/i18n';
import { format } from '@/i18n/format';
import { stubChildBackend } from '@/test/admin-backend';
import { childRequest, completeMission, PLACEHOLDER_LADDER, PRACTICE, PROMPTS, practise } from '@/test/fake-child-backend';
import { renderAt } from '@/test/render';
import { TaskScreen } from './TaskScreen';

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, '', '/');
});

const at = (missionId: string, taskId?: string) => `/task?missionId=${missionId}${taskId ? `&taskId=${taskId}` : ''}`;
const rank2 = PLACEHOLDER_LADDER[1].name;
/** An XP amount with a minus sign, or a change of 0 XP (gamification "Wrong answers cost nothing"). */
const NEGATIVE_OR_ZERO_XP = /[-−]\s*\d+\s*XP|\+\s*0\s*XP/;
const acks = (seen: { path: string; body: string }[]) => seen.filter((r) => r.path === '/api/child/hq/rank-up-ack');

async function open(path: string) {
  renderAt(<TaskScreen />, path);
  await screen.findByRole('form', { name: m['child.task.answers'] });
}

describe('XP on the task feedback (FR-38)', () => {
  it('a correct first attempt shows the awarded "+10 XP"', async () => {
    stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    await userEvent.keyboard('0,75{Enter}');
    expect(await screen.findByText(format(m['child.task.xp'], { xp: 10 }))).toBeInTheDocument();
  });

  it('a wrong attempt shows no XP amount, no "+0 XP" and no minus sign next to XP', async () => {
    stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    await userEvent.keyboard('0,7{Enter}');
    await screen.findByText(m['child.task.almost']);
    expect(document.body.textContent).not.toMatch(NEGATIVE_OR_ZERO_XP);
    expect(document.body.textContent).not.toMatch(/XP/);
  });

  it('a revealed answer still earns XP: "+1 XP" next to "Nevadí, příště!", never a minus', async () => {
    stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    await userEvent.keyboard('0,7{Enter}');
    await screen.findByText(m['child.task.almost']);
    await userEvent.keyboard('{Control>}a{/Control}0,6{Enter}');
    expect(await screen.findByText(m['child.task.revealed'])).toBeInTheDocument();
    expect(screen.getByText(format(m['child.task.xp'], { xp: 1 }))).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(NEGATIVE_OR_ZERO_XP);
  });

  it('a resolution that completes a mission shows its bonus line', async () => {
    stubChildBackend();
    await open(at(PRACTICE.missionPerimeter, PRACTICE.taskSquare));
    await userEvent.keyboard('8 cm{Enter}');
    expect(await screen.findByText(format(m['child.task.xp'], { xp: 10 }))).toBeInTheDocument();
    expect(screen.getByText(format(m['child.task.bonus'], { xp: 20 }))).toBeInTheDocument();
  });

  it('a reload of a resolved task shows what the server stored, without a bonus line for an ordinary task', async () => {
    const backend = stubChildBackend();
    await practise(backend, PRACTICE.missionA, PRACTICE.taskSum, { a: '0,75' });
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    expect(screen.getByText(format(m['child.task.xp'], { xp: 10 }))).toBeInTheDocument();
    expect(screen.queryByText(/bonus/)).toBeNull();
  });
});

describe('rank-up on the task feedback (FR-36)', () => {
  it('a task award that crosses a threshold mid-mission plays the celebration naming the new rank', async () => {
    const backend = stubChildBackend();
    backend.practice.totalXp = 145;
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    await userEvent.keyboard('0,75{Enter}');
    const kicker = await screen.findByText(m['child.rankUp.kicker']);
    expect(kicker.closest('[role="status"]')).toHaveTextContent(format(m['child.rankUp.text'], { rank: rank2 }));
    // The attempt response is its only carrier: nothing to acknowledge.
    await act(async () => {});
    expect(acks(backend.seen)).toHaveLength(0);
  });

  it('is never shown again after a reload', async () => {
    const backend = stubChildBackend();
    backend.practice.totalXp = 145;
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    await userEvent.keyboard('0,75{Enter}');
    await screen.findByText(m['child.rankUp.kicker']);
    cleanup();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    expect(screen.getByText(m['child.task.correct'])).toBeInTheDocument();
    expect(screen.queryByText(m['child.rankUp.kicker'])).toBeNull();
  });

  it('no threshold crossed: no celebration', async () => {
    const backend = stubChildBackend();
    backend.practice.totalXp = 160;
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    await userEvent.keyboard('0,75{Enter}');
    await screen.findByText(m['child.task.correct']);
    expect(screen.queryByText(m['child.rankUp.kicker'])).toBeNull();
  });

  it('a rank-up by the completing answer is left to the mission-complete screen', async () => {
    const backend = stubChildBackend();
    backend.practice.totalXp = 140;
    await open(at(PRACTICE.missionPerimeter, PRACTICE.taskSquare));
    await userEvent.keyboard('8 cm{Enter}');
    expect(await screen.findByRole('link', { name: m['child.mission.results'] })).toHaveFocus();
    expect(screen.queryByText(m['child.rankUp.kicker'])).toBeNull();
  });
});

describe('a replay on the task screen (FR-33)', () => {
  it('starts fresh: task 1 with no attempt used and an empty input; a correct answer earns no XP', async () => {
    const backend = stubChildBackend();
    await completeMission(backend, PRACTICE.missionB);
    await childRequest(backend, 'POST', `/api/child/missions/${PRACTICE.missionB}/replay`);
    await open(at(PRACTICE.missionB));
    expect(screen.getByText(PROMPTS.thousands)).toBeInTheDocument();
    expect(screen.getByText(format(m['child.task.attempts'], { used: 0, total: 2 }))).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('');
    await userEvent.keyboard('1250{Enter}');
    expect(await screen.findByText(m['child.task.correct'])).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/XP/);
  });
});

describe('bonus copy (review finding F03)', () => {
  it('an answer that completes several missions names the bonus for missions, in the plural', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionPerimeter, PRACTICE.taskSquare));
    const original = backend.handle;
    backend.handle = async (request) => {
      const response = await original(request);
      if (!request.url.endsWith('/attempts')) return response;
      const body = await response.json();
      return new Response(JSON.stringify({ ...body, bonusXp: 40, completedMissionIds: [PRACTICE.missionPerimeter, PRACTICE.missionB] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    await userEvent.keyboard('8 cm{Enter}');
    expect(await screen.findByText(format(m['child.task.bonusMany'], { xp: 40 }))).toBeInTheDocument();
    expect(screen.queryByText(format(m['child.task.bonus'], { xp: 40 }))).toBeNull();
  });
});
