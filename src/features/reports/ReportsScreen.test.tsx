// @trace FR-41
// Store spec progress-stats: "Flag queue" (Report appears in the queue, Report without an attempt,
// Long raw input is shown in full, Queue order, Filter by status), "Attempt log is append-only"
// (Re-evaluation keeps the original verdict), "Re-evaluation of a reported attempt" (awards the
// missing XP, replay awards nothing, never lowers XP / unchanged spec changes nothing, 409 on a
// handled report), "Dismissing a report".
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminArea } from '@/features/admin-access/AdminArea';
import { messages } from '@/i18n';
import { format } from '@/i18n/format';
import { stubSignedInAdmin } from '@/test/admin-backend';
import { SEED } from '@/test/fake-admin-backend';
import { LONG_RAW, NOTES, REPORTS } from '@/test/fake-progress-backend';
import { renderAt } from '@/test/render';
import { formatTime, rawText } from './reports';
import { ReportsScreen } from './ReportsScreen';

const m = messages;
const DECIMAL = 'Zapiš jednu polovinu jako desetinné číslo.';
const CHOICE = 'Které číslo je větší než 4?';
const PERIMETER = 'Vypočítej obvod obdélníku se stranami 3 cm a 4 cm.';

const entries = () => within(screen.getByRole('list', { name: m['admin.reports.list'] })).getAllByRole('article');
const entry = (reportId: string) => document.querySelector<HTMLElement>(`[data-report="${reportId}"]`) as HTMLElement;
const outcome = () => screen.getByRole('status');
const reportRequests = (backend: ReturnType<typeof stubSignedInAdmin>) => backend.seen.filter((r) => r.path === '/api/admin/reports').map((r) => r.search);

