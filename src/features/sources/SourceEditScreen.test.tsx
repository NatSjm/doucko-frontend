// @trace FR-55
// Store spec content-authoring: "Edit existing content" (Edit source metadata, Invalid source edit,
// Source grade locked while referenced, Source file cannot be replaced) and "Delete only unused
// content" (Source with tasks cannot be deleted, Delete an unused source).
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { messages } from '@/i18n';
import { format } from '@/i18n/format';
import { stubSignedInAdmin, type StubbedAdminBackend } from '@/test/admin-backend';
import { SEED } from '@/test/fake-admin-backend';
import { renderAt } from '@/test/render';
import { SourceEditScreen } from './SourceEditScreen';

const m = messages;
const field = (name: string) => screen.getByLabelText(name, { exact: true });
const button = (name: string) => screen.getByRole('button', { name });

vi.setConfig({ testTimeout: 30_000 });

afterEach(() => {
  vi.unstubAllGlobals();
});

async function open(sourceId: string = SEED.sourceId, prepare?: (b: StubbedAdminBackend) => void) {
  const backend = stubSignedInAdmin();
  prepare?.(backend);
  renderAt(<SourceEditScreen />, `/admin/sources/edit?sourceId=${sourceId}`);
  await screen.findByRole('heading', { level: 1, name: m['admin.sourceEdit.title'] });
  await screen.findByDisplayValue('Matematika 6 – pracovní sešit');
  return backend;
}

describe('source metadata edit (FR-55)', () => {
  it('fills the form with the stored metadata and offers no file field (Source file cannot be replaced)', async () => {
    await open();
    expect(field(m['admin.sources.sourceTitle'])).toHaveValue('Matematika 6 – pracovní sešit');
    expect(field(m['admin.sources.publisher'])).toHaveValue('Testovací nakladatelství');
    expect(field(m['admin.sources.edition'])).toHaveValue('1');
    expect(field(m['admin.sources.grade'])).toHaveValue('6');
    expect(field(m['admin.sources.subject'])).toHaveValue('math');
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(screen.getByText(m['admin.sourceEdit.noFile'])).toBeInTheDocument();
    expect(screen.getByRole('link', { name: m['admin.sources.view'] })).toHaveAttribute('href', `/admin/sources/view?sourceId=${SEED.sourceId}&page=1`);
  });

  it('saves a new edition; tasks of the source show it (Edit source metadata)', async () => {
    const backend = await open();
    await userEvent.clear(field(m['admin.sources.edition']));
    await userEvent.type(field(m['admin.sources.edition']), '2{Enter}');
    expect(await screen.findByText(m['admin.sourceEdit.saved'])).toBeInTheDocument();
    expect(backend.sources[0].source.edition).toBe('2');
    const put = backend.seen.find((r) => r.method === 'PUT');
    expect(JSON.parse(put?.body ?? '{}')).toEqual({
      title: 'Matematika 6 – pracovní sešit',
      publisher: 'Testovací nakladatelství',
      edition: '2',
      grade: 6,
      subject: 'math',
    });
  });

  it('clears an optional field by sending null', async () => {
    const backend = await open();
    await userEvent.clear(field(m['admin.sources.publisher']));
    await userEvent.click(button(m['admin.sourceEdit.save']));
    expect(await screen.findByText(m['admin.sourceEdit.saved'])).toBeInTheDocument();
    expect(backend.sources[0].source.publisher).toBeNull();
  });

  it('shows a refusal inline and keeps the stored source (Invalid source edit)', async () => {
    const backend = await open();
    await userEvent.clear(field(m['admin.sources.sourceTitle']));
    await userEvent.click(button(m['admin.sourceEdit.save']));
    expect(await screen.findByText('Title is required.')).toBeInTheDocument();
    expect(field(m['admin.sources.sourceTitle'])).toHaveAttribute('aria-invalid', 'true');
    expect(field(m['admin.sources.sourceTitle'])).toHaveFocus();
    expect(backend.sources[0].source.title).toBe('Matematika 6 – pracovní sešit');
  });

  it('shows the grade lock with its reason and the referencing tasks (Source grade locked while referenced)', async () => {
    const backend = await open(SEED.smallSourceId, (b) => {
      b.reference.grades = [6, 7];
      b.sources[1].source.title = 'Matematika 6 – pracovní sešit';
    });
    await userEvent.selectOptions(field(m['admin.sources.grade']), '7');
    await userEvent.click(button(m['admin.sourceEdit.save']));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The grade cannot change: 1 task references this source.');
    expect(within(alert).getByRole('link', { name: 'Narýsuj čtverec o straně 5 cm.' })).toHaveAttribute(
      'href',
      `/admin/tasks/edit?taskId=${SEED.taskGraphic}`,
    );
    expect(backend.sources[1].source.grade).toBe(6);
  });

  it('says saving failed without a server answer', async () => {
    const backend = await open();
    backend.down = true;
    await userEvent.click(button(m['admin.sourceEdit.save']));
    expect(await screen.findByRole('alert')).toHaveTextContent(m['admin.common.saveFailed']);
  });
});

