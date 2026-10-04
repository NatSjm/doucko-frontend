// @trace FR-1
// @trace NFR-17
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { messages } from '@/i18n';
import { stubSignedInAdmin } from '@/test/admin-backend';
import { makePdf, makePng } from '@/test/fake-admin-backend';
import { renderAt } from '@/test/render';
import { SourcesScreen } from './SourcesScreen';

const pdf = (pages = 12, name = 'sesit.pdf') => new File([makePdf(pages) as BlobPart], name, { type: 'application/pdf' });

// Many keystrokes in a large form: under coverage and a parallel suite one test can pass 5 s.
vi.setConfig({ testTimeout: 30_000 });

afterEach(() => {
  vi.unstubAllGlobals();
});

async function fillUpload(file: File | null, title = 'Matematika 6 – pracovní sešit') {
  // The file dialog's type filter can be switched to "all files", so a wrong type must still be caught.
  if (file) await userEvent.upload(screen.getByLabelText(messages['admin.sources.file']), file, { applyAccept: false });
  if (title) await userEvent.type(screen.getByLabelText(messages['admin.sources.sourceTitle']), title);
}

describe('source list (FR-1)', () => {
  it('lists every source with its metadata and page count', async () => {
    stubSignedInAdmin();
    renderAt(<SourcesScreen />, '/admin/sources');
    const row = (await screen.findByText('Matematika 6 – pracovní sešit')).closest('tr') as HTMLElement;
    expect(within(row).getByText('Testovací nakladatelství')).toBeInTheDocument();
    expect(within(row).getByText('120')).toBeInTheDocument();
    expect(within(row).getByText(messages['admin.subject.math'])).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: messages['admin.sources.view'] })).toHaveAttribute(
      'href',
      '/admin/sources/view?sourceId=11111111-1111-4111-8111-111111111111&page=1',
    );
    expect(within(row).getByRole('link', { name: messages['admin.sources.newTask'] })).toHaveAttribute(
      'href',
      '/admin/tasks/edit?sourceId=11111111-1111-4111-8111-111111111111&page=1',
    );
  });

  it('says so when there is no source yet', async () => {
    stubSignedInAdmin({ seeded: false });
    renderAt(<SourcesScreen />, '/admin/sources');
    expect(await screen.findByText(messages['admin.sources.empty'])).toBeInTheDocument();
  });

  it('offers a retry when the list cannot be loaded', async () => {
    const backend = stubSignedInAdmin();
    backend.failWith = 500;
    renderAt(<SourcesScreen />, '/admin/sources');
    expect(await screen.findByText(messages['admin.common.loadFailed'])).toBeInTheDocument();
    backend.failWith = null;
    await userEvent.click(screen.getByRole('button', { name: messages['admin.session.retry'] }));
    expect(await screen.findByText('Sbírka úloh 6')).toBeInTheDocument();
  });
});

