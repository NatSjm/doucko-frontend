// @trace FR-55
// Store spec content-authoring: "Draft and published status", "Mission publishing rules" (Task in a
// published mission cannot return to draft, Unpublish the mission first) and "Delete only unused
// content" (Delete an unused draft task, Task with attempts / in a published mission cannot be deleted).
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { messages } from '@/i18n';
import { stubSignedInAdmin, type StubbedAdminBackend } from '@/test/admin-backend';
import { SEED } from '@/test/fake-admin-backend';
import { renderAt } from '@/test/render';
import { TaskEditorScreen } from './TaskEditorScreen';

vi.mock('@/features/sources/pdf', () => import('@/test/pdf-mock'));

const m = messages;
const panel = () => screen.getByRole('region', { name: m['admin.taskStatus.title'] });
const button = (name: string) => within(panel()).getByRole('button', { name });

vi.setConfig({ testTimeout: 30_000 });

afterEach(() => {
  vi.unstubAllGlobals();
});

async function open(taskId: string, prepare?: (b: StubbedAdminBackend) => void) {
  const backend = stubSignedInAdmin();
  prepare?.(backend);
  renderAt(<TaskEditorScreen />, `/admin/tasks/edit?taskId=${taskId}`);
  await screen.findByRole('region', { name: m['admin.taskStatus.title'] });
  return backend;
}

