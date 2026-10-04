// @trace FR-11
// @trace FR-13
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { format } from '@/i18n/format';
import { messages } from '@/i18n';
import { stubSignedInAdmin, type StubbedAdminBackend } from '@/test/admin-backend';
import { SEED } from '@/test/fake-admin-backend';
import { renderAt } from '@/test/render';
import { TaskListScreen } from './TaskListScreen';

const m = messages;
const field = (name: string) => screen.getByLabelText(name, { exact: true });
const rows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);
const row = (prompt: string) => within(screen.getByRole('table')).getByText(prompt).closest('tr') as HTMLElement;
const lastListQuery = (backend: StubbedAdminBackend) =>
  new URLSearchParams(backend.seen.filter((r) => r.method === 'GET' && r.path === '/api/admin/tasks').at(-1)?.search);

// Many keystrokes in a large form: under coverage and a parallel suite one test can pass 5 s.
vi.setConfig({ testTimeout: 30_000 });

afterEach(() => {
  vi.unstubAllGlobals();
});

async function open() {
  const backend = stubSignedInAdmin();
  renderAt(<TaskListScreen />, '/admin/tasks');
  await screen.findByText('Zapiš jednu polovinu jako desetinné číslo.');
  return backend;
}

describe('task list (FR-11, FR-13)', () => {
  it('lists every task with topic, status, modality and provenance', async () => {
    await open();
    expect(rows()).toHaveLength(4);
    const decimal = row('Zapiš jednu polovinu jako desetinné číslo.');
    expect(within(decimal).getByText('Desetinná čísla')).toBeInTheDocument();
    expect(within(decimal).getByText(m['admin.status.DRAFT'])).toBeInTheDocument();
    expect(within(decimal).getByText(m['admin.modality.TEXT'])).toBeInTheDocument();
    expect(within(decimal).getByText('Matematika 6 – pracovní sešit')).toBeInTheDocument();
    expect(within(decimal).getByText('57')).toBeInTheDocument();
    expect(within(decimal).getByText('4')).toBeInTheDocument();
    expect(within(decimal).getByText('b')).toBeInTheDocument();
    expect(within(row('Narýsuj čtverec o straně 5 cm.')).getByText(m['admin.modality.GRAPHIC'])).toBeInTheDocument();
    expect(screen.getByText(format(m['admin.tasks.count'], { count: 4 }))).toBeInTheDocument();
  });

  it('links each task to its editor, its preview and its source at the task page (Open the source at the task page)', async () => {
    await open();
    const decimal = row('Zapiš jednu polovinu jako desetinné číslo.');
    expect(within(decimal).getByRole('link', { name: m['admin.tasks.edit'] })).toHaveAttribute('href', `/admin/tasks/edit?taskId=${SEED.taskDecimal}`);
    expect(within(decimal).getByRole('link', { name: m['admin.tasks.preview'] })).toHaveAttribute(
      'href',
      `/admin/tasks/preview?taskId=${SEED.taskDecimal}`,
    );
    expect(within(decimal).getByRole('link', { name: m['admin.tasks.openSource'] })).toHaveAttribute(
      'href',
      `/admin/sources/view?sourceId=${SEED.sourceId}&page=57`,
    );
  });

  it('filters by source, page and status together (Combined filters)', async () => {
    const backend = await open();
    await userEvent.selectOptions(field(m['admin.tasks.source']), 'Matematika 6 – pracovní sešit');
    await userEvent.selectOptions(field(m['admin.tasks.status']), m['admin.status.DRAFT']);
    await userEvent.type(field(m['admin.tasks.page']), '57{Enter}');
    await waitFor(() => expect(rows()).toHaveLength(2));
    const query = lastListQuery(backend);
    expect(Object.fromEntries(query)).toEqual({ sourceId: SEED.sourceId, page: '57', status: 'DRAFT' });
  });

  it('filters by grade, topic and modality', async () => {
    const backend = await open();
    await userEvent.selectOptions(field(m['admin.tasks.grade']), '6');
    await userEvent.selectOptions(field(m['admin.tasks.topic']), 'Obvod a obsah');
    await userEvent.selectOptions(field(m['admin.tasks.modality']), m['admin.modality.GRAPHIC']);
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(Object.fromEntries(lastListQuery(backend))).toEqual({ grade: '6', topicId: SEED.topicPerimeter, modality: 'GRAPHIC' });
    await userEvent.selectOptions(field(m['admin.tasks.modality']), m['admin.common.any']);
    await waitFor(() => expect(rows()).toHaveLength(2));
  });

  it('searches the prompt ignoring case and diacritics (Text search)', async () => {
    const backend = await open();
    await userEvent.type(field(m['admin.tasks.search']), 'OBDELNIK{Enter}');
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0]).toHaveTextContent('Vypočítej obvod obdélníku');
    expect(lastListQuery(backend).get('q')).toBe('OBDELNIK');
  });

  it('sends no text filter for an empty or blank query (Empty query)', async () => {
    const backend = await open();
    await userEvent.type(field(m['admin.tasks.search']), '   ');
    await userEvent.click(screen.getByRole('button', { name: m['admin.tasks.apply'] }));
    await waitFor(() => expect(lastListQuery(backend).has('q')).toBe(false));
    expect(rows()).toHaveLength(4);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('refuses a query over 200 characters before sending', async () => {
    const backend = await open();
    const sent = backend.seen.length;
    const search = field(m['admin.tasks.search']);
    await userEvent.click(search);
    await userEvent.paste('x'.repeat(201));
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByText(m['admin.tasks.searchTooLong'])).toBeInTheDocument();
    expect(search).toHaveAttribute('aria-invalid', 'true');
    expect(backend.seen.length).toBe(sent);
  });

  it('refuses a page that is not a whole number before sending', async () => {
    await open();
    await userEvent.type(field(m['admin.tasks.page']), '5,5{Enter}');
    expect(await screen.findByText(m['admin.tasks.pageInvalid'])).toBeInTheDocument();
  });

  it('shows a server refusal of the query inline', async () => {
    const backend = await open();
    backend.override = { match: (method, path) => method === 'GET' && path === '/api/admin/tasks', status: 400, body: { errors: [{ field: 'q', message: 'Search must be at most 200 characters.' }] } };
    await userEvent.type(field(m['admin.tasks.search']), 'abc{Enter}');
    expect(await screen.findByText('Search must be at most 200 characters.')).toBeInTheDocument();
  });

  it('says "No tasks match." for an empty result (No match)', async () => {
    const backend = await open();
    backend.tasks = backend.tasks.filter((t) => t.input.modality !== 'GRAPHIC');
    await userEvent.selectOptions(field(m['admin.tasks.modality']), m['admin.modality.GRAPHIC']);
    expect(await screen.findByText(m['admin.tasks.empty'])).toBeInTheDocument();
  });

  it('offers a retry when the list cannot be loaded', async () => {
    const backend = stubSignedInAdmin();
    backend.failWith = 500;
    renderAt(<TaskListScreen />, '/admin/tasks');
    expect(await screen.findByText(m['admin.common.loadFailed'])).toBeInTheDocument();
    backend.failWith = null;
    await userEvent.click(screen.getByRole('button', { name: m['admin.session.retry'] }));
    expect(await screen.findByText('Zapiš jednu polovinu jako desetinné číslo.')).toBeInTheDocument();
  });
});