describe('upload (FR-1)', () => {
  it('uploads with title, publisher, edition, grade and subject; Enter submits; the list shows the page count', async () => {
    const backend = stubSignedInAdmin({ seeded: false });
    renderAt(<SourcesScreen />, '/admin/sources');
    await screen.findByText(messages['admin.sources.empty']);
    await fillUpload(pdf(12));
    await userEvent.type(screen.getByLabelText(messages['admin.sources.publisher']), 'Testovací nakladatelství');
    await userEvent.type(screen.getByLabelText(messages['admin.sources.edition']), '1{Enter}');
    expect(await screen.findByRole('status')).toHaveTextContent(messages['admin.sources.uploaded']);
    const row = (await screen.findByText('Matematika 6 – pracovní sešit')).closest('tr') as HTMLElement;
    expect(within(row).getByText('12')).toBeInTheDocument();
    expect(backend.sources[0].source).toMatchObject({ grade: 6, subject: 'math', publisher: 'Testovací nakladatelství', edition: '1' });
    const post = backend.seen.find((r) => r.method === 'POST');
    expect(post?.headers.get('X-XSRF-TOKEN')).toBe('xsrf-123');
    // The form is cleared for the next source.
    expect(screen.getByLabelText(messages['admin.sources.sourceTitle'])).toHaveValue('');
  });

  it('creates a source without publisher and edition (optional metadata)', async () => {
    const backend = stubSignedInAdmin({ seeded: false });
    renderAt(<SourcesScreen />, '/admin/sources');
    await screen.findByText(messages['admin.sources.empty']);
    await fillUpload(pdf(3));
    await userEvent.click(screen.getByRole('button', { name: messages['admin.sources.upload'] }));
    await screen.findByText('Matematika 6 – pracovní sešit');
    expect(backend.sources[0].source).toMatchObject({ publisher: null, edition: null });
  });

  it('asks for a file before sending anything', async () => {
    const backend = stubSignedInAdmin();
    renderAt(<SourcesScreen />, '/admin/sources');
    await screen.findByText('Sbírka úloh 6');
    await fillUpload(null);
    await userEvent.click(screen.getByRole('button', { name: messages['admin.sources.upload'] }));
    expect(await screen.findByText(messages['admin.sources.fileRequired'])).toBeInTheDocument();
    expect(screen.getByLabelText(messages['admin.sources.file'])).toHaveAttribute('aria-invalid', 'true');
    expect(backend.seen.some((r) => r.method === 'POST')).toBe(false);
  });
});

describe('upload limits before upload (NFR-17)', () => {
  it.each([
    ['a .docx file', new File(['PK\u0003\u0004 word'], 'ukoly.docx')],
    ['a PNG renamed to .pdf', new File([makePng() as BlobPart], 'sesit.pdf', { type: 'application/pdf' })],
  ])('refuses %s with the PDF rule and sends nothing', async (_name, file) => {
    const backend = stubSignedInAdmin();
    renderAt(<SourcesScreen />, '/admin/sources');
    await screen.findByText('Sbírka úloh 6');
    await fillUpload(file);
    await userEvent.click(screen.getByRole('button', { name: messages['admin.sources.upload'] }));
    expect(await screen.findByText(messages['admin.sources.fileRule'])).toBeInTheDocument();
    expect(backend.seen.some((r) => r.method === 'POST')).toBe(false);
  });

  it('refuses a 51 MB PDF and sends nothing', async () => {
    const backend = stubSignedInAdmin();
    renderAt(<SourcesScreen />, '/admin/sources');
    await screen.findByText('Sbírka úloh 6');
    const bytes = new Uint8Array(51 * 1024 * 1024);
    bytes.set(makePdf(1));
    await fillUpload(new File([bytes], 'big.pdf', { type: 'application/pdf' }));
    await userEvent.click(screen.getByRole('button', { name: messages['admin.sources.upload'] }));
    expect(await screen.findByText(messages['admin.sources.fileRule'])).toBeInTheDocument();
    expect(backend.seen.some((r) => r.method === 'POST')).toBe(false);
  });
});