describe('source delete (FR-55, store rule FR-56)', () => {
  it('a referenced source is refused with the reason and its tasks named (Source with tasks cannot be deleted)', async () => {
    const backend = await open();
    await userEvent.click(button(m['admin.sourceEdit.delete']));
    expect(screen.getByText(m['admin.sourceEdit.confirmDelete'])).toBeInTheDocument();
    await userEvent.click(button(m['admin.common.delete']));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('3 tasks reference this source. Delete or move those tasks first.');
    expect(within(alert).getAllByRole('link')).toHaveLength(3);
    expect(within(alert).getByRole('link', { name: 'Zapiš jednu polovinu jako desetinné číslo.' })).toBeInTheDocument();
    expect(backend.sources).toHaveLength(2);
  });

  it('deletes an unused source (Delete an unused source)', async () => {
    const backend = await open(SEED.smallSourceId, (b) => {
      b.tasks = b.tasks.filter((t) => t.input.sourceRef.sourceId !== SEED.smallSourceId);
      b.sources[1].source.title = 'Matematika 6 – pracovní sešit';
    });
    await userEvent.click(button(m['admin.sourceEdit.delete']));
    await userEvent.click(button(m['admin.common.delete']));
    expect(await screen.findByText(m['admin.sourceEdit.deleted'])).toBeInTheDocument();
    expect(screen.getByRole('link', { name: m['admin.sources.back'] })).toHaveAttribute('href', '/admin/sources');
    expect(backend.sources.map((s) => s.source.sourceId)).toEqual([SEED.sourceId]);
  });
});

describe('source grade no longer configured (review F09)', () => {
  it('still shows and keeps the stored grade instead of a different first option', async () => {
    const backend = await open(SEED.sourceId, (b) => (b.reference.grades = [7]));
    expect(field(m['admin.sources.grade'])).toHaveValue('6');
    expect(screen.getByRole('option', { name: '6' })).toBeInTheDocument();
    backend.reference.grades = [6, 7];
    await userEvent.click(button(m['admin.sourceEdit.save']));
    expect(await screen.findByText(m['admin.sourceEdit.saved'])).toBeInTheDocument();
    expect(backend.sources[0].source.grade).toBe(6);
  });
});

describe('source edit states', () => {
  it('offers a configured subject the catalog does not know under its key; an unknown one is refused inline (Invalid source edit)', async () => {
    const backend = await open(SEED.sourceId, (b) => b.reference.subjects.push('physics'));
    expect(screen.getByRole('option', { name: 'physics' })).toBeInTheDocument();
    // The server's configuration no longer has it: the refusal lands on the subject field.
    backend.reference.subjects = ['math'];
    await userEvent.selectOptions(field(m['admin.sources.subject']), 'physics');
    await userEvent.click(button(m['admin.sourceEdit.save']));
    expect(await screen.findByText('Subject must be one of: math.')).toBeInTheDocument();
    expect(field(m['admin.sources.subject'])).toHaveAttribute('aria-invalid', 'true');
    expect(backend.sources[0].source.subject).toBe('math');
  });

  it('names a blocker it cannot resolve by its id', async () => {
    const backend = await open();
    backend.override = {
      match: (method) => method === 'DELETE',
      status: 409,
      body: { title: 'Not allowed now', detail: '1 task references this source. Delete or move those tasks first.', conflicts: ['dddddddd-0000-4000-8000-00000000ffff'] },
    };
    await userEvent.click(button(m['admin.sourceEdit.delete']));
    await userEvent.click(button(m['admin.common.delete']));
    expect(await screen.findByRole('alert')).toHaveTextContent(format(m['admin.conflict.unknownItem'], { id: 'dddddddd-0000-4000-8000-00000000ffff' }));
  });

  it('says a source is not found', async () => {
    stubSignedInAdmin();
    renderAt(<SourceEditScreen />, '/admin/sources/edit?sourceId=11111111-1111-4111-8111-00000000ffff');
    expect(await screen.findByText(m['admin.sources.notFound'])).toBeInTheDocument();
    expect(screen.getByRole('link', { name: m['admin.sources.back'] })).toHaveAttribute('href', '/admin/sources');
  });

  it('shows a retry when it cannot load', async () => {
    const backend = stubSignedInAdmin();
    backend.failWith = 500;
    renderAt(<SourceEditScreen />, `/admin/sources/edit?sourceId=${SEED.sourceId}`);
    expect(await screen.findByText(m['admin.common.loadFailed'])).toBeInTheDocument();
    backend.failWith = null;
    await userEvent.click(button(m['admin.session.retry']));
    expect(await screen.findByDisplayValue('Matematika 6 – pracovní sešit')).toBeInTheDocument();
  });
});
