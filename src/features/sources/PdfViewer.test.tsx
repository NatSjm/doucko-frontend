// @trace FR-2
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { format } from '@/i18n/format';
import { messages } from '@/i18n';
import { stubSignedInAdmin } from '@/test/admin-backend';
import { control, rendered } from '@/test/pdf-mock';
import { renderAt } from '@/test/render';
import { PdfViewer } from './PdfViewer';

vi.mock('@/features/sources/pdf', () => import('@/test/pdf-mock'));

const SOURCE = '11111111-1111-4111-8111-111111111111';
const status = (page: number, count = 120) => format(messages['admin.viewer.status'], { page, count });
const canvas = (page: number) => screen.findByRole('img', { name: format(messages['admin.viewer.canvas'], { page }) });

beforeEach(() => {
  rendered.length = 0;
  control.hold = null;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function open(initialPage = 10) {
  const backend = stubSignedInAdmin();
  renderAt(<PdfViewer sourceId={SOURCE} pageCount={120} initialPage={initialPage} />);
  await canvas(initialPage);
  return backend;
}

const pageField = () => screen.getByLabelText(messages['admin.viewer.page']);

describe('PDF viewer (FR-2)', () => {
  it('loads the source file through the admin client and shows the initial page', async () => {
    const backend = await open(10);
    expect(screen.getByText(status(10))).toBeInTheDocument();
    expect(backend.seen.some((r) => r.path === `/api/admin/sources/${SOURCE}/file`)).toBe(true);
    await waitFor(() => expect(rendered.at(-1)).toBe(10));
  });

  it('next and previous page move by one', async () => {
    await open(10);
    await userEvent.click(screen.getByRole('button', { name: messages['admin.viewer.next'] }));
    await canvas(11);
    expect(screen.getByText(status(11))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: messages['admin.viewer.prev'] }));
    await canvas(10);
    await waitFor(() => expect(rendered.at(-1)).toBe(10));
  });

  it('cannot go before page 1 or after the last page', async () => {
    await open(1);
    expect(screen.getByRole('button', { name: messages['admin.viewer.prev'] })).toBeDisabled();
    await userEvent.clear(pageField());
    await userEvent.type(pageField(), '120{Enter}');
    await canvas(120);
    expect(screen.getByRole('button', { name: messages['admin.viewer.next'] })).toBeDisabled();
  });

  it('jumps to a page entered with Enter', async () => {
    await open(10);
    await userEvent.clear(pageField());
    await userEvent.type(pageField(), '57{Enter}');
    await canvas(57);
    expect(screen.getByText(status(57))).toBeInTheDocument();
  });

  it.each(['130', '0', 'abc', '5,5', '99999999999'])('stays on page 10 and shows the range for %j', async (raw) => {
    await open(10);
    await userEvent.clear(pageField());
    await userEvent.type(pageField(), raw);
    await userEvent.click(screen.getByRole('button', { name: messages['admin.viewer.go'] }));
    expect(await screen.findByText(format(messages['admin.viewer.invalid'], { count: 120 }))).toBeInTheDocument();
    expect(screen.getByText(status(10))).toBeInTheDocument();
    expect(pageField()).toHaveAttribute('aria-invalid', 'true');
  });

  it('says so when the file cannot be loaded', async () => {
    const backend = stubSignedInAdmin();
    backend.failWith = 500;
    renderAt(<PdfViewer sourceId={SOURCE} pageCount={120} initialPage={1} />);
    expect(await screen.findByText(messages['admin.viewer.failed'])).toBeInTheDocument();
  });

  it('says so when the file is not a readable PDF', async () => {
    const backend = stubSignedInAdmin();
    backend.override = { match: (_m, p) => p.endsWith('/file'), status: 200, body: 'not a pdf' };
    renderAt(<PdfViewer sourceId={SOURCE} pageCount={120} initialPage={1} />);
    expect(await screen.findByText(messages['admin.viewer.failed'])).toBeInTheDocument();
  });
});

describe('PDF viewer while a page is still rendering', () => {
  it('ignores a render that finishes after the viewer moved on or closed', async () => {
    stubSignedInAdmin();
    const view = renderAt(<PdfViewer sourceId={SOURCE} pageCount={120} initialPage={10} />);
    await canvas(10);
    let release = () => {};
    control.hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    await userEvent.click(screen.getByRole('button', { name: messages['admin.viewer.next'] }));
    view.unmount();
    release();
    await waitFor(() => expect(rendered.at(-1)).toBe(11));
  });
});