describe('task status and deletion (FR-55)', () => {
  it('lists the missions that hold the task, linked to their editors', async () => {
    await open(SEED.taskDecimal);
    expect(within(panel()).getByText(m['admin.taskStatus.inMissions'])).toBeInTheDocument();
    const link = await within(panel()).findByRole('link', { name: /Desetinná čísla/ });
    expect(link).toHaveAttribute('href', `/admin/missions/edit?missionId=${SEED.missionDecimals}`);
    expect(link).toHaveTextContent('Mission 1');
  });

  it('says when the task is in no mission', async () => {
    await open(SEED.taskPerimeter);
    expect(within(panel()).getByText(m['admin.taskStatus.noMissions'])).toBeInTheDocument();
  });

  it('publishes a draft task and unpublishes it again', async () => {
    const backend = await open(SEED.taskDecimal);
    await userEvent.click(button(m['admin.taskStatus.publish']));
    expect(await within(panel()).findByText(m['admin.taskStatus.published'])).toBeInTheDocument();
    expect(backend.tasks[0].status).toBe('PUBLISHED');
    expect(screen.getAllByText(m['admin.status.PUBLISHED']).length).toBeGreaterThan(0);
    await userEvent.click(button(m['admin.taskStatus.unpublish']));
    expect(await within(panel()).findByText(m['admin.taskStatus.unpublished'])).toBeInTheDocument();
    expect(backend.tasks[0].status).toBe('DRAFT');
  });

  it('a task in a published mission cannot return to draft: the refusal names the mission (Task in a published mission cannot return to draft)', async () => {
    const backend = await open(SEED.taskDecimal, (b) => {
      b.tasks.forEach((t) => (t.status = 'PUBLISHED'));
      b.missions[0].status = 'PUBLISHED';
    });
    await userEvent.click(button(m['admin.taskStatus.unpublish']));
    const alert = await within(panel()).findByRole('alert');
    expect(alert).toHaveTextContent('The task is in a published mission. Unpublish the mission first.');
    expect(within(alert).getByRole('link', { name: /Desetinná čísla/ })).toHaveAttribute('href', `/admin/missions/edit?missionId=${SEED.missionDecimals}`);
    expect(backend.tasks[0].status).toBe('PUBLISHED');
    // Unpublish the mission first: then the task can return to draft.
    backend.missions[0].status = 'DRAFT';
    await userEvent.click(button(m['admin.taskStatus.unpublish']));
    expect(await within(panel()).findByText(m['admin.taskStatus.unpublished'])).toBeInTheDocument();
    expect(backend.tasks[0].status).toBe('DRAFT');
  });

  it('deletes an unused draft task after confirming; draft missions no longer list it (Delete an unused draft task)', async () => {
    const backend = await open(SEED.taskDecimal);
    await userEvent.click(button(m['admin.taskStatus.delete']));
    expect(within(panel()).getByText(m['admin.taskStatus.confirmDelete'])).toBeInTheDocument();
    await userEvent.click(button(m['admin.common.delete']));
    expect(await screen.findByText(m['admin.taskStatus.deleted'])).toBeInTheDocument();
    expect(screen.getByRole('link', { name: m['admin.taskStatus.back'] })).toHaveAttribute('href', '/admin/tasks');
    expect(screen.queryByRole('button', { name: m['admin.editor.save'] })).not.toBeInTheDocument();
    expect(backend.tasks.some((t) => t.taskId === SEED.taskDecimal)).toBe(false);
    expect(backend.missions[0].taskIds).toEqual([SEED.taskChoice]);
  });

  it('disables delete with an explanation offering to unpublish (Task with attempts cannot be deleted)', async () => {
    await open(SEED.taskDecimal, (b) => b.usage.add(SEED.taskDecimal));
    expect(button(m['admin.taskStatus.delete'])).toBeDisabled();
    expect(within(panel()).getByText(m['admin.taskStatus.notDeletable'])).toBeInTheDocument();
  });

  it('shows a delete refused by the server with its reason and the mission (Task in a published mission cannot be deleted)', async () => {
    const backend = await open(SEED.taskDecimal);
    backend.tasks.forEach((t) => (t.status = 'PUBLISHED'));
    backend.missions[0].status = 'PUBLISHED';
    await userEvent.click(button(m['admin.taskStatus.delete']));
    await userEvent.click(button(m['admin.common.delete']));
    const alert = await within(panel()).findByRole('alert');
    expect(alert).toHaveTextContent('The task is in a published mission. Unpublish the mission first.');
    expect(within(alert).getByRole('link', { name: /Desetinná čísla/ })).toBeInTheDocument();
    expect(backend.tasks.some((t) => t.taskId === SEED.taskDecimal)).toBe(true);
  });

  it('a delete refused for practice records names the task itself', async () => {
    const backend = await open(SEED.taskDecimal);
    backend.usage.add(SEED.taskDecimal);
    await userEvent.click(button(m['admin.taskStatus.delete']));
    await userEvent.click(button(m['admin.common.delete']));
    const alert = await within(panel()).findByRole('alert');
    expect(alert).toHaveTextContent('Practice records reference this task, so it cannot be deleted. Unpublish it instead.');
    expect(within(alert).getByRole('link', { name: m['admin.conflict.thisTask'] })).toHaveAttribute('href', `/admin/tasks/edit?taskId=${SEED.taskDecimal}`);
  });

  it('publishing waits while the form has unsaved edits, since it acts on the stored task (review F01)', async () => {
    const backend = await open(SEED.taskDecimal);
    const prompt = screen.getByLabelText(m['admin.editor.prompt'], { exact: true });
    await userEvent.type(prompt, ' Oprava.');
    expect(button(m['admin.taskStatus.publish'])).toBeDisabled();
    expect(within(panel()).getByText(m['admin.taskStatus.saveFirst'])).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: m['admin.editor.save'] }));
    expect(await screen.findByText(m['admin.editor.updated'])).toBeInTheDocument();
    expect(button(m['admin.taskStatus.publish'])).toBeEnabled();
    expect(within(panel()).queryByText(m['admin.taskStatus.saveFirst'])).not.toBeInTheDocument();
    await userEvent.click(button(m['admin.taskStatus.publish']));
    expect(await within(panel()).findByText(m['admin.taskStatus.published'])).toBeInTheDocument();
    expect(backend.tasks[0].input.prompt).toBe('Zapiš jednu polovinu jako desetinné číslo. Oprava.');
  });

  it('says the action failed without a server answer', async () => {
    const backend = await open(SEED.taskDecimal);
    backend.down = true;
    await userEvent.click(button(m['admin.taskStatus.publish']));
    expect(await within(panel()).findByRole('alert')).toHaveTextContent(m['admin.common.actionFailed']);
  });

  it('a refused topic change of a task in a mission names the mission (Changing the topic of a task in a mission)', async () => {
    await open(SEED.taskDecimal);
    await userEvent.selectOptions(screen.getByLabelText(m['admin.editor.topic'], { exact: true }), 'Obvod a obsah');
    await userEvent.click(screen.getByRole('button', { name: m['admin.editor.save'] }));
    const alert = await screen.findByText('The topic or grade cannot change while the task is in a mission.');
    expect(within(alert.closest('[role="alert"]') as HTMLElement).getByRole('link', { name: /Desetinná čísla/ })).toBeInTheDocument();
  });
});