async function open() {
  renderAt(
    <AdminArea>
      <ReportsScreen />
    </AdminArea>,
    '/admin/reports',
  );
  expect(await screen.findByRole('heading', { level: 1, name: m['admin.reports.title'] })).toBeInTheDocument();
  await screen.findByRole('list', { name: m['admin.reports.list'] });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('flag queue (FR-41)', () => {
  it('lists the reports in the server order: open ones first, oldest first, then the handled ones', async () => {
    const backend = stubSignedInAdmin();
    await open();
    expect(reportRequests(backend)).toEqual(['']);
    expect(entries().map((e) => e.getAttribute('data-report'))).toEqual([REPORTS.openRevealed, REPORTS.openReplay, REPORTS.openNoAttempt, REPORTS.dismissedLong, REPORTS.fixed]);
    expect(entries().map((e) => within(e).getByRole('heading').textContent)).toEqual([DECIMAL, PERIMETER, CHOICE, PERIMETER, CHOICE]);
  });

  it('shows the task, the reason, the note, the raw input and the checker verdict, and offers both actions (Report appears in the queue)', async () => {
    stubSignedInAdmin();
    await open();
    const e = entry(REPORTS.openRevealed);
    expect(e).toHaveAccessibleName(DECIMAL);
    expect(within(e).getByText(m['admin.reports.status.OPEN'])).toBeInTheDocument();
    expect(within(e).getByText(format(m['admin.reports.reported'], { time: '2026-10-05 16:20' }))).toBeInTheDocument();
    expect(within(e).getByRole('heading', { name: DECIMAL })).toHaveAttribute('lang', 'cs');
    expect(within(e).getByRole('link', { name: m['admin.reports.openTask'] })).toHaveAttribute('href', `/admin/tasks/edit?taskId=${SEED.taskDecimal}`);
    expect(within(e).getByText(m['admin.reports.reason.ANSWER_IS_CORRECT'])).toBeInTheDocument();
    expect(within(e).getByText(NOTES.half)).toHaveAttribute('lang', 'cs');
    expect(within(e).getByText(format(m['admin.reports.attempt'], { n: 2 }))).toBeInTheDocument();
    expect(within(e).getByText(format(m['admin.reports.hintsUsed'], { n: 0 }))).toBeInTheDocument();
    expect(within(e).getByText(format(m['admin.reports.submitted'], { time: '2026-10-05 16:18' }))).toBeInTheDocument();
    const parts = within(e).getByRole('table', { name: format(m['admin.reports.partsCaption'], { n: 2 }) });
    const cells = within(within(parts).getAllByRole('row')[1]).getAllByRole('cell').map((c) => c.textContent);
    expect(cells).toEqual(['a', '0,5', m['admin.reports.verdict.WRONG'], m['admin.reports.notReevaluated']]);
    expect(within(e).getByRole('button', { name: m['admin.reports.reevaluate'] })).toBeEnabled();
    expect(within(e).getByRole('button', { name: m['admin.reports.dismiss'] })).toBeEnabled();
    expect(within(e).queryByText(m['admin.reports.replay'])).not.toBeInTheDocument();
  });

  it('a report without an attempt says so and offers dismiss but not re-evaluate', async () => {
    stubSignedInAdmin();
    await open();
    const e = entry(REPORTS.openNoAttempt);
    expect(within(e).getByText(m['admin.reports.noAttempt'])).toBeInTheDocument();
    expect(within(e).getByText(m['admin.reports.reason.UNCLEAR_PROMPT'])).toBeInTheDocument();
    expect(within(e).getByText(NOTES.unclear)).toBeInTheDocument();
    expect(within(e).queryByRole('table')).not.toBeInTheDocument();
    expect(within(e).queryByRole('button', { name: m['admin.reports.reevaluate'] })).not.toBeInTheDocument();
    expect(within(e).getByRole('button', { name: m['admin.reports.dismiss'] })).toBeInTheDocument();
  });

  it('marks a replay attempt and its hints', async () => {
    stubSignedInAdmin();
    await open();
    const e = entry(REPORTS.openReplay);
    expect(within(e).getByText(m['admin.reports.replay'])).toBeInTheDocument();
    expect(within(e).getByText(format(m['admin.reports.hintsUsed'], { n: 1 }))).toBeInTheDocument();
    expect(within(e).queryByText(m['admin.reports.note'])).not.toBeInTheDocument();
  });

  it('shows a 100-code-point raw input in full, with no ellipsis, on a handled report without actions', async () => {
    stubSignedInAdmin();
    await open();
    const e = entry(REPORTS.dismissedLong);
    expect([...LONG_RAW]).toHaveLength(100);
    const raw = within(e).getByText(LONG_RAW);
    expect(raw.textContent).toBe(LONG_RAW);
    expect(raw).toHaveClass('report-raw');
    expect(within(e).getByText(m['admin.reports.status.DISMISSED'])).toBeInTheDocument();
    expect(within(e).getByText(m['admin.reports.reason.OTHER'])).toBeInTheDocument();
    expect(within(e).queryByRole('button')).not.toBeInTheDocument();
  });

  it('a fixed report shows the original and the re-evaluated verdict, each with its time', async () => {
    stubSignedInAdmin();
    await open();
    const e = entry(REPORTS.fixed);
    expect(within(e).getByText(m['admin.reports.status.FIXED'])).toBeInTheDocument();
    expect(within(e).getByText(format(m['admin.reports.submitted'], { time: '2026-10-02 11:58' }))).toBeInTheDocument();
    const cells = within(within(e).getAllByRole('row')[1]).getAllByRole('cell');
    expect(cells.map((c) => c.textContent)).toEqual([
      'a',
      'C',
      m['admin.reports.verdict.WRONG'],
      `${m['admin.reports.verdict.CORRECT']}${format(m['admin.reports.reevaluatedAt'], { time: '2026-10-03 10:30' })}`,
    ]);
    expect(within(e).queryByRole('button')).not.toBeInTheDocument();
  });

  it('keeps raw input exactly as logged, a no-break space included', async () => {
    const backend = stubSignedInAdmin();
    const attempt = backend.progress.reports[0].report.attempt;
    if (attempt) attempt.rawInput = { a: '1 000' };
    await open();
    const cells = within(within(entry(REPORTS.openRevealed)).getAllByRole('row')[1]).getAllByRole('cell');
    expect(cells[1].textContent).toBe('1 000');
  });

  it('shows a part locked as correct on attempt 1 with its verdict and no raw input (backend: not re-entered)', async () => {
    const backend = stubSignedInAdmin();
    const attempt = backend.progress.reports[0].report.attempt;
    if (attempt) {
      attempt.verdicts = { a: 'CORRECT', b: 'WRONG' };
      attempt.rawInput = { b: '0,5' };
      attempt.normalized = { a: '2', b: '0.5' };
    }
    await open();
    const rows = within(entry(REPORTS.openRevealed)).getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getAllByRole('cell').map((c) => c.textContent))).toEqual([
      ['a', m['admin.reports.lockedPart'], m['admin.reports.verdict.CORRECT'], m['admin.reports.notReevaluated']],
      ['b', '0,5', m['admin.reports.verdict.WRONG'], m['admin.reports.notReevaluated']],
    ]);
  });

  it('filters by status with the exact contract value, and back to all', async () => {
    const backend = stubSignedInAdmin();
    await open();
    const filter = screen.getByLabelText(m['admin.reports.filter']);
    expect(within(filter).getAllByRole('option').map((o) => o.textContent)).toEqual([
      m['admin.reports.filterAll'],
      m['admin.reports.status.OPEN'],
      m['admin.reports.status.FIXED'],
      m['admin.reports.status.DISMISSED'],
    ]);
    await userEvent.selectOptions(filter, 'FIXED');
    await vi.waitFor(() => expect(entries()).toHaveLength(1));
    expect(entries()[0]).toHaveAttribute('data-report', REPORTS.fixed);
    await userEvent.selectOptions(filter, '');
    await vi.waitFor(() => expect(entries()).toHaveLength(5));
    expect(reportRequests(backend)).toEqual(['', '?status=FIXED', '']);
  });

  it('says loading failed and retries', async () => {
    const backend = stubSignedInAdmin();
    backend.override = { match: (method, path) => method === 'GET' && path === '/api/admin/reports', status: 500, body: { title: 'Server error' } };
    renderAt(
      <AdminArea>
        <ReportsScreen />
      </AdminArea>,
      '/admin/reports',
    );
    expect(await screen.findByText(m['admin.common.loadFailed'])).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: m['admin.session.retry'] }));
    expect(await screen.findByRole('list', { name: m['admin.reports.list'] })).toBeInTheDocument();
  });

  it('says when there are no reports, and when none has the chosen status', async () => {
    stubSignedInAdmin({ seeded: false });
    renderAt(
      <AdminArea>
        <ReportsScreen />
      </AdminArea>,
      '/admin/reports',
    );
    expect(await screen.findByText(m['admin.reports.empty'])).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText(m['admin.reports.filter']), 'OPEN');
    expect(await screen.findByText(m['admin.reports.emptyFiltered'])).toBeInTheDocument();
  });
});

