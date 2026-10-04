// @trace FR-2
// @trace FR-13
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { format } from '@/i18n/format';
import { messages } from '@/i18n';
import { stubSignedInAdmin } from '@/test/admin-backend';
import { renderAt } from '@/test/render';
import { SourceViewerScreen } from './SourceViewerScreen';

vi.mock('@/features/sources/pdf', () => import('@/test/pdf-mock'));

const SOURCE = '11111111-1111-4111-8111-111111111111';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('source viewer screen (FR-13: open the source at a page)', () => {
  it('opens the source named in the query at the page named there', async () => {
    stubSignedInAdmin();
    renderAt(<SourceViewerScreen />, `/admin/sources/view?sourceId=${SOURCE}&page=57`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Matematika 6 – pracovní sešit' })).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: format(messages['admin.viewer.canvas'], { page: 57 }) })).toBeInTheDocument();
  });

  it('starts at page 1 when the query has no valid page', async () => {
    stubSignedInAdmin();
    renderAt(<SourceViewerScreen />, `/admin/sources/view?sourceId=${SOURCE}&page=999`);
    expect(await screen.findByRole('img', { name: format(messages['admin.viewer.canvas'], { page: 1 }) })).toBeInTheDocument();
  });

  it('says the source was not found for an unknown or missing id, with a way back', async () => {
    stubSignedInAdmin();
    renderAt(<SourceViewerScreen />, '/admin/sources/view?sourceId=99999999-9999-4999-8999-999999999999');
    expect(await screen.findByText(messages['admin.sources.notFound'])).toBeInTheDocument();
    expect(screen.getByRole('link', { name: messages['admin.sources.back'] })).toHaveAttribute('href', '/admin/sources');
  });

  it('says the source was not found without an id', async () => {
    stubSignedInAdmin();
    renderAt(<SourceViewerScreen />, '/admin/sources/view');
    expect(await screen.findByText(messages['admin.sources.notFound'])).toBeInTheDocument();
  });

  it('offers a retry when the source cannot be loaded', async () => {
    const backend = stubSignedInAdmin();
    backend.failWith = 500;
    renderAt(<SourceViewerScreen />, `/admin/sources/view?sourceId=${SOURCE}`);
    expect(await screen.findByText(messages['admin.common.loadFailed'])).toBeInTheDocument();
    backend.failWith = null;
    await userEvent.click(screen.getByRole('button', { name: messages['admin.session.retry'] }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Matematika 6 – pracovní sešit' })).toBeInTheDocument();
  });
});
