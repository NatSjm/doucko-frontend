// @trace FR-40
// Store spec progress-stats: "Practice statistics page" — Success metric met / not met, Current week
// does not count, Less than 4 completed weeks of history, No data yet, First-try rate per topic,
// Topic with no resolved tasks; "Stats and flag queue are admin-only" (behind the session gate).
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminArea } from '@/features/admin-access/AdminArea';
import { messages } from '@/i18n';
import { format } from '@/i18n/format';
import { stubAdminBackend, stubSignedInAdmin } from '@/test/admin-backend';
import { renderAt } from '@/test/render';
import { StatsScreen } from './StatsScreen';

const m = messages;
const weekly = () => screen.findByRole('table', { name: m['admin.stats.weeklyCaption'] });
const rows = (table: HTMLElement) => within(table).getAllByRole('row').slice(1);
const metric = () => screen.getByRole('region', { name: m['admin.stats.metricTitle'] });
const statsRequests = (backend: ReturnType<typeof stubSignedInAdmin>) => backend.seen.filter((r) => r.path === '/api/admin/stats').map((r) => r.search);

function open() {
  renderAt(
    <AdminArea>
      <StatsScreen />
    </AdminArea>,
    '/admin/stats',
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('stats page (FR-40)', () => {
  it('asks for 5 weeks and shows them newest first with every weekly figure', async () => {
    const backend = stubSignedInAdmin();
    open();
    expect(await screen.findByRole('heading', { level: 1, name: m['admin.stats.title'] })).toBeInTheDocument();
    const table = await weekly();
    expect(statsRequests(backend)).toEqual(['?weeks=5']);
    expect(rows(table)).toHaveLength(5);
    const cells = (i: number) => within(rows(table)[i]).getAllByRole('cell').map((c) => c.textContent);
    // The current week (Monday 2026-10-05) is first and marked; it is not a metric week.
    expect(cells(0)[0]).toBe(`2026-10-05${m['admin.stats.thisWeek']}`);
    expect(cells(0).slice(1)).toEqual(['1', '0', '4', '2', '0']);
    // The last completed week: sessions of 12, 10 and 11 tasks, 7 hints, 3 reveals.
    expect(cells(1)).toEqual([`2026-09-28${m['admin.stats.metricWeek']}`, '3', '3', '12, 10, 11', '7', '3']);
    expect(cells(3)[0]).toBe(`2026-09-14${m['admin.stats.metricWeek']}`);
  });

  it('marks the metric not met and the week with 2 qualifying sessions as short (Success metric not met)', async () => {
    stubSignedInAdmin();
    open();
    const table = await weekly();
    expect(within(metric()).getByText(m['admin.stats.metricNotMet'])).toBeInTheDocument();
    expect(within(metric()).getByText(m['admin.stats.metricRule'])).toBeInTheDocument();
    expect(within(metric()).getByText(format(m['admin.stats.shortWeeks'], { weeks: '2026-09-14' }))).toBeInTheDocument();
    const short = rows(table).filter((r) => within(r).queryByText(m['admin.stats.short']));
    expect(short).toHaveLength(1);
    expect(within(short[0]).getAllByRole('cell')[2]).toHaveTextContent(`2${m['admin.stats.short']}`);
    expect(within(short[0]).getAllByRole('cell')[0]).toHaveTextContent('2026-09-14');
  });

  it('marks the metric met with 3 qualifying sessions in each completed week, whatever the current week has', async () => {
    const backend = stubSignedInAdmin();
    backend.progress.history[3] = { tasksPerSession: [10, 11, 12], hintsUsed: 0, revealed: 0 };
    backend.progress.history[0] = { tasksPerSession: [], hintsUsed: 0, revealed: 0 };
    open();
    const table = await weekly();
    expect(within(metric()).getByText(m['admin.stats.metricMet'])).toBeInTheDocument();
    expect(within(metric()).queryByText(m['admin.stats.metricNotMet'])).not.toBeInTheDocument();
    expect(within(table).queryByText(m['admin.stats.short'])).not.toBeInTheDocument();
    expect(screen.queryByText(/Short weeks/)).not.toBeInTheDocument();
  });

  it('with less than 4 completed weeks of history the metric is not met and no error is shown', async () => {
    const backend = stubSignedInAdmin();
    const five = { tasksPerSession: [10, 10, 10, 10, 10], hintsUsed: 0, revealed: 0 };
    backend.progress.history = [{ tasksPerSession: [], hintsUsed: 0, revealed: 0 }, five, five];
    open();
    await weekly();
    expect(within(metric()).getByText(m['admin.stats.metricNotMet'])).toBeInTheDocument();
    expect(within(metric()).getByText(format(m['admin.stats.shortWeeks'], { weeks: '2026-09-07, 2026-09-14' }))).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(m['admin.stats.empty'])).not.toBeInTheDocument();
  });

  it('shows the first-try rate per topic, and — for a topic with nothing resolved', async () => {
    stubSignedInAdmin();
    open();
    const topics = await screen.findByRole('table', { name: m['admin.stats.topicsCaption'] });
    const decimals = within(topics).getByRole('row', { name: /Desetinná čísla/ });
    expect(within(decimals).getAllByRole('cell').map((c) => c.textContent)).toEqual([
      'Desetinná čísla',
      format(m['admin.stats.rate'], { percent: 75 }),
      format(m['admin.stats.resolved'], { firstTry: 6, resolved: 8 }),
    ]);
    const perimeter = within(topics).getByRole('row', { name: /Obvod a obsah/ });
    expect(within(perimeter).getAllByRole('cell').map((c) => c.textContent)).toEqual(['Obvod a obsah', m['admin.stats.noValue'], m['admin.stats.noneResolved']]);
    expect(within(perimeter).getAllByRole('cell')[0]).toHaveAttribute('lang', 'cs');
  });

  it('asks for the chosen week count and shows that many weeks', async () => {
    const backend = stubSignedInAdmin();
    open();
    await weekly();
    const select = screen.getByLabelText(m['admin.stats.weeksShown']);
    expect(select).toHaveValue('5');
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(
      [5, 8, 12, 26, 52].map((n) => format(m['admin.stats.weeksOption'], { n })),
    );
    await userEvent.selectOptions(select, '12');
    await vi.waitFor(async () => expect(rows(await weekly())).toHaveLength(12));
    expect(statsRequests(backend)).toEqual(['?weeks=5', '?weeks=12']);
    // The metric does not depend on the week count.
    expect(within(metric()).getByText(m['admin.stats.metricNotMet'])).toBeInTheDocument();
  });

  it('with no practice at all shows zeros, not met and the empty-state message, and no error (No data yet)', async () => {
    stubSignedInAdmin({ seeded: false });
    open();
    const table = await weekly();
    expect(screen.getByText(m['admin.stats.empty'])).toBeInTheDocument();
    for (const row of rows(table)) {
      const cells = within(row).getAllByRole('cell').map((c) => c.textContent);
      expect(cells.slice(1)).toEqual(['0', '0', m['admin.stats.noValue'], '0', '0']);
    }
    expect(within(metric()).getByText(m['admin.stats.metricNotMet'])).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says loading failed and retries', async () => {
    const backend = stubSignedInAdmin();
    backend.override = { match: (method, path) => method === 'GET' && path === '/api/admin/stats', status: 500, body: { title: 'Server error' } };
    open();
    expect(await screen.findByText(m['admin.common.loadFailed'])).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: m['admin.session.retry'] }));
    expect(await weekly()).toBeInTheDocument();
  });

  it('never shows the figures of another week count as the chosen one: a failed load says so and retries (review F05)', async () => {
    const backend = stubSignedInAdmin();
    open();
    await weekly();
    backend.override = { match: (method, path) => method === 'GET' && path === '/api/admin/stats', status: 500, body: { title: 'Server error' } };
    await userEvent.selectOptions(screen.getByLabelText(m['admin.stats.weeksShown']), '8');
    expect(await screen.findByText(m['admin.common.loadFailed'])).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: m['admin.stats.weeklyCaption'] })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: m['admin.session.retry'] }));
    await vi.waitFor(async () => expect(rows(await weekly())).toHaveLength(8));
  });

  it('practice older than the shown weeks is not the empty state: the short weeks are marked (review F07)', async () => {
    const backend = stubSignedInAdmin();
    backend.progress.history = [];
    open();
    const table = await weekly();
    expect(screen.queryByText(m['admin.stats.empty'])).not.toBeInTheDocument();
    expect(within(table).getAllByText(m['admin.stats.short'])).toHaveLength(4);
  });

  it('is behind the admin session: without one, the sign-in form is shown and no stats are asked for', async () => {
    const backend = stubAdminBackend();
    open();
    expect(await screen.findByRole('heading', { level: 1, name: m['admin.signIn.title'] })).toBeInTheDocument();
    expect(statsRequests(backend)).toEqual([]);
  });
});
