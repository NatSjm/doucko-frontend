// @trace FR-9
// Store spec content-authoring: "Missions" (topic, position, counter `<n>/10 tasks`), "Draft and published status".
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { messages } from '@/i18n';
import { format } from '@/i18n/format';
import { stubSignedInAdmin } from '@/test/admin-backend';
import { SEED } from '@/test/fake-admin-backend';
import { renderAt } from '@/test/render';
import { MissionListScreen } from './MissionListScreen';

const m = messages;
const rows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('mission list (FR-9)', () => {
  it('lists each mission with topic, position, counter and status, and links to its editor', async () => {
    stubSignedInAdmin();
    renderAt(<MissionListScreen />, '/admin/missions');
    expect(await screen.findByRole('heading', { level: 1, name: m['admin.missions.title'] })).toBeInTheDocument();
    await screen.findByRole('table');
    expect(rows()).toHaveLength(1);
    const row = rows()[0];
    expect(within(row).getByText('Desetinná čísla')).toBeInTheDocument();
    expect(within(row).getByText('1')).toBeInTheDocument();
    expect(within(row).getByText(format(m['admin.missions.counter'], { count: 2 }))).toBeInTheDocument();
    expect(within(row).getByText(m['admin.status.DRAFT'])).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: m['admin.missions.edit'] })).toHaveAttribute('href', `/admin/missions/edit?missionId=${SEED.missionDecimals}`);
    expect(within(screen.getByRole('main')).getByRole('link', { name: m['admin.missions.new'] })).toHaveAttribute('href', '/admin/missions/edit');
  });

  it('orders missions by topic name, then position', async () => {
    const backend = stubSignedInAdmin();
    backend.missions.push(
      { missionId: 'ffffffff-ffff-4fff-8fff-0000000000a1', topicId: SEED.topicPerimeter, position: 2, taskIds: [], status: 'DRAFT' },
      { missionId: 'ffffffff-ffff-4fff-8fff-0000000000a2', topicId: SEED.topicDecimals, position: 3, taskIds: [], status: 'PUBLISHED' },
      { missionId: 'ffffffff-ffff-4fff-8fff-0000000000a3', topicId: SEED.topicPerimeter, position: 1, taskIds: [SEED.taskPerimeter], status: 'DRAFT' },
    );
    renderAt(<MissionListScreen />, '/admin/missions');
    await screen.findByRole('table');
    const shown = rows().map((r) => within(r).getAllByRole('cell').slice(0, 3).map((c) => c.textContent));
    expect(shown).toEqual([
      ['Desetinná čísla', '1', format(m['admin.missions.counter'], { count: 2 })],
      ['Desetinná čísla', '3', format(m['admin.missions.counter'], { count: 0 })],
      ['Obvod a obsah', '1', format(m['admin.missions.counter'], { count: 1 })],
      ['Obvod a obsah', '2', format(m['admin.missions.counter'], { count: 0 })],
    ]);
    expect(within(rows()[1]).getByText(m['admin.status.PUBLISHED'])).toBeInTheDocument();
  });

  it('says there are no missions yet and still offers a new one', async () => {
    stubSignedInAdmin({ seeded: false });
    renderAt(<MissionListScreen />, '/admin/missions');
    expect(await screen.findByText(m['admin.missions.empty'])).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByRole('link', { name: m['admin.missions.new'] })).toBeInTheDocument();
  });

  it('shows a retry when the list cannot load', async () => {
    const backend = stubSignedInAdmin();
    backend.failWith = 500;
    renderAt(<MissionListScreen />, '/admin/missions');
    expect(await screen.findByText(m['admin.common.loadFailed'])).toBeInTheDocument();
    backend.failWith = null;
    await userEvent.click(screen.getByRole('button', { name: m['admin.session.retry'] }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('keeps listing a mission whose topic is no longer configured, with an empty topic', async () => {
    const backend = stubSignedInAdmin();
    backend.missions.push({ missionId: 'ffffffff-ffff-4fff-8fff-0000000000c1', topicId: '33333333-3333-4333-8333-00000000ffff', position: 5, taskIds: [], status: 'DRAFT' });
    renderAt(<MissionListScreen />, '/admin/missions');
    await screen.findByRole('table');
    expect(rows()).toHaveLength(2);
    expect(within(rows()[0]).getAllByRole('cell')[0]).toHaveTextContent('');
    expect(within(rows()[0]).getByText('5')).toBeInTheDocument();
  });
});