describe('server refusals inline', () => {
  it('shows a field error under the field the problem names', async () => {
    const backend = stubSignedInAdmin();
    renderAt(<SourcesScreen />, '/admin/sources');
    await screen.findByText('Sbírka úloh 6');
    await fillUpload(pdf(), '   ');
    await userEvent.click(screen.getByRole('button', { name: messages['admin.sources.upload'] }));
    const title = screen.getByLabelText(messages['admin.sources.sourceTitle']);
    await waitFor(() => expect(title).toHaveAttribute('aria-invalid', 'true'));
    expect(title).toHaveAccessibleDescription('Title is required.');
    expect(title).toHaveFocus();
    expect(backend.sources).toHaveLength(2);
  });

  it('shows a damaged-PDF refusal on the file field', async () => {
    stubSignedInAdmin();
    renderAt(<SourcesScreen />, '/admin/sources');
    await screen.findByText('Sbírka úloh 6');
    await fillUpload(new File(['%PDF-1.4 truncated'], 'broken.pdf'));
    await userEvent.click(screen.getByRole('button', { name: messages['admin.sources.upload'] }));
    expect(await screen.findByText('The PDF could not be read. It may be damaged or password-protected.')).toBeInTheDocument();
  });

  it('shows a 413/415 refusal message on the file field', async () => {
    const backend = stubSignedInAdmin();
    renderAt(<SourcesScreen />, '/admin/sources');
    await screen.findByText('Sbírka úloh 6');
    backend.override = { match: (m) => m === 'POST', status: 415, body: { detail: 'Only PDF files up to 50 MB are allowed.' } };
    await fillUpload(pdf());
    await userEvent.click(screen.getByRole('button', { name: messages['admin.sources.upload'] }));
    expect(await screen.findByText('Only PDF files up to 50 MB are allowed.')).toBeInTheDocument();
    expect(screen.getByLabelText(messages['admin.sources.file'])).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows a field error the form has no input for in the form alert', async () => {
    const backend = stubSignedInAdmin();
    renderAt(<SourcesScreen />, '/admin/sources');
    await screen.findByText('Sbírka úloh 6');
    backend.override = { match: (m) => m === 'POST', status: 400, body: { errors: [{ field: 'unknown', message: 'Something else.' }] } };
    await fillUpload(pdf());
    await userEvent.click(screen.getByRole('button', { name: messages['admin.sources.upload'] }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(messages['admin.common.formErrors']);
    expect(alert).toHaveTextContent('Something else.');
  });

  it('says saving failed when the server cannot be reached', async () => {
    const backend = stubSignedInAdmin();
    renderAt(<SourcesScreen />, '/admin/sources');
    await screen.findByText('Sbírka úloh 6');
    await fillUpload(pdf());
    backend.down = true;
    await userEvent.click(screen.getByRole('button', { name: messages['admin.sources.upload'] }));
    expect(await screen.findByRole('alert')).toHaveTextContent(messages['admin.common.saveFailed']);
  });
});

describe('configured grades and subjects (CA-D16)', () => {
  it('offers the configured grades and subjects, and shows a subject the catalog does not name by its key', async () => {
    const backend = stubSignedInAdmin({ seeded: false });
    backend.reference.grades = [6, 7];
    backend.reference.subjects = ['math', 'physics'];
    renderAt(<SourcesScreen />, '/admin/sources');
    await screen.findByText(messages['admin.sources.empty']);
    await userEvent.selectOptions(screen.getByLabelText(messages['admin.sources.grade']), '7');
    await userEvent.selectOptions(screen.getByLabelText(messages['admin.sources.subject']), 'physics');
    await fillUpload(pdf(2));
    await userEvent.click(screen.getByRole('button', { name: messages['admin.sources.upload'] }));
    const row = (await screen.findByText('Matematika 6 – pracovní sešit')).closest('tr') as HTMLElement;
    expect(within(row).getByText('physics')).toHaveAttribute('data-content');
    expect(backend.sources[0].source).toMatchObject({ grade: 7, subject: 'physics' });
  });
});

describe('file dialog closed without a file', () => {
  it('treats it as no file chosen', async () => {
    const backend = stubSignedInAdmin();
    renderAt(<SourcesScreen />, '/admin/sources');
    await screen.findByText('Sbírka úloh 6');
    await fillUpload(pdf());
    fireEvent.change(screen.getByLabelText(messages['admin.sources.file']), { target: { files: [] } });
    await userEvent.click(screen.getByRole('button', { name: messages['admin.sources.upload'] }));
    expect(await screen.findByText(messages['admin.sources.fileRequired'])).toBeInTheDocument();
    expect(backend.seen.some((r) => r.method === 'POST')).toBe(false);
  });
});
