// Store spec content-authoring: "Mission publishing rules" and "Delete only unused content" refuse
// with a message naming what blocks the action. Shared admin plumbing (the screens trace their FRs).
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { messages } from '@/i18n';
import { format } from '@/i18n/format';
import { renderAt } from '@/test/render';
import { ConflictAlert } from './ConflictAlert';
import { DeleteControl } from './DeleteControl';
import { ApiError } from './problem';

const m = messages;
const refusal = (conflicts: string[], detail?: string) =>
  new ApiError(409, { type: 'about:blank', title: 'Not allowed now', status: 409, detail, conflicts });
const describeId = (id: string) => (id === 'known' ? { label: 'Zapiš jednu polovinu', href: '/admin/tasks/edit?taskId=known' } : null);

describe('conflict alert', () => {
  it('shows the server reason and names every blocker with a link to fix it', () => {
    renderAt(<ConflictAlert error={refusal(['known', 'other'], 'Only published text tasks can be in a published mission.')} describe={describeId} />);
    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('Only published text tasks can be in a published mission.')).toBeInTheDocument();
    expect(within(alert).getByText(m['admin.conflict.blockedBy'])).toBeInTheDocument();
    expect(within(alert).getByRole('link', { name: 'Zapiš jednu polovinu' })).toHaveAttribute('href', '/admin/tasks/edit?taskId=known');
    expect(within(alert).getByText(format(m['admin.conflict.unknownItem'], { id: 'other' }))).toBeInTheDocument();
  });

  it('falls back to the problem title and lists no blockers without conflicts', () => {
    renderAt(<ConflictAlert error={refusal([])} describe={describeId} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Not allowed now');
    expect(screen.queryByText(m['admin.conflict.blockedBy'])).not.toBeInTheDocument();
  });

  it('says the action failed when there is no problem body (network, 5xx)', () => {
    renderAt(<ConflictAlert error={new TypeError('Failed to fetch')} describe={describeId} />);
    expect(screen.getByRole('alert')).toHaveTextContent(m['admin.common.actionFailed']);
  });

  it('shows nothing without an error', () => {
    const { container } = renderAt(<ConflictAlert error={null} describe={describeId} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('delete control', () => {
  it('asks first; Cancel (focused) and Escape keep everything', async () => {
    const onConfirm = vi.fn(async () => {});
    renderAt(<DeleteControl label="Delete mission" question="Delete this mission?" onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete mission' }));
    expect(screen.getByText('Delete this mission?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: m['admin.common.cancel'] })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(screen.queryByText('Delete this mission?')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete mission' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Delete mission' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByText('Delete this mission?')).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('deletes on confirm and closes the question', async () => {
    const onConfirm = vi.fn(async () => {});
    renderAt(<DeleteControl label="Delete mission" question="Delete this mission?" onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete mission' }));
    await userEvent.click(screen.getByRole('button', { name: m['admin.common.delete'] }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Delete this mission?')).not.toBeInTheDocument();
  });

  it('cannot be started while disabled', () => {
    renderAt(<DeleteControl label="Delete mission" question="Delete this mission?" disabled onConfirm={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Delete mission' })).toBeDisabled();
  });
});