describe('re-evaluate and dismiss (FR-41)', () => {
  it('re-evaluates against the current answer spec: fixed, +4 XP, focus on the outcome (Re-evaluation awards the missing XP)', async () => {
    const backend = stubSignedInAdmin();
    await open();
    await userEvent.click(within(entry(REPORTS.openRevealed)).getByRole('button', { name: m['admin.reports.reevaluate'] }));
    const line = await screen.findByText(format(m['admin.reports.fixedXp'], { task: DECIMAL, xp: 4 }));
    expect(line).toHaveFocus();
    expect(line.closest('[role="status"]')).not.toBeNull();
    expect(backend.seen.find((r) => r.method === 'POST')).toMatchObject({ path: `/api/admin/reports/${REPORTS.openRevealed}/reevaluate` });
    expect(backend.seen.find((r) => r.method === 'POST')?.headers.get('X-XSRF-TOKEN')).toBe('xsrf-123');
    expect(backend.progress.awards).toEqual([{ reportId: REPORTS.openRevealed, xp: 4, bonus: 0 }]);
    // The queue reloads: the report is fixed, shows both verdicts and offers no action.
    await vi.waitFor(() => expect(within(entry(REPORTS.openRevealed)).getByText(m['admin.reports.status.FIXED'])).toBeInTheDocument());
    expect(within(entry(REPORTS.openRevealed)).queryByRole('button')).not.toBeInTheDocument();
    expect(within(entry(REPORTS.openRevealed)).getByText(m['admin.reports.verdict.CORRECT'])).toBeInTheDocument();
  });

  it('says a mission bonus was added with the re-evaluation', async () => {
    const backend = stubSignedInAdmin();
    backend.progress.reports[0].completes = [SEED.missionDecimals];
    await open();
    await userEvent.click(within(entry(REPORTS.openRevealed)).getByRole('button', { name: m['admin.reports.reevaluate'] }));
    expect(
      await screen.findByText(`${format(m['admin.reports.fixedXp'], { task: DECIMAL, xp: 4 })} ${format(m['admin.reports.bonus'], { xp: 20 })}`),
    ).toBeInTheDocument();
  });

  it('says nothing changed while the spec still marks the attempt wrong; the report stays open', async () => {
    const backend = stubSignedInAdmin();
    const task = backend.tasks.find((t) => t.taskId === SEED.taskDecimal);
    if (task) task.input.parts[0].spec.accepted = ['0.05'];
    await open();
    await userEvent.click(within(entry(REPORTS.openRevealed)).getByRole('button', { name: m['admin.reports.reevaluate'] }));
    expect(await screen.findByText(format(m['admin.reports.unchanged'], { task: DECIMAL }))).toHaveFocus();
    expect(within(entry(REPORTS.openRevealed)).getByText(m['admin.reports.status.OPEN'])).toBeInTheDocument();
    expect(backend.progress.awards).toEqual([]);
  });

  it('a replay attempt is fixed with no XP (Re-evaluating a replay attempt awards nothing)', async () => {
    const backend = stubSignedInAdmin();
    await open();
    await userEvent.click(within(entry(REPORTS.openReplay)).getByRole('button', { name: m['admin.reports.reevaluate'] }));
    expect(await screen.findByText(format(m['admin.reports.fixedReplay'], { task: PERIMETER }))).toBeInTheDocument();
    expect(backend.progress.awards).toEqual([]);
  });

  it('a fix that adds no XP says so', async () => {
    const backend = stubSignedInAdmin();
    await open();
    backend.override = {
      match: (method, path) => method === 'POST' && path.endsWith('/reevaluate'),
      status: 200,
      body: { changed: true, xpAwarded: 0, bonusXp: 0, completedMissionIds: [], newTaskState: null, report: { ...backend.progress.reports[0].report, status: 'FIXED' } },
    };
    await userEvent.click(within(entry(REPORTS.openRevealed)).getByRole('button', { name: m['admin.reports.reevaluate'] }));
    expect(await screen.findByText(format(m['admin.reports.fixedNoXp'], { task: DECIMAL }))).toBeInTheDocument();
  });

  it('dismisses an open report', async () => {
    const backend = stubSignedInAdmin();
    await open();
    await userEvent.click(within(entry(REPORTS.openNoAttempt)).getByRole('button', { name: m['admin.reports.dismiss'] }));
    expect(await screen.findByText(format(m['admin.reports.dismissed'], { task: CHOICE }))).toHaveFocus();
    await vi.waitFor(() => expect(within(entry(REPORTS.openNoAttempt)).getByText(m['admin.reports.status.DISMISSED'])).toBeInTheDocument());
    expect(within(entry(REPORTS.openNoAttempt)).queryByRole('button')).not.toBeInTheDocument();
    expect(backend.progress.reports[1].report.status).toBe('DISMISSED');
  });

  it('a refusal (409) shows the server reason and reloads the queue', async () => {
    const backend = stubSignedInAdmin();
    await open();
    // Handled elsewhere in the meantime.
    backend.progress.reports[0].report.status = 'DISMISSED';
    await userEvent.click(within(entry(REPORTS.openRevealed)).getByRole('button', { name: m['admin.reports.dismiss'] }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Only an open report can be dismissed; this one is DISMISSED.');
    await vi.waitFor(() => expect(within(entry(REPORTS.openRevealed)).getByText(m['admin.reports.status.DISMISSED'])).toBeInTheDocument());
  });

  it('a refusal without a reason says the report was already handled', async () => {
    const backend = stubSignedInAdmin();
    await open();
    backend.override = { match: (method) => method === 'POST', status: 409, body: {} };
    await userEvent.click(within(entry(REPORTS.openRevealed)).getByRole('button', { name: m['admin.reports.reevaluate'] }));
    expect(await screen.findByRole('alert')).toHaveTextContent(m['admin.reports.alreadyHandled']);
  });

  it('a failed request says the action failed and keeps the report', async () => {
    const backend = stubSignedInAdmin();
    await open();
    backend.down = true;
    await userEvent.click(within(entry(REPORTS.openRevealed)).getByRole('button', { name: m['admin.reports.reevaluate'] }));
    expect(await screen.findByRole('alert')).toHaveTextContent(m['admin.common.actionFailed']);
    expect(within(entry(REPORTS.openRevealed)).getByRole('button', { name: m['admin.reports.reevaluate'] })).toBeEnabled();
  });

  it('disables every action while one runs', async () => {
    const backend = stubSignedInAdmin();
    await open();
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    const handle = backend.handle;
    backend.handle = async (request) => {
      if (request.method === 'POST') await held;
      return handle(request);
    };
    await userEvent.click(within(entry(REPORTS.openRevealed)).getByRole('button', { name: m['admin.reports.dismiss'] }));
    for (const button of screen.getAllByRole('button', { name: m['admin.reports.dismiss'] })) expect(button).toBeDisabled();
    release();
    expect(await screen.findByText(format(m['admin.reports.dismissed'], { task: DECIMAL }))).toBeInTheDocument();
  });
});

describe('report helpers', () => {
  it('shows times in Europe/Prague', () => {
    expect(formatTime('2026-10-05T14:20:00Z')).toBe('2026-10-05 16:20');
    expect(formatTime('2026-01-05T14:20:00Z')).toBe('2026-01-05 15:20');
  });

  it('shows a choice answer as its option keys', () => {
    expect(rawText('0,5')).toBe('0,5');
    expect(rawText(['A', 'C'])).toBe('A, C');
  });
});

// The outcome line exists before any action, so screen readers announce the first result.
it('has an empty outcome line ready before any action', async () => {
  stubSignedInAdmin();
  await open();
  expect(outcome()).toBeEmptyDOMElement();
});