describe('bulk publish (OQ-32)', () => {
  const publishButton = (count: number) => screen.getByRole('button', { name: format(m['admin.tasks.publishSelected'], { count }) });

  it('publishes the selected tasks and lists the result of each (Publish several drafts at once)', async () => {
    const backend = await open();
    expect(publishButton(0)).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: m['admin.tasks.selectAll'] }));
    await userEvent.click(publishButton(4));
    const result = await screen.findByRole('region', { name: m['admin.tasks.publishResult'] });
    expect(within(result).getAllByText(m['admin.tasks.published'])).toHaveLength(4);
    expect(backend.tasks.every((t) => t.status === 'PUBLISHED')).toBe(true);
    const post = backend.seen.find((r) => r.method === 'POST');
    expect(JSON.parse(post?.body ?? '{}').taskIds).toHaveLength(4);
    await waitFor(() => expect(within(row('Narýsuj čtverec o straně 5 cm.')).getByText(m['admin.status.PUBLISHED'])).toBeInTheDocument());
  });

  it('selects single rows by their prompt and unselects them', async () => {
    await open();
    const choice = screen.getByRole('checkbox', { name: 'Které číslo je větší než 4?' });
    await userEvent.click(choice);
    expect(publishButton(1)).toBeEnabled();
    await userEvent.click(choice);
    expect(publishButton(0)).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: m['admin.tasks.selectAll'] }));
    await userEvent.click(screen.getByRole('checkbox', { name: m['admin.tasks.selectAll'] }));
    expect(publishButton(0)).toBeDisabled();
  });

  it('reports a task that was not published with the reason', async () => {
    const backend = await open();
    backend.override = {
      match: (method) => method === 'POST',
      status: 200,
      body: [{ taskId: SEED.taskChoice, published: false, reason: 'not found' }],
    };
    await userEvent.click(screen.getByRole('checkbox', { name: 'Které číslo je větší než 4?' }));
    await userEvent.click(publishButton(1));
    const result = await screen.findByRole('region', { name: m['admin.tasks.publishResult'] });
    expect(within(result).getByText(m['admin.tasks.notPublished'])).toBeInTheDocument();
    expect(within(result).getByText('not found')).toBeInTheDocument();
    expect(within(result).getByText('Které číslo je větší než 4?')).toBeInTheDocument();
  });

  it('refuses more than 100 selected tasks before sending', async () => {
    const backend = stubSignedInAdmin();
    const template = backend.tasks[0];
    backend.tasks = Array.from({ length: 101 }, (_, i) => ({ ...template, taskId: `aaaaaaaa-aaaa-4aaa-8aaa-${String(1000 + i).padStart(12, '0')}` }));
    renderAt(<TaskListScreen />, '/admin/tasks');
    await screen.findAllByText('Zapiš jednu polovinu jako desetinné číslo.');
    await userEvent.click(screen.getByRole('checkbox', { name: m['admin.tasks.selectAll'] }));
    await userEvent.click(publishButton(101));
    expect(await screen.findByText(m['admin.tasks.tooMany'])).toBeInTheDocument();
    expect(backend.seen.some((r) => r.method === 'POST')).toBe(false);
  });

  it('says publishing failed when the server cannot be reached', async () => {
    const backend = await open();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Které číslo je větší než 4?' }));
    backend.down = true;
    await userEvent.click(publishButton(1));
    expect(await screen.findByRole('alert')).toHaveTextContent(m['admin.tasks.publishFailed']);
  });
});

describe('task list loading', () => {
  it('offers a retry when only the task list fails', async () => {
    const backend = stubSignedInAdmin();
    backend.override = { match: (method, path) => method === 'GET' && path === '/api/admin/tasks', status: 500, body: {} };
    renderAt(<TaskListScreen />, '/admin/tasks');
    await userEvent.click(await screen.findByRole('button', { name: m['admin.session.retry'] }));
    expect(await screen.findByText('Zapiš jednu polovinu jako desetinné číslo.')).toBeInTheDocument();
  });
});

describe('publish result for a task not in the list', () => {
  it('names the task by its id', async () => {
    const backend = await open();
    const unknown = '99999999-9999-4999-8999-999999999999';
    backend.override = { match: (method) => method === 'POST', status: 200, body: [{ taskId: unknown, published: false, reason: 'not found' }] };
    await userEvent.click(screen.getByRole('checkbox', { name: 'Které číslo je větší než 4?' }));
    await userEvent.click(screen.getByRole('button', { name: format(m['admin.tasks.publishSelected'], { count: 1 }) }));
    const result = await screen.findByRole('region', { name: m['admin.tasks.publishResult'] });
    expect(within(result).getByText(unknown)).toBeInTheDocument();
  });
});
